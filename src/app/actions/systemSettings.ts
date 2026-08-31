'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth-checks';
import { systemSettingsSchema } from '@/lib/settings-validation';

export interface SystemSettingsData {
  id?: string;
  store_name: string;
  receipt_footer_text: string;
  enable_auto_stock_alerts: boolean;
  updated_at?: string;
}

interface DbSettingsRow {
  id: string;
  store_name?: string | null;
  receipt_footer_text?: string | null;
  enable_auto_stock_alerts?: boolean | null;
  updated_at?: string | null;
}

const DEFAULT_SETTINGS: SystemSettingsData = {
  store_name: 'Elohim Perfumería & Decants',
  receipt_footer_text: '¡Gracias por elegir Elohim Perfumería! Conserva este ticket para cambios.',
  enable_auto_stock_alerts: true,
};

/**
 * Consultar la configuración general del sistema desde public.system_settings.
 */
export async function getSystemSettings(): Promise<{
  success: boolean;
  data: SystemSettingsData;
  error?: string;
}> {
  try {
    if (!isSupabaseConfigured()) {
      return { success: true, data: DEFAULT_SETTINGS };
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('[SYSTEM_SETTINGS_WARN] Error o tabla ausente, retornando valores por defecto:', error.message);
      return { success: true, data: DEFAULT_SETTINGS };
    }

    if (!data) {
      return { success: true, data: DEFAULT_SETTINGS };
    }

    const row = data as unknown as DbSettingsRow;

    return {
      success: true,
      data: {
        id: row.id,
        store_name: row.store_name || DEFAULT_SETTINGS.store_name,
        receipt_footer_text: row.receipt_footer_text || DEFAULT_SETTINGS.receipt_footer_text,
        enable_auto_stock_alerts: row.enable_auto_stock_alerts ?? DEFAULT_SETTINGS.enable_auto_stock_alerts,
        updated_at: row.updated_at || undefined,
      },
    };
  } catch (error: unknown) {
    console.error('Error al consultar configuración del sistema:', error);
    return { success: true, data: DEFAULT_SETTINGS };
  }
}

/**
 * Actualizar o insertar los parámetros globales del sistema en public.system_settings.
 * Exclusivo para administradores.
 */
export async function updateSystemSettings(
  role: UserRole,
  settings: SystemSettingsData
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    const validation = systemSettingsSchema.safeParse(settings);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Datos de configuración inválidos.';
      return { success: false, error: firstError };
    }

    const clean = validation.data;

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const supabase = getServiceSupabase();

    // Consultar si ya existe una fila de configuración
    const { data: existing } = await supabase
      .from('system_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    const payload = {
      store_name: clean.store_name,
      receipt_footer_text: clean.receipt_footer_text,
      enable_auto_stock_alerts: clean.enable_auto_stock_alerts,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (existing?.id) {
      const res = await supabase
        .from('system_settings')
        .update(payload)
        .eq('id', existing.id);
      error = res.error;
    } else {
      const res = await supabase
        .from('system_settings')
        .insert([payload]);
      error = res.error;
    }

    if (error) {
      throw error;
    }

    revalidatePath('/admin/configuracion');
    revalidatePath('/');

    return { success: true };
  } catch (error: unknown) {
    console.error('Error al actualizar configuración del sistema:', error);
    const msg = error instanceof Error ? error.message : 'Error al guardar la configuración';
    return { success: false, error: msg };
  }
}
