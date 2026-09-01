'use server';

import { getServiceSupabase } from '@/lib/supabase';
import { UserRole } from '@/types';
import { requireAdmin } from '@/lib/auth-checks';
import { calculateFinancialTotals } from '@/lib/financial-calculations';
import Decimal from 'decimal.js';

export interface FinancialReportData {
  grossRevenue: number;
  cogs: number;
  grossMargin: number;
  grossMarginPercent: number;
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

interface SaleRow {
  id: string;
  total_ars?: number | null;
  payment_methods?: any;
  created_at?: string | null;
  status?: string | null;
  gateway_fee_ars?: number | null;
}

interface SaleItemRow {
  sale_id: string;
  quantity?: number | null;
  price_ars_at_moment?: number | null;
  unit_price_ars?: number | null;
  products?: {
    base_cost_ars?: number | null;
  } | null;
}

interface ExpenseRow {
  category?: string | null;
  amount_ars?: number | null;
  expense_date?: string | null;
}

/**
 * Generar Reporte Financiero Completo y Estado de Resultados para Administradores.
 */
export async function getFinancialReport(
  role: UserRole,
  range: 'current_month' | 'previous_month' | 'last_30_days' | 'current_year' | 'custom' = 'current_month',
  customStartDate?: string,
  customEndDate?: string
): Promise<{ success: boolean; data?: FinancialReportData; error?: string }> {
  try {
    await requireAdmin();

    const serviceClient = getServiceSupabase();
    const now = new Date();

    let startDate = new Date();
    let endDate = new Date();

    if (customStartDate && customEndDate) {
      const [sYear, sMonth, sDay] = customStartDate.split('-').map(Number);
      const [eYear, eMonth, eDay] = customEndDate.split('-').map(Number);
      startDate = new Date(sYear, sMonth - 1, sDay, 0, 0, 0);
      endDate = new Date(eYear, eMonth - 1, eDay, 23, 59, 59);
    } else if (range === 'current_month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (range === 'previous_month') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (range === 'last_30_days') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      endDate = new Date();
    } else if (range === 'current_year') {
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    }

    const isoStart = startDate.toISOString();
    const isoEnd = endDate.toISOString();
    const dateStartString = startDate.toISOString().split('T')[0];
    const dateEndString = endDate.toISOString().split('T')[0];

    // 1. Consultar ventas activas del período (excluyendo voided)
    const { data: salesData, error: salesError } = await serviceClient
      .from('sales')
      .select('id, total_ars, payment_methods, created_at, status, gateway_fee_ars')
      .gte('created_at', isoStart)
      .lte('created_at', isoEnd)
      .neq('status', 'voided')
      .order('created_at', { ascending: true });

    if (salesError) throw salesError;
    const sales = (salesData || []) as unknown as SaleRow[];

    // 2. Consultar ítems de ventas para calcular el COGS real usando products(base_cost_ars)
    const saleIds = sales.map((s) => s.id);
    let totalCogsDecimal = new Decimal(0);
    const saleCogsMap: Record<string, Decimal> = {};

    if (saleIds.length > 0) {
      const { data: saleItemsData, error: itemsError } = await serviceClient
        .from('sale_items')
        .select(`
          sale_id,
          quantity,
          price_ars_at_moment,
          unit_price_ars,
          products (
            base_cost_ars
          )
        `)
        .in('sale_id', saleIds);

      if (!itemsError && saleItemsData) {
        const saleItems = saleItemsData as unknown as SaleItemRow[];
        saleItems.forEach((item) => {
          const qty = new Decimal(item.quantity || 1);
          const cost = new Decimal(item.products?.base_cost_ars || 0);
          const itemTotalCost = cost.times(qty);

          totalCogsDecimal = totalCogsDecimal.plus(itemTotalCost);

          if (!saleCogsMap[item.sale_id]) {
            saleCogsMap[item.sale_id] = new Decimal(0);
          }
          saleCogsMap[item.sale_id] = saleCogsMap[item.sale_id].plus(itemTotalCost);
        });
      }
    }

    // 3. Consultar gastos operativos (OPEX)
    const { data: expensesData, error: expError } = await serviceClient
      .from('operating_expenses')
      .select('category, amount_ars, expense_date')
      .gte('expense_date', dateStartString)
      .lte('expense_date', dateEndString);

    if (expError) throw expError;
    const expenses = (expensesData || []) as unknown as ExpenseRow[];

    // 4. Procesar ventas diarias y comisiones de pasarela
    let grossRevenueDecimal = new Decimal(0);
    let gatewayFeeDecimal = new Decimal(0);
    const dailyMap: Record<string, { ingresos: Decimal; cogs: Decimal; fees: Decimal; opex: Decimal }> = {};

    sales.forEach((s) => {
      const totalArs = new Decimal(s.total_ars || 0);
      grossRevenueDecimal = grossRevenueDecimal.plus(totalArs);

      // Extraer comisiones de pasarela
      let feeForSale = new Decimal(s.gateway_fee_ars || 0);
      if (feeForSale.isZero() && s.payment_methods) {
        const pm = s.payment_methods;
        if (typeof pm.gateway_fee_ars === 'number') {
          feeForSale = new Decimal(pm.gateway_fee_ars);
        } else if (typeof pm.surcharge_applied_ars === 'number') {
          feeForSale = new Decimal(pm.surcharge_applied_ars);
        } else if (Array.isArray(pm.breakdown)) {
          pm.breakdown.forEach((b: any) => {
            feeForSale = feeForSale.plus(new Decimal(b.gateway_fee_ars || b.surcharge_applied || 0));
          });
        }
      }
      gatewayFeeDecimal = gatewayFeeDecimal.plus(feeForSale);

      // Agrupar por día para gráfico de tendencia
      const createdDate = s.created_at ? new Date(s.created_at) : new Date();
      const dayKey = isNaN(createdDate.getTime())
        ? 'Hoy'
        : createdDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });

      if (!dailyMap[dayKey]) {
        dailyMap[dayKey] = {
          ingresos: new Decimal(0),
          cogs: new Decimal(0),
          fees: new Decimal(0),
          opex: new Decimal(0),
        };
      }

      const saleCogs = saleCogsMap[s.id] || new Decimal(0);
      dailyMap[dayKey].ingresos = dailyMap[dayKey].ingresos.plus(totalArs);
      dailyMap[dayKey].cogs = dailyMap[dayKey].cogs.plus(saleCogs);
      dailyMap[dayKey].fees = dailyMap[dayKey].fees.plus(feeForSale);
    });

