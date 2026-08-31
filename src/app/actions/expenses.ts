'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth-checks';
import { operatingExpenseInputSchema } from '@/lib/expense-validation';
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
  treasury_account_id?: string | null;
}

/**
 * Obtener lista completa de gastos operativos (Exclusivo Admin).
 */
export async function getExpenses(role?: UserRole): Promise<{
  success: boolean;
  data?: OperatingExpense[];
  error?: string;
}> {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured()) {
      return { success: true, data: [] };
    }

    const serviceClient = getServiceSupabase();
    const { data, error } = await serviceClient
      .from('operating_expenses')
      .select('*')
      .order('expense_date', { ascending: false });

    if (error) throw error;

    return { success: true, data: (data || []) as unknown as OperatingExpense[] };
  } catch (error: unknown) {
    console.error('Error al obtener gastos operativos:', error);
    const msg = error instanceof Error ? error.message : 'Error al obtener gastos operativos';
    return { success: false, error: msg };
  }
}

/**
 * Registrar un nuevo gasto operativo (Exclusivo Admin).
 */
export async function createExpense(
  role: UserRole,
  input: OperatingExpenseInput
): Promise<{ success: boolean; data?: OperatingExpense; error?: string }> {
  try {
    const adminUser = await requireAdmin();

    const validation = operatingExpenseInputSchema.safeParse(input);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Datos de gasto inválidos.';
      return { success: false, error: firstError };
    }

    const clean = validation.data;

    if (!isSupabaseConfigured()) {
      return {
        success: true,
        data: {
          id: 'mock-exp-new',
          category: clean.category,
          amount_ars: clean.amount_ars,
          amount_usd: clean.amount_usd,
          description: clean.description,
          expense_date: clean.expense_date,
          created_by: adminUser.id,
          created_at: new Date().toISOString(),
        },
      };
    }

    const serviceClient = getServiceSupabase();

    const { data, error } = await serviceClient
      .from('operating_expenses')
      .insert([
        {
          category: clean.category,
          amount_ars: clean.amount_ars,
          amount_usd: clean.amount_usd,
          description: clean.description,
          expense_date: clean.expense_date,
          created_by: adminUser.id,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // Descontar automáticamente el dinero de la cuenta de tesorería seleccionada
    let targetAccId = clean.treasury_account_id;
    if (!targetAccId) {
      const resAcc = await getTreasuryAccounts();
      if (resAcc.success && resAcc.data && resAcc.data.length > 0) {
        targetAccId = resAcc.data[0].id;
      }
    }

    if (targetAccId) {
      await withdrawFromAccount(targetAccId, clean.amount_ars);
    }

    revalidatePath('/admin/gastos');
    revalidatePath('/admin/finanzas/tesoreria');
    revalidatePath('/admin/reportes');
    return { success: true, data: data as unknown as OperatingExpense };
  } catch (error: unknown) {
    console.error('Error al crear gasto operativo:', error);
    const msg = error instanceof Error ? error.message : 'Error al registrar el gasto';
    return { success: false, error: msg };
  }
}

/**
 * Actualizar un gasto operativo existente (Exclusivo Admin).
 */
export async function updateExpense(
  role: UserRole,
  id: string,
  input: OperatingExpenseInput
): Promise<{ success: boolean; data?: OperatingExpense; error?: string }> {
  try {
    await requireAdmin();

    if (!id || !id.trim()) {
      throw new Error('ID de gasto obligatorio.');
    }

    const validation = operatingExpenseInputSchema.safeParse(input);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Datos de gasto inválidos.';
      return { success: false, error: firstError };
    }

    const clean = validation.data;

    if (!isSupabaseConfigured()) {
      return {
        success: true,
        data: {
          id: id.trim(),
          category: clean.category,
          amount_ars: clean.amount_ars,
          amount_usd: clean.amount_usd,
          description: clean.description,
          expense_date: clean.expense_date,
          created_at: new Date().toISOString(),
        },
      };
    }

    const serviceClient = getServiceSupabase();
    const { data, error } = await serviceClient
      .from('operating_expenses')
      .update({
        category: clean.category,
        amount_ars: clean.amount_ars,
        amount_usd: clean.amount_usd,
        description: clean.description,
        expense_date: clean.expense_date,
      })
      .eq('id', id.trim())
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/admin/gastos');
    revalidatePath('/admin/reportes');
    return { success: true, data: data as unknown as OperatingExpense };
  } catch (error: unknown) {
    console.error('Error al actualizar gasto:', error);
    const msg = error instanceof Error ? error.message : 'Error al actualizar el gasto';
    return { success: false, error: msg };
  }
}

/**
 * Eliminar un gasto operativo (Exclusivo Admin).
 */
export async function deleteExpense(
  role: UserRole,
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    if (!id || !id.trim()) {
      throw new Error('ID de gasto obligatorio.');
    }

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const serviceClient = getServiceSupabase();
    const { error } = await serviceClient
      .from('operating_expenses')
      .delete()
      .eq('id', id.trim());

    if (error) throw error;

    revalidatePath('/admin/gastos');
    revalidatePath('/admin/reportes');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error al eliminar gasto:', error);
    const msg = error instanceof Error ? error.message : 'Error al eliminar el gasto';
    return { success: false, error: msg };
  }
}
