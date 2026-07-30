'use server';

import { getServiceSupabase, supabase } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';

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

/**
 * Procesar una nueva compra B2B registrando el ingreso de stock e inventario mediante la RPC de Supabase.
 */
export async function submitPurchase(
  role: UserRole,
  purchaseData: PurchaseInput
): Promise<{ success: boolean; purchaseId?: string; error?: string }> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Se requiere rol de Administrador.');
    }

    if (!purchaseData.supplier_id) {
      throw new Error('Debes seleccionar un proveedor.');
    }

    if (!purchaseData.items || purchaseData.items.length === 0) {
      throw new Error('La orden de compra debe contener al menos un producto.');
    }

    const serviceClient = getServiceSupabase();

    // 1. Obtener o resolver el ID de administrador (Bypass de desarrollo)
    let adminId = purchaseData.admin_id;
    if (!adminId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        adminId = user.id;
      }
    }

    if (!adminId) {
      const { data: profiles } = await serviceClient.from('profiles').select('id').limit(1);
      if (profiles && profiles.length > 0) {
        adminId = profiles[0].id;
      } else {
        // Crear usuario y perfil dummy si la base de datos no contiene administradores aún
        try {
          const email = 'dummy.seller@elohimimport.com';
          const { data: userData, error: userError } = await serviceClient.auth.admin.createUser({
            email,
            password: 'dummyPassword123!',
            email_confirm: true
          });

          if (!userError && userData.user) {
            const dummyUserId = userData.user.id;
            await serviceClient.from('profiles').insert({
              id: dummyUserId,
              email,
              role: 'admin'
            });
            adminId = dummyUserId;
          }
        } catch (dummyErr) {
          console.error('Error al generar admin dummy de desarrollo:', dummyErr);
        }
      }
    }

    if (!adminId) {
      throw new Error('No se pudo resolver el usuario administrador para procesar la transacción.');
    }

    // Formatear la fecha de vencimiento (null si está pagada o no se especifica)
    const formattedDueDate = purchaseData.payment_status === 'unpaid' && purchaseData.due_date 
      ? purchaseData.due_date 
      : null;

    // Invocar la función RPC transaccional en Supabase
    const { data, error } = await serviceClient.rpc('register_purchase_transaction', {
      p_supplier_id: purchaseData.supplier_id,
      p_admin_id: adminId,
      p_total_ars: purchaseData.total_ars,
      p_total_usd: purchaseData.total_usd,
      p_payment_status: purchaseData.payment_status,
      p_due_date: formattedDueDate,
      p_items: purchaseData.items
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

    return { success: true, purchaseId: data };
  } catch (error: any) {
    console.error('Error al registrar transacción de compra:', error);
    return { success: false, error: error.message || 'Error al procesar la compra' };
  }
}

/**
 * Obtener historial de compras registradas.
 */
export async function getPurchases(role: UserRole): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación no autorizada.');
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

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error al obtener compras:', error);
    return { success: false, error: error.message || 'Error al recuperar compras' };
  }
}

/**
 * Obtener listado de Cuentas por Pagar (Accounts Payable).
 */
export async function getAccountsPayable(role: UserRole): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación no autorizada.');
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

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error al obtener cuentas por pagar:', error);
    return { success: false, error: error.message || 'Error al recuperar cuentas por pagar' };
  }
}
