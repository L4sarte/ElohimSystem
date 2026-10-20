-- ==============================================================================
-- MIGRACIÓN: REFACTORIZACIÓN INTEGRAL DE COMPRAS B2B, PROVEEDORES Y CUENTAS POR PAGAR (CXP)
-- Elohim Import ERP — Módulo Financiero & Supply Chain Atómico
-- ==============================================================================
-- 1. Evolución de esquema en `purchases` y `purchase_items` (moneda, cotización,
--    condición de pago, fecha de vencimiento, cuenta de tesorería vinculada).
-- 2. Evolución de esquema en `accounts_payable` (amount_total, amount_paid,
--    amount_remaining, currency, exchange_rate, status: 'pending' | 'partial' | 'settled')
--    con trigger bidireccional de compatibilidad (`total_amount_ars` <-> `amount_total`,
--    `paid_amount_ars` <-> `amount_paid`).
-- 3. Vistas de compatibilidad opcionales (`providers`, `provider_debts`, `treasury_transactions`)
--    apuntando a las tablas reales del ERP (`suppliers`, `accounts_payable`, `treasury_movements`).
-- 4. RPC transaccional `register_purchase_transaction`:
--    - Soporta compras al `CONTADO` (`paid_cash`) con débito obligatorio en `treasury_accounts`
--      y asiento en `treasury_movements` (`EGRESO_COMPRA_STOCK`).
--    - Soporta compras en `CUENTA_CORRIENTE` (`pending_credit`) insertando en `accounts_payable`
--      con fecha de vencimiento sin tocar tesorería.
--    - Soporta estado `'received'` (impacta stock e inventario + recalcula Costo Promedio Ponderado PPP
--      en ARS convirtiendo según `exchange_rate` si la compra fue en USD) o `'in_transit'`
--      (genera además la orden en `purchase_orders` para seguimiento en "Mercadería en Camino").
-- 5. RPC transaccional `settle_provider_debt`:
--    - Permite pagos totales o parciales de una deuda en `accounts_payable`.
--    - Debita atómicamente la cuenta de tesorería (`treasury_accounts`) vía `adjust_treasury_balance`,
--      registra el movimiento (`EGRESO_PAGO_PROVEEDOR`), actualiza `amount_paid`, `amount_remaining`
--      y cambia el estado de la deuda a `'partial'` o `'settled'` (y `purchases.payment_status` a
--      `'partial_payment'` o `'paid_cash'`).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ACTUALIZACIÓN DE ESQUEMA: TABLA `purchases` Y `purchase_items`
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    -- Moneda de la operación ('ARS' | 'USD')
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'currency'
    ) THEN
        ALTER TABLE public.purchases ADD COLUMN currency TEXT NOT NULL DEFAULT 'ARS';
    END IF;

    -- Cotización del dólar blue al momento de la compra
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'exchange_rate'
    ) THEN
        ALTER TABLE public.purchases ADD COLUMN exchange_rate NUMERIC(15, 2) NOT NULL DEFAULT 1250.00;
    END IF;

    -- Fecha de vencimiento para compras a crédito (CXP)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'payment_due_date'
    ) THEN
        ALTER TABLE public.purchases ADD COLUMN payment_due_date DATE;
    END IF;

    -- Cuenta de tesorería utilizada (cuando es pago al contado)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'treasury_account_id'
    ) THEN
        ALTER TABLE public.purchases ADD COLUMN treasury_account_id UUID REFERENCES public.treasury_accounts(id) ON DELETE SET NULL;
    END IF;

    -- Notas / referencia de factura o guía
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'notes'
    ) THEN
        ALTER TABLE public.purchases ADD COLUMN notes TEXT;
    END IF;

    -- Columnas adicionales en `purchase_items` para trazabilidad multimoneda
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'purchase_items' AND column_name = 'unit_cost'
    ) THEN
        ALTER TABLE public.purchase_items ADD COLUMN unit_cost NUMERIC(15, 2);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'purchase_items' AND column_name = 'currency'
    ) THEN
        ALTER TABLE public.purchase_items ADD COLUMN currency TEXT NOT NULL DEFAULT 'ARS';
    END IF;

    UPDATE public.purchase_items SET unit_cost = unit_cost_ars WHERE unit_cost IS NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 2. ACTUALIZACIÓN DE ESQUEMA: TABLA `accounts_payable` (Cuentas por Pagar)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'accounts_payable' AND column_name = 'amount_total'
    ) THEN
        ALTER TABLE public.accounts_payable ADD COLUMN amount_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'accounts_payable' AND column_name = 'amount_paid'
    ) THEN
        ALTER TABLE public.accounts_payable ADD COLUMN amount_paid NUMERIC(15, 2) NOT NULL DEFAULT 0.00;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'accounts_payable' AND column_name = 'amount_remaining'
    ) THEN
        ALTER TABLE public.accounts_payable ADD COLUMN amount_remaining NUMERIC(15, 2) NOT NULL DEFAULT 0.00;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'accounts_payable' AND column_name = 'currency'
    ) THEN
        ALTER TABLE public.accounts_payable ADD COLUMN currency TEXT NOT NULL DEFAULT 'ARS';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'accounts_payable' AND column_name = 'exchange_rate'
    ) THEN
        ALTER TABLE public.accounts_payable ADD COLUMN exchange_rate NUMERIC(15, 2) NOT NULL DEFAULT 1250.00;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'accounts_payable' AND column_name = 'notes'
    ) THEN
        ALTER TABLE public.accounts_payable ADD COLUMN notes TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'accounts_payable' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.accounts_payable ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;

    -- Backfill de registros existentes en accounts_payable
    UPDATE public.accounts_payable
    SET amount_total = COALESCE(NULLIF(amount_total, 0), total_amount_ars, 0),
        amount_paid = COALESCE(NULLIF(amount_paid, 0), paid_amount_ars, 0),
        amount_remaining = GREATEST(0, COALESCE(NULLIF(amount_total, 0), total_amount_ars, 0) - COALESCE(NULLIF(amount_paid, 0), paid_amount_ars, 0)),
        status = CASE
            WHEN status = 'paid' THEN 'settled'
            ELSE COALESCE(status, 'pending')
        END;
