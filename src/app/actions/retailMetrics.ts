'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserRole } from '@/types';
import { requireAdmin, requireAuth } from '@/lib/auth-checks';
import { resolveBusinessRange } from '@/lib/date-utils';
import { resolveItemUnitCost } from '@/lib/financial-calculations';
import { buildRecipeFallbackMap } from '@/lib/recipe-fallback';
import { getCurrentRate } from '@/app/actions/rates';
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

export type RotationZone = 'active' | 'slow' | 'dead_stock';

export interface DeadStockProduct {
  id: string;
  name: string;
  brand: string;
  sku: string;
  type: 'bottle' | 'decant_liquid';
  stockQuantity: number;
  baseCostArs: number;
  basePriceArs: number;
  capitalHundidoArs: number;
  capitalHundidoUsd: number;
  daysWithoutSale: number;
  lastSaleDate: string | null;
  entryDate: string;
  zone: RotationZone;
}

export interface DeadStockSummary {
  deadStockCapitalArs: number;
  deadStockCapitalUsd: number;
  deadStockSkuCount: number;
  slowStockCapitalArs: number;
  slowStockSkuCount: number;
  activeStockCapitalArs: number;
  activeStockSkuCount: number;
  totalCatalogCapitalArs: number;
  totalCatalogCapitalUsd: number;
  deadStockPercentage: number;
  exchangeRate: number;
}

export interface DeadStockAnalysis {
  summary: DeadStockSummary;
  items: DeadStockProduct[];
}

export interface DecantYieldItem {
  id: string;
  name: string;
  brand: string;
  sku: string;
  stockMl: number;
  decantPricePerMlArs: number;
  totalMlSold: number;
  totalRevenueArs: number;
  bottleId: string | null;
  bottleName: string | null;
  bottlePriceArs: number;
  bottleVolumeMl: number;
  bottlePricePerMlArs: number;
  equivalentBottleRevenueArs: number;
  yieldMultiplier: number;
  potentialMultiplier: number;
  extraRevenueArs: number;
  hasSales: boolean;
}

export interface DecantYieldReport {
  items: DecantYieldItem[];
  summary: {
    totalDecantsTracked: number;
    totalMlSold: number;
    totalDecantRevenueArs: number;
    totalBottleEquivalentArs: number;
    totalExtraRevenueArs: number;
    avgYieldMultiplier: number;
  };
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

// ============================================================================
// 4. ANÁLISIS DE DEAD STOCK Y ENVEJECIMIENTO DE INVENTARIO
// ============================================================================

/**
 * Cruza la fecha de última venta y la fecha de ingreso (PO o created_at) de cada
 * producto con stock > 0 (excluyendo packaging/supply).
 * Clasifica en Activo (<30d), Lento (30-60d) y Dead Stock (>60d) y computa el capital inmovilizado.
 */
export async function getDeadStockAnalysis(
  role: UserRole
): Promise<{ success: boolean; data?: DeadStockAnalysis; error?: string }> {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured()) {
      return {
        success: true,
        data: {
          summary: {
            deadStockCapitalArs: 0,
            deadStockCapitalUsd: 0,
            deadStockSkuCount: 0,
            slowStockCapitalArs: 0,
            slowStockSkuCount: 0,
            activeStockCapitalArs: 0,
            activeStockSkuCount: 0,
            totalCatalogCapitalArs: 0,
            totalCatalogCapitalUsd: 0,
            deadStockPercentage: 0,
            exchangeRate: 1250,
          },
          items: [],
        },
      };
    }

    const supabase = getServiceSupabase();

    let exchangeRate = 1250;
    try {
      const rateRes = await getCurrentRate();
      if (rateRes.success && rateRes.data?.value_ars && rateRes.data.value_ars > 0) {
        exchangeRate = rateRes.data.value_ars;
      }
    } catch (rateErr) {
      console.warn('[DEAD_STOCK_RATE_WARN]', rateErr);
    }

    // 1. Consultar productos con stock > 0 excluyendo insumos
    const { data: productsData, error: prodErr } = await supabase
      .from('products')
      .select('id, name, brand, sku, type, stock_quantity, base_cost_ars, base_price_ars, created_at')
      .gt('stock_quantity', 0)
      .neq('type', 'supply');

    if (prodErr) throw prodErr;

