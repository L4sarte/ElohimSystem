'use server';

import { getServiceSupabase } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';

/**
 * Obtener todos los clientes con su detalle.
 */
export async function getClientsDetailed(role: UserRole): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error al obtener clientes detallado:', error);
    return { success: false, error: error.message || 'Error al obtener clientes' };
  }
}

/**
 * Crear un nuevo cliente en el sistema.
 */
export async function createClient(
  role: UserRole,
  clientData: { name: string; phone?: string; email?: string; preferred_notes?: string[] }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!clientData.name || clientData.name.trim() === '') {
      throw new Error('El nombre del cliente es obligatorio.');
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase.from('clients').insert([
      {
        name: clientData.name.trim(),
        phone: clientData.phone?.trim() || null,
        email: clientData.email?.trim() || null,
        preferred_notes: clientData.preferred_notes || [],
        total_spent_ars: 0
      }
    ]);

    if (error) {
      throw error;
    }

    revalidatePath('/clientes');
    return { success: true };
  } catch (error: any) {
    console.error('Error al crear cliente:', error);
    return { success: false, error: error.message || 'Error al crear cliente' };
  }
}

/**
 * Actualizar los datos de un cliente (incluyendo el perfil olfativo).
 */
export async function updateClient(
  role: UserRole,
  id: string,
  clientData: { name: string; phone?: string; email?: string; preferred_notes?: string[] }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!clientData.name || clientData.name.trim() === '') {
      throw new Error('El nombre del cliente es obligatorio.');
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from('clients')
      .update({
        name: clientData.name.trim(),
        phone: clientData.phone?.trim() || null,
        email: clientData.email?.trim() || null,
        preferred_notes: clientData.preferred_notes || []
      })
      .eq('id', id);

    if (error) {
      throw error;
    }

    revalidatePath('/clientes');
    return { success: true };
  } catch (error: any) {
    console.error('Error al actualizar cliente:', error);
    return { success: false, error: error.message || 'Error al actualizar cliente' };
  }
}

/**
 * Obtener el historial de compras detallado de un cliente específico.
 */
export async function getClientPurchaseHistory(
  role: UserRole,
  clientId: string
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const supabase = getServiceSupabase();
    
    // Consulta con joins anidados en Supabase
    const { data, error } = await supabase
      .from('sales')
      .select(`
        id,
        created_at,
        total_ars,
        total_usd_equivalent,
        exchange_rate_used,
        payment_methods,
        sale_items (
          id,
          quantity,
          price_ars_at_moment,
          price_usd_at_moment,
          products (
            id,
            name,
            brand,
            sku,
            type
          )
        )
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error al obtener historial de compras:', error);
    return { success: false, error: error.message || 'Error al obtener el historial de compras' };
  }
}