END $$;

-- Trigger para mantener sincronizados `total_amount_ars`/`amount_total`, `paid_amount_ars`/`amount_paid` y `amount_remaining`
CREATE OR REPLACE FUNCTION public.sync_accounts_payable_amounts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Sincronizar total
    IF NEW.amount_total IS NULL OR NEW.amount_total = 0 THEN
        NEW.amount_total := COALESCE(NEW.total_amount_ars, 0);
    END IF;
    IF NEW.total_amount_ars IS NULL OR NEW.total_amount_ars = 0 THEN
        NEW.total_amount_ars := COALESCE(NEW.amount_total, 0);
    END IF;

    -- Sincronizar pagado
    IF NEW.amount_paid IS NULL THEN
        NEW.amount_paid := COALESCE(NEW.paid_amount_ars, 0);
    END IF;
    NEW.paid_amount_ars := NEW.amount_paid;

    -- Calcular saldo pendiente restante
    NEW.amount_remaining := GREATEST(0, ROUND(NEW.amount_total - NEW.amount_paid, 2));

    -- Normalizar estado ('pending' | 'partial' | 'settled')
    IF NEW.amount_remaining <= 0 AND NEW.amount_total > 0 THEN
        NEW.status := 'settled';
    ELSIF NEW.amount_paid > 0 AND NEW.amount_remaining > 0 THEN
        NEW.status := 'partial';
    ELSIF NEW.status IS NULL OR NEW.status = '' THEN
        NEW.status := 'pending';
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_accounts_payable_amounts ON public.accounts_payable;
CREATE TRIGGER trg_sync_accounts_payable_amounts
BEFORE INSERT OR UPDATE ON public.accounts_payable
FOR EACH ROW
EXECUTE FUNCTION public.sync_accounts_payable_amounts();

-- ------------------------------------------------------------------------------
-- 3. VISTAS DE COMPATIBILIDAD SEMÁNTICA (providers, provider_debts, treasury_transactions)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.providers AS
SELECT
    id,
    name,
    contact_name,
    phone,
    email,
    notes,
    created_at
FROM public.suppliers;

CREATE OR REPLACE VIEW public.provider_debts AS
SELECT
    id,
    purchase_id,
    supplier_id AS provider_id,
    supplier_id,
    amount_total,
    amount_paid,
    amount_remaining,
    total_amount_ars,
    paid_amount_ars,
    currency,
    exchange_rate,
    status,
    due_date,
    notes,
    created_at,
    updated_at
FROM public.accounts_payable;

CREATE OR REPLACE VIEW public.treasury_transactions AS
SELECT
    id,
    account_id AS treasury_account_id,
    account_id,
    type,
    amount,
    amount_ars,
    description,
    reference_id,
    created_at
FROM public.treasury_movements;