    const products = productsData || [];
    if (products.length === 0) {
      return {
        success: true,
        data: {
          summary: {
            deadStockCapitalArs: 0,
            deadStockCapitalUsd: 0,
            deadStockSkuCount: 0,
            slowStockCapitalArs: 0,
            slowStockSkuCount: 0,
            activeStockCapitalArs: 0,
            activeStockSkuCount: 0,
            totalCatalogCapitalArs: 0,
            totalCatalogCapitalUsd: 0,
            deadStockPercentage: 0,
            exchangeRate,
          },
          items: [],
        },
      };
    }

    const productIds = products.map((p) => p.id);

    // 2. Consultar fecha de última venta y última recepción de PO concurrentemente
    const [salesItemsRes, poItemsRes] = await Promise.all([
      supabase
        .from('sale_items')
        .select('product_id, sales ( id, created_at, status )')
        .in('product_id', productIds),
      supabase
        .from('purchase_order_items')
        .select('product_id, created_at')
        .in('product_id', productIds)
        .order('created_at', { ascending: false }),
    ]);

    // Mapa de última venta por producto
    const lastSaleMap = new Map<string, { date: Date; isoString: string }>();
    if (salesItemsRes.data) {
      salesItemsRes.data.forEach((row: any) => {
        const sale = Array.isArray(row.sales) ? row.sales[0] : row.sales;
        if (!sale || sale.status === 'voided' || sale.status === 'pending_payment') return;
        if (!sale.created_at) return;
        const d = new Date(sale.created_at);
        const curr = lastSaleMap.get(row.product_id);
        if (!curr || d > curr.date) {
          lastSaleMap.set(row.product_id, { date: d, isoString: sale.created_at });
        }
      });
    }

    // Mapa de última orden de compra / ingreso por producto
    const lastPoMap = new Map<string, { date: Date; isoString: string }>();
    if (poItemsRes.data) {
      poItemsRes.data.forEach((row: any) => {
        if (!row.product_id || !row.created_at || lastPoMap.has(row.product_id)) return;
        lastPoMap.set(row.product_id, { date: new Date(row.created_at), isoString: row.created_at });
      });
    }

    const now = new Date();
    const rateDecimal = new Decimal(exchangeRate);

    let deadStockCapitalArsDec = new Decimal(0);
    let deadStockSkuCount = 0;
    let slowStockCapitalArsDec = new Decimal(0);
    let slowStockSkuCount = 0;
    let activeStockCapitalArsDec = new Decimal(0);
    let activeStockSkuCount = 0;
    let totalCatalogCapitalArsDec = new Decimal(0);

    const items: DeadStockProduct[] = products.map((p) => {
      const stockQtyDec = new Decimal(p.stock_quantity || 0);
      const baseCostDec = new Decimal(p.base_cost_ars || 0);
      const capitalArsDec = stockQtyDec.times(baseCostDec);
      const capitalUsdDec = rateDecimal.greaterThan(0) ? capitalArsDec.dividedBy(rateDecimal) : new Decimal(0);

      totalCatalogCapitalArsDec = totalCatalogCapitalArsDec.plus(capitalArsDec);

      const lastSale = lastSaleMap.get(p.id);
      const lastPo = lastPoMap.get(p.id);
      const productCreated = new Date(p.created_at || now.toISOString());

      // Fecha de ingreso: la PO más reciente o el created_at del producto
      const entryDateObj = lastPo && lastPo.date > productCreated ? lastPo.date : productCreated;
      const entryDateIso = lastPo && lastPo.date > productCreated ? lastPo.isoString : p.created_at;

      // Última actividad: venta más reciente o fecha de ingreso si es posterior a la venta
      const lastActivityDate = lastSale
        ? (entryDateObj > lastSale.date ? entryDateObj : lastSale.date)
        : entryDateObj;

      const diffMs = Math.max(0, now.getTime() - lastActivityDate.getTime());
      const daysWithoutSale = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      let zone: RotationZone = 'active';
      if (daysWithoutSale > 60) {
        zone = 'dead_stock';
        deadStockCapitalArsDec = deadStockCapitalArsDec.plus(capitalArsDec);
        deadStockSkuCount++;
      } else if (daysWithoutSale >= 30) {
        zone = 'slow';
        slowStockCapitalArsDec = slowStockCapitalArsDec.plus(capitalArsDec);
        slowStockSkuCount++;
      } else {
        zone = 'active';
        activeStockCapitalArsDec = activeStockCapitalArsDec.plus(capitalArsDec);
        activeStockSkuCount++;
      }

      return {
        id: p.id,
        name: p.name,
        brand: p.brand || 'Sin Marca',
        sku: p.sku || 'N/A',
        type: (p.type === 'decant_liquid' ? 'decant_liquid' : 'bottle') as 'bottle' | 'decant_liquid',
        stockQuantity: Number(p.stock_quantity || 0),
        baseCostArs: Math.round(baseCostDec.toNumber()),
        basePriceArs: Number(p.base_price_ars || 0),
        capitalHundidoArs: Math.round(capitalArsDec.toNumber()),
        capitalHundidoUsd: Math.round(capitalUsdDec.toNumber()),
        daysWithoutSale,
        lastSaleDate: lastSale?.isoString || null,
        entryDate: entryDateIso,
        zone,
      };
    });

