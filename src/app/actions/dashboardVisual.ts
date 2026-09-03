'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserRole } from '@/types';
import { requireAdmin } from '@/lib/auth-checks';
import Decimal from 'decimal.js';

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
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

interface DbVisualSaleRow {
  id: string;
  total_ars?: number | null;
  payment_methods?: Record<string, unknown> | null;
  status?: string | null;
  created_at?: string | null;
  gateway_fee_ars?: number | null;
}

interface DbVisualItemRow {
  sale_id: string;
  product_id: string;
  quantity?: number | null;
  price_ars_at_moment?: number | null;
  products?: {
    name?: string | null;
    brand?: string | null;
    base_cost_ars?: number | null;
  } | null;
}

interface DbVisualExpenseRow {
  amount_ars?: number | null;
  expense_date?: string | null;
}

interface PaymentBreakdownItem {
  final_amount?: number;
  amount_base?: number;
  method_name?: string;
}

/**
 * Recolectar y procesar información real de la base de datos de Supabase para el Dashboard Visual.
 * Optimizado con consultas concurrentes (sin N+1) y cálculo exacto de rentabilidad con Decimal.js.
 */
export async function getVisualDashboardData(role?: UserRole): Promise<{
  success: boolean;
  data?: VisualDashboardData;
  error?: string;
}> {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured()) {
      return {
        success: true,
        data: {
          monthlyRevenueData: [],
          paymentMethodDistribution: [],
          topSellingProducts: [],
          totalCurrentMonthGross: 0,
        },
      };
    }

    const supabase = getServiceSupabase();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth0 = now.getMonth();

    // Rango de 6 meses (desde el 1º del mes hace 5 meses hasta el fin de hoy)
    const sixMonthsAgoStart = new Date(currentYear, currentMonth0 - 5, 1, 0, 0, 0);
    const isoStart = sixMonthsAgoStart.toISOString();
    const isoEnd = new Date(currentYear, currentMonth0 + 1, 0, 23, 59, 59).toISOString();
    const dateStartString = sixMonthsAgoStart.toISOString().split('T')[0];
    const dateEndString = isoEnd.split('T')[0];

    // =========================================================================
    // CONSULTAS CONCURRENTES (Ventas, Gastos Operativos)
    // =========================================================================
    const [salesRes, expensesRes] = await Promise.all([
      supabase
        .from('sales')
        .select('id, total_ars, payment_methods, status, created_at, gateway_fee_ars')
        .gte('created_at', isoStart)
        .lte('created_at', isoEnd)
        .neq('status', 'voided')
        .order('created_at', { ascending: true }),
      supabase
        .from('operating_expenses')
        .select('amount_ars, expense_date')
        .gte('expense_date', dateStartString)
        .lte('expense_date', dateEndString),
    ]);

    if (salesRes.error) throw salesRes.error;
    if (expensesRes.error) throw expensesRes.error;

    const allSales = (salesRes.data || []) as unknown as DbVisualSaleRow[];
    const allExpenses = (expensesRes.data || []) as unknown as DbVisualExpenseRow[];

    // Consultar ítems de todas las ventas del semestre en una sola consulta
    const allSaleIds = allSales.map((s) => s.id);
    let allItems: DbVisualItemRow[] = [];

    if (allSaleIds.length > 0) {
      const { data: itemsData, error: itemsErr } = await supabase
        .from('sale_items')
        .select('sale_id, product_id, quantity, price_ars_at_moment, products(name, brand, base_cost_ars)')
        .in('sale_id', allSaleIds);

      if (!itemsErr && itemsData) {
        allItems = itemsData as unknown as DbVisualItemRow[];
      }
    }

    // Mapear costo por venta
    const saleCogsMap = new Map<string, Decimal>();
    allItems.forEach((item) => {
      const qty = new Decimal(item.quantity || 1);
      const cost = new Decimal(item.products?.base_cost_ars || 0);
      const itemCost = cost.times(qty);

      const prev = saleCogsMap.get(item.sale_id) || new Decimal(0);
      saleCogsMap.set(item.sale_id, prev.plus(itemCost));
    });

    // Mapear ventas y gastos a cada uno de los 6 meses
    interface MonthBucket {
      label: string;
      year: number;
      month0: number;
      gross: Decimal;
      cogs: Decimal;
      fees: Decimal;
      opex: Decimal;
    }

    const monthBuckets: MonthBucket[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth0 - i, 1);
      monthBuckets.push({
        label: MONTH_NAMES_SHORT[d.getMonth()],
        year: d.getFullYear(),
        month0: d.getMonth(),
        gross: new Decimal(0),
        cogs: new Decimal(0),
        fees: new Decimal(0),
        opex: new Decimal(0),
      });
    }

    // Distribuir ventas
    allSales.forEach((sale) => {
      if (!sale.created_at) return;
      const sDate = new Date(sale.created_at);
      const sYear = sDate.getFullYear();
      const sMonth0 = sDate.getMonth();

      const bucket = monthBuckets.find((b) => b.year === sYear && b.month0 === sMonth0);
      if (bucket) {
        const total = new Decimal(sale.total_ars || 0);
        const cogs = saleCogsMap.get(sale.id) || new Decimal(0);
        const fees = new Decimal(sale.gateway_fee_ars || 0);

        bucket.gross = bucket.gross.plus(total);
        bucket.cogs = bucket.cogs.plus(cogs);
        bucket.fees = bucket.fees.plus(fees);
      }
    });

    // Distribuir gastos operativos
    allExpenses.forEach((exp) => {
      if (!exp.expense_date) return;
      const [eY, eM] = exp.expense_date.split('-').map(Number);
      const expYear = eY;
      const expMonth0 = eM - 1;

      const bucket = monthBuckets.find((b) => b.year === expYear && b.month0 === expMonth0);
      if (bucket) {
        bucket.opex = bucket.opex.plus(new Decimal(exp.amount_ars || 0));
      }
    });

    // Construir monthlyRevenueData
    const monthlyRevenueData = monthBuckets.map((b) => {
      const net = b.gross.minus(b.cogs).minus(b.fees).minus(b.opex);
      return {
        month: b.label,
        ingresosBrutos: Math.round(b.gross.toNumber()),
        gananciaNeta: Math.round(net.toNumber()),
      };
    });

    // =========================================================================
    // B. DISTRIBUCIÓN POR MEDIO DE PAGO (MES ACTUAL)
    // =========================================================================
    const curMonthSales = allSales.filter((sale) => {
      if (!sale.created_at) return false;
      const sDate = new Date(sale.created_at);
      return sDate.getFullYear() === currentYear && sDate.getMonth() === currentMonth0;
    });

    let sumTransfer = new Decimal(0);
    let sumDigital = new Decimal(0);
    let sumCashArs = new Decimal(0);
    let sumCashUsd = new Decimal(0);
    let totalCurMonthGross = new Decimal(0);

    curMonthSales.forEach((sale) => {
      const saleTotal = new Decimal(sale.total_ars || 0);
      totalCurMonthGross = totalCurMonthGross.plus(saleTotal);
      const pm = (sale.payment_methods || {}) as Record<string, unknown>;

      if (pm.breakdown && Array.isArray(pm.breakdown) && pm.breakdown.length > 0) {
        (pm.breakdown as PaymentBreakdownItem[]).forEach((b) => {
          const amt = new Decimal(b.final_amount || b.amount_base || 0);
          const mName = String(b.method_name || '').toLowerCase();

          if (mName.includes('dólar') || mName.includes('usd') || mName.includes('billete')) {
            sumCashUsd = sumCashUsd.plus(amt);
          } else if (mName.includes('transfer') || mName.includes('alias') || mName.includes('directo')) {
            sumTransfer = sumTransfer.plus(amt);
          } else if (mName.includes('efectivo')) {
            sumCashArs = sumCashArs.plus(amt);
          } else {
            sumDigital = sumDigital.plus(amt);
          }
        });
      } else {
        const cArs = new Decimal(Number(pm.cash_ars) || 0);
        const cUsd = new Decimal(Number(pm.cash_usd) || 0).times(Number(pm.exchange_rate_usd) || 1000);
        const dArs = new Decimal(Number(pm.digital_ars) || 0);
        const tArs = new Decimal(Number(pm.transfer_ars) || 0);

        if (cArs.greaterThan(0)) sumCashArs = sumCashArs.plus(cArs);
        if (cUsd.greaterThan(0)) sumCashUsd = sumCashUsd.plus(cUsd);
        if (tArs.greaterThan(0)) sumTransfer = sumTransfer.plus(tArs);
        if (dArs.greaterThan(0)) sumDigital = sumDigital.plus(dArs);

        if (cArs.isZero() && cUsd.isZero() && tArs.isZero() && dArs.isZero()) {
          sumCashArs = sumCashArs.plus(saleTotal);
        }
      }
    });

    const totalMethods = sumTransfer.plus(sumDigital).plus(sumCashArs).plus(sumCashUsd);
    const totalMethodsNum = totalMethods.isZero() ? 1 : totalMethods.toNumber();

    const paymentMethodDistribution = [
      {
        name: 'Transferencia / Alias',
        value: Math.round((sumTransfer.toNumber() / totalMethodsNum) * 100),
        amountArs: Math.round(sumTransfer.toNumber()),
        color: '#D0A96B', // Dorado
      },
      {
        name: 'Mercado Pago / Tarjetas',
        value: Math.round((sumDigital.toNumber() / totalMethodsNum) * 100),
        amountArs: Math.round(sumDigital.toNumber()),
        color: '#2E5C47', // Esmeralda
      },
      {
        name: 'Efectivo ARS',
        value: Math.round((sumCashArs.toNumber() / totalMethodsNum) * 100),
        amountArs: Math.round(sumCashArs.toNumber()),
        color: '#F59E0B', // Amber
      },
      {
        name: 'Dólares Billete',
        value: Math.round((sumCashUsd.toNumber() / totalMethodsNum) * 100),
        amountArs: Math.round(sumCashUsd.toNumber()),
        color: '#6366F1', // Indigo
      },
    ];

    // =========================================================================
    // C. TOP 5 FRAGANCIAS MÁS VENDIDAS (MES ACTUAL)
    // =========================================================================
    const curMonthSaleIds = new Set(curMonthSales.map((s) => s.id));
    const curMonthItems = allItems.filter((it) => curMonthSaleIds.has(it.sale_id));

    const productMap = new Map<
      string,
      { name: string; brand: string; salesCount: number; totalRevenueArs: Decimal }
    >();

    curMonthItems.forEach((item) => {
      const pId = item.product_id;
      const qty = Number(item.quantity || 1);
      const rev = new Decimal(Number(item.price_ars_at_moment || 0) * qty);

      const pName = item.products?.name || 'Fragancia Elohim';
      const pBrand = item.products?.brand || 'Elohim Import';

      if (productMap.has(pId)) {
        const existing = productMap.get(pId)!;
        existing.salesCount += qty;
        existing.totalRevenueArs = existing.totalRevenueArs.plus(rev);
      } else {
        productMap.set(pId, {
          name: pName,
          brand: pBrand,
          salesCount: qty,
          totalRevenueArs: rev,
        });
      }
    });

    const sorted = Array.from(productMap.values())
      .sort((a, b) => b.salesCount - a.salesCount)
      .slice(0, 5);

    const topSellingProducts = sorted.map((prod, index) => ({
      rank: index + 1,
      name: prod.name,
      brand: prod.brand,
      salesCount: prod.salesCount,
      totalRevenueArs: Math.round(prod.totalRevenueArs.toNumber()),
    }));

    return {
      success: true,
      data: {
        monthlyRevenueData,
        paymentMethodDistribution,
        topSellingProducts,
        totalCurrentMonthGross: Math.round(totalCurMonthGross.toNumber()),
      },
    };
  } catch (error: unknown) {
    console.error('Error al generar Dashboard Visual:', error);
    const msg = error instanceof Error ? error.message : 'Error al recuperar métricas del Dashboard Visual';
    return {
      success: false,
      error: msg,
    };
  }
}
