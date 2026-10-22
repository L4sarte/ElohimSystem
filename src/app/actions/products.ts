'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { Product, DecantAssemblyItem } from '@/types';
import { revalidatePath } from 'next/cache';
import { requireAuth, requireAdmin, getCurrentUser } from '@/lib/auth-checks';
import {
  productInputSchema,
  fractionateBottleSchema,
  decantAssemblyBatchSchema,
} from '@/lib/product-validation';

interface DbProductRow {
  id: string;
  sku: string;
  name: string;
  brand: string;
  type: string;
  batch_code: string | null;
  olfactory_family: string | null;
  olfactory_notes: string[] | null;
  is_public: boolean | null;
  min_stock_alert: number | null;
  base_cost_ars?: number | null;
  base_price_ars: number | null;
  stock_quantity: number | null;
  volume_ml: number | null;
  created_at: string;
}

/**
 * Obtener todos los productos filtrados por rol real del usuario.
 * Cumple con Security by Design: el rol 'seller' nunca recibe 'base_cost_ars' desde el backend.
 */
export async function getProducts(): Promise<{
  success: boolean;
  data?: Product[];
  error?: string;
}> {
  try {
    // Seguridad: el rol SIEMPRE se deriva de la sesión autenticada (nunca de parámetros del cliente)
    const user = await getCurrentUser();
    const isUserAdmin = user?.role === 'admin';

    if (!isSupabaseConfigured()) {
      return {
        success: true,
        data: [
          {
            id: 'mock-prod-1',
            sku: 'PERF-001',
            name: 'Aventus Eau de Parfum',
            brand: 'Creed',
            type: 'bottle',
            base_cost_ars: isUserAdmin ? 180000 : 0,
            base_price_ars: 320000,
            stock_quantity: 4,
            min_stock_alert: 2,
            volume_ml: 100,
            is_public: true,
            created_at: new Date().toISOString(),
          },
        ],
      };
    }

    const supabase = getServiceSupabase();
    let query;

    if (isUserAdmin) {
      // Admin tiene acceso total pero solicitamos únicamente las columnas necesarias para el catálogo
      query = supabase
        .from('products')
        .select('id, sku, name, brand, type, batch_code, olfactory_family, olfactory_notes, is_public, min_stock_alert, base_cost_ars, base_price_ars, stock_quantity, volume_ml, image_url, created_at')
        .order('created_at', { ascending: false });
    } else {
      // Vendedor o público no tienen acceso a base_cost_ars
      query = supabase
        .from('products')
        .select('id, sku, name, brand, type, batch_code, olfactory_family, olfactory_notes, is_public, min_stock_alert, base_price_ars, stock_quantity, volume_ml, image_url, created_at')
        .order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const rows = (data || []) as unknown as DbProductRow[];
    const products: Product[] = rows.map((item) => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      brand: item.brand,
      type: item.type as Product['type'],
      batch_code: item.batch_code || undefined,
      olfactory_family: item.olfactory_family || undefined,
      olfactory_notes: item.olfactory_notes || undefined,
      is_public: Boolean(item.is_public),
      min_stock_alert: Number(item.min_stock_alert || 5),
      base_cost_ars: item.base_cost_ars !== undefined && item.base_cost_ars !== null ? Number(item.base_cost_ars) : 0,
      base_price_ars: Number(item.base_price_ars || 0),
      stock_quantity: Number(item.stock_quantity || 0),
      volume_ml: item.volume_ml !== null && item.volume_ml !== undefined ? Number(item.volume_ml) : undefined,
      created_at: item.created_at,
    }));

    return { success: true, data: products };
  } catch (error: unknown) {
    console.error('Error al obtener productos:', error);
    const msg = error instanceof Error ? error.message : 'Error desconocido al cargar productos';
    return { success: false, error: msg };
  }
}

/**
 * Crear un nuevo producto en la base de datos (Solo Admin)
 */
