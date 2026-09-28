'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserRole } from '@/types';
import { requireAdmin, requireAuth } from '@/lib/auth-checks';
import { resolveBusinessRange } from '@/lib/date-utils';
import { resolveItemUnitCost } from '@/lib/financial-calculations';
import { buildRecipeFallbackMap } from '@/lib/recipe-fallback';
import Decimal from 'decimal.js';

/**
 * Métricas Avanzadas de Retail/Perfumería:
 * 1. Rentabilidad por formato (Decant vs. Frasco Cerrado) por período.
 * 2. Rotación de stock por familia olfativa (capital inmovilizado vs. ventas).
 * 3. Fidelidad CRM: tasa de recompra y LTV promedio.
 * Aritmética exacta con Decimal.js y tipado estricto (sin any).
 */

// ============================================================================
// TIPOS
// ============================================================================

export interface FormatMarginRow {
  format: 'decant_liquid' | 'bottle';
  label: string;
  salesCount: number;
  unitsSold: number;
  totalRevenueArs: number;
  totalCostArs: number;
  grossMarginArs: number;
  grossMarginPercent: number;
}

export interface FormatMarginAnalysis {
  rows: FormatMarginRow[];
  decant: FormatMarginRow | null;
  bottle: FormatMarginRow | null;
  /** Diferencia de margen % decant vs frasco (positivo = decant más rentable). */
  marginDeltaPercent: number;
}

export type FamilyRotationStatus = 'alta_rotacion' | 'media' | 'estancada' | 'sin_ventas';

export interface FamilyRotationRow {
  family: string;
  stockCapitalArs: number;
  stockUnits: number;
  salesRevenueArs: number;
  /** Ingresos del período / capital inmovilizado (velocidad de rotación). */
  rotationIndex: number;
  status: FamilyRotationStatus;
}

export interface FamilyRotationAnalysis {
  rows: FamilyRotationRow[];
  totalImmobilizedArs: number;
  periodDays: number;
}

export interface LoyaltyMetrics {
  clientsWithPurchases: number;
  repeatClients: number;
  repurchaseRatePercent: number;
  avgLtvArs: number;
  avgRepeatLtvArs: number;
  totalRevenueAllClientsArs: number;
}

// ============================================================================
// 1. RENTABILIDAD POR FORMATO (DECANT VS FRASCO CERRADO)
// ============================================================================

interface DbFormatSaleRow {
  id: string;
  total_ars?: number | null;
}

interface DbFormatItemRow {
  sale_id: string;
  product_id: string;
  quantity?: number | null;
  price_ars_at_moment?: number | null;
  unit_cost_at_moment?: number | null;
  products?: {
    name?: string | null;
    type?: string | null;
    base_cost_ars?: number | null;
  } | null;
}

interface FormatBucket {
  salesCount: Set<string>;
  unitsSold: Decimal;
  revenue: Decimal;
  cost: Decimal;
}

/**
 * Analiza el margen bruto (%) y la masa de margen (ARS) comparando ventas de
 * botellas cerradas frente a decants fraccionados en el período dado.
 * Usa el costo congelado (unit_cost_at_moment) de cada ítem: misma fuente de
 * verdad que el P&L. Márgenes sin clamp: las pérdidas son reales.
 */
