-- ==============================================================================
-- TRAZABILIDAD Y AUTOMATIZACIÓN DE DESCUENTO DE PACKAGING EN VENTAS (sale_packaging)
-- Elohim Import ERP - Supabase PostgreSQL Schema & RLS Policies
-- ==============================================================================

-- 1. Crear tabla sale_packaging
CREATE TABLE IF NOT EXISTS public.sale_packaging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    packaging_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity_used NUMERIC(10, 2) NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comentarios explicativos
COMMENT ON TABLE public.sale_packaging IS 'Trazabilidad de insumos de packaging (cajas, bolsas, atomizadores, frascos decant) consumidos por venta';
COMMENT ON COLUMN public.sale_packaging.packaging_id IS 'ID del insumo consumido (tabla products donde type = supply)';
COMMENT ON COLUMN public.sale_packaging.quantity_used IS 'Cantidad del insumo utilizada en la venta';

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.sale_packaging ENABLE ROW LEVEL SECURITY;

-- 2. Políticas RLS
DROP POLICY IF EXISTS "Permitir lectura de sale_packaging a usuarios autenticados" ON public.sale_packaging;
CREATE POLICY "Permitir lectura de sale_packaging a usuarios autenticados"
    ON public.sale_packaging FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Permitir insercion de sale_packaging a usuarios autenticados" ON public.sale_packaging;
CREATE POLICY "Permitir insercion de sale_packaging a usuarios autenticados"
    ON public.sale_packaging FOR INSERT
    WITH CHECK (true);