export async function createProduct(
  formData: unknown
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    await requireAdmin();

    const validation = productInputSchema.safeParse(formData);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Datos de producto inválidos.';
      return { success: false, error: firstError };
    }

    const validatedData = validation.data;

    if (!isSupabaseConfigured()) {
      return { success: true, id: 'mock-prod-' + Math.random().toString(36).substring(2, 7) };
    }

    const supabase = getServiceSupabase();

    const volume = validatedData.volume_ml === '' || validatedData.volume_ml === null || validatedData.volume_ml === undefined
      ? null
      : Number(validatedData.volume_ml);

    const insertData = {
      sku: validatedData.sku,
      name: validatedData.name,
      brand: validatedData.brand,
      type: validatedData.type,
      batch_code: validatedData.batch_code || null,
      olfactory_family: validatedData.olfactory_family || null,
      olfactory_notes: validatedData.olfactory_notes || [],
      is_public: validatedData.is_public ?? true,
      min_stock_alert: validatedData.min_stock_alert ?? 5,
      base_cost_ars: validatedData.base_cost_ars,
      base_price_ars: validatedData.base_price_ars,
      stock_quantity: validatedData.stock_quantity,
      volume_ml: volume,
    };

    const { data, error } = await supabase.from('products').insert(insertData).select('id');

    if (error) {
      if (error.code === '23505') {
        throw new Error(`El SKU "${validatedData.sku}" ya está registrado para otro producto.`);
      }
      throw error;
    }

    revalidatePath('/productos');
    revalidatePath('/catalogo');
    revalidatePath('/tienda');
    return { success: true, id: data && data.length > 0 ? data[0].id : undefined };
  } catch (error: unknown) {
    console.error('Error al crear producto:', error);
    const msg = error instanceof Error ? error.message : 'Error desconocido al crear producto';
    return { success: false, error: msg };
  }
}

/**
 * Actualizar un producto existente (Solo Admin)
 */
export async function updateProduct(
  id: string,
  formData: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    if (!id || !id.trim()) {
      throw new Error('ID de producto no proporcionado.');
    }

    const validation = productInputSchema.safeParse(formData);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Datos de producto inválidos.';
      return { success: false, error: firstError };
    }

    const validatedData = validation.data;

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const supabase = getServiceSupabase();

    const volume = validatedData.volume_ml === '' || validatedData.volume_ml === null || validatedData.volume_ml === undefined
      ? null
      : Number(validatedData.volume_ml);

    const updateData = {
      sku: validatedData.sku,
      name: validatedData.name,
      brand: validatedData.brand,
      type: validatedData.type,
      batch_code: validatedData.batch_code || null,
      olfactory_family: validatedData.olfactory_family || null,
      olfactory_notes: validatedData.olfactory_notes || [],
      is_public: validatedData.is_public ?? true,
      min_stock_alert: validatedData.min_stock_alert ?? 5,
      base_cost_ars: validatedData.base_cost_ars,
      base_price_ars: validatedData.base_price_ars,
      stock_quantity: validatedData.stock_quantity,
      volume_ml: volume,
    };

    const { error } = await supabase.from('products').update(updateData).eq('id', id.trim());

    if (error) {
      if (error.code === '23505') {
        throw new Error(`El SKU "${validatedData.sku}" ya está registrado para otro producto.`);
      }
      throw error;
    }

    revalidatePath('/productos');
    revalidatePath('/catalogo');
    revalidatePath('/tienda');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error al actualizar producto:', error);
    const msg = error instanceof Error ? error.message : 'Error desconocido al actualizar producto';
    return { success: false, error: msg };
  }
}

/**
 * Eliminar un producto (Solo Admin)
 */
export async function deleteProduct(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    if (!id || !id.trim()) {
      throw new Error('ID de producto no proporcionado.');
    }

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase.from('products').delete().eq('id', id.trim());

    if (error) {
      throw error;
    }

    revalidatePath('/productos');
    revalidatePath('/catalogo');
    revalidatePath('/tienda');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error al eliminar producto:', error);
    const msg = error instanceof Error ? error.message : 'Error desconocido al eliminar producto';
    return { success: false, error: msg };
  }
}

