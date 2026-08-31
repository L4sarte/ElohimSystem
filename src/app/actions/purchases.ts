'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserRole } from '@/types';
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
