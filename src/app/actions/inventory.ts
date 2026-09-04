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

function mapAdjustmentTypeToDb(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('rotura') || t.includes('derrame') || t.includes('pérdida') || t.includes('merma') || t.includes('damage')) {
    return 'damage';
  }
  return 'correction';
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
        admin_id,
        adjustment_type,
        quantity_adjusted,
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
      created_by: item.admin_id,
      type: item.adjustment_type,
      quantity: Number(item.quantity_adjusted || 0),
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
 * Registrar un ajuste manual de inventario (Merma, Rotura, Regalo, Corrección de Conteo, Apertura de Tester).
 * Si es apertura de Tester, se imputa contablemente a Marketing / Showroom.
 * Si la cantidad es negativa (pérdida/merma), calcula el costo e inserta OPEX.
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
    const dbType = mapAdjustmentTypeToDb(clean.type);
    const formattedReason = `[${clean.type}] ${clean.reason.trim()}`;

    // 1. Invocar RPC transaccional que actualiza el stock e inserta en inventory_adjustments
    const { error: rpcError } = await supabase.rpc('adjust_inventory_transaction', {
      p_product_id: clean.productId,
      p_admin_id: adminUser.id,
      p_type: dbType,
      p_quantity: clean.quantity,
      p_reason: formattedReason,
    });

    if (rpcError) throw rpcError;

    // 2. Regla Financiera: Si la cantidad es negativa (merma/rotura/tester), impactar en OPEX
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

          // Categorización: Si es Tester, se imputa a Marketing / Showroom
          const isTester = clean.type.toLowerCase().includes('tester');
          const opexCategory = isTester ? 'Marketing / Showroom' : 'Merma de Inventario';
          const opexDesc = isTester
            ? `Apertura de Tester Showroom: ${Math.abs(clean.quantity)} u/ml de ${product.name} (${clean.reason})`
            : `Merma [${clean.type}]: ${Math.abs(clean.quantity)} u/ml de ${product.name} (${clean.reason})`;

          await supabase.from('operating_expenses').insert({
            category: opexCategory,
            amount_ars: lossAmountArs,
            amount_usd: lossAmountUsd,
            description: opexDesc,
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
    revalidatePath('/admin/inventario/decants');
    revalidatePath('/admin/inventario/kardex');
    revalidatePath('/admin/reportes');
    revalidatePath('/admin/gastos');

    return { success: true };
  } catch (error: unknown) {
    console.error('Error al registrar ajuste de inventario:', error);
    const msg = error instanceof Error ? error.message : 'Error al procesar el ajuste de inventario';
    return { success: false, error: msg };
  }
}

export interface FractionationLogRecord {
  id: string;
  created_at: string;
  source_bottle_id: string;
  target_liquid_id: string;
  volume_ml: number;
  cost_transferred_ars: number;
  cost_per_ml_calculated: number;
  admin_id?: string | null;
  notes?: string | null;
  source_bottle_name?: string;
  source_bottle_sku?: string;
  target_liquid_name?: string;
  target_liquid_sku?: string;
  admin_name?: string;
}

/**
 * Obtener historial de fraccionamientos de botellas a decant_liquid.
 */
