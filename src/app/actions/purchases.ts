'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserRole } from '@/types';
import { CreatePOPayload, PurchaseOrder, CheckInItemPayload } from '@/types/supplyChain';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth-checks';
import { purchaseInputSchema } from '@/lib/purchase-validation';

export interface PurchaseItemInput {
  product_id: string;
  quantity: number;
  unit_cost_ars: number;
}

export interface PurchaseInput {
  supplier_id: string;
  admin_id?: string;
  total_ars: number;
  total_usd: number;
  payment_status: 'paid' | 'unpaid';
  due_date?: string | null;
  items: PurchaseItemInput[];
}

export interface PurchaseRecord {
  id: string;
  total_ars: number;
  total_usd: number;
  status: string;
  payment_status: string;
  created_at: string;
  suppliers?: {
    id: string;
    name: string;
    contact_name?: string | null;
  } | null;
  purchase_items?: Array<{
    id: string;
    quantity: number;
    unit_cost_ars: number;
    products?: {
      id: string;
      name: string;
      brand: string;
      sku: string;
    } | null;
  }>;
}

export interface AccountPayableRecord {
  id: string;
  total_amount_ars: number;
  paid_amount_ars: number;
  due_date?: string | null;
  status: string;
  created_at: string;
  suppliers?: {
    id: string;
    name: string;
  } | null;
  purchases?: {
    id: string;
    created_at: string;
    total_ars: number;
  } | null;
}

/**
 * Procesar una nueva compra B2B registrando el ingreso de stock e inventario mediante RPC transaccional (Solo Admin).
 */
export async function submitPurchase(
  role: UserRole,
  purchaseData: PurchaseInput
): Promise<{ success: boolean; purchaseId?: string; error?: string }> {
  try {
    const adminUser = await requireAdmin();

    const validation = purchaseInputSchema.safeParse(purchaseData);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Datos de compra inválidos.';
      return { success: false, error: firstError };
    }

    const clean = validation.data;

    if (!isSupabaseConfigured()) {
      return { success: true, purchaseId: 'mock-po-' + Math.random().toString(36).substring(2, 7) };
    }

    const serviceClient = getServiceSupabase();

    // Formatear la fecha de vencimiento (null si está pagada o no se especifica)
    const formattedDueDate = clean.payment_status === 'unpaid' && clean.due_date
      ? clean.due_date
      : null;

    // Invocar la función RPC transaccional en Supabase
    const { data, error } = await serviceClient.rpc('register_purchase_transaction', {
      p_supplier_id: clean.supplier_id,
      p_admin_id: adminUser.id,
      p_total_ars: clean.total_ars,
      p_total_usd: clean.total_usd,
      p_payment_status: clean.payment_status,
      p_due_date: formattedDueDate,
      p_items: clean.items,
    });

    if (error) {
      throw error;
    }

    // Revalidar cachés de rutas dependientes
    revalidatePath('/productos');
    revalidatePath('/compras');
    revalidatePath('/compras/nueva');
    revalidatePath('/compras/proveedores');
    revalidatePath('/');

    return { success: true, purchaseId: data as string };
  } catch (error: unknown) {
    console.error('Error al registrar transacción de compra:', error);
    const msg = error instanceof Error ? error.message : 'Error al procesar la compra';
    return { success: false, error: msg };
  }
}

/**
 * Obtener historial de compras registradas (Solo Admin).
 */
