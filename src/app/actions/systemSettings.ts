'use server';

import { getServiceSupabase } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';

export interface SystemSettingsData {
  id?: string;
  store_name: string;
  receipt_footer_text: string;
  enable_auto_stock_alerts: boolean;
  updated_at?: string;
}

const DEFAULT_SETTINGS: SystemSettingsData = {
  store_name: 'Elohim Perfumería & Decants',
  receipt_footer_text: '¡Gracias por elegir Elohim Perfumería! Conserva este ticket para cambios.',
  enable_auto_stock_alerts: true
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

    return {
      success: true,
      data: {
        id: data.id,
        store_name: data.store_name || DEFAULT_SETTINGS.store_name,
        receipt_footer_text: data.receipt_footer_text || DEFAULT_SETTINGS.receipt_footer_text,
        enable_auto_stock_alerts: data.enable_auto_stock_alerts ?? DEFAULT_SETTINGS.enable_auto_stock_alerts,
        updated_at: data.updated_at
      }
    };
  } catch (error: any) {
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
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Solo administradores pueden guardar la configuración del sistema.');
    }

    const supabase = getServiceSupabase();

    // Consultar si ya existe una fila de configuración
    const { data: existing } = await supabase
      .from('system_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    const payload = {
      store_name: settings.store_name.trim() || DEFAULT_SETTINGS.store_name,
      receipt_footer_text: settings.receipt_footer_text.trim() || DEFAULT_SETTINGS.receipt_footer_text,
      enable_auto_stock_alerts: Boolean(settings.enable_auto_stock_alerts),
      updated_at: new Date().toISOString()
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
    revalidatePath('/pos');
    revalidatePath('/');

    return { success: true };
  } catch (error: any) {
    console.error('Error al actualizar configuración del sistema:', error);
    return { success: false, error: error.message || 'Error al guardar la configuración' };
  }
}
