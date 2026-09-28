import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';

export interface RecipeFallbackInfo {
  sizeMl: number;
  supplyCostArs: number;
}

/**
 * Construye el mapa de fallback de recetas BOM para productos sin costo congelado
 * (unit_cost_at_moment) ni de catálogo: resuelve el tamaño REAL de la muestra y el
 * costo REAL de insumos desde product_recipes + recipe_items (una sola query batched).
 * Reemplaza los valores hardcodeados (decantMl: 5, supplyCostArs: 559) del motor
 * canónico de resolución de costos.
 */
export async function buildRecipeFallbackMap(
  productIds: Set<string>
): Promise<Record<string, RecipeFallbackInfo>> {
  const fallbackMap: Record<string, RecipeFallbackInfo> = {};
  if (productIds.size === 0 || !isSupabaseConfigured()) return fallbackMap;

  try {
    const supabase = getServiceSupabase();
    const { data: recipesData } = await supabase
      .from('product_recipes')
      .select(`
        product_id,
        recipe_items (
          component_type,
          quantity,
          products ( base_cost_ars )
        )
      `)
      .in('product_id', Array.from(productIds));

    (recipesData || []).forEach((rec: any) => {
      const items = rec.recipe_items || [];
      const liquidItem = items.find((it: any) => it.component_type === 'liquid');
      const sizeMl = Number(liquidItem?.quantity || 0);
      if (sizeMl <= 0) return;

      // Costo real de insumos: Σ(costo del ingrediente × cantidad) para frascos,
      // etiquetas, atomizadores y packaging (consistente con calculateDynamicCost).
      const supplyCostArs = items
        .filter((it: any) => it.component_type !== 'liquid')
        .reduce((sum: number, it: any) => sum + Number(it.products?.base_cost_ars || 0) * Number(it.quantity || 1), 0);

      fallbackMap[rec.product_id] = { sizeMl, supplyCostArs: Math.round(supplyCostArs) };
    });
  } catch (err) {
    console.warn('[RECIPE_FALLBACK_WARN] No se pudieron resolver recetas BOM para el fallback de costos:', err);
  }

  return fallbackMap;
}
