'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';
import { requireAdmin, requireAuth } from '@/lib/auth-checks';
import {
  createTreasuryAccountSchema,
  updateAccountBalanceSchema,
  treasuryTransferSchema,
} from '@/lib/cash-validation';

export interface TreasuryAccount {
  id: string;
  account_name: string;
  account_type: string; // 'cash' | 'wallet' | 'bank'
  balance_ars: number;
  is_active: boolean;
  created_at: string;
}

export interface TreasuryMovement {
  id: string;
  account_id: string;
  type: 'in' | 'out' | 'transfer';
  amount_ars: number;
  description: string;
  created_at: string;
}

interface DbTreasuryAccountRow {
  id: string;
  account_name: string;
  account_type: string;
  balance_ars: number | null;
  is_active: boolean | null;
  created_at: string;
}

/**
 * Obtener todas las cuentas de tesorería activas.
 */
export async function getTreasuryAccounts(): Promise<{
  success: boolean;
  data?: TreasuryAccount[];
  error?: string;
}> {
  try {
    await requireAuth();

    if (!isSupabaseConfigured()) {
      return {
        success: true,
        data: [
          {
            id: 'mock-acc-1',
            account_name: 'Caja Efectivo Local',
            account_type: 'cash',
            balance_ars: 150000,
            is_active: true,
            created_at: new Date().toISOString(),
          },
          {
            id: 'mock-acc-2',
            account_name: 'Mercado Pago Principal',
            account_type: 'wallet',
            balance_ars: 450000,
            is_active: true,
            created_at: new Date().toISOString(),
          },
        ],
      };
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('treasury_accounts')
      .select('*')
      .eq('is_active', true)
      .order('account_name', { ascending: true });

    if (error) throw error;

    const rows = (data || []) as unknown as DbTreasuryAccountRow[];
    return {
      success: true,
      data: rows.map((acc) => ({
        id: acc.id,
        account_name: acc.account_name,
        account_type: acc.account_type,
        balance_ars: Number(acc.balance_ars || 0),
        is_active: Boolean(acc.is_active),
        created_at: acc.created_at,
      })),
    };
  } catch (error: unknown) {
    console.error('Error al obtener cuentas de tesorería:', error);
    const msg = error instanceof Error ? error.message : 'Error al consultar tesorería';
    return { success: false, error: msg };
  }
}

/**
 * Crear una nueva cuenta bancaria / billetera virtual en Tesorería (Solo Admin).
 */
export async function createTreasuryAccount(
  role: UserRole,
  input: { account_name: string; account_type: string; initial_balance_ars?: number }
): Promise<{ success: boolean; data?: TreasuryAccount; error?: string }> {
  try {
    await requireAdmin();

    const validation = createTreasuryAccountSchema.safeParse({
      account_name: input.account_name,
      account_type: input.account_type,
      initial_balance_ars: input.initial_balance_ars || 0,
    });

    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Datos de cuenta inválidos.';
      return { success: false, error: firstError };
    }

    const { account_name, account_type, initial_balance_ars } = validation.data;

    if (!isSupabaseConfigured()) {
      return {
        success: true,
        data: {
          id: 'mock-acc-new',
          account_name,
          account_type,
          balance_ars: Math.round(initial_balance_ars),
          is_active: true,
          created_at: new Date().toISOString(),
        },
      };
    }

    const supabase = getServiceSupabase();
    const initialBalance = Math.round(initial_balance_ars);

    const { data, error } = await supabase
      .from('treasury_accounts')
      .insert([
        {
          account_name,
          account_type,
          balance_ars: initialBalance,
          is_active: true,
        },
      ])
      .select('*')
      .single();

    if (error) throw error;

    revalidatePath('/admin/finanzas/tesoreria');
    return { success: true, data: data as unknown as TreasuryAccount };
  } catch (error: unknown) {
    console.error('Error al crear cuenta de tesorería:', error);
    const msg = error instanceof Error ? error.message : 'Error al crear cuenta';
    return { success: false, error: msg };
  }
}

/**
 * Realizar un ajuste manual directo en el saldo de una cuenta (Solo Admin).
 */
export async function updateAccountBalance(
  role: UserRole,
  accountId: string,
  newBalanceArs: number,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    const validation = updateAccountBalanceSchema.safeParse({
      accountId,
      newBalanceArs,
      reason,
    });

    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Parámetros de ajuste inválidos.';
      return { success: false, error: firstError };
    }

    const clean = validation.data;

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const supabase = getServiceSupabase();

    const { error } = await supabase
      .from('treasury_accounts')
      .update({ balance_ars: Math.round(clean.newBalanceArs) })
      .eq('id', clean.accountId);

    if (error) throw error;

    revalidatePath('/admin/finanzas/tesoreria');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error al ajustar saldo de cuenta:', error);
    const msg = error instanceof Error ? error.message : 'Error al ajustar saldo';
    return { success: false, error: msg };
  }
}

