'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserRole } from '@/types';
import { requireAdmin } from '@/lib/auth-checks';

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
  error?: string;
}> {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured()) {
      return { success: true, data: [] };
    }

    const supabase = getServiceSupabase();
    
    const { data, error } = await supabase
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
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return { success: true, data: (data || []) as unknown as AuditLogRecord[] };
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
  salesByDate: Array<{ date: string; Ventas: number; Ganancias: number; VentasMesAnterior: number }>;
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
    const now = new Date();

    const startOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)).toISOString();
    const endOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)).toISOString();
    const dateStartString = startOfMonth.split('T')[0];
    const dateEndString = endOfMonth.split('T')[0];

    // Fechas para cálculo histórico real del mes anterior (mismo día relativo)
    const prevMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const prevMonthIndex = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const startOfPrevMonth = new Date(Date.UTC(prevMonthYear, prevMonthIndex, 1, 0, 0, 0)).toISOString();
    const endOfPrevMonth = new Date(Date.UTC(prevMonthYear, prevMonthIndex + 1, 0, 23, 59, 59, 999)).toISOString();

    // 1. Obtener ventas activas según el período seleccionado
    let salesQuery = supabase
      .from('sales')
      .select('id, total_ars, subtotal_ars, discount_amount_ars, total_usd_equivalent, exchange_rate_used, created_at, status, gateway_fee_ars')
      .neq('status', 'voided')
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
      const { data: itemsData, error: itemsError } = await supabase
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
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentError) throw recentError;
    const recentSalesDb = (recentData || []) as unknown as DbSaleRow[];

    // --- Procesamiento canónico de métricas y COGS ---
    const saleCogsMap: Record<string, number> = {};

    saleItems.forEach((item) => {
      const qty = Number(item.quantity || 1);
      const isDecant = item.products?.type === 'decant_liquid';
      const mlCost = Number(item.products?.base_cost_ars || 0);

      // Costo unitario: Si es decant, 5ml de perfume + costo del frasco ($559). Si es botella, costo de catálogo.
      const unitCost = isDecant
        ? (mlCost * 5) + 559
        : mlCost;

      const itemCost = unitCost * qty;

      if (!saleCogsMap[item.sale_id]) {
        saleCogsMap[item.sale_id] = 0;
      }
      saleCogsMap[item.sale_id] += itemCost;
    });

    let totalRevenueArs = 0;
    let totalRevenueUsd = 0;
    let totalCogsArs = 0;
    let totalGatewayFees = 0;
    const saleProfitMap: Record<string, number> = {};

    sales.forEach((sale) => {
      const saleTotal = Number(sale.total_ars || 0);
      const saleCogs = saleCogsMap[sale.id] || 0;
      const saleFee = Number(sale.gateway_fee_ars || 0);

      // Margen Bruto de la Venta (con descuento comercial ya descontado en total_ars)
      const saleGrossMargin = Math.max(0, saleTotal - saleCogs);

      totalRevenueArs += saleTotal;
      totalRevenueUsd += Number(sale.total_usd_equivalent || 0);
      totalCogsArs += saleCogs;
      totalGatewayFees += saleFee;

      saleProfitMap[sale.id] = saleGrossMargin;
    });

    const totalOpexArs = expenses.reduce((sum, e) => sum + Number(e.amount_ars || 0), 0);
    const grossMarginArs = Math.max(0, totalRevenueArs - totalCogsArs);
    const estimatedProfitArs = Math.round(grossMarginArs - totalOpexArs - totalGatewayFees);

    const grossMarginPercent = totalRevenueArs > 0
      ? Number(((grossMarginArs / totalRevenueArs) * 100).toFixed(1))
      : 0;

    const estimatedProfitUsd = totalRevenueUsd * (totalRevenueArs > 0 ? (estimatedProfitArs / totalRevenueArs) : 0);

    // Mapeo de ventas reales del mes anterior por día para comparativa histórica exacta
    const prevMonthSalesByDay: Record<number, number> = {};
    prevSales.forEach((ps) => {
      const pDate = new Date(ps.created_at);
      const dayNum = pDate.getDate();
      prevMonthSalesByDay[dayNum] = (prevMonthSalesByDay[dayNum] || 0) + Number(ps.total_ars || 0);
    });

    // Agrupar ventas para gráfico
    const salesGrouped: Record<string, { total: number; profit: number; dayNum: number }> = {};
    sales.forEach((sale) => {
      const sDate = new Date(sale.created_at);
      const dayNum = sDate.getDate();
      const monthNum = sDate.getMonth() + 1;
      const dateStr = `${String(dayNum).padStart(2, '0')}/${String(monthNum).padStart(2, '0')}`;
      const saleGross = saleProfitMap[sale.id] || 0;

      if (!salesGrouped[dateStr]) {
        salesGrouped[dateStr] = { total: 0, profit: 0, dayNum };
      }
      salesGrouped[dateStr].total += Number(sale.total_ars || 0);
      salesGrouped[dateStr].profit += saleGross;
    });

    // Generar serie temporal continua para no distorsionar el eje X con fechas salteadas
    let salesByDate: Array<{ date: string; Ventas: number; Ganancias: number; VentasMesAnterior: number }> = [];

    if (period === 'current_month') {
      const currentDayLimit = Math.max(1, now.getDate());
      const currentMonthStr = String(now.getMonth() + 1).padStart(2, '0');

      for (let day = 1; day <= currentDayLimit; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateKey = `${dayStr}/${currentMonthStr}`;
        const group = salesGrouped[dateKey];
        const currentTotal = group ? Math.round(group.total) : 0;
        const currentProfit = group ? Math.round(group.profit) : 0;
        const realPrevMonthTotal = Math.round(prevMonthSalesByDay[day] || 0);

        salesByDate.push({
          date: dateKey,
          Ventas: currentTotal,
          Ganancias: currentProfit,
          VentasMesAnterior: realPrevMonthTotal,
        });
      }
    } else {
      salesByDate = Object.keys(salesGrouped).map((date) => {
        const group = salesGrouped[date];
        const currentTotal = Math.round(group.total);
        const realPrevMonthTotal = Math.round(prevMonthSalesByDay[group.dayNum] || 0);

        return {
          date,
          Ventas: currentTotal,
          Ganancias: Math.round(group.profit),
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
    const now = new Date();

    let isoStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)).toISOString();
    let isoEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)).toISOString();

    if (startDate && endDate) {
      const [sY, sM, sD] = startDate.split('-').map(Number);
      const [eY, eM, eD] = endDate.split('-').map(Number);
      isoStart = new Date(Date.UTC(sY, sM - 1, sD, 0, 0, 0)).toISOString();
      isoEnd = new Date(Date.UTC(eY, eM - 1, eD, 23, 59, 59, 999)).toISOString();
    }

    // 1. Consultar ventas completadas del período
    const { data: monthSales, error: salesError } = await supabase
      .from('sales')
      .select('id, total_ars')
      .neq('status', 'voided')
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
      const { data: itemsData, error: itemsError } = await supabase
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

      if (itemsError) throw itemsError;

      const items = (itemsData || []) as unknown as DbRetailItemRow[];
      const productGroupMap: Record<string, BestSellerProduct> = {};

      items.forEach((item) => {
        const pId = item.product_id;
        const qty = Number(item.quantity || 0);
        const unitPrice = Number(item.price_ars_at_moment || 0);
        const pInfo = item.products;
        const isDecant = pInfo?.type === 'decant_liquid';
        const rawCost = Number(pInfo?.base_cost_ars || 0);

        // Costo canónico para decants (5ml de perfume + frasco) vs botella sellada
        const unitCost = isDecant ? (rawCost * 5) + 559 : rawCost;

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

      // Calcular márgenes por producto
      Object.values(productGroupMap).forEach((p) => {
        p.net_margin_ars = Math.max(0, p.total_revenue_ars - p.total_cost_ars);
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

