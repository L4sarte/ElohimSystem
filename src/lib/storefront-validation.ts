import { z } from 'zod';

export interface PublicProduct {
  id: string;
  sku: string;
  name: string;
  brand: string;
  type: 'bottle' | 'decant_liquid' | 'supply';
  olfactory_family: string | null;
  olfactory_notes: string[] | null;
  base_price_ars: number;
  stock_quantity: number;
  volume_ml?: number | null;
  image_url?: string | null;
  description?: string | null;
  created_at?: string;
}

export interface CatalogFilters {
  query?: string;
  brand?: string;
  olfactory_family?: string;
  type?: 'all' | 'bottle' | 'decant_liquid';
  minPrice?: number;
  maxPrice?: number;
  sort?: 'name_asc' | 'price_asc' | 'price_desc' | 'newest';
}

export const onlineOrderSchema = z.object({
  client_name: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  client_phone: z
    .string()
    .trim()
    .min(6, 'Ingresa un número de WhatsApp/teléfono válido')
    .max(30, 'Número telefónico demasiado largo'),
  client_email: z
    .string()
    .trim()
    .email('Ingresa un correo electrónico válido')
    .or(z.literal(''))
    .optional(),
  client_dni: z
    .string()
    .trim()
    .max(30)
    .optional()
    .or(z.literal('')),

  delivery_method: z.enum(['shipping', 'pickup'], {
    message: 'Selecciona una modalidad de entrega válida',
  }),
  shipping_address: z.string().trim().max(250).optional().or(z.literal('')),
  shipping_city: z.string().trim().max(100).optional().or(z.literal('')),
  shipping_notes: z.string().trim().max(500).optional().or(z.literal('')),

  payment_method: z.enum(['transfer', 'cash_on_delivery', 'digital_gateway'], {
    message: 'Selecciona un método de pago válido',
  }),

  items: z
    .array(
      z.object({
        product_id: z.string().uuid('ID de producto inválido'),
        quantity: z.number().int().min(1, 'La cantidad debe ser al menos 1'),
        format: z.string().optional(),
      })
    )
    .min(1, 'El carrito no puede estar vacío'),
});

export type CreateOnlineOrderInput = z.infer<typeof onlineOrderSchema>;