    // Procesar gastos operativos (OPEX) por categoría y fecha
    let opexDecimal = new Decimal(0);
    const catMap: Record<string, Decimal> = {};

    expenses.forEach((e) => {
      const amt = new Decimal(e.amount_ars || 0);
      opexDecimal = opexDecimal.plus(amt);

      const cat = e.category || 'Varios';
      if (!catMap[cat]) {
        catMap[cat] = new Decimal(0);
      }
      catMap[cat] = catMap[cat].plus(amt);

      // Asignar OPEX al mapa diario si corresponde
      if (e.expense_date) {
        const [eY, eM, eD] = e.expense_date.split('-').map(Number);
        const expDate = new Date(eY, eM - 1, eD);
        const dayKey = expDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
        if (dailyMap[dayKey]) {
          dailyMap[dayKey].opex = dailyMap[dayKey].opex.plus(amt);
        }
      }
    });

    // 5. Consultar Cuentas por Cobrar globales (Dinero en la calle)
    const { data: pendingSalesData } = await serviceClient
      .from('sales')
      .select('amount_due_ars')
      .neq('status', 'voided')
      .gt('amount_due_ars', 0);

    const totalAmountDueGlobal = (pendingSalesData || []).reduce(
      (sum: number, s: any) => sum + Number(s.amount_due_ars || 0),
      0
    );

    // 6. Consultar Devoluciones del Período
    const { data: returnsData } = await serviceClient
      .from('returns')
      .select('refund_amount_ars')
      .gte('created_at', isoStart)
      .lte('created_at', isoEnd);

    const totalRefundsArs = (returnsData || []).reduce(
      (sum: number, r: any) => sum + Number(r.refund_amount_ars || 0),
      0
    );

    // 7. Calcular Totales con el helper centralizado
    const totals = calculateFinancialTotals({
      grossRevenue: grossRevenueDecimal.toNumber(),
      cogs: totalCogsDecimal.toNumber(),
      gatewayFees: gatewayFeeDecimal.toNumber(),
      opex: opexDecimal.toNumber(),
      refunds: totalRefundsArs,
    });

    // 8. Formatear datos para gráficos Recharts (ganancia diaria calculada exactamente)
    const trendData = Object.keys(dailyMap).map((date) => {
      const day = dailyMap[date];
      const dailyGross = day.ingresos;
      const dailyNet = dailyGross.minus(day.cogs).minus(day.fees).minus(day.opex);
      return {
        date,
        ingresos: Math.round(dailyGross.toNumber()),
        ganancia: Math.round(dailyNet.toNumber()),
      };
    });

    const categoryBreakdown = Object.keys(catMap).map((name) => ({
      name,
      value: Math.round(catMap[name].toNumber()),
    }));

    return {
      success: true,
      data: {
        grossRevenue: totals.grossRevenue,
        cogs: totals.cogs,
        grossMargin: totals.grossMargin,
        grossMarginPercent: totals.grossMarginPercent,
        financialCost: totals.gatewayFees,
        gatewayFeeArs: totals.gatewayFees,
        totalAmountDueArs: Math.round(totalAmountDueGlobal),
        totalRefundsArs: totals.refunds,
        opex: totals.opex,
        netProfit: totals.netProfit,
        profitMarginPercent: totals.netMarginPercent,
        trendData,
        categoryBreakdown,
      },
    };
  } catch (error: unknown) {
    console.error('Error al generar reporte financiero:', error);
    const msg = error instanceof Error ? error.message : 'Error al calcular reporte financiero';
    return { success: false, error: msg };
  }
}
