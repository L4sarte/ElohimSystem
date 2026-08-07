'use server';

import { getServiceSupabase } from '@/lib/supabase';
import { UserRole } from '@/types';
import { getCurrentRate } from '@/app/actions/rates';
import { revalidatePath } from 'next/cache';

export type ComponentType = 'liquid' | 'bottle_frasco' | 'label' | 'atomizer' | 'packaging' | 'other';

export interface RecipeItemInput {
  ingredient_product_id: string;
  component_type: ComponentType;
  quantity: number; // ml si es líquido, unidades si es insumo/packaging
  notes?: string;
}

export interface CalculatedComponent {
  ingredient_product_id: string;
  ingredient_name: string;
  ingredient_sku: string;
  component_type: ComponentType;
  quantity: number;
  unit_cost_ars: number;
  total_component_cost_ars: number;
  total_component_cost_usd: number;
  volume_ml?: number;
}

export interface DynamicCostCalculationResult {
  success: boolean;
  product_id: string;
  product_name: string;
  product_sku: string;
  target_price_ars: number;
  liquid_cost_ars: number;
  packaging_cost_ars: number;
  total_cost_ars: number;
  total_cost_usd: number;
  exchange_rate_used: number;
  components: CalculatedComponent[];
  projected_profit_ars: number;
  projected_margin_percent: number;
  error?: string;
}

/**
 * Calcula el costo dinámico de un producto final (Decant) basado en su Receta BOM.
 * Fórmula:
 *   Costo Líquido = (Costo Perfume Original / ml Totales Perfume) * ml usandos
 *   Costo Packaging = Suma(Costo Insumo Unitario * Unidades usadas)
 */
