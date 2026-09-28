'use server';

import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth, requireAdmin } from '@/lib/auth-checks';
import { revalidatePath } from 'next/cache';

export interface BundleItemInput {
  product_id: string;
  quantity_to_deduct: number;
}

export interface BundleInput {
  sku: string;
  name: string;
  description?: string;
  price_ars: number;
  price_usd: number;
  is_active?: boolean;
  items: BundleItemInput[];
}

export interface ProductBundle {
  id: string;
  sku: string;
  name: string;
  description?: string;
  price_ars: number;
  price_usd: number;
  is_active: boolean;
  created_at?: string;
  bundle_items?: Array<{
    id: string;
    product_id: string;
    quantity_to_deduct: number;
    products?: {
      id: string;
      name: string;
      brand: string;
      sku: string;
      stock_quantity: number;
      type: string;
    };
  }>;
}

/**
 * Obtener todos los Combos / Bundles registrados en el sistema.
 */
export async function getBundles(): Promise<{ success: boolean; data?: ProductBundle[]; error?: string }> {
  try {
    // Seguridad: acceso a combos solo para usuarios autenticados (rol derivado de la sesión)
    await requireAuth();

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('product_bundles')
      .select(`
        *,
        bundle_items (
          id,
          product_id,
          quantity_to_deduct,
          products (
            id,
            name,
            brand,
            sku,
            stock_quantity,
            type
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error al obtener combos/bundles:', error);
    return { success: false, error: error.message || 'Error al obtener combos/bundles' };
  }
}

/**
 * Crear un nuevo Combo / Bundle (Solo Admin).
 */
export async function createBundle(
  input: BundleInput
): Promise<{ success: boolean; bundleId?: string; error?: string }> {
  try {
    // Seguridad: el rol SIEMPRE se deriva de la sesión autenticada (nunca de parámetros del cliente)
    await requireAdmin();

    if (!input.name || !input.sku) {
      throw new Error('El nombre y el SKU del combo son obligatorios.');
    }

    if (!input.items || input.items.length === 0) {
      throw new Error('Un combo debe incluir al menos un producto componente.');
    }

    const supabase = getServiceSupabase();

    // 1. Insertar encabezado del combo
    const { data: bundleData, error: bundleError } = await supabase
      .from('product_bundles')
      .insert({
        sku: input.sku.trim().toUpperCase(),
        name: input.name.trim(),
        description: input.description?.trim() || null,
        price_ars: Number(input.price_ars || 0),
        price_usd: Number(input.price_usd || 0),
        is_active: input.is_active !== undefined ? input.is_active : true
      })
      .select('id')
      .single();

    if (bundleError) throw bundleError;
    const bundleId = bundleData.id;

    // 2. Insertar los ítems / componentes relacionales del combo
    const itemsToInsert = input.items.map(item => ({
      bundle_id: bundleId,
      product_id: item.product_id,
      quantity_to_deduct: Number(item.quantity_to_deduct || 1)
    }));

    const { error: itemsError } = await supabase
      .from('bundle_items')
      .insert(itemsToInsert);

    if (itemsError) throw itemsError;

    revalidatePath('/productos');
    return { success: true, bundleId };
  } catch (error: any) {
    console.error('Error al crear el combo:', error);
    return { success: false, error: error.message || 'Error al crear el combo' };
  }
}

/**
 * Eliminar un Combo / Bundle (Solo Admin).
 */
export async function deleteBundle(
  bundleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Seguridad: el rol SIEMPRE se deriva de la sesión autenticada (nunca de parámetros del cliente)
    await requireAdmin();

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from('product_bundles')
      .delete()
      .eq('id', bundleId);

    if (error) throw error;

    revalidatePath('/productos');
    return { success: true };
  } catch (error: any) {
    console.error('Error al eliminar combo:', error);
    return { success: false, error: error.message || 'Error al eliminar combo' };
  }
}

/**
 * Lógica auxiliar para descontar stock de componentes de un combo.
 * NOTA DE SEGURIDAD: movida a src/lib/bundle-ops.ts (módulo no-'use server', no invocable desde el navegador).
 */
