'use server';

import { getServiceSupabase } from '@/lib/supabase';
import { UserRole } from '@/types';
import { getCurrentRate } from '@/app/actions/rates';

export interface InventoryValuationData {
  capitalCostArs: number;
  capitalCostUsd: number;
  potentialRevenueArs: number;
  potentialRevenueUsd: number;
  potentialNetProfitArs: number;
  potentialNetProfitUsd: number;
  totalUnitsInStock: number;
  totalProductsCount: number;
  potentialProfitMarginPercent: number;
}

/**
 * Obtener la valoración financiera del inventario activo y la proyección de ganancia potencial.
 */
export async function getInventoryValuation(role: UserRole): Promise<{
  success: boolean;
  data?: InventoryValuationData;
  error?: string;
}> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Se requiere rol de Administrador.');
    }

    const supabase = getServiceSupabase();
    const rateRes = await getCurrentRate();
    const exchangeRate = rateRes.data?.value_ars || 1000;

    // Consultar productos comerciales activos con stock disponible
    const { data: products, error } = await supabase
      .from('products')
      .select('id, stock_quantity, base_cost_ars, base_price_ars, cost_usd, base_price_usd, type')
      .gt('stock_quantity', 0)
      .neq('type', 'supply'); // Excluir insumos de packaging para valorar perfumería comercial

    if (error) throw error;

    let capitalCostArs = 0;
    let capitalCostUsd = 0;
    let potentialRevenueArs = 0;
    let potentialRevenueUsd = 0;
    let totalUnitsInStock = 0;

    (products || []).forEach((p: any) => {
      const qty = Number(p.stock_quantity || 0);
      const costArs = Number(p.base_cost_ars || 0);
      const costUsd = p.cost_usd ? Number(p.cost_usd) : (exchangeRate > 0 ? costArs / exchangeRate : 0);

      const priceArs = Number(p.base_price_ars || 0);
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
        capitalCostArs: Math.round(capitalCostArs),
        capitalCostUsd: Math.round(capitalCostUsd),
        potentialRevenueArs: Math.round(potentialRevenueArs),
        potentialRevenueUsd: Math.round(potentialRevenueUsd),
        potentialNetProfitArs: Math.round(potentialNetProfitArs),
        potentialNetProfitUsd: Math.round(potentialNetProfitUsd),
        totalUnitsInStock,
        totalProductsCount: (products || []).length,
        potentialProfitMarginPercent
      }
    };
  } catch (err: any) {
    console.error('Error al calcular valoración de inventario:', err);
    return {
      success: false,
      error: err.message || 'Error al recuperar valoración de inventario'
    };
  }
}
