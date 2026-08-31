import { z } from 'zod';

export const purchaseItemInputSchema = z.object({
  product_id: z.string().uuid('ID de producto inválido'),
  quantity: z.number().int('La cantidad debe ser un número entero').positive('La cantidad debe ser mayor a 0'),
  unit_cost_ars: z.number().nonnegative('El costo unitario en ARS no puede ser negativo'),
});

export const purchaseInputSchema = z.object({
  supplier_id: z.string().uuid('ID de proveedor inválido'),
  total_ars: z.number().positive('El total en ARS debe ser mayor a 0'),
  total_usd: z.number().nonnegative('El total en USD no puede ser negativo').default(0),
  payment_status: z.enum(['paid', 'unpaid'] as const),
  due_date: z.string().nullable().optional(),
  items: z.array(purchaseItemInputSchema).min(1, 'La orden de compra debe incluir al menos un producto'),
});

export const supplierInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'El nombre o razón social debe tener al menos 2 caracteres')
    .max(150, 'El nombre no puede superar 150 caracteres'),
  contact_name: z.string().trim().max(100).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  email: z.string().trim().email('Email inválido').optional().nullable().or(z.literal('')),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const poExpenseItemSchema = z.object({
  expense_type: z.enum(['flete', 'aduana', 'packaging', 'comisiones', 'otro'] as const),
  amount: z.number().positive('El monto del gasto debe ser mayor a 0'),
  description: z.string().trim().max(200).optional(),
});

export const createPOPayloadSchema = z.object({
  supplier_id: z.string().uuid('ID de proveedor inválido'),
  status: z.enum(['draft', 'in_transit', 'received', 'cancelled'] as const).default('in_transit'),
  expected_arrival_date: z.string().optional().nullable(),
  tracking_info: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  items: z.array(
    z.object({
      product_id: z.string().uuid('ID de producto inválido'),
      expected_quantity: z.number().int().positive('La cantidad esperada debe ser mayor a 0'),
      unit_cost: z.number().nonnegative('El costo unitario no puede ser negativo'),
    })
  ).min(1, 'Debe incluir al menos un producto'),
  expenses: z.array(poExpenseItemSchema).default([]),
});

export const checkInItemPayloadSchema = z.object({
  item_id: z.string().uuid('ID de ítem inválido'),
  received_quantity: z.number().int().nonnegative('La cantidad recibida no puede ser negativa'),
});

export const checkInBatchSchema = z.object({
  po_id: z.string().uuid('ID de orden de compra inválido'),
  items: z.array(checkInItemPayloadSchema).min(1, 'Debe confirmar al menos un ítem'),
});
