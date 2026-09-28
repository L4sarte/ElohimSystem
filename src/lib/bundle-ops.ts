import { revalidatePath } from 'next/cache';

/**
 * Lógica auxiliar para descontar stock de los componentes individuales de un combo.
 * Si la función RPC 'deduct_bundle_stock' no existe en la BD, ejecuta la iteración en JavaScript.
 *
 * NOTA DE SEGURIDAD: Este módulo NO lleva la directiva 'use server'.
 * Sus funciones NO son invocables desde el navegador como endpoints HTTP:
 * solo pueden ser utilizadas por Server Actions que ya validaron sesión/rol.
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

    revalidatePath('/productos');
    revalidatePath('/admin/inventario/kardex');
  } catch (e) {
    console.error('Error al procesar descuento de stock de combo:', e);
  }
}
