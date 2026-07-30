'use server';

import { getServiceSupabase } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';
import { getFinancialReport } from '@/app/actions/analytics';

export interface MonthlyProjectionData {
  periodMonth: string;
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

/**
 * Obtener la proyección matemática del mes en curso (Run Rate) y el estado de cumplimiento de metas.
 */
export async function getMonthlyProjection(role: UserRole): Promise<{
  success: boolean;
  data?: MonthlyProjectionData;
  error?: string;
}> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Se requiere rol de Administrador.');
    }

    const supabase = getServiceSupabase();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed
    const periodMonth = `${year}-${String(month + 1).padStart(2, '0')}`;

    const currentDay = Math.max(1, now.getDate());
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const remainingDays = Math.max(0, totalDaysInMonth - currentDay);

    const isoStart = new Date(year, month, 1).toISOString();
    const isoEnd = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    // 1. Obtener ventas activas del mes
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select('total_ars')
      .gte('created_at', isoStart)
      .lte('created_at', isoEnd)
      .neq('status', 'voided');

    if (salesError) throw salesError;

    let currentRevenueArs = 0;
    (sales || []).forEach((s: any) => {
      currentRevenueArs += Number(s.total_ars || 0);
    });

    // 2. Obtener Ganancia Neta del mes desde analytics
    const reportRes = await getFinancialReport(role, 'current_month');
    const currentNetProfitArs = reportRes.data ? reportRes.data.netProfit : currentRevenueArs * 0.35;

    // 3. Consultar meta guardada en monthly_goals
    const { data: goalData } = await supabase
      .from('monthly_goals')
      .select('revenue_goal_ars, net_profit_goal_ars')
      .eq('period_month', periodMonth)
      .maybeSingle();

    const revenueGoalArs = goalData?.revenue_goal_ars ? Number(goalData.revenue_goal_ars) : 5000000;
    const netProfitGoalArs = goalData?.net_profit_goal_ars ? Number(goalData.net_profit_goal_ars) : 2000000;

    // 4. Run Rate Matemático: (Monto Actual / Días Transcurridos) * Días Totales del Mes
    const runRateRevenueArs = Math.round((currentRevenueArs / currentDay) * totalDaysInMonth);
    const runRateNetProfitArs = Math.round((currentNetProfitArs / currentDay) * totalDaysInMonth);

    // Módulos de facturación diaria necesaria para alcanzar la meta
    const pendingRevenue = Math.max(0, revenueGoalArs - currentRevenueArs);
    const dailyRevenueNeeded = remainingDays > 0 ? Math.round(pendingRevenue / remainingDays) : 0;

    const revenueProgressPercent = revenueGoalArs > 0 ? Number(((currentRevenueArs / revenueGoalArs) * 100).toFixed(1)) : 0;
    const profitProgressPercent = netProfitGoalArs > 0 ? Number(((currentNetProfitArs / netProfitGoalArs) * 100).toFixed(1)) : 0;
    const runRatePercent = revenueGoalArs > 0 ? Number(((runRateRevenueArs / revenueGoalArs) * 100).toFixed(1)) : 0;

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
 * Establecer o actualizar las metas mensuales del negocio.
 */
export async function setMonthlyGoal(
  role: UserRole,
  periodMonth: string,
  revenueGoalArs: number,
  netProfitGoalArs: number
): Promise<{ success: boolean; error?: string }> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Se requiere rol de Administrador.');
    }

    if (!periodMonth || isNaN(revenueGoalArs) || isNaN(netProfitGoalArs)) {
      throw new Error('Parámetros de meta mensual inválidos.');
    }

    const supabase = getServiceSupabase();

    // Intentar upsert en monthly_goals
    const { data: existing } = await supabase
      .from('monthly_goals')
      .select('id')
      .eq('period_month', periodMonth)
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
