-- ==============================================================================
-- FIX & AUDITORÍA: FRACCIONAMIENTO ATÓMICO DE BOTELLAS Y TRAZABILIDAD DE DECANTS
-- Fecha: 2026-10-19
-- Descripción:
-- 1. Crea la tabla de auditoría histórica `public.fractionation_logs` (faltante en
--    producción, lo cual provocaba el fallo 42P01 dentro de `fractionate_bottle`).
-- 2. Configura índices y políticas RLS para `fractionation_logs`.
-- 3. Reemplaza la función RPC `public.fractionate_bottle` asegurando:
--    - Bloqueo pesimista (FOR UPDATE) de botella origen y granel destino.
--    - Validación de stock disponible (stock_quantity >= 1) y volumen > 0.
--    - Cálculo exacto del Costo Promedio Ponderado (PPP) por ml.
--    - Descuento atómico de 1 unidad en la botella cerrada (stock_quantity - 1).
--    - Aumento atómico de ml y actualización de base_cost_ars en el granel.
--    - Verificación segura de clave foránea `p_admin_id` contra `public.profiles`
--      para evitar violaciones de FK si el usuario no tiene fila en `profiles`.
--    - Inserción del registro de auditoría en `public.fractionation_logs`.
--    - Recarga del caché de esquemas de PostgREST (`NOTIFY pgrst, 'reload schema'`).
-- ==============================================================================

-- 1. TABLA DE AUDITORÍA DE TRASVASADOS / FRACCIONAMIENTOS
CREATE TABLE IF NOT EXISTS public.fractionation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_bottle_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    target_liquid_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    volume_ml NUMERIC(10, 2) NOT NULL CHECK (volume_ml > 0),
    cost_transferred_ars NUMERIC(12, 2) NOT NULL DEFAULT 0,
    cost_per_ml_calculated NUMERIC(12, 2) NOT NULL DEFAULT 0,
    admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fractionation_logs_source ON public.fractionation_logs(source_bottle_id);
CREATE INDEX IF NOT EXISTS idx_fractionation_logs_target ON public.fractionation_logs(target_liquid_id);
CREATE INDEX IF NOT EXISTS idx_fractionation_logs_created_at ON public.fractionation_logs(created_at DESC);

ALTER TABLE public.fractionation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura de fractionation_logs" ON public.fractionation_logs;
CREATE POLICY "Permitir lectura de fractionation_logs"
    ON public.fractionation_logs FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Permitir insercion de fractionation_logs" ON public.fractionation_logs;
CREATE POLICY "Permitir insercion de fractionation_logs"
    ON public.fractionation_logs FOR INSERT
    WITH CHECK (true);

