-- ==============================================================================
-- MIGRACIÓN: OPERACIONES FINANCIERAS ATÓMICAS (TESORERÍA + STOCK)
-- Fase 2 / Bloque 1 — Integridad Contable, Concurrencia y Transaccionalidad
-- ==============================================================================
-- Corrige tres fallas de integridad:
--   1. [C5] Carrera READ-MODIFY-WRITE en saldos de tesorería (SELECT -> calcular en
--      memoria -> UPDATE): dos cobros concurrentes leían el mismo saldo y uno se perdía.
--   2. [C5] El asiento de auditoría en treasury_movements nunca se registraba: los
--      helpers insertaban la columna inexistente 'amount' (la real es 'amount_ars')
--      y el error de PostgREST era ignorado en silencio.
--   3. [C6] Sobreventa (TOCTOU) en pedidos web: el stock se validaba con SELECT y se
--      descontaba con UPDATE de valor absoluto calculado en memoria; dos compras
--      concurrentes sobrevendían.
-- ==============================================================================

-- ------------------------------------------------------------------
-- 1. adjust_treasury_balance
-- Ajuste atómico de saldo de cuenta de tesorería + asiento de auditoría.
-- El UPDATE incremental se ejecuta en un solo bloque SQL a nivel de motor:
-- el row lock de PostgreSQL serializa las ejecuciones concurrentes y ningún
-- delta se pierde. SECURITY DEFINER + search_path fijo evita hijacking;
-- solo service_role tiene permiso de ejecución (el cliente no puede invocarla).
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adjust_treasury_balance(
    p_account_id UUID,
    p_delta_ars NUMERIC,
    p_delta_usd NUMERIC DEFAULT 0,
    p_movement_type TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL
)
RETURNS TABLE (
    o_id UUID,
    o_account_name TEXT,
    o_balance_ars NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_balance_ars NUMERIC;
    v_account_name TEXT;
    v_has_usd_column BOOLEAN;
BEGIN
    IF p_account_id IS NULL THEN
        RAISE EXCEPTION 'CUENTA_INVALIDA: El ID de cuenta de tesorería es obligatorio';
    END IF;

    -- Forward-compatible: aplicar p_delta_usd solo si la tabla ya posee la columna balance_usd
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'treasury_accounts'
          AND column_name = 'balance_usd'
    ) INTO v_has_usd_column;

    -- Ajuste atómico: el row lock implícito del UPDATE serializa cobros concurrentes
    IF v_has_usd_column THEN
        UPDATE public.treasury_accounts
        SET balance_ars = balance_ars + ROUND(p_delta_ars),
            balance_usd = balance_usd + p_delta_usd
        WHERE treasury_accounts.id = p_account_id
        RETURNING treasury_accounts.account_name, treasury_accounts.balance_ars
        INTO v_account_name, v_new_balance_ars;
    ELSE
        UPDATE public.treasury_accounts
        SET balance_ars = balance_ars + ROUND(p_delta_ars)
        WHERE treasury_accounts.id = p_account_id
        RETURNING treasury_accounts.account_name, treasury_accounts.balance_ars
        INTO v_account_name, v_new_balance_ars;
    END IF;

    -- Cuenta inexistente: error explícito (antes se fallaba en silencio)
    IF NOT FOUND THEN
        RAISE EXCEPTION 'CUENTA_TESORERIA_NO_ENCONTRADA: La cuenta % no existe en treasury_accounts', p_account_id;
    END IF;

    -- Saldo final inválido (negativo): error explícito (antes se permitía en silencio)
    IF v_new_balance_ars < 0 THEN
        RAISE EXCEPTION 'SALDO_TESORERIA_INVALIDO: La operación dejaría la cuenta % con saldo negativo (%)', v_account_name, v_new_balance_ars;
    END IF;

    -- Asiento de auditoría atómico dentro de la misma transacción (columna real amount_ars > 0)
    IF p_movement_type IS NOT NULL AND ABS(ROUND(p_delta_ars)) > 0 THEN
        INSERT INTO public.treasury_movements (account_id, type, amount_ars, description, reference_id)
        VALUES (
            p_account_id,
            p_movement_type,
            ABS(ROUND(p_delta_ars)),
            COALESCE(p_description, 'Ajuste de tesorería'),
            p_reference_id
        );
    END IF;

    RETURN QUERY SELECT p_account_id, v_account_name, v_new_balance_ars;
END;
$$;

-- Solo el servidor (service role) puede ejecutar el ajuste de tesorería
REVOKE EXECUTE ON FUNCTION public.adjust_treasury_balance(UUID, NUMERIC, NUMERIC, TEXT, TEXT, UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_treasury_balance(UUID, NUMERIC, NUMERIC, TEXT, TEXT, UUID) TO service_role;

-- ------------------------------------------------------------------
-- 2. deduct_stock_atomic
-- Deducción atómica y condicional de stock (unidades o mililitros):
-- solo descuenta si hay existencia suficiente; si no la hay, NO actualiza
-- ninguna fila y el llamador detecta la falta de resultado (previene sobreventa).
-- p_quantity negativo re-agrega stock (compensación transaccional ante fallos).
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.deduct_stock_atomic(
    p_product_id UUID,
    p_quantity NUMERIC
)
RETURNS TABLE (
    o_id UUID,
    o_stock_quantity NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_product_id IS NULL OR p_quantity IS NULL THEN
        RAISE EXCEPTION 'STOCK_INVALIDO: product_id y quantity son obligatorios';
    END IF;

    RETURN QUERY
    UPDATE public.products
    SET stock_quantity = products.stock_quantity - p_quantity
    WHERE products.id = p_product_id
      AND products.stock_quantity >= p_quantity
    RETURNING products.id, products.stock_quantity;
END;
$$;

-- Solo el servidor (service role) puede ejecutar la deducción de stock
REVOKE EXECUTE ON FUNCTION public.deduct_stock_atomic(UUID, NUMERIC) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_stock_atomic(UUID, NUMERIC) TO service_role;