export async function getFractionationLogs(role?: UserRole): Promise<{
  success: boolean;
  data?: FractionationLogRecord[];
  error?: string;
}> {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured()) {
      return { success: true, data: [] };
    }

    const supabase = getServiceSupabase();

    const { data: logs, error } = await supabase
      .from('fractionation_logs')
      .select(`
        id,
        source_bottle_id,
        target_liquid_id,
        volume_ml,
        cost_transferred_ars,
        cost_per_ml_calculated,
        admin_id,
        notes,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !logs || logs.length === 0) {
      return { success: true, data: [] };
    }

    const productIds = new Set<string>();
    const adminIds = new Set<string>();
    logs.forEach((l) => {
      if (l.source_bottle_id) productIds.add(l.source_bottle_id);
      if (l.target_liquid_id) productIds.add(l.target_liquid_id);
      if (l.admin_id) adminIds.add(l.admin_id);
    });

    const { data: prods } = await supabase
      .from('products')
      .select('id, name, sku')
      .in('id', Array.from(productIds));

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', Array.from(adminIds));

    const prodMap = new Map((prods || []).map((p) => [p.id, p]));
    const profileMap = new Map((profiles || []).map((p) => [p.id, p.full_name || p.email]));

    const formatted: FractionationLogRecord[] = logs.map((l) => {
      const src = prodMap.get(l.source_bottle_id);
      const tgt = prodMap.get(l.target_liquid_id);
      return {
        id: l.id,
        created_at: l.created_at,
        source_bottle_id: l.source_bottle_id,
        target_liquid_id: l.target_liquid_id,
        volume_ml: Number(l.volume_ml || 0),
        cost_transferred_ars: Number(l.cost_transferred_ars || 0),
        cost_per_ml_calculated: Number(l.cost_per_ml_calculated || 0),
        admin_id: l.admin_id,
        notes: l.notes,
        source_bottle_name: src?.name || 'Botella Origen',
        source_bottle_sku: src?.sku || 'N/A',
        target_liquid_name: tgt?.name || 'Líquido a Granel',
        target_liquid_sku: tgt?.sku || 'N/A',
        admin_name: l.admin_id ? profileMap.get(l.admin_id) || 'Admin' : 'Admin',
      };
    });

    return { success: true, data: formatted };
  } catch (err: unknown) {
    console.error('Error al obtener fractionation_logs:', err);
    return { success: true, data: [] };
  }
}

export type KardexMovementType =
  | 'COMPRA_IN'
  | 'VENTA_POS'
  | 'VENTA_WEB'
  | 'FRACCIONAMIENTO_OUT'
  | 'FRACCIONAMIENTO_IN'
  | 'MERMA_ROTURA'
  | 'USO_TESTER'
  | 'AJUSTE_MANUAL';

export interface KardexMovement {
  id: string;
  created_at: string;
  product_id: string;
  product_name: string;
  product_brand: string;
  product_sku: string;
  product_type: string;
  movement_type: KardexMovementType;
  quantity: number;
  unit_value_ars: number;
  total_value_ars: number;
  reference_id?: string;
  reference_label: string;
  responsible_user?: string;
  notes?: string;
}

export interface GetKardexParams {
  productId?: string;
  movementType?: KardexMovementType;
  search?: string;
  limit?: number;
}

/**
 * Motor Kardex Unificado: Consolida ventas (POS y Web), compras recibidas,
 * mermas, testers y fraccionamientos en un único flujo cronológico auditable.
 */
export async function getKardexMovements(params: GetKardexParams = {}): Promise<{
  success: boolean;
  data?: KardexMovement[];
  error?: string;
}> {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured()) {
      return { success: true, data: [] };
    }

    const supabase = getServiceSupabase();
    const movements: KardexMovement[] = [];

    // 1. Consultar Ajustes Manuales / Mermas / Testers
    const { data: adjData } = await supabase
      .from('inventory_adjustments')
      .select(`
        id,
        product_id,
        admin_id,
        adjustment_type,
        quantity_adjusted,
        reason,
        created_at,
        products ( id, name, brand, sku, type, base_cost_ars )
      `)
      .order('created_at', { ascending: false })
      .limit(150);

    if (adjData) {
      adjData.forEach((adj: any) => {
        const prod = Array.isArray(adj.products) ? adj.products[0] : adj.products;
        if (!prod) return;

        const reasonText = adj.reason || '';
        let movType: KardexMovementType = 'AJUSTE_MANUAL';
        if (reasonText.toLowerCase().includes('tester') || adj.adjustment_type?.toLowerCase().includes('tester')) {
          movType = 'USO_TESTER';
        } else if (Number(adj.quantity_adjusted) < 0) {
          movType = 'MERMA_ROTURA';
        }

        const qty = Number(adj.quantity_adjusted || 0);
        const unitVal = Number(prod.base_cost_ars || 0);

        movements.push({
          id: `adj-${adj.id}`,
          created_at: adj.created_at,
          product_id: adj.product_id,
          product_name: prod.name,
          product_brand: prod.brand || '',
          product_sku: prod.sku || '',
          product_type: prod.type || 'bottle',
          movement_type: movType,
          quantity: qty,
          unit_value_ars: unitVal,
          total_value_ars: Math.round(Math.abs(qty) * unitVal),
          reference_id: adj.id,
          reference_label: reasonText || `Ajuste (${adj.adjustment_type})`,
          responsible_user: 'Administrador',
        });
      });
    }

    // 2. Consultar Ventas (POS y Tienda WhatsApp)
    const { data: salesData } = await supabase
      .from('sale_items')
      .select(`
        id,
        product_id,
        quantity,
        price_ars_at_moment,
        unit_cost_at_moment,
        products ( id, name, brand, sku, type, base_cost_ars ),
        sales ( id, channel, created_at, payment_methods, seller_id )
      `)
      .order('id', { ascending: false })
      .limit(200);

    if (salesData) {
      salesData.forEach((item: any) => {
        const prod = Array.isArray(item.products) ? item.products[0] : item.products;
        const sale = Array.isArray(item.sales) ? item.sales[0] : item.sales;
        if (!prod || !sale) return;

        const isWeb =
          sale.channel === 'whatsapp_store' ||
          sale.payment_methods?.channel === 'whatsapp_store' ||
          sale.channel === 'online';

        const qty = Number(item.quantity || 1);
        const unitVal = Number(item.price_ars_at_moment || prod.base_cost_ars || 0);

        movements.push({
          id: `sale-${item.id}`,
          created_at: sale.created_at,
          product_id: item.product_id,
          product_name: prod.name,
          product_brand: prod.brand || '',
          product_sku: prod.sku || '',
          product_type: prod.type || 'bottle',
          movement_type: isWeb ? 'VENTA_WEB' : 'VENTA_POS',
          quantity: -Math.abs(qty),
          unit_value_ars: unitVal,
          total_value_ars: Math.round(qty * unitVal),
          reference_id: sale.id,
          reference_label: isWeb ? 'Venta Online WhatsApp' : 'Venta Mostrador POS',
          responsible_user: isWeb ? 'Cliente Web' : 'Cajero POS',
        });
      });
    }

    // 3. Consultar Recepciones de Compra (COMPRA_IN)
    const { data: poData } = await supabase
      .from('purchase_orders')
      .select(`
        id,
        created_at,
        suppliers ( name ),
        purchase_order_items (
          id,
          product_id,
          expected_quantity,
          received_quantity,
          unit_cost,
          products ( id, name, brand, sku, type )
        )
      `)
      .eq('status', 'received')
      .order('created_at', { ascending: false })
      .limit(50);

    if (poData) {
      poData.forEach((po: any) => {
        const supp = Array.isArray(po.suppliers) ? po.suppliers[0] : po.suppliers;
        const items = po.purchase_order_items || [];
        items.forEach((it: any) => {
          const prod = Array.isArray(it.products) ? it.products[0] : it.products;
          if (!prod) return;

          const qty = Number(it.received_quantity || it.expected_quantity || 0);
          if (qty <= 0) return;

          const unitVal = Number(it.unit_cost || 0);

          movements.push({
            id: `po-${it.id}`,
            created_at: po.created_at,
            product_id: it.product_id,
            product_name: prod.name,
            product_brand: prod.brand || '',
            product_sku: prod.sku || '',
            product_type: prod.type || 'bottle',
            movement_type: 'COMPRA_IN',
            quantity: qty,
            unit_value_ars: unitVal,
            total_value_ars: Math.round(qty * unitVal),
            reference_id: po.id,
            reference_label: `Ingreso por Compra (${supp?.name || 'Proveedor B2B'})`,
            responsible_user: supp?.name || 'Proveedor',
          });
        });
      });
    }

    // 4. Consultar Fraccionamientos de Botellas a Granel
    const { data: fracLogs } = await supabase
      .from('fractionation_logs')
      .select(`
        id,
        source_bottle_id,
        target_liquid_id,
        volume_ml,
        cost_transferred_ars,
        cost_per_ml_calculated,
        notes,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (fracLogs && fracLogs.length > 0) {
      const pIds = new Set<string>();
      fracLogs.forEach((l) => {
        if (l.source_bottle_id) pIds.add(l.source_bottle_id);
        if (l.target_liquid_id) pIds.add(l.target_liquid_id);
      });

      const { data: pData } = await supabase
        .from('products')
        .select('id, name, brand, sku, type')
        .in('id', Array.from(pIds));

      const pMap = new Map((pData || []).map((p) => [p.id, p]));

      fracLogs.forEach((log) => {
        const bottle = pMap.get(log.source_bottle_id);
        const liquid = pMap.get(log.target_liquid_id);

        if (bottle) {
          movements.push({
            id: `frac-out-${log.id}`,
            created_at: log.created_at,
            product_id: bottle.id,
            product_name: bottle.name,
            product_brand: bottle.brand || '',
            product_sku: bottle.sku || '',
            product_type: bottle.type || 'bottle',
            movement_type: 'FRACCIONAMIENTO_OUT',
            quantity: -1,
            unit_value_ars: Number(log.cost_transferred_ars || 0),
            total_value_ars: Number(log.cost_transferred_ars || 0),
            reference_id: log.id,
            reference_label: `Apertura de Botella ➔ Fraccionado a ${log.volume_ml}ml`,
            responsible_user: 'Laboratorio / Showroom',
            notes: log.notes || undefined,
          });
        }

        if (liquid) {
          movements.push({
            id: `frac-in-${log.id}`,
            created_at: log.created_at,
            product_id: liquid.id,
            product_name: liquid.name,
            product_brand: liquid.brand || '',
            product_sku: liquid.sku || '',
            product_type: liquid.type || 'decant_liquid',
            movement_type: 'FRACCIONAMIENTO_IN',
            quantity: Number(log.volume_ml || 0),
            unit_value_ars: Number(log.cost_per_ml_calculated || 0),
            total_value_ars: Number(log.cost_transferred_ars || 0),
            reference_id: log.id,
            reference_label: `Ingreso de Granel (+${log.volume_ml} ml)`,
            responsible_user: 'Laboratorio / Showroom',
            notes: log.notes || undefined,
          });
        }
      });
    }

    // 5. Filtrar y Ordenar
    let filtered = movements;

    if (params.productId) {
      filtered = filtered.filter((m) => m.product_id === params.productId);
    }

    if (params.movementType) {
      filtered = filtered.filter((m) => m.movement_type === params.movementType);
    }

    if (params.search && params.search.trim()) {
      const term = params.search.toLowerCase().trim();
      filtered = filtered.filter(
        (m) =>
          m.product_name.toLowerCase().includes(term) ||
          m.product_brand.toLowerCase().includes(term) ||
          m.product_sku.toLowerCase().includes(term) ||
          m.reference_label.toLowerCase().includes(term)
      );
    }

    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const limit = params.limit || 150;
    return { success: true, data: filtered.slice(0, limit) };
  } catch (err: unknown) {
    console.error('Error al generar Kardex:', err);
    const msg = err instanceof Error ? err.message : 'Error al obtener movimientos de Kardex';
    return { success: false, error: msg };
  }
}
