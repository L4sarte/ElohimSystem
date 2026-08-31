'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { loginSchema } from '@/lib/auth-checks';
import { isSupabaseConfigured } from '@/lib/supabase';

export interface AuthActionResult {
  success: boolean;
  error?: string;
}

/**
 * Autentica a un usuario con su correo electrónico y contraseña.
 */
export async function loginAction(formData: FormData): Promise<AuthActionResult> {
  try {
    const rawEmail = formData.get('email');
    const rawPassword = formData.get('password');

    const parseResult = loginSchema.safeParse({
      email: typeof rawEmail === 'string' ? rawEmail : '',
      password: typeof rawPassword === 'string' ? rawPassword : '',
    });

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Datos de inicio de sesión inválidos.';
      return { success: false, error: firstError };
    }

    const { email, password } = parseResult.data;

    // Si Supabase no está configurado (modo local sin credenciales), permitir demo login seguro
    if (!isSupabaseConfigured()) {
      if (email.includes('@') && password.length >= 6) {
        revalidatePath('/', 'layout');
        return { success: true };
      }
      return { success: false, error: 'Credenciales inválidas para el entorno de desarrollo.' };
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Error de autenticación Supabase:', error.message);
      if (error.message.toLowerCase().includes('invalid login credentials') || error.message.toLowerCase().includes('invalid credentials')) {
        return { success: false, error: 'Credenciales incorrectas. Verifica tu email y contraseña.' };
      }
      if (error.message.toLowerCase().includes('email not confirmed')) {
        return { success: false, error: 'La cuenta de correo electrónico aún no ha sido confirmada.' };
      }
      return { success: false, error: 'No se pudo iniciar sesión. ' + error.message };
    }

    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err: unknown) {
    console.error('Excepción en loginAction:', err);
    const msg = err instanceof Error ? err.message : 'Error inesperado del servidor durante la autenticación.';
    return { success: false, error: msg };
  }
}

/**
 * Cierra la sesión activa del usuario y redirige al login.
 */
export async function logoutAction(): Promise<void> {
  try {
    if (isSupabaseConfigured()) {
      const supabase = await createClient();
      await supabase.auth.signOut();
    }
  } catch (err) {
    console.error('Error al cerrar sesión:', err);
  } finally {
    revalidatePath('/', 'layout');
    redirect('/login');
  }
}

/**
 * Retorna los datos del usuario autenticado actualmente en la sesión.
 */
export async function getAuthenticatedUser() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}