/**
 * Obtener todos los productos tipo 'decant_liquid' (Líquidos a granel).
 */
export async function getDecantLiquids(): Promise<{
  success: boolean;
  data?: Product[];
  error?: string;
}> {
  try {
    // Seguridad: el rol SIEMPRE se deriva de la sesión autenticada (nunca de parámetros del cliente)
    const user = await getCurrentUser();
    const isUserAdmin = user?.role === 'admin';

    if (!isSupabaseConfigured()) {
      return { success: true, data: [] };
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('type', 'decant_liquid')
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    const rows = (data || []) as unknown as DbProductRow[];
    const products: Product[] = rows.map((item) => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      brand: item.brand,
      type: item.type as Product['type'],
      batch_code: item.batch_code || undefined,
      olfactory_family: item.olfactory_family || undefined,
      olfactory_notes: item.olfactory_notes || undefined,
      is_public: Boolean(item.is_public),
      min_stock_alert: Number(item.min_stock_alert || 5),
      base_cost_ars: isUserAdmin && item.base_cost_ars !== undefined && item.base_cost_ars !== null ? Number(item.base_cost_ars) : 0,
      base_price_ars: Number(item.base_price_ars || 0),
      stock_quantity: Number(item.stock_quantity || 0),
      volume_ml: item.volume_ml !== null && item.volume_ml !== undefined ? Number(item.volume_ml) : undefined,
      created_at: item.created_at,
    }));

    return { success: true, data: products };
  } catch (error: unknown) {
    console.error('Error al obtener líquidos de decant:', error);
    const msg = error instanceof Error ? error.message : 'Error al obtener decants';
    return { success: false, error: msg };
  }
}

export interface FractionateBottleResponse {
  success: boolean;
  error?: string;
  errorDetails?: {
    code?: string;
    message?: string;
    details?: string | null;
    hint?: string | null;
  };
  data?: {
    log_id?: string;
    bottle_id: string;
    decant_id: string;
    volume_fractionated_ml: number;
    new_liquid_stock_ml: number;
    new_weighted_avg_cost_ars: number;
    cost_transferred_ars: number;
  };
}

/**
 * Fraccionar una botella: resta 1 unidad de la botella y suma p_volume_ml al decant seleccionado.
 * Invoca la función transaccional de base de datos 'fractionate_bottle'.
 */
