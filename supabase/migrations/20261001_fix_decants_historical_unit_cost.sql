-- ==============================================================================
-- MIGRACIÓN: SANEAMIENTO HISTÓRICO DE COSTEO EN DECANTS Y COLUMNA TESORERÍA EN SALES
-- Fecha: 2026-10-01
-- ==============================================================================
-- 1. Agregar columna treasury_account_id en sales (idempotente).
-- 2. Recalcular y congelar unit_cost_at_moment para todas las ventas históricas de
--    tipo 'decant_liquid' multiplicando el costo por ml (base_cost_ars) por el volumen
--    real vendido (5ml por defecto, 10ml si está especificado en el nombre o receta).
--    En Elohim Import, base_cost_ars contempla el insumo, por lo que:
--    unit_cost = base_cost_ars * decant_ml.
-- ==============================================================================

-- 1. Columna de trazabilidad de cuenta de tesorería principal en sales
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS treasury_account_id UUID REFERENCES public.treasury_accounts(id) ON DELETE SET NULL;

-- 2. Actualizar unit_cost_at_moment en sale_items para decants históricos
-- Detectar volumen (10ml si dice '10ml' o '10 ml' en el nombre del producto, caso contrario 5ml por defecto)
UPDATE public.sale_items si
SET unit_cost_at_moment = p.base_cost_ars * (
  CASE 
    WHEN LOWER(p.name) LIKE '%10ml%' OR LOWER(p.name) LIKE '%10 ml%' THEN 10
    ELSE 5
  END
)
FROM public.products p
WHERE si.product_id = p.id
  AND p.type = 'decant_liquid'
  AND p.base_cost_ars IS NOT NULL
  AND p.base_cost_ars > 0
  AND (
    si.unit_cost_at_moment IS NULL 
    OR si.unit_cost_at_moment <= (p.base_cost_ars * 1.5)
  );

-- 3. Backfill para botellas normales e insumos que pudieran tener unit_cost_at_moment nulo
UPDATE public.sale_items si
SET unit_cost_at_moment = p.base_cost_ars
FROM public.products p
WHERE si.product_id = p.id
  AND p.type != 'decant_liquid'
  AND si.unit_cost_at_moment IS NULL
  AND p.base_cost_ars IS NOT NULL;
