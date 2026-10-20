import { z } from 'zod';

export const purchaseCurrencySchema = z.enum(['ARS', 'USD'] as const);
export const paymentConditionSchema = z.enum(['CONTADO', 'CUENTA_CORRIENTE'] as const);
export const purchaseStatusSchema = z.enum(['draft', 'in_transit', 'received', 'cancelled'] as const);
export const purchasePaymentStatusSchema = z.enum(['paid_cash', 'pending_credit', 'partial_payment', 'paid', 'unpaid'] as const);

export const purchaseItemInputSchema = z.object({
  product_id: z.string().uuid('ID de producto inválido'),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
  unit_cost: z.number().nonnegative('El costo unitario no puede ser negativo').optional(),
  unit_cost_ars: z.number().nonnegative('El costo unitario en ARS no puede ser negativo'),
  currency: purchaseCurrencySchema.default('ARS'),
});

export const poExpenseItemSchema = z.object({
  expense_type: z.enum(['flete', 'aduana', 'packaging', 'comisiones', 'otro'] as const),
  amount: z.number().positive('El monto del gasto debe ser mayor a 0'),
  description: z.string().trim().max(200).optional(),
});

export const purchaseInputSchema = z
  .object({
    supplier_id: z.string().uuid('ID de proveedor inválido'),
    status: purchaseStatusSchema.default('received'),
    currency: purchaseCurrencySchema.default('ARS'),
    exchange_rate: z.number().positive('La cotización del dólar debe ser mayor a 0').default(1250),
    total_ars: z.number().positive('El total en ARS debe ser mayor a 0'),
    total_usd: z.number().nonnegative('El total en USD no puede ser negativo').default(0),
    payment_condition: paymentConditionSchema.optional(),
    payment_status: purchasePaymentStatusSchema.default('paid_cash'),
    treasury_account_id: z.string().uuid('ID de cuenta de tesorería inválido').nullable().optional(),
    payment_due_date: z.string().nullable().optional(),
    due_date: z.string().nullable().optional(),
    expected_arrival_date: z.string().nullable().optional(),
    tracking_info: z.string().trim().max(150).nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
    items: z.array(purchaseItemInputSchema).min(1, 'La orden de compra debe incluir al menos un producto'),
    expenses: z.array(poExpenseItemSchema).default([]),
  })
  .superRefine((data, ctx) => {
    const isCash =
      data.payment_condition === 'CONTADO' ||
      (!data.payment_condition && (data.payment_status === 'paid_cash' || data.payment_status === 'paid'));

    if (isCash && !data.treasury_account_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['treasury_account_id'],
        message: 'Debe seleccionar obligatoriamente una cuenta de tesorería para compras al Contado.',
      });
    }
  });

export const settleProviderDebtSchema = z.object({
  debt_id: z.string().uuid('ID de deuda o compra inválido'),
  amount_paid: z.number().positive('El monto a abonar debe ser mayor a 0'),
  treasury_account_id: z.string().uuid('Debe seleccionar una cuenta de tesorería válida'),
  currency: purchaseCurrencySchema.default('ARS'),
  exchange_rate: z.number().positive('La cotización debe ser mayor a 0').default(1250),
  notes: z.string().trim().max(300).optional().nullable(),
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

export const createPOPayloadSchema = z.object({
  supplier_id: z.string().uuid('ID de proveedor inválido'),
  status: purchaseStatusSchema.default('in_transit'),
  expected_arrival_date: z.string().optional().nullable(),
  tracking_info: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid('ID de producto inválido'),
        expected_quantity: z.number().int().positive('La cantidad esperada debe ser mayor a 0'),
        unit_cost: z.number().nonnegative('El costo unitario no puede ser negativo'),
      })
    )
    .min(1, 'Debe incluir al menos un producto'),
  expenses: z.array(poExpenseItemSchema).default([]),
});

export const checkInItemPayloadSchema = z.object({
  item_id: z.string().uuid('ID de ítem inválido'),
  received_quantity: z.number().int().nonnegative('La cantidad recibida no puede ser negativa'),
});

export const checkInPaymentDetailsSchema = z
  .object({
    isPaid: z.boolean().default(true),
    paymentType: z.enum(['immediate', 'cxp', 'already_paid']).optional(),
    isAlreadyPaid: z.boolean().optional(),
    treasuryAccountId: z.string().uuid('ID de cuenta de tesorería inválido').optional().nullable(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)').optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  .optional()
  .nullable();

export const checkInBatchSchema = z.object({
  po_id: z.string().uuid('ID de orden de compra inválido'),
  items: z.array(checkInItemPayloadSchema).min(1, 'Debe confirmar al menos un ítem'),
  paymentDetails: checkInPaymentDetailsSchema,
});

