'use server';

import { getServiceSupabase } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';

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

/**
 * Obtener todas las cuentas de tesorería activas.
 */
export async function getTreasuryAccounts(): Promise<{ success: boolean; data?: TreasuryAccount[]; error?: string }> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('treasury_accounts')
      .select('*')
      .eq('is_active', true)
      .order('account_name', { ascending: true });

    if (error) throw error;

    return { 
      success: true, 
      data: (data || []).map(acc => ({
        ...acc,
        balance_ars: Number(acc.balance_ars || 0)
      }))
    };
  } catch (error: any) {
    console.error('Error al obtener cuentas de tesorería:', error);
    return { success: false, error: error.message || 'Error al consultar tesorería' };
  }
}

/**
 * Crear una nueva cuenta bancaria / billetera virtual en Tesorería.
 */
export async function createTreasuryAccount(
  role: UserRole,
  input: { account_name: string; account_type: string; initial_balance_ars?: number }
): Promise<{ success: boolean; data?: TreasuryAccount; error?: string }> {
  try {
    if (role !== 'admin') {
      throw new Error('Solo los administradores pueden crear cuentas de tesorería.');
    }

    if (!input.account_name || !input.account_name.trim()) {
      throw new Error('El nombre de la cuenta es obligatorio.');
    }

    const supabase = getServiceSupabase();
    const initialBalance = Math.round(Number(input.initial_balance_ars || 0));

    const { data, error } = await supabase
      .from('treasury_accounts')
      .insert([
        {
          account_name: input.account_name.trim(),
          account_type: input.account_type || 'wallet',
          balance_ars: initialBalance,
          is_active: true
        }
      ])
      .select('*')
      .single();

    if (error) throw error;

    revalidatePath('/admin/finanzas/tesoreria');
    return { success: true, data };
  } catch (error: any) {
    console.error('Error al crear cuenta de tesorería:', error);
    return { success: false, error: error.message || 'Error al crear cuenta' };
  }
}

/**
 * Realizar un ajuste manual directo en el saldo de una cuenta.
 */
export async function updateAccountBalance(
  role: UserRole,
  accountId: string,
  newBalanceArs: number,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación restringida a Administradores.');
    }

    if (!accountId) throw new Error('ID de cuenta no proporcionado.');
    if (isNaN(newBalanceArs)) throw new Error('Saldo inválido.');

    const supabase = getServiceSupabase();

    const { error } = await supabase
      .from('treasury_accounts')
      .update({ balance_ars: Math.round(newBalanceArs) })
      .eq('id', accountId);

    if (error) throw error;

    revalidatePath('/admin/finanzas/tesoreria');
    revalidatePath('/pos');
    return { success: true };
  } catch (error: any) {
    console.error('Error al ajustar saldo de cuenta:', error);
    return { success: false, error: error.message || 'Error al ajustar saldo' };
  }
}

/**
 * Transferir fondos de forma atómica entre dos cuentas de tesorería.
 */
export async function transferBetweenAccounts(
  role: UserRole,
  fromAccountId: string,
  toAccountId: string,
  amountArs: number,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!fromAccountId || !toAccountId) {
      throw new Error('Debes seleccionar cuenta origen y cuenta destino.');
    }

    if (fromAccountId === toAccountId) {
      throw new Error('La cuenta de origen y destino no pueden ser la misma.');
    }

    const amount = Math.round(Number(amountArs || 0));
    if (amount <= 0) {
      throw new Error('El monto a transferir debe ser mayor a $0 ARS.');
    }

    const supabase = getServiceSupabase();

    // 1. Obtener la cuenta de origen
    const { data: fromAcc, error: fromErr } = await supabase
      .from('treasury_accounts')
      .select('*')
      .eq('id', fromAccountId)
      .single();

    if (fromErr || !fromAcc) throw new Error('No se encontró la cuenta de origen.');

    // 2. Obtener la cuenta de destino
    const { data: toAcc, error: toErr } = await supabase
      .from('treasury_accounts')
      .select('*')
      .eq('id', toAccountId)
      .single();

    if (toErr || !toAcc) throw new Error('No se encontró la cuenta de destino.');

    const currentFromBal = Number(fromAcc.balance_ars || 0);
    const currentToBal = Number(toAcc.balance_ars || 0);

    // 3. Actualizar Origen (Descontar)
    const { error: updFromErr } = await supabase
      .from('treasury_accounts')
      .update({ balance_ars: currentFromBal - amount })
      .eq('id', fromAccountId);

    if (updFromErr) throw updFromErr;

    // 4. Actualizar Destino (Acreditar)
    const { error: updToErr } = await supabase
      .from('treasury_accounts')
      .update({ balance_ars: currentToBal + amount })
      .eq('id', toAccountId);

    if (updToErr) throw updToErr;

    revalidatePath('/admin/finanzas/tesoreria');
    revalidatePath('/pos');
    return { success: true };
  } catch (error: any) {
    console.error('Error al realizar transferencia entre cuentas:', error);
    return { success: false, error: error.message || 'Error al transferir fondos' };
  }
}

/**
 * Helper interno para impactar un ingreso o egreso en una cuenta de tesorería determinada.
 */
export async function depositToAccount(accountId: string, amountArs: number): Promise<boolean> {
  try {
    if (!accountId || amountArs <= 0) return false;
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
