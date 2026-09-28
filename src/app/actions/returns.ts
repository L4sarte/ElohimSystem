'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';
import { getTreasuryAccounts } from '@/app/actions/treasury';
import { withdrawFromAccount } from '@/lib/treasury-ops';
import { requireAuth } from '@/lib/auth-checks';
import { returnProcessInputSchema } from '@/lib/sales-validation';

export interface ReturnProcessInput {
  sale_id: string;
  return_reason: string;
  restock_item: boolean;
  refund_amount_ars: number;
  items_to_restock?: Array<{ product_id: string; quantity: number }>;
  treasury_account_id?: string;
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
): Promise<{ success: boolean; returnId?: string; warning?: string; error?: string }> {
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

    // 4. Si restock_item === true, devolver el stock a la tabla `products` de forma selectiva
    if (restock_item) {
      const itemsToRestore = input.items_to_restock && input.items_to_restock.length > 0
        ? input.items_to_restock
        : (refund_amount_ars >= Number(sale.total_ars || 0) ? (sale.sale_items || []) : []);

      for (const item of itemsToRestore) {
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

    // 5. Ajuste de VibePoints y total gastado si la venta tuvo cliente asociado
    if (sale.client_id) {
      const pm = sale.payment_methods as Record<string, unknown> | undefined;
      const vibepointsUsed = pm?.vibepoints_used as { points?: number } | undefined;
      const ptsToRestore = Number(vibepointsUsed?.points || 0);
      const earnedPoints = Math.floor(Number(sale.total_ars || 0) / 1000);

      const { data: client } = await serviceClient
        .from('clients')
        .select('points_balance, total_spent_ars')
        .eq('id', sale.client_id)
        .single();

      if (client) {
        let currentPts = Number(client.points_balance || 0);
        if (ptsToRestore > 0) {
          currentPts += ptsToRestore;
          await serviceClient.from('client_points_history').insert({
            client_id: sale.client_id,
            points: ptsToRestore,
            reason: `Devolución de ${ptsToRestore} pts por devolución ticket #${sale_id.split('-')[0].toUpperCase()}`,
            sale_id,
          });
        }

        if (earnedPoints > 0) {
          currentPts = Math.max(0, currentPts - earnedPoints);
          await serviceClient.from('client_points_history').insert({
            client_id: sale.client_id,
            points: -earnedPoints,
            reason: `Ajuste por devolución ticket #${sale_id.split('-')[0].toUpperCase()}`,
            sale_id,
          });
        }

        const currentSpent = Number(client.total_spent_ars || 0);
        const newSpent = Math.max(0, currentSpent - refund_amount_ars);

        await serviceClient
          .from('clients')
          .update({ points_balance: currentPts, total_spent_ars: newSpent })
          .eq('id', sale.client_id);
      }
    }

    // 6. Registro de egreso en Tesorería & Cuentas con descripción y referencia
    let treasuryWarning: string | null = null;
    if (refund_amount_ars > 0) {
      let targetAccId = input.treasury_account_id;
      if (!targetAccId) {
        const resAcc = await getTreasuryAccounts();
        if (resAcc.success && resAcc.data && resAcc.data.length > 0) {
          const cashAcc = resAcc.data.find(a => a.account_type === 'cash' || a.account_name.toLowerCase().includes('efectivo'));
          targetAccId = cashAcc ? cashAcc.id : resAcc.data[0].id;
        }
      }

      if (targetAccId) {
        const withdrawOk = await withdrawFromAccount(
          targetAccId,
          refund_amount_ars,
          `Reintegro por devolución ticket #${sale_id.slice(0, 8).toUpperCase()}`,
          sale_id
        );
        if (!withdrawOk) {
          console.error('[RETURN_TREASURY_WITHDRAW_FAILED]: venta', sale_id, '- reintegro', refund_amount_ars);
          treasuryWarning = 'La devolución fue registrada pero el reintegro NO pudo debitarse de la cuenta de tesorería. Verificá el saldo manualmente.';
        }
      }
    }

    revalidatePath('/auditoria/ventas');
    revalidatePath('/admin/ventas');
    revalidatePath('/productos');
    revalidatePath('/admin/finanzas/tesoreria');
    revalidatePath('/admin/reportes');
    revalidatePath('/caja');
    revalidatePath('/clientes');
    revalidatePath('/admin/inventario/kardex');

    return { success: true, returnId: returnRecord?.id, warning: treasuryWarning || undefined };
  } catch (error: unknown) {
    console.error('Error al procesar la devolución:', error);
    const msg = error instanceof Error ? error.message : 'Error al procesar la devolución';
    return { success: false, error: msg };
  }
}
