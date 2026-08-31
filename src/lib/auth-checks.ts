import { createClient } from '@/utils/supabase/server';
import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserRole } from '@/types';
import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'El correo electrónico es requerido')
    .email('Formato de correo electrónico inválido')
    .max(255, 'El correo es demasiado largo'),
  password: z
    .string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres')
    .max(128, 'La contraseña es demasiado larga'),
});

export const updateUserRoleSchema = z.object({
  userId: z.string().trim().min(1, 'ID de usuario inválido'),
  newRole: z.enum(['admin', 'seller'], {
    message: 'El rol asignado debe ser "admin" o "seller"',
  }),
});

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

/**
 * Obtiene el usuario autenticado actualmente desde la sesión segura de cookies (SSR)
 * y verifica su rol en la tabla `profiles`.
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      // Si Supabase no está configurado en entorno local, proveer fallback controlado
      if (!isSupabaseConfigured()) {
        return {
          id: 'dev-admin-id',
          email: 'admin@elohimimport.com',
          role: 'admin',
        };
      }
      return null;
    }

    // Consultar el perfil real del usuario en la base de datos
    const serviceClient = getServiceSupabase();
    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Error al consultar perfil del usuario:', profileError.message);
    }

    const role: UserRole = profile?.role === 'admin' ? 'admin' : 'seller';

    return {
      id: user.id,
      email: profile?.email || user.email || '',
      role,
    };
  } catch (error) {
    console.error('Error inesperado al obtener sesión de usuario:', error);
    if (!isSupabaseConfigured()) {
      return {
        id: 'dev-admin-id',
        email: 'admin@elohimimport.com',
        role: 'admin',
      };
    }
    return null;
  }
}

/**
 * Requiere que la sesión actual pertenezca a un usuario autenticado.
 * Lanza un error explícito si no hay sesión activa.
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Sesión no válida o expirada. Por favor, inicia sesión.');
  }
  return user;
}

/**
 * Requiere que la sesión actual pertenezca a un usuario con rol de Administrador.
 * Lanza un error explícito si no posee los privilegios necesarios.
 */
export async function requireAdmin(): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  if (user.role !== 'admin') {
    throw new Error('Operación no autorizada. Se requieren privilegios de Administrador.');
  }
  return user;
}