-- ------------------------------------------------------------------------------
-- 4. RPC TRANSACCIONAL: `register_purchase_transaction`
-- ------------------------------------------------------------------------------
-- Soporta tanto la firma extendida (con condición de pago CONTADO / CUENTA_CORRIENTE,
-- cuenta de tesorería, moneda, cotización y estado de recepción) como llamadas legacy.
CREATE OR REPLACE FUNCTION public.register_purchase_transaction(
    p_supplier_id UUID,
    p_admin_id UUID,
    p_total_ars NUMERIC,
    p_total_usd NUMERIC,
    p_payment_status TEXT,
    p_due_date DATE DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::JSONB,
    p_currency TEXT DEFAULT 'ARS',
    p_exchange_rate NUMERIC DEFAULT 1250,
    p_payment_condition TEXT DEFAULT NULL,
    p_treasury_account_id UUID DEFAULT NULL,
    p_reception_status TEXT DEFAULT 'received',
    p_expected_arrival_date DATE DEFAULT NULL,
    p_tracking_info TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_expenses JSONB DEFAULT '[]'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_purchase_id UUID := gen_random_uuid();
    v_supplier_name TEXT;
    v_currency TEXT := UPPER(COALESCE(NULLIF(TRIM(p_currency), ''), 'ARS'));
    v_exchange_rate NUMERIC(15, 2) := CASE WHEN COALESCE(p_exchange_rate, 0) > 0 THEN p_exchange_rate ELSE 1250.00 END;
    v_reception_status TEXT := LOWER(COALESCE(NULLIF(TRIM(p_reception_status), ''), 'received'));
    v_is_cash BOOLEAN;
    v_normalized_payment_status TEXT;
    v_item JSONB;
    v_exp JSONB;
    v_product_id UUID;
    v_qty NUMERIC(12, 2);
    v_unit_cost_input NUMERIC(15, 2);
    v_unit_cost_ars NUMERIC(15, 2);
    v_items_subtotal_ars NUMERIC(15, 2) := 0.00;
    v_expenses_total_ars NUMERIC(15, 2) := 0.00;
    v_total_units NUMERIC(12, 2) := 0.00;
    v_expense_per_unit_ars NUMERIC(15, 6) := 0.00;
    v_final_total_ars NUMERIC(15, 2);
    v_final_total_usd NUMERIC(15, 2);
    v_current_stock NUMERIC(12, 2);
    v_current_cost_ars NUMERIC(15, 2);
    v_new_stock NUMERIC(12, 2);
    v_new_avg_cost_ars NUMERIC(15, 2);
    v_landed_unit_cost_ars NUMERIC(15, 2);
    v_due_date DATE;
BEGIN
    -- Validaciones básicas de entrada
    IF p_supplier_id IS NULL THEN
        RAISE EXCEPTION 'PROVEEDOR_REQUERIDO: Debe seleccionar un proveedor válido.';
    END IF;

    SELECT name INTO v_supplier_name
    FROM public.suppliers
    WHERE id = p_supplier_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PROVEEDOR_NO_ENCONTRADO: El proveedor % no existe.', p_supplier_id;
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'ITEMS_REQUERIDOS: La compra debe incluir al menos un producto.';
    END IF;

    IF v_reception_status NOT IN ('draft', 'in_transit', 'received', 'cancelled') THEN
        v_reception_status := 'received';
    END IF;

    -- Determinar condición de pago (CONTADO vs CUENTA_CORRIENTE)
    IF UPPER(COALESCE(p_payment_condition, '')) = 'CONTADO'
       OR LOWER(COALESCE(p_payment_status, '')) IN ('paid', 'paid_cash', 'contado') THEN
        v_is_cash := TRUE;
        v_normalized_payment_status := 'paid_cash';
    ELSE
        v_is_cash := FALSE;
        v_normalized_payment_status := 'pending_credit';
    END IF;

    IF v_is_cash AND p_treasury_account_id IS NULL THEN
        RAISE EXCEPTION 'CUENTA_TESORERIA_REQUERIDA: Para compras al CONTADO es obligatorio seleccionar la cuenta de tesorería de origen.';
    END IF;

    -- Calcular gastos adicionales si existen
    IF p_expenses IS NOT NULL AND jsonb_typeof(p_expenses) = 'array' AND jsonb_array_length(p_expenses) > 0 THEN
        FOR v_exp IN SELECT * FROM jsonb_array_elements(p_expenses) LOOP
            v_expenses_total_ars := v_expenses_total_ars + COALESCE((v_exp->>'amount')::NUMERIC, 0);
        END LOOP;
    END IF;

    -- Pre-calcular subtotal y unidades totales para prorrateo
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_qty := COALESCE((v_item->>'quantity')::NUMERIC, (v_item->>'expected_quantity')::NUMERIC, 0);
        v_unit_cost_input := COALESCE((v_item->>'unit_cost')::NUMERIC, (v_item->>'unit_cost_ars')::NUMERIC, 0);

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'CANTIDAD_INVALIDA: La cantidad de cada ítem debe ser mayor a 0.';
        END IF;

        IF v_currency = 'USD' AND (v_item->>'unit_cost') IS NOT NULL THEN
            v_unit_cost_ars := ROUND(v_unit_cost_input * v_exchange_rate, 2);
        ELSE
            v_unit_cost_ars := ROUND(v_unit_cost_input, 2);
        END IF;

        v_total_units := v_total_units + v_qty;
        v_items_subtotal_ars := v_items_subtotal_ars + (v_qty * v_unit_cost_ars);
    END LOOP;

    IF v_total_units > 0 THEN
        v_expense_per_unit_ars := v_expenses_total_ars / v_total_units;
    END IF;

    -- Totales definitivos en ARS y USD
    v_final_total_ars := COALESCE(NULLIF(p_total_ars, 0), v_items_subtotal_ars + v_expenses_total_ars);
    v_final_total_usd := COALESCE(NULLIF(p_total_usd, 0), ROUND(v_final_total_ars / v_exchange_rate, 2));
    v_due_date := CASE
        WHEN v_is_cash THEN NULL
        ELSE COALESCE(p_due_date, (NOW() + INTERVAL '30 days')::DATE)
    END;

    -- a) Insertar cabecera en `purchases`
    INSERT INTO public.purchases (
        id,
        supplier_id,
        admin_id,
        total_ars,
        total_usd,
        currency,
        exchange_rate,
        status,
        payment_status,
        payment_due_date,
        treasury_account_id,
        notes,
        created_at
    ) VALUES (
        v_purchase_id,
        p_supplier_id,
        p_admin_id,
        ROUND(v_final_total_ars, 2),
        ROUND(v_final_total_usd, 2),
        v_currency,
        v_exchange_rate,
        v_reception_status,
        v_normalized_payment_status,
        v_due_date,
        CASE WHEN v_is_cash THEN p_treasury_account_id ELSE NULL END,
        p_notes,
        NOW()
    );

    -- Sincronizar con `purchase_orders` para mantener trazabilidad en Kardex y "Mercadería en Camino"
    INSERT INTO public.purchase_orders (
        id,
        supplier_id,
        status,
        order_date,
        expected_arrival_date,
        tracking_info,
        subtotal_merchandise,
        total_expenses,
        grand_total,
        notes,
        created_at,
        updated_at
    ) VALUES (
        v_purchase_id,
        p_supplier_id,
        v_reception_status::po_status,
        NOW(),
        COALESCE(p_expected_arrival_date, CURRENT_DATE),
        p_tracking_info,
        ROUND(v_items_subtotal_ars, 2),
        ROUND(v_expenses_total_ars, 2),
        ROUND(v_final_total_ars, 2),
        p_notes,
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- Insertar gastos adicionales si se enviaron
    IF p_expenses IS NOT NULL AND jsonb_typeof(p_expenses) = 'array' AND jsonb_array_length(p_expenses) > 0 THEN
        FOR v_exp IN SELECT * FROM jsonb_array_elements(p_expenses) LOOP
            INSERT INTO public.purchase_order_expenses (
                po_id,
                expense_type,
                amount,
                description
            ) VALUES (
                v_purchase_id,
                COALESCE(NULLIF(v_exp->>'expense_type', ''), 'otro')::po_expense_type,
                COALESCE((v_exp->>'amount')::NUMERIC, 0),
                v_exp->>'description'
            );
        END LOOP;
    END IF;

    -- b) Insertar items de detalle y, si el estado es 'received', actualizar stock y Costo Promedio Ponderado (PPP)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_qty := COALESCE((v_item->>'quantity')::NUMERIC, (v_item->>'expected_quantity')::NUMERIC, 0);
        v_unit_cost_input := COALESCE((v_item->>'unit_cost')::NUMERIC, (v_item->>'unit_cost_ars')::NUMERIC, 0);

        IF v_currency = 'USD' AND (v_item->>'unit_cost') IS NOT NULL THEN
            v_unit_cost_ars := ROUND(v_unit_cost_input * v_exchange_rate, 2);
        ELSE
            v_unit_cost_ars := ROUND(v_unit_cost_input, 2);
        END IF;

        INSERT INTO public.purchase_items (
            purchase_id,
            product_id,
            quantity,
            unit_cost_ars,
            unit_cost,
            currency,
            created_at
        ) VALUES (
            v_purchase_id,
            v_product_id,
            v_qty,
            v_unit_cost_ars,
            v_unit_cost_input,
            v_currency,
            NOW()
        );

        INSERT INTO public.purchase_order_items (
            po_id,
            product_id,
            expected_quantity,
            received_quantity,
            unit_cost,
            created_at
        ) VALUES (
            v_purchase_id,
            v_product_id,
            v_qty,
            CASE WHEN v_reception_status = 'received' THEN v_qty ELSE 0 END,
            v_unit_cost_ars,
            NOW()
        );

        -- Impacto inmediato en stock y Costo Promedio Ponderado (PPP) solo si status = 'received'
        IF v_reception_status = 'received' THEN
            SELECT COALESCE(stock_quantity, 0), COALESCE(base_cost_ars, 0)
            INTO v_current_stock, v_current_cost_ars
            FROM public.products
            WHERE id = v_product_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'PRODUCTO_NO_ENCONTRADO: El producto % no existe en el catálogo.', v_product_id;
            END IF;

            v_landed_unit_cost_ars := v_unit_cost_ars + v_expense_per_unit_ars;
            v_new_stock := v_current_stock + v_qty;

            IF v_new_stock > 0 THEN
                v_new_avg_cost_ars := (
                    (GREATEST(0, v_current_stock) * v_current_cost_ars) + (v_qty * v_landed_unit_cost_ars)
                ) / (GREATEST(0, v_current_stock) + v_qty);
            ELSE
                v_new_avg_cost_ars := v_landed_unit_cost_ars;
            END IF;

            UPDATE public.products
            SET stock_quantity = v_new_stock,
                base_cost_ars = ROUND(v_new_avg_cost_ars, 2)
            WHERE id = v_product_id;
        END IF;
    END LOOP;

    -- c) Si es CONTADO: debitar tesorería y registrar movimiento EGRESO_COMPRA_STOCK
    IF v_is_cash THEN
        PERFORM public.adjust_treasury_balance(
            p_treasury_account_id,
            -ROUND(v_final_total_ars, 2),
            0,
            'EGRESO_COMPRA_STOCK',
            'Egreso por Compra de Stock — Proveedor: ' || v_supplier_name || ' (OC #' || UPPER(SUBSTRING(v_purchase_id::TEXT FROM 1 FOR 8)) || ')',
            v_purchase_id
        );
    ELSE
        -- d) Si es CUENTA_CORRIENTE: insertar deuda en `accounts_payable` dejando intacta la tesorería
        INSERT INTO public.accounts_payable (
            purchase_id,
            supplier_id,
            total_amount_ars,
            paid_amount_ars,
            amount_total,
            amount_paid,
            amount_remaining,
            currency,
            exchange_rate,
            due_date,
            status,
            notes,
            created_at,
            updated_at
        ) VALUES (
            v_purchase_id,
            p_supplier_id,
            ROUND(v_final_total_ars, 2),
            0.00,
            ROUND(v_final_total_ars, 2),
            0.00,
            ROUND(v_final_total_ars, 2),
            v_currency,
            v_exchange_rate,
            v_due_date,
            'pending',
            p_notes,
            NOW(),
            NOW()
        );
    END IF;

    RETURN v_purchase_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_purchase_transaction(UUID, UUID, NUMERIC, NUMERIC, TEXT, DATE, JSONB, TEXT, NUMERIC, TEXT, UUID, TEXT, DATE, TEXT, TEXT, JSONB) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_purchase_transaction(UUID, UUID, NUMERIC, NUMERIC, TEXT, DATE, JSONB, TEXT, NUMERIC, TEXT, UUID, TEXT, DATE, TEXT, TEXT, JSONB) TO service_role;

