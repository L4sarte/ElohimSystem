import { z } from 'zod';

export const systemSettingsSchema = z.object({
  store_name: z
    .string()
    .trim()
    .min(2, 'El nombre del establecimiento debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  receipt_footer_text: z
    .string()
    .trim()
    .max(300, 'El texto del pie de página no puede superar 300 caracteres')
    .default(''),
  enable_auto_stock_alerts: z.boolean().default(true),
});