/**
 * Transferir fondos de forma atómica entre dos cuentas de tesorería (Solo Admin).
 */
export async function transferBetweenAccounts(
  role: UserRole,
  fromAccountId: string,
  toAccountId: string,
  amountArs: number,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    const validation = treasuryTransferSchema.safeParse({
      fromAccountId,
      toAccountId,
      amount_ars: amountArs,
      notes,
    });

    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Datos de transferencia inválidos.';
      return { success: false, error: firstError };
    }

    const clean = validation.data;
    const amount = Math.round(clean.amount_ars);

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const supabase = getServiceSupabase();

    // 1. Obtener la cuenta de origen
    const { data: fromAcc, error: fromErr } = await supabase
      .from('treasury_accounts')
      .select('*')
      .eq('id', clean.fromAccountId)
      .single();

    if (fromErr || !fromAcc) throw new Error('No se encontró la cuenta de origen.');

    // 2. Obtener la cuenta de destino
    const { data: toAcc, error: toErr } = await supabase
      .from('treasury_accounts')
      .select('*')
      .eq('id', clean.toAccountId)
      .single();

    if (toErr || !toAcc) throw new Error('No se encontró la cuenta de destino.');

    const currentFromBal = Number(fromAcc.balance_ars || 0);
    const currentToBal = Number(toAcc.balance_ars || 0);

    // 3. Validar disponibilidad de fondos en origen
    if (currentFromBal < amount) {
      throw new Error(`Saldo insuficiente en "${fromAcc.account_name}". Disponible: $${currentFromBal.toLocaleString('es-AR')} ARS.`);
    }

    // 4. Actualizar Origen (Descontar)
    const { error: updFromErr } = await supabase
      .from('treasury_accounts')
      .update({ balance_ars: currentFromBal - amount })
      .eq('id', clean.fromAccountId);

    if (updFromErr) throw updFromErr;

    // 5. Actualizar Destino (Acreditar) con Rollback Preventivo
    const { error: updToErr } = await supabase
      .from('treasury_accounts')
      .update({ balance_ars: currentToBal + amount })
      .eq('id', clean.toAccountId);

    if (updToErr) {
      // Revertir descuento en origen para preservar integridad de datos
      await supabase
        .from('treasury_accounts')
        .update({ balance_ars: currentFromBal })
        .eq('id', clean.fromAccountId);
      throw updToErr;
    }

    revalidatePath('/admin/finanzas/tesoreria');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error al realizar transferencia entre cuentas:', error);
    const msg = error instanceof Error ? error.message : 'Error al transferir fondos';
    return { success: false, error: msg };
  }
}

/**
 * Helper interno para impactar un ingreso en una cuenta de tesorería determinada.
 */
export async function depositToAccount(accountId: string, amountArs: number): Promise<boolean> {
  try {
    if (!accountId || amountArs <= 0) return false;
    if (!isSupabaseConfigured()) return true;

    const supabase = getServiceSupabase();

    const { data: acc } = await supabase
      .from('treasury_accounts')
      .select('balance_ars')
      .eq('id', accountId)
      .single();

    if (!acc) return false;

    const newBalance = Number(acc.balance_ars || 0) + Math.round(amountArs);

    await supabase
      .from('treasury_accounts')
      .update({ balance_ars: newBalance })
      .eq('id', accountId);

    return true;
  } catch (err) {
    console.error('Error al acreditar en cuenta de tesorería:', err);
    return false;
  }
}

/**
 * Helper interno para debitar fondos de una cuenta de tesorería.
 */
export async function withdrawFromAccount(accountId: string, amountArs: number): Promise<boolean> {
  try {
    if (!accountId || amountArs <= 0) return false;
    if (!isSupabaseConfigured()) return true;

    const supabase = getServiceSupabase();

    const { data: acc } = await supabase
      .from('treasury_accounts')
      .select('balance_ars')
      .eq('id', accountId)
      .single();

    if (!acc) return false;

    const newBalance = Number(acc.balance_ars || 0) - Math.round(amountArs);

    await supabase
      .from('treasury_accounts')
      .update({ balance_ars: newBalance })
      .eq('id', accountId);

    return true;
  } catch (err) {
    console.error('Error al debitar de cuenta de tesorería:', err);
    return false;
  }
}
