import { DiscountType } from '@/lib/discount-calculations';

/**
 * Tipos compartidos de los submódulos del checkout POS.
 */

/** Opción de insumo disponible para packaging (del catálogo type = 'supply'). */
export interface PackagingSupplyOption {
  id: string;
  name: string;
  stock_quantity: number;
}

/** Insumo de packaging seleccionado para consumirse en la venta. */
export interface PackagingUsedItem {
  packaging_id: string;
  name: string;
  quantity_used: number;
  available_stock: number;
}

/** Ítem del comprobante impreso / exportable. */
export interface ReceiptItem {
  name: string;
  brand: string;
  quantity: number;
  priceArs: number;
  totalArs: number;
}

/** Metadata JSONB de métodos de pago y desgloses enviada a la transacción. */
export interface SalePaymentMethodsPayload {
  cash_ars: number;
  digital_ars: number;
  cash_usd: number;
  exchange_rate_usd: number;
  surcharge_applied_ars: number;
  gateway_fee_ars: number;
  net_received_ars: number;
  pass_fee_to_customer: boolean;
  fee_percentage: number;
  fixed_fee_ars: number;
  selected_method_id: string | null;
  selected_method_name: string;
  vibepoints_used: { points: number; discount_ars: number } | null;
  discount: {
    type: DiscountType;
    value: number;
    amount_ars: number;
    percentage: number;
    subtotal_ars: number;
    final_ars: number;
  } | null;
  treasury_account_id: string;
  breakdown: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

/** Objeto de venta completada para el estado de éxito y el ticket. */
export interface CompletedSaleData {
  saleId: string;
  createdAt: Date;
  clientName: string;
  items: ReceiptItem[];
  subtotalArs: number;
  discountAmountArs: number;
  discountPercentage: number;
  surchargeArs: number;
  totalArs: number;
  totalUsd: number;
  exchangeRate: number;
  paymentMethods: SalePaymentMethodsPayload;
}
