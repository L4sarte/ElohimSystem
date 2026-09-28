-- ==============================================================================
-- MIGRACIÓN: BLINDAJE TOLERANTE DE unit_cost_at_moment EN sale_items
-- Fecha: 2026-09-28
-- ==============================================================================
-- 1. ADD COLUMN IF NOT EXISTS (idempotente — la columna ya existe por la
--    migración 20260908; este ALTER es tolerante a re-aplicaciones).
--
-- 2. CORRECCIÓN DE DATOS: la migración 20260908 retro-alimentó TODAS las ventas
--    sin costo con COALESCE(base_cost_ars, 0). Para productos tipo 'decant_liquid',
--    base_cost_ars es el costo POR MILILITRO (no el de la muestra completa), por lo
--    que esas filas quedaron subvaluadas (~5-10x) y el motor canónico de costos las
--    trataría como costo congelado (prioridad 1). Se identifican por igualdad exacta
--    con el costo actual del producto y se RESETean a NULL para que la cadena
--    canónica los resuelva con la receta BOM (tamaño y costos reales de la muestra).
--
-- 3. BACKFILL idempotente para filas aún sin costo: botellas e insumos (para esos
--    tipos, base_cost_ars SÍ es el costo unitario correcto). Los decants quedan en
--    NULL deliberadamente: el fallback BOM del motor canónico los resuelve con
--    datos reales y sin constantes hardcodeadas.
-- ==============================================================================

ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS unit_cost_at_moment NUMERIC DEFAULT NULL;

-- 2. Resetear valores retro-alimentados incorrectos en decants (per-ml ≠ costo de muestra)
UPDATE public.sale_items si
SET unit_cost_at_moment = NULL
FROM public.products p
WHERE si.product_id = p.id
  AND p.type = 'decant_liquid'
  AND si.unit_cost_at_moment = p.base_cost_ars;

-- 3. Backfill idempotente para filas aún sin costo (botellas e insumos)
UPDATE public.sale_items si
SET unit_cost_at_moment = p.base_cost_ars
FROM public.products p
WHERE si.product_id = p.id
  AND si.unit_cost_at_moment IS NULL
  AND p.base_cost_ars IS NOT NULL;
