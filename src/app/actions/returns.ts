'use server';

import { getServiceSupabase, supabase } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';
import { withdrawFromAccount, getTreasuryAccounts } from '@/app/actions/treasury';

export interface ReturnProcessInput {
  sale_id: string;
  return_reason: string;
  restock_item: boolean;
  refund_amount_ars: number;
}

/**
 * Procesar una devolución de venta en un flujo atómico:
 * 1. Inserta el registro en la tabla `returns`.
 * 2. Actualiza la venta original marcando `has_returns = true`.
 * 3. Si `restock_item === true`, restituye el stock a los productos asociados.
 * 4. Si la venta utilizó o acumuló VibePoints, reintegra/ajusta los puntos del cliente.
 * 5. Registra un movimiento de egreso (`type = 'out'`) en la caja chica activa.
 */
export async function processReturn(
  role: UserRole,
  input: ReturnProcessInput
): Promise<{ success: boolean; returnId?: string; error?: string }> {
  try {
    if (!input.sale_id) {
      throw new Error('El ID de la venta es obligatorio.');
    }

    if (!input.return_reason || !input.return_reason.trim()) {
      throw new Error('Debes indicar el motivo de la devolución.');
    }

    const refundAmount = Math.round(Number(input.refund_amount_ars || 0));
    if (refundAmount < 0) {
      throw new Error('El monto a reintegrar no puede ser negativo.');
    }

    const serviceClient = getServiceSupabase();

    // 1. Obtener la venta objetivo con sus ítems
    const { data: sale, error: saleErr } = await serviceClient
      .from('sales')
      .select(`
        *,
        sale_items (
          product_id,
          quantity
        )
      `)
      .eq('id', input.sale_id)
      .single();

    if (saleErr || !sale) {
      throw new Error('No se encontró la venta especificada.');
    }

    if (sale.status === 'voided') {
      throw new Error('No se puede procesar una devolución sobre una venta anulada.');
    }

    if (sale.has_returns) {
      throw new Error('Esta venta ya posee una devolución procesada previamente.');
    }

    // Identificar usuario actual que procesa
    let userId = null;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) userId = user.id;

    const productId = sale.sale_items?.[0]?.product_id || null;

    // 2. Insertar registro en la tabla `returns`
    const { data: returnRecord, error: returnErr } = await serviceClient
      .from('returns')
      .insert([
        {
          sale_id: input.sale_id,
          product_id: productId,
          quantity: sale.sale_items?.[0]?.quantity || 1,
          refund_amount_ars: refundAmount,
          return_reason: input.return_reason.trim(),
          restock_item: Boolean(input.restock_item),
          processed_by: userId
        }
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
      .eq('id', input.sale_id);

    if (updateSaleErr) throw updateSaleErr;

    // 4. Si restock_item === true, devolver el stock a la tabla `products`
    if (input.restock_item && sale.sale_items && sale.sale_items.length > 0) {
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
      const pm = sale.payment_methods as any;

      // Restablecer VibePoints canjeados
      if (pm?.vibepoints_used && typeof pm.vibepoints_used.points === 'number' && pm.vibepoints_used.points > 0) {
        const ptsToRestore = Number(pm.vibepoints_used.points);
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
              reason: `Devolución de ${ptsToRestore} pts por devolución ticket #${input.sale_id.split('-')[0].toUpperCase()}`,
              sale_id: input.sale_id
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
              reason: `Ajuste por devolución ticket #${input.sale_id.split('-')[0].toUpperCase()}`,
              sale_id: input.sale_id
            });
        }
      }
    }

    // 6. Registro de egreso en Tesorería & Cuentas
    if (refundAmount > 0) {
      const resAcc = await getTreasuryAccounts();
      if (resAcc.success && resAcc.data && resAcc.data.length > 0) {
        await withdrawFromAccount(resAcc.data[0].id, refundAmount);
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
  } catch (error: any) {
    console.error('Error al procesar la devolución:', error);
    return { success: false, error: error.message || 'Error al procesar la devolución' };
  }
}