export async function getPurchases(role?: UserRole): Promise<{
  success: boolean;
  data?: PurchaseRecord[];
  error?: string;
}> {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured()) {
      return { success: true, data: [] };
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('purchases')
      .select(`
        id,
        total_ars,
        total_usd,
        status,
        payment_status,
        created_at,
        suppliers (
          id,
          name,
          contact_name
        ),
        purchase_items (
          id,
          quantity,
          unit_cost_ars,
          products (
            id,
            name,
            brand,
            sku
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return { success: true, data: (data || []) as unknown as PurchaseRecord[] };
  } catch (error: unknown) {
    console.error('Error al obtener compras:', error);
    const msg = error instanceof Error ? error.message : 'Error al recuperar compras';
    return { success: false, error: msg };
  }
}

/**
 * Obtener listado de Cuentas por Pagar (Accounts Payable) (Solo Admin).
 */
export async function getAccountsPayable(role?: UserRole): Promise<{
  success: boolean;
  data?: AccountPayableRecord[];
  error?: string;
}> {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured()) {
      return { success: true, data: [] };
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('accounts_payable')
      .select(`
        id,
        total_amount_ars,
        paid_amount_ars,
        due_date,
        status,
        created_at,
        suppliers (
          id,
          name
        ),
        purchases (
          id,
          created_at,
          total_ars
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return { success: true, data: (data || []) as unknown as AccountPayableRecord[] };
  } catch (error: unknown) {
    console.error('Error al obtener cuentas por pagar:', error);
    const msg = error instanceof Error ? error.message : 'Error al recuperar cuentas por pagar';
    return { success: false, error: msg };
  }
}

/**
 * Crear una Orden de Compra (B2B Supply Chain) de forma atómica en el backend.
 * Omite RLS usando getServiceSupabase() tras validar privilegios de administrador.
 */
export async function createPurchaseOrderAction(payload: CreatePOPayload): Promise<{
  success: boolean;
  data?: PurchaseOrder;
  error?: string;
}> {
  try {
    await requireAdmin();

    if (!payload.supplier_id) {
      return { success: false, error: 'Debe especificar un proveedor válido.' };
    }

    if (!payload.items || payload.items.length === 0) {
      return { success: false, error: 'La orden de compra debe contener al menos un producto.' };
    }

    if (!isSupabaseConfigured()) {
      return {
        success: true,
        data: {
          id: 'mock-po-' + Math.random().toString(36).substring(2, 7),
          supplier_id: payload.supplier_id,
          status: payload.status,
          order_date: new Date().toISOString(),
          expected_arrival_date: payload.expected_arrival_date,
          tracking_info: payload.tracking_info,
          subtotal_merchandise: 0,
          total_expenses: 0,
          grand_total: 0,
          notes: payload.notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };
    }

    const supabase = getServiceSupabase();

    const subtotal_merchandise = payload.items.reduce(
      (sum, item) => sum + item.expected_quantity * item.unit_cost,
      0
    );
    const total_expenses = (payload.expenses || []).reduce(
      (sum, exp) => sum + Number(exp.amount),
      0
    );
    const grand_total = subtotal_merchandise + total_expenses;

    // 1. Insertar Cabecera de PO
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .insert([
        {
          supplier_id: payload.supplier_id,
          status: payload.status,
          expected_arrival_date: payload.expected_arrival_date || null,
          tracking_info: payload.tracking_info || null,
          notes: payload.notes || null,
          subtotal_merchandise,
          total_expenses,
          grand_total,
        },
      ])
      .select()
      .single();

    if (poError || !po) {
      throw new Error(`Error al crear cabecera de orden: ${poError?.message || 'Error desconocido'}`);
    }

    try {
      // 2. Insertar Items de Mercadería
      const itemsToInsert = payload.items.map((item) => ({
        po_id: po.id,
        product_id: item.product_id,
        expected_quantity: item.expected_quantity,
        received_quantity: 0,
        unit_cost: item.unit_cost,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(itemsToInsert);

      if (itemsError) {
        throw new Error(`Error al guardar items de la orden: ${itemsError.message}`);
      }

      // 3. Insertar Gastos Adicionales si existen
      if (payload.expenses && payload.expenses.length > 0) {
        const expensesToInsert = payload.expenses.map((exp) => ({
          po_id: po.id,
          expense_type: exp.expense_type,
          amount: exp.amount,
          description: exp.description || null,
        }));

        const { error: expError } = await supabase
          .from('purchase_order_expenses')
          .insert(expensesToInsert);

        if (expError) {
          throw new Error(`Error al guardar gastos adicionales: ${expError.message}`);
        }
      }
    } catch (innerError) {
      // Rollback lógico si falla la inserción de ítems o gastos
      await supabase.from('purchase_orders').delete().eq('id', po.id);
      throw innerError;
    }

    revalidatePath('/compras');
    revalidatePath('/productos');
    revalidatePath('/');

    return { success: true, data: po as unknown as PurchaseOrder };
  } catch (error: unknown) {
    console.error('Error en createPurchaseOrderAction:', error);
    const msg = error instanceof Error ? error.message : 'Error al crear la orden de compra';
    return { success: false, error: msg };
  }
}

/**
 * Obtener órdenes de compra filtradas por estado desde el backend (Solo Admin).
 */
export async function getPurchaseOrdersByStatusAction(status?: string): Promise<{
  success: boolean;
  data?: PurchaseOrder[];
  error?: string;
}> {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured()) {
      return { success: true, data: [] };
    }

    const supabase = getServiceSupabase();
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
    if (error) {
      throw error;
    }

    return { success: true, data: (data || []) as unknown as PurchaseOrder[] };
  } catch (error: unknown) {
    console.error('Error al obtener órdenes de compra:', error);
    const msg = error instanceof Error ? error.message : 'Error al consultar órdenes de compra';
    return { success: false, error: msg };
  }
}

/**
 * Confirmar ingreso / recepción de orden de compra mediante RPC en el backend (Solo Admin).
 */
export async function confirmCheckInAction(
  poId: string,
  items: CheckInItemPayload[]
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured()) {
      return { success: true, message: 'Recepción simulada correctamente' };
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase.rpc('receive_purchase_order', {
      p_po_id: poId,
      p_received_items: items,
    });

    if (error) {
      throw error;
    }

    revalidatePath('/compras');
    revalidatePath('/productos');
    revalidatePath('/');

    return { success: true, message: (data as any)?.message || 'Ingreso confirmado correctamente' };
  } catch (error: unknown) {
    console.error('Error al confirmar ingreso de orden:', error);
    const msg = error instanceof Error ? error.message : 'Error al confirmar ingreso a stock';
    return { success: false, error: msg };
  }
}
