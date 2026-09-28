'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserRole } from '@/types';
import { requireAdmin } from '@/lib/auth-checks';
import { resolveItemUnitCost } from '@/lib/financial-calculations';
import { buildRecipeFallbackMap } from '@/lib/recipe-fallback';
import { resolveBusinessRange, businessNow, toBusinessInstant, businessDayKey } from '@/lib/date-utils';
import Decimal from 'decimal.js';

export interface AuditLogRecord {
  id: string;
  action: string;
  details: string | Record<string, unknown>;
  created_at: string;
  created_by?: string;
  products?: {
    name: string;
    brand: string;
    sku: string;
  } | null;
}

/**
 * Obtener todos los logs de auditoría (Exclusivo Administrador).
 */
export async function getAuditLogs(role?: UserRole): Promise<{
  success: boolean;
  data?: AuditLogRecord[];
  total?: number;
  error?: string;
}> {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured()) {
      return { success: true, data: [], total: 0 };
    }

    const supabase = getServiceSupabase();
    
    const { data, error, count } = await supabase
      .from('audit_logs')
      .select(`
        id,
        action,
        details,
        created_at,
        created_by,
        products (
          name,
          brand,
          sku
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    return { success: true, data: (data || []) as unknown as AuditLogRecord[], total: count ?? 0 };
  } catch (error: unknown) {
    console.error('Error al obtener logs de auditoría:', error);
    const msg = error instanceof Error ? error.message : 'Error al obtener logs de auditoría';
    return { success: false, error: msg };
  }
}

export interface CriticalStockItem {
  id: string;
  name: string;
  brand: string;
  sku: string;
  type: string;
  stock_quantity: number;
}

export interface RecentSaleItem {
  id: string;
  created_at: string;
  total_ars: number;
  client_name: string;
}

export interface DashboardData {
  period: 'current_month' | 'all_time';
  totalRevenueArs: number;
  totalRevenueUsd: number;
  grossMarginArs: number;
  grossMarginPercent: number;
  opexArs: number;
  estimatedProfitArs: number; // Ganancia Neta Real (Margen Bruto - OPEX - Comisiones)
  estimatedProfitUsd: number;
  performanceWarning?: string | null;
  salesByDate: Array<{
    date: string;
    Ventas: number;
    Ganancias: number; // Ganancia Comercial Real (número actual intacto)
    GananciaReal?: number;
    GananciaNeta?: number;
    VentasMesAnterior: number;
  }>;
  criticalStock: CriticalStockItem[];
  recentSales: RecentSaleItem[];
}

interface DbSaleRow {
  id: string;
  total_ars: number;
  subtotal_ars?: number | null;
  discount_amount_ars?: number | null;
  total_usd_equivalent: number;
  exchange_rate_used: number;
  created_at: string;
  status: string;
  gateway_fee_ars?: number | null;
  clients?: {
    name: string;
  } | null;
}

interface DbSaleItemRow {
  sale_id: string;
  product_id: string;
  quantity: number;
  price_ars_at_moment: number;
  price_usd_at_moment: number;
  unit_cost_at_moment?: number | null;
  products?: {
    id: string;
    name: string;
    type?: string | null;
    base_cost_ars?: number | null;
  } | null;
}

/**
 * Obtener todos los datos necesarios para el Dashboard Administrativo de Elohim Import ERP.
 * Admite filtro de período: 'current_month' (por defecto) o 'all_time'.
 * Deduce con exactitud COGS (incluyendo decants y envases), descuentos, comisiones y OPEX.
 */
export async function getDashboardData(
  role?: UserRole,
  period: 'current_month' | 'all_time' = 'current_month'
): Promise<{
  success: boolean;
  data?: DashboardData;
  error?: string;
}> {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured()) {
      return {
        success: true,
        data: {
          period,
          totalRevenueArs: 0,
          totalRevenueUsd: 0,
          grossMarginArs: 0,
          grossMarginPercent: 0,
          opexArs: 0,
          estimatedProfitArs: 0,
          estimatedProfitUsd: 0,
          salesByDate: [],
          criticalStock: [],
          recentSales: [],
        },
      };
    }

    const supabase = getServiceSupabase();

    // Rangos de negocio ART (zona horaria comercial) — consistentes en todo el sistema
    const businessRange = resolveBusinessRange('current_month');
    const startOfMonth = businessRange.start.toISOString();
    const endOfMonth = businessRange.end.toISOString();
    const dateStartString = businessRange.startDay;
    const dateEndString = businessRange.endDay;

    // Fechas para cálculo histórico real del mes anterior (mismo día relativo)
    const prevMonthRange = resolveBusinessRange('previous_month');
    const startOfPrevMonth = prevMonthRange.start.toISOString();
    const endOfPrevMonth = prevMonthRange.end.toISOString();

    // Advertencia de rendimiento: el modo all_time agrega TODO el historial sin filtro de fechas
    // (sin LIMIT deliberadamente: truncar rompería las SUMAS exactas de métricas)
    let performanceWarning: string | null = null;
    if (period === 'all_time') {
      performanceWarning = 'El modo "Todo el historial" agrega todas las ventas sin filtro de fechas: puede demorar con alto volumen.';
      console.warn('[DASHBOARD_PERF_WARN]:', performanceWarning);
    }

    // 1. Obtener ventas activas según el período seleccionado
    let salesQuery = supabase
      .from('sales')
      .select('id, total_ars, subtotal_ars, discount_amount_ars, total_usd_equivalent, exchange_rate_used, created_at, status, gateway_fee_ars')
      .neq('status', 'voided')
      .neq('status', 'pending_payment')
      .order('created_at', { ascending: true });

    if (period === 'current_month') {
      salesQuery = salesQuery.gte('created_at', startOfMonth).lte('created_at', endOfMonth);
    }

    // Consultas concurrentes: Ventas del período, Ventas del mes anterior (para comparativa real) y Gastos OPEX
    const [salesRes, prevSalesRes, expensesRes] = await Promise.all([
      salesQuery,
      supabase
        .from('sales')
        .select('total_ars, created_at')
        .neq('status', 'voided')
        .neq('status', 'pending_payment')
        .gte('created_at', startOfPrevMonth)
        .lte('created_at', endOfPrevMonth),
      period === 'current_month'
        ? supabase
            .from('operating_expenses')
            .select('amount_ars, expense_date')
            .gte('expense_date', dateStartString)
            .lte('expense_date', dateEndString)
        : supabase
            .from('operating_expenses')
            .select('amount_ars, expense_date'),
    ]);

    if (salesRes.error) throw salesRes.error;

    const sales = (salesRes.data || []) as unknown as DbSaleRow[];
    const prevSales = (prevSalesRes.data || []) as unknown as Array<{ total_ars: number; created_at: string }>;
    const expenses = (expensesRes.data || []) as unknown as Array<{ amount_ars: number; expense_date: string }>;

    const validSaleIds = sales.map((s) => s.id);

    // 2. Obtener los ítems de ventas activas con costo para rentabilidad
    let saleItems: DbSaleItemRow[] = [];
    if (validSaleIds.length > 0) {
      let { data: itemsData, error: itemsError } = await supabase
        .from('sale_items')
        .select(`
          sale_id,
          product_id,
          quantity,
          price_ars_at_moment,
          price_usd_at_moment,
          unit_cost_at_moment,
          products (
            id,
            name,
            type,
            base_cost_ars
          )
        `)
        .in('sale_id', validSaleIds);

      if (itemsError && itemsError.message?.includes('unit_cost_at_moment')) {
        const fallbackRes = await supabase
          .from('sale_items')
          .select(`
            sale_id,
            quantity,
            price_ars_at_moment,
            price_usd_at_moment,
            products (
              id,
              name,
              type,
              base_cost_ars
            )
          `)
          .in('sale_id', validSaleIds);
        itemsData = fallbackRes.data as any;
        itemsError = fallbackRes.error;
      }

      if (itemsError) throw itemsError;
      saleItems = (itemsData || []) as unknown as DbSaleItemRow[];
    }

    // 3. Obtener alertas de stock crítico (< 3 botellas comerciales o frascos vacíos)
    const { data: stockData, error: stockError } = await supabase
      .from('products')
      .select('id, name, brand, sku, type, stock_quantity')
      .in('type', ['bottle', 'supply'])
      .lt('stock_quantity', 3)
      .order('stock_quantity', { ascending: true })
      .limit(5);

    if (stockError) throw stockError;
    const criticalStock = (stockData || []) as unknown as CriticalStockItem[];

    // 4. Obtener las últimas 5 ventas completadas
    const { data: recentData, error: recentError } = await supabase
      .from('sales')
      .select(`
        id,
        created_at,
        total_ars,
        status,
        clients (
          name
        )
      `)
      .neq('status', 'voided')
      .neq('status', 'pending_payment')
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentError) throw recentError;
    const recentSalesDb = (recentData || []) as unknown as DbSaleRow[];

    // --- Procesamiento canónico de métricas y COGS (misma cadena que el P&L) ---
    const saleCogsMap: Record<string, Decimal> = {};

    // Detectar productos que requieren fallbacks de costo (sin congelado ni de catálogo)
    const missingCostProductIds = new Set<string>();
    saleItems.forEach((item) => {
      const catCost = Number(item.products?.base_cost_ars || 0);
      const momentCost = Number(item.unit_cost_at_moment || 0);
      if (catCost <= 0 && momentCost <= 0 && item.product_id) {
        missingCostProductIds.add(item.product_id);
      }
    });

    // Fallback 4: último costo registrado en purchase_order_items
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

    // Fallback 5: recetas BOM (tamaño real de muestra + costo de insumos) — sin constantes hardcodeadas
    const recipeFallbackMap = await buildRecipeFallbackMap(missingCostProductIds);

    saleItems.forEach((item) => {
      const qty = new Decimal(item.quantity || 1);
      const recipeInfo = recipeFallbackMap[item.product_id];

      // Cadena canónica de resolución de costo unitario (idéntica a analytics.ts)
      const costResolution = resolveItemUnitCost({
        itemUnitCostAtMoment: item.unit_cost_at_moment,
        productBaseCostArs: item.products?.base_cost_ars,
        lastPurchaseOrderCostArs: poCostMap[item.product_id]?.toNumber(),
        productType: item.products?.type,
        decantMl: recipeInfo?.sizeMl ?? null,
        supplyCostArs: recipeInfo?.supplyCostArs ?? null,
      });

      const itemCost = new Decimal(costResolution.unitCost).times(qty);

      if (!saleCogsMap[item.sale_id]) {
        saleCogsMap[item.sale_id] = new Decimal(0);
      }
      saleCogsMap[item.sale_id] = saleCogsMap[item.sale_id].plus(itemCost);
    });

    let totalRevenueArs = 0;
    let totalRevenueUsd = 0;
    let totalCogsArs = 0;
    let totalGatewayFees = 0;
    const saleProfitMap: Record<string, number> = {};

    sales.forEach((sale) => {
      const saleTotal = Number(sale.total_ars || 0);
      const saleCogs = (saleCogsMap[sale.id] || new Decimal(0)).toNumber();
      const saleFee = Number(sale.gateway_fee_ars || 0);

      // Margen Bruto de la Venta SIN clamp: las pérdidas individuales son reales (coincidir con el P&L)
      const saleGrossMargin = saleTotal - saleCogs;

      totalRevenueArs += saleTotal;
      totalRevenueUsd += Number(sale.total_usd_equivalent || 0);
      totalCogsArs += saleCogs;
      totalGatewayFees += saleFee;

      saleProfitMap[sale.id] = saleGrossMargin;
    });

    const totalOpexArs = expenses.reduce((sum, e) => sum + Number(e.amount_ars || 0), 0);
    const grossMarginArs = totalRevenueArs - totalCogsArs;
    const estimatedProfitArs = Math.round(grossMarginArs - totalOpexArs - totalGatewayFees);

    const grossMarginPercent = totalRevenueArs > 0
      ? Number(((grossMarginArs / totalRevenueArs) * 100).toFixed(1))
      : 0;

    const estimatedProfitUsd = totalRevenueUsd * (totalRevenueArs > 0 ? (estimatedProfitArs / totalRevenueArs) : 0);

    // Mapeo de ventas reales del mes anterior por día para comparativa histórica exacta (días de negocio ART)
    const prevMonthSalesByDay: Record<number, number> = {};
    prevSales.forEach((ps) => {
      const pDate = toBusinessInstant(ps.created_at);
      const dayNum = pDate ? pDate.getUTCDate() : 0;
      if (dayNum > 0) {
        prevMonthSalesByDay[dayNum] = (prevMonthSalesByDay[dayNum] || 0) + Number(ps.total_ars || 0);
      }
    });

    // Mapear gastos operativos (OPEX) por día (claves de día de negocio ART)
    const dailyOpexMap: Record<string, number> = {};
    expenses.forEach((e) => {
      if (e.expense_date) {
        const dateStr = businessDayKey(e.expense_date);
        dailyOpexMap[dateStr] = (dailyOpexMap[dateStr] || 0) + Number(e.amount_ars || 0);
      }
    });

    // Agrupar ventas para gráfico (claves de día de negocio ART)
    const salesGrouped: Record<string, { total: number; profit: number; fees: number; dayNum: number }> = {};
    sales.forEach((sale) => {
      const sDate = toBusinessInstant(sale.created_at);
      const dayNum = sDate ? sDate.getUTCDate() : 0;
      const monthNum = sDate ? sDate.getUTCMonth() + 1 : 0;
      const dateStr = `${String(dayNum).padStart(2, '0')}/${String(monthNum).padStart(2, '0')}`;
      const saleGross = saleProfitMap[sale.id] || 0;
      const saleFee = Number(sale.gateway_fee_ars || 0);

      if (!salesGrouped[dateStr]) {
        salesGrouped[dateStr] = { total: 0, profit: 0, fees: 0, dayNum };
      }
      salesGrouped[dateStr].total += Number(sale.total_ars || 0);
      salesGrouped[dateStr].profit += saleGross;
      salesGrouped[dateStr].fees += saleFee;
    });

    // Generar serie temporal continua para no distorsionar el eje X con fechas salteadas
    let salesByDate: Array<{
      date: string;
      Ventas: number;
      Ganancias: number;
      GananciaReal?: number;
      GananciaNeta?: number;
      VentasMesAnterior: number;
    }> = [];

    if (period === 'current_month') {
      // Límite del eje X según el día ACTUAL de negocio (ART)
      const nowB = businessNow();
      const currentDayLimit = Math.max(1, nowB.getUTCDate());
      const currentMonthStr = String(nowB.getUTCMonth() + 1).padStart(2, '0');

      for (let day = 1; day <= currentDayLimit; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateKey = `${dayStr}/${currentMonthStr}`;
        const group = salesGrouped[dateKey];
        const currentTotal = group ? Math.round(group.total) : 0;
        const currentProfit = group ? Math.round(group.profit) : 0; // Ganancia comercial real limpia (intacta)
        const currentFees = group ? group.fees : 0;
        const currentOpex = dailyOpexMap[dateKey] || 0;
        const currentNetProfit = Math.round((group ? group.profit : 0) - currentFees - currentOpex);
        const realPrevMonthTotal = Math.round(prevMonthSalesByDay[day] || 0);

        salesByDate.push({
          date: dateKey,
          Ventas: currentTotal,
          Ganancias: currentProfit, // Preservado 100% idéntico para retrocompatibilidad
          GananciaReal: currentProfit, // Mismo número exacto
          GananciaNeta: currentNetProfit, // Ganancia neta deduciendo comisiones y opex
          VentasMesAnterior: realPrevMonthTotal,
        });
      }
    } else {
      const allDateKeys = Array.from(new Set([...Object.keys(salesGrouped), ...Object.keys(dailyOpexMap)]));
      allDateKeys.sort((a, b) => {
        const [d1, m1] = a.split('/').map(Number);
        const [d2, m2] = b.split('/').map(Number);
        return m1 !== m2 ? m1 - m2 : d1 - d2;
      });

      salesByDate = allDateKeys.map((date) => {
        const group = salesGrouped[date];
        const currentTotal = group ? Math.round(group.total) : 0;
        const currentProfit = group ? Math.round(group.profit) : 0;
        const currentFees = group ? group.fees : 0;
        const currentOpex = dailyOpexMap[date] || 0;
        const currentNetProfit = Math.round((group ? group.profit : 0) - currentFees - currentOpex);
        const dayNumber = group?.dayNum || Number(date.split('/')[0]);
        const realPrevMonthTotal = Math.round(prevMonthSalesByDay[dayNumber] || 0);

        return {
          date,
          Ventas: currentTotal,
          Ganancias: currentProfit,
          GananciaReal: currentProfit,
          GananciaNeta: currentNetProfit,
          VentasMesAnterior: realPrevMonthTotal,
        };
      });
    }

    return {
      success: true,
      data: {
        period,
        totalRevenueArs: Math.round(totalRevenueArs),
        totalRevenueUsd: Number(totalRevenueUsd.toFixed(2)),
        grossMarginArs: Math.round(grossMarginArs),
        grossMarginPercent,
        opexArs: Math.round(totalOpexArs),
        estimatedProfitArs,
        estimatedProfitUsd: Number(estimatedProfitUsd.toFixed(2)),
        salesByDate: period === 'current_month' ? salesByDate : salesByDate.slice(-15),
        criticalStock,
        recentSales: recentSalesDb.map((sale) => ({
          id: sale.id,
          created_at: sale.created_at,
          total_ars: Number(sale.total_ars),
          client_name: sale.clients?.name || 'Consumidor Final',
        })),
        performanceWarning,
      },
    };
  } catch (error: unknown) {
    console.error('Error al generar datos del dashboard:', error);
    const msg = error instanceof Error ? error.message : 'Error al compilar datos del dashboard';
    return { success: false, error: msg };
  }
}

export interface BestSellerProduct {
  product_id: string;
  name: string;
  brand: string;
  sku: string;
  units_sold: number;
  total_revenue_ars: number;
  total_cost_ars: number;
  net_margin_ars: number;
  margin_percent: number;
}

export interface RetailKPIsData {
  totalSalesCount: number;
  totalRevenueArs: number;
  averageOrderValueArs: number;
  topBestSellers: BestSellerProduct[];
}

interface DbRetailItemRow {
  product_id: string;
  quantity: number;
  price_ars_at_moment: number;
  unit_cost_at_moment?: number | null;
  products?: {
    id: string;
    name: string;
    brand: string;
    sku: string;
    type?: string | null;
    base_cost_ars?: number | null;
  } | null;
}

/**
 * Obtiene los KPIs de Retail (AOV y Top Best Sellers) para el mes en curso o rango personalizado.
 * Calcula con precisión los costos de botellas cerradas y decants fraccionados.
 */
export async function getRetailKPIs(
  role?: UserRole,
  startDate?: string,
  endDate?: string
): Promise<{
  success: boolean;
  data?: RetailKPIsData;
  error?: string;
}> {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured()) {
      return {
        success: true,
        data: {
          totalSalesCount: 0,
          totalRevenueArs: 0,
          averageOrderValueArs: 0,
          topBestSellers: [],
        },
      };
    }

    const supabase = getServiceSupabase();
    let isoStart = resolveBusinessRange('current_month').start.toISOString();
    let isoEnd = resolveBusinessRange('current_month').end.toISOString();

    if (startDate && endDate) {
      const customRange = resolveBusinessRange('custom', startDate, endDate);
      isoStart = customRange.start.toISOString();
      isoEnd = customRange.end.toISOString();
    }

    // 1. Consultar ventas completadas del período
    const { data: monthSales, error: salesError } = await supabase
      .from('sales')
      .select('id, total_ars')
      .neq('status', 'voided')
      .neq('status', 'pending_payment')
      .gte('created_at', isoStart)
      .lte('created_at', isoEnd);

    if (salesError) throw salesError;

    const salesList = (monthSales || []) as unknown as Array<{ id: string; total_ars: number }>;
    const totalSalesCount = salesList.length;
    const totalRevenueArs = salesList.reduce((sum, s) => sum + Number(s.total_ars || 0), 0);
    const averageOrderValueArs = totalSalesCount > 0 ? Math.round(totalRevenueArs / totalSalesCount) : 0;

    const monthSaleIds = salesList.map((s) => s.id);
    let topBestSellers: BestSellerProduct[] = [];

    if (monthSaleIds.length > 0) {
      // 2. Consultar ítems vendidos en el mes con su tipo y costo base
      let { data: itemsData, error: itemsError } = await supabase
        .from('sale_items')
        .select(`
          product_id,
          quantity,
          price_ars_at_moment,
          unit_cost_at_moment,
          products (
            id,
            name,
            brand,
            sku,
            type,
            base_cost_ars
          )
        `)
        .in('sale_id', monthSaleIds);

      if (itemsError && itemsError.message?.includes('unit_cost_at_moment')) {
        const fallbackRes = await supabase
          .from('sale_items')
          .select(`
            product_id,
            quantity,
            price_ars_at_moment,
            products (
              id,
              name,
              brand,
              sku,
              type,
              base_cost_ars
            )
          `)
          .in('sale_id', monthSaleIds);
        itemsData = fallbackRes.data as any;
        itemsError = fallbackRes.error;
      }

      if (itemsError) throw itemsError;

      const items = (itemsData || []) as unknown as DbRetailItemRow[];
      const productGroupMap: Record<string, BestSellerProduct> = {};

      // Detectar productos que requieren fallbacks de costo (sin congelado ni de catálogo)
      const missingCostProductIds = new Set<string>();
      items.forEach((item) => {
        const catCost = Number(item.products?.base_cost_ars || 0);
        const momentCost = Number(item.unit_cost_at_moment || 0);
        if (catCost <= 0 && momentCost <= 0 && item.product_id) {
          missingCostProductIds.add(item.product_id);
        }
      });

      // Fallbacks canónicos: último costo de compra + recetas BOM (sin constantes hardcodeadas)
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

      items.forEach((item) => {
        const pId = item.product_id;
        const qty = Number(item.quantity || 0);
        const unitPrice = Number(item.price_ars_at_moment || 0);
        const pInfo = item.products;
        const recipeInfo = recipeFallbackMap[pId];

        // Cadena canónica de resolución de costo unitario (idéntica al P&L)
        const costResolution = resolveItemUnitCost({
          itemUnitCostAtMoment: item.unit_cost_at_moment,
          productBaseCostArs: pInfo?.base_cost_ars,
          lastPurchaseOrderCostArs: poCostMap[pId]?.toNumber(),
          productType: pInfo?.type,
          decantMl: recipeInfo?.sizeMl ?? null,
          supplyCostArs: recipeInfo?.supplyCostArs ?? null,
        });
        const unitCost = costResolution.unitCost;

        const revenue = qty * unitPrice;
        const cost = qty * unitCost;

        if (!productGroupMap[pId]) {
          productGroupMap[pId] = {
            product_id: pId,
            name: pInfo?.name || 'Producto Desconocido',
            brand: pInfo?.brand || 'Elohim',
            sku: pInfo?.sku || 'SKU-N/A',
            units_sold: 0,
            total_revenue_ars: 0,
            total_cost_ars: 0,
            net_margin_ars: 0,
            margin_percent: 0,
          };
        }

        productGroupMap[pId].units_sold += qty;
        productGroupMap[pId].total_revenue_ars += revenue;
        productGroupMap[pId].total_cost_ars += cost;
      });

      // Calcular márgenes por producto SIN clamp: los deficitarios reflejan su pérdida real (coincidir con el P&L)
      Object.values(productGroupMap).forEach((p) => {
        p.net_margin_ars = p.total_revenue_ars - p.total_cost_ars;
        p.margin_percent = p.total_revenue_ars > 0
          ? Number(((p.net_margin_ars / p.total_revenue_ars) * 100).toFixed(1))
          : 0;
      });

      topBestSellers = Object.values(productGroupMap)
        .sort((a, b) => b.total_revenue_ars - a.total_revenue_ars)
        .slice(0, 10);
    }

    return {
      success: true,
      data: {
        totalSalesCount,
        totalRevenueArs,
        averageOrderValueArs,
        topBestSellers,
      },
    };
  } catch (error: unknown) {
    console.error('Error al calcular KPIs de Retail:', error);
    const msg = error instanceof Error ? error.message : 'Error al obtener KPIs de Retail';
    return { success: false, error: msg };
  }
}