-- 2. FUNCIÓN RPC TRANSACCIONAL: fractionate_bottle
CREATE OR REPLACE FUNCTION public.fractionate_bottle(
    p_bottle_id UUID,
    p_decant_id UUID,
    p_volume_ml NUMERIC,
    p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bottle RECORD;
    v_decant RECORD;
    v_bottle_volume NUMERIC;
    v_cost_of_bottle NUMERIC;
    v_cost_per_ml_new NUMERIC;
    v_current_ml NUMERIC;
    v_current_cost_per_ml NUMERIC;
    v_current_total_value NUMERIC;
    v_new_total_value NUMERIC;
    v_weighted_avg_cost NUMERIC;
    v_cost_transferred NUMERIC;
    v_valid_admin_id UUID := NULL;
    v_log_id UUID;
BEGIN
    -- Validaciones básicas de entrada
    IF p_bottle_id IS NULL THEN
        RAISE EXCEPTION 'El ID de la botella de origen (p_bottle_id) es obligatorio.';
    END IF;

    IF p_decant_id IS NULL THEN
        RAISE EXCEPTION 'El ID del decant a granel destino (p_decant_id) es obligatorio.';
    END IF;

    IF p_volume_ml IS NULL OR p_volume_ml <= 0 THEN
        RAISE EXCEPTION 'El volumen a fraccionar (p_volume_ml) debe ser mayor a 0 ml (recibido: %).', p_volume_ml;
    END IF;

    -- 1. Validar y bloquear botella cerrada de origen
    SELECT id, name, sku, type, stock_quantity, base_cost_ars, volume_ml
    INTO v_bottle
    FROM public.products
    WHERE id = p_bottle_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Botella de origen con ID % no encontrada en la tabla products.', p_bottle_id;
    END IF;

    IF COALESCE(v_bottle.stock_quantity, 0) < 1 THEN
        RAISE EXCEPTION 'Stock insuficiente para fraccionar "%" (Stock actual: % unidades).', v_bottle.name, COALESCE(v_bottle.stock_quantity, 0);
    END IF;

    -- 2. Validar y bloquear decant a granel destino
    SELECT id, name, sku, type, stock_quantity, base_cost_ars
    INTO v_decant
    FROM public.products
    WHERE id = p_decant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Líquido a granel destino con ID % no encontrado en la tabla products.', p_decant_id;
    END IF;

    -- 3. Determinar volumen base y costos para Precio Promedio Ponderado (PPP)
    v_bottle_volume := COALESCE(NULLIF(v_bottle.volume_ml, 0), p_volume_ml, 100);
    IF v_bottle_volume <= 0 THEN
        v_bottle_volume := 100;
    END IF;

    v_cost_of_bottle := COALESCE(v_bottle.base_cost_ars, 0);
    v_cost_per_ml_new := v_cost_of_bottle / v_bottle_volume;
    v_cost_transferred := ROUND(v_cost_per_ml_new * p_volume_ml, 2);

    v_current_ml := GREATEST(COALESCE(v_decant.stock_quantity, 0), 0);
    v_current_cost_per_ml := GREATEST(COALESCE(v_decant.base_cost_ars, 0), 0);

    IF (v_current_ml + p_volume_ml) > 0 THEN
        IF v_current_ml > 0 AND v_current_cost_per_ml > 0 THEN
            v_current_total_value := v_current_ml * v_current_cost_per_ml;
            v_new_total_value := v_current_total_value + v_cost_transferred;
            v_weighted_avg_cost := ROUND(v_new_total_value / (v_current_ml + p_volume_ml), 2);
        ELSE
            v_weighted_avg_cost := ROUND(v_cost_per_ml_new, 2);
        END IF;
    ELSE
        v_weighted_avg_cost := ROUND(v_cost_per_ml_new, 2);
    END IF;

    -- 4. Verificar que p_admin_id exista en public.profiles para evitar error de FK (23503)
    IF p_admin_id IS NOT NULL THEN
        SELECT id INTO v_valid_admin_id
        FROM public.profiles
        WHERE id = p_admin_id;
    END IF;

    -- 5. Descontar 1 unidad de la botella sellada
    UPDATE public.products
    SET stock_quantity = stock_quantity - 1
    WHERE id = p_bottle_id;

    -- 6. Sumar ml y actualizar Costo Promedio Ponderado (PPP) en el granel
    UPDATE public.products
    SET stock_quantity = COALESCE(stock_quantity, 0) + p_volume_ml,
        base_cost_ars = v_weighted_avg_cost
    WHERE id = p_decant_id;

    -- 7. Insertar registro de auditoría en fractionation_logs
    INSERT INTO public.fractionation_logs (
        source_bottle_id,
        target_liquid_id,
        volume_ml,
        cost_transferred_ars,
        cost_per_ml_calculated,
        admin_id,
        notes
    ) VALUES (
        p_bottle_id,
        p_decant_id,
        p_volume_ml,
        v_cost_transferred,
        v_weighted_avg_cost,
        v_valid_admin_id,
        format(
            'Fraccionamiento de 1 botella de %s (+%s ml) hacia %s. Nuevo PPP: $%s ARS/ml',
            v_bottle.name,
            p_volume_ml,
            v_decant.name,
            v_weighted_avg_cost
        )
    )
    RETURNING id INTO v_log_id;

    RETURN jsonb_build_object(
        'success', true,
        'log_id', v_log_id,
        'bottle_id', p_bottle_id,
        'decant_id', p_decant_id,
        'volume_fractionated_ml', p_volume_ml,
        'new_liquid_stock_ml', v_current_ml + p_volume_ml,
        'new_weighted_avg_cost_ars', v_weighted_avg_cost,
        'cost_transferred_ars', v_cost_transferred
    );
END;
$$;

-- Otorgar permisos de ejecución a los roles de Supabase
GRANT SELECT, INSERT ON public.fractionation_logs TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fractionate_bottle(UUID, UUID, NUMERIC, UUID) TO authenticated, service_role;

-- Forzar recarga del esquema en PostgREST
NOTIFY pgrst, 'reload schema';
