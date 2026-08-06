'use server';

import { getServiceSupabase } from '@/lib/supabase';
import { UserRole } from '@/types';

export interface VisualDashboardData {
  monthlyRevenueData: Array<{
    month: string;
    ingresosBrutos: number;
    gananciaNeta: number;
  }>;
  paymentMethodDistribution: Array<{
    name: string;
    value: number;
    amountArs: number;
    color: string;
  }>;
  topSellingProducts: Array<{
    rank: number;
    name: string;
    brand: string;
    salesCount: number;
    totalRevenueArs: number;
  }>;
  totalCurrentMonthGross: number;
}

const MONTH_NAMES_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

/**
 * Recolectar y procesar información real de la base de datos de Supabase para el Dashboard Visual.
 */
export async function getVisualDashboardData(role: UserRole): Promise<{
  success: boolean;
  data?: VisualDashboardData;
  error?: string;
}> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Se requiere rol de Administrador.');
    }

    const supabase = getServiceSupabase();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth0 = now.getMonth();

    // =========================================================================
    // A. EVOLUCIÓN DE INGRESOS Y GANANCIAS (ÚLTIMOS 6 MESES)
    // =========================================================================
    const monthlyRevenueData: Array<{ month: string; ingresosBrutos: number; gananciaNeta: number }> = [];

    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(currentYear, currentMonth0 - i, 1, 0, 0, 0);
      const monthEnd = new Date(currentYear, currentMonth0 - i + 1, 0, 23, 59, 59);

      const label = MONTH_NAMES_SHORT[monthStart.getMonth()];
      const isoStart = monthStart.toISOString();
      const isoEnd = monthEnd.toISOString();

      // Consultar ventas activas del mes
      const { data: sales, error: salesErr } = await supabase
        .from('sales')
        .select('id, total_ars, status')
        .gte('created_at', isoStart)
        .lte('created_at', isoEnd)
        .neq('status', 'voided');

      if (salesErr) throw salesErr;

      let monthGross = 0;
      const saleIds: string[] = [];

      (sales || []).forEach((s: any) => {
        monthGross += Number(s.total_ars || 0);
        saleIds.push(s.id);
      });

      // Calcular COGS real del mes si hay ventas
      let monthCogs = 0;
      if (saleIds.length > 0) {
        const { data: items } = await supabase
          .from('sale_items')
          .select('quantity, unit_price_ars, product_id, products(base_cost_ars)')
          .in('sale_id', saleIds);

        (items || []).forEach((item: any) => {
          const qty = Number(item.quantity || 1);
          const cost = Number(item.products?.base_cost_ars || 0);
          monthCogs += qty * cost;
        });
      }

      // Si no se definió costo de producto, aplicar margen promedio estimado del 35%
      const monthNet = monthCogs > 0 && monthCogs < monthGross 
        ? Math.round(monthGross - monthCogs) 
        : Math.round(monthGross * 0.35);

      monthlyRevenueData.push({
        month: label,
        ingresosBrutos: Math.round(monthGross),
        gananciaNeta: monthNet
      });
    }

    // =========================================================================
    // B. DISTRIBUCIÓN POR MEDIO DE PAGO (MES ACTUAL)
    // =========================================================================
    const curMonthStart = new Date(currentYear, currentMonth0, 1, 0, 0, 0).toISOString();
    const curMonthEnd = new Date(currentYear, currentMonth0 + 1, 0, 23, 59, 59).toISOString();

    const { data: curSales, error: curSalesErr } = await supabase
      .from('sales')
      .select('id, total_ars, payment_methods, created_at')
      .gte('created_at', curMonthStart)
      .lte('created_at', curMonthEnd)
      .neq('status', 'voided');

    if (curSalesErr) throw curSalesErr;

    let sumTransfer = 0;
    let sumDigital = 0;
    let sumCashArs = 0;
    let sumCashUsd = 0;
    let totalCurMonthGross = 0;

    (curSales || []).forEach((sale: any) => {
      totalCurMonthGross += Number(sale.total_ars || 0);
      const pm = sale.payment_methods || {};

      if (pm.breakdown && Array.isArray(pm.breakdown) && pm.breakdown.length > 0) {
        pm.breakdown.forEach((b: any) => {
          const amt = Number(b.final_amount || b.amount_base || 0);
          const mName = String(b.method_name || '').toLowerCase();

          if (mName.includes('dólar') || mName.includes('usd') || mName.includes('billete')) {
            sumCashUsd += amt;
          } else if (mName.includes('transfer') || mName.includes('alias') || mName.includes('directo')) {
            sumTransfer += amt;
          } else if (mName.includes('efectivo')) {
            sumCashArs += amt;
          } else {
            sumDigital += amt;
          }
        });
      } else {
        const cArs = Number(pm.cash_ars || 0);
        const cUsd = Number(pm.cash_usd || 0) * Number(pm.exchange_rate_usd || 1000);
        const dArs = Number(pm.digital_ars || 0);
        const tArs = Number(pm.transfer_ars || 0);

        if (cArs > 0) sumCashArs += cArs;
        if (cUsd > 0) sumCashUsd += cUsd;
        if (tArs > 0) sumTransfer += tArs;
        if (dArs > 0) sumDigital += dArs;

        if (cArs === 0 && cUsd === 0 && tArs === 0 && dArs === 0) {
          sumCashArs += Number(sale.total_ars || 0);
        }
      }
    });

    const totalMethods = sumTransfer + sumDigital + sumCashArs + sumCashUsd || 1;

    const paymentMethodDistribution = [
      {
        name: 'Transferencia / Alias',
        value: Math.round((sumTransfer / totalMethods) * 100),
        amountArs: Math.round(sumTransfer),
        color: '#D0A96B' // Dorado
      },
      {
        name: 'Mercado Pago / Tarjetas',
        value: Math.round((sumDigital / totalMethods) * 100),
        amountArs: Math.round(sumDigital),
        color: '#2E5C47' // Esmeralda
      },
      {
        name: 'Efectivo ARS',
        value: Math.round((sumCashArs / totalMethods) * 100),
        amountArs: Math.round(sumCashArs),
        color: '#F59E0B' // Amber
      },
      {
        name: 'Dólares Billete',
        value: Math.round((sumCashUsd / totalMethods) * 100),
        amountArs: Math.round(sumCashUsd),
        color: '#6366F1' // Indigo
      }
    ];

    // =========================================================================
    // C. TOP 5 FRAGANCIAS MÁS VENDIDAS (RANKING MES ACTUAL)
    // =========================================================================
    const curSaleIds = (curSales || []).map((s: any) => s.id);
    const topSellingProducts: Array<{ rank: number; name: string; brand: string; salesCount: number; totalRevenueArs: number }> = [];

    if (curSaleIds.length > 0) {
      const { data: items, error: itemsErr } = await supabase
        .from('sale_items')
        .select('product_id, quantity, unit_price_ars, subtotal_ars, products(name, brand)')
        .in('sale_id', curSaleIds);

      if (!itemsErr && items) {
        const productMap = new Map<string, { name: string; brand: string; salesCount: number; totalRevenueArs: number }>();

        items.forEach((item: any) => {
          const pId = item.product_id;
          const qty = Number(item.quantity || 1);
          const rev = Number(item.subtotal_ars || (Number(item.unit_price_ars || 0) * qty));

          const pName = item.products?.name || 'Fragancia Elohim';
          const pBrand = item.products?.brand || 'Elohim Import';

          if (productMap.has(pId)) {
            const existing = productMap.get(pId)!;
            existing.salesCount += qty;
            existing.totalRevenueArs += rev;
          } else {
            productMap.set(pId, {
              name: pName,
              brand: pBrand,
              salesCount: qty,
              totalRevenueArs: rev
            });
          }
        });

        const sorted = Array.from(productMap.values())
          .sort((a, b) => b.salesCount - a.salesCount)
          .slice(0, 5);

        sorted.forEach((prod, index) => {
          topSellingProducts.push({
            rank: index + 1,
            name: prod.name,
            brand: prod.brand,
            salesCount: prod.salesCount,
            totalRevenueArs: Math.round(prod.totalRevenueArs)
          });
        });
      }
    }

    return {
      success: true,
      data: {
        monthlyRevenueData,
        paymentMethodDistribution,
        topSellingProducts,
        totalCurrentMonthGross: Math.round(totalCurMonthGross)
      }
    };
  } catch (error: any) {
    console.error('Error al generar Dashboard Visual:', error);
    return {
      success: false,
      error: error.message || 'Error al recuperar métricas del Dashboard Visual'
    };
  }
}
