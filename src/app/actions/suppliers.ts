'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';
import { requireAuth, requireAdmin } from '@/lib/auth-checks';
import { supplierInputSchema } from '@/lib/purchase-validation';

export interface SupplierInput {
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface SupplierRecord {
  id: string;
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  created_at: string;
}

/**
 * Obtener la lista completa de proveedores.
 */
export async function getSuppliers(role?: UserRole): Promise<{
  success: boolean;
  data?: SupplierRecord[];
  error?: string;
}> {
  try {
    await requireAuth();

    if (!isSupabaseConfigured()) {
      return {
        success: true,
        data: [
          {
            id: 'mock-sup-1',
            name: 'Distribuidora Fragance SA',
            contact_name: 'Roberto Gómez',
            phone: '+54 11 4455-6677',
            email: 'ventas@fragancesa.com',
            notes: 'Proveedor oficial Creed y Lattafa',
            created_at: new Date().toISOString(),
          },
        ],
      };
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    return { success: true, data: (data || []) as unknown as SupplierRecord[] };
  } catch (error: unknown) {
    console.error('Error al obtener proveedores:', error);
    const msg = error instanceof Error ? error.message : 'Error al obtener proveedores';
    return { success: false, error: msg };
  }
}

/**
 * Crear un nuevo proveedor en el sistema B2B (Exclusivo Admin).
 */
export async function createSupplier(
  role: UserRole,
  supplierData: SupplierInput
): Promise<{ success: boolean; data?: SupplierRecord; error?: string }> {
  try {
    await requireAdmin();

    const validation = supplierInputSchema.safeParse(supplierData);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Datos del proveedor inválidos.';
      return { success: false, error: firstError };
    }

    const clean = validation.data;

    if (!isSupabaseConfigured()) {
      return {
        success: true,
        data: {
          id: 'mock-sup-new',
          name: clean.name,
          contact_name: clean.contact_name || null,
          phone: clean.phone || null,
          email: clean.email || null,
          notes: clean.notes || null,
          created_at: new Date().toISOString(),
        },
      };
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('suppliers')
      .insert([
        {
          name: clean.name,
          contact_name: clean.contact_name || null,
          phone: clean.phone || null,
          email: clean.email || null,
          notes: clean.notes || null,
        },
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    revalidatePath('/compras');
    revalidatePath('/compras/proveedores');
    revalidatePath('/compras/nueva');
    return { success: true, data: data as unknown as SupplierRecord };
  } catch (error: unknown) {
    console.error('Error al crear proveedor:', error);
    const msg = error instanceof Error ? error.message : 'Error al crear el proveedor';
    return { success: false, error: msg };
  }
}
