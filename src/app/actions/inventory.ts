'use server';

import { getServiceSupabase } from '@/lib/supabase';
import { UserRole, Product } from '@/types';
import { revalidatePath } from 'next/cache';

export interface InventoryAdjustmentRecord {
  id: string;
  product_id: string;
  created_by: string;
  type: string;
  quantity: number;
  reason: string;
  created_at: string;
  products?: {
    name: string;
    brand: string;
    sku: string;
    type: string;
    base_cost_ars?: number;
  };
}

/**
 * Obtener productos que alcanzaron o superaron el umbral de alerta de bajo stock (stock_quantity <= min_stock_alert).
 */
export async function getStockAlerts(role: UserRole): Promise<{
  success: boolean;
  data?: Product[];
  error?: string;
}> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Se requiere rol de Administrador.');
    }

    const supabase = getServiceSupabase();
    
    // Consulta productos activos cuyo stock es menor o igual al umbral min_stock_alert
    const { data, error } = await supabase
      .from('products')
      .select('id, sku, name, brand, type, stock_quantity, min_stock_alert, volume_ml, base_cost_ars, base_price_ars, created_at')
      .order('stock_quantity', { ascending: true });

    if (error) throw error;

    // Filtrar en memoria por min_stock_alert (default 5)
    const alertProducts: Product[] = (data || [])
      .filter((p: any) => {
        const limit = p.min_stock_alert !== null && p.min_stock_alert !== undefined ? Number(p.min_stock_alert) : 5;
        return Number(p.stock_quantity || 0) <= limit;
      })
      .map((p: any) => ({
        ...p,
        base_cost_ars: Number(p.base_cost_ars || 0),
        base_price_ars: Number(p.base_price_ars || 0),
        stock_quantity: Number(p.stock_quantity || 0),
        volume_ml: p.volume_ml ? Number(p.volume_ml) : undefined
      }));

    return { success: true, data: alertProducts };
  } catch (error: any) {
    console.error('Error al obtener alertas de stock:', error);
    return { success: false, error: error.message || 'Error al obtener alertas de stock' };
  }
}

/**
 * Obtener el historial completo de ajustes manuales de inventario.
 */
export async function getInventoryAdjustments(role: UserRole): Promise<{
  success: boolean;
  data?: InventoryAdjustmentRecord[];
  error?: string;
}> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Se requiere rol de Administrador.');
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('inventory_adjustments')
      .select(`
        id,
        product_id,
        created_by,
        type,
        quantity,
        reason,
        created_at,
        products (
          name,
          brand,
          sku,
          type,
          base_cost_ars
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const list: InventoryAdjustmentRecord[] = (data || []).map((item: any) => ({
      id: item.id,
      product_id: item.product_id,
      created_by: item.created_by,
      type: item.type,
      quantity: Number(item.quantity || 0),
      reason: item.reason,
      created_at: item.created_at,
      products: Array.isArray(item.products) ? item.products[0] : item.products
    }));

    return { success: true, data: list };
  } catch (error: any) {
    console.error('Error al obtener historial de ajustes:', error);
    return { success: false, error: error.message || 'Error al consultar historial de ajustes' };
  }
}

/**
 * Registrar un ajuste manual de inventario (Merma, Rotura, Regalo, Corrección de Arqueo).
 * Si la cantidad es negativa (pérdida/merma), calcula el costo de reposición e inserta un gasto operativo (OPEX)
 * bajo la categoría 'Merma de Inventario' para descontarlo de la Ganancia Neta.
 */
export async function adjustInventory(
  role: UserRole,
  productId: string,
  type: string,
  quantity: number,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Se requiere rol de Administrador.');
    }

    if (!productId || isNaN(quantity) || quantity === 0) {
      throw new Error('Debes seleccionar un producto e ingresar una cantidad distinta de cero.');
    }

    const supabase = getServiceSupabase();

    // Obtener perfil del usuario o fallback dev bypass
    let adminId: string | null = null;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) adminId = user.id;

    if (!adminId) {
      const { data: profiles } = await supabase.from('profiles').select('id').limit(1);
      if (profiles && profiles.length > 0) adminId = profiles[0].id;
    }

    if (!adminId) adminId = '00000000-0000-0000-0000-000000000000';

    // 1. Invocar RPC transaccional que actualiza el stock e inserta en inventory_adjustments
    const { error: rpcError } = await supabase.rpc('adjust_inventory_transaction', {
      p_product_id: productId,
      p_admin_id: adminId,
      p_type: type,
      p_quantity: quantity,
      p_reason: reason || 'Ajuste manual'
    });

    if (rpcError) throw rpcError;

    // 2. Regla Financiera: Si la cantidad es negativa (merma/pérdida/rotura), impactar en OPEX
    if (quantity < 0) {
      const { data: product } = await supabase
        .from('products')
        .select('name, base_cost_ars')
        .eq('id', productId)
        .single();

      if (product) {
        const unitCost = Number(product.base_cost_ars || 0);
        const lossAmountArs = Math.abs(quantity) * unitCost;

        if (lossAmountArs > 0) {
          // Obtener tipo de cambio Dólar Blue activo para referencia USD
          let exchangeRate = 1000;
          const { data: rateData } = await supabase
            .from('exchange_rates')
            .select('rate_ars')
            .eq('is_active', true)
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

          if (rateData && rateData.rate_ars) {
            exchangeRate = Number(rateData.rate_ars);
          }

          const lossAmountUsd = lossAmountArs / exchangeRate;

          // Insertar en operating_expenses
          await supabase.from('operating_expenses').insert({
            category: 'Merma de Inventario',
            amount_ars: lossAmountArs,
            amount_usd: lossAmountUsd,
            description: `Merma [${type}]: ${Math.abs(quantity)} u/ml de ${product.name} (${reason || 'Sin detalle'})`,
            expense_date: new Date().toISOString().split('T')[0],
            created_by: adminId
          });
        }
      }
    }

    // Revalidación de rutas afectadas
    revalidatePath('/');
    revalidatePath('/productos');
    revalidatePath('/admin/inventario/ajustes');
    revalidatePath('/admin/reportes');
    revalidatePath('/admin/gastos');

    return { success: true };
  } catch (error: any) {
    console.error('Error al registrar ajuste de inventario:', error);
    return { success: false, error: error.message || 'Error al procesar el ajuste de inventario' };
  }
}
