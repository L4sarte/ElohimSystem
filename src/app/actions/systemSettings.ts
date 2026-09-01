'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth-checks';
import { 
  systemSettingsSchema, 
  SystemSettingsData, 
  DEFAULT_SYSTEM_SETTINGS 
} from '@/lib/settings-validation';

/**
 * Extrae un mensaje de error legible y descriptivo de cualquier tipo de excepción o PostgrestError.
 */
function extractErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, any>;
    const msg = errObj.message || errObj.error_description || errObj.details || errObj.hint;
    if (msg) {
      const detail = errObj.details ? ` (${errObj.details})` : '';
      const hint = errObj.hint ? ` [Sugerencia: ${errObj.hint}]` : '';
      return `${msg}${detail}${hint}`;
    }
  }
  return String(error) || fallback;
}

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
      return { success: true, data: DEFAULT_SYSTEM_SETTINGS };
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('[SYSTEM_SETTINGS_WARN] Error o tabla ausente, retornando valores por defecto:', error.message);
      return { success: true, data: DEFAULT_SYSTEM_SETTINGS };
    }

    if (!data) {
      return { success: true, data: DEFAULT_SYSTEM_SETTINGS };
    }

    const row = data as Record<string, any>;

    return {
      success: true,
      data: {
        id: row.id,
        company_name: row.company_name ?? DEFAULT_SYSTEM_SETTINGS.company_name,
        trade_name: row.trade_name ?? row.store_name ?? DEFAULT_SYSTEM_SETTINGS.trade_name,
        store_name: row.store_name ?? row.trade_name ?? DEFAULT_SYSTEM_SETTINGS.store_name,
        slogan: row.slogan ?? DEFAULT_SYSTEM_SETTINGS.slogan,
        logo_url: row.logo_url ?? DEFAULT_SYSTEM_SETTINGS.logo_url,
        cuit_tax_id: row.cuit_tax_id ?? DEFAULT_SYSTEM_SETTINGS.cuit_tax_id,

        phone: row.phone ?? DEFAULT_SYSTEM_SETTINGS.phone,
        email: row.email ?? DEFAULT_SYSTEM_SETTINGS.email,
        address: row.address ?? DEFAULT_SYSTEM_SETTINGS.address,
        city: row.city ?? DEFAULT_SYSTEM_SETTINGS.city,
        instagram_handle: row.instagram_handle ?? DEFAULT_SYSTEM_SETTINGS.instagram_handle,

        receipt_header: row.receipt_header ?? DEFAULT_SYSTEM_SETTINGS.receipt_header,
        receipt_footer_text: row.receipt_footer_text ?? row.receipt_footer_message ?? DEFAULT_SYSTEM_SETTINGS.receipt_footer_text,
        receipt_footer_message: row.receipt_footer_message ?? row.receipt_footer_text ?? DEFAULT_SYSTEM_SETTINGS.receipt_footer_message,
        warranty_policy_days: Number(row.warranty_policy_days ?? DEFAULT_SYSTEM_SETTINGS.warranty_policy_days),
        enable_auto_stock_alerts: row.enable_auto_stock_alerts ?? DEFAULT_SYSTEM_SETTINGS.enable_auto_stock_alerts,
        default_min_stock_alert: Number(row.default_min_stock_alert ?? DEFAULT_SYSTEM_SETTINGS.default_min_stock_alert),

        bank_name: row.bank_name ?? DEFAULT_SYSTEM_SETTINGS.bank_name,
        bank_account_holder: row.bank_account_holder ?? DEFAULT_SYSTEM_SETTINGS.bank_account_holder,
        bank_cbu_cvu: row.bank_cbu_cvu ?? DEFAULT_SYSTEM_SETTINGS.bank_cbu_cvu,
        bank_alias: row.bank_alias ?? DEFAULT_SYSTEM_SETTINGS.bank_alias,

        updated_at: row.updated_at || undefined,
      },
    };
  } catch (error: unknown) {
    console.error('Error al consultar configuración del sistema:', error);
    return { success: true, data: DEFAULT_SYSTEM_SETTINGS };
  }
}

/**
 * Actualizar o insertar los parámetros globales del sistema en public.system_settings.
 * Exclusivo para administradores (validado internamente con requireAdmin).
 */
