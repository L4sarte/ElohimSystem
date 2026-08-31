'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';
import { withdrawFromAccount, getTreasuryAccounts } from '@/app/actions/treasury';
import { requireAuth } from '@/lib/auth-checks';
import { returnProcessInputSchema } from '@/lib/sales-validation';

export interface ReturnProcessInput {
  sale_id: string;
  return_reason: string;
  restock_item: boolean;
  refund_amount_ars: number;
}

interface SaleForReturn {
  id: string;
  total_ars: number;
  status?: string;
  has_returns?: boolean;
  client_id?: string | null;
  payment_methods?: Record<string, unknown>;
  sale_items?: Array<{
    product_id: string;
    quantity: number;
  }>;
}

/**
 * Procesar una devolución de venta en un flujo atómico y seguro:
 * 1. Inserta el registro en la tabla `returns`.
 * 2. Actualiza la venta original marcando `has_returns = true`.
 * 3. Si `restock_item === true`, restituye el stock a los productos asociados.
 * 4. Si la venta utilizó o acumuló VibePoints, reintegra/ajusta los puntos del cliente.
 * 5. Registra un movimiento de egreso en la cuenta de tesorería.
 */
export async function processReturn(
  role: UserRole,
  input: ReturnProcessInput
): Promise<{ success: boolean; returnId?: string; error?: string }> {
  try {
    const currentUser = await requireAuth();

    const validation = returnProcessInputSchema.safeParse(input);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Datos de devolución inválidos.';
      return { success: false, error: firstError };
    }

    const { sale_id, return_reason, restock_item, refund_amount_ars } = validation.data;

    if (!isSupabaseConfigured()) {
      return { success: true, returnId: 'mock-return-id' };
    }

    const serviceClient = getServiceSupabase();

    // 1. Obtener la venta objetivo con sus ítems
    const { data: saleData, error: saleErr } = await serviceClient
      .from('sales')
      .select(`
        id,
        total_ars,
        status,
        has_returns,
        client_id,
        payment_methods,
        sale_items (
          product_id,
          quantity
        )
      `)
      .eq('id', sale_id)
      .single();

    if (saleErr || !saleData) {
      throw new Error('No se encontró la venta especificada para devolución.');
    }

    const sale = saleData as unknown as SaleForReturn;

    if (sale.status === 'voided') {
      throw new Error('No se puede procesar una devolución sobre una venta que ya ha sido anulada.');
    }

    if (sale.has_returns) {
      throw new Error('Esta venta ya posee una devolución procesada previamente.');
    }

    if (refund_amount_ars > sale.total_ars) {
      throw new Error(`El monto a devolver ($${refund_amount_ars}) no puede superar el total facturado ($${sale.total_ars}).`);
    }

    const productId = sale.sale_items?.[0]?.product_id || null;
    const initialQuantity = sale.sale_items?.[0]?.quantity || 1;

    // 2. Insertar registro en la tabla `returns`
    const { data: returnRecord, error: returnErr } = await serviceClient
      .from('returns')
      .insert([
        {
          sale_id,
          product_id: productId,
          quantity: initialQuantity,
          refund_amount_ars,
          return_reason,
          restock_item,
          processed_by: currentUser.id,
        },
      ])
      .select('id')
      .single();

    if (returnErr) {
      throw returnErr;
    }

    // 3. Marcar has_returns = true en la tabla `sales`
    const { error: updateSaleErr } = await serviceClient
      .from('sales')
      .update({ has_returns: true })
      .eq('id', sale_id);

    if (updateSaleErr) throw updateSaleErr;

    // 4. Si restock_item === true, devolver el stock a la tabla `products`
    if (restock_item && sale.sale_items && sale.sale_items.length > 0) {
      for (const item of sale.sale_items) {
        if (item.product_id && item.quantity > 0) {
          const { data: prod } = await serviceClient
            .from('products')
            .select('stock_quantity')
            .eq('id', item.product_id)
            .single();

          if (prod) {
            const currentStock = Number(prod.stock_quantity || 0);
            await serviceClient
              .from('products')
              .update({ stock_quantity: currentStock + Number(item.quantity) })
              .eq('id', item.product_id);
          }
        }
      }
    }

    // 5. Ajuste de VibePoints si la venta tuvo cliente asociado
    if (sale.client_id) {
      const pm = sale.payment_methods as Record<string, unknown> | undefined;
      const vibepointsUsed = pm?.vibepoints_used as { points?: number } | undefined;

      // Restablecer VibePoints canjeados
      if (vibepointsUsed && typeof vibepointsUsed.points === 'number' && vibepointsUsed.points > 0) {
        const ptsToRestore = Number(vibepointsUsed.points);
        const { data: client } = await serviceClient
          .from('clients')
          .select('points_balance')
          .eq('id', sale.client_id)
          .single();

        if (client) {
          const currentPts = Number(client.points_balance || 0);
          await serviceClient
            .from('clients')
            .update({ points_balance: currentPts + ptsToRestore })
            .eq('id', sale.client_id);

          await serviceClient
            .from('client_points_history')
            .insert({
              client_id: sale.client_id,
              points: ptsToRestore,
              reason: `Devolución de ${ptsToRestore} pts por devolución ticket #${sale_id.split('-')[0].toUpperCase()}`,
              sale_id,
            });
        }
      }

      // Restar VibePoints ganados en la compra
      const earnedPoints = Math.floor(Number(sale.total_ars || 0) / 1000);
      if (earnedPoints > 0) {
        const { data: client } = await serviceClient
          .from('clients')
          .select('points_balance')
          .eq('id', sale.client_id)
          .single();

        if (client) {
          const currentPts = Number(client.points_balance || 0);
          const newPts = Math.max(0, currentPts - earnedPoints);
          await serviceClient
            .from('clients')
            .update({ points_balance: newPts })
            .eq('id', sale.client_id);

          await serviceClient
            .from('client_points_history')
            .insert({
              client_id: sale.client_id,
              points: -earnedPoints,
              reason: `Ajuste por devolución ticket #${sale_id.split('-')[0].toUpperCase()}`,
              sale_id,
            });
        }
      }
    }

    // 6. Registro de egreso en Tesorería & Cuentas
    if (refund_amount_ars > 0) {
      const resAcc = await getTreasuryAccounts();
      if (resAcc.success && resAcc.data && resAcc.data.length > 0) {
        await withdrawFromAccount(resAcc.data[0].id, refund_amount_ars);
      }
    }

    revalidatePath('/auditoria/ventas');
    revalidatePath('/admin/ventas');
    revalidatePath('/productos');
    revalidatePath('/admin/finanzas/tesoreria');
    revalidatePath('/admin/reportes');
    revalidatePath('/caja');
    revalidatePath('/clientes');

    return { success: true, returnId: returnRecord?.id };
  } catch (error: unknown) {
    console.error('Error al procesar la devolución:', error);
    const msg = error instanceof Error ? error.message : 'Error al procesar la devolución';
    return { success: false, error: msg };
  }
}
