'use server';

import { getServiceSupabase } from '@/lib/supabase';
import { UserRole } from '@/types';
import { requireAdmin } from '@/lib/auth-checks';
import { calculateFinancialTotals, resolveItemUnitCost } from '@/lib/financial-calculations';
import { buildRecipeFallbackMap } from '@/lib/recipe-fallback';
import { resolveBusinessRange, businessDayKey } from '@/lib/date-utils';
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
  itemsWithoutCostCount?: number;
  itemsWithoutCostNames?: string[];
  warningMessage?: string | null;
  trendData: Array<{
    date: string;
    ingresos: number;
    gananciaReal: number;
    gananciaNeta: number;
    ganancia: number;
  }>;
  categoryBreakdown: Array<{
    name: string;
    value: number;
  }>;
}

export type SalesChannelFilter = 'all' | 'pos' | 'storefront' | 'whatsapp';

interface SaleRow {
  id: string;
  total_ars?: number | null;
  payment_methods?: any;
  created_at?: string | null;
  status?: string | null;
  gateway_fee_ars?: number | null;
  channel?: string | null;
}

interface SaleItemRow {
  id?: string;
  sale_id: string;
  product_id: string;
  quantity?: number | null;
  price_ars_at_moment?: number | null;
  unit_cost_at_moment?: number | null;
  products?: {
    id: string;
    name: string;
    brand?: string | null;
    sku?: string | null;
    type?: string | null;
    base_cost_ars?: number | null;
  } | null;
}

interface ExpenseRow {
  category?: string | null;
  amount_ars?: number | null;
  expense_date?: string | null;
}

/**
 * Normaliza nombres de categorías de OPEX (trim + colapso de espacios + casing)
 * para evitar conceptos duplicados ("Alquiler ", "alquiler", "ALQUILER" -> "Alquiler").
 */
