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
      console.warn('[INVENTORY_VALUATION_WARN] Error al consultar tasa cambiaria, usando fallback 1000:', rateErr);
    }

    // Consultar productos inventariables con stock mayor a 0, excluyendo packaging (type = 'supply')
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .gt('stock_quantity', 0)
      .neq('type', 'supply');

    if (error) {
      console.error('[INVENTORY_VALUATION_ERROR]', error);
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
    let totalUnidades = 0;
    const totalSKUs = (products || []).length;

    (products || []).forEach((item: any) => {
      // Safe Math Parsing con conversión forzada a número y fallback a 0
      const stock = Number(item.stock_quantity) || 0;
      if (stock <= 0) return;

      const priceArs = Number(item.base_price_ars ?? item.price_ars) || 0;
      const costArs = Number(item.base_cost_ars ?? item.cost_ars) || 0;
      const costUsd = Number(item.cost_usd) || (exchangeRate > 0 && costArs > 0 ? costArs / exchangeRate : 0);
      const priceUsd = Number(item.base_price_usd ?? item.price_usd) || (exchangeRate > 0 && priceArs > 0 ? priceArs / exchangeRate : 0);

      capitalCostArs += stock * costArs;
      capitalCostUsd += stock * costUsd;
      potentialRevenueArs += stock * priceArs;
      potentialRevenueUsd += stock * priceUsd;
      totalUnidades += stock;
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
        totalUnitsInStock: totalUnidades,
        totalProductsCount: totalSKUs,
        potentialProfitMarginPercent
      }
    };
  } catch (err: any) {
    console.error('[INVENTORY_VALUATION_ERROR]', err);
    return {
      success: false,
      data: DEFAULT_METRICS,
      error: err.message || 'Error inesperado al calcular la valoración del inventario'
    };
  }
}

