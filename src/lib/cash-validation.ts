import { z } from 'zod';

export const openCashShiftSchema = z.object({
  initial_ars: z.number().min(0, 'El fondo inicial en ARS no puede ser negativo'),
  initial_usd: z.number().min(0, 'El fondo inicial en USD no puede ser negativo'),
  notes: z.string().trim().max(500, 'Las notas no pueden superar 500 caracteres').optional(),
});

export const closeCashShiftSchema = z.object({
  shiftId: z.string().trim().min(1, 'Identificador de turno inválido'),
  declared_ars: z.number().min(0, 'El monto declarado en ARS no puede ser negativo'),
  declared_usd: z.number().min(0, 'El monto declarado en USD no puede ser negativo'),
  notes: z.string().trim().max(500, 'Las notas no pueden superar 500 caracteres').optional(),
});

export const cashMovementSchema = z.object({
  shiftId: z.string().trim().min(1, 'Identificador de turno inválido'),
  type: z.enum(['in', 'out'], {
    message: 'El tipo de movimiento debe ser "in" (ingreso) o "out" (egreso)',
  }),
  amount_ars: z.number().min(0, 'El monto en ARS no puede ser negativo'),
  amount_usd: z.number().min(0, 'El monto en USD no puede ser negativo'),
  description: z
    .string()
    .trim()
    .min(3, 'La descripción del movimiento debe tener al menos 3 caracteres')
    .max(300, 'La descripción no puede superar 300 caracteres'),
});

export const treasuryTransferSchema = z.object({
  fromAccountId: z.string().trim().min(1, 'Cuenta de origen inválida'),
  toAccountId: z.string().trim().min(1, 'Cuenta de destino inválida'),
  amount_ars: z.number().positive('El monto a transferir debe ser mayor a $0 ARS'),
  notes: z.string().trim().max(500).optional(),
}).refine((data) => data.fromAccountId !== data.toAccountId, {
  message: 'La cuenta de origen y destino no pueden ser la misma',
  path: ['toAccountId'],
});

export const createTreasuryAccountSchema = z.object({
  account_name: z
    .string()
    .trim()
    .min(2, 'El nombre de la cuenta debe contener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  account_type: z.enum(['wallet', 'bank', 'cash'], {
    message: 'Tipo de cuenta inválido (wallet, bank o cash)',
  }),
  initial_balance_ars: z.number().min(0, 'El saldo inicial no puede ser negativo').default(0),
});

export const updateAccountBalanceSchema = z.object({
  accountId: z.string().trim().min(1, 'ID de cuenta inválido'),
  newBalanceArs: z.number().finite('El saldo debe ser un número válido'),
  reason: z.string().trim().max(300).optional(),
});
