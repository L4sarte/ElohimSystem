'use server';

import { getServiceSupabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth-checks';
import { getCurrentRate } from '@/app/actions/rates';
import { resolveBusinessRange } from '@/lib/date-utils';
import Decimal from 'decimal.js';

export interface InventoryValuationMetrics {
  capitalInvertido: number;
  valorBrutoVenta: number;
  gananciaNetaPotencial: number;
  capitalInvertidoUsd: number;
  valorBrutoVentaUsd: number;
  gananciaNetaPotencialUsd: number;
  totalUnitsInStock: number;
  totalProductsCount: number;
  potentialProfitMarginPercent: number;
  potentialMarkupPercent: number;
}

export interface InventoryValuationResponse {
  success: boolean;
  data: InventoryValuationMetrics;
  error?: string;
}

const DEFAULT_METRICS: InventoryValuationMetrics = {
  capitalInvertido: 0,
  valorBrutoVenta: 0,
  gananciaNetaPotencial: 0,
  capitalInvertidoUsd: 0,
  valorBrutoVentaUsd: 0,
  gananciaNetaPotencialUsd: 0,
  totalUnitsInStock: 0,
  totalProductsCount: 0,
  potentialProfitMarginPercent: 0,
  potentialMarkupPercent: 0
};

/**
 * Obtener la valoración financiera del inventario activo y la proyección de ganancia potencial.
 * Garantiza que NUNCA lance una excepción no capturada y devuelva siempre data estructurada con ceros como fallback.
 */
export async function getInventoryValuation(): Promise<InventoryValuationResponse> {
  try {
    // Seguridad: expone costos de inventario (capital invertido) — solo Administradores, rol de la sesión
    await requireAdmin();

    const supabase = getServiceSupabase();
    let exchangeRate = 1000;
    
    try {
      const rateRes = await getCurrentRate();
      if (rateRes.data?.value_ars && rateRes.data.value_ars > 0) {
        exchangeRate = rateRes.data.value_ars;
      }
    } catch (rateErr) {
      console.warn('[INVENTORY_VALUATION_WARN] Error al consultar tasa cambiaria, usando fallback 1000:', rateErr);
    }

    // Consultar productos inventariables con stock mayor a 0, excluyendo packaging (type = 'supply')
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .gt('stock_quantity', 0)
      .neq('type', 'supply');

    if (error) {
      console.error('[INVENTORY_VALUATION_ERROR]', error);
      return {
        success: false,
        data: DEFAULT_METRICS,
        error: error.message
      };
    }

    // Consultar recetas de productos para soportar valuación dinámica multi-medida
    const { data: recipesData } = await supabase
      .from('product_recipes')
      .select(`
        id,
        product_id,
        name,
        recipe_items (
          component_type,
          quantity
        )
      `);

    const recipeMap = new Map<string, { size_ml: number }>();
    if (recipesData) {
      recipesData.forEach((rec: any) => {
        const liquidItem = rec.recipe_items?.find((it: any) => it.component_type === 'liquid');
        const sizeMl = Number(rec.size_ml || liquidItem?.quantity || 5);
        if (sizeMl > 0) {
          recipeMap.set(rec.product_id, { size_ml: sizeMl });
        }
      });
    }

    let capitalCostArs = 0;
    let capitalCostUsd = 0;
    let potentialRevenueArs = 0;
    let potentialRevenueUsd = 0;
    let totalUnidades = 0;
    const totalSKUs = (products || []).length;

    (products || []).forEach((item: any) => {
      // Safe Math Parsing con conversión forzada a número y fallback a 0
      const stock = Number(item.stock_quantity) || 0;
      if (stock <= 0) return;

      const priceArs = Number(item.base_price_ars ?? item.price_ars) || 0;
      const costArs = Number(item.base_cost_ars ?? item.cost_ars) || 0;

      if (item.type === 'decant_liquid') {
        // 1. Modelo de Costo por Mililitro en Granel:
        // base_cost_ars representa estrictamente el costo por 1 ml (Costo Botella / Volumen Botella)
        const capitalItemArs = stock * costArs;
        const capitalItemUsd = exchangeRate > 0 && capitalItemArs > 0 ? capitalItemArs / exchangeRate : 0;

        // 2. Valuación Canónica de Venta por Mililitro:
        // base_price_ars en 'decant_liquid' representa estrictamente el precio de venta por 1 ml
        const recipe = recipeMap.get(item.id);
        const presentationMl = recipe && recipe.size_ml > 0 ? recipe.size_ml : 5;
        const revenuePerMl = priceArs;
        const revenueItemArs = stock * revenuePerMl;
        const revenueItemUsd = exchangeRate > 0 && revenueItemArs > 0 ? revenueItemArs / exchangeRate : 0;

        capitalCostArs += capitalItemArs;
        capitalCostUsd += capitalItemUsd;
        potentialRevenueArs += revenueItemArs;
        potentialRevenueUsd += revenueItemUsd;
        totalUnidades += Math.floor(stock / presentationMl);
      } else {
        // Perfumes Sellados (bottle)
        const costUsd = Number(item.cost_usd) || (exchangeRate > 0 && costArs > 0 ? costArs / exchangeRate : 0);
        const priceUsd = Number(item.base_price_usd ?? item.price_usd) || (exchangeRate > 0 && priceArs > 0 ? priceArs / exchangeRate : 0);

        capitalCostArs += stock * costArs;
        capitalCostUsd += stock * costUsd;
        potentialRevenueArs += stock * priceArs;
        potentialRevenueUsd += stock * priceUsd;
        totalUnidades += stock;
      }
    });

    const potentialNetProfitArs = Math.max(0, potentialRevenueArs - capitalCostArs);
    const potentialNetProfitUsd = Math.max(0, potentialRevenueUsd - capitalCostUsd);
    const potentialProfitMarginPercent = potentialRevenueArs > 0
      ? Number(((potentialNetProfitArs / potentialRevenueArs) * 100).toFixed(1))
      : 0;
    const potentialMarkupPercent = capitalCostArs > 0
      ? Number(((potentialNetProfitArs / capitalCostArs) * 100).toFixed(1))
      : 0;

    return {
      success: true,
      data: {
        capitalInvertido: Math.round(capitalCostArs),
        valorBrutoVenta: Math.round(potentialRevenueArs),
        gananciaNetaPotencial: Math.round(potentialNetProfitArs),
        capitalInvertidoUsd: Math.round(capitalCostUsd),
        valorBrutoVentaUsd: Math.round(potentialRevenueUsd),
        gananciaNetaPotencialUsd: Math.round(potentialNetProfitUsd),
        totalUnitsInStock: totalUnidades,
        totalProductsCount: totalSKUs,
        potentialProfitMarginPercent,
        potentialMarkupPercent
      }
    };
  } catch (err: any) {
    console.error('[INVENTORY_VALUATION_ERROR]', err);
    return {
      success: false,
      data: DEFAULT_METRICS,
      error: err.message || 'Error inesperado al calcular la valoración del inventario'
    };
  }
}

// ============================================================================
// DÍAS DE COBERTURA DE STOCK (RUNWAY DE INVENTARIO)
// ============================================================================

export type RunwayUrgency = 'critico' | 'reorden' | 'optimo' | 'agotado' | 'sin_ventas';

export interface StockRunwayProduct {
  productId: string;
  productName: string;
  brand: string;
  sku: string;
  type: string;
  currentStock: number;
  unitsSoldLast30Days: number;
  dailyVelocity: number;
  coverageDays: number;
  urgency: RunwayUrgency;
}

export interface StockRunwayAnalysis {
  byProductId: Record<string, StockRunwayProduct>;
  criticalCount: number;
  reorderCount: number;
  optimalCount: number;
  itemsNeedingReorder: StockRunwayProduct[];
}

/**
 * Calcula la velocidad de venta diaria por producto (últimos 30 días / 30)
 * y los días de cobertura de stock restantes (stock actual / velocidad diaria).
 * Urgencia:
 * - Crítico: < 10 días de stock
 * - Reorden: 10 a 25 días
 * - Óptimo: > 25 días
 */
export async function getStockRunwayAnalysis(): Promise<{
  success: boolean;
  data?: StockRunwayAnalysis;
  error?: string;
}> {
  try {
    await requireAdmin();

    const supabase = getServiceSupabase();

    // Ventana rodante de 30 días
    const businessRange = resolveBusinessRange('last_30_days');
    const isoStart = businessRange.start.toISOString();

    // 1. Consultar todos los productos y ventas de los últimos 30 días en paralelo
    const [productsRes, salesRes] = await Promise.all([
      supabase
        .from('products')
        .select('id, name, brand, sku, type, stock_quantity')
        .order('name', { ascending: true }),
      supabase
        .from('sales')
        .select('id')
        .gte('created_at', isoStart)
        .neq('status', 'voided')
        .neq('status', 'pending_payment'),
    ]);

    if (productsRes.error) throw productsRes.error;
    if (salesRes.error) throw salesRes.error;

    const products = productsRes.data || [];
    const saleIds = (salesRes.data || []).map((s) => s.id);

    // 2. Consultar unidades vendidas por producto
    const unitsSoldMap = new Map<string, Decimal>();
    if (saleIds.length > 0) {
      const { data: itemsData, error: itemsErr } = await supabase
        .from('sale_items')
        .select('product_id, quantity')
        .in('sale_id', saleIds);

      if (itemsErr) throw itemsErr;

      (itemsData || []).forEach((row) => {
        if (!row.product_id) return;
        const qty = new Decimal(row.quantity || 1);
        const curr = unitsSoldMap.get(row.product_id) || new Decimal(0);
        unitsSoldMap.set(row.product_id, curr.plus(qty));
      });
    }

    const byProductId: Record<string, StockRunwayProduct> = {};
    let criticalCount = 0;
    let reorderCount = 0;
    let optimalCount = 0;
    const itemsNeedingReorder: StockRunwayProduct[] = [];

    products.forEach((p) => {
      const stockDec = new Decimal(p.stock_quantity || 0);
      const unitsSoldDec = unitsSoldMap.get(p.id) || new Decimal(0);
      const dailyVelocityDec = unitsSoldDec.dividedBy(30);
      const dailyVelocity = Number(dailyVelocityDec.toFixed(2));
      const unitsSoldLast30Days = Math.round(unitsSoldDec.toNumber());
      const stock = Number(p.stock_quantity || 0);

      let coverageDays = 999;
      let urgency: RunwayUrgency = 'optimo';

      if (stock <= 0) {
        coverageDays = 0;
        urgency = 'agotado';
      } else if (dailyVelocityDec.greaterThan(0)) {
        coverageDays = Math.round(stockDec.dividedBy(dailyVelocityDec).toNumber());
        if (coverageDays < 10) {
          urgency = 'critico';
          criticalCount++;
        } else if (coverageDays <= 25) {
          urgency = 'reorden';
          reorderCount++;
        } else {
          urgency = 'optimo';
          optimalCount++;
        }
      } else {
        // Stock disponible pero sin ventas en los últimos 30 días
        coverageDays = 999;
        urgency = 'sin_ventas';
        optimalCount++;
      }

      const item: StockRunwayProduct = {
        productId: p.id,
        productName: p.name,
        brand: p.brand || 'Sin Marca',
        sku: p.sku || 'N/A',
        type: p.type || 'bottle',
        currentStock: stock,
        unitsSoldLast30Days,
        dailyVelocity,
        coverageDays,
        urgency,
      };

      byProductId[p.id] = item;

      if (urgency === 'critico' || urgency === 'reorden' || urgency === 'agotado') {
        itemsNeedingReorder.push(item);
      }
    });

    // Ordenar los ítems que requieren reorden por menor cobertura de días
    itemsNeedingReorder.sort((a, b) => a.coverageDays - b.coverageDays);

    return {
      success: true,
      data: {
        byProductId,
        criticalCount,
        reorderCount,
        optimalCount,
        itemsNeedingReorder,
      },
    };
  } catch (err: unknown) {
    console.error('[STOCK_RUNWAY_ERROR]', err);
    const msg = err instanceof Error ? err.message : 'Error al calcular runway de inventario';
    return {
      success: false,
      error: msg,
    };
  }
}