export async function calculateDynamicCost(
  productId: string,
  customItems?: RecipeItemInput[]
): Promise<DynamicCostCalculationResult> {
  try {
    const supabase = getServiceSupabase();
    let exchangeRate = 1000;

    try {
      const rateRes = await getCurrentRate();
      if (rateRes.data?.value_ars && rateRes.data.value_ars > 0) {
        exchangeRate = rateRes.data.value_ars;
      }
    } catch (rateErr) {
      console.warn('[RECIPE_COST_RATE_WARN] Fallback cotización a 1000 ARS:', rateErr);
    }

    // 1. Obtener producto final objetivo
    const { data: targetProduct, error: prodErr } = await supabase
      .from('products')
      .select('id, name, sku, base_price_ars, base_cost_ars')
      .eq('id', productId)
      .single();

    if (prodErr || !targetProduct) {
      throw new Error(`Producto objetivo con ID ${productId} no encontrado.`);
    }

    let itemsToCalculate: RecipeItemInput[] = [];

    if (customItems && customItems.length > 0) {
      itemsToCalculate = customItems;
    } else {
      // Consultar receta guardada en DB
      const { data: recipe } = await supabase
        .from('product_recipes')
        .select('id')
        .eq('product_id', productId)
        .maybeSingle();

      if (recipe) {
        const { data: dbItems } = await supabase
          .from('recipe_items')
          .select('ingredient_product_id, component_type, quantity, notes')
          .eq('recipe_id', recipe.id);

        if (dbItems) {
          itemsToCalculate = dbItems as RecipeItemInput[];
        }
      }
    }

    if (itemsToCalculate.length === 0) {
      return {
        success: true,
        product_id: targetProduct.id,
        product_name: targetProduct.name,
        product_sku: targetProduct.sku,
        target_price_ars: Number(targetProduct.base_price_ars || 0),
        liquid_cost_ars: 0,
        packaging_cost_ars: 0,
        total_cost_ars: Number(targetProduct.base_cost_ars || 0),
        total_cost_usd: Number(targetProduct.base_cost_ars || 0) / exchangeRate,
        exchange_rate_used: exchangeRate,
        components: [],
        projected_profit_ars: Number(targetProduct.base_price_ars || 0) - Number(targetProduct.base_cost_ars || 0),
        projected_margin_percent: targetProduct.base_price_ars > 0
          ? Number((((targetProduct.base_price_ars - targetProduct.base_cost_ars) / targetProduct.base_price_ars) * 100).toFixed(1))
          : 0
      };
    }

    // 2. Obtener insumos requeridos
    const ingredientIds = Array.from(new Set(itemsToCalculate.map(i => i.ingredient_product_id)));
    const { data: ingredientsData, error: ingErr } = await supabase
      .from('products')
      .select('id, name, sku, type, base_cost_ars, volume_ml')
      .in('id', ingredientIds);

    if (ingErr) throw ingErr;

    const ingredientMap = new Map<string, any>();
    (ingredientsData || []).forEach(ing => ingredientMap.set(ing.id, ing));

    let liquidCostArs = 0;
    let packagingCostArs = 0;
    const components: CalculatedComponent[] = [];

    itemsToCalculate.forEach(item => {
      const ing = ingredientMap.get(item.ingredient_product_id);
      if (!ing) return;

      const qty = Number(item.quantity || 0);
      const baseCostArs = Number(ing.base_cost_ars || 0);
      let componentCostArs = 0;
      let unitCostCalculated = baseCostArs;

      if (item.component_type === 'liquid' || ing.type === 'bottle' || ing.type === 'decant_liquid') {
        const bottleVolumeMl = Number(ing.volume_ml) || 100;
        const costPerMl = bottleVolumeMl > 0 ? baseCostArs / bottleVolumeMl : 0;
        unitCostCalculated = costPerMl;
        componentCostArs = costPerMl * qty;
        liquidCostArs += componentCostArs;
      } else {
        unitCostCalculated = baseCostArs;
        componentCostArs = baseCostArs * qty;
        packagingCostArs += componentCostArs;
      }

      components.push({
        ingredient_product_id: ing.id,
        ingredient_name: ing.name,
        ingredient_sku: ing.sku,
        component_type: item.component_type,
        quantity: qty,
        unit_cost_ars: Number(unitCostCalculated.toFixed(2)),
        total_component_cost_ars: Number(componentCostArs.toFixed(2)),
        total_component_cost_usd: Number((componentCostArs / exchangeRate).toFixed(2)),
        volume_ml: ing.volume_ml
      });
    });

    const totalCostArs = Math.round(liquidCostArs + packagingCostArs);
    const totalCostUsd = Number((totalCostArs / exchangeRate).toFixed(2));
    const targetPriceArs = Number(targetProduct.base_price_ars || 0);
    const projectedProfitArs = targetPriceArs - totalCostArs;
    const projectedMarginPercent = targetPriceArs > 0
      ? Number(((projectedProfitArs / targetPriceArs) * 100).toFixed(1))
      : 0;

    return {
      success: true,
      product_id: targetProduct.id,
      product_name: targetProduct.name,
      product_sku: targetProduct.sku,
      target_price_ars: targetPriceArs,
      liquid_cost_ars: Math.round(liquidCostArs),
      packaging_cost_ars: Math.round(packagingCostArs),
      total_cost_ars: totalCostArs,
      total_cost_usd: totalCostUsd,
      exchange_rate_used: exchangeRate,
      components,
      projected_profit_ars: Math.round(projectedProfitArs),
      projected_margin_percent: projectedMarginPercent
    };
  } catch (error: any) {
    console.error('Error al calcular costo dinámico de receta:', error);
    return {
      success: false,
      product_id: productId,
      product_name: '',
      product_sku: '',
      target_price_ars: 0,
      liquid_cost_ars: 0,
      packaging_cost_ars: 0,
      total_cost_ars: 0,
      total_cost_usd: 0,
      exchange_rate_used: 1000,
      components: [],
      projected_profit_ars: 0,
      projected_margin_percent: 0,
      error: error.message || 'Error al calcular costo dinámico'
    };
  }
}

/**
 * Guardar o actualizar la receta de un producto y recalcular automáticamente su costo base en la tabla `products`.
 */
