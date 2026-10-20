import Decimal from 'decimal.js';

export interface ProfitSplit {
  netProfit: number;
  ownerPayout: number;
  reinvestmentProfit: number;
  totalBusinessKeep: number;
}

/**
 * Calcula la división de utilidades entre retiro personal (bolsillo/sueldo)
 * y fondo de reinversión para crecimiento del negocio.
 * 
 * Reglas de Negocio:
 * 1. Costo del Producto (COGS): 100% intocable, vuelve siempre a la empresa.
 * 2. Ganancia Neta Limpia = Max(0, sellingPrice - costPrice).
 * 3. Retiro Personal = Ganancia Neta * (payoutPercentage / 100).
 * 4. Utilidad Reinvertida = Ganancia Neta * (1 - (payoutPercentage / 100)).
 * 5. Total que se queda en el Negocio = Costo + Utilidad Reinvertida.
 *
 * @param sellingPrice Precio de venta unitario o total (ARS o divisa base).
 * @param costPrice Costo de adquisición o reposición (COGS).
 * @param payoutPercentage Porcentaje asignado al retiro personal (0 a 100).
 * @param decimals Cantidad de decimales para redondeo (default: 2).
 */
export function calculateProfitSplit(
  sellingPrice: number,
  costPrice: number,
  payoutPercentage: number = 30,
  decimals: number = 2
): ProfitSplit {
  // 1. Sanitización de entradas numéricas
  const validSell = Number.isFinite(sellingPrice) ? Math.max(0, sellingPrice) : 0;
  const validCost = Number.isFinite(costPrice) ? Math.max(0, costPrice) : 0;
  
  // Limitar porcentaje entre 0% y 100%
  const clampedPercent = Number.isFinite(payoutPercentage)
    ? Math.min(100, Math.max(0, payoutPercentage))
    : 30;

  // 2. Cálculo de Ganancia Neta Limpia
  const dSell = new Decimal(validSell);
  const dCost = new Decimal(validCost);
  const dNetProfit = Decimal.max(0, dSell.minus(dCost));

  // 3. Tasas de división
  const dPayoutRate = new Decimal(clampedPercent).dividedBy(100);
  const dReinvestRate = new Decimal(1).minus(dPayoutRate);

  // 4. Repartos
  const dOwnerPayout = dNetProfit.times(dPayoutRate);
  const dReinvestment = dNetProfit.times(dReinvestRate);
  const dBusinessKeep = dCost.plus(dReinvestment);

  const roundNum = (val: Decimal): number => {
    return Number(val.toFixed(decimals));
  };

  return {
    netProfit: roundNum(dNetProfit),
    ownerPayout: roundNum(dOwnerPayout),
    reinvestmentProfit: roundNum(dReinvestment),
    totalBusinessKeep: roundNum(dBusinessKeep),
  };
}

/**
 * Calcula la división de utilidades a partir de una ganancia neta ya consolidada (ej. mensual global).
 *
 * @param consolidatedNetProfit Ganancia neta final consolidada del período.
 * @param payoutPercentage Porcentaje asignado al dueño (0 a 100).
 */
export function calculateConsolidatedProfitSplit(
  consolidatedNetProfit: number,
  payoutPercentage: number = 30
): {
  netProfit: number;
  ownerPayout: number;
  reinvestmentProfit: number;
} {
  const validProfit = Number.isFinite(consolidatedNetProfit) ? Math.max(0, consolidatedNetProfit) : 0;
  const clampedPercent = Number.isFinite(payoutPercentage)
    ? Math.min(100, Math.max(0, payoutPercentage))
    : 30;

  const dProfit = new Decimal(validProfit);
  const dPayoutRate = new Decimal(clampedPercent).dividedBy(100);
  const dReinvestRate = new Decimal(1).minus(dPayoutRate);

  const ownerPayout = Math.round(dProfit.times(dPayoutRate).toNumber());
  const reinvestmentProfit = Math.round(dProfit.times(dReinvestRate).toNumber());

  return {
    netProfit: Math.round(validProfit),
    ownerPayout,
    reinvestmentProfit,
  };
}
