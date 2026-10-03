-- ==============================================================================
-- MIGRACIÓN: SANEAMIENTO Y COMPATIBILIDAD BI-DIRECCIONAL EN TREASURY_MOVEMENTS
-- ==============================================================================
-- Garantiza que tanto 'amount' como 'amount_ars' existan, no violen constraints
-- y se mantengan sincronizados automáticamente por trigger, resolviendo el
-- fallo en la RPC adjust_treasury_balance.

DO $$
BEGIN
    -- 1. Agregar columna amount_ars si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'treasury_movements' AND column_name = 'amount_ars'
    ) THEN
        ALTER TABLE public.treasury_movements ADD COLUMN amount_ars NUMERIC;
    END IF;

    -- 2. Asegurar que las columnas permitan valores nulos antes de la sincronización por trigger
    ALTER TABLE public.treasury_movements ALTER COLUMN amount DROP NOT NULL;
    ALTER TABLE public.treasury_movements ALTER COLUMN amount_ars DROP NOT NULL;

    -- 3. Sincronizar datos históricos
    UPDATE public.treasury_movements SET amount_ars = amount WHERE amount_ars IS NULL AND amount IS NOT NULL;
    UPDATE public.treasury_movements SET amount = amount_ars WHERE amount IS NULL AND amount_ars IS NOT NULL;
END $$;

-- 4. Función Trigger de Sincronización Automática
CREATE OR REPLACE FUNCTION public.sync_treasury_movement_amounts()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.amount_ars IS NULL AND NEW.amount IS NOT NULL THEN
        NEW.amount_ars := NEW.amount;
    ELSIF NEW.amount IS NULL AND NEW.amount_ars IS NOT NULL THEN
        NEW.amount := NEW.amount_ars;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_treasury_movement_amounts ON public.treasury_movements;
CREATE TRIGGER trg_sync_treasury_movement_amounts
BEFORE INSERT OR UPDATE ON public.treasury_movements
FOR EACH ROW
EXECUTE FUNCTION public.sync_treasury_movement_amounts();

-- 5. Actualizar la RPC adjust_treasury_balance para insertar en ambas columnas explícitamente
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

    -- Cuenta inexistente: error explícito
    IF NOT FOUND THEN
        RAISE EXCEPTION 'CUENTA_TESORERIA_NO_ENCONTRADA: La cuenta % no existe en treasury_accounts', p_account_id;
    END IF;

    -- Saldo final inválido (negativo): error explícito
    IF v_new_balance_ars < 0 THEN
        RAISE EXCEPTION 'SALDO_TESORERIA_INVALIDO: La operación dejaría la cuenta % con saldo negativo (%)', v_account_name, v_new_balance_ars;
    END IF;

    -- Asiento de auditoría atómico dentro de la misma transacción (insertando en amount y amount_ars)
    IF p_movement_type IS NOT NULL AND ABS(ROUND(p_delta_ars)) > 0 THEN
        INSERT INTO public.treasury_movements (account_id, type, amount, amount_ars, description, reference_id)
        VALUES (
            p_account_id,
            p_movement_type,
            ABS(ROUND(p_delta_ars)),
            ABS(ROUND(p_delta_ars)),
            COALESCE(p_description, 'Ajuste de tesorería'),
            p_reference_id
        );
    END IF;

    RETURN QUERY SELECT p_account_id, v_account_name, v_new_balance_ars;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.adjust_treasury_balance(UUID, NUMERIC, NUMERIC, TEXT, TEXT, UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_treasury_balance(UUID, NUMERIC, NUMERIC, TEXT, TEXT, UUID) TO service_role;
