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

export const systemSettingsSchema = z.object({
  // Identidad & Branding
  company_name: z
    .string()
    .trim()
    .min(2, 'La razón social / nombre de empresa debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar 100 caracteres')
    .default(DEFAULT_SYSTEM_SETTINGS.company_name),
  trade_name: z
    .string()
    .trim()
    .min(2, 'El nombre comercial / de fantasía debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar 100 caracteres')
    .default(DEFAULT_SYSTEM_SETTINGS.trade_name),
  store_name: z
    .string()
    .trim()
    .min(2, 'El nombre de la tienda debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar 100 caracteres')
    .default(DEFAULT_SYSTEM_SETTINGS.store_name),
  slogan: z
    .string()
    .trim()
    .max(150, 'El lema / slogan no puede superar 150 caracteres')
    .default(DEFAULT_SYSTEM_SETTINGS.slogan),
  logo_url: z
    .string()
    .trim()
    .default(DEFAULT_SYSTEM_SETTINGS.logo_url),
  cuit_tax_id: z
    .string()
    .trim()
    .max(30, 'El CUIT / Tax ID no puede superar 30 caracteres')
    .default(DEFAULT_SYSTEM_SETTINGS.cuit_tax_id),

  // Contacto & Redes
  phone: z
    .string()
    .trim()
    .max(50, 'El teléfono no puede superar 50 caracteres')
    .default(DEFAULT_SYSTEM_SETTINGS.phone),
  email: z
    .string()
    .trim()
    .email('Ingresa un correo electrónico válido')
    .or(z.literal(''))
    .default(DEFAULT_SYSTEM_SETTINGS.email),
  address: z
    .string()
    .trim()
    .max(150, 'La dirección no puede superar 150 caracteres')
    .default(DEFAULT_SYSTEM_SETTINGS.address),
  city: z
    .string()
    .trim()
    .max(100, 'La ciudad no puede superar 100 caracteres')
    .default(DEFAULT_SYSTEM_SETTINGS.city),
  instagram_handle: z
    .string()
    .trim()
    .max(50, 'El usuario de Instagram no puede superar 50 caracteres')
    .default(DEFAULT_SYSTEM_SETTINGS.instagram_handle),

  // POS & Tickets
  receipt_header: z
    .string()
    .trim()
    .max(200, 'El encabezado no puede superar 200 caracteres')
    .default(DEFAULT_SYSTEM_SETTINGS.receipt_header),
  receipt_footer_text: z
    .string()
    .trim()
    .max(300, 'El texto del pie de página no puede superar 300 caracteres')
    .default(DEFAULT_SYSTEM_SETTINGS.receipt_footer_text),
  receipt_footer_message: z
    .string()
    .trim()
    .max(300, 'El mensaje no puede superar 300 caracteres')
    .default(DEFAULT_SYSTEM_SETTINGS.receipt_footer_message),
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
  bank_name: z
    .string()
    .trim()
    .max(100, 'El nombre del banco no puede superar 100 caracteres')
    .default(DEFAULT_SYSTEM_SETTINGS.bank_name),
  bank_account_holder: z
    .string()
    .trim()
    .max(100, 'El titular no puede superar 100 caracteres')
    .default(DEFAULT_SYSTEM_SETTINGS.bank_account_holder),
  bank_cbu_cvu: z
    .string()
    .trim()
    .max(50, 'El CBU/CVU no puede superar 50 caracteres')
    .default(DEFAULT_SYSTEM_SETTINGS.bank_cbu_cvu),
  bank_alias: z
    .string()
    .trim()
    .max(50, 'El alias no puede superar 50 caracteres')
    .default(DEFAULT_SYSTEM_SETTINGS.bank_alias),
});

export type SystemSettingsInput = z.infer<typeof systemSettingsSchema>;
