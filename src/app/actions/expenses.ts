'use server';

import { getServiceSupabase, supabase } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';

import { withdrawFromAccount, getTreasuryAccounts } from '@/app/actions/treasury';

export interface OperatingExpense {
  id: string;
  category: string;
  amount_ars: number;
  amount_usd: number;
  description: string;
  expense_date: string;
  created_at?: string;
  created_by?: string;
}

export interface OperatingExpenseInput {
  category: string;
  amount_ars: number;
  amount_usd?: number;
  description: string;
  expense_date: string;
  treasury_account_id?: string;
}

/**
 * Resolver ID de usuario para desarrollo local o auth real.
 */
async function resolveUserId(): Promise<string> {
  const serviceClient = getServiceSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return user.id;

  const { data: profiles } = await serviceClient.from('profiles').select('id').limit(1);
  if (profiles && profiles.length > 0) return profiles[0].id;

  return '00000000-0000-0000-0000-000000000000';
}

/**
 * Obtener lista completa de gastos operativos (Exclusivo Admin).
 */
export async function getExpenses(role: UserRole): Promise<{ success: boolean; data?: OperatingExpense[]; error?: string }> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Se requiere rol de Administrador.');
    }

    const serviceClient = getServiceSupabase();
    const { data, error } = await serviceClient
      .from('operating_expenses')
      .select('*')
      .order('expense_date', { ascending: false });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error al obtener gastos operativos:', error);
    return { success: false, error: error.message || 'Error al obtener gastos operativos' };
  }
}

/**
 * Registrar un nuevo gasto operativo.
 */
export async function createExpense(
  role: UserRole,
  input: OperatingExpenseInput
): Promise<{ success: boolean; data?: OperatingExpense; error?: string }> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Se requiere rol de Administrador.');
    }

    if (!input.description || input.description.trim() === '') {
      throw new Error('La descripción del gasto es obligatoria.');
    }

    if (input.amount_ars <= 0) {
      throw new Error('El monto en ARS debe ser mayor a cero.');
    }

    const userId = await resolveUserId();
    const serviceClient = getServiceSupabase();

    const { data, error } = await serviceClient
      .from('operating_expenses')
      .insert([
        {
          category: input.category || 'Varios',
          amount_ars: Math.max(0, input.amount_ars),
          amount_usd: Math.max(0, input.amount_usd || 0),
          description: input.description.trim(),
          expense_date: input.expense_date || new Date().toISOString().split('T')[0],
          created_by: userId
        }
      ])
      .select()
      .single();

    if (error) throw error;

    // Descontar automáticamente el dinero de la cuenta de tesorería seleccionada
    let targetAccId = input.treasury_account_id;
    if (!targetAccId) {
      const resAcc = await getTreasuryAccounts();
      if (resAcc.success && resAcc.data && resAcc.data.length > 0) {
        targetAccId = resAcc.data[0].id;
      }
    }

    if (targetAccId) {
      await withdrawFromAccount(targetAccId, Math.max(0, input.amount_ars));
    }

    revalidatePath('/admin/gastos');
    revalidatePath('/admin/finanzas/tesoreria');
    revalidatePath('/admin/reportes');
    return { success: true, data };
  } catch (error: any) {
    console.error('Error al crear gasto operativo:', error);
    return { success: false, error: error.message || 'Error al registrar el gasto' };
  }
}

/**
 * Actualizar un gasto operativo existente.
 */
export async function updateExpense(
  role: UserRole,
  id: string,
  input: OperatingExpenseInput
): Promise<{ success: boolean; data?: OperatingExpense; error?: string }> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación no autorizada.');
    }

    const serviceClient = getServiceSupabase();
    const { data, error } = await serviceClient
      .from('operating_expenses')
      .update({
        category: input.category || 'Varios',
        amount_ars: Math.max(0, input.amount_ars),
        amount_usd: Math.max(0, input.amount_usd || 0),
        description: input.description.trim(),
        expense_date: input.expense_date
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/admin/gastos');
    revalidatePath('/admin/reportes');
    return { success: true, data };
  } catch (error: any) {
    console.error('Error al actualizar gasto:', error);
    return { success: false, error: error.message || 'Error al actualizar el gasto' };
  }
}

/**
 * Eliminar un gasto operativo.
 */
export async function deleteExpense(role: UserRole, id: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación no autorizada.');
    }

    const serviceClient = getServiceSupabase();
    const { error } = await serviceClient
      .from('operating_expenses')
      .delete()
      .eq('id', id);

    if (error) throw error;

    revalidatePath('/admin/gastos');
    revalidatePath('/admin/reportes');
    return { success: true };
  } catch (error: any) {
    console.error('Error al eliminar gasto:', error);
    return { success: false, error: error.message || 'Error al eliminar el gasto' };
  }
}
