'use server';

import { getServiceSupabase } from '@/lib/supabase';
import { UserRole } from '@/types';
import { getCurrentRate } from '@/app/actions/rates';

export interface InventoryValuationMetrics {
  capitalInvertido: number;
  valorBrutoVenta: number;
  gananciaNetaPotencial: number;
  capitalInvertidoUsd: number;
  valorBrutoVentaUsd: number;
  gananciaNetaPotencialUsd: number;
  totalUnitsInStock: number;
  totalProductsCount: number;
  potentialProfitMarginPercent: number;
}

export interface InventoryValuationResponse {
  success: boolean;
  data: InventoryValuationMetrics;
  error?: string;
}

const DEFAULT_METRICS: InventoryValuationMetrics = {
  capitalInvertido: 0,
  valorBrutoVenta: 0,
  gananciaNetaPotencial: 0,
  capitalInvertidoUsd: 0,
  valorBrutoVentaUsd: 0,
  gananciaNetaPotencialUsd: 0,
  totalUnitsInStock: 0,
  totalProductsCount: 0,
  potentialProfitMarginPercent: 0
};

/**
 * Obtener la valoración financiera del inventario activo y la proyección de ganancia potencial.
 * Garantiza que NUNCA lance una excepción no capturada y devuelva siempre data estructurada con ceros como fallback.
 */
export async function getInventoryValuation(role: UserRole): Promise<InventoryValuationResponse> {
  try {
    const supabase = getServiceSupabase();
    let exchangeRate = 1000;
    
    try {
      const rateRes = await getCurrentRate();
      if (rateRes.data?.value_ars && rateRes.data.value_ars > 0) {
        exchangeRate = rateRes.data.value_ars;
      }
    } catch (rateErr) {
      console.warn('Advertencia al consultar tasa cambiaria en getInventoryValuation, usando fallback 1000:', rateErr);
    }

    // Consultar todos los productos inventariables con stock mayor a 0
    const { data: products, error } = await supabase
      .from('products')
      .select('id, stock_quantity, base_cost_ars, base_price_ars, cost_usd, base_price_usd, type')
      .gt('stock_quantity', 0);

    if (error) {
      console.error('Error al consultar productos de Supabase en getInventoryValuation:', error);
      return {
        success: false,
        data: DEFAULT_METRICS,
        error: error.message
      };
    }

    let capitalCostArs = 0;
    let capitalCostUsd = 0;
    let potentialRevenueArs = 0;
    let potentialRevenueUsd = 0;
    let totalUnitsInStock = 0;

    (products || []).forEach((p: any) => {
      const qty = Number(p.stock_quantity || 0);
      if (qty <= 0) return;

      const costArs = Number(p.base_cost_ars || 0);
      const priceArs = Number(p.base_price_ars || 0);

      const costUsd = p.cost_usd ? Number(p.cost_usd) : (exchangeRate > 0 ? costArs / exchangeRate : 0);
      const priceUsd = p.base_price_usd ? Number(p.base_price_usd) : (exchangeRate > 0 ? priceArs / exchangeRate : 0);

      capitalCostArs += qty * costArs;
      capitalCostUsd += qty * costUsd;
      potentialRevenueArs += qty * priceArs;
      potentialRevenueUsd += qty * priceUsd;
      totalUnitsInStock += qty;
    });

    const potentialNetProfitArs = Math.max(0, potentialRevenueArs - capitalCostArs);
    const potentialNetProfitUsd = Math.max(0, potentialRevenueUsd - capitalCostUsd);
    const potentialProfitMarginPercent = potentialRevenueArs > 0
      ? Number(((potentialNetProfitArs / potentialRevenueArs) * 100).toFixed(1))
      : 0;

    return {
      success: true,
      data: {
        capitalInvertido: Math.round(capitalCostArs),
        valorBrutoVenta: Math.round(potentialRevenueArs),
        gananciaNetaPotencial: Math.round(potentialNetProfitArs),
        capitalInvertidoUsd: Math.round(capitalCostUsd),
        valorBrutoVentaUsd: Math.round(potentialRevenueUsd),
        gananciaNetaPotencialUsd: Math.round(potentialNetProfitUsd),
        totalUnitsInStock,
        totalProductsCount: (products || []).length,
        potentialProfitMarginPercent
      }
    };
  } catch (err: any) {
    console.error('Excepción crítica capturada en getInventoryValuation:', err);
    return {
      success: false,
      data: DEFAULT_METRICS,
      error: err.message || 'Error inesperado al calcular la valoración del inventario'
    };
  }
}