    // Ordenar: primero Dead Stock (>60d) por mayor capital hundido, luego Lentos, luego Activos
    items.sort((a, b) => {
      const zonePriority = { dead_stock: 3, slow: 2, active: 1 };
      if (zonePriority[b.zone] !== zonePriority[a.zone]) {
        return zonePriority[b.zone] - zonePriority[a.zone];
      }
      return b.capitalHundidoArs - a.capitalHundidoArs;
    });

    const deadStockCapitalArs = Math.round(deadStockCapitalArsDec.toNumber());
    const deadStockCapitalUsd = Math.round(rateDecimal.greaterThan(0) ? deadStockCapitalArsDec.dividedBy(rateDecimal).toNumber() : 0);
    const slowStockCapitalArs = Math.round(slowStockCapitalArsDec.toNumber());
    const slowStockSkuCountVal = slowStockSkuCount;
    const activeStockCapitalArs = Math.round(activeStockCapitalArsDec.toNumber());
    const totalCatalogCapitalArs = Math.round(totalCatalogCapitalArsDec.toNumber());
    const totalCatalogCapitalUsd = Math.round(rateDecimal.greaterThan(0) ? totalCatalogCapitalArsDec.dividedBy(rateDecimal).toNumber() : 0);

    const deadStockPercentage = totalCatalogCapitalArs > 0
      ? Number(new Decimal(deadStockCapitalArs).dividedBy(totalCatalogCapitalArs).times(100).toFixed(1))
      : 0;

    return {
      success: true,
      data: {
        summary: {
          deadStockCapitalArs,
          deadStockCapitalUsd,
          deadStockSkuCount,
          slowStockCapitalArs,
          slowStockSkuCount: slowStockSkuCountVal,
          activeStockCapitalArs,
          activeStockSkuCount,
          totalCatalogCapitalArs,
          totalCatalogCapitalUsd,
          deadStockPercentage,
          exchangeRate,
        },
        items,
      },
    };
  } catch (error: unknown) {
    console.error('Error al analizar Dead Stock y envejecimiento de inventario:', error);
    const msg = error instanceof Error ? error.message : 'Error al analizar Dead Stock';
    return { success: false, error: msg };
  }
}

// ============================================================================
// 5. RATIO DE RENDIMIENTO DE FRACCIONAMIENTO (BOM MULTIPLIER)
// ============================================================================

/**
 * Calcula el rendimiento económico y multiplicador del fraccionamiento para decants:
 * Compara los ingresos reales generados por decants vendidos contra lo que se habría
 * obtenido vendiendo la botella sellada equivalente.
 */
