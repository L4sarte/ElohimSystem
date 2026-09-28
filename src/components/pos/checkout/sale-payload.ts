import { CartItem } from '@/hooks/use-pos-store';
import { CheckoutTotals } from './checkout-calculations';
import { PackagingUsedItem, ReceiptItem, SalePaymentMethodsPayload } from './types';

/**
 * Builders puros de los payloads del checkout POS: ítems, decants JIT,
 * metadata de métodos de pago y desgloses, e ítems del comprobante.
 * Funciones testeables sin dependencias de React.
 */

export function buildSaleItems(cartItems: CartItem[], exchangeRate: number) {
  return cartItems.map(item => {
    let priceArs = item.product.base_price_ars;
    if (item.product.type === 'decant_liquid' && item.decantMl) {
      const supplyPrice = Number(item.selectedSupplyPrice ?? 0);
      priceArs = (item.product.base_price_ars * item.decantMl) + supplyPrice;
    }

    return {
      product_id: item.product.id,
      quantity: item.quantity,
      price_ars: priceArs,
      price_usd: priceArs / exchangeRate
    };
  });
}

export function buildDecants(cartItems: CartItem[]) {
  return cartItems
    .filter(item => item.product.type === 'decant_liquid' && item.decantMl && item.selectedSupplyId)
    .map(item => {
      return {
        decant_liquid_id: item.product.id,
        ml_quantity: (item.decantMl || 0) * item.quantity,
        supply_id: item.selectedSupplyId!
      };
    });
}

export function buildPaymentMethodsPayload(
  totals: CheckoutTotals,
  selectedTreasuryAccountId: string
): SalePaymentMethodsPayload {
  const methodName = totals.selectedMethod
    ? (totals.selectedMethod.method_name || totals.selectedMethod.name || 'Digital')
    : 'Efectivo / Directo';

  const breakdown = [];

  if (totals.discountResult.discountAmountArs > 0) {
    breakdown.push({
      method_name: `Descuento Comercial (${totals.discountResult.discountPercentage}%)`,
      amount_base: totals.discountResult.discountAmountArs,
      surcharge_applied: 0,
      final_amount: -totals.discountResult.discountAmountArs
    });
  }

  if (totals.valCashArs > 0) {
    breakdown.push({
      method_name: 'Efectivo ARS',
      amount_base: totals.valCashArs,
      surcharge_applied: 0,
      final_amount: totals.valCashArs
    });
  }

  if (totals.valCashUsd > 0) {
    breakdown.push({
      method_name: 'Dólares Billete',
      amount_base: totals.usdInArs,
      surcharge_applied: 0,
      final_amount: totals.usdInArs,
      amount_usd: totals.valCashUsd
    });
  }

  if (totals.valDigitalArs > 0) {
    breakdown.push({
      method_name: methodName,
      amount_base: totals.valDigitalArs,
      surcharge_applied: totals.totalSurchargeArs,
      gateway_fee_ars: totals.calculatedGatewayFeeArs,
      net_received_ars: totals.netReceivedArs,
      final_amount: totals.digitalFinalArs
    });
  }

  if (totals.vibePointsDiscountArs > 0) {
    breakdown.push({
      method_name: 'VibePoints (Canje)',
      amount_base: totals.vibePointsDiscountArs,
      surcharge_applied: 0,
      final_amount: totals.vibePointsDiscountArs,
      points_redeemed: totals.vibePointsCountUsed
    });
  }

  return {
    cash_ars: totals.valCashArs > 0 ? totals.valCashArs : 0,
    digital_ars: totals.valDigitalArs > 0 ? totals.valDigitalArs : 0,
    cash_usd: totals.valCashUsd > 0 ? totals.valCashUsd : 0,
    exchange_rate_usd: totals.exchangeRate,
    surcharge_applied_ars: totals.totalSurchargeArs,
    gateway_fee_ars: totals.calculatedGatewayFeeArs,
    net_received_ars: totals.netReceivedArs,
    pass_fee_to_customer: totals.passFeeToCustomer,
    fee_percentage: totals.feePercent,
    fixed_fee_ars: totals.fixedFeeArs,
    selected_method_id: totals.selectedMethod ? totals.selectedMethod.id : null,
    selected_method_name: methodName,
    vibepoints_used: totals.vibePointsDiscountArs > 0 ? {
      points: totals.vibePointsCountUsed,
      discount_ars: totals.vibePointsDiscountArs
    } : null,
    discount: totals.discountResult.discountAmountArs > 0 ? {
      type: totals.discountResult.discountType,
      value: totals.discountResult.discountValue,
      amount_ars: totals.discountResult.discountAmountArs,
      percentage: totals.discountResult.discountPercentage,
      subtotal_ars: totals.discountResult.subtotalArs,
      final_ars: totals.discountResult.totalArs
    } : null,
    treasury_account_id: selectedTreasuryAccountId,
    breakdown
  };
}

export function buildReceiptItems(cartItems: CartItem[], selectedPackaging: PackagingUsedItem[]): ReceiptItem[] {
  const receiptItems = cartItems.map(item => {
    let priceArs = item.product.base_price_ars;
    if (item.product.type === 'decant_liquid' && item.decantMl) {
      const supplyPrice = Number(item.selectedSupplyPrice ?? 0);
      priceArs = (item.product.base_price_ars * item.decantMl) + supplyPrice;
    }

    let nameDisplay = item.product.name;
    if (item.product.type === 'decant_liquid' && item.decantMl) {
      nameDisplay = `Decant ${item.product.name} (${item.decantMl}ml)`;
    }

    return {
      name: nameDisplay,
      brand: item.product.brand,
      quantity: item.quantity,
      priceArs,
      totalArs: priceArs * item.quantity
    };
  });

  // Incluir insumos de packaging en la lista impresa del ticket
  selectedPackaging.forEach(p => {
    receiptItems.push({
      name: `Packaging: ${p.name}`,
      brand: 'Elohim Packaging',
      quantity: p.quantity_used,
      priceArs: 0,
      totalArs: 0
    });
  });

  return receiptItems;
}
