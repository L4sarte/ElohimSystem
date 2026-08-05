-- ==============================================================================
-- FASE 2: ESTRUCTURA SQL PARA MÓDULO DE COMBOS (BUNDLES) Y ENVÍOS / LOGÍSTICA
-- Elohim Import ERP - Supabase PostgreSQL Schema & RLS Policies
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLAS PARA COMBOS / BUNDLES
-- ------------------------------------------------------------------------------

-- Tabla de Combos / Bundles
CREATE TABLE IF NOT EXISTS public.product_bundles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price_ars NUMERIC(15, 2) NOT NULL DEFAULT 0,
    price_usd NUMERIC(15, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla Relacional de Ítems / Componentes del Combo
CREATE TABLE IF NOT EXISTS public.bundle_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bundle_id UUID NOT NULL REFERENCES public.product_bundles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity_to_deduct NUMERIC(10, 2) NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.product_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_items ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para product_bundles
DROP POLICY IF EXISTS "Permitir lectura de bundles a usuarios autenticados" ON public.product_bundles;
CREATE POLICY "Permitir lectura de bundles a usuarios autenticados"
    ON public.product_bundles FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Permitir escritura de bundles a administradores" ON public.product_bundles;
CREATE POLICY "Permitir escritura de bundles a administradores"
    ON public.product_bundles FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Políticas RLS para bundle_items
DROP POLICY IF EXISTS "Permitir lectura de bundle_items a usuarios autenticados" ON public.bundle_items;
CREATE POLICY "Permitir lectura de bundle_items a usuarios autenticados"
    ON public.bundle_items FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Permitir escritura de bundle_items a administradores" ON public.bundle_items;
CREATE POLICY "Permitir escritura de bundle_items a administradores"
    ON public.bundle_items FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );


-- ------------------------------------------------------------------------------
-- 2. MODIFICACIÓN DE LA TABLA SALES PARA LOGÍSTICA Y ENVÍOS
-- ------------------------------------------------------------------------------

ALTER TABLE public.sales 
    ADD COLUMN IF NOT EXISTS shipping_provider VARCHAR(50) DEFAULT 'Ninguno',
    ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100),
    ADD COLUMN IF NOT EXISTS shipping_status VARCHAR(20) DEFAULT 'pending';

-- Comentario descriptivo para documentación
COMMENT ON COLUMN public.sales.shipping_provider IS 'Proveedor logístico: Andreani, Correo Argentino, Cadetería, Ninguno';
COMMENT ON COLUMN public.sales.tracking_number IS 'Código o número de seguimiento del paquete';
COMMENT ON COLUMN public.sales.shipping_status IS 'Estado del envío: pending, shipped, delivered';


-- ------------------------------------------------------------------------------
-- 3. FUNCIÓN RPC PARA DESCUENTO DE STOCK DE COMPONENTES DE UN COMBO
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.deduct_bundle_stock(
    p_bundle_id UUID,
    p_quantity NUMERIC DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    item_record RECORD;
BEGIN
    FOR item_record IN 
        SELECT product_id, quantity_to_deduct 
        FROM public.bundle_items 
        WHERE bundle_id = p_bundle_id
    LOOP
        UPDATE public.products
        SET stock_quantity = GREATEST(0, stock_quantity - (item_record.quantity_to_deduct * p_quantity)),
            updated_at = NOW()
        WHERE id = item_record.product_id;
    END LOOP;
END;
$$;
