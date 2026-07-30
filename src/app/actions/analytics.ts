'use server';

import { getServiceSupabase } from '@/lib/supabase';
import { UserRole } from '@/types';

export interface FinancialReportData {
  grossRevenue: number;
  cogs: number;
  financialCost: number;
  gatewayFeeArs: number;
  totalAmountDueArs: number;
  totalRefundsArs: number;
  opex: number;
  netProfit: number;
  profitMarginPercent: number;
  trendData: Array<{
    date: string;
    ingresos: number;
    ganancia: number;
  }>;
  categoryBreakdown: Array<{
    name: string;
    value: number;
  }>;
}

/**
 * Generar Reporte Financiero Completo y Estado de Resultados para Administradores.
 */
export async function getFinancialReport(
  role: UserRole,
  range: 'current_month' | 'previous_month' | 'last_30_days' | 'current_year' = 'current_month'
): Promise<{ success: boolean; data?: FinancialReportData; error?: string }> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Se requiere rol de Administrador.');
    }

    const serviceClient = getServiceSupabase();
    const now = new Date();

    let startDate = new Date();
    let endDate = new Date();

    if (range === 'current_month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (range === 'previous_month') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (range === 'last_30_days') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      endDate = new Date();
    } else if (range === 'current_year') {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    }

    const isoStart = startDate.toISOString();
    const isoEnd = endDate.toISOString();
    const dateStartString = startDate.toISOString().split('T')[0];
    const dateEndString = endDate.toISOString().split('T')[0];

    // 1. Consultar ventas activas/completadas del periodo (excluyendo anuladas)
    const { data: sales, error: salesError } = await serviceClient
      .from('sales')
      .select('id, total_ars, payment_methods, created_at, status, gateway_fee_ars')
      .gte('created_at', isoStart)
      .lte('created_at', isoEnd)
      .neq('status', 'voided')
      .order('created_at', { ascending: true });

    if (salesError) throw salesError;

    // 2. Consultar ítems de ventas para calcular el COGS
    const saleIds = (sales || []).map(s => s.id);
    let cogs = 0;

    if (saleIds.length > 0) {
      const { data: saleItems, error: itemsError } = await serviceClient
        .from('sale_items')
        .select(`
          quantity,
          price_ars_at_moment,
          products (
            base_price_ars
          )
        `)
        .in('sale_id', saleIds);

      if (!itemsError && saleItems) {
        saleItems.forEach((item: any) => {
          const qty = Number(item.quantity || 1);
          const basePrice = Number(item.products?.base_price_ars || item.price_ars_at_moment || 0);
          // Estimación del costo directo de reposición al 50% del precio base de catálogo
          cogs += qty * (basePrice * 0.50);
        });
      }
    }

    // 3. Consultar gastos operativos (OPEX)
    const { data: expenses, error: expError } = await serviceClient
      .from('operating_expenses')
      .select('category, amount_ars, expense_date')
      .gte('expense_date', dateStartString)
      .lte('expense_date', dateEndString);

    if (expError) throw expError;

    // 4. Calcular Totales Financieros
    let grossRevenue = 0;
    let financialCost = 0;
    let gatewayFeeTotal = 0;
    const dailyMap: Record<string, { ingresos: number; ganancia: number }> = {};

    (sales || []).forEach(s => {
      const totalArs = Number(s.total_ars || 0);
      grossRevenue += totalArs;

      // Extraer comisiones/recargos de pasarelas
      let feeForSale = Number(s.gateway_fee_ars || 0);
      if (feeForSale === 0 && s.payment_methods) {
        const pm = s.payment_methods;
        if (typeof pm.gateway_fee_ars === 'number') {
          feeForSale = pm.gateway_fee_ars;
        } else if (typeof pm.surcharge_applied_ars === 'number') {
          feeForSale = pm.surcharge_applied_ars;
        } else if (Array.isArray(pm.breakdown)) {
          pm.breakdown.forEach((b: any) => {
            feeForSale += Number(b.gateway_fee_ars || b.surcharge_applied || 0);
          });
        }
      }
      gatewayFeeTotal += feeForSale;
      financialCost += feeForSale;

      // Agrupar por día para gráfico de tendencia
      const dayKey = new Date(s.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
      if (!dailyMap[dayKey]) {
        dailyMap[dayKey] = { ingresos: 0, ganancia: 0 };
      }
      dailyMap[dayKey].ingresos += totalArs;
      // Ganancia estimada diaria
      dailyMap[dayKey].ganancia += totalArs * 0.40; // ~40% margen aproximado
    });

    let opex = 0;
    const catMap: Record<string, number> = {};

    (expenses || []).forEach(e => {
      const amt = Number(e.amount_ars || 0);
      opex += amt;
      const cat = e.category || 'Varios';
      catMap[cat] = (catMap[cat] || 0) + amt;
    });

    // 5. Calcular Ganancia Neta
    const netProfit = grossRevenue - cogs - financialCost - opex;
    const profitMarginPercent = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

    // 6. Consultar Cuentas por Cobrar globales (Dinero en la calle)
    const { data: pendingSalesData } = await serviceClient
      .from('sales')
      .select('amount_due_ars')
      .neq('status', 'voided')
      .gt('amount_due_ars', 0);

    const totalAmountDueGlobal = (pendingSalesData || []).reduce((sum: number, s: any) => sum + Number(s.amount_due_ars || 0), 0);

    // 7. Consultar Devoluciones del Período
    const { data: returnsData } = await serviceClient
      .from('returns')
      .select('refund_amount_ars')
      .gte('created_at', isoStart)
      .lte('created_at', isoEnd);

    const totalRefundsArs = (returnsData || []).reduce((sum: number, r: any) => sum + Number(r.refund_amount_ars || 0), 0);

    // 8. Formatear datos para gráficos Recharts
    const trendData = Object.keys(dailyMap).map(date => ({
      date,
      ingresos: Math.round(dailyMap[date].ingresos),
      ganancia: Math.round(dailyMap[date].ganancia)
    }));

    const categoryBreakdown = Object.keys(catMap).map(name => ({
      name,
      value: Math.round(catMap[name])
    }));

    return {
      success: true,
      data: {
        grossRevenue: Math.round(grossRevenue),
        cogs: Math.round(cogs),
        financialCost: Math.round(financialCost),
        gatewayFeeArs: Math.round(gatewayFeeTotal),
        totalAmountDueArs: Math.round(totalAmountDueGlobal),
        totalRefundsArs: Math.round(totalRefundsArs),
        opex: Math.round(opex),
        netProfit: Math.round(netProfit),
        profitMarginPercent: Number(profitMarginPercent.toFixed(2)),
        trendData,
        categoryBreakdown
      }
    };
  } catch (error: any) {
    console.error('Error al generar reporte financiero:', error);
    return { success: false, error: error.message || 'Error al calcular reporte financiero' };
  }
}