export async function fractionateBottle(
  bottleId: string,
  decantId: string,
  volumeMl: number
): Promise<FractionateBottleResponse> {
  try {
    const adminUser = await requireAdmin();

    const cleanBottleId = typeof bottleId === 'string' ? bottleId.trim() : '';
    const cleanDecantId = typeof decantId === 'string' ? decantId.trim() : '';
    const cleanVolumeMl = Number(volumeMl);

    const validation = fractionateBottleSchema.safeParse({
      bottleId: cleanBottleId,
      decantId: cleanDecantId,
      volumeMl: cleanVolumeMl,
    });

    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Parámetros de fraccionamiento inválidos.';
      return {
        success: false,
        error: firstError,
        errorDetails: {
          code: 'VALIDATION_ERROR',
          message: firstError,
          details: JSON.stringify(validation.error.flatten().fieldErrors),
          hint: 'Verifica que la botella origen, el decant destino y el volumen en ml sean válidos.',
        },
      };
    }

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const supabase = getServiceSupabase();

    // Validar que adminUser.id sea un UUID válido antes de enviarlo al RPC
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validAdminId = adminUser?.id && uuidRegex.test(adminUser.id) ? adminUser.id : null;

    // 1. Consultar estado previo de botella y granel para respaldo de cálculo PPP
    const { data: bottleData } = await supabase
      .from('products')
      .select('name, base_cost_ars, volume_ml, stock_quantity')
      .eq('id', validation.data.bottleId)
      .single();

    const { data: decantData } = await supabase
      .from('products')
      .select('name, base_cost_ars, stock_quantity')
      .eq('id', validation.data.decantId)
      .single();

    let rpcRes = await supabase.rpc('fractionate_bottle', {
      p_bottle_id: validation.data.bottleId,
      p_decant_id: validation.data.decantId,
      p_volume_ml: validation.data.volumeMl,
      p_admin_id: validAdminId,
    });

    if (
      rpcRes.error &&
      (rpcRes.error.code === 'PGRST202' ||
        rpcRes.error.code === '42883' ||
        rpcRes.error.message?.includes('parameters') ||
        rpcRes.error.message?.includes('function'))
    ) {
      // Fallback a versión de 3 parámetros si en base de datos existe solo la firma antigua (UUID, UUID, NUMERIC)
      const fallbackRes = await supabase.rpc('fractionate_bottle', {
        p_bottle_id: validation.data.bottleId,
        p_decant_id: validation.data.decantId,
        p_volume_ml: validation.data.volumeMl,
      });
      rpcRes = fallbackRes;
    }

    if (rpcRes.error) {
      const pgErr = rpcRes.error;
      console.error('[FRACTIONATE_BOTTLE_RPC_ERROR]:', {
        code: pgErr.code,
        message: pgErr.message,
        details: pgErr.details,
        hint: pgErr.hint,
        payload: {
          p_bottle_id: validation.data.bottleId,
          p_decant_id: validation.data.decantId,
          p_volume_ml: validation.data.volumeMl,
          p_admin_id: validAdminId,
        },
      });

      const detailParts = [
        pgErr.message,
        pgErr.details ? `Detalles: ${pgErr.details}` : null,
        pgErr.hint ? `Sugerencia: ${pgErr.hint}` : null,
        pgErr.code ? `(Código PG: ${pgErr.code})` : null,
      ].filter(Boolean);

      return {
        success: false,
        error: detailParts.join(' | ') || 'Error al ejecutar fractionate_bottle en Postgres.',
        errorDetails: {
          code: pgErr.code,
          message: pgErr.message,
          details: pgErr.details,
          hint: pgErr.hint,
        },
      };
    }

    const rpcPayload = (rpcRes.data || null) as Record<string, unknown> | null;
    const rpcAlreadyLogged = Boolean(rpcPayload && rpcPayload.log_id);

    // 2. Si se ejecutó la firma legacy de 3 parámetros (que no retornaba JSONB con log_id),
    // garantizamos el cálculo PPP y el registro en fractionation_logs sin duplicar si la RPC nueva ya lo hizo.
    if (!rpcAlreadyLogged && bottleData && decantData) {
      const bottleVol = Number(bottleData.volume_ml) || validation.data.volumeMl || 100;
      const bottleCost = Number(bottleData.base_cost_ars || 0);
      const newCostPerMl = bottleVol > 0 ? bottleCost / bottleVol : 0;
      const newVolumeMl = validation.data.volumeMl;

      const previousStockMl = Number(decantData.stock_quantity || 0);
      const currentCostPerMl = Number(decantData.base_cost_ars || 0);
      const totalVolume = previousStockMl + newVolumeMl;

      let weightedCostPerMl = newCostPerMl;
      if (totalVolume > 0 && currentCostPerMl > 0 && previousStockMl > 0) {
        weightedCostPerMl = ((previousStockMl * currentCostPerMl) + (newVolumeMl * newCostPerMl)) / totalVolume;
      }

      const roundedWeightedCost = Math.round(weightedCostPerMl * 100) / 100;

      // Solo actualizamos base_cost_ars si la RPC no retornó new_weighted_avg_cost_ars
      if (!rpcPayload || rpcPayload.new_weighted_avg_cost_ars === undefined) {
        await supabase
          .from('products')
          .update({
            base_cost_ars: roundedWeightedCost,
          })
          .eq('id', validation.data.decantId);
      }

      // Si el RPC de 4 parámetros ya insertó en fractionation_logs (incluso sin log_id en versión intermedia),
      // evitamos duplicar verificando si no retornó new_weighted_avg_cost_ars.
      if (!rpcPayload || rpcPayload.new_weighted_avg_cost_ars === undefined) {
        const { error: logErr } = await supabase.from('fractionation_logs').insert({
          source_bottle_id: validation.data.bottleId,
          target_liquid_id: validation.data.decantId,
          volume_ml: validation.data.volumeMl,
          cost_transferred_ars: Math.round(newCostPerMl * newVolumeMl * 100) / 100,
          cost_per_ml_calculated: roundedWeightedCost,
          admin_id: validAdminId,
          notes: `Fraccionamiento de 1 botella de ${bottleData.name} (+${newVolumeMl}ml)`,
        });
        if (logErr) {
          console.warn('[FRACTIONATE_BOTTLE_LOG_WARNING]:', logErr.message, logErr.details, logErr.hint);
        }
      }
    }

    revalidatePath('/productos');
    revalidatePath('/admin/inventario/decants');
    revalidatePath('/admin/inventario/kardex');
    revalidatePath('/admin/inventario/recetas');

    return {
      success: true,
      data: rpcPayload
        ? {
            log_id: typeof rpcPayload.log_id === 'string' ? rpcPayload.log_id : undefined,
            bottle_id: String(rpcPayload.bottle_id || validation.data.bottleId),
            decant_id: String(rpcPayload.decant_id || validation.data.decantId),
            volume_fractionated_ml: Number(rpcPayload.volume_fractionated_ml || validation.data.volumeMl),
            new_liquid_stock_ml: Number(rpcPayload.new_liquid_stock_ml || 0),
            new_weighted_avg_cost_ars: Number(rpcPayload.new_weighted_avg_cost_ars || 0),
            cost_transferred_ars: Number(rpcPayload.cost_transferred_ars || 0),
          }
        : undefined,
    };
  } catch (error: unknown) {
    console.error('[FRACTIONATE_BOTTLE_UNEXPECTED_ERROR]:', error);
    if (error && typeof error === 'object' && 'message' in error) {
      const errObj = error as { code?: string; message?: string; details?: string | null; hint?: string | null };
      const parts = [
        errObj.message,
        errObj.details ? `Detalles: ${errObj.details}` : null,
        errObj.hint ? `Sugerencia: ${errObj.hint}` : null,
      ].filter(Boolean);
      return {
        success: false,
        error: parts.join(' | ') || 'Error al procesar el fraccionamiento en base de datos',
        errorDetails: {
          code: errObj.code,
          message: errObj.message,
          details: errObj.details ?? null,
          hint: errObj.hint ?? null,
        },
      };
    }
    return {
      success: false,
      error: 'Error inesperado al procesar el fraccionamiento en base de datos',
    };
  }
}