function normalizeOpexCategory(raw: string | null | undefined): string {
  const trimmed = (raw || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'Varios';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

/**
 * Generar Reporte Financiero Completo y Estado de Resultados para Administradores.
 */
export async function getFinancialReport(
  role: UserRole,
  range: 'current_month' | 'previous_month' | 'last_30_days' | 'last_90_days' | 'current_year' | 'custom' = 'current_month',
  customStartDate?: string,
  customEndDate?: string,
  channel: SalesChannelFilter = 'all'
): Promise<{ success: boolean; data?: FinancialReportData; error?: string }> {
  try {
    await requireAdmin();

    const serviceClient = getServiceSupabase();

    // Rango de negocio ART (zona horaria comercial) — consistente en todo el sistema
    const businessRange = resolveBusinessRange(range, customStartDate, customEndDate);
    const isoStart = businessRange.start.toISOString();
    const isoEnd = businessRange.end.toISOString();
    const dateStartString = businessRange.startDay;
    const dateEndString = businessRange.endDay;

    // 1. Consultas CONCURRENTES: ventas + OPEX + Cuentas por Cobrar + Devoluciones
    // (las tres últimas son independientes de la cadena de ventas: eliminada la cascada secuencial)
    const [salesRes, expensesRes, pendingReceivablesRes, returnsRes] = await Promise.all([
      serviceClient
        .from('sales')
        .select('id, total_ars, payment_methods, created_at, status, gateway_fee_ars')
        .gte('created_at', isoStart)
        .lte('created_at', isoEnd)
        .neq('status', 'voided')
        .neq('status', 'pending_payment')
        .order('created_at', { ascending: true }),
      serviceClient
        .from('operating_expenses')
        .select('category, amount_ars, expense_date')
        .gte('expense_date', dateStartString)
        .lte('expense_date', dateEndString),
      serviceClient
        .from('accounts_receivable')
        .select('total_amount_ars, paid_amount_ars')
        .in('status', ['pending', 'overdue']),
      serviceClient
        .from('returns')
        .select('refund_amount_ars')
        .gte('created_at', isoStart)
        .lte('created_at', isoEnd),
    ]);

    if (salesRes.error) throw salesRes.error;
    if (expensesRes.error) throw expensesRes.error;
    let sales = (salesRes.data || []) as unknown as SaleRow[];
    const expenses = (expensesRes.data || []) as unknown as ExpenseRow[];

    // Filtrar ventas por canal si no es 'all'
    if (channel !== 'all') {
      sales = sales.filter((s) => {
        const directChannel = ((s as any).channel || '').toLowerCase();
        const pmChannel = (s.payment_methods?.channel || '').toLowerCase();

        if (channel === 'pos') {
          return (
            directChannel === 'pos' ||
            pmChannel === 'pos' ||
            (!directChannel && !pmChannel)
          );
        }
        if (channel === 'storefront') {
          return (
            directChannel === 'online' ||
            directChannel === 'storefront' ||
            pmChannel === 'online' ||
            pmChannel === 'storefront'
          );
        }
        if (channel === 'whatsapp') {
          return (
            directChannel === 'whatsapp_store' ||
            directChannel === 'whatsapp' ||
            pmChannel === 'whatsapp_store' ||
            pmChannel === 'whatsapp'
          );
        }
        return true;
      });
    }

    // 2. Consultar ítems de ventas para calcular el COGS real usando la Cadena de Resolución
    const saleIds = sales.map((s) => s.id);
    let totalCogsDecimal = new Decimal(0);
    const saleCogsMap: Record<string, Decimal> = {};
    const unassignedCostProducts: string[] = [];
    const estimatedWithoutRecipeProducts: string[] = [];
    let warningMessage: string | null = null;

    if (saleIds.length > 0) {
      let { data: saleItemsData, error: itemsError } = await serviceClient
        .from('sale_items')
        .select(`
          id,
          sale_id,
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
        .in('sale_id', saleIds);

      // Si la columna unit_cost_at_moment aún no fue agregada por el DDL en Supabase, reintentar sin ella
      if (itemsError && itemsError.message?.includes('unit_cost_at_moment')) {
        const fallbackRes = await serviceClient
          .from('sale_items')
          .select(`
            id,
            sale_id,
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
          .in('sale_id', saleIds);
        saleItemsData = fallbackRes.data as any;
        itemsError = fallbackRes.error;
      }

      if (itemsError) {
        console.error('Error al consultar ítems de venta:', itemsError);
      } else if (saleItemsData) {
        const saleItems = saleItemsData as unknown as SaleItemRow[];

        // Identificar productos que requieren búsqueda en PO items (Fallback 4)
        const missingCostProductIds = new Set<string>();
        saleItems.forEach((item) => {
          const catCost = Number(item.products?.base_cost_ars || 0);
          const momentCost = Number(item.unit_cost_at_moment || 0);
          if (catCost <= 0 && momentCost <= 0 && item.product_id) {
            missingCostProductIds.add(item.product_id);
          }
        });

        // Fallback 4: Consultar último costo registrado en purchase_order_items
        const poCostMap: Record<string, Decimal> = {};
        if (missingCostProductIds.size > 0) {
          const { data: poItems } = await serviceClient
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

          // Ejecutar cadena de resolución inteligente canónica
          const recipeInfo = recipeFallbackMap[item.product_id];
          const costResolution = resolveItemUnitCost({
            itemUnitCostAtMoment: item.unit_cost_at_moment,
            productBaseCostArs: item.products?.base_cost_ars,
            lastPurchaseOrderCostArs: poCostMap[item.product_id]?.toNumber(),
            productType: item.products?.type,
            decantMl: recipeInfo?.sizeMl ?? null,
            supplyCostArs: recipeInfo?.supplyCostArs ?? null,
          });

          if (!costResolution.hasCost) {
            const pName = item.products?.name || `Producto ID ${item.product_id}`;
            if (!unassignedCostProducts.includes(pName)) {
              unassignedCostProducts.push(pName);
            }
          } else if (costResolution.source === 'decant_calculated' && !recipeFallbackMap[item.product_id]) {
            // Costo ESTIMADO con constantes por defecto: sin receta BOM que resuelva el tamaño real
            const pName = item.products?.name || `Producto ID ${item.product_id}`;
            if (!estimatedWithoutRecipeProducts.includes(pName)) {
              estimatedWithoutRecipeProducts.push(pName);
            }
          }

          const unitCostDecimal = new Decimal(costResolution.unitCost);
          const itemTotalCost = unitCostDecimal.times(qty);

          totalCogsDecimal = totalCogsDecimal.plus(itemTotalCost);

          if (!saleCogsMap[item.sale_id]) {
            saleCogsMap[item.sale_id] = new Decimal(0);
          }
          saleCogsMap[item.sale_id] = saleCogsMap[item.sale_id].plus(itemTotalCost);
        });

        if (unassignedCostProducts.length > 0) {
          warningMessage = `${unassignedCostProducts.length} producto(s) sin costo base configurado (${unassignedCostProducts.slice(0, 3).join(', ')}${unassignedCostProducts.length > 3 ? '...' : ''})`;
        }

        if (estimatedWithoutRecipeProducts.length > 0) {
          const estMsg = `${estimatedWithoutRecipeProducts.length} producto(s) decant con costo ESTIMADO (sin receta BOM: ${estimatedWithoutRecipeProducts.slice(0, 3).join(', ')}${estimatedWithoutRecipeProducts.length > 3 ? '...' : ''})`;
          warningMessage = warningMessage ? `${warningMessage}. ${estMsg}` : estMsg;
        }
      }
    }

    // 3. Procesar ventas diarias y comisiones de pasarela
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

      // Agrupar por día para gráfico de tendencia (clave de día de negocio ART)
      const dayKey = businessDayKey(s.created_at);

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

      const cat = normalizeOpexCategory(e.category);
      if (!catMap[cat]) {
        catMap[cat] = new Decimal(0);
      }
      catMap[cat] = catMap[cat].plus(amt);

      // Asignar OPEX al mapa diario si corresponde (clave de día de negocio ART)
      if (e.expense_date) {
        const dayKey = businessDayKey(e.expense_date);
        if (dailyMap[dayKey]) {
          dailyMap[dayKey].opex = dailyMap[dayKey].opex.plus(amt);
        }
      }
    });

    // 5. Cuentas por Cobrar globales activas (Dinero en la calle)
    // Acotada por status activo (pending/overdue): sin registros cerrados.
    // Nota: sin LIMIT deliberadamente — truncar rompería la SUMA exacta de deuda;
    // el bounding a escala = agregación SQL (pendiente de migración si se requiere).
    const totalAmountDueGlobal = (pendingReceivablesRes.data || []).reduce(
      (sum: number, r: any) => sum + Math.max(0, Number(r.total_amount_ars || 0) - Number(r.paid_amount_ars || 0)),
      0
    );

    // 6. Devoluciones del Período (consultadas concurrentemente al inicio)
    const totalRefundsArs = (returnsRes.data || []).reduce(
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

    // 8. Formatear datos para gráficos Recharts (ganancia comercial real y ganancia neta calculadas exactamente)
    const trendData = Object.keys(dailyMap).map((date) => {
      const day = dailyMap[date];
      const dailyGross = day.ingresos;
      const dailyGrossProfit = dailyGross.minus(day.cogs);
      const dailyNet = dailyGrossProfit.minus(day.fees).minus(day.opex);
      return {
        date,
        ingresos: Math.round(dailyGross.toNumber()),
        gananciaReal: Math.round(dailyGrossProfit.toNumber()),
        gananciaNeta: Math.round(dailyNet.toNumber()),
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
        itemsWithoutCostCount: unassignedCostProducts.length,
        itemsWithoutCostNames: unassignedCostProducts,
        warningMessage,
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
