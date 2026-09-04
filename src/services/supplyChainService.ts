import { 
  createPurchaseOrderAction, 
  getPurchaseOrdersByStatusAction, 
  confirmCheckInAction 
} from '@/app/actions/purchases';
import { 
  getSuppliers as fetchSuppliersServerAction,
  createSupplier as createSupplierServerAction 
} from '@/app/actions/suppliers';
import { 
  Supplier, 
  PurchaseOrder, 
  CreatePOPayload, 
  CheckInItemPayload,
  CheckInPaymentDetails
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
   * Crea un nuevo proveedor mediante Server Action
   */
  static async createSupplier(supplier: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>): Promise<Supplier> {
    const res = await createSupplierServerAction('admin', {
      name: supplier.name,
      contact_name: supplier.contact_name || undefined,
      phone: supplier.phone || supplier.contact_whatsapp || undefined,
      notes: supplier.notes || undefined,
    });
    if (!res.success || !res.data) {
      throw new Error(res.error || 'Error al crear proveedor');
    }
    return res.data as unknown as Supplier;
  }

  /**
   * Obtiene las Órdenes de Compra filtrando por estado mediante Server Action (bypassea RLS)
   */
  static async getPurchaseOrdersByStatus(status?: string): Promise<PurchaseOrder[]> {
    const res = await getPurchaseOrdersByStatusAction(status);
    if (!res.success) {
      throw new Error(res.error || 'Error al obtener órdenes de compra');
    }
    return res.data || [];
  }

  /**
   * Crea una nueva Orden de Compra atómicamente en el backend mediante Server Action
   */
  static async createPurchaseOrder(payload: CreatePOPayload): Promise<PurchaseOrder> {
    const res = await createPurchaseOrderAction(payload);
    if (!res.success || !res.data) {
      throw new Error(res.error || 'Error al crear orden de compra');
    }
    return res.data;
  }

  /**
   * Ejecuta la recepción de la orden de compra llamando a la Server Action de RPC transaccional
   */
  static async confirmCheckIn(
    po_id: string, 
    items: CheckInItemPayload[], 
    paymentDetails?: CheckInPaymentDetails
  ): Promise<{ success: boolean; message: string }> {
    const res = await confirmCheckInAction(po_id, items, paymentDetails);
    if (!res.success) {
      throw new Error(res.error || 'Error al confirmar ingreso a stock');
    }
    return { success: true, message: res.message || 'Ingreso confirmado a stock' };
  }
}
