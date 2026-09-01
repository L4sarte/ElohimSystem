import Decimal from 'decimal.js';

export interface FinancialTotalsInput {
  grossRevenue: number | string;
  cogs: number | string;
  gatewayFees: number | string;
  opex: number | string;
  refunds?: number | string;
}

export interface CalculatedFinancialTotals {
  grossRevenue: number;
  cogs: number;
  grossMargin: number;
  grossMarginPercent: number;
  gatewayFees: number;
  opex: number;
  refunds: number;
  netProfit: number;
  netMarginPercent: number;
}

/**
 * Calcula el estado de resultados y rentabilidad exacta usando Decimal.js.
 * Fórmula:
 *   Margen Bruto = Ingresos Brutos - COGS
 *   Ganancia Neta = Margen Bruto - Comisiones Pasarela - OPEX - Reintegros
 */
export function calculateFinancialTotals(input: FinancialTotalsInput): CalculatedFinancialTotals {
  const dGross = new Decimal(input.grossRevenue || 0);
  const dCogs = new Decimal(input.cogs || 0);
  const dFees = new Decimal(input.gatewayFees || 0);
  const dOpex = new Decimal(input.opex || 0);
  const dRefunds = new Decimal(input.refunds || 0);

  const dGrossMargin = dGross.minus(dCogs);
  const dNetProfit = dGrossMargin.minus(dFees).minus(dOpex).minus(dRefunds);

  let grossMarginPercent = 0;
  if (dGross.greaterThan(0)) {
    grossMarginPercent = Number(dGrossMargin.dividedBy(dGross).times(100).toFixed(2));
  }

  let netMarginPercent = 0;
  if (dGross.greaterThan(0)) {
    netMarginPercent = Number(dNetProfit.dividedBy(dGross).times(100).toFixed(2));
  }

  return {
    grossRevenue: Math.round(dGross.toNumber()),
    cogs: Math.round(dCogs.toNumber()),
    grossMargin: Math.round(dGrossMargin.toNumber()),
    grossMarginPercent,
    gatewayFees: Math.round(dFees.toNumber()),
    opex: Math.round(dOpex.toNumber()),
    refunds: Math.round(dRefunds.toNumber()),
    netProfit: Math.round(dNetProfit.toNumber()),
    netMarginPercent,
  };
}

/**
 * Calcula el Ticket Promedio (AOV - Average Order Value) de forma segura.
 */
export function calculateAOV(grossRevenue: number | string, salesCount: number): number {
  if (salesCount <= 0) return 0;
  const dGross = new Decimal(grossRevenue || 0);
  return Math.round(dGross.dividedBy(salesCount).toNumber());
}

/**
 * Calcula la ganancia estimada de un ítem de venta individual.
 */
export function calculateItemProfit(priceArs: number | string, costArs: number | string, quantity: number | string): number {
  const dPrice = new Decimal(priceArs || 0);
  const dCost = new Decimal(costArs || 0);
  const dQty = new Decimal(quantity || 1);
  return dPrice.minus(dCost).times(dQty).toNumber();
}
