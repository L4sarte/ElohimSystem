'use server';

import { getServiceSupabase } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';

export interface KanbanOrder {
  id: string;
  client_name: string;
  product_details?: string;
  total_ars: number;
  status: 'pending' | 'processing' | 'ready' | 'delivered';
  notes?: string;
  created_at: string;
  updated_at?: string;
}

/**
 * Obtener todas las tarjetas de pedidos del tablero Kanban.
 */
export async function getKanbanOrders(role: UserRole): Promise<{
  success: boolean;
  data?: KanbanOrder[];
  error?: string;
}> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('kanban_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const list: KanbanOrder[] = (data || []).map((item: any) => ({
      ...item,
      total_ars: Number(item.total_ars || 0)
    }));

    return { success: true, data: list };
  } catch (error: any) {
    console.error('Error al consultar pedidos Kanban:', error);
    return { success: false, error: error.message || 'Error al obtener pedidos' };
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
    if (!orderData.client_name || orderData.client_name.trim() === '') {
      throw new Error('El nombre del cliente es obligatorio.');
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase.from('kanban_orders').insert({
      client_name: orderData.client_name.trim(),
      product_details: orderData.product_details?.trim() || null,
      total_ars: orderData.total_ars || 0,
      status: orderData.status || 'pending',
      notes: orderData.notes?.trim() || null
    });

    if (error) throw error;

    revalidatePath('/kanban');
    revalidatePath('/gestion/pedidos');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Error al crear pedido en Kanban:', error);
    return { success: false, error: error.message || 'Error al registrar pedido' };
  }
}

/**
 * Actualizar el estado de la tarjeta del pedido (ej. mover de 'pending' a 'processing').
 */
export async function updateOrderStatus(
  role: UserRole,
  id: string,
  newStatus: 'pending' | 'processing' | 'ready' | 'delivered'
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from('kanban_orders')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    revalidatePath('/kanban');
    revalidatePath('/gestion/pedidos');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Error al actualizar estado del pedido:', error);
    return { success: false, error: error.message || 'Error al mover pedido' };
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
    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from('kanban_orders')
      .delete()
      .eq('id', id);

    if (error) throw error;

    revalidatePath('/kanban');
    revalidatePath('/gestion/pedidos');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Error al eliminar pedido del Kanban:', error);
    return { success: false, error: error.message || 'Error al eliminar pedido' };
  }
}
