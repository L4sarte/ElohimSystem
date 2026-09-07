import Decimal from 'decimal.js';

export type DiscountType = 'none' | 'percentage' | 'fixed' | 'target_amount' | 'target_percentage';

export interface DiscountCalculationResult {
  subtotalArs: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmountArs: number;
  discountPercentage: number;
  totalArs: number;
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Calcula con rigor matemático (Decimal.js) el descuento y precio final
 * a partir del subtotal y del modo de ajuste seleccionado en el POS.
 *
 * Satisface invariantes contables:
 *   subtotalArs - discountAmountArs === totalArs
 *   0 <= discountAmountArs <= subtotalArs
 *   0 <= totalArs <= subtotalArs
 *   0 <= discountPercentage <= 100
 */
export function calculateDiscount(
  subtotal: number | Decimal | string,
  type: DiscountType,
  value: number | Decimal | string
): DiscountCalculationResult {
  const subtotalDec = new Decimal(subtotal || 0).round();
  const subtotalNum = subtotalDec.toNumber();

  // Si no hay subtotal o el modo es 'none', devolver sin descuento
  if (subtotalDec.isZero() || subtotalDec.isNegative() || type === 'none') {
    return {
      subtotalArs: Math.max(0, subtotalNum),
      discountType: 'none',
      discountValue: 0,
      discountAmountArs: 0,
      discountPercentage: 0,
      totalArs: Math.max(0, subtotalNum),
      isValid: true,
    };
  }

  // Parsear el valor de entrada
  let rawValue: number;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      // Campo vacío: se interpreta como sin descuento temporal mientras tipea
      return {
        subtotalArs: subtotalNum,
        discountType: type,
        discountValue: 0,
        discountAmountArs: 0,
        discountPercentage: 0,
        totalArs: subtotalNum,
        isValid: true,
      };
    }
    rawValue = parseFloat(trimmed);
  } else if (value instanceof Decimal) {
    rawValue = value.toNumber();
  } else {
    rawValue = Number(value);
  }

  if (isNaN(rawValue)) {
    return {
      subtotalArs: subtotalNum,
      discountType: type,
      discountValue: 0,
      discountAmountArs: 0,
      discountPercentage: 0,
      totalArs: subtotalNum,
      isValid: false,
      errorMessage: 'El valor ingresado no es un número válido.',
    };
  }

  const valDec = new Decimal(rawValue);

  switch (type) {
    case 'percentage': {
      if (valDec.isNegative()) {
        return {
          subtotalArs: subtotalNum,
          discountType: type,
          discountValue: rawValue,
          discountAmountArs: 0,
          discountPercentage: 0,
          totalArs: subtotalNum,
          isValid: false,
          errorMessage: 'El porcentaje de descuento no puede ser negativo.',
        };
      }
      if (valDec.greaterThan(100)) {
        return {
          subtotalArs: subtotalNum,
          discountType: type,
          discountValue: rawValue,
          discountAmountArs: subtotalNum,
          discountPercentage: 100,
          totalArs: 0,
          isValid: false,
          errorMessage: 'El porcentaje de descuento no puede superar el 100%.',
        };
      }

      // discountAmount = round(subtotal * (pct / 100))
      const discountAmount = subtotalDec.times(valDec).div(100).round();
      const total = subtotalDec.minus(discountAmount);
      const effectivePercentage = valDec.toDecimalPlaces(2).toNumber();

      return {
        subtotalArs: subtotalNum,
        discountType: 'percentage',
        discountValue: rawValue,
        discountAmountArs: discountAmount.toNumber(),
        discountPercentage: effectivePercentage,
        totalArs: total.toNumber(),
        isValid: true,
      };
    }

    case 'fixed': {
      if (valDec.isNegative()) {
        return {
          subtotalArs: subtotalNum,
          discountType: type,
          discountValue: rawValue,
          discountAmountArs: 0,
          discountPercentage: 0,
          totalArs: subtotalNum,
          isValid: false,
          errorMessage: 'El importe de descuento no puede ser negativo.',
        };
      }
      if (valDec.greaterThan(subtotalDec)) {
        return {
          subtotalArs: subtotalNum,
          discountType: type,
          discountValue: rawValue,
          discountAmountArs: subtotalNum,
          discountPercentage: 100,
          totalArs: 0,
          isValid: false,
          errorMessage: 'El descuento no puede superar el subtotal de la venta ($' + subtotalNum.toLocaleString('es-AR') + ').',
        };
      }

      const discountAmount = valDec.round();
      const total = subtotalDec.minus(discountAmount);
      const effectivePercentage = subtotalDec.isZero()
        ? 0
        : discountAmount.div(subtotalDec).times(100).toDecimalPlaces(2).toNumber();

      return {
        subtotalArs: subtotalNum,
        discountType: 'fixed',
        discountValue: rawValue,
        discountAmountArs: discountAmount.toNumber(),
        discountPercentage: effectivePercentage,
        totalArs: total.toNumber(),
        isValid: true,
      };
    }

    case 'target_amount': {
      if (valDec.isNegative()) {
        return {
          subtotalArs: subtotalNum,
          discountType: type,
          discountValue: rawValue,
          discountAmountArs: 0,
          discountPercentage: 0,
          totalArs: subtotalNum,
          isValid: false,
          errorMessage: 'El monto final a cobrar no puede ser negativo.',
        };
      }
      if (valDec.greaterThan(subtotalDec)) {
        return {
          subtotalArs: subtotalNum,
          discountType: type,
          discountValue: rawValue,
          discountAmountArs: 0,
          discountPercentage: 0,
          totalArs: subtotalNum,
          isValid: false,
          errorMessage: 'El monto a cobrar no puede ser mayor al subtotal original ($' + subtotalNum.toLocaleString('es-AR') + '). Para aplicar recargos utiliza la opción de medios de pago.',
        };
      }

      const total = valDec.round();
      const discountAmount = subtotalDec.minus(total);
      const effectivePercentage = subtotalDec.isZero()
        ? 0
        : discountAmount.div(subtotalDec).times(100).toDecimalPlaces(2).toNumber();

      return {
        subtotalArs: subtotalNum,
        discountType: 'target_amount',
        discountValue: rawValue,
        discountAmountArs: discountAmount.toNumber(),
        discountPercentage: effectivePercentage,
        totalArs: total.toNumber(),
        isValid: true,
      };
    }

    case 'target_percentage': {
      if (valDec.isNegative()) {
        return {
          subtotalArs: subtotalNum,
          discountType: type,
          discountValue: rawValue,
          discountAmountArs: 0,
          discountPercentage: 0,
          totalArs: subtotalNum,
          isValid: false,
          errorMessage: 'El porcentaje a cobrar no puede ser negativo.',
        };
      }
      if (valDec.greaterThan(100)) {
        return {
          subtotalArs: subtotalNum,
          discountType: type,
          discountValue: rawValue,
          discountAmountArs: 0,
          discountPercentage: 0,
          totalArs: subtotalNum,
          isValid: false,
          errorMessage: 'El porcentaje a cobrar no puede superar el 100%.',
        };
      }

      // total = round(subtotal * (targetPct / 100))
      const total = subtotalDec.times(valDec).div(100).round();
      const discountAmount = subtotalDec.minus(total);
      const effectivePercentage = new Decimal(100).minus(valDec).toDecimalPlaces(2).toNumber();

      return {
        subtotalArs: subtotalNum,
        discountType: 'target_percentage',
        discountValue: rawValue,
        discountAmountArs: discountAmount.toNumber(),
        discountPercentage: effectivePercentage,
        totalArs: total.toNumber(),
        isValid: true,
      };
    }

    default: {
      return {
        subtotalArs: subtotalNum,
        discountType: 'none',
        discountValue: 0,
        discountAmountArs: 0,
        discountPercentage: 0,
        totalArs: subtotalNum,
        isValid: true,
      };
    }
  }
}

/**
 * Convierte y sincroniza el valor de entrada al cambiar de modo de descuento,
 * permitiendo conservar el descuento existente en la unidad del nuevo modo.
 */
export function convertDiscountValueBetweenModes(
  currentResult: DiscountCalculationResult,
  targetType: DiscountType,
  subtotal: number
): string {
  if (targetType === 'none' || subtotal <= 0) return '';
  if (currentResult.discountAmountArs <= 0) return '';

  switch (targetType) {
    case 'percentage':
      return currentResult.discountPercentage ? currentResult.discountPercentage.toString() : '';
    case 'fixed':
      return currentResult.discountAmountArs ? currentResult.discountAmountArs.toString() : '';
    case 'target_amount':
      return currentResult.totalArs ? currentResult.totalArs.toString() : '';
    case 'target_percentage': {
      const targetPct = Math.max(0, Math.min(100, 100 - currentResult.discountPercentage));
      return Number(targetPct.toFixed(2)).toString();
    }
    default:
      return '';
  }
}
