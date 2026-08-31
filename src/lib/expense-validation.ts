import { z } from 'zod';

export const operatingExpenseInputSchema = z.object({
  category: z
    .string()
    .trim()
    .min(2, 'La categoría debe tener al menos 2 caracteres')
    .max(50, 'La categoría no puede superar 50 caracteres')
    .default('Varios'),
  amount_ars: z.number().positive('El monto en ARS debe ser mayor a 0'),
  amount_usd: z.number().nonnegative('El monto en USD no puede ser negativo').default(0),
  description: z
    .string()
    .trim()
    .min(3, 'La descripción debe tener al menos 3 caracteres')
    .max(250, 'La descripción no puede superar 250 caracteres'),
  expense_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (AAAA-MM-DD)')
    .default(() => new Date().toISOString().split('T')[0]),
  treasury_account_id: z.string().uuid('ID de cuenta de tesorería inválido').optional().nullable(),
});

export const operatingExpenseUpdateSchema = z.object({
  id: z.string().uuid('ID de gasto inválido'),
  data: operatingExpenseInputSchema,
});
