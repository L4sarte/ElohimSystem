export type SupplierCurrency = 'ARS' | 'USD' | 'USDT';

export type POStatus = 'draft' | 'in_transit' | 'received' | 'cancelled';

export type POExpenseType = 'flete' | 'aduana' | 'packaging' | 'comisiones' | 'otro';

export interface Supplier {
  id: string;
  name: string;
  contact_whatsapp?: string | null;
  phone?: string | null;
  contact_name?: string | null;
  email?: string | null;
  preferred_currency?: SupplierCurrency | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface PurchaseOrderItem {
  id?: string;
  po_id?: string;
  product_id: string;
  expected_quantity: number;
  received_quantity: number;
  unit_cost: number;
  subtotal?: number;
  created_at?: string;
  product?: {
    id: string;
    name: string;
    brand?: string;
    sku?: string;
    base_cost_ars?: number;
    stock_quantity?: number;
  };
}

export interface PurchaseOrderExpense {
  id?: string;
  po_id?: string;
  expense_type: POExpenseType;
  amount: number;
  description?: string;
  created_at?: string;
}

export interface PurchaseOrder {
  id: string;
  supplier_id: string;
  status: POStatus;
  order_date: string;
  expected_arrival_date?: string;
  tracking_info?: string;
  subtotal_merchandise: number;
  total_expenses: number;
  grand_total: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  supplier?: Supplier;
  items?: PurchaseOrderItem[];
  expenses?: PurchaseOrderExpense[];
}

export interface CreatePOPayload {
  supplier_id: string;
  status: POStatus;
  expected_arrival_date?: string;
  tracking_info?: string;
  notes?: string;
  items: {
    product_id: string;
    expected_quantity: number;
    unit_cost: number;
  }[];
  expenses: {
    expense_type: POExpenseType;
    amount: number;
    description?: string;
  }[];
}

export interface CheckInItemPayload {
  item_id: string;
  received_quantity: number;
}

export interface CheckInPaymentDetails {
  isPaid: boolean;
  treasuryAccountId?: string;
  dueDate?: string | null;
  notes?: string;
}

