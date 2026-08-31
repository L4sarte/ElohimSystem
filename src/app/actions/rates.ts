'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth-checks';

export interface ExchangeRateResult {
  value_ars: number;
  type: 'blue_venta' | 'manual' | 'fallback';
  is_active: boolean;
  is_fallback?: boolean;
  created_at?: string;
}

/**
 * Obtiene la cotización del dólar blue activa.
 * Primero busca si hay una tasa manual de administrador activa en la base de datos.
 * Si no la hay, consume la API externa de dolarapi.com en tiempo real.
 * Si la API falla, activa un fallback seguro recuperando el último valor en DB o variable de entorno.
 */
export async function getCurrentRate(): Promise<{
  success: boolean;
  data?: ExchangeRateResult;
  error?: string;
}> {
  try {
    if (!isSupabaseConfigured()) {
      return {
        success: true,
        data: {
          value_ars: 1250,
          type: 'fallback',
          is_fallback: true,
          is_active: false,
          created_at: new Date().toISOString(),
        },
      };
    }

    const supabase = getServiceSupabase();

    // 1. Consultar si hay una cotización manual activa en Supabase
    const { data: dbRates, error: dbError } = await supabase
      .from('exchange_rates')
      .select('type, value_ars, is_active, created_at')
      .eq('is_active', true)
      .limit(1);

    if (dbError) {
      console.error('Error al leer de la tabla exchange_rates:', dbError.message);
    }

    if (dbRates && dbRates.length > 0) {
      const activeRate = dbRates[0];
      return {
        success: true,
        data: {
          value_ars: Number(activeRate.value_ars),
          type: activeRate.type as 'blue_venta' | 'manual',
          is_active: Boolean(activeRate.is_active),
          created_at: activeRate.created_at || undefined,
        },
      };
    }

    // 2. Si no hay cotización activa en base de datos, consumimos dolarapi.com
    try {
      const res = await fetch('https://dolarapi.com/v1/dolares/blue', {
        next: { revalidate: 60 },
      });

      if (!res.ok) {
        throw new Error('No se pudo obtener la cotización de dolarapi.com');
      }

      const apiData = await res.json();
      return {
        success: true,
        data: {
          value_ars: Number(apiData.venta),
          type: 'blue_venta',
          is_active: false,
        },
      };
    } catch (apiError: unknown) {
      const errMsg = apiError instanceof Error ? apiError.message : 'Error en API externa';
      console.warn('Fallo en la API cambiaria externa (dolarapi.com), activando cotización de respaldo:', errMsg);

      // 3. Fallback: Recuperar la última cotización conocida en Supabase o variable de entorno
      let fallbackValue = process.env.NEXT_PUBLIC_FALLBACK_USD_RATE
        ? parseFloat(process.env.NEXT_PUBLIC_FALLBACK_USD_RATE)
        : 1250;

      const { data: lastRate } = await supabase
        .from('exchange_rates')
        .select('value_ars')
        .order('created_at', { ascending: false })
        .limit(1);

      if (lastRate && lastRate.length > 0 && lastRate[0].value_ars) {
        fallbackValue = Number(lastRate[0].value_ars);
      }

      return {
        success: true,
        data: {
          value_ars: fallbackValue,
          type: 'fallback',
          is_fallback: true,
          is_active: false,
          created_at: new Date().toISOString(),
        },
      };
    }
  } catch (error: unknown) {
    console.error('Error general al obtener tipo de cambio:', error);
    const msg = error instanceof Error ? error.message : 'Error desconocido al obtener tipo de cambio';
    return { success: false, error: msg };
  }
}

/**
 * Congelar manualmente la cotización del dólar blue (Solo Admin).
 * Guarda la cotización en exchange_rates con is_active = true y desactiva las anteriores.
 */
export async function setManualRate(
  role: UserRole,
  value: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    if (!value || value <= 0) {
      throw new Error('La cotización debe ser un número positivo.');
    }

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const supabase = getServiceSupabase();

    // 1. Desactivar cualquier cotización anterior
    const { error: updateError } = await supabase
      .from('exchange_rates')
      .update({ is_active: false })
      .eq('is_active', true);

    if (updateError) {
      throw updateError;
    }

    // 2. Insertar la nueva cotización manual activa
    const { error: insertError } = await supabase
      .from('exchange_rates')
      .insert({
        type: 'manual',
        value_ars: value,
        is_active: true,
      });

    if (insertError) {
      throw insertError;
    }

    revalidatePath('/');
    revalidatePath('/productos');

    return { success: true };
  } catch (error: unknown) {
    console.error('Error al establecer cotización manual:', error);
    const msg = error instanceof Error ? error.message : 'Error al guardar la cotización';
    return { success: false, error: msg };
  }
}

/**
 * Liberar la cotización manual congelada (Solo Admin).
 * Desactiva todas las cotizaciones manuales para volver a usar dolarapi.com
 */
export async function clearManualRate(role: UserRole): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const supabase = getServiceSupabase();

    const { error: updateError } = await supabase
      .from('exchange_rates')
      .update({ is_active: false })
      .eq('is_active', true);

    if (updateError) {
      throw updateError;
    }

    revalidatePath('/');
    revalidatePath('/productos');

    return { success: true };
  } catch (error: unknown) {
    console.error('Error al liberar cotización:', error);
    const msg = error instanceof Error ? error.message : 'Error al liberar la cotización';
    return { success: false, error: msg };
  }
}
