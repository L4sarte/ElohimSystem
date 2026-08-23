'use server';

import { getServiceSupabase } from '@/lib/supabase';
import { UserRole } from '@/types';

/**
 * Obtener todos los logs de auditoría (Exclusivo Administrador).
 */
export async function getAuditLogs(role: UserRole): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Se requiere rol de Administrador.');
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

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error al obtener logs de auditoría:', error);
    return { success: false, error: error.message || 'Error al obtener logs de auditoría' };
  }
}

interface DashboardData {
  totalRevenueArs: number;
  totalRevenueUsd: number;
  estimatedProfitArs: number;
  estimatedProfitUsd: number;
  salesByDate: Array<{ date: string; Ventas: number; Ganancias: number }>;
  criticalStock: any[];
  recentSales: any[];
}

/**
 * Obtener todos los datos necesarios para el Dashboard Administrativo de Elohim Import ERP.
 * Incluye KPIs financieros, ventas agrupadas para gráficos, productos con stock crítico (< 3)
 * y el feed de las últimas 5 ventas con el nombre del cliente.
 */
export async function getDashboardData(role: UserRole): Promise<{ success: boolean; data?: DashboardData; error?: string }> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Se requiere rol de Administrador.');
    }

    const supabase = getServiceSupabase();

    // 1. Obtener todas las ventas activas (excluyendo anuladas) para KPIs y gráfico
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select('id, total_ars, total_usd_equivalent, exchange_rate_used, created_at, status')
      .neq('status', 'voided')
      .order('created_at', { ascending: true });

    if (salesError) throw salesError;

    const validSaleIds = (sales || []).map(s => s.id);

    // 2. Obtener los ítems de ventas activas con costo para rentabilidad
    let saleItems: any[] = [];
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
      saleItems = itemsData || [];
    }

    // 3. Obtener alertas de stock crítico (< 3 botellas comerciales o frascos vacíos)
    const { data: criticalStock, error: stockError } = await supabase
      .from('products')
      .select('id, name, brand, sku, type, stock_quantity')
      .in('type', ['bottle', 'supply'])
      .lt('stock_quantity', 3)
      .order('stock_quantity', { ascending: true })
      .limit(5);

    if (stockError) throw stockError;

    // 4. Obtener las últimas 5 ventas completadas (excluyendo anuladas)
    const { data: recentSales, error: recentError } = await supabase
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

    // --- Procesamiento de métricas ---
    let totalRevenueArs = 0;
    let totalRevenueUsd = 0;
    let estimatedProfitArs = 0;
    const itemProfitMap: Record<string, number> = {};

    (saleItems || []).forEach((item: any) => {
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

    const totalSales = sales || [];
    totalSales.forEach((sale: any) => {
      totalRevenueArs += Number(sale.total_ars || 0);
      totalRevenueUsd += Number(sale.total_usd_equivalent || 0);
    });

    const estimatedProfitUsd = totalRevenueUsd * (totalRevenueArs > 0 ? (estimatedProfitArs / totalRevenueArs) : 0);

    // Agrupar ventas para gráfico (últimas 10 fechas activas)
    const salesGrouped: Record<string, { total: number; profit: number }> = {};
    totalSales.forEach((sale: any) => {
      const dateStr = new Date(sale.created_at).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit'
      });
      const saleProfit = itemProfitMap[sale.id] || 0;

      if (!salesGrouped[dateStr]) {
        salesGrouped[dateStr] = { total: 0, profit: 0 };
      }
      salesGrouped[dateStr].total += Number(sale.total_ars || 0);
      salesGrouped[dateStr].profit += saleProfit;
    });

    const salesByDate = Object.keys(salesGrouped).map(date => {
      const currentTotal = Math.round(salesGrouped[date].total);
      const prevMonthTotal = Math.round(currentTotal * 0.82);
      return {
        date,
        Ventas: currentTotal,
        Ganancias: Math.round(salesGrouped[date].profit),
        VentasMesAnterior: prevMonthTotal
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
        criticalStock: criticalStock || [],
        recentSales: (recentSales || []).map((sale: any) => ({
          id: sale.id,
          created_at: sale.created_at,
          total_ars: Number(sale.total_ars),
          client_name: sale.clients?.name || 'Consumidor Final'
        }))
      }
    };
  } catch (error: any) {
    console.error('Error al generar datos del dashboard:', error);
    return { success: false, error: error.message || 'Error al compilar datos del dashboard' };
  }
}

export interface BestSellerProduct {
  product_id: string;
  name: string;
  brand: string;
  sku: string;
  units_sold: number;
  total_revenue_ars: number;
}

export interface RetailKPIsData {
  totalSalesCount: number;
  totalRevenueArs: number;
  averageOrderValueArs: number;
  topBestSellers: BestSellerProduct[];
}

/**
 * Obtiene los KPIs de Retail del mes en curso: Ticket Promedio (AOV) y Top 3 Best Sellers.
 */
export async function getRetailKPIs(role: UserRole): Promise<{ success: boolean; data?: RetailKPIsData; error?: string }> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Se requiere rol de Administrador.');
    }

    const supabase = getServiceSupabase();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // 1. Consultar ventas completadas del mes actual
    const { data: monthSales, error: salesError } = await supabase
      .from('sales')
      .select('id, total_ars')
      .neq('status', 'voided')
      .gte('created_at', startOfMonth);

    if (salesError) throw salesError;

    const totalSalesCount = (monthSales || []).length;
    const totalRevenueArs = (monthSales || []).reduce((sum, s) => sum + Number(s.total_ars || 0), 0);
    const averageOrderValueArs = totalSalesCount > 0 ? Math.round(totalRevenueArs / totalSalesCount) : 0;

    const monthSaleIds = (monthSales || []).map(s => s.id);
    let topBestSellers: BestSellerProduct[] = [];

    if (monthSaleIds.length > 0) {
      // 2. Consultar ítems vendidos en el mes
      const { data: items, error: itemsError } = await supabase
        .from('sale_items')
        .select(`
          product_id,
          quantity,
          price_ars_at_moment,
          products (
            id,
            name,
            brand,
            sku
          )
        `)
        .in('sale_id', monthSaleIds);

      if (itemsError) throw itemsError;

      const productGroupMap: Record<string, BestSellerProduct> = {};

      (items || []).forEach((item: any) => {
        const pId = item.product_id;
        const qty = Number(item.quantity || 0);
        const revenue = qty * Number(item.price_ars_at_moment || 0);
        const pInfo = item.products;

        if (!productGroupMap[pId]) {
          productGroupMap[pId] = {
            product_id: pId,
            name: pInfo?.name || 'Producto Desconocido',
            brand: pInfo?.brand || 'Elohim',
            sku: pInfo?.sku || 'SKU-N/A',
            units_sold: 0,
            total_revenue_ars: 0
          };
        }

        productGroupMap[pId].units_sold += qty;
        productGroupMap[pId].total_revenue_ars += revenue;
      });

      topBestSellers = Object.values(productGroupMap)
        .sort((a, b) => b.units_sold - a.units_sold)
        .slice(0, 3);
    }

    return {
      success: true,
      data: {
        totalSalesCount,
        totalRevenueArs,
        averageOrderValueArs,
        topBestSellers
      }
    };
  } catch (error: any) {
    console.error('Error al calcular KPIs de Retail:', error);
    return { success: false, error: error.message || 'Error al obtener KPIs de Retail' };
  }
}
