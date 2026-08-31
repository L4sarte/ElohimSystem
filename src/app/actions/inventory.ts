'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserRole, Product } from '@/types';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth-checks';
import { inventoryAdjustSchema } from '@/lib/product-validation';

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

interface DbProductAlertRow {
  id: string;
  sku: string;
  name: string;
  brand: string;
  type: string;
  stock_quantity: number | null;
  min_stock_alert: number | null;
  volume_ml: number | null;
  base_cost_ars: number | null;
  base_price_ars: number | null;
  created_at: string;
}

/**
 * Obtener productos que alcanzaron o superaron el umbral de alerta de bajo stock (stock_quantity <= min_stock_alert).
 */
export async function getStockAlerts(role?: UserRole): Promise<{
  success: boolean;
  data?: Product[];
  error?: string;
}> {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured()) {
      return { success: true, data: [] };
    }

    const supabase = getServiceSupabase();

    // Consulta productos activos cuyo stock es menor o igual al umbral min_stock_alert
    const { data, error } = await supabase
      .from('products')
      .select('id, sku, name, brand, type, stock_quantity, min_stock_alert, volume_ml, base_cost_ars, base_price_ars, created_at')
      .order('stock_quantity', { ascending: true });

    if (error) throw error;

    const rows = (data || []) as unknown as DbProductAlertRow[];

    // Filtrar en memoria por min_stock_alert (default 5)
    const alertProducts: Product[] = rows
      .filter((p) => {
        const limit = p.min_stock_alert !== null && p.min_stock_alert !== undefined ? Number(p.min_stock_alert) : 5;
        return Number(p.stock_quantity || 0) <= limit;
      })
      .map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        brand: p.brand,
        type: p.type as Product['type'],
        base_cost_ars: Number(p.base_cost_ars || 0),
        base_price_ars: Number(p.base_price_ars || 0),
        stock_quantity: Number(p.stock_quantity || 0),
        volume_ml: p.volume_ml ? Number(p.volume_ml) : undefined,
        min_stock_alert: Number(p.min_stock_alert || 5),
        is_public: true,
        created_at: p.created_at,
      }));

    return { success: true, data: alertProducts };
  } catch (error: unknown) {
    console.error('Error al obtener alertas de stock:', error);
    const msg = error instanceof Error ? error.message : 'Error al obtener alertas de stock';
    return { success: false, error: msg };
  }
}

interface DbInventoryAdjustmentRow {
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
  } | Array<{
    name: string;
    brand: string;
    sku: string;
    type: string;
    base_cost_ars?: number;
  }>;
}

/**
 * Obtener el historial completo de ajustes manuales de inventario (Solo Admin).
 */
export async function getInventoryAdjustments(role?: UserRole): Promise<{
  success: boolean;
  data?: InventoryAdjustmentRecord[];
  error?: string;
}> {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured()) {
      return { success: true, data: [] };
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

    const rows = (data || []) as unknown as DbInventoryAdjustmentRow[];
    const list: InventoryAdjustmentRecord[] = rows.map((item) => ({
      id: item.id,
      product_id: item.product_id,
      created_by: item.created_by,
      type: item.type,
      quantity: Number(item.quantity || 0),
      reason: item.reason,
      created_at: item.created_at,
      products: Array.isArray(item.products) ? item.products[0] : item.products,
    }));

    return { success: true, data: list };
  } catch (error: unknown) {
    console.error('Error al obtener historial de ajustes:', error);
    const msg = error instanceof Error ? error.message : 'Error al consultar historial de ajustes';
    return { success: false, error: msg };
  }
}

/**
 * Registrar un ajuste manual de inventario (Merma, Rotura, Regalo, Corrección de Conteo).
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
    const adminUser = await requireAdmin();

    const validation = inventoryAdjustSchema.safeParse({
      productId,
      type,
      quantity: Number(quantity),
      reason,
    });

    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Datos del ajuste inválidos.';
      return { success: false, error: firstError };
    }

    const clean = validation.data;

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const supabase = getServiceSupabase();

    // 1. Invocar RPC transaccional que actualiza el stock e inserta en inventory_adjustments
    const { error: rpcError } = await supabase.rpc('adjust_inventory_transaction', {
      p_product_id: clean.productId,
      p_admin_id: adminUser.id,
      p_type: clean.type,
      p_quantity: clean.quantity,
      p_reason: clean.reason,
    });

    if (rpcError) throw rpcError;

    // 2. Regla Financiera: Si la cantidad es negativa (merma/pérdida/rotura), impactar en OPEX
    if (clean.quantity < 0) {
      const { data: product } = await supabase
        .from('products')
        .select('name, base_cost_ars')
        .eq('id', clean.productId)
        .single();

      if (product) {
        const unitCost = Number(product.base_cost_ars || 0);
        const lossAmountArs = Math.abs(clean.quantity) * unitCost;

        if (lossAmountArs > 0) {
          // Obtener tipo de cambio Dólar Blue activo para referencia USD
          let exchangeRate = 1250;
          const { data: rateData } = await supabase
            .from('exchange_rates')
            .select('value_ars')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (rateData && rateData.value_ars) {
            exchangeRate = Number(rateData.value_ars);
          }

          const lossAmountUsd = lossAmountArs / exchangeRate;

          // Insertar en operating_expenses
          await supabase.from('operating_expenses').insert({
            category: 'Merma de Inventario',
            amount_ars: lossAmountArs,
            amount_usd: lossAmountUsd,
            description: `Merma [${clean.type}]: ${Math.abs(clean.quantity)} u/ml de ${product.name} (${clean.reason})`,
            expense_date: new Date().toISOString().split('T')[0],
            created_by: adminUser.id,
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
  } catch (error: unknown) {
    console.error('Error al registrar ajuste de inventario:', error);
    const msg = error instanceof Error ? error.message : 'Error al procesar el ajuste de inventario';
    return { success: false, error: msg };
  }
}
