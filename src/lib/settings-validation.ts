import { z } from 'zod';

export interface SystemSettingsData {
  id?: string;
  // Identidad & Branding
  company_name: string;
  trade_name: string;
  store_name: string;
  slogan: string;
  logo_url: string;
  cuit_tax_id: string;

  // Contacto & Redes
  phone: string;
  email: string;
  address: string;
  city: string;
  instagram_handle: string;

  // POS & Tickets
  receipt_header: string;
  receipt_footer_text: string;
  receipt_footer_message: string;
  warranty_policy_days: number;
  enable_auto_stock_alerts: boolean;
  default_min_stock_alert: number;

  // Datos Bancarios
  bank_name: string;
  bank_account_holder: string;
  bank_cbu_cvu: string;
  bank_alias: string;

  updated_at?: string;
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettingsData = {
  company_name: 'Elohim Import S.R.L.',
  trade_name: 'Elohim Perfumería & Decants',
  store_name: 'Elohim Perfumería & Decants',
  slogan: 'Alta Perfumería de Nicho & Decants Fraccionados',
  logo_url: '/logo-elohim.png',
  cuit_tax_id: '30-71829384-9',

  phone: '+54 9 11 5555-0199',
  email: 'contacto@elohimimport.com',
  address: 'Av. Santa Fe 1234, Local 12',
  city: 'CABA, Buenos Aires',
  instagram_handle: '@elohim.perfumes',

  receipt_header: 'DOCUMENTO NO VÁLIDO COMO FACTURA',
  receipt_footer_text: '¡Gracias por elegir Elohim Perfumería! Conserva este ticket para cambios.',
  receipt_footer_message: '¡Gracias por elegir Elohim Perfumería! Conserva este ticket para cambios.',
  warranty_policy_days: 30,
  enable_auto_stock_alerts: true,
  default_min_stock_alert: 3,

  bank_name: 'Banco Galicia / Mercado Pago',
  bank_account_holder: 'Elohim Import S.R.L.',
  bank_cbu_cvu: '0070123400000012345678',
  bank_alias: 'ELOHIM.PERFUMES.ARS',
};

// Helper para strings opcionales o vacíos
const optionalString = (maxLen: number = 255, defaultVal: string = '') =>
  z
    .string()
    .trim()
    .max(maxLen, `No puede superar los ${maxLen} caracteres`)
    .optional()
    .or(z.literal(''))
    .nullable()
    .transform((val) => (val ?? defaultVal));

export const systemSettingsSchema = z.object({
  // Identidad & Branding
  company_name: optionalString(150, DEFAULT_SYSTEM_SETTINGS.company_name),
  trade_name: z
    .string()
    .trim()
    .min(1, 'El nombre comercial / de fantasía no puede estar vacío')
    .max(150, 'El nombre comercial no puede superar 150 caracteres')
    .default(DEFAULT_SYSTEM_SETTINGS.trade_name),
  store_name: optionalString(150, DEFAULT_SYSTEM_SETTINGS.store_name),
  slogan: optionalString(250, DEFAULT_SYSTEM_SETTINGS.slogan),
  logo_url: optionalString(1000, DEFAULT_SYSTEM_SETTINGS.logo_url),
  cuit_tax_id: optionalString(50, DEFAULT_SYSTEM_SETTINGS.cuit_tax_id),

  // Contacto & Redes
  phone: optionalString(50, DEFAULT_SYSTEM_SETTINGS.phone),
  email: z
    .string()
    .trim()
    .email('Ingresa un correo electrónico válido')
    .optional()
    .or(z.literal(''))
    .nullable()
    .transform((val) => (val ?? DEFAULT_SYSTEM_SETTINGS.email)),
  address: optionalString(250, DEFAULT_SYSTEM_SETTINGS.address),
  city: optionalString(100, DEFAULT_SYSTEM_SETTINGS.city),
  instagram_handle: optionalString(50, DEFAULT_SYSTEM_SETTINGS.instagram_handle),

  // POS & Tickets
  receipt_header: optionalString(250, DEFAULT_SYSTEM_SETTINGS.receipt_header),
  receipt_footer_text: optionalString(500, DEFAULT_SYSTEM_SETTINGS.receipt_footer_text),
  receipt_footer_message: optionalString(500, DEFAULT_SYSTEM_SETTINGS.receipt_footer_message),
  warranty_policy_days: z
    .coerce
    .number()
    .int('Los días de garantía deben ser un número entero')
    .min(0, 'No puede ser negativo')
    .max(365, 'No puede superar 365 días')
    .default(DEFAULT_SYSTEM_SETTINGS.warranty_policy_days),
  enable_auto_stock_alerts: z.boolean().default(DEFAULT_SYSTEM_SETTINGS.enable_auto_stock_alerts),
  default_min_stock_alert: z
    .coerce
    .number()
    .int('El umbral de stock debe ser un número entero')
    .min(0, 'No puede ser negativo')
    .max(1000, 'No puede superar 1000 unidades')
    .default(DEFAULT_SYSTEM_SETTINGS.default_min_stock_alert),

  // Datos Bancarios
  bank_name: optionalString(100, DEFAULT_SYSTEM_SETTINGS.bank_name),
  bank_account_holder: optionalString(150, DEFAULT_SYSTEM_SETTINGS.bank_account_holder),
  bank_cbu_cvu: optionalString(50, DEFAULT_SYSTEM_SETTINGS.bank_cbu_cvu),
  bank_alias: optionalString(50, DEFAULT_SYSTEM_SETTINGS.bank_alias),
});

export type SystemSettingsInput = z.infer<typeof systemSettingsSchema>;
