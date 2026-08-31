import { z } from 'zod';
import Decimal from 'decimal.js';

export const saleItemInputSchema = z.object({
  product_id: z.string().uuid('ID de producto inválido'),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
  price_ars: z.number().nonnegative('El precio en ARS no puede ser negativo'),
  price_usd: z.number().nonnegative('El precio en USD no puede ser negativo').optional().default(0),
});

export const decantJitInputSchema = z.object({
  decant_liquid_id: z.string().uuid('ID de perfume a granel inválido'),
  ml_quantity: z.number().positive('Los mililitros fraccionados deben ser mayores a 0'),
  supply_id: z.string().uuid('ID de frasco de insumo inválido'),
});

export const packagingUsedInputSchema = z.object({
  packaging_id: z.string().uuid('ID de insumo de empaque inválido'),
  quantity_used: z.number().positive('La cantidad de packaging debe ser mayor a 0'),
});

export const saleInputSchema = z.object({
  client_id: z.string().uuid('ID de cliente inválido').nullable().optional(),
  seller_id: z.string().uuid('ID de vendedor inválido').nullable().optional(),
  total_ars: z.number().positive('El total en ARS debe ser mayor a 0'),
  total_usd_equivalent: z.number().nonnegative().optional().default(0),
  exchange_rate_used: z.number().positive('La cotización del dólar debe ser mayor a 0'),
  amount_paid_today: z.number().nonnegative().optional(),
  amount_due_ars: z.number().nonnegative().optional(),
  payment_status: z.enum(['paid', 'partial', 'pending']).optional(),
  payment_methods: z.record(z.string(), z.any()).optional().default({}),
  items: z.array(saleItemInputSchema).min(1, 'La venta debe incluir al menos un producto'),
  decants: z.array(decantJitInputSchema).optional().default([]),
  packaging_supplies: z.array(packagingUsedInputSchema).optional().default([]),
});

export const returnProcessInputSchema = z.object({
  sale_id: z.string().uuid('ID de venta inválido'),
  return_reason: z
    .string()
    .trim()
    .min(3, 'El motivo de la devolución debe contener al menos 3 caracteres')
    .max(500, 'El motivo es demasiado extenso'),
  restock_item: z.boolean().default(true),
  refund_amount_ars: z.number().nonnegative('El monto a reembolsar no puede ser negativo'),
});

export const paymentMethodConfigInputSchema = z.object({
  method_name: z.string().trim().min(2, 'El nombre del medio de pago debe tener al menos 2 caracteres'),
  fee_percentage: z.number().min(0, 'El porcentaje no puede ser negativo').max(100, 'El porcentaje no puede superar 100'),
  fixed_fee_ars: z.number().min(0, 'El cargo fijo no puede ser negativo').default(0),
  pass_fee_to_customer: z.boolean().default(false),
  is_active: z.boolean().default(true),
  name: z.string().optional(),
  surcharge_percent: z.number().optional(),
});

/**
 * Calcula con precisión Decimal el total monetario de una lista de ítems.
 */
export function calculatePreciseTotal(items: Array<{ price_ars: number; quantity: number }>): number {
  let total = new Decimal(0);
  for (const item of items) {
    const itemTotal = new Decimal(item.price_ars).times(new Decimal(item.quantity));
    total = total.plus(itemTotal);
  }
  return total.toNumber();
}