/**
 * Procesa la lógica transaccional JIT para ensamble de decants en el POS.
 * Recibe un lote (array) de ítems a ensamblar y llama a la función RPC 'assemble_decants_batch'.
 */
export async function prepareDecantSaleTransaction(
  items: DecantAssemblyItem[]
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth();

    const validation = decantAssemblyBatchSchema.safeParse(items);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Parámetros de ensamble JIT inválidos.';
      return { success: false, error: firstError };
    }

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const supabase = getServiceSupabase();

    const { error } = await supabase.rpc('assemble_decants_batch', {
      p_items: validation.data,
    });

    if (error) {
      throw error;
    }

    revalidatePath('/productos');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error en transacción de ensamble JIT:', error);
    const msg = error instanceof Error ? error.message : 'Error al procesar la venta y ensamble JIT';
    return { success: false, error: msg };
  }
}

/**
 * Alternar la visibilidad pública de un producto (is_public = true/false) para la vidriera digital / link-in-bio.
 */
export async function toggleProductVisibility(
  productId: string,
  isPublic: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    if (!productId || !productId.trim()) {
      throw new Error('ID de producto no proporcionado.');
    }

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from('products')
      .update({ is_public: isPublic })
      .eq('id', productId.trim());

    if (error) throw error;

    revalidatePath('/productos');
    revalidatePath('/catalogo');
    revalidatePath('/tienda');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error al cambiar visibilidad pública del producto:', error);
    const msg = error instanceof Error ? error.message : 'Error al actualizar visibilidad';
    return { success: false, error: msg };
  }
}

