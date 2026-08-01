-- ==============================================================================
-- MÓDULO DE COMPRAS, PROVEEDORES Y SUPPLY CHAIN - ELOHIM IMPORT ERP (VibeScent ERP)
-- ESQUEMA 100% ADITIVO: No altera ni elimina tablas preexistentes.
-- ==============================================================================

-- 1. EXTENSIONES Y ENUMS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum para el estado de la Orden de Compra
DO $$ BEGIN
    CREATE TYPE po_status AS ENUM ('draft', 'in_transit', 'received', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum para tipos de moneda preferida
DO $$ BEGIN
    CREATE TYPE supplier_currency AS ENUM ('ARS', 'USD', 'USDT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum para tipos de gastos en orden de compra
DO $$ BEGIN
    CREATE TYPE po_expense_type AS ENUM ('flete', 'aduana', 'packaging', 'comisiones', 'otro');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ------------------------------------------------------------------------------
-- 2. TABLA DE PROVEEDORES (suppliers)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact_whatsapp TEXT,
    preferred_currency supplier_currency NOT NULL DEFAULT 'ARS',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. TABLA DE ÓRDENES DE COMPRA (purchase_orders)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    status po_status NOT NULL DEFAULT 'draft',
    order_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expected_arrival_date DATE,
    tracking_info TEXT,
    subtotal_merchandise NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_expenses NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. TABLA DETALLE DE MERCADERÍA (purchase_order_items)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    expected_quantity NUMERIC(12, 2) NOT NULL CHECK (expected_quantity > 0),
    received_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (received_quantity >= 0),
    unit_cost NUMERIC(15, 2) NOT NULL CHECK (unit_cost >= 0),
    subtotal NUMERIC(15, 2) GENERATED ALWAYS AS (expected_quantity * unit_cost) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. TABLA DE GASTOS ADICIONALES (purchase_order_expenses)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_order_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    expense_type po_expense_type NOT NULL DEFAULT 'flete',
    amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. INDEXACIÓN PARA RENDIMIENTO
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_items_po_id ON public.purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_po_items_product_id ON public.purchase_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_po_expenses_po_id ON public.purchase_order_expenses(po_id);

-- ------------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_expenses ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura y escritura para usuarios autenticados
DO $$ BEGIN
    CREATE POLICY "Autenticados pueden gestionar proveedores"
        ON public.suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Autenticados pueden gestionar órdenes de compra"
        ON public.purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Autenticados pueden gestionar items de ordenes"
        ON public.purchase_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Autenticados pueden gestionar gastos de ordenes"
        ON public.purchase_order_expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 8. TRIGGER REUTILIZABLE PARA UPDATED_AT
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER trg_suppliers_updated_at
    BEFORE UPDATE ON public.suppliers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_purchase_orders_updated_at ON public.purchase_orders;
CREATE TRIGGER trg_purchase_orders_updated_at
    BEFORE UPDATE ON public.purchase_orders
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==============================================================================
-- 9. LÓGICA DE NEGOCIO: FUNCIÓN RPC TRANSACCIONAL DE RECEPCIÓN Y PRORRATEO
-- ==============================================================================
-- Esta función:
-- A) Recibe la orden de compra y las cantidades confirmadas reales de items (JSONB).
-- B) Valida que la orden esté en estado 'in_transit'.
-- C) Actualiza 'received_quantity' en purchase_order_items.
-- D) Suma la received_quantity a 'stock_quantity' en la tabla products.
-- E) Recalcula el Costo Promedio Ponderado en 'base_cost_ars' incluyendo el prorrateo
--    de los gastos adicionales de la PO (flete, aduana, etc.).
-- F) Cambia el estado de la PO a 'received'.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.receive_purchase_order(
    p_po_id UUID,
    p_received_items JSONB DEFAULT NULL -- Array opcional: [{"item_id": "...", "received_quantity": 10}]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_po public.purchase_orders%ROWTYPE;
    v_item RECORD;
    v_total_expenses NUMERIC(15, 2) := 0.00;
    v_total_received_qty NUMERIC(12, 2) := 0.00;
    v_total_merchandise_received NUMERIC(15, 2) := 0.00;
    v_expense_per_unit NUMERIC(15, 6) := 0.00;
    v_current_stock NUMERIC(12, 2);
    v_current_cost NUMERIC(15, 2);
    v_item_received_qty NUMERIC(12, 2);
    v_landed_unit_cost NUMERIC(15, 2);
    v_new_average_cost NUMERIC(15, 2);
    v_json_elem JSONB;
BEGIN
    -- 1. Validar existencia y estado de la orden de compra
    SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La orden de compra % no existe.', p_po_id;
    END IF;

    IF v_po.status = 'received' THEN
        RAISE EXCEPTION 'La orden de compra % ya fue procesada e ingresada previamente a stock.', p_po_id;
    END IF;

    IF v_po.status = 'cancelled' THEN
        RAISE EXCEPTION 'No se puede recibir una orden de compra cancelada (ID %).', p_po_id;
    END IF;

    -- 2. Si se pasaron cantidades recibidas personalizadas desde el frontend modal, actualizarlas
    IF p_received_items IS NOT NULL AND jsonb_array_length(p_received_items) > 0 THEN
        FOR v_json_elem IN SELECT * FROM jsonb_array_elements(p_received_items)
        LOOP
            UPDATE public.purchase_order_items
            SET received_quantity = (v_json_elem->>'received_quantity')::NUMERIC
            WHERE id = (v_json_elem->>'item_id')::UUID AND po_id = p_po_id;
        END LOOP;
    ELSE
        -- Por defecto, si no se especifica, se asume que ingresó el 100% de lo esperado
        UPDATE public.purchase_order_items
        SET received_quantity = expected_quantity
        WHERE po_id = p_po_id AND (received_quantity IS NULL OR received_quantity = 0);
    END IF;

    -- 3. Obtener el total de gastos asociados a esta orden
    SELECT COALESCE(SUM(amount), 0.00) INTO v_total_expenses
    FROM public.purchase_order_expenses
    WHERE po_id = p_po_id;

    -- 4. Obtener suma total de unidades recibidas en la orden para el prorrateo de gastos
    SELECT 
        COALESCE(SUM(received_quantity), 0.00),
        COALESCE(SUM(received_quantity * unit_cost), 0.00)
    INTO v_total_received_qty, v_total_merchandise_received
    FROM public.purchase_order_items
    WHERE po_id = p_po_id;

    -- Calcular costo de gasto prorrateado por unidad ingresada
    IF v_total_received_qty > 0 THEN
        v_expense_per_unit := v_total_expenses / v_total_received_qty;
    ELSE
        v_expense_per_unit := 0.00;
    END IF;

    -- 5. Iterar sobre los items de la orden para actualizar stock y recálculo de costo promedio
    FOR v_item IN 
        SELECT poi.id, poi.product_id, poi.received_quantity, poi.unit_cost, p.name AS product_name
        FROM public.purchase_order_items poi
        JOIN public.products p ON p.id = poi.product_id
        WHERE poi.po_id = p_po_id
    LOOP
        v_item_received_qty := v_item.received_quantity;

        IF v_item_received_qty > 0 THEN
            -- Obtener stock actual y costo base actual del producto con bloqueo de fila
            SELECT 
                COALESCE(stock_quantity, 0), 
                COALESCE(base_cost_ars, 0)
            INTO v_current_stock, v_current_cost
            FROM public.products
            WHERE id = v_item.product_id
            FOR UPDATE;

            -- Costo Unitario Landed (Costo unitario del proveedor + Prorrateo de gastos por unidad)
            v_landed_unit_cost := v_item.unit_cost + v_expense_per_unit;

            -- Cálculo del nuevo Costo Promedio Ponderado (Weighted Average Cost)
            IF (v_current_stock + v_item_received_qty) > 0 THEN
                v_new_average_cost := (
                    (v_current_stock * v_current_cost) + (v_item_received_qty * v_landed_unit_cost)
                ) / (v_current_stock + v_item_received_qty);
            ELSE
                v_new_average_cost := v_landed_unit_cost;
            END IF;

            -- Actualizar producto: Incremento directo de stock + Nuevo costo promedio
            UPDATE public.products
            SET 
                stock_quantity = stock_quantity + v_item_received_qty,
                base_cost_ars = ROUND(v_new_average_cost, 2),
                updated_at = NOW()
            WHERE id = v_item.product_id;
        END IF;
    END LOOP;

    -- 6. Cambiar estado de la orden a 'received' y guardar totales de gastos reales
    UPDATE public.purchase_orders
    SET 
        status = 'received',
        total_expenses = v_total_expenses,
        grand_total = v_total_merchandise_received + v_total_expenses,
        updated_at = NOW()
    WHERE id = p_po_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Mercadería ingresada exitosamente al stock con costo promedio actualizado.',
        'po_id', p_po_id,
        'total_units_received', v_total_received_qty,
        'total_expenses_prorated', v_total_expenses
    );
END;
$$;