export async function getFormatMarginAnalysis(
  role: UserRole,
  startDate?: string,
  endDate?: string
): Promise<{ success: boolean; data?: FormatMarginAnalysis; error?: string }> {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured()) {
      return {
        success: true,
        data: { rows: [], decant: null, bottle: null, marginDeltaPercent: 0 },
      };
    }

    const supabase = getServiceSupabase();
    const businessRange = resolveBusinessRange(
      startDate && endDate ? 'custom' : 'last_30_days',
      startDate,
      endDate
    );
    const isoStart = businessRange.start.toISOString();
    const isoEnd = businessRange.end.toISOString();

    // 1. Ventas activas del período (excluyendo anuladas y pendientes)
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('id, total_ars')
      .gte('created_at', isoStart)
      .lte('created_at', isoEnd)
      .neq('status', 'voided')
      .neq('status', 'pending_payment');

    if (salesError) throw salesError;
    const sales = (salesData || []) as unknown as DbFormatSaleRow[];
    const saleIds = sales.map((s) => s.id);

    // 2. Ítems vendidos con formato y costo congelado
    let items: DbFormatItemRow[] = [];
    if (saleIds.length > 0) {
      let { data: itemsData, error: itemsError } = await supabase
        .from('sale_items')
        .select('sale_id, product_id, quantity, price_ars_at_moment, unit_cost_at_moment, products ( name, type, base_cost_ars )')
        .in('sale_id', saleIds);

      // Tolerancia 42703: si la columna unit_cost_at_moment no existe en la BD, reintentar sin ella
      if (itemsError && itemsError.message?.includes('unit_cost_at_moment')) {
        const fallbackRes = await supabase
          .from('sale_items')
          .select('sale_id, product_id, quantity, price_ars_at_moment, products ( name, type, base_cost_ars )')
          .in('sale_id', saleIds);
        itemsData = fallbackRes.data as typeof itemsData;
        itemsError = fallbackRes.error;
      }

      if (itemsError) throw itemsError;
      items = (itemsData || []) as unknown as DbFormatItemRow[];
    }

    // 3. Fallbacks canónicos de costo (misma cadena que el P&L) para ítems sin costo
    // congelado: último costo de compra + recetas BOM (tamaño y costos reales)
    const missingCostProductIds = new Set<string>();
    items.forEach((item) => {
      const catCost = Number(item.products?.base_cost_ars || 0);
      const momentCost = Number(item.unit_cost_at_moment || 0);
      if (catCost <= 0 && momentCost <= 0 && item.product_id) {
        missingCostProductIds.add(item.product_id);
      }
    });

    const poCostMap: Record<string, Decimal> = {};
    if (missingCostProductIds.size > 0) {
      const { data: poItems } = await supabase
        .from('purchase_order_items')
        .select('product_id, unit_cost, created_at')
        .in('product_id', Array.from(missingCostProductIds))
        .order('created_at', { ascending: false });

      if (poItems) {
        poItems.forEach((poItem: any) => {
          if (!poCostMap[poItem.product_id] && Number(poItem.unit_cost) > 0) {
            poCostMap[poItem.product_id] = new Decimal(poItem.unit_cost);
          }
        });
      }
    }
    const recipeFallbackMap = await buildRecipeFallbackMap(missingCostProductIds);

    // 4. Agregación por formato con Decimal.js
    const buckets = new Map<'decant_liquid' | 'bottle', FormatBucket>();
    const ensureBucket = (format: 'decant_liquid' | 'bottle'): FormatBucket => {
      let bucket = buckets.get(format);
      if (!bucket) {
        bucket = { salesCount: new Set<string>(), unitsSold: new Decimal(0), revenue: new Decimal(0), cost: new Decimal(0) };
        buckets.set(format, bucket);
      }
      return bucket;
    };

    items.forEach((item) => {
      const format: 'decant_liquid' | 'bottle' = item.products?.type === 'decant_liquid' ? 'decant_liquid' : 'bottle';
      const bucket = ensureBucket(format);
      const qty = new Decimal(item.quantity || 0);
      const recipeInfo = recipeFallbackMap[item.product_id];

      // Cadena canónica de resolución de costo unitario (idéntica al P&L):
      // costo congelado -> BOM/decant calculado -> catálogo -> última compra
      const costResolution = resolveItemUnitCost({
        itemUnitCostAtMoment: item.unit_cost_at_moment,
        productBaseCostArs: item.products?.base_cost_ars,
        lastPurchaseOrderCostArs: poCostMap[item.product_id]?.toNumber(),
        productType: item.products?.type,
        decantMl: recipeInfo?.sizeMl ?? null,
        supplyCostArs: recipeInfo?.supplyCostArs ?? null,
      });

      bucket.salesCount.add(item.sale_id);
      bucket.unitsSold = bucket.unitsSold.plus(qty);
      bucket.revenue = bucket.revenue.plus(new Decimal(item.price_ars_at_moment || 0).times(qty));
      bucket.cost = bucket.cost.plus(new Decimal(costResolution.unitCost).times(qty));
    });

    const rows: FormatMarginRow[] = (['decant_liquid', 'bottle'] as const).map((format) => {
      const bucket = buckets.get(format);
      const revenue = bucket?.revenue || new Decimal(0);
      const cost = bucket?.cost || new Decimal(0);
      const margin = revenue.minus(cost);
      const percent = revenue.greaterThan(0)
        ? Number(margin.dividedBy(revenue).times(100).toFixed(2))
        : 0;

      return {
        format,
        label: format === 'decant_liquid' ? 'Decants Fraccionados' : 'Frasco Cerrado',
        salesCount: bucket ? bucket.salesCount.size : 0,
        unitsSold: Math.round((bucket?.unitsSold || new Decimal(0)).toNumber()),
        totalRevenueArs: Math.round(revenue.toNumber()),
        totalCostArs: Math.round(cost.toNumber()),
        grossMarginArs: Math.round(margin.toNumber()),
        grossMarginPercent: percent,
      };
    });

    const decant = rows.find((r) => r.format === 'decant_liquid') || null;
    const bottle = rows.find((r) => r.format === 'bottle') || null;
    const marginDeltaPercent =
      decant && bottle && (decant.totalRevenueArs > 0 || bottle.totalRevenueArs > 0)
        ? Number((decant.grossMarginPercent - bottle.grossMarginPercent).toFixed(2))
        : 0;

    return {
      success: true,
      data: { rows, decant, bottle, marginDeltaPercent },
    };
  } catch (error: unknown) {
    console.error('Error al analizar rentabilidad por formato:', error);
    const msg = error instanceof Error ? error.message : 'Error al calcular la rentabilidad por formato';
    return { success: false, error: msg };
  }
}

