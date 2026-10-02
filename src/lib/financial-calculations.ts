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

export interface ResolveItemCostParams {
  itemUnitCostAtMoment?: number | null;
  productBaseCostArs?: number | null;
  recipeCostArs?: number | null;
  lastPurchaseOrderCostArs?: number | null;
  productType?: string | null;
  decantMl?: number | null;
  supplyCostArs?: number | null;
}

export interface ResolvedCostResult {
  unitCost: number;
  source: 'unit_cost_at_moment' | 'catalog_base_cost' | 'recipe_bom' | 'purchase_order' | 'decant_calculated' | 'none';
  hasCost: boolean;
}

/**
 * Cadena de Resolución de Costo Unitario Canónica (Fallback Inteligente para COGS).
 * 1º: sale_items.unit_cost_at_moment (si fue guardado al momento de la venta y es > 0).
 * 2º: Si es decant_liquid, calcula (ml * costo_ml) + costo_frasco.
 * 3º: Costo dinámico de receta BOM (si está precalculado).
 * 4º: products.base_cost_ars (costo actual de catálogo para botellas/insumos).
 * 5º: Último costo registrado en purchase_order_items para ese producto.
 * 6º: Alerta si no tiene costo configurado en ningún lado (retorna 0).
 */
export function resolveItemUnitCost(params: ResolveItemCostParams): ResolvedCostResult {
  if (params.itemUnitCostAtMoment !== undefined && params.itemUnitCostAtMoment !== null && Number(params.itemUnitCostAtMoment) > 0) {
    const rawCost = Number(params.itemUnitCostAtMoment);
    const baseCost = Number(params.productBaseCostArs || 0);

    // Detección y saneamiento de registros históricos congelados a 1 ml:
    // Si el producto es decant_liquid y unit_cost_at_moment <= baseCost * 1.5,
    // significa que se congeló solo 1 ml en lugar del volumen completo (ej. 5 o 10 ml).
    // Recalculamos con base en decantMl * baseCost para proteger el P&L histórico.
    if (params.productType === 'decant_liquid' && baseCost > 0 && rawCost <= (baseCost * 1.5)) {
      const ml = Number(params.decantMl || 5);
      return {
        unitCost: new Decimal(baseCost).times(ml).toNumber(),
        source: 'decant_calculated',
        hasCost: true,
      };
    }

    return {
      unitCost: rawCost,
      source: 'unit_cost_at_moment',
      hasCost: true,
    };
  }

  // Soporte especializado para decants / perfumes fraccionados
  if (params.productType === 'decant_liquid') {
    const ml = Number(params.decantMl || 5);
    const mlCost = Number(params.productBaseCostArs || 0);

    if (params.recipeCostArs !== undefined && params.recipeCostArs !== null && Number(params.recipeCostArs) > 0) {
      return {
        unitCost: Number(params.recipeCostArs),
        source: 'recipe_bom',
        hasCost: true,
      };
    }

    if (mlCost > 0) {
      // Regla Elohim Import: base_cost_ars ya contempla insumos. Costo = base_cost_ars * decant_ml.
      const calculatedDecantCost = new Decimal(mlCost).times(ml).toNumber();
      return {
        unitCost: calculatedDecantCost,
        source: 'decant_calculated',
        hasCost: true,
      };
    }
  }

  if (params.recipeCostArs !== undefined && params.recipeCostArs !== null && Number(params.recipeCostArs) > 0) {
    return {
      unitCost: Number(params.recipeCostArs),
      source: 'recipe_bom',
      hasCost: true,
    };
  }

  if (params.productBaseCostArs !== undefined && params.productBaseCostArs !== null && Number(params.productBaseCostArs) > 0) {
    return {
      unitCost: Number(params.productBaseCostArs),
      source: 'catalog_base_cost',
      hasCost: true,
    };
  }

  if (params.lastPurchaseOrderCostArs !== undefined && params.lastPurchaseOrderCostArs !== null && Number(params.lastPurchaseOrderCostArs) > 0) {
    return {
      unitCost: Number(params.lastPurchaseOrderCostArs),
      source: 'purchase_order',
      hasCost: true,
    };
  }

  return {
    unitCost: 0,
    source: 'none',
    hasCost: false,
  };
}

/**
 * Calcula el Margen Bruto de una venta absorbiendo correctamente descuentos comerciales.
 * Margen Bruto = total_ars - COGS_total
 */
export function calculateSaleGrossMargin(totalArs: number | string, cogsArs: number | string): number {
  const dTotal = new Decimal(totalArs || 0);
  const dCogs = new Decimal(cogsArs || 0);
  return dTotal.minus(dCogs).toNumber();
}

