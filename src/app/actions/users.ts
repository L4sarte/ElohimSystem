'use server';

import { getServiceSupabase } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

/**
 * Obtener la lista completa de usuarios registrados en la plataforma.
 * Exclusivo para administradores.
 */
export async function getUsers(role: UserRole): Promise<{
  success: boolean;
  data?: UserProfile[];
  error?: string;
}> {
  try {
    if (role !== 'admin') {
      throw new Error('Acceso no autorizado. Se requiere rol de Administrador.');
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, role, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const users: UserProfile[] = (data || []).map((item: any) => ({
      id: item.id,
      email: item.email || 'Sin correo asociado',
      role: item.role === 'admin' ? 'admin' : 'seller',
      created_at: item.created_at || new Date().toISOString()
    }));

    return { success: true, data: users };
  } catch (error: any) {
    console.error('Error al obtener usuarios:', error);
    return { success: false, error: error.message || 'Error al consultar la lista de usuarios' };
  }
}

/**
 * Actualizar el rol de un usuario ('admin' o 'seller') en la tabla profiles.
 */
export async function updateUserRole(
  adminRole: UserRole,
  userId: string,
  newRole: UserRole
): Promise<{ success: boolean; error?: string }> {
  try {
    if (adminRole !== 'admin') {
      throw new Error('Operación no autorizada. Solo los administradores pueden modificar roles de usuario.');
    }

    if (!userId || !newRole) {
      throw new Error('Parámetros de usuario y rol inválidos.');
    }

    if (newRole !== 'admin' && newRole !== 'seller') {
      throw new Error('Rol inválido especificado.');
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) {
      throw error;
    }

    revalidatePath('/admin/usuarios');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Error al actualizar rol de usuario:', error);
    return { success: false, error: error.message || 'Error al actualizar el rol' };
  }
}
