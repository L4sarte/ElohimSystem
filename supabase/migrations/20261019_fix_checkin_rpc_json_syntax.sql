-- ==============================================================================
-- MIGRACIÓN: FIX JSON SYNTAX ERROR EN RPC CONFIRM_PURCHASE_ORDER_CHECKIN
-- Fecha: 2026-10-19
-- ==============================================================================
-- Corrige el error PostgreSQL 22P02 "invalid input syntax for type json"
-- Token "<uuid>" is invalid durante el check-in de órdenes de compra.
--
-- Causa Raíz:
-- En las definiciones anteriores, la variable de iteración `v_item` estaba declarada
-- únicamente como `JSONB`. En el segundo loop:
--   FOR v_item IN SELECT poi.product_id, poi.received_quantity, poi.unit_cost FROM purchase_order_items ...
-- PostgreSQL intentaba asignar la fila resultante (cuyo primer campo es UUID)
-- a la variable `v_item JSONB`, fallando al parsear el UUID sin comillas como JSON.
--
-- Solución:
-- Se separa la variable de iteración JSON `v_json_item JSONB` para iterar `p_items`,
-- y se declara `v_item RECORD` para el bucle sobre las filas de `purchase_order_items`.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.confirm_purchase_order_checkin(
    p_po_id UUID,
    p_admin_id UUID,
    p_items JSONB, -- [{"poi_id": "...", "received_qty": 10}]
    p_is_paid BOOLEAN DEFAULT true,
    p_treasury_account_id UUID DEFAULT NULL,
    p_due_date DATE DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_is_already_paid BOOLEAN DEFAULT false
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

    -- A) Bloqueo pesimista sobre la orden
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

    -- Verificar si la compra ya tenía un estado de pago previo o deuda en CxP
    SELECT payment_status INTO v_existing_payment_status
    FROM public.purchases
    WHERE id = p_po_id;

    SELECT id INTO v_existing_debt_id
    FROM public.accounts_payable
    WHERE purchase_id = p_po_id
    LIMIT 1;

    -- B) Actualizar cantidades recibidas confirmadas por el administrador
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

    -- C) Gastos y totales calculados
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

    -- C-bis) Incremento de stock + recálculo de Precio Promedio Ponderado (PPP)
    -- Se utiliza v_item RECORD para evitar conflictos de tipo con JSONB
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

    -- D) Procesamiento financiero atómico
    IF p_is_already_paid THEN
        -- Caso: Ya pagado previamente / Pago adelantado
        -- Omite débitos en tesorería y omite generación de deuda en CxP
        INSERT INTO public.purchases (id, supplier_id, admin_id, total_ars, total_usd, status, payment_status)
        VALUES (p_po_id, v_supplier_id, p_admin_id, v_grand_total, 0, 'received', 'paid_cash')
        ON CONFLICT (id) DO UPDATE SET
            supplier_id = EXCLUDED.supplier_id,
            admin_id = EXCLUDED.admin_id,
            total_ars = EXCLUDED.total_ars,
            status = 'received',
            payment_status = 'paid_cash';

        -- Si existía una deuda previa en accounts_payable por estar en tránsito a crédito, cerrarla
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
    ELSIF v_existing_payment_status IN ('paid', 'paid_cash') THEN
        -- Si ya estaba pagada de contado al crearse la orden, solo actualizamos el monto final y estado
        UPDATE public.purchases
        SET status = 'received',
            total_ars = v_grand_total
        WHERE id = p_po_id;
    ELSIF p_is_paid THEN
        IF p_treasury_account_id IS NULL THEN
            RAISE EXCEPTION 'CUENTA_REQUERIDA: El pago al contado requiere una cuenta de tesorería de origen';
        END IF;

        -- Débito en tesorería vía RPC atómico (valida saldo suficiente)
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

        -- Si existía una CxP registrada previamente y se cancela aquí, marcarla settled
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
        -- Registrar o actualizar deuda en Cuentas por Pagar (CxP)
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

    -- E) Marcar la orden de compra como 'received'
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

REVOKE EXECUTE ON FUNCTION public.confirm_purchase_order_checkin(UUID, UUID, JSONB, BOOLEAN, UUID, DATE, TEXT, TEXT, BOOLEAN) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_purchase_order_checkin(UUID, UUID, JSONB, BOOLEAN, UUID, DATE, TEXT, TEXT, BOOLEAN) TO service_role;
