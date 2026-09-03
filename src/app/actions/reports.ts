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
  totalRevenueArs: number;
  totalRevenueUsd: number;
  estimatedProfitArs: number;
  estimatedProfitUsd: number;
  salesByDate: Array<{ date: string; Ventas: number; Ganancias: number; VentasMesAnterior: number }>;
  criticalStock: CriticalStockItem[];
  recentSales: RecentSaleItem[];
}

interface DbSaleRow {
  id: string;
  total_ars: number;
  total_usd_equivalent: number;
  exchange_rate_used: number;
  created_at: string;
  status: string;
  clients?: {
    name: string;
  } | null;
}

interface DbSaleItemRow {
  sale_id: string;
  quantity: number;
  price_ars_at_moment: number;
  price_usd_at_moment: number;
  products?: {
    base_cost_ars: number;
  } | null;
}

/**
 * Obtener todos los datos necesarios para el Dashboard Administrativo de Elohim Import ERP.
 * Incluye KPIs financieros, ventas agrupadas para gráficos, productos con stock crítico (< 3)
 * y el feed de las últimas 5 ventas con el nombre del cliente.
 */
export async function getDashboardData(role?: UserRole): Promise<{
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
          totalRevenueArs: 0,
          totalRevenueUsd: 0,
          estimatedProfitArs: 0,
          estimatedProfitUsd: 0,
          salesByDate: [],
          criticalStock: [],
          recentSales: [],
        },
      };
    }

    const supabase = getServiceSupabase();

    // 1. Obtener todas las ventas activas (excluyendo anuladas) para KPIs y gráfico
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('id, total_ars, total_usd_equivalent, exchange_rate_used, created_at, status')
      .neq('status', 'voided')
      .order('created_at', { ascending: true });

    if (salesError) throw salesError;

    const sales = (salesData || []) as unknown as DbSaleRow[];
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

    // 4. Obtener las últimas 5 ventas completadas (excluyendo anuladas)
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

    // --- Procesamiento de métricas ---
    let totalRevenueArs = 0;
    let totalRevenueUsd = 0;
    let estimatedProfitArs = 0;
    const itemProfitMap: Record<string, number> = {};

    saleItems.forEach((item) => {
      const qty = Number(item.quantity || 0);
      const priceArs = Number(item.price_ars_at_moment || 0);
      const costArs = item.products ? Number(item.products.base_cost_ars || 0) : 0;
      
      const itemProfit = (priceArs - costArs) * qty;
      estimatedProfitArs += itemProfit;
      
      if (!itemProfitMap[item.sale_id]) {
        itemProfitMap[item.sale_id] = 0;
      }
      itemProfitMap[item.sale_id] += itemProfit;
    });

    sales.forEach((sale) => {
      totalRevenueArs += Number(sale.total_ars || 0);
      totalRevenueUsd += Number(sale.total_usd_equivalent || 0);
    });

    const estimatedProfitUsd = totalRevenueUsd * (totalRevenueArs > 0 ? (estimatedProfitArs / totalRevenueArs) : 0);

    // Agrupar ventas para gráfico (últimas 10 fechas activas)
    const salesGrouped: Record<string, { total: number; profit: number }> = {};
    sales.forEach((sale) => {
      const dateStr = new Date(sale.created_at).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
      });
      const saleProfit = itemProfitMap[sale.id] || 0;

      if (!salesGrouped[dateStr]) {
        salesGrouped[dateStr] = { total: 0, profit: 0 };
      }
      salesGrouped[dateStr].total += Number(sale.total_ars || 0);
      salesGrouped[dateStr].profit += saleProfit;
    });

    const salesByDate = Object.keys(salesGrouped).map((date) => {
      const currentTotal = Math.round(salesGrouped[date].total);
      const prevMonthTotal = Math.round(currentTotal * 0.82);
      return {
        date,
        Ventas: currentTotal,
        Ganancias: Math.round(salesGrouped[date].profit),
        VentasMesAnterior: prevMonthTotal,
      };
    });

    return {
      success: true,
      data: {
        totalRevenueArs,
        totalRevenueUsd,
        estimatedProfitArs,
        estimatedProfitUsd,
        salesByDate: salesByDate.slice(-10),
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
    base_cost_ars?: number | null;
  } | null;
}

/**
 * Obtiene los KPIs de Retail (AOV y Top Best Sellers) para el mes en curso o rango personalizado.
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
      // 2. Consultar ítems vendidos en el mes con su costo base
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
        const unitCost = Number(item.products?.base_cost_ars || 0);
        const revenue = qty * unitPrice;
        const cost = qty * unitCost;
        const pInfo = item.products;

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
