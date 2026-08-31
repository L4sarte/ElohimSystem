'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';
import { requireAdmin, updateUserRoleSchema } from '@/lib/auth-checks';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

interface DbProfileRow {
  id: string;
  email: string | null;
  role: string | null;
  created_at: string | null;
}

/**
 * Obtener la lista completa de usuarios registrados en la plataforma.
 * Exclusivo para administradores. La autorización se valida en el servidor.
 */
export async function getUsers(role?: UserRole): Promise<{
  success: boolean;
  data?: UserProfile[];
  error?: string;
}> {
  try {
    // Verificación estricta de sesión y rol de administrador en el servidor
    await requireAdmin();

    if (!isSupabaseConfigured()) {
      // Mock de usuarios para entorno local de desarrollo sin Supabase
      return {
        success: true,
        data: [
          {
            id: 'dev-admin-id',
            email: 'admin@elohimimport.com',
            role: 'admin',
            created_at: new Date().toISOString(),
          },
          {
            id: 'dev-seller-id',
            email: 'vendedor@elohimimport.com',
            role: 'seller',
            created_at: new Date().toISOString(),
          },
        ],
      };
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, role, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const rows = (data || []) as unknown as DbProfileRow[];
    const users: UserProfile[] = rows.map((item) => ({
      id: item.id,
      email: item.email || 'Sin correo asociado',
      role: item.role === 'admin' ? 'admin' : 'seller',
      created_at: item.created_at || new Date().toISOString(),
    }));

    return { success: true, data: users };
  } catch (error: unknown) {
    console.error('Error al obtener usuarios:', error);
    const msg = error instanceof Error ? error.message : 'Error al consultar la lista de usuarios';
    return { success: false, error: msg };
  }
}

/**
 * Actualizar el rol de un usuario ('admin' o 'seller') en la tabla profiles.
 * Valida sesión en el servidor y protege contra auto-revocación accidental.
 */
export async function updateUserRole(
  adminRoleOrUserId: UserRole | string,
  userIdOrRole: string | UserRole,
  newRoleParam?: UserRole
): Promise<{ success: boolean; error?: string }> {
  try {
    // Normalización de argumentos para compatibilidad
    let targetUserId: string;
    let targetNewRole: UserRole;

    if (newRoleParam) {
      targetUserId = userIdOrRole as string;
      targetNewRole = newRoleParam;
    } else {
      targetUserId = adminRoleOrUserId as string;
      targetNewRole = userIdOrRole as UserRole;
    }

    // Validación de esquema Zod
    const validation = updateUserRoleSchema.safeParse({
      userId: targetUserId,
      newRole: targetNewRole,
    });

    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Parámetros de usuario o rol inválidos.';
      return { success: false, error: firstError };
    }

    // Verificación estricta de autorización en el servidor
    const currentAdmin = await requireAdmin();

    // Seguridad: el administrador no puede quitarse su propio rol de admin
    if (currentAdmin.id === targetUserId && targetNewRole !== 'admin') {
      return {
        success: false,
        error: 'Por seguridad, no puedes revocar tus propios privilegios de Administrador.',
      };
    }

    if (!isSupabaseConfigured()) {
      revalidatePath('/admin/usuarios');
      revalidatePath('/');
      return { success: true };
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from('profiles')
      .update({ role: targetNewRole })
      .eq('id', targetUserId);

    if (error) {
      throw error;
    }

    revalidatePath('/admin/usuarios');
    revalidatePath('/');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error al actualizar rol de usuario:', error);
    const msg = error instanceof Error ? error.message : 'Error al actualizar el rol de usuario';
    return { success: false, error: msg };
  }
}