// ============================================================================
// 2. ROTACIÓN POR FAMILIA OLFATIVA
// ============================================================================

interface DbRotationProductRow {
  id: string;
  olfactory_family?: string | null;
  stock_quantity?: number | null;
  base_cost_ars?: number | null;
}

interface DbRotationItemRow {
  product_id: string;
  quantity?: number | null;
  price_ars_at_moment?: number | null;
  products?: {
    olfactory_family?: string | null;
  } | null;
}

interface FamilyBucket {
  stockCapital: Decimal;
  stockUnits: number;
  revenue: Decimal;
}

/** Ventana de análisis de rotación: últimos 90 días. */
const ROTATION_PERIOD_DAYS = 90;

/**
 * Calcula capital inmovilizado en stock y volumen de ventas agrupado por
 * olfactory_family, e identifica familias de alta rotación vs. stock estancado.
 * Índice de rotación = ingresos de la ventana / capital inmovilizado.
 */
export async function getFamilyRotationAnalysis(
  role: UserRole
): Promise<{ success: boolean; data?: FamilyRotationAnalysis; error?: string }> {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured()) {
      return {
        success: true,
        data: { rows: [], totalImmobilizedArs: 0, periodDays: ROTATION_PERIOD_DAYS },
      };
    }

    const supabase = getServiceSupabase();

    // Ventana rodante de rotación (90 días)
    const end = new Date();
    const start = new Date(end.getTime() - ROTATION_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    // 1. Consultas CONCURRENTES: inventario activo + ventas de la ventana
    const [productsRes, salesRes] = await Promise.all([
      supabase
        .from('products')
        .select('id, olfactory_family, stock_quantity, base_cost_ars')
        .gt('stock_quantity', 0)
        .neq('type', 'supply'),
      supabase
        .from('sales')
        .select('id')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .neq('status', 'voided')
        .neq('status', 'pending_payment'),
    ]);

    if (productsRes.error) throw productsRes.error;
    if (salesRes.error) throw salesRes.error;

    const products = (productsRes.data || []) as unknown as DbRotationProductRow[];
    const saleIds = ((salesRes.data || []) as unknown as Array<{ id: string }>).map((s) => s.id);

    let items: DbRotationItemRow[] = [];
    if (saleIds.length > 0) {
      const { data: itemsData, error: itemsError } = await supabase
        .from('sale_items')
        .select('product_id, quantity, price_ars_at_moment, products ( olfactory_family )')
        .in('sale_id', saleIds);

      if (itemsError) throw itemsError;
      items = (itemsData || []) as unknown as DbRotationItemRow[];
    }

    // 2. Agregación por familia con Decimal.js
    const familyMap = new Map<string, FamilyBucket>();
    const ensureFamily = (family: string): FamilyBucket => {
      let bucket = familyMap.get(family);
      if (!bucket) {
        bucket = { stockCapital: new Decimal(0), stockUnits: 0, revenue: new Decimal(0) };
        familyMap.set(family, bucket);
      }
      return bucket;
    };

    products.forEach((p) => {
      const family = p.olfactory_family || 'Sin familia';
      const bucket = ensureFamily(family);
      bucket.stockCapital = bucket.stockCapital.plus(
        new Decimal(p.base_cost_ars || 0).times(new Decimal(p.stock_quantity || 0))
      );
      bucket.stockUnits += Number(p.stock_quantity || 0);
    });

    items.forEach((item) => {
      const family = item.products?.olfactory_family || 'Sin familia';
      const bucket = ensureFamily(family);
      bucket.revenue = bucket.revenue.plus(
        new Decimal(item.price_ars_at_moment || 0).times(new Decimal(item.quantity || 0))
      );
    });

    // 3. Filas con estado de rotación (umbral: 1 = el stock rotó completo en la ventana)
    const rows: FamilyRotationRow[] = Array.from(familyMap.entries())
      .map(([family, bucket]) => {
        const capital = bucket.stockCapital.toNumber();
        const revenue = bucket.revenue.toNumber();
        // Capital 0 con ventas = stock completamente agotado (rotación máxima representable)
        const rotationIndex =
          capital > 0
            ? Number((revenue / capital).toFixed(3))
            : revenue > 0
              ? 99.999
              : 0;

        const status: FamilyRotationStatus =
          revenue <= 0
            ? 'sin_ventas'
            : rotationIndex >= 1
              ? 'alta_rotacion'
              : rotationIndex >= 0.25
                ? 'media'
                : 'estancada';

        return {
          family,
          stockCapitalArs: Math.round(capital),
          stockUnits: bucket.stockUnits,
          salesRevenueArs: Math.round(revenue),
          rotationIndex,
          status,
        };
      })
      .sort((a, b) => b.rotationIndex - a.rotationIndex);

    const totalImmobilizedArs = rows.reduce((sum, r) => sum + r.stockCapitalArs, 0);

    return {
      success: true,
      data: { rows, totalImmobilizedArs, periodDays: ROTATION_PERIOD_DAYS },
    };
  } catch (error: unknown) {
    console.error('Error al analizar rotación por familia olfativa:', error);
    const msg = error instanceof Error ? error.message : 'Error al calcular la rotación por familia';
    return { success: false, error: msg };
  }
}

