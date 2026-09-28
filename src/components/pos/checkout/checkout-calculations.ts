import { UserRole } from '@/types';
import { CartItem } from '@/hooks/use-pos-store';
import { PaymentMethodConfig } from '@/app/actions/fees';
import { DiscountType, DiscountCalculationResult, calculateDiscount } from '@/lib/discount-calculations';

/**
 * Motor de cálculo puro del checkout bimonetario: descuentos (con Decimal.js),
 * recargos/retenciones de pasarela, canje de VibePoints, pagos parciales/fiado,
 * vuelto y equivalencias USD. Función testeable sin dependencias de React ni DB.
 */
export function calculateCheckoutTotals(params: {
  role: UserRole;
  totalArs: number;
  exchangeRate: number;
  cartItems: CartItem[];
  activeMethods: PaymentMethodConfig[];
  selectedMethodId: string;
  cashArs: string;
  digitalArs: string;
  cashUsd: string;
  discountType: DiscountType;
  discountInputValue: string;
  amountPaidTodayInput: string;
  useVibePoints: boolean;
  clientPoints: number;
  isRegisteredClient: boolean;
}) {
  const {
    role,
    totalArs,
    exchangeRate,
    cartItems,
    activeMethods,
    selectedMethodId,
    cashArs,
    digitalArs,
    cashUsd,
    discountType,
    discountInputValue,
    amountPaidTodayInput,
    useVibePoints,
    clientPoints,
    isRegisteredClient,
  } = params;

  // Valores parseados
  const valCashArs = parseFloat(cashArs) || 0;
  const valDigitalArs = parseFloat(digitalArs) || 0;
  const valCashUsd = parseFloat(cashUsd) || 0;

  // Conversión de USD a ARS
  const usdInArs = Math.round(valCashUsd * exchangeRate);

  // Método de pago seleccionado
  const selectedMethod: PaymentMethodConfig | undefined = activeMethods.find(m => m.id === selectedMethodId);

  const feePercent = selectedMethod ? Number(selectedMethod.fee_percentage !== undefined ? selectedMethod.fee_percentage : (selectedMethod.surcharge_percent || 0)) : 0;
  const fixedFeeArs = selectedMethod ? Number(selectedMethod.fixed_fee_ars || 0) : 0;
  const passFeeToCustomer = selectedMethod ? Boolean(selectedMethod.pass_fee_to_customer) : false;

  // Subtotal base original directo del carrito
  const subtotalOriginalArs = totalArs;

  // Cálculo del Descuento con Decimal.js
  const discountResult: DiscountCalculationResult = calculateDiscount(
    subtotalOriginalArs,
    discountType,
    discountInputValue
  );

  // Validación de tope de vendedor (máx 20%)
  const isSellerOverLimit = role !== 'admin' && discountResult.discountPercentage > 20;

  // Subtotal neto tras aplicar descuento
  const subtotalAfterDiscountArs = discountResult.totalArs;

  // Costo total del carrito para alerta de margen negativo
  const totalCartCogs = cartItems.reduce((sum, item) => {
    let itemCost = Number(item.product.base_cost_ars || 0);
    if (item.product.type === 'decant_liquid' && item.decantMl) {
      itemCost = Number(item.product.base_cost_ars || 0) * item.decantMl;
    }
    return sum + (itemCost * item.quantity);
  }, 0);

  const isBelowCogs = discountResult.discountAmountArs > 0 && subtotalAfterDiscountArs < totalCartCogs;

  // Base imponible para el cálculo de comisiones/recargos de pasarela
  // Si se ingresó efectivo o dólares (pago mixto), el recargo solo aplica sobre la porción digital
  const isMixedPayment = valCashArs > 0 || valCashUsd > 0;
  const feeTaxableBaseArs = isMixedPayment ? valDigitalArs : (valDigitalArs > 0 ? valDigitalArs : subtotalAfterDiscountArs);

  // Comisión calculada de la pasarela sobre la porción correspondiente
  const calculatedGatewayFeeArs = (feePercent > 0 || fixedFeeArs > 0) && feeTaxableBaseArs > 0
    ? Math.round(feeTaxableBaseArs * (feePercent / 100) + fixedFeeArs)
    : 0;

  let totalSurchargeArs = 0;
  let finalTotalArsToCharge = subtotalAfterDiscountArs;
  let netReceivedArs = subtotalAfterDiscountArs;

  if (calculatedGatewayFeeArs > 0) {
    if (passFeeToCustomer) {
      // Recargo transferido al cliente (se le suma al total a pagar)
      totalSurchargeArs = calculatedGatewayFeeArs;
      finalTotalArsToCharge = subtotalAfterDiscountArs + totalSurchargeArs;
      netReceivedArs = subtotalAfterDiscountArs;
    } else {
      // Elohim absorbe la comisión (el cliente paga el subtotal con descuento)
      totalSurchargeArs = 0;
      finalTotalArsToCharge = subtotalAfterDiscountArs;
      netReceivedArs = Math.max(0, subtotalAfterDiscountArs - calculatedGatewayFeeArs);
    }
  }

  // Canje de VibePoints (1 pt = 10 ARS descuento)
  const maxDiscountArs = clientPoints * 10;
  const vibePointsDiscountArs = (useVibePoints && clientPoints > 0)
    ? Math.min(maxDiscountArs, Math.max(0, finalTotalArsToCharge - 1))
    : 0;
  const vibePointsCountUsed = Math.ceil(vibePointsDiscountArs / 10);

  // Total a pagar neto aplicando el canje de VibePoints
  const effectiveTotalArsToPay = Math.max(0, finalTotalArsToCharge - vibePointsDiscountArs);

  // Monto Abonado Hoy y Saldo Pendiente (Pagos Parciales / Fiado)
  const rawAmountPaidToday = amountPaidTodayInput !== '' ? parseFloat(amountPaidTodayInput) : effectiveTotalArsToPay;
  const amountPaidToday = isNaN(rawAmountPaidToday) ? effectiveTotalArsToPay : Math.max(0, rawAmountPaidToday);
  const amountDueArs = Math.max(0, Math.round(effectiveTotalArsToPay - amountPaidToday));
  const paymentStatus: 'partial' | 'paid' = amountDueArs > 0 ? 'partial' : 'paid';

  // Total abonado por el usuario en desglose
  const digitalFinalArs = valDigitalArs;
  const totalPaidArs = valCashArs + usdInArs + digitalFinalArs;
  const differenceArs = totalPaidArs - amountPaidToday;

  const isCovered = totalPaidArs >= amountPaidToday - 0.01;
  const canProceed = !isSellerOverLimit && discountResult.isValid && (isCovered || (amountDueArs > 0 && isRegisteredClient));

  const totalUsd = effectiveTotalArsToPay / exchangeRate;

  return {
    valCashArs,
    valDigitalArs,
    valCashUsd,
    usdInArs,
    exchangeRate,
    selectedMethod,
    feePercent,
    fixedFeeArs,
    passFeeToCustomer,
    subtotalOriginalArs,
    discountResult,
    isSellerOverLimit,
    subtotalAfterDiscountArs,
    totalCartCogs,
    isBelowCogs,
    calculatedGatewayFeeArs,
    totalSurchargeArs,
    finalTotalArsToCharge,
    netReceivedArs,
    vibePointsDiscountArs,
    vibePointsCountUsed,
    effectiveTotalArsToPay,
    amountPaidToday,
    amountDueArs,
    paymentStatus,
    digitalFinalArs,
    totalPaidArs,
    differenceArs,
    isCovered,
    canProceed,
    totalUsd,
  };
}

export type CheckoutTotals = ReturnType<typeof calculateCheckoutTotals>;
