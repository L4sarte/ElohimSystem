'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth-checks';
import { revalidatePath } from 'next/cache';
import { withdrawFromAccount } from '@/lib/treasury-ops';

export interface OwnerDrawRecord {
  id: string;
  created_at: string;
  amount_ars: number;
  amount_usd?: number | null;
  exchange_rate_used?: number | null;
  account_source_id: string;
  notes?: string | null;
  account_name?: string;
}

export interface RegisterOwnerDrawInput {
  amountArs: number;
  accountSourceId: string;
  amountUsd?: number;
  exchangeRateUsed?: number;
  notes?: string;
}

/**
 * Registra una extracción o retiro personal del dueño contra una cuenta de Tesorería.
 * REGLA CRÍTICA: NO impacta en la tabla de OPEX/Gastos Operativos (expenses),
 * garantizando la pureza del balance contable y la división de utilidades.
 */
export async function registerOwnerDraw(
  input: RegisterOwnerDrawInput
): Promise<{ success: boolean; data?: OwnerDrawRecord; error?: string }> {
  try {
    await requireAdmin();

    const { amountArs, accountSourceId, amountUsd, exchangeRateUsed, notes } = input;

    if (!amountArs || amountArs <= 0) {
      return { success: false, error: 'El monto a retirar debe ser mayor a $0 ARS.' };
    }

    if (!accountSourceId) {
      return { success: false, error: 'Debes seleccionar una cuenta de origen de Tesorería.' };
    }

    const roundedAmount = Math.round(amountArs);

    if (!isSupabaseConfigured()) {
      return {
        success: true,
        data: {
          id: 'mock-draw-' + Date.now(),
          created_at: new Date().toISOString(),
          amount_ars: roundedAmount,
          amount_usd: amountUsd,
          exchange_rate_used: exchangeRateUsed,
          account_source_id: accountSourceId,
          notes: notes || 'Retiro de utilidades personales (Modo Demo)',
        },
      };
    }

    const supabase = getServiceSupabase();

    // 1. Intentar registrar a través del RPC transaccional atómico
    const { data: rpcData, error: rpcError } = await supabase.rpc('register_owner_draw', {
      p_amount_ars: roundedAmount,
      p_account_source_id: accountSourceId,
      p_amount_usd: amountUsd ? Number(amountUsd.toFixed(2)) : null,
      p_exchange_rate_used: exchangeRateUsed ? Number(exchangeRateUsed.toFixed(2)) : null,
      p_notes: notes || null,
    });

    if (!rpcError && rpcData?.success) {
      revalidatePath('/');
      revalidatePath('/admin/finanzas/tesoreria');
      revalidatePath('/admin/configuracion');
      revalidatePath('/settings');

      return {
        success: true,
        data: {
          id: rpcData.draw_id,
          created_at: new Date().toISOString(),
          amount_ars: roundedAmount,
          amount_usd: amountUsd,
          exchange_rate_used: exchangeRateUsed,
          account_source_id: accountSourceId,
          notes,
          account_name: rpcData.account_name,
        },
      };
    }

    if (rpcError) {
      console.warn('[OWNER_DRAW_RPC_FALLBACK] RPC falló o no existe, aplicando fallback con trazabilidad:', rpcError.message);
    }

    // 2. Fallback de alta disponibilidad
    // Verificar cuenta y saldo
    const { data: acc, error: accErr } = await supabase
      .from('treasury_accounts')
      .select('id, account_name, balance_ars')
      .eq('id', accountSourceId)
      .single();

    if (accErr || !acc) {
      return { success: false, error: 'La cuenta de tesorería de origen no fue encontrada.' };
    }

    const currentBal = Number(acc.balance_ars || 0);
    if (currentBal < roundedAmount) {
      return {
        success: false,
        error: `Saldo insuficiente en "${acc.account_name}". Disponible: $${currentBal.toLocaleString('es-AR')} ARS.`,
      };
    }

    // Descontar fondos de tesorería con trazabilidad
    const withdrawOk = await withdrawFromAccount(
      accountSourceId,
      roundedAmount,
      `Retiro Personal / División de Utilidades: ${notes || 'Sueldo de socio'}`
    );

    if (!withdrawOk) {
      return { success: false, error: 'No se pudo debitar el saldo de la cuenta de tesorería.' };
    }

    // Insertar en tabla owner_draws
    const { data: drawRecord, error: insertErr } = await supabase
      .from('owner_draws')
      .insert([
        {
          amount_ars: roundedAmount,
          amount_usd: amountUsd ? Number(amountUsd.toFixed(2)) : null,
          exchange_rate_used: exchangeRateUsed ? Number(exchangeRateUsed.toFixed(2)) : null,
          account_source_id: accountSourceId,
          notes: notes || null,
        },
      ])
      .select('*')
      .single();

    if (insertErr) {
      console.error('[OWNER_DRAW_INSERT_WARN]: Error al guardar en owner_draws:', insertErr);
    }

    revalidatePath('/');
    revalidatePath('/admin/finanzas/tesoreria');
    revalidatePath('/admin/configuracion');
    revalidatePath('/settings');

    return {
      success: true,
      data: {
        id: drawRecord?.id || 'draw-' + Date.now(),
        created_at: drawRecord?.created_at || new Date().toISOString(),
        amount_ars: roundedAmount,
        amount_usd: amountUsd,
        exchange_rate_used: exchangeRateUsed,
        account_source_id: accountSourceId,
        notes,
        account_name: acc.account_name,
      },
    };
  } catch (err: unknown) {
    console.error('Error al registrar retiro personal:', err);
    const msg = err instanceof Error ? err.message : 'Error inesperado al procesar el retiro personal';
    return { success: false, error: msg };
  }
}