// ============================================================================
// 3. FIDELIDAD CRM: TASA DE RECOMPRA Y LTV
// ============================================================================

interface DbClientTotalsRow {
  o_client_id: string;
  o_total_spent: number;
  o_sales_count: number;
}

/**
 * Calcula la tasa de recompra (% de clientes con >1 compra) y el LTV promedio
 * reutilizando la agregación SQL get_client_sales_totals (una sola query).
 */
export async function getLoyaltyMetrics(
  role: UserRole
): Promise<{ success: boolean; data?: LoyaltyMetrics; error?: string }> {
  try {
    await requireAuth();

    if (!isSupabaseConfigured()) {
      return {
        success: true,
        data: {
          clientsWithPurchases: 0,
          repeatClients: 0,
          repurchaseRatePercent: 0,
          avgLtvArs: 0,
          avgRepeatLtvArs: 0,
          totalRevenueAllClientsArs: 0,
        },
      };
    }

    const supabase = getServiceSupabase();
    const { data: totalsData, error } = await supabase.rpc('get_client_sales_totals');
    if (error) throw error;

    const totals = (totalsData || []) as unknown as DbClientTotalsRow[];
    const clientsWithPurchases = totals.length;
    const repeatRows = totals.filter((t) => Number(t.o_sales_count) > 1);
    const repeatClients = repeatRows.length;
    const totalRevenueAllClients = totals.reduce(
      (sum, t) => new Decimal(sum).plus(new Decimal(t.o_total_spent || 0)),
      new Decimal(0)
    );
    const repeatRevenue = repeatRows.reduce(
      (sum, t) => new Decimal(sum).plus(new Decimal(t.o_total_spent || 0)),
      new Decimal(0)
    );

    const repurchaseRatePercent = clientsWithPurchases > 0
      ? Number(new Decimal(repeatClients).dividedBy(clientsWithPurchases).times(100).toFixed(1))
      : 0;

    const avgLtvArs = clientsWithPurchases > 0
      ? Math.round(totalRevenueAllClients.dividedBy(clientsWithPurchases).toNumber())
      : 0;

    const avgRepeatLtvArs = repeatClients > 0
      ? Math.round(repeatRevenue.dividedBy(repeatClients).toNumber())
      : 0;

    return {
      success: true,
      data: {
        clientsWithPurchases,
        repeatClients,
        repurchaseRatePercent,
        avgLtvArs,
        avgRepeatLtvArs,
        totalRevenueAllClientsArs: Math.round(totalRevenueAllClients.toNumber()),
      },
    };
  } catch (error: unknown) {
    console.error('Error al calcular métricas de fidelidad:', error);
    const msg = error instanceof Error ? error.message : 'Error al calcular las métricas de fidelidad';
    return { success: false, error: msg };
  }
}
