'use server';

import { getServiceSupabase } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';

export interface SupplierInput {
  name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

/**
 * Obtener la lista completa de proveedores.
 */
export async function getSuppliers(role: UserRole): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error al obtener proveedores:', error);
    return { success: false, error: error.message || 'Error al obtener proveedores' };
  }
}

/**
 * Crear un nuevo proveedor en el sistema B2B (Exclusivo Admin).
 */
export async function createSupplier(
  role: UserRole,
  supplierData: SupplierInput
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Se requiere rol de Administrador.');
    }

    if (!supplierData.name || supplierData.name.trim() === '') {
      throw new Error('El nombre del proveedor o razón social es obligatorio.');
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('suppliers')
      .insert([
        {
          name: supplierData.name.trim(),
          contact_name: supplierData.contact_name?.trim() || null,
          phone: supplierData.phone?.trim() || null,
          email: supplierData.email?.trim() || null,
          notes: supplierData.notes?.trim() || null
        }
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    revalidatePath('/compras');
    revalidatePath('/compras/proveedores');
    revalidatePath('/compras/nueva');
    return { success: true, data };
  } catch (error: any) {
    console.error('Error al crear proveedor:', error);
    return { success: false, error: error.message || 'Error al crear el proveedor' };
  }
}