/**
 * Obtener únicamente insumos de packaging (type = 'supply') para el panel dedicado de insumos.
 */
export async function getSupplies(): Promise<{
  success: boolean;
  data?: Product[];
  error?: string;
}> {
  try {
    // Seguridad: el rol SIEMPRE se deriva de la sesión autenticada (nunca de parámetros del cliente)
    const user = await getCurrentUser();
    const isUserAdmin = user?.role === 'admin';

    if (!isSupabaseConfigured()) {
      return { success: true, data: [] };
    }

    const supabase = getServiceSupabase();
    let query;

    if (isUserAdmin) {
      query = supabase
        .from('products')
        .select('*')
        .eq('type', 'supply')
        .order('name', { ascending: true });
    } else {
      query = supabase
        .from('products')
        .select('id, sku, name, brand, type, is_public, min_stock_alert, base_price_ars, stock_quantity, volume_ml, created_at')
        .eq('type', 'supply')
        .order('name', { ascending: true });
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []) as unknown as DbProductRow[];
    const list: Product[] = rows.map((item) => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      brand: item.brand,
      type: item.type as Product['type'],
      batch_code: item.batch_code || undefined,
      olfactory_family: item.olfactory_family || undefined,
      olfactory_notes: item.olfactory_notes || undefined,
      is_public: Boolean(item.is_public),
      min_stock_alert: Number(item.min_stock_alert || 5),
      base_cost_ars: isUserAdmin && item.base_cost_ars !== undefined && item.base_cost_ars !== null ? Number(item.base_cost_ars) : 0,
      base_price_ars: Number(item.base_price_ars || 0),
      stock_quantity: Number(item.stock_quantity || 0),
      volume_ml: item.volume_ml !== null && item.volume_ml !== undefined ? Number(item.volume_ml) : undefined,
      created_at: item.created_at,
    }));

    return { success: true, data: list };
  } catch (error: unknown) {
    console.error('Error al obtener insumos de packaging:', error);
    const msg = error instanceof Error ? error.message : 'Error al consultar insumos de packaging';
    return { success: false, error: msg };
  }
}

/**
 * Subir imagen de producto optimizada (WebP) a Supabase Storage bucket 'product-images' (Solo Admin).
 */
export async function uploadProductImage(
  formData: FormData
): Promise<{ success: boolean; url?: string; fileName?: string; error?: string }> {
  try {
    await requireAdmin();

    const file = formData.get('image') as File | null;
    const productId = formData.get('productId') as string | null;
    const sku = formData.get('sku') as string | null;

    if (!file) {
      return { success: false, error: 'No se envió ningún archivo de imagen.' };
    }

    if (!isSupabaseConfigured()) {
      return {
        success: true,
        url: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&q=80&w=800',
        fileName: 'mock-image.webp',
      };
    }

    const supabase = getServiceSupabase();

    // Generar nombre de archivo único
    const timestamp = Date.now();
    const cleanId = (productId || sku || 'prod').replace(/[^a-zA-Z0-9_-]/g, '');
    const fileName = `${cleanId}-${timestamp}.webp`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Subir a Storage
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, buffer, {
        contentType: 'image/webp',
        upsert: true,
      });

    if (uploadError) {
      console.error('[UPLOAD_PRODUCT_IMAGE_ERROR]:', uploadError);
      return { success: false, error: `Error al subir imagen: ${uploadError.message}` };
    }

    const { data: publicUrlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);

    const publicUrl = publicUrlData.publicUrl;

    // Si se especificó un productId, guardar también bajo el id fijo para consulta directa
    if (productId) {
      await supabase.storage
        .from('product-images')
        .upload(`${productId}.webp`, buffer, {
          contentType: 'image/webp',
          upsert: true,
        });
    }

    return {
      success: true,
      url: publicUrl,
      fileName,
    };
  } catch (error: unknown) {
    console.error('Error en uploadProductImage:', error);
    const msg = error instanceof Error ? error.message : 'Error al procesar la subida de imagen';
    return { success: false, error: msg };
  }
}
