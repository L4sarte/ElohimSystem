import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

/**
 * Helpers internos de impacto monetario en tesorería con trazabilidad.
 *
 * NOTA DE SEGURIDAD: Este módulo NO lleva la directiva 'use server'.
 * Sus funciones NO son invocables desde el navegador como endpoints HTTP:
 * solo pueden ser utilizadas por Server Actions que ya validaron sesión/rol
 * mediante requireAuth()/requireAdmin().
 */

/**
 * Impacta un ingreso en una cuenta de tesorería determinada con trazabilidad.
 * Solo debe llamarse desde Server Actions previamente autenticadas.
 */
export async function depositToAccount(
  accountId: string,
  amountArs: number,
  description?: string,
  referenceId?: string
): Promise<boolean> {
  try {
    if (!accountId || amountArs <= 0) return false;
    if (!isSupabaseConfigured()) return true;

    const supabase = getServiceSupabase();
    const roundedAmount = Math.round(amountArs);

    // 1. RPC transaccional: ajuste atómico de saldo + asiento de auditoría en un solo bloque SQL.
    const { error: rpcError } = await supabase.rpc('adjust_treasury_balance', {
      p_account_id: accountId,
      p_delta_ars: roundedAmount,
      p_movement_type: 'in',
      p_description: description || 'Ingreso por cobro comercial',
      p_reference_id: referenceId || null,
    });

    if (!rpcError) {
      revalidatePath('/admin/finanzas/tesoreria');
      return true;
    }

    console.warn('[TREASURY_OPS_DEPOSIT_FALLBACK]: RPC adjust_treasury_balance falló, aplicando ajuste directo:', rpcError.message);

    // 2. Fallback de alta disponibilidad ante problemas de RPC
    const { data: acc, error: accErr } = await supabase
      .from('treasury_accounts')
      .select('balance_ars')
      .eq('id', accountId)
      .single();

    if (accErr || !acc) {
      console.error('[TREASURY_OPS_ACCOUNT_NOT_FOUND]: Cuenta de tesorería no hallada:', accountId, accErr);
      return false;
    }

    const currentBal = Number(acc.balance_ars || 0);
    const newBal = currentBal + roundedAmount;

    const { error: updErr } = await supabase
      .from('treasury_accounts')
      .update({ balance_ars: newBal })
      .eq('id', accountId);

    if (updErr) {
      console.error('[TREASURY_OPS_DIRECT_UPDATE_FAILED]:', updErr);
      return false;
    }

    // Insertar asiento compatible tanto con columna amount como amount_ars
    await supabase.from('treasury_movements').insert([
      {
        account_id: accountId,
        type: 'in',
        amount: roundedAmount,
        amount_ars: roundedAmount,
        description: description || 'Ingreso por cobro comercial',
        reference_id: referenceId || null,
      },
    ]);

    revalidatePath('/admin/finanzas/tesoreria');
    return true;
  } catch (err) {
    console.error('Error al acreditar en cuenta de tesorería:', err);
    return false;
  }
}

/**
 * Debita fondos de una cuenta de tesorería con trazabilidad.
 * Solo debe llamarse desde Server Actions previamente autenticadas.
 */
export async function withdrawFromAccount(
  accountId: string,
  amountArs: number,
  description?: string,
  referenceId?: string
): Promise<boolean> {
  try {
    if (!accountId || amountArs <= 0) return false;
    if (!isSupabaseConfigured()) return true;

    const supabase = getServiceSupabase();
    const roundedAmount = Math.round(amountArs);

    // 1. RPC transaccional: ajuste atómico de saldo + asiento de auditoría en un solo bloque SQL.
    const { error: rpcError } = await supabase.rpc('adjust_treasury_balance', {
      p_account_id: accountId,
      p_delta_ars: -roundedAmount,
      p_movement_type: 'out',
      p_description: description || 'Egreso de tesorería',
      p_reference_id: referenceId || null,
    });

    if (!rpcError) {
      revalidatePath('/admin/finanzas/tesoreria');
      return true;
    }

    console.warn('[TREASURY_OPS_WITHDRAW_FALLBACK]: RPC adjust_treasury_balance falló, aplicando ajuste directo:', rpcError.message);

    // 2. Fallback de alta disponibilidad ante problemas de RPC
    const { data: acc, error: accErr } = await supabase
      .from('treasury_accounts')
      .select('balance_ars, account_name')
      .eq('id', accountId)
      .single();

    if (accErr || !acc) {
      console.error('[TREASURY_OPS_ACCOUNT_NOT_FOUND]: Cuenta de tesorería no hallada:', accountId, accErr);
      return false;
    }

    const currentBal = Number(acc.balance_ars || 0);
    const newBal = currentBal - roundedAmount;

    if (newBal < 0) {
      console.error('[TREASURY_OPS_INSUFFICIENT_FUNDS]: Saldo insuficiente en cuenta:', acc.account_name);
      return false;
    }

    const { error: updErr } = await supabase
      .from('treasury_accounts')
      .update({ balance_ars: newBal })
      .eq('id', accountId);

    if (updErr) {
      console.error('[TREASURY_OPS_DIRECT_UPDATE_FAILED]:', updErr);
      return false;
    }

    await supabase.from('treasury_movements').insert([
      {
        account_id: accountId,
        type: 'out',
        amount: roundedAmount,
        amount_ars: roundedAmount,
        description: description || 'Egreso de tesorería',
        reference_id: referenceId || null,
      },
    ]);

    revalidatePath('/admin/finanzas/tesoreria');
    return true;
  } catch (err) {
    console.error('Error al debitar de cuenta de tesorería:', err);
    return false;
  }
}
