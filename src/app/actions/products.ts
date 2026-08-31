'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { Product, UserRole, DecantAssemblyItem } from '@/types';
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
export async function getProducts(role?: UserRole): Promise<{
  success: boolean;
  data?: Product[];
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    const isUserAdmin = user?.role === 'admin' || role === 'admin';

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
      // Admin tiene acceso total
      query = supabase.from('products').select('*').order('created_at', { ascending: false });
    } else {
      // Vendedor o público no tienen acceso a base_cost_ars
      query = supabase
        .from('products')
        .select('id, sku, name, brand, type, batch_code, olfactory_family, olfactory_notes, is_public, min_stock_alert, base_price_ars, stock_quantity, volume_ml, created_at')
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
  role: UserRole,
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
  role: UserRole,
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
export async function deleteProduct(role: UserRole, id: string): Promise<{ success: boolean; error?: string }> {
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
export async function getDecantLiquids(role?: UserRole): Promise<{
  success: boolean;
  data?: Product[];
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    const isUserAdmin = user?.role === 'admin' || role === 'admin';

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

/**
 * Fraccionar una botella: resta 1 unidad de la botella y suma p_volume_ml al decant seleccionado.
 * Invoca la función transaccional de base de datos 'fractionate_bottle'.
 */
export async function fractionateBottle(
  role: UserRole,
  bottleId: string,
  decantId: string,
  volumeMl: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    const validation = fractionateBottleSchema.safeParse({ bottleId, decantId, volumeMl });
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Parámetros de fraccionamiento inválidos.';
      return { success: false, error: firstError };
    }

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const supabase = getServiceSupabase();

    const { error } = await supabase.rpc('fractionate_bottle', {
      p_bottle_id: validation.data.bottleId,
      p_decant_id: validation.data.decantId,
      p_volume_ml: validation.data.volumeMl,
    });

    if (error) {
      throw error;
    }

    revalidatePath('/productos');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error al fraccionar botella:', error);
    const msg = error instanceof Error ? error.message : 'Error al procesar el fraccionamiento en base de datos';
    return { success: false, error: msg };
  }
}

/**
 * Procesa la lógica transaccional JIT para ensamble de decants en el POS.
 * Recibe un lote (array) de ítems a ensamblar y llama a la función RPC 'assemble_decants_batch'.
 */
export async function prepareDecantSaleTransaction(
  role: UserRole,
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
  role: UserRole,
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
export async function getSupplies(role?: UserRole): Promise<{
  success: boolean;
  data?: Product[];
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    const isUserAdmin = user?.role === 'admin' || role === 'admin';

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
