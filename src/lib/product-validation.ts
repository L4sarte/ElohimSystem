import { z } from 'zod';

export const productInputSchema = z.object({
  sku: z.string().min(2, 'El SKU debe tener al menos 2 caracteres').trim().toUpperCase(),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').trim(),
  brand: z.string().min(2, 'La marca debe tener al menos 2 caracteres').trim(),
  type: z.enum(['bottle', 'decant_liquid', 'supply'] as const, {
    message: 'Tipo de producto inválido (bottle, decant_liquid o supply)',
  }),
  batch_code: z.string().optional().nullable().or(z.literal('')),
  olfactory_family: z.string().optional().nullable().or(z.literal('')),
  olfactory_notes: z.array(z.string()).optional().default([]),
  is_public: z.boolean().optional().default(true),
  min_stock_alert: z.coerce.number().min(0, 'El stock mínimo no puede ser negativo').optional().default(5),
  base_cost_ars: z.coerce.number().min(0, 'El costo base debe ser un número positivo o cero'),
  base_price_ars: z.coerce.number().min(0, 'El precio base debe ser un número positivo o cero'),
  stock_quantity: z.coerce.number().min(0, 'El stock debe ser un número positivo o cero'),
  volume_ml: z.coerce.number().optional().nullable().or(z.literal('')),
});

export const fractionateBottleSchema = z.object({
  bottleId: z.string().uuid('ID de botella inválido'),
  decantId: z.string().uuid('ID de decant a granel inválido'),
  volumeMl: z.number().positive('El volumen a fraccionar debe ser mayor a 0 ml'),
});

export const decantAssemblyItemSchema = z.object({
  decant_liquid_id: z.string().uuid('ID de perfume a granel inválido'),
  supply_id: z.string().uuid('ID de frasco de insumo inválido'),
  ml_quantity: z.number().positive('La cantidad de ml debe ser mayor a 0'),
});

export const decantAssemblyBatchSchema = z.array(decantAssemblyItemSchema).min(1, 'Debe incluir al menos un decant a ensamblar');

export const recipeItemInputSchema = z.object({
  ingredient_product_id: z.string().uuid('ID de insumo inválido'),
  component_type: z.enum(['liquid', 'bottle_frasco', 'label', 'atomizer', 'packaging', 'other'] as const),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
  notes: z.string().trim().max(300).optional(),
});

export const recipeSaveSchema = z.object({
  productId: z.string().uuid('ID de producto inválido'),
  recipeName: z.string().trim().min(2, 'El nombre de la receta debe tener al menos 2 caracteres').max(100),
  sizeMl: z.coerce.number().int().positive('La medida en ml debe ser mayor a 0').optional().default(5),
  items: z.array(recipeItemInputSchema).min(1, 'Debes incluir al menos un insumo en la receta'),
  autoUpdateProductCost: z.boolean().default(true),
  notes: z.string().trim().max(500).optional(),
});

export const inventoryAdjustSchema = z.object({
  productId: z.string().uuid('ID de producto inválido'),
  type: z.string().trim().min(2, 'Tipo de ajuste requerido (ej. Merma, Rotura, Conteo)'),
  quantity: z.number().refine((val) => val !== 0, 'La cantidad debe ser distinta de cero'),
  reason: z.string().trim().min(3, 'Debes ingresar un motivo de al menos 3 caracteres').max(300),
});
