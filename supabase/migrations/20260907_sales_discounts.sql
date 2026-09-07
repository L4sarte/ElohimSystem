-- ==============================================================================
-- Migración: Soporte para Descuentos y Ajuste de Precio Final en POS
-- Fecha: 2026-09-07
-- Descripción:
--   Agrega columnas numéricas y tipadas para registrar subtotal original,
--   tipo de descuento, valor ingresado, monto deducido en ARS y porcentaje
--   efectivo. Incluye retrocompatibilidad para ventas históricas.
-- ==============================================================================

-- 1. Agregar columnas a la tabla sales
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS subtotal_ars NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount_ars NUMERIC(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5, 2) DEFAULT 0;

-- 2. Retrocompatibilidad: actualizar ventas históricas sin subtotal
UPDATE public.sales
SET subtotal_ars = total_ars,
    discount_type = 'none',
    discount_value = 0,
    discount_amount_ars = 0,
    discount_percentage = 0
WHERE subtotal_ars IS NULL;

-- 3. Índices de consulta rápida para auditorías contables y de ventas
CREATE INDEX IF NOT EXISTS idx_sales_discount_amount 
  ON public.sales(discount_amount_ars) 
  WHERE discount_amount_ars > 0;

CREATE INDEX IF NOT EXISTS idx_sales_discount_type 
  ON public.sales(discount_type);