/**
 * Consulta el listado de retiros personales registrados.
 */
export async function getOwnerDraws(limit = 20): Promise<{
  success: boolean;
  data: OwnerDrawRecord[];
  error?: string;
}> {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured()) {
      return { success: true, data: [] };
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('owner_draws')
      .select('*, treasury_accounts(account_name)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[GET_OWNER_DRAWS_WARN]:', error.message);
      return { success: true, data: [] };
    }

    const formatted: OwnerDrawRecord[] = (data || []).map((row: any) => ({
      id: row.id,
      created_at: row.created_at,
      amount_ars: Number(row.amount_ars),
      amount_usd: row.amount_usd ? Number(row.amount_usd) : null,
      exchange_rate_used: row.exchange_rate_used ? Number(row.exchange_rate_used) : null,
      account_source_id: row.account_source_id,
      notes: row.notes,
      account_name: row.treasury_accounts?.account_name || 'Cuenta General',
    }));

    return { success: true, data: formatted };
  } catch (err: unknown) {
    console.error('Error al obtener retiros personales:', err);
    return { success: true, data: [] };
  }
}

/**
 * Obtiene el total de retiros efectuados durante el mes en curso.
 */
export async function getMonthOwnerDrawsTotal(): Promise<{
  totalArs: number;
  totalUsd: number;
  count: number;
}> {
  try {
    if (!isSupabaseConfigured()) {
      return { totalArs: 0, totalUsd: 0, count: 0 };
    }

    const supabase = getServiceSupabase();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data, error } = await supabase
      .from('owner_draws')
      .select('amount_ars, amount_usd')
      .gte('created_at', startOfMonth);

    if (error || !data) {
      return { totalArs: 0, totalUsd: 0, count: 0 };
    }

    let totalArs = 0;
    let totalUsd = 0;

    for (const item of data) {
      totalArs += Number(item.amount_ars || 0);
      totalUsd += Number(item.amount_usd || 0);
    }

    return {
      totalArs: Math.round(totalArs),
      totalUsd: Number(totalUsd.toFixed(2)),
      count: data.length,
    };
  } catch {
    return { totalArs: 0, totalUsd: 0, count: 0 };
  }
}
