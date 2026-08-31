import { z } from 'zod';

export const clientInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'El nombre del cliente debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email('Email inválido').optional().nullable().or(z.literal('')),
  preferred_notes: z.array(z.string().trim()).default([]),
});

export const clientUpdateSchema = z.object({
  id: z.string().uuid('ID de cliente inválido'),
  data: clientInputSchema,
});

export const installmentPaymentSchema = z.object({
  sale_id: z.string().uuid('ID de venta inválido'),
  amount_paid_ars: z.number().positive('El monto a abonar debe ser mayor a 0'),
  payment_method: z.string().trim().min(1, 'El medio de pago es obligatorio').default('Efectivo ARS'),
  notes: z.string().trim().max(300).optional(),
});

export const receivablePaymentSchema = z.object({
  receivable_id: z.string().uuid('ID de cuenta por cobrar inválido'),
  amount_paid: z.number().positive('El monto a abonar debe ser mayor a 0'),
  notes: z.string().trim().max(300).optional(),
});
