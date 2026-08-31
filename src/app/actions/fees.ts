'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';
import { requireAdmin, requireAuth } from '@/lib/auth-checks';
import { paymentMethodConfigInputSchema } from '@/lib/sales-validation';

export interface PaymentMethodConfig {
  id: string;
  method_name: string;
  fee_percentage: number;
  fixed_fee_ars: number;
  pass_fee_to_customer: boolean;
  is_active: boolean;
  created_at?: string;

  // Aliases para retrocompatibilidad
  name?: string;
  surcharge_percent?: number;
}

export interface PaymentMethodConfigInput {
  method_name: string;
  fee_percentage: number;
  fixed_fee_ars?: number;
  pass_fee_to_customer?: boolean;
  is_active?: boolean;

  // Aliases para retrocompatibilidad
  name?: string;
  surcharge_percent?: number;
}

interface DbPaymentMethodRow {
  id: string;
  method_name: string;
  fee_percentage: number | null;
  fixed_fee_ars: number | null;
  pass_fee_to_customer: boolean | null;
  is_active: boolean | null;
  created_at: string | null;
}

/**
 * Obtener todos los métodos de pago configurados (para administración).
 */
export async function getPaymentMethodsConfig(role?: UserRole): Promise<{
  success: boolean;
  data?: PaymentMethodConfig[];
  error?: string;
}> {
  try {
    await requireAuth();

    if (!isSupabaseConfigured()) {
      return {
        success: true,
        data: [
          {
            id: 'mock-pm-1',
            method_name: 'Tarjeta de Crédito (3 Cuotas)',
            fee_percentage: 15,
            fixed_fee_ars: 0,
            pass_fee_to_customer: true,
            is_active: true,
            name: 'Tarjeta de Crédito (3 Cuotas)',
            surcharge_percent: 15,
          },
        ],
      };
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('payment_methods_config')
      .select('*')
      .order('method_name', { ascending: true });

    if (error) {
      throw error;
    }

    const rows = (data || []) as unknown as DbPaymentMethodRow[];
    const mappedData: PaymentMethodConfig[] = rows.map((item) => ({
      id: item.id,
      method_name: item.method_name,
      fee_percentage: Number(item.fee_percentage || 0),
      fixed_fee_ars: Number(item.fixed_fee_ars || 0),
      pass_fee_to_customer: Boolean(item.pass_fee_to_customer),
      is_active: Boolean(item.is_active),
      created_at: item.created_at || undefined,
      name: item.method_name,
      surcharge_percent: Number(item.fee_percentage || 0),
    }));

    return { success: true, data: mappedData };
  } catch (error: unknown) {
    console.error('Error al obtener configuración de métodos de pago:', error);
    const msg = error instanceof Error ? error.message : 'Error al obtener métodos de pago';
    return { success: false, error: msg };
  }
}

/**
 * Obtener únicamente los métodos de pago activos (para el POS y CheckoutModal).
 */
export async function getActivePaymentMethods(): Promise<{
  success: boolean;
  data?: PaymentMethodConfig[];
  error?: string;
}> {
  try {
    if (!isSupabaseConfigured()) {
      return {
        success: true,
        data: [
          {
            id: 'mock-pm-1',
            method_name: 'Tarjeta de Crédito (3 Cuotas)',
            fee_percentage: 15,
            fixed_fee_ars: 0,
            pass_fee_to_customer: true,
            is_active: true,
            name: 'Tarjeta de Crédito (3 Cuotas)',
            surcharge_percent: 15,
          },
        ],
      };
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('payment_methods_config')
      .select('*')
      .eq('is_active', true)
      .order('method_name', { ascending: true });

    if (error) {
      throw error;
    }

    const rows = (data || []) as unknown as DbPaymentMethodRow[];
    const mappedData: PaymentMethodConfig[] = rows.map((item) => ({
      id: item.id,
      method_name: item.method_name,
      fee_percentage: Number(item.fee_percentage || 0),
      fixed_fee_ars: Number(item.fixed_fee_ars || 0),
      pass_fee_to_customer: Boolean(item.pass_fee_to_customer),
      is_active: Boolean(item.is_active),
      created_at: item.created_at || undefined,
      name: item.method_name,
      surcharge_percent: Number(item.fee_percentage || 0),
    }));

    return { success: true, data: mappedData };
  } catch (error: unknown) {
    console.error('Error al obtener métodos de pago activos:', error);
    const msg = error instanceof Error ? error.message : 'Error al obtener métodos activos';
    return { success: false, error: msg };
  }
}

/**
 * Crear una nueva regla de comisiones/pasarela (Exclusivo Admin).
 */
export async function createPaymentMethodConfig(
  role: UserRole,
  input: PaymentMethodConfigInput
): Promise<{ success: boolean; data?: PaymentMethodConfig; error?: string }> {
  try {
    await requireAdmin();

    const normalizedInput = {
      ...input,
      method_name: input.method_name || input.name || '',
      fee_percentage: input.fee_percentage !== undefined ? input.fee_percentage : (input.surcharge_percent || 0),
    };

    const validation = paymentMethodConfigInputSchema.safeParse(normalizedInput);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Datos de configuración de pago inválidos.';
      return { success: false, error: firstError };
    }

    const clean = validation.data;

    if (!isSupabaseConfigured()) {
      return {
        success: true,
        data: {
          id: 'mock-new-pm',
          method_name: clean.method_name,
          fee_percentage: clean.fee_percentage,
          fixed_fee_ars: clean.fixed_fee_ars,
          pass_fee_to_customer: clean.pass_fee_to_customer,
          is_active: clean.is_active,
        },
      };
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('payment_methods_config')
      .insert([
        {
          method_name: clean.method_name,
          fee_percentage: clean.fee_percentage,
          fixed_fee_ars: clean.fixed_fee_ars,
          pass_fee_to_customer: clean.pass_fee_to_customer,
          is_active: clean.is_active,
        },
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    revalidatePath('/admin/finanzas/comisiones');
    revalidatePath('/config/pagos');
    return { success: true, data: data as PaymentMethodConfig };
  } catch (error: unknown) {
    console.error('Error al crear configuración de método de pago:', error);
    const msg = error instanceof Error ? error.message : 'Error al crear el método de pago';
    return { success: false, error: msg };
  }
}

/**
 * Actualizar una regla existente de comisiones/pasarela (Exclusivo Admin).
 */
export async function updatePaymentMethodConfig(
  role: UserRole,
  id: string,
  input: PaymentMethodConfigInput
): Promise<{ success: boolean; data?: PaymentMethodConfig; error?: string }> {
  try {
    await requireAdmin();

    if (!id || !id.trim()) {
      throw new Error('Identificador de método de pago no especificado.');
    }

    const normalizedInput = {
      ...input,
      method_name: input.method_name || input.name || '',
      fee_percentage: input.fee_percentage !== undefined ? input.fee_percentage : (input.surcharge_percent || 0),
    };

    const validation = paymentMethodConfigInputSchema.safeParse(normalizedInput);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Datos de configuración de pago inválidos.';
      return { success: false, error: firstError };
    }

    const clean = validation.data;

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('payment_methods_config')
      .update({
        method_name: clean.method_name,
        fee_percentage: clean.fee_percentage,
        fixed_fee_ars: clean.fixed_fee_ars,
        pass_fee_to_customer: clean.pass_fee_to_customer,
        is_active: clean.is_active,
      })
      .eq('id', id.trim())
      .select()
      .single();

    if (error) {
      throw error;
    }

    revalidatePath('/admin/finanzas/comisiones');
    revalidatePath('/config/pagos');
    return { success: true, data: data as PaymentMethodConfig };
  } catch (error: unknown) {
    console.error('Error al actualizar método de pago:', error);
    const msg = error instanceof Error ? error.message : 'Error al actualizar método de pago';
    return { success: false, error: msg };
  }
}

/**
 * Activar o desactivar un método de pago.
 */
export async function togglePaymentMethodStatus(
  role: UserRole,
  id: string,
  is_active: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    if (!id || !id.trim()) {
      throw new Error('Identificador no especificado.');
    }

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from('payment_methods_config')
      .update({ is_active })
      .eq('id', id.trim());

    if (error) {
      throw error;
    }

    revalidatePath('/admin/finanzas/comisiones');
    revalidatePath('/config/pagos');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error al alternar estado de método de pago:', error);
    const msg = error instanceof Error ? error.message : 'Error al cambiar estado';
    return { success: false, error: msg };
  }
}

/**
 * Eliminar un método de pago de la configuración.
 */
export async function deletePaymentMethodConfig(
  role: UserRole,
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    if (!id || !id.trim()) {
      throw new Error('Identificador no especificado.');
    }

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from('payment_methods_config')
      .delete()
      .eq('id', id.trim());

    if (error) {
      throw error;
    }

    revalidatePath('/admin/finanzas/comisiones');
    revalidatePath('/config/pagos');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error al eliminar método de pago:', error);
    const msg = error instanceof Error ? error.message : 'Error al eliminar método';
    return { success: false, error: msg };
  }
}
