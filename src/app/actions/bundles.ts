'use server';

import { getServiceSupabase } from '@/lib/supabase';
import { UserRole } from '@/types';
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
export async function getBundles(role: UserRole): Promise<{ success: boolean; data?: ProductBundle[]; error?: string }> {
  try {
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
  role: UserRole,
  input: BundleInput
): Promise<{ success: boolean; bundleId?: string; error?: string }> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Se requiere rol de Administrador.');
    }

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
    revalidatePath('/pos');
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
  role: UserRole,
  bundleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Se requiere rol de Administrador.');
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from('product_bundles')
      .delete()
      .eq('id', bundleId);

    if (error) throw error;

    revalidatePath('/productos');
    revalidatePath('/pos');
    return { success: true };
  } catch (error: any) {
    console.error('Error al eliminar combo:', error);
    return { success: false, error: error.message || 'Error al eliminar combo' };
  }
}

/**
 * Lógica auxiliar para descontar stock de los componentes individuales de un combo.
 * Si la función RPC 'deduct_bundle_stock' no existe en la BD, ejecuta la iteración en JavaScript.
 */
export async function processBundleStockDeduction(
  supabase: any,
  bundleId: string,
  multiplierQuantity: number = 1
): Promise<void> {
  try {
    // 1. Intentar llamar a la función RPC
    const { error: rpcError } = await supabase.rpc('deduct_bundle_stock', {
      p_bundle_id: bundleId,
      p_quantity: multiplierQuantity
    });

    if (!rpcError) return;

    // 2. Fallback: Si no existe el RPC, iterar manualmente sobre bundle_items
    const { data: items } = await supabase
      .from('bundle_items')
      .select('product_id, quantity_to_deduct')
      .eq('bundle_id', bundleId);

    if (!items || items.length === 0) return;

    for (const item of items) {
      const deductQty = Number(item.quantity_to_deduct || 1) * multiplierQuantity;

      const { data: currentProduct } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', item.product_id)
        .single();

      const currentStock = Number(currentProduct?.stock_quantity || 0);
      const newStock = Math.max(0, currentStock - deductQty);

      await supabase
        .from('products')
        .update({ stock_quantity: newStock })
        .eq('id', item.product_id);
    }
  } catch (e) {
    console.error('Error al procesar descuento de stock de combo:', e);
  }
}