export async function saveProductRecipe(
  role: UserRole,
  productId: string,
  recipeName: string,
  items: RecipeItemInput[],
  autoUpdateProductCost: boolean = true,
  notes?: string
): Promise<{ success: boolean; calculatedCostArs?: number; error?: string }> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Se requiere rol de Administrador.');
    }

    if (!productId || items.length === 0) {
      throw new Error('Debes seleccionar al menos 1 insumo para armar la receta.');
    }

    const supabase = getServiceSupabase();

    // 1. Crear o actualizar `product_recipes`
    const { data: existingRecipe } = await supabase
      .from('product_recipes')
      .select('id')
      .eq('product_id', productId)
      .maybeSingle();

    let recipeId = existingRecipe?.id;

    if (recipeId) {
      const { error: updateErr } = await supabase
        .from('product_recipes')
        .update({
          name: recipeName,
          notes: notes || null,
          auto_update_cost: autoUpdateProductCost,
          updated_at: new Date().toISOString()
        })
        .eq('id', recipeId);

      if (updateErr) throw updateErr;

      // Borrar ítems anteriores para reemplazar
      await supabase.from('recipe_items').delete().eq('recipe_id', recipeId);
    } else {
      const { data: newRecipe, error: insertErr } = await supabase
        .from('product_recipes')
        .insert({
          product_id: productId,
          name: recipeName,
          notes: notes || null,
          auto_update_cost: autoUpdateProductCost
        })
        .select('id')
        .single();

      if (insertErr || !newRecipe) throw insertErr || new Error('No se pudo crear la receta.');
      recipeId = newRecipe.id;
    }

    // 2. Insertar nuevos ítems
    const recipeItemsToInsert = items.map(item => ({
      recipe_id: recipeId,
      ingredient_product_id: item.ingredient_product_id,
      component_type: item.component_type,
      quantity: item.quantity,
      notes: item.notes || null
    }));

    const { error: itemsInsertErr } = await supabase
      .from('recipe_items')
      .insert(recipeItemsToInsert);

    if (itemsInsertErr) throw itemsInsertErr;

    // 3. Recalcular costo dinámico
    const calcResult = await calculateDynamicCost(productId, items);

    // 4. Si autoUpdateProductCost es true, actualizar base_cost_ars en la tabla products
    if (autoUpdateProductCost && calcResult.success) {
      await supabase
        .from('products')
        .update({
          base_cost_ars: calcResult.total_cost_ars
        })
        .eq('id', productId);
    }

    revalidatePath('/productos');
    revalidatePath('/admin/inventario/recetas');
    revalidatePath('/admin/reportes');

    return {
      success: true,
      calculatedCostArs: calcResult.total_cost_ars
    };
  } catch (error: any) {
    console.error('Error al guardar receta del producto:', error);
    return { success: false, error: error.message || 'Error al guardar la receta.' };
  }
}

/**
 * Obtener la receta existente y sus componentes para un producto dado.
 */
export async function getRecipeForProduct(
  productId: string
): Promise<{ success: boolean; recipe?: any; items?: RecipeItemInput[]; error?: string }> {
  try {
    const supabase = getServiceSupabase();

    const { data: recipe, error: recErr } = await supabase
      .from('product_recipes')
      .select('*')
      .eq('product_id', productId)
      .maybeSingle();

    if (recErr) throw recErr;
    if (!recipe) return { success: true };

    const { data: items, error: itemsErr } = await supabase
      .from('recipe_items')
      .select('ingredient_product_id, component_type, quantity, notes')
      .eq('recipe_id', recipe.id);

    if (itemsErr) throw itemsErr;

    return {
      success: true,
      recipe,
      items: (items || []) as RecipeItemInput[]
    };
  } catch (error: any) {
    console.error('Error al obtener receta:', error);
    return { success: false, error: error.message || 'Error al recuperar receta.' };
  }
}

/**
 * Eliminar receta de un producto.
 */
export async function deleteProductRecipe(
  role: UserRole,
  productId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Se requiere rol de Administrador.');
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from('product_recipes')
      .delete()
      .eq('product_id', productId);

    if (error) throw error;

    revalidatePath('/productos');
    revalidatePath('/admin/inventario/recetas');

    return { success: true };
  } catch (error: any) {
    console.error('Error al eliminar receta:', error);
    return { success: false, error: error.message || 'Error al eliminar la receta.' };
  }
}
