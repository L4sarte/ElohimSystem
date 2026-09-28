'use server';

import { getServiceSupabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth-checks';
import { businessMonthRange } from '@/lib/date-utils';
import { revalidatePath } from 'next/cache';
import { getFinancialReport } from '@/app/actions/analytics';

export interface MonthlyProjectionData {
  periodMonth: string; // "2026-08"
  year: number;        // 2026
  month: number;       // 8 (1-12)
  monthName: string;   // "Agosto 2026"
  isClosed: boolean;
  currentDay: number;
  totalDaysInMonth: number;
  remainingDays: number;
  currentRevenueArs: number;
  currentNetProfitArs: number;
  revenueGoalArs: number;
  netProfitGoalArs: number;
  runRateRevenueArs: number;
  runRateNetProfitArs: number;
  dailyRevenueNeeded: number;
  revenueProgressPercent: number;
  profitProgressPercent: number;
  runRatePercent: number;
  status: 'on_track' | 'warning' | 'behind';
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/**
 * Obtener la proyección matemática del periodo seleccionado y su meta correspondiente en monthly_goals.
 */
export async function getMonthlyProjection(
  startDate?: string,
  endDate?: string
): Promise<{
  success: boolean;
  data?: MonthlyProjectionData;
  error?: string;
}> {
  try {
    // Seguridad: el rol SIEMPRE se deriva de la sesión autenticada (nunca de parámetros del cliente)
    const adminUser = await requireAdmin();

    const supabase = getServiceSupabase();
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth0 = today.getMonth(); // 0-11

    // Determinar el año y mes objetivo según el filtro de fecha (startDate o fecha actual)
    let targetYear = currentYear;
    let targetMonth0 = currentMonth0;

    if (startDate) {
      const [sYear, sMonth] = startDate.split('-').map(Number);
      if (sYear && sMonth) {
        targetYear = sYear;
        targetMonth0 = sMonth - 1; // Convertir a 0-indexed
      }
    }

    const monthNum = targetMonth0 + 1; // 1-12
    const periodMonth = `${targetYear}-${String(monthNum).padStart(2, '0')}`;
    const monthName = `${MONTH_NAMES[targetMonth0]} ${targetYear}`;

    // Determinar si el periodo está CERRADO (mes pasado), ES EL MES ACTUAL o FUTURO
    const isPastMonth = (targetYear < currentYear) || (targetYear === currentYear && targetMonth0 < currentMonth0);
    const isCurrentMonth = (targetYear === currentYear && targetMonth0 === currentMonth0);
    const isClosed = isPastMonth;

    const totalDaysInMonth = new Date(targetYear, targetMonth0 + 1, 0).getDate();
    let currentDay = totalDaysInMonth;
    let remainingDays = 0;

    if (isCurrentMonth) {
      currentDay = Math.max(1, today.getDate());
      remainingDays = Math.max(0, totalDaysInMonth - currentDay);
    }

    // Rango de negocio ART del mes objetivo (consistente intra-llamada:
    // la query de ventas y el P&L usan EXACTAMENTE el mismo rango de negocio)
    const monthRange = businessMonthRange(targetYear, targetMonth0);
    const isoStart = monthRange.start.toISOString();
    const isoEnd = monthRange.end.toISOString();

    // 1. Consultas CONCURRENTES: ventas del mes + P&L del mes (mismo rango de negocio ART)
    const [salesRes, reportRes] = await Promise.all([
      supabase
        .from('sales')
        .select('total_ars')
        .gte('created_at', isoStart)
        .lte('created_at', isoEnd)
        .neq('status', 'voided')
        .neq('status', 'pending_payment'),
      getFinancialReport(adminUser.role, 'custom', monthRange.startDay, monthRange.endDay),
    ]);

    if (salesRes.error) throw salesRes.error;
    const sales = salesRes.data;

    let currentRevenueArs = 0;
    (sales || []).forEach((s: any) => {
      currentRevenueArs += Number(s.total_ars || 0);
    });
    // 2. Ganancia Neta REAL del periodo objetivo (si el P&L falla NO se inventa ganancia:
    // se retorna error explícito, nunca números ficticios)
    if (!reportRes.success || !reportRes.data) {
      console.error('[MONTHLY_PROJECTION_PNL_FAILED]:', reportRes.error);
      return {
        success: false,
        error: 'No se pudo calcular el Estado de Resultados del período. No se generan proyecciones sobre datos estimados; revisá los datos de ventas e inténtalo nuevamente.',
      };
    }
    const currentNetProfitArs = reportRes.data.netProfit;

    // 3. Consultar meta guardada en monthly_goals para este mes y año específico
    let revenueGoalArs = 5000000;
    let netProfitGoalArs = 2000000;

    const { data: goalData } = await supabase
      .from('monthly_goals')
      .select('revenue_goal_ars, net_profit_goal_ars')
      .or(`period_month.eq.${periodMonth},and(month.eq.${monthNum},year.eq.${targetYear})`)
      .maybeSingle();

    if (goalData) {
      revenueGoalArs = Number(goalData.revenue_goal_ars || 5000000);
      netProfitGoalArs = Number(goalData.net_profit_goal_ars || 2000000);
    }

    // 4. Proyección Run Rate y Avances
    const revenueProgressPercent = revenueGoalArs > 0 ? Number(((currentRevenueArs / revenueGoalArs) * 100).toFixed(1)) : 0;
    const profitProgressPercent = netProfitGoalArs > 0 ? Number(((currentNetProfitArs / netProfitGoalArs) * 100).toFixed(1)) : 0;

    let runRateRevenueArs = currentRevenueArs;
    let runRateNetProfitArs = currentNetProfitArs;
    let dailyRevenueNeeded = 0;
    let runRatePercent = revenueProgressPercent;

    if (!isClosed) {
      // Mes en curso: calcular Run Rate Proyectado
      runRateRevenueArs = Math.round((currentRevenueArs / currentDay) * totalDaysInMonth);
      runRateNetProfitArs = Math.round((currentNetProfitArs / currentDay) * totalDaysInMonth);
      const pendingRevenue = Math.max(0, revenueGoalArs - currentRevenueArs);
      dailyRevenueNeeded = remainingDays > 0 ? Math.round(pendingRevenue / remainingDays) : 0;
      runRatePercent = revenueGoalArs > 0 ? Number(((runRateRevenueArs / revenueGoalArs) * 100).toFixed(1)) : 0;
    }

    let status: 'on_track' | 'warning' | 'behind' = 'on_track';
    if (runRatePercent < 75) {
      status = 'behind';
    } else if (runRatePercent < 95) {
      status = 'warning';
    }

    return {
      success: true,
      data: {
        periodMonth,
        year: targetYear,
        month: monthNum,
        monthName,
        isClosed,
        currentDay,
        totalDaysInMonth,
        remainingDays,
        currentRevenueArs: Math.round(currentRevenueArs),
        currentNetProfitArs: Math.round(currentNetProfitArs),
        revenueGoalArs,
        netProfitGoalArs,
        runRateRevenueArs,
        runRateNetProfitArs,
        dailyRevenueNeeded,
        revenueProgressPercent,
        profitProgressPercent,
        runRatePercent,
        status
      }
    };
  } catch (error: any) {
    console.error('Error al calcular proyección mensual de ventas:', error);
    return { success: false, error: error.message || 'Error al obtener proyecciones del mes' };
  }
}

/**
 * Establecer o actualizar la meta para un mes y año específico en monthly_goals.
 */
export async function setMonthlyGoal(
  periodMonth: string,
  revenueGoalArs: number,
  netProfitGoalArs: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Seguridad: el rol SIEMPRE se deriva de la sesión autenticada (nunca de parámetros del cliente)
    await requireAdmin();

    if (!periodMonth || isNaN(revenueGoalArs) || isNaN(netProfitGoalArs)) {
      throw new Error('Parámetros de meta mensual inválidos.');
    }

    const [yearStr, monthStr] = periodMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      throw new Error('Formato de mes/año inválido.');
    }

    const supabase = getServiceSupabase();

    // Buscar si ya existe la meta para este mes y año
    const { data: existing } = await supabase
      .from('monthly_goals')
      .select('id')
      .or(`period_month.eq.${periodMonth},and(month.eq.${month},year.eq.${year})`)
      .maybeSingle();

    if (existing) {
      const { error: updateErr } = await supabase
        .from('monthly_goals')
        .update({
          revenue_goal_ars: revenueGoalArs,
          net_profit_goal_ars: netProfitGoalArs,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (updateErr) throw updateErr;
    } else {
      const { error: insertErr } = await supabase
        .from('monthly_goals')
        .insert({
          month,
          year,
          period_month: periodMonth,
          revenue_goal_ars: revenueGoalArs,
          net_profit_goal_ars: netProfitGoalArs
        });

      if (insertErr) throw insertErr;
    }

    revalidatePath('/');
    revalidatePath('/admin/reportes');

    return { success: true };
  } catch (error: any) {
    console.error('Error al guardar meta mensual:', error);
    return { success: false, error: error.message || 'Error al guardar meta del mes' };
  }
}
