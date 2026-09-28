import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';

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

    // RPC transaccional: ajuste atómico de saldo + asiento de auditoría en un solo bloque SQL.
    // Elimina la carrera READ-MODIFY-WRITE (cobros concurrentes perdían deltas)
    // y el asiento silencioso perdido (la columna 'amount' no existía).
    const { error } = await supabase.rpc('adjust_treasury_balance', {
      p_account_id: accountId,
      p_delta_ars: Math.round(amountArs),
      p_movement_type: 'in',
      p_description: description || 'Ingreso por cobro comercial',
      p_reference_id: referenceId || null,
    });

    if (error) {
      throw error;
    }

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

    // RPC transaccional: ajuste atómico de saldo + asiento de auditoría en un solo bloque SQL.
    // Rechaza saldos finales negativos (antes se permitían en silencio).
    const { error } = await supabase.rpc('adjust_treasury_balance', {
      p_account_id: accountId,
      p_delta_ars: -Math.round(amountArs),
      p_movement_type: 'out',
      p_description: description || 'Egreso de tesorería',
      p_reference_id: referenceId || null,
    });

    if (error) {
      throw error;
    }

    return true;
  } catch (err) {
    console.error('Error al debitar de cuenta de tesorería:', err);
    return false;
  }
}
