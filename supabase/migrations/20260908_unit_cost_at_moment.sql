-- ==============================================================================
-- Migración: Congelamiento de Costo Unitario Histórico en Venta (sale_items)
-- Fecha: 2026-09-08
-- Descripción:
--   Agrega la columna unit_cost_at_moment a sale_items para preservar el costo
--   de catálogo vigente en el instante de la transacción. Esto blinda el P&L y
--   el margen bruto histórico contra aumentos futuros de costos de reposición.
-- ==============================================================================

-- 1. Agregar columna unit_cost_at_moment a la tabla sale_items
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS unit_cost_at_moment NUMERIC(14, 2);

-- 2. Retrocompatibilidad: poblar ventas pasadas que no tengan costo unitario registrado
-- tomando el costo actual del producto o 0
UPDATE public.sale_items si
SET unit_cost_at_moment = COALESCE(p.base_cost_ars, 0)
FROM public.products p
WHERE si.product_id = p.id
  AND si.unit_cost_at_moment IS NULL;

-- 3. Índice para acelerar el cálculo de COGS y P&L en analíticas
CREATE INDEX IF NOT EXISTS idx_sale_items_unit_cost
  ON public.sale_items(unit_cost_at_moment)
  WHERE unit_cost_at_moment IS NOT NULL;