export async function getDecantYieldReport(
  role: UserRole
): Promise<{ success: boolean; data?: DecantYieldReport; error?: string }> {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured()) {
      return {
        success: true,
        data: {
          items: [],
          summary: {
            totalDecantsTracked: 0,
            totalMlSold: 0,
            totalDecantRevenueArs: 0,
            totalBottleEquivalentArs: 0,
            totalExtraRevenueArs: 0,
            avgYieldMultiplier: 0,
          },
        },
      };
    }

    const supabase = getServiceSupabase();

    // 1. Consultar productos decant_liquid, productos bottle y logs de fraccionamiento
    const [decantsRes, bottlesRes, fracLogsRes] = await Promise.all([
      supabase
        .from('products')
        .select('id, name, brand, sku, stock_quantity, base_cost_ars, base_price_ars, volume_ml')
        .eq('type', 'decant_liquid'),
      supabase
        .from('products')
        .select('id, name, brand, sku, stock_quantity, base_cost_ars, base_price_ars, volume_ml')
        .eq('type', 'bottle'),
      supabase
        .from('fractionation_logs')
        .select('target_liquid_id, source_bottle_id, volume_ml, cost_transferred_ars, cost_per_ml_calculated')
        .order('created_at', { ascending: false }),
    ]);

    if (decantsRes.error) throw decantsRes.error;
    if (bottlesRes.error) throw bottlesRes.error;

    const decants = decantsRes.data || [];
    const bottles = bottlesRes.data || [];
    const fracLogs = fracLogsRes.data || [];

    if (decants.length === 0) {
      return {
        success: true,
        data: {
          items: [],
          summary: {
            totalDecantsTracked: 0,
            totalMlSold: 0,
            totalDecantRevenueArs: 0,
            totalBottleEquivalentArs: 0,
            totalExtraRevenueArs: 0,
            avgYieldMultiplier: 0,
          },
        },
      };
    }

    // Mapa de botellas por ID
    const bottleMap = new Map<string, typeof bottles[0]>();
    bottles.forEach((b) => bottleMap.set(b.id, b));

    // Mapa de decant_id -> source_bottle_id (desde logs de fraccionamiento)
    const decantToBottleIdMap = new Map<string, string>();
    fracLogs.forEach((log) => {
      if (log.target_liquid_id && log.source_bottle_id && !decantToBottleIdMap.has(log.target_liquid_id)) {
        decantToBottleIdMap.set(log.target_liquid_id, log.source_bottle_id);
      }
    });

    const decantIds = decants.map((d) => d.id);

    // 2. Consultar ventas históricas de decants
    const { data: saleItemsData, error: siErr } = await supabase
      .from('sale_items')
      .select('product_id, quantity, price_ars_at_moment, unit_cost_at_moment, sales(status)')
      .in('product_id', decantIds);

    if (siErr) throw siErr;

    // Agrupación de ventas por decant_id
    const salesAggMap = new Map<string, { totalRevenue: Decimal; totalMlSold: Decimal; unitsCount: number }>();
    (saleItemsData || []).forEach((row: any) => {
      const sale = Array.isArray(row.sales) ? row.sales[0] : row.sales;
      if (sale && (sale.status === 'voided' || sale.status === 'pending_payment')) return;

      const pid = row.product_id;
      const qty = new Decimal(row.quantity || 1);
      const price = new Decimal(row.price_ars_at_moment || 0);
      const revenue = qty.times(price);
      // Para decant_liquid, el volumen vendido por unidad es típicamente 5ml (o decant_ml si está registrado)
      const mlPerUnit = Number(row.decant_ml || 5);
      const mlSold = qty.times(mlPerUnit);

      let agg = salesAggMap.get(pid);
      if (!agg) {
        agg = { totalRevenue: new Decimal(0), totalMlSold: new Decimal(0), unitsCount: 0 };
        salesAggMap.set(pid, agg);
      }
      agg.totalRevenue = agg.totalRevenue.plus(revenue);
      agg.totalMlSold = agg.totalMlSold.plus(mlSold);
      agg.unitsCount += qty.toNumber();
    });

    let sumDecantRevenue = new Decimal(0);
    let sumBottleEquivalent = new Decimal(0);
    let sumMlSold = new Decimal(0);

    const items: DecantYieldItem[] = decants.map((decant) => {
      // 1. Encontrar botella cerrada contraparte
      let bottle = null as typeof bottles[0] | null;
      const linkedBottleId = decantToBottleIdMap.get(decant.id);
      if (linkedBottleId && bottleMap.has(linkedBottleId)) {
        bottle = bottleMap.get(linkedBottleId)!;
      } else {
        // Fallback por marca y nombre coincidente
        bottle = bottles.find((b) => {
          if (b.brand?.toLowerCase() !== decant.brand?.toLowerCase()) return false;
          const cleanDecantName = decant.name.toLowerCase().replace(/decant|granel|muestra|ml/gi, '').trim();
          const cleanBottleName = b.name.toLowerCase().trim();
          return cleanBottleName.includes(cleanDecantName) || cleanDecantName.includes(cleanBottleName);
        }) || null;
      }

      const bottleVolumeMl = Number(bottle?.volume_ml || 100);
      const bottlePriceArs = Number(bottle?.base_price_ars || 0);
      const bottlePricePerMlDec = bottlePriceArs > 0 && bottleVolumeMl > 0
        ? new Decimal(bottlePriceArs).dividedBy(bottleVolumeMl)
        : (decant.base_cost_ars ? new Decimal(decant.base_cost_ars).times(1.6) : new Decimal(500));

      const bottlePricePerMlArs = Number(bottlePricePerMlDec.toFixed(2));

      // Ventas históricas
      const salesAgg = salesAggMap.get(decant.id) || {
        totalRevenue: new Decimal(0),
        totalMlSold: new Decimal(0),
        unitsCount: 0,
      };

      const totalMlSoldVal = salesAgg.totalMlSold.toNumber();
      const totalRevenueVal = Math.round(salesAgg.totalRevenue.toNumber());
      const hasSales = totalRevenueVal > 0;

      // Facturación equivalente si los ml vendidos se hubieran vendido en botellas
      const equivBottleRevenueDec = salesAgg.totalMlSold.times(bottlePricePerMlDec);
      const equivalentBottleRevenueArs = Math.round(equivBottleRevenueDec.toNumber());

      // Multiplicador Real de Fraccionamiento
      let yieldMultiplier = 0;
      if (hasSales && equivBottleRevenueDec.greaterThan(0)) {
        yieldMultiplier = Number(salesAgg.totalRevenue.dividedBy(equivBottleRevenueDec).toFixed(2));
      }

      // Multiplicador Teórico / Potencial (Precio/ml decant vs Precio/ml botella)
      const decantPricePerMl = new Decimal(decant.base_price_ars || 0);
      let potentialMultiplier = 2.0;
      if (bottlePricePerMlDec.greaterThan(0) && decantPricePerMl.greaterThan(0)) {
        potentialMultiplier = Number(decantPricePerMl.dividedBy(bottlePricePerMlDec).toFixed(2));
      }

      // Si no hubo ventas, el multiplier a mostrar es el potencial estimado
      const effectiveMultiplier = yieldMultiplier > 0 ? yieldMultiplier : potentialMultiplier;

      const extraRevenueArs = hasSales
        ? Math.max(0, totalRevenueVal - equivalentBottleRevenueArs)
        : 0;

      if (hasSales) {
        sumDecantRevenue = sumDecantRevenue.plus(salesAgg.totalRevenue);
        sumBottleEquivalent = sumBottleEquivalent.plus(equivBottleRevenueDec);
        sumMlSold = sumMlSold.plus(salesAgg.totalMlSold);
      }

      return {
        id: decant.id,
        name: decant.name,
        brand: decant.brand || 'Sin Marca',
        sku: decant.sku || 'N/A',
        stockMl: Number(decant.stock_quantity || 0),
        decantPricePerMlArs: Number(decant.base_price_ars || 0),
        totalMlSold: Math.round(totalMlSoldVal),
        totalRevenueArs: totalRevenueVal,
        bottleId: bottle?.id || null,
        bottleName: bottle?.name || null,
        bottlePriceArs,
        bottleVolumeMl,
        bottlePricePerMlArs,
        equivalentBottleRevenueArs,
        yieldMultiplier: effectiveMultiplier,
        potentialMultiplier,
        extraRevenueArs,
        hasSales,
      };
    });

    // Ordenar por facturación decant desc, luego por yieldMultiplier desc
    items.sort((a, b) => b.totalRevenueArs - a.totalRevenueArs || b.yieldMultiplier - a.yieldMultiplier);

    const totalDecantRevenueArs = Math.round(sumDecantRevenue.toNumber());
    const totalBottleEquivalentArs = Math.round(sumBottleEquivalent.toNumber());
    const totalExtraRevenueArs = Math.round(sumDecantRevenue.minus(sumBottleEquivalent).toNumber());
    const avgYieldMultiplier = sumBottleEquivalent.greaterThan(0)
      ? Number(sumDecantRevenue.dividedBy(sumBottleEquivalent).toFixed(2))
      : (items.length > 0 ? Number((items.reduce((s, i) => s + i.potentialMultiplier, 0) / items.length).toFixed(2)) : 2.0);

    return {
      success: true,
      data: {
        items,
        summary: {
          totalDecantsTracked: items.length,
          totalMlSold: Math.round(sumMlSold.toNumber()),
          totalDecantRevenueArs,
          totalBottleEquivalentArs,
          totalExtraRevenueArs: Math.max(0, totalExtraRevenueArs),
          avgYieldMultiplier,
        },
      },
    };
  } catch (error: unknown) {
    console.error('Error al generar reporte de rendimiento de fraccionamiento:', error);
    const msg = error instanceof Error ? error.message : 'Error al calcular rendimiento de fraccionamiento';
    return { success: false, error: msg };
  }
}
