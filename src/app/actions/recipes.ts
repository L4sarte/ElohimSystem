'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserRole } from '@/types';
import { getCurrentRate } from '@/app/actions/rates';
import { revalidatePath } from 'next/cache';
import { requireAdmin, requireAuth } from '@/lib/auth-checks';
import { recipeSaveSchema } from '@/lib/product-validation';

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

interface DbIngredientProduct {
  id: string;
  name: string;
  sku: string;
  type: string;
  base_cost_ars: number | null;
  volume_ml: number | null;
}

/**
 * Calcula el costo dinámico de un producto final (Decant) basado en su Receta BOM.
 * Fórmula:
 *   Costo Líquido = (Costo Perfume Original / ml Totales Perfume) * ml usados
 *   Costo Packaging = Suma(Costo Insumo Unitario * Unidades usadas)
 */
export async function calculateDynamicCost(
  productId: string,
  customItems?: RecipeItemInput[]
): Promise<DynamicCostCalculationResult> {
  try {
    if (!productId || !productId.trim()) {
      throw new Error('ID de producto inválido.');
    }

    if (!isSupabaseConfigured()) {
      return {
        success: true,
        product_id: productId,
        product_name: 'Producto Simulado',
        product_sku: 'SIM-001',
        target_price_ars: 25000,
        liquid_cost_ars: 6000,
        packaging_cost_ars: 1500,
        total_cost_ars: 7500,
        total_cost_usd: 6.0,
        exchange_rate_used: 1250,
        components: [],
        projected_profit_ars: 17500,
        projected_margin_percent: 70.0,
      };
    }

    const supabase = getServiceSupabase();
    let exchangeRate = 1250;

    try {
      const rateRes = await getCurrentRate();
      if (rateRes.data?.value_ars && rateRes.data.value_ars > 0) {
        exchangeRate = rateRes.data.value_ars;
      }
    } catch (rateErr) {
      console.warn('[RECIPE_COST_RATE_WARN] Fallback cotización a 1250 ARS:', rateErr);
    }

    // 1. Obtener producto final objetivo
    const { data: targetProduct, error: prodErr } = await supabase
      .from('products')
      .select('id, name, sku, base_price_ars, base_cost_ars')
      .eq('id', productId.trim())
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
        .eq('product_id', productId.trim())
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
      const baseCost = Number(targetProduct.base_cost_ars || 0);
      const basePrice = Number(targetProduct.base_price_ars || 0);
      const profit = basePrice - baseCost;

      return {
        success: true,
        product_id: targetProduct.id,
        product_name: targetProduct.name,
        product_sku: targetProduct.sku,
        target_price_ars: basePrice,
        liquid_cost_ars: 0,
        packaging_cost_ars: 0,
        total_cost_ars: baseCost,
        total_cost_usd: Number((baseCost / exchangeRate).toFixed(2)),
        exchange_rate_used: exchangeRate,
        components: [],
        projected_profit_ars: profit,
        projected_margin_percent: basePrice > 0 ? Number(((profit / basePrice) * 100).toFixed(1)) : 0,
      };
    }

    // 2. Obtener insumos requeridos
    const ingredientIds = Array.from(new Set(itemsToCalculate.map((i) => i.ingredient_product_id)));
    const { data: ingredientsData, error: ingErr } = await supabase
      .from('products')
      .select('id, name, sku, type, base_cost_ars, volume_ml')
      .in('id', ingredientIds);

    if (ingErr) throw ingErr;

    const rows = (ingredientsData || []) as unknown as DbIngredientProduct[];
    const ingredientMap = new Map<string, DbIngredientProduct>();
    rows.forEach((ing) => ingredientMap.set(ing.id, ing));

    let liquidCostArs = 0;
    let packagingCostArs = 0;
    const components: CalculatedComponent[] = [];

    itemsToCalculate.forEach((item) => {
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
        volume_ml: ing.volume_ml || undefined,
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
      projected_margin_percent: projectedMarginPercent,
    };
  } catch (error: unknown) {
    console.error('Error al calcular costo dinámico de receta:', error);
    const msg = error instanceof Error ? error.message : 'Error al calcular costo dinámico';
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
      exchange_rate_used: 1250,
      components: [],
      projected_profit_ars: 0,
      projected_margin_percent: 0,
      error: msg,
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
    await requireAdmin();

    const validation = recipeSaveSchema.safeParse({
      productId,
      recipeName,
      items,
      autoUpdateProductCost,
      notes,
    });

    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Datos de receta inválidos.';
      return { success: false, error: firstError };
    }

    const clean = validation.data;

    if (!isSupabaseConfigured()) {
      return { success: true, calculatedCostArs: 7500 };
    }

    const supabase = getServiceSupabase();

    // 1. Crear o actualizar `product_recipes`
    const { data: existingRecipe } = await supabase
      .from('product_recipes')
      .select('id')
      .eq('product_id', clean.productId)
      .maybeSingle();

    let recipeId = existingRecipe?.id;

    if (recipeId) {
      const { error: updateErr } = await supabase
        .from('product_recipes')
        .update({
          name: clean.recipeName,
          notes: clean.notes || null,
          auto_update_cost: clean.autoUpdateProductCost,
          updated_at: new Date().toISOString(),
        })
        .eq('id', recipeId);

      if (updateErr) throw updateErr;

      // Borrar ítems anteriores para reemplazar
      await supabase.from('recipe_items').delete().eq('recipe_id', recipeId);
    } else {
      const { data: newRecipe, error: insertErr } = await supabase
        .from('product_recipes')
        .insert({
          product_id: clean.productId,
          name: clean.recipeName,
          notes: clean.notes || null,
          auto_update_cost: clean.autoUpdateProductCost,
        })
        .select('id')
        .single();

      if (insertErr || !newRecipe) throw insertErr || new Error('No se pudo crear la receta.');
      recipeId = newRecipe.id;
    }

    // 2. Insertar nuevos ítems
    const recipeItemsToInsert = clean.items.map((item) => ({
      recipe_id: recipeId,
      ingredient_product_id: item.ingredient_product_id,
      component_type: item.component_type,
      quantity: item.quantity,
      notes: item.notes || null,
    }));

    const { error: itemsInsertErr } = await supabase
      .from('recipe_items')
      .insert(recipeItemsToInsert);

    if (itemsInsertErr) throw itemsInsertErr;

    // 3. Recalcular costo dinámico
    const calcResult = await calculateDynamicCost(clean.productId, clean.items);

    // 4. Si autoUpdateProductCost es true, actualizar base_cost_ars en la tabla products
    if (clean.autoUpdateProductCost && calcResult.success) {
      await supabase
        .from('products')
        .update({
          base_cost_ars: calcResult.total_cost_ars,
        })
        .eq('id', clean.productId);
    }

    revalidatePath('/productos');
    revalidatePath('/admin/inventario/recetas');
    revalidatePath('/admin/reportes');

    return {
      success: true,
      calculatedCostArs: calcResult.total_cost_ars,
    };
  } catch (error: unknown) {
    console.error('Error al guardar receta del producto:', error);
    const msg = error instanceof Error ? error.message : 'Error al guardar la receta.';
    return { success: false, error: msg };
  }
}

