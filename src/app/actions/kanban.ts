'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth-checks';
import { kanbanOrderInputSchema, kanbanStatusEnum } from '@/lib/logistics-validation';

export type KanbanOrderStatus = 'pending' | 'processing' | 'ready' | 'delivered';

export interface KanbanOrder {
  id: string;
  client_name: string;
  product_details?: string | null;
  total_ars: number;
  status: KanbanOrderStatus;
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
}

interface DbKanbanRow {
  id: string;
  client_name: string;
  product_details?: string | null;
  total_ars: number;
  status: KanbanOrderStatus;
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
}

/**
 * Obtener todas las tarjetas de pedidos del tablero Kanban.
 */
export async function getKanbanOrders(role?: UserRole): Promise<{
  success: boolean;
  data?: KanbanOrder[];
  error?: string;
}> {
  try {
    await requireAuth();

    if (!isSupabaseConfigured()) {
      return { success: true, data: [] };
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('kanban_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = (data || []) as unknown as DbKanbanRow[];
    const list: KanbanOrder[] = rows.map((item) => ({
      ...item,
      total_ars: Number(item.total_ars || 0),
    }));

    return { success: true, data: list };
  } catch (error: unknown) {
    console.error('Error al consultar pedidos Kanban:', error);
    const msg = error instanceof Error ? error.message : 'Error al obtener pedidos';
    return { success: false, error: msg };
  }
}

/**
 * Registrar un nuevo pedido informal (WhatsApp / Instagram).
 */
export async function createKanbanOrder(
  role: UserRole,
  orderData: {
    client_name: string;
    product_details?: string;
    total_ars?: number;
    status?: string;
    notes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth();

    const validation = kanbanOrderInputSchema.safeParse(orderData);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Datos de pedido inválidos.';
      return { success: false, error: firstError };
    }

    const clean = validation.data;

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase.from('kanban_orders').insert({
      client_name: clean.client_name,
      product_details: clean.product_details || null,
      total_ars: clean.total_ars,
      status: clean.status,
      notes: clean.notes || null,
    });

    if (error) throw error;

    revalidatePath('/kanban');
    revalidatePath('/gestion/pedidos');
    revalidatePath('/');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error al crear pedido en Kanban:', error);
    const msg = error instanceof Error ? error.message : 'Error al registrar pedido';
    return { success: false, error: msg };
  }
}

/**
 * Actualizar el estado de la tarjeta del pedido (ej. mover de 'pending' a 'processing').
 */
export async function updateOrderStatus(
  role: UserRole,
  id: string,
  newStatus: KanbanOrderStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth();

    if (!id || !id.trim()) {
      throw new Error('ID de pedido requerido.');
    }

    const statusValidation = kanbanStatusEnum.safeParse(newStatus);
    if (!statusValidation.success) {
      throw new Error('Estado de pedido inválido.');
    }

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from('kanban_orders')
      .update({
        status: statusValidation.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id.trim());

    if (error) throw error;

    revalidatePath('/kanban');
    revalidatePath('/gestion/pedidos');
    revalidatePath('/');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error al actualizar estado del pedido:', error);
    const msg = error instanceof Error ? error.message : 'Error al mover pedido';
    return { success: false, error: msg };
  }
}

/**
 * Eliminar una tarjeta de pedido del tablero Kanban.
 */
export async function deleteKanbanOrder(
  role: UserRole,
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth();

    if (!id || !id.trim()) {
      throw new Error('ID de pedido requerido.');
    }

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from('kanban_orders')
      .delete()
      .eq('id', id.trim());

    if (error) throw error;

    revalidatePath('/kanban');
    revalidatePath('/gestion/pedidos');
    revalidatePath('/');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error al eliminar pedido del Kanban:', error);
    const msg = error instanceof Error ? error.message : 'Error al eliminar pedido';
    return { success: false, error: msg };
  }
}
