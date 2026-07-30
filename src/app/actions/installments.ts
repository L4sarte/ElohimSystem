'use server';

import { getServiceSupabase } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';
import { depositToAccount, getTreasuryAccounts } from '@/app/actions/treasury';

export interface PendingSale {
  id: string;
  total_ars: number;
  amount_due_ars: number;
  payment_status: 'paid' | 'partial' | 'pending';
  created_at: string;
  clients?: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
  };
  sale_installments?: Array<{
    id: string;
    amount_paid_ars: number;
    payment_method: string;
    created_at: string;
  }>;
}

/**
 * Obtener únicamente las ventas con saldo pendiente de cobro (payment_status != 'paid').
 */
export async function getPendingSales(role: UserRole): Promise<{
  success: boolean;
  data?: PendingSale[];
  error?: string;
}> {
  try {
    const supabase = getServiceSupabase();
    
    // Consultar ventas activas con saldo pendiente o estado != 'paid'
    const { data, error } = await supabase
      .from('sales')
      .select(`
        id,
        total_ars,
        amount_due_ars,
        payment_status,
        created_at,
        clients (
          id,
          name,
          phone,
          email
        ),
        sale_installments (
          id,
          amount_paid_ars,
          payment_method,
          created_at
        )
      `)
      .neq('status', 'voided')
      .neq('payment_status', 'paid')
      .gt('amount_due_ars', 0)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const list: PendingSale[] = (data || []).map((item: any) => ({
      ...item,
      total_ars: Number(item.total_ars || 0),
      amount_due_ars: Number(item.amount_due_ars || 0),
      sale_installments: (item.sale_installments || []).map((inst: any) => ({
        ...inst,
        amount_paid_ars: Number(inst.amount_paid_ars || 0)
      }))
    }));

    return { success: true, data: list };
  } catch (error: any) {
    console.error('Error al obtener ventas pendientes de cobro:', error);
    return { success: false, error: error.message || 'Error al obtener deudas' };
  }
}

/**
 * Registrar un abono parcial o total a una venta con saldo pendiente.
 * Resta el monto del amount_due_ars de la venta original, inserta un registro en sale_installments,
 * actualiza payment_status a 'paid' si el saldo llega a 0, y registra el movimiento de caja física.
 */
export async function registerInstallment(
  role: UserRole,
  saleId: string,
  amountPaidArs: number,
  paymentMethod: string = 'Efectivo',
  notes?: string
): Promise<{ success: boolean; newAmountDue?: number; paymentStatus?: string; error?: string }> {
  try {
    if (!saleId) {
      throw new Error('El ID de la venta es obligatorio.');
    }

    const valAmount = Math.round(Number(amountPaidArs || 0));
    if (valAmount <= 0) {
      throw new Error('El monto abonado debe ser mayor a $0.');
    }

    const supabase = getServiceSupabase();

    // 1. Obtener la venta objetivo
    const { data: sale, error: saleErr } = await supabase
      .from('sales')
      .select('id, client_id, total_ars, amount_due_ars, payment_status, clients(name)')
      .eq('id', saleId)
      .single();

    if (saleErr || !sale) {
      throw new Error('No se encontró la venta seleccionada.');
    }

    const currentDue = Number(sale.amount_due_ars || 0);
    const newAmountDue = Math.max(0, currentDue - valAmount);
    const newPaymentStatus = newAmountDue <= 0 ? 'paid' : 'partial';
    const clientName = (sale.clients as any)?.name || 'Cliente';

    // 2. Insertar registro en la tabla sale_installments
    const { error: instErr } = await supabase
      .from('sale_installments')
      .insert([
        {
          sale_id: saleId,
          client_id: sale.client_id || null,
          amount_paid_ars: valAmount,
          payment_method: paymentMethod || 'Efectivo'
        }
      ]);

    if (instErr) {
      console.warn('Advertencia al guardar en sale_installments:', instErr);
    }

    // 3. Actualizar la venta en la tabla sales
    const { error: updateSaleErr } = await supabase
      .from('sales')
      .update({
        amount_due_ars: newAmountDue,
        payment_status: newPaymentStatus
      })
      .eq('id', saleId);

    if (updateSaleErr) throw updateSaleErr;

    // 4. Sincronizar accounts_receivable si existe para dicha venta
    if (sale.client_id) {
      const { data: rec } = await supabase
        .from('accounts_receivable')
        .select('id, paid_amount_ars')
        .eq('sale_id', saleId)
        .maybeSingle();

      if (rec) {
        const currentPaidAcc = Number(rec.paid_amount_ars || 0);
        const newPaidAcc = currentPaidAcc + valAmount;
        await supabase
          .from('accounts_receivable')
          .update({
            paid_amount_ars: newPaidAcc,
            status: newAmountDue <= 0 ? 'paid' : 'pending',
            updated_at: new Date().toISOString()
          })
          .eq('id', rec.id);
      }
    }

    // 5. Impactar ingreso en Tesorería & Cuentas
    const resAcc = await getTreasuryAccounts();
    if (resAcc.success && resAcc.data && resAcc.data.length > 0) {
      await depositToAccount(resAcc.data[0].id, valAmount);
    }

    revalidatePath('/admin/finanzas/cxcobrar');
    revalidatePath('/cobranzas');
    revalidatePath('/admin/finanzas/tesoreria');
    revalidatePath('/admin/reportes');
    revalidatePath('/auditoria/ventas');
    revalidatePath('/caja');

    return { success: true, newAmountDue, paymentStatus: newPaymentStatus };
  } catch (error: any) {
    console.error('Error al registrar abono a venta:', error);
    return { success: false, error: error.message || 'Error al procesar el abono' };
  }
}
