'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth-checks';
import { clientInputSchema } from '@/lib/client-validation';

export interface ClientRecord {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  preferred_notes?: string[] | null;
  total_spent_ars: number;
  points_balance?: number;
  created_at: string;
}

export interface ClientSaleHistoryRecord {
  id: string;
  created_at: string;
  total_ars: number;
  total_usd_equivalent: number;
  exchange_rate_used: number;
  payment_methods?: string[];
  sale_items: Array<{
    id: string;
    quantity: number;
    price_ars_at_moment: number;
    price_usd_at_moment: number;
    products?: {
      id: string;
      name: string;
      brand: string;
      sku: string;
      type: string;
    } | null;
  }>;
}

/**
 * Obtener todos los clientes con su detalle.
 */
export async function getClientsDetailed(role?: UserRole): Promise<{
  success: boolean;
  data?: ClientRecord[];
  error?: string;
}> {
  try {
    await requireAuth();

    if (!isSupabaseConfigured()) {
      return {
        success: true,
        data: [
          {
            id: 'mock-client-1',
            name: 'Juan Pérez',
            phone: '+54 9 11 1234-5678',
            email: 'juan.perez@example.com',
            preferred_notes: ['Cítrico', 'Amaderado'],
            total_spent_ars: 45000,
            points_balance: 450,
            created_at: new Date().toISOString(),
          },
        ],
      };
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    return { success: true, data: (data || []) as unknown as ClientRecord[] };
  } catch (error: unknown) {
    console.error('Error al obtener clientes detallado:', error);
    const msg = error instanceof Error ? error.message : 'Error al obtener clientes';
    return { success: false, error: msg };
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
    await requireAuth();

    const validation = clientInputSchema.safeParse(clientData);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Datos de cliente inválidos.';
      return { success: false, error: firstError };
    }

    const clean = validation.data;

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase.from('clients').insert([
      {
        name: clean.name,
        phone: clean.phone || null,
        email: clean.email || null,
        preferred_notes: clean.preferred_notes || [],
        total_spent_ars: 0,
      },
    ]);

    if (error) {
      throw error;
    }

    revalidatePath('/clientes');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error al crear cliente:', error);
    const msg = error instanceof Error ? error.message : 'Error al crear cliente';
    return { success: false, error: msg };
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
    await requireAuth();

    if (!id || !id.trim()) {
      throw new Error('ID de cliente obligatorio.');
    }

    const validation = clientInputSchema.safeParse(clientData);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Datos de cliente inválidos.';
      return { success: false, error: firstError };
    }

    const clean = validation.data;

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from('clients')
      .update({
        name: clean.name,
        phone: clean.phone || null,
        email: clean.email || null,
        preferred_notes: clean.preferred_notes || [],
      })
      .eq('id', id.trim());

    if (error) {
      throw error;
    }

    revalidatePath('/clientes');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error al actualizar cliente:', error);
    const msg = error instanceof Error ? error.message : 'Error al actualizar cliente';
    return { success: false, error: msg };
  }
}

/**
 * Obtener el historial de compras detallado de un cliente específico.
 */
export async function getClientPurchaseHistory(
  role: UserRole,
  clientId: string
): Promise<{ success: boolean; data?: ClientSaleHistoryRecord[]; error?: string }> {
  try {
    await requireAuth();

    if (!clientId || !clientId.trim()) {
      throw new Error('ID de cliente obligatorio.');
    }

    if (!isSupabaseConfigured()) {
      return { success: true, data: [] };
    }

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
      .eq('client_id', clientId.trim())
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return { success: true, data: (data || []) as unknown as ClientSaleHistoryRecord[] };
  } catch (error: unknown) {
    console.error('Error al obtener historial de compras:', error);
    const msg = error instanceof Error ? error.message : 'Error al obtener el historial de compras';
    return { success: false, error: msg };
  }
}
