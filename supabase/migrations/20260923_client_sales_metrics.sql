-- ==============================================================================
-- MIGRACIÓN: MÉTRICAS AGREGADAS DE VENTAS POR CLIENTE (GROUP BY EN EL MOTOR)
-- Fase 2 / Bloque 3 — Performance y Cuellos de Botella
-- ==============================================================================
-- Corrige [A1] getClientsDetailed: en lugar de traer TODO el historial de ventas
-- (una fila por venta) a memoria para sumar totales por cliente, esta función
-- agrega en el motor SQL (GROUP BY) y devuelve una fila por cliente.
-- Con miles de ventas, reduce el payload y el tiempo de cómputo drásticamente.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_client_sales_totals()
RETURNS TABLE (
    o_client_id UUID,
    o_total_spent NUMERIC,
    o_sales_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT client_id, SUM(total_ars), COUNT(*)
    FROM public.sales
    WHERE client_id IS NOT NULL
      AND status NOT IN ('voided', 'pending_payment')
    GROUP BY client_id
$$;

-- Solo el servidor (service role) puede ejecutar la agregación
REVOKE EXECUTE ON FUNCTION public.get_client_sales_totals() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_sales_totals() TO service_role;