export interface ProductRecipeRecord {
  id: string;
  product_id: string;
  name: string;
  notes?: string | null;
  auto_update_cost: boolean;
  created_at: string;
}

/**
 * Obtener la receta existente y sus componentes para un producto dado.
 */
export async function getRecipeForProduct(
  productId: string
): Promise<{ success: boolean; recipe?: ProductRecipeRecord; items?: RecipeItemInput[]; error?: string }> {
  try {
    await requireAuth();

    if (!productId || !productId.trim()) {
      return { success: false, error: 'ID de producto no proporcionado.' };
    }

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const supabase = getServiceSupabase();

    const { data: recipe, error: recErr } = await supabase
      .from('product_recipes')
      .select('*')
      .eq('product_id', productId.trim())
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
      recipe: recipe as ProductRecipeRecord,
      items: (items || []) as RecipeItemInput[],
    };
  } catch (error: unknown) {
    console.error('Error al obtener receta:', error);
    const msg = error instanceof Error ? error.message : 'Error al recuperar receta.';
    return { success: false, error: msg };
  }
}

/**
 * Eliminar receta de un producto (Solo Admin).
 */
export async function deleteProductRecipe(
  role: UserRole,
  productId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    if (!productId || !productId.trim()) {
      throw new Error('ID de producto no especificado.');
    }

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from('product_recipes')
      .delete()
      .eq('product_id', productId.trim());

    if (error) throw error;

    revalidatePath('/productos');
    revalidatePath('/admin/inventario/recetas');

    return { success: true };
  } catch (error: unknown) {
    console.error('Error al eliminar receta:', error);
    const msg = error instanceof Error ? error.message : 'Error al eliminar la receta.';
    return { success: false, error: msg };
  }
}
