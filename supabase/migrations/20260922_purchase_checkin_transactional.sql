-- ==============================================================================
-- MIGRACIÓN: CHECK-IN DE COMPRAS B2B TRANSACCIONAL (ATÓMICO)
-- Fase 2 / Bloque 2 — Transaccionalidad de Compras y Cierre de Flujos Financieros
-- ==============================================================================
-- Corrige [C7]: confirmCheckInAction ejecutaba ~8 operaciones secuenciales desde
-- TypeScript (ítems -> stock/PPP -> tesorería -> purchases/CxP -> estado de la
-- orden). Un fallo a mitad de camino dejaba la orden a medio recibir: stock
-- parcialmente incrementado, sin rollback posible y con riesgo de duplicación al
-- reintentar.
--
-- Esta función agrupa TODO el check-in en un solo bloque SQL atómico:
--   A) Bloqueo pesimista (FOR UPDATE) sobre la orden: previene check-ins
--      concurrentes y garantiza idempotencia (una orden recibida no se re-procesa).
--   B) Actualización de received_quantity en purchase_order_items.
--   C) Recálculo del Costo Promedio Ponderado (PPP) con prorrateo landed de gastos
--      (flete/aduana/comisiones) sobre stock incrementado con FOR UPDATE.
--   D) Procesamiento financiero atómico: débito de tesorería vía
--      adjust_treasury_balance (un saldo insuficiente lanza excepción y revierte
--      COMPLETAMENTE el check-in) o registro en accounts_payable (CxP).
--   E) Homologación en purchases y marcado de la orden como 'received'.
--
-- Nota: el RPC legacy receive_purchase_order (sin callers activos) se endurece
-- con search_path fijo y permisos restringidos a service_role.
-- Tipos verificados contra la DB remota: accounts_payable.due_date = DATE,
-- purchases.payment_status = TEXT, treasury_accounts.balance_ars = NUMERIC.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.confirm_purchase_order_checkin(
    p_po_id UUID,
    p_admin_id UUID,
    p_items JSONB, -- [{"poi_id": "...", "received_qty": 10}] (unit_cost/product_id se leen de la DB)
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
    v_item JSONB;
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
BEGIN
    IF p_po_id IS NULL OR p_admin_id IS NULL THEN
        RAISE EXCEPTION 'CHECKIN_INVALIDO: po_id y admin_id son obligatorios';
    END IF;
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
        RAISE EXCEPTION 'CHECKIN_INVALIDO: p_items debe ser un array JSON';
    END IF;

    -- A) Bloqueo pesimista: previene check-ins concurrentes sobre la misma orden
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

    -- B) Actualizar cantidades recibidas confirmadas por el administrador
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_item_qty := COALESCE((v_item->>'received_qty')::NUMERIC, 0);

        UPDATE public.purchase_order_items poi
        SET received_quantity = v_item_qty
        WHERE poi.id = (v_item->>'poi_id')::UUID
          AND poi.po_id = p_po_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'ITEM_NO_ENCONTRADO: El ítem % no pertenece a la orden %', v_item->>'poi_id', p_po_id;
        END IF;
    END LOOP;

    -- C) Gastos de la orden y totales reales (desde las filas ya actualizadas)
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
    -- Costo landed unitario = costo proveedor + prorrateo de gastos por unidad
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
                        (v_current_stock * v_current_cost)
                        + (v_item_qty * (v_item.unit_cost + v_expense_per_unit))
                    ) / v_new_stock;
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

    -- D) Procesamiento financiero atómico: cualquier fallo revierte TODO el check-in
    IF p_is_paid THEN
        IF p_treasury_account_id IS NULL THEN
            RAISE EXCEPTION 'CUENTA_REQUERIDA: El pago al contado requiere una cuenta de tesorería de origen';
        END IF;

        -- Débito atómico vía RPC: rechaza saldo negativo y lanza excepción => rollback total
        PERFORM public.adjust_treasury_balance(
            p_treasury_account_id,
            -v_grand_total,
            0,
            'out',
            COALESCE(p_description, 'Egreso por compra B2B'),
            p_po_id
        );

        -- Homologar la compra como recibida y pagada (idempotente)
        INSERT INTO public.purchases (id, supplier_id, admin_id, total_ars, total_usd, status, payment_status)
        VALUES (p_po_id, v_supplier_id, p_admin_id, v_grand_total, 0, 'received', 'paid')
        ON CONFLICT (id) DO UPDATE SET
            supplier_id = EXCLUDED.supplier_id,
            admin_id = EXCLUDED.admin_id,
            total_ars = EXCLUDED.total_ars,
            status = 'received',
            payment_status = 'paid';
    ELSE
        -- Registrar deuda en Cuentas por Pagar (CxP)
        INSERT INTO public.purchases (id, supplier_id, admin_id, total_ars, total_usd, status, payment_status)
        VALUES (p_po_id, v_supplier_id, p_admin_id, v_grand_total, 0, 'received', 'unpaid')
        ON CONFLICT (id) DO UPDATE SET
            supplier_id = EXCLUDED.supplier_id,
            admin_id = EXCLUDED.admin_id,
            total_ars = EXCLUDED.total_ars,
            status = 'received',
            payment_status = 'unpaid';

        INSERT INTO public.accounts_payable (supplier_id, purchase_id, total_amount_ars, paid_amount_ars, due_date, status)
        VALUES (
            v_supplier_id,
            p_po_id,
            v_grand_total,
            0,
            COALESCE(p_due_date, (NOW() + INTERVAL '30 days')::DATE),
            'pending'
        );
    END IF;

    -- E) Marcar la orden como recibida con totales reales
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

-- Solo el servidor (service role) puede ejecutar el check-in transaccional
REVOKE EXECUTE ON FUNCTION public.confirm_purchase_order_checkin(UUID, UUID, JSONB, BOOLEAN, UUID, DATE, TEXT, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_purchase_order_checkin(UUID, UUID, JSONB, BOOLEAN, UUID, DATE, TEXT, TEXT) TO service_role;

-- Hardening del RPC legacy receive_purchase_order (sin callers activos en el código):
-- search_path fijo + permisos restringidos a service_role
ALTER FUNCTION public.receive_purchase_order(UUID, JSONB) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.receive_purchase_order(UUID, JSONB) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receive_purchase_order(UUID, JSONB) TO service_role;
