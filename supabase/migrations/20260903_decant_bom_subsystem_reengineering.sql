-- ==============================================================================
-- REINGENIERÍA INTEGRAL DEL SUBSISTEMA DE DECANTS, RECETAS (BOM) Y AUDITORÍA
-- Elohim Import ERP
-- ==============================================================================

-- 1. SOPORTE MULTI-MEDIDA EN RECETAS BOM (5ml, 10ml, etc.)
-- Agregar columna size_ml si no existe
ALTER TABLE public.product_recipes 
ADD COLUMN IF NOT EXISTS size_ml INTEGER NOT NULL DEFAULT 5;

-- Eliminar la vieja restricción 1-a-1 que impedía múltiples recetas para la misma fragancia
ALTER TABLE public.product_recipes 
DROP CONSTRAINT IF EXISTS unique_product_recipe;

-- Crear restricción única por fragancia + medida (e.g. 5ml y 10ml para la misma fragancia)
ALTER TABLE public.product_recipes 
DROP CONSTRAINT IF EXISTS unique_product_recipe_size;

ALTER TABLE public.product_recipes 
ADD CONSTRAINT unique_product_recipe_size UNIQUE(product_id, size_ml);

COMMENT ON COLUMN public.product_recipes.size_ml IS 'Tamaño en mililitros de la muestra/decant armada por esta receta (5, 10, etc.)';

-- 2. HISTORIAL DE COSTO REAL CONGELADO EN CADA VENTA (sale_items)
ALTER TABLE public.sale_items 
ADD COLUMN IF NOT EXISTS unit_cost_at_moment NUMERIC(12, 2);

COMMENT ON COLUMN public.sale_items.unit_cost_at_moment IS 'Costo unitario real (COGS) al momento exacto de la venta (incluye líquido + insumos para decants)';

-- 3. AUDITORÍA Y TRAZABILIDAD DE FRACCIONAMIENTOS (fractionation_logs)
CREATE TABLE IF NOT EXISTS public.fractionation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_bottle_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    target_liquid_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    volume_ml NUMERIC(10, 2) NOT NULL,
    cost_transferred_ars NUMERIC(12, 2) NOT NULL,
    cost_per_ml_calculated NUMERIC(12, 2) NOT NULL DEFAULT 0,
    admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fractionation_logs_source ON public.fractionation_logs(source_bottle_id);
CREATE INDEX IF NOT EXISTS idx_fractionation_logs_target ON public.fractionation_logs(target_liquid_id);
CREATE INDEX IF NOT EXISTS idx_fractionation_logs_created_at ON public.fractionation_logs(created_at);

ALTER TABLE public.fractionation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura de fractionation_logs" ON public.fractionation_logs;
CREATE POLICY "Permitir lectura de fractionation_logs"
    ON public.fractionation_logs FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Permitir insercion de fractionation_logs" ON public.fractionation_logs;
CREATE POLICY "Permitir insercion de fractionation_logs"
    ON public.fractionation_logs FOR INSERT
    WITH CHECK (true);

-- 4. FUNCIÓN TRANSACCIONAL DE FRACCIONAMIENTO CON PRECIO PROMEDIO PONDERADO (PPP)
CREATE OR REPLACE FUNCTION public.fractionate_bottle(
    p_bottle_id UUID,
    p_decant_id UUID,
    p_volume_ml NUMERIC,
    p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
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
BEGIN
    -- Validar y bloquear botella
    SELECT id, name, stock_quantity, base_cost_ars, volume_ml
    INTO v_bottle
    FROM public.products
    WHERE id = p_bottle_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Botella con ID % no encontrada.', p_bottle_id;
    END IF;

    IF v_bottle.stock_quantity < 1 THEN
        RAISE EXCEPTION 'Stock insuficiente de la botella seleccionada para fraccionar.';
    END IF;

    -- Validar y bloquear granel
    SELECT id, name, stock_quantity, base_cost_ars
    INTO v_decant
    FROM public.products
    WHERE id = p_decant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Líquido a granel con ID % no encontrado.', p_decant_id;
    END IF;

    v_bottle_volume := COALESCE(v_bottle.volume_ml, p_volume_ml, 100);
    IF v_bottle_volume <= 0 THEN
        v_bottle_volume := 100;
    END IF;

    v_cost_of_bottle := COALESCE(v_bottle.base_cost_ars, 0);
    v_cost_per_ml_new := v_cost_of_bottle / v_bottle_volume;
    v_cost_transferred := v_cost_per_ml_new * p_volume_ml;

    v_current_ml := COALESCE(v_decant.stock_quantity, 0);
    v_current_cost_per_ml := COALESCE(v_decant.base_cost_ars, 0);

    -- Cálculo de Precio Promedio Ponderado (PPP)
    IF (v_current_ml + p_volume_ml) > 0 THEN
        v_current_total_value := v_current_ml * v_current_cost_per_ml;
        v_new_total_value := v_current_total_value + v_cost_transferred;
        v_weighted_avg_cost := ROUND(v_new_total_value / (v_current_ml + p_volume_ml), 2);
    ELSE
        v_weighted_avg_cost := ROUND(v_cost_per_ml_new, 2);
    END IF;

    -- 1. Restar 1 unidad a la botella sellada
    UPDATE public.products
    SET stock_quantity = stock_quantity - 1
    WHERE id = p_bottle_id;

    -- 2. Sumar ml y actualizar costo promedio ponderado en el granel
    UPDATE public.products
    SET stock_quantity = stock_quantity + p_volume_ml,
        base_cost_ars = v_weighted_avg_cost
    WHERE id = p_decant_id;

    -- 3. Registrar auditoría en fractionation_logs
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
        p_admin_id,
        format('Fraccionamiento de 1 botella de %s a %s ml en %s. Costo promedio/ml: $%s ARS', v_bottle.name, p_volume_ml, v_decant.name, v_weighted_avg_cost)
    );

    RETURN jsonb_build_object(
        'success', true,
        'bottle_id', p_bottle_id,
        'decant_id', p_decant_id,
        'volume_fractionated_ml', p_volume_ml,
        'new_liquid_stock_ml', v_current_ml + p_volume_ml,
        'new_weighted_avg_cost_ars', v_weighted_avg_cost,
        'cost_transferred_ars', v_cost_transferred
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
