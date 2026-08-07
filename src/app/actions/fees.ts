'use server';

import { getServiceSupabase } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';

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

/**
 * Obtener todos los métodos de pago configurados (para administración).
 */
export async function getPaymentMethodsConfig(role: UserRole): Promise<{ success: boolean; data?: PaymentMethodConfig[]; error?: string }> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('payment_methods_config')
      .select('*')
      .order('method_name', { ascending: true });

    if (error) {
      throw error;
    }

    const mappedData = (data || []).map((item: any) => ({
      ...item,
      fee_percentage: Number(item.fee_percentage || 0),
      fixed_fee_ars: Number(item.fixed_fee_ars || 0),
      pass_fee_to_customer: Boolean(item.pass_fee_to_customer),
      is_active: Boolean(item.is_active),
      name: item.method_name,
      surcharge_percent: Number(item.fee_percentage || 0)
    }));

    return { success: true, data: mappedData };
  } catch (error: any) {
    console.error('Error al obtener configuración de métodos de pago:', error);
    return { success: false, error: error.message || 'Error al obtener métodos de pago' };
  }
}

/**
 * Obtener únicamente los métodos de pago activos (para el POS y CheckoutModal).
 */
export async function getActivePaymentMethods(): Promise<{ success: boolean; data?: PaymentMethodConfig[]; error?: string }> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('payment_methods_config')
      .select('*')
      .eq('is_active', true)
      .order('method_name', { ascending: true });

    if (error) {
      throw error;
    }

    const mappedData = (data || []).map((item: any) => ({
      ...item,
      fee_percentage: Number(item.fee_percentage || 0),
      fixed_fee_ars: Number(item.fixed_fee_ars || 0),
      pass_fee_to_customer: Boolean(item.pass_fee_to_customer),
      is_active: Boolean(item.is_active),
      name: item.method_name,
      surcharge_percent: Number(item.fee_percentage || 0)
    }));

    return { success: true, data: mappedData };
  } catch (error: any) {
    console.error('Error al obtener métodos de pago activos:', error);
    return { success: false, error: error.message || 'Error al obtener métodos activos' };
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
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Se requiere rol de Administrador.');
    }

    const name = input.method_name || input.name || '';
    if (!name.trim()) {
      throw new Error('El nombre comercial del método de pago es obligatorio.');
    }

    const feePct = input.fee_percentage !== undefined ? input.fee_percentage : (input.surcharge_percent || 0);

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('payment_methods_config')
      .insert([
        {
          method_name: name.trim(),
          fee_percentage: Math.max(0, Number(feePct || 0)),
          fixed_fee_ars: Math.max(0, Number(input.fixed_fee_ars || 0)),
          pass_fee_to_customer: input.pass_fee_to_customer !== undefined ? input.pass_fee_to_customer : false,
          is_active: input.is_active !== undefined ? input.is_active : true
        }
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    revalidatePath('/admin/finanzas/comisiones');
    revalidatePath('/config/pagos');
    return { success: true, data };
  } catch (error: any) {
    console.error('Error al crear configuración de método de pago:', error);
    return { success: false, error: error.message || 'Error al crear el método de pago' };
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
    if (role !== 'admin') {
      throw new Error('Operación no autorizada.');
    }

    const name = input.method_name || input.name || '';
    if (!name.trim()) {
      throw new Error('El nombre comercial del método de pago es obligatorio.');
    }

    const feePct = input.fee_percentage !== undefined ? input.fee_percentage : (input.surcharge_percent || 0);

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('payment_methods_config')
      .update({
        method_name: name.trim(),
        fee_percentage: Math.max(0, Number(feePct || 0)),
        fixed_fee_ars: Math.max(0, Number(input.fixed_fee_ars || 0)),
        pass_fee_to_customer: input.pass_fee_to_customer !== undefined ? input.pass_fee_to_customer : false,
        is_active: input.is_active !== undefined ? input.is_active : true
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    revalidatePath('/admin/finanzas/comisiones');
    revalidatePath('/config/pagos');
    return { success: true, data };
  } catch (error: any) {
    console.error('Error al actualizar método de pago:', error);
    return { success: false, error: error.message || 'Error al actualizar método de pago' };
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
    if (role !== 'admin') {
      throw new Error('Operación no autorizada.');
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from('payment_methods_config')
      .update({ is_active })
      .eq('id', id);

    if (error) {
      throw error;
    }

    revalidatePath('/admin/finanzas/comisiones');
    revalidatePath('/config/pagos');
    return { success: true };
  } catch (error: any) {
    console.error('Error al alternar estado de método de pago:', error);
    return { success: false, error: error.message || 'Error al cambiar estado' };
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
    if (role !== 'admin') {
      throw new Error('Operación no autorizada.');
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from('payment_methods_config')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    revalidatePath('/admin/finanzas/comisiones');
    revalidatePath('/config/pagos');
    return { success: true };
  } catch (error: any) {
    console.error('Error al eliminar método de pago:', error);
    return { success: false, error: error.message || 'Error al eliminar método' };
  }
}