export async function updateSystemSettings(
  settings: Partial<SystemSettingsData>
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Verificación estricta de privilegios de Administrador en el backend
    await requireAdmin();

    // 2. Validación de esquema con Zod
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

    // 3. Consultar si ya existe un registro de configuración singleton
    const { data: existing, error: selectError } = await supabase
      .from('system_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (selectError && selectError.code !== 'PGRST116') {
      console.warn('[SYSTEM_SETTINGS_SELECT_WARN]:', selectError.message);
    }

    const payload: Record<string, any> = {
      company_name: clean.company_name || DEFAULT_SYSTEM_SETTINGS.company_name,
      trade_name: clean.trade_name || DEFAULT_SYSTEM_SETTINGS.trade_name,
      store_name: clean.store_name || clean.trade_name || DEFAULT_SYSTEM_SETTINGS.store_name,
      slogan: clean.slogan || '',
      logo_url: clean.logo_url || DEFAULT_SYSTEM_SETTINGS.logo_url,
      cuit_tax_id: clean.cuit_tax_id || '',

      phone: clean.phone || '',
      email: clean.email || '',
      address: clean.address || '',
      city: clean.city || '',
      instagram_handle: clean.instagram_handle || '',

      receipt_header: clean.receipt_header || DEFAULT_SYSTEM_SETTINGS.receipt_header,
      receipt_footer_text: clean.receipt_footer_text || clean.receipt_footer_message || DEFAULT_SYSTEM_SETTINGS.receipt_footer_text,
      receipt_footer_message: clean.receipt_footer_message || clean.receipt_footer_text || DEFAULT_SYSTEM_SETTINGS.receipt_footer_message,
      warranty_policy_days: clean.warranty_policy_days,
      enable_auto_stock_alerts: clean.enable_auto_stock_alerts,
      default_min_stock_alert: clean.default_min_stock_alert,

      bank_name: clean.bank_name || '',
      bank_account_holder: clean.bank_account_holder || '',
      bank_cbu_cvu: clean.bank_cbu_cvu || '',
      bank_alias: clean.bank_alias || '',

      updated_at: new Date().toISOString(),
    };

    let dbError;
    if (existing?.id) {
      payload.id = existing.id;
      const res = await supabase
        .from('system_settings')
        .update(payload)
        .eq('id', existing.id);
      dbError = res.error;
    } else {
      const res = await supabase
        .from('system_settings')
        .insert([payload]);
      dbError = res.error;
    }

    if (dbError) {
      const formattedErr = extractErrorMessage(dbError, 'Error al persistir en la tabla system_settings.');
      console.error('[SYSTEM_SETTINGS_DB_ERROR]:', dbError);
      return { success: false, error: `Error en base de datos: ${formattedErr}` };
    }

    // 4. Revalidación de caché en todas las vistas afectadas
    revalidatePath('/admin/configuracion');
    revalidatePath('/pos');
    revalidatePath('/admin/reportes');
    revalidatePath('/');

    return { success: true };
  } catch (error: unknown) {
    console.error('Error al actualizar configuración del sistema:', error);
    const msg = extractErrorMessage(error, 'Error al guardar la configuración');
    return { success: false, error: msg };
  }
}

/**
 * Subir logotipo oficial de la empresa a Supabase Storage (`company-assets`).
 * Valida tamaño máximo (2MB) y tipo MIME permitido.
 */
export async function uploadCompanyLogo(formData: FormData): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  try {
    await requireAdmin();

    const file = formData.get('file') as File | null;
    if (!file) {
      return { success: false, error: 'No se ha proporcionado ningún archivo.' };
    }

    // 1. Validar tamaño (máx 2MB)
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return { success: false, error: 'La imagen excede el límite máximo de 2MB.' };
    }

    // 2. Validar tipo MIME
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!allowedMimeTypes.includes(file.type)) {
      return { success: false, error: 'Formato no compatible. Sube una imagen PNG, JPG, WebP o SVG.' };
    }

    const supabase = getServiceSupabase();
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = file.name.split('.').pop() || 'png';
    const filename = `company-logo-${Date.now()}.${ext}`;
    const bucketName = 'company-assets';

    // Asegurar o intentar subir al bucket
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.warn('[STORAGE_WARN] Bucket company-assets no disponible o sin permisos, aplicando fallback en Data URL:', uploadError.message);
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${file.type};base64,${base64}`;
      return { 
        success: true, 
        url: dataUrl 
      };
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(uploadData.path);

    return {
      success: true,
      url: publicUrlData.publicUrl,
    };
  } catch (error: unknown) {
    console.error('Error al subir logotipo de la compañía:', error);
    const msg = extractErrorMessage(error, 'Error al procesar la subida del logotipo');
    return { success: false, error: msg };
  }
}
