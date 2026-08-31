import { z } from 'zod';

export const kanbanStatusEnum = z.enum(['pending', 'processing', 'ready', 'delivered'] as const);

export const kanbanOrderInputSchema = z.object({
  client_name: z
    .string()
    .trim()
    .min(2, 'El nombre del cliente debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  product_details: z.string().trim().max(500).optional().nullable(),
  total_ars: z.number().nonnegative('El total en ARS no puede ser negativo').default(0),
  status: kanbanStatusEnum.default('pending'),
  notes: z.string().trim().max(300).optional().nullable(),
});

export const kanbanStatusUpdateSchema = z.object({
  id: z.string().uuid('ID de pedido inválido'),
  status: kanbanStatusEnum,
});

export const shippingStatusEnum = z.enum(['pending', 'shipped', 'delivered'] as const);

export const shippingUpdateSchema = z.object({
  shipping_provider: z.string().trim().max(50).default('Ninguno'),
  tracking_number: z.string().trim().max(100).default(''),
  shipping_status: shippingStatusEnum.default('pending'),
});
