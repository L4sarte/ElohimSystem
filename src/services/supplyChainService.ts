import { supabase } from '@/lib/supabase';
import { getSuppliers as fetchSuppliersServerAction } from '@/app/actions/suppliers';
import { 
  Supplier, 
  PurchaseOrder, 
  CreatePOPayload, 
  CheckInItemPayload 
} from '@/types/supplyChain';

export class SupplyChainService {
  /**
   * Obtiene la lista completa de proveedores registrados mediante Server Action (bypassea RLS)
   */
  static async getSuppliers(): Promise<Supplier[]> {
    const res = await fetchSuppliersServerAction();
    if (!res.success) {
      throw new Error(res.error || 'Error al obtener proveedores');
    }
    return (res.data || []) as unknown as Supplier[];
  }

  /**
   * Crea un nuevo proveedor
   */
  static async createSupplier(supplier: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>): Promise<Supplier> {
    const { data, error } = await supabase
      .from('suppliers')
      .insert([supplier])
      .select()
      .single();

    if (error) throw new Error(`Error al crear proveedor: ${error.message}`);
    return data;
  }

  /**
   * Obtiene las Órdenes de Compra filtrando por estado (ej. 'in_transit')
   */
  static async getPurchaseOrdersByStatus(status?: string): Promise<PurchaseOrder[]> {
    let query = supabase
      .from('purchase_orders')
      .select(`
        *,
        supplier:suppliers(*),
        items:purchase_order_items(*, product:products(id, name, brand, sku, stock_quantity, base_cost_ars)),
        expenses:purchase_order_expenses(*)
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Error al obtener órdenes de compra: ${error.message}`);
    return data || [];
  }

  /**
   * Crea una nueva Orden de Compra con Maestro-Detalle (Items + Gastos Adicionales)
   */
  static async createPurchaseOrder(payload: CreatePOPayload): Promise<PurchaseOrder> {
    const subtotal_merchandise = payload.items.reduce(
      (sum, item) => sum + item.expected_quantity * item.unit_cost, 
      0
    );
    const total_expenses = payload.expenses.reduce(
      (sum, exp) => sum + Number(exp.amount), 
      0
    );
    const grand_total = subtotal_merchandise + total_expenses;

    // 1. Insertar Cabecera de PO
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .insert([{
        supplier_id: payload.supplier_id,
        status: payload.status,
        expected_arrival_date: payload.expected_arrival_date || null,
        tracking_info: payload.tracking_info || null,
        notes: payload.notes || null,
        subtotal_merchandise,
        total_expenses,
        grand_total,
      }])
      .select()
      .single();

    if (poError) throw new Error(`Error al crear cabecera de orden: ${poError.message}`);

    // 2. Insertar Items de Mercadería
    if (payload.items.length > 0) {
      const itemsToInsert = payload.items.map(item => ({
        po_id: po.id,
        product_id: item.product_id,
        expected_quantity: item.expected_quantity,
        received_quantity: 0,
        unit_cost: item.unit_cost,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(itemsToInsert);

      if (itemsError) throw new Error(`Error al guardar items de la orden: ${itemsError.message}`);
    }

    // 3. Insertar Gastos Adicionales
    if (payload.expenses.length > 0) {
      const expensesToInsert = payload.expenses.map(exp => ({
        po_id: po.id,
        expense_type: exp.expense_type,
        amount: exp.amount,
        description: exp.description || null,
      }));

      const { error: expError } = await supabase
        .from('purchase_order_expenses')
        .insert(expensesToInsert);

      if (expError) throw new Error(`Error al guardar gastos adicionales: ${expError.message}`);
    }

    return po;
  }

  /**
   * Ejecuta la recepción de la orden de compra llamando a la función PostgreSQL RPC 'receive_purchase_order'
   */
  static async confirmCheckIn(po_id: string, items: CheckInItemPayload[]): Promise<{ success: boolean; message: string }> {
    const { data, error } = await supabase.rpc('receive_purchase_order', {
      p_po_id: po_id,
      p_received_items: items
    });

    if (error) {
      throw new Error(`Error al confirmar ingreso a stock: ${error.message}`);
    }

    return data;
  }
}