-- ------------------------------------------------------------------------------
-- 5. RPC TRANSACCIONAL: `settle_provider_debt`
-- ------------------------------------------------------------------------------
-- Registra pagos totales o parciales de una deuda en `accounts_payable`,
-- debitando atómicamente la cuenta de tesorería y generando el asiento contable.
CREATE OR REPLACE FUNCTION public.settle_provider_debt(
    p_debt_id UUID,
    p_amount_paid NUMERIC,
    p_treasury_account_id UUID,
    p_currency TEXT DEFAULT 'ARS',
    p_exchange_rate NUMERIC DEFAULT 1250,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_debt RECORD;
    v_supplier_name TEXT := 'Proveedor B2B';
    v_exchange_rate NUMERIC(15, 2) := CASE WHEN COALESCE(p_exchange_rate, 0) > 0 THEN p_exchange_rate ELSE 1250.00 END;
    v_payment_ars NUMERIC(15, 2);
    v_current_total_ars NUMERIC(15, 2);
    v_current_paid_ars NUMERIC(15, 2);
    v_current_remaining_ars NUMERIC(15, 2);
    v_new_paid_ars NUMERIC(15, 2);
    v_new_remaining_ars NUMERIC(15, 2);
    v_new_debt_status TEXT;
    v_new_purchase_payment_status TEXT;
    v_account_name TEXT;
    v_new_account_balance NUMERIC(15, 2);
BEGIN
    IF p_debt_id IS NULL THEN
        RAISE EXCEPTION 'DEUDA_REQUERIDA: El identificador de la deuda (debt_id) es obligatorio.';
    END IF;

    IF p_treasury_account_id IS NULL THEN
        RAISE EXCEPTION 'CUENTA_TESORERIA_REQUERIDA: Debe seleccionar una cuenta de tesorería para realizar el pago.';
    END IF;

    IF COALESCE(p_amount_paid, 0) <= 0 THEN
        RAISE EXCEPTION 'MONTO_INVALIDO: El monto a abonar debe ser mayor a cero.';
    END IF;

    -- 1. Bloquear fila de deuda en `accounts_payable` (permite buscar por id de deuda o por purchase_id)
    SELECT ap.*, s.name AS supplier_name
    INTO v_debt
    FROM public.accounts_payable ap
    LEFT JOIN public.suppliers s ON s.id = ap.supplier_id
    WHERE ap.id = p_debt_id OR ap.purchase_id = p_debt_id
    ORDER BY ap.created_at DESC
    LIMIT 1
    FOR UPDATE OF ap;

    -- Si la compra estaba pendiente en `purchases` pero no tenía fila en `accounts_payable`, crearla al vuelo
    IF NOT FOUND THEN
        INSERT INTO public.accounts_payable (
            purchase_id,
            supplier_id,
            total_amount_ars,
            paid_amount_ars,
            amount_total,
            amount_paid,
            amount_remaining,
            currency,
            exchange_rate,
            due_date,
            status
        )
        SELECT
            p.id,
            p.supplier_id,
            p.total_ars,
            0,
            p.total_ars,
            0,
            p.total_ars,
            COALESCE(p.currency, 'ARS'),
            COALESCE(p.exchange_rate, 1250),
            COALESCE(p.payment_due_date, CURRENT_DATE),
            'pending'
        FROM public.purchases p
        WHERE p.id = p_debt_id
        RETURNING * INTO v_debt;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'DEUDA_NO_ENCONTRADA: No se encontró la cuenta por pagar especificada (%).', p_debt_id;
        END IF;

        SELECT name INTO v_supplier_name FROM public.suppliers WHERE id = v_debt.supplier_id;
    ELSE
        v_supplier_name := COALESCE(v_debt.supplier_name, 'Proveedor B2B');
    END IF;

    IF v_debt.status IN ('settled', 'paid') AND COALESCE(v_debt.amount_remaining, v_debt.total_amount_ars - v_debt.paid_amount_ars, 0) <= 0 THEN
        RAISE EXCEPTION 'DEUDA_YA_SALDADA: Esta cuenta por pagar ya fue cancelada en su totalidad.';
    END IF;

    v_current_total_ars := COALESCE(NULLIF(v_debt.amount_total, 0), v_debt.total_amount_ars, 0);
    v_current_paid_ars := COALESCE(v_debt.amount_paid, v_debt.paid_amount_ars, 0);
    v_current_remaining_ars := GREATEST(0, ROUND(v_current_total_ars - v_current_paid_ars, 2));

    -- Convertir el monto abonado a ARS si el usuario ingresó pago en USD
    IF UPPER(COALESCE(p_currency, 'ARS')) = 'USD' THEN
        v_payment_ars := ROUND(p_amount_paid * v_exchange_rate, 2);
    ELSE
        v_payment_ars := ROUND(p_amount_paid, 2);
    END IF;

    -- Permitir tolerancia de redondeo de centavos y topear si supera por centavos
    IF v_payment_ars > (v_current_remaining_ars + 1.00) THEN
        RAISE EXCEPTION 'MONTO_EXCEDE_DEUDA: El pago ($%) supera el saldo pendiente de la deuda ($%).', v_payment_ars, v_current_remaining_ars;
    END IF;

    IF v_payment_ars > v_current_remaining_ars THEN
        v_payment_ars := v_current_remaining_ars;
    END IF;

    v_new_paid_ars := ROUND(v_current_paid_ars + v_payment_ars, 2);
    v_new_remaining_ars := GREATEST(0, ROUND(v_current_total_ars - v_new_paid_ars, 2));

    IF v_new_remaining_ars <= 0.01 THEN
        v_new_remaining_ars := 0.00;
        v_new_paid_ars := v_current_total_ars;
        v_new_debt_status := 'settled';
        v_new_purchase_payment_status := 'paid_cash';
    ELSE
        v_new_debt_status := 'partial';
        v_new_purchase_payment_status := 'partial_payment';
    END IF;

    -- 2. Debitar atómicamente de la cuenta de tesorería y registrar en `treasury_movements`
    SELECT o_account_name, o_balance_ars
    INTO v_account_name, v_new_account_balance
    FROM public.adjust_treasury_balance(
        p_treasury_account_id,
        -v_payment_ars,
        0,
        'EGRESO_COMPRA_STOCK',
        'Pago CxP a ' || v_supplier_name ||
            CASE WHEN v_new_debt_status = 'settled' THEN ' (Liquidación Total)' ELSE ' (Pago Parcial)' END ||
            CASE WHEN p_notes IS NOT NULL AND TRIM(p_notes) <> '' THEN ' — ' || TRIM(p_notes) ELSE '' END,
        COALESCE(v_debt.purchase_id, v_debt.id)
    );

    -- 3. Actualizar el registro en `accounts_payable`
    UPDATE public.accounts_payable
    SET amount_paid = v_new_paid_ars,
        paid_amount_ars = v_new_paid_ars,
        amount_remaining = v_new_remaining_ars,
        status = v_new_debt_status,
        notes = CASE
            WHEN p_notes IS NOT NULL AND TRIM(p_notes) <> '' THEN
                COALESCE(notes || ' | ', '') || TRIM(p_notes)
            ELSE notes
        END,
        updated_at = NOW()
    WHERE id = v_debt.id;

    -- 4. Sincronizar estado de pago en `purchases` y notas en `purchase_orders`
    IF v_debt.purchase_id IS NOT NULL THEN
        UPDATE public.purchases
        SET payment_status = v_new_purchase_payment_status,
            treasury_account_id = p_treasury_account_id
        WHERE id = v_debt.purchase_id;

        UPDATE public.purchase_orders
        SET notes = COALESCE(notes || ' | ', '') || '[ABONO CXP ' || v_account_name || ': $' || v_payment_ars::TEXT || ']',
            updated_at = NOW()
        WHERE id = v_debt.purchase_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'debt_id', v_debt.id,
        'purchase_id', v_debt.purchase_id,
        'supplier_name', v_supplier_name,
        'account_name', v_account_name,
        'amount_paid_ars', v_payment_ars,
        'amount_remaining_ars', v_new_remaining_ars,
        'status', v_new_debt_status,
        'new_account_balance_ars', v_new_account_balance
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.settle_provider_debt(UUID, NUMERIC, UUID, TEXT, NUMERIC, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_provider_debt(UUID, NUMERIC, UUID, TEXT, NUMERIC, TEXT) TO service_role;

-- ------------------------------------------------------------------------------
-- 6. ACTUALIZACIÓN DE `confirm_purchase_order_checkin` PARA USAR EL NUEVO ESQUEMA CXP
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_purchase_order_checkin(
    p_po_id UUID,
    p_admin_id UUID,
    p_items JSONB,
    p_is_paid BOOLEAN DEFAULT true,
    p_treasury_account_id UUID DEFAULT NULL,
    p_due_date DATE DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS TABLE (
    o_received_units NUMERIC,
    o_grand_total NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status TEXT;
    v_supplier_id UUID;
    v_json_item JSONB;
    v_item RECORD;
    v_item_qty NUMERIC(12, 2);
    v_received_units NUMERIC(15, 2) := 0;
    v_merch_cost NUMERIC(15, 2) := 0;
    v_total_expenses NUMERIC(15, 2) := 0;
    v_expense_per_unit NUMERIC(15, 6) := 0;
    v_grand_total NUMERIC(15, 2) := 0;
    v_current_stock NUMERIC(12, 2);
    v_current_cost NUMERIC(15, 2);
    v_new_stock NUMERIC(12, 2);
    v_new_cost NUMERIC(15, 2);
    v_existing_payment_status TEXT;
    v_existing_debt_id UUID;
BEGIN
    IF p_po_id IS NULL OR p_admin_id IS NULL THEN
        RAISE EXCEPTION 'CHECKIN_INVALIDO: po_id y admin_id son obligatorios';
    END IF;
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
        RAISE EXCEPTION 'CHECKIN_INVALIDO: p_items debe ser un array JSON';
    END IF;

    SELECT status, supplier_id
    INTO v_status, v_supplier_id
    FROM public.purchase_orders
    WHERE purchase_orders.id = p_po_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ORDEN_NO_ENCONTRADA: La orden de compra % no existe', p_po_id;
    END IF;
    IF v_status = 'received' THEN
        RAISE EXCEPTION 'ORDEN_YA_RECIBIDA: La orden % ya fue ingresada previamente a stock', p_po_id;
    END IF;
    IF v_status = 'cancelled' THEN
        RAISE EXCEPTION 'ORDEN_CANCELADA: No se puede recibir una orden cancelada (%)', p_po_id;
    END IF;

    -- Verificar si la compra ya había sido pagada o registrada en CxP al momento de crearse
    SELECT payment_status INTO v_existing_payment_status
    FROM public.purchases
    WHERE id = p_po_id;

    SELECT id INTO v_existing_debt_id
    FROM public.accounts_payable
    WHERE purchase_id = p_po_id
    LIMIT 1;

    FOR v_json_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_item_qty := COALESCE((v_json_item->>'received_qty')::NUMERIC, 0);

        UPDATE public.purchase_order_items poi
        SET received_quantity = v_item_qty
        WHERE poi.id = (v_json_item->>'poi_id')::UUID
          AND poi.po_id = p_po_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'ITEM_NO_ENCONTRADO: El ítem % no pertenece a la orden %', v_json_item->>'poi_id', p_po_id;
        END IF;
    END LOOP;

    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_expenses
    FROM public.purchase_order_expenses
    WHERE po_id = p_po_id;

    SELECT
        COALESCE(SUM(received_quantity), 0),
        COALESCE(SUM(received_quantity * unit_cost), 0)
    INTO v_received_units, v_merch_cost
    FROM public.purchase_order_items
    WHERE po_id = p_po_id;

    IF v_received_units <= 0 THEN
        RAISE EXCEPTION 'CHECKIN_INVALIDO: Debe confirmarse la recepción de al menos 1 unidad';
    END IF;

    v_grand_total := v_merch_cost + v_total_expenses;
    v_expense_per_unit := CASE WHEN v_received_units > 0 THEN v_total_expenses / v_received_units ELSE 0 END;

    -- Incremento de stock + recálculo de Costo Promedio Ponderado (PPP)
    FOR v_item IN
        SELECT poi.product_id, poi.received_quantity, poi.unit_cost
        FROM public.purchase_order_items poi
        WHERE poi.po_id = p_po_id
    LOOP
        v_item_qty := v_item.received_quantity;
        IF v_item_qty > 0 THEN
            SELECT COALESCE(stock_quantity, 0), COALESCE(base_cost_ars, 0)
            INTO v_current_stock, v_current_cost
            FROM public.products
            WHERE products.id = v_item.product_id
            FOR UPDATE;

            IF FOUND THEN
                v_new_stock := v_current_stock + v_item_qty;
                IF v_new_stock > 0 THEN
                    v_new_cost := (
                        (GREATEST(0, v_current_stock) * v_current_cost)
                        + (v_item_qty * (v_item.unit_cost + v_expense_per_unit))
                    ) / (GREATEST(0, v_current_stock) + v_item_qty);
                ELSE
                    v_new_cost := 0;
                END IF;

                UPDATE public.products
                SET stock_quantity = v_new_stock,
                    base_cost_ars = ROUND(v_new_cost, 2)
                WHERE products.id = v_item.product_id;
            END IF;
        END IF;
    END LOOP;

    -- Procesamiento financiero (evitando doble débito si la orden ya fue abonada al emitirse)
    IF v_existing_payment_status IN ('paid', 'paid_cash') THEN
        UPDATE public.purchases
        SET status = 'received',
            total_ars = v_grand_total
        WHERE id = p_po_id;
    ELSIF p_is_paid THEN
        IF p_treasury_account_id IS NULL THEN
            RAISE EXCEPTION 'CUENTA_REQUERIDA: El pago al contado requiere una cuenta de tesorería de origen';
        END IF;

        PERFORM public.adjust_treasury_balance(
            p_treasury_account_id,
            -v_grand_total,
            0,
            'EGRESO_COMPRA_STOCK',
            COALESCE(p_description, 'Egreso por compra B2B'),
            p_po_id
        );

        INSERT INTO public.purchases (id, supplier_id, admin_id, total_ars, total_usd, status, payment_status, treasury_account_id)
        VALUES (p_po_id, v_supplier_id, p_admin_id, v_grand_total, 0, 'received', 'paid_cash', p_treasury_account_id)
        ON CONFLICT (id) DO UPDATE SET
            supplier_id = EXCLUDED.supplier_id,
            admin_id = EXCLUDED.admin_id,
            total_ars = EXCLUDED.total_ars,
            status = 'received',
            payment_status = 'paid_cash',
            treasury_account_id = p_treasury_account_id;

        -- Si existía una CxP previa por estar en tránsito a crédito y ahora se pagó al recibir, marcarla saldada
        IF v_existing_debt_id IS NOT NULL THEN
            UPDATE public.accounts_payable
            SET amount_total = v_grand_total,
                total_amount_ars = v_grand_total,
                amount_paid = v_grand_total,
                paid_amount_ars = v_grand_total,
                amount_remaining = 0,
                status = 'settled',
                updated_at = NOW()
            WHERE id = v_existing_debt_id;
        END IF;
    ELSE
        INSERT INTO public.purchases (id, supplier_id, admin_id, total_ars, total_usd, status, payment_status, payment_due_date)
        VALUES (
            p_po_id,
            v_supplier_id,
            p_admin_id,
            v_grand_total,
            0,
            'received',
            'pending_credit',
            COALESCE(p_due_date, (NOW() + INTERVAL '30 days')::DATE)
        )
        ON CONFLICT (id) DO UPDATE SET
            supplier_id = EXCLUDED.supplier_id,
            admin_id = EXCLUDED.admin_id,
            total_ars = EXCLUDED.total_ars,
            status = 'received',
            payment_status = CASE
                WHEN public.purchases.payment_status = 'partial_payment' THEN 'partial_payment'
                ELSE 'pending_credit'
            END,
            payment_due_date = COALESCE(p_due_date, public.purchases.payment_due_date, (NOW() + INTERVAL '30 days')::DATE);

        IF v_existing_debt_id IS NULL THEN
            INSERT INTO public.accounts_payable (
                supplier_id,
                purchase_id,
                total_amount_ars,
                paid_amount_ars,
                amount_total,
                amount_paid,
                amount_remaining,
                due_date,
                status
            ) VALUES (
                v_supplier_id,
                p_po_id,
                v_grand_total,
                0,
                v_grand_total,
                0,
                v_grand_total,
                COALESCE(p_due_date, (NOW() + INTERVAL '30 days')::DATE),
                'pending'
            );
        ELSE
            UPDATE public.accounts_payable
            SET amount_total = v_grand_total,
                total_amount_ars = v_grand_total,
                due_date = COALESCE(p_due_date, due_date)
            WHERE id = v_existing_debt_id;
        END IF;
    END IF;

    UPDATE public.purchase_orders
    SET status = 'received',
        total_expenses = v_total_expenses,
        grand_total = v_grand_total,
        notes = COALESCE(p_notes, notes),
        updated_at = NOW()
    WHERE purchase_orders.id = p_po_id;

    RETURN QUERY SELECT v_received_units, v_grand_total;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_purchase_order_checkin(UUID, UUID, JSONB, BOOLEAN, UUID, DATE, TEXT, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_purchase_order_checkin(UUID, UUID, JSONB, BOOLEAN, UUID, DATE, TEXT, TEXT) TO service_role;
