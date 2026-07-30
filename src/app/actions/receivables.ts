'use server';

import { getServiceSupabase } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';

export interface AccountReceivable {
  id: string;
  client_id: string;
  sale_id?: string;
  total_amount_ars: number;
  paid_amount_ars: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue';
  notes?: string;
  created_at: string;
  updated_at?: string;
  clients?: {
    name: string;
    phone?: string;
    email?: string;
  };
  sales?: {
    created_at: string;
    total_ars: number;
  };
}

/**
 * Obtener el listado de Cuentas por Cobrar (Fiados / Señas) con clientes e historial.
 */
export async function getAccountsReceivable(role: UserRole): Promise<{
  success: boolean;
  data?: AccountReceivable[];
  error?: string;
}> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('accounts_receivable')
      .select(`
        *,
        clients (
          name,
          phone,
          email
        ),
        sales (
          created_at,
          total_ars
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const list: AccountReceivable[] = (data || []).map((item: any) => ({
      ...item,
      total_amount_ars: Number(item.total_amount_ars),
      paid_amount_ars: Number(item.paid_amount_ars),
    }));

    return { success: true, data: list };
  } catch (error: any) {
    console.error('Error al obtener cuentas por cobrar:', error);
    return { success: false, error: error.message || 'Error al obtener deudas' };
  }
}

/**
 * Registrar un abono o cobro parcial/total a una Cuenta Corriente (Fiado).
 * IMPORTANTE: Registra automáticamente un ingreso ('in') en la caja activa (cash_movements)
 * para que el arqueo de caja físico al final del día cuadre al 100%.
 */
export async function registerDebtPayment(
  role: UserRole,
  receivableId: string,
  amountPaid: number,
  notes?: string
): Promise<{ success: boolean; newPaid?: number; status?: string; error?: string }> {
  try {
    if (!receivableId || amountPaid <= 0) {
      throw new Error('El monto ingresado debe ser mayor a $0.');
    }

    const supabase = getServiceSupabase();

    // 1. Consultar la cuenta por cobrar objetivo
    const { data: receivable, error: recError } = await supabase
      .from('accounts_receivable')
      .select('*, clients(name)')
      .eq('id', receivableId)
      .single();

    if (recError || !receivable) {
      throw new Error('No se encontró la cuenta por cobrar seleccionada.');
    }

    const currentPaid = Number(receivable.paid_amount_ars || 0);
    const totalAmount = Number(receivable.total_amount_ars || 0);
    const newPaid = currentPaid + Number(amountPaid);
    const newStatus = newPaid >= totalAmount ? 'paid' : 'pending';
    const clientName = receivable.clients?.name || 'Cliente';

    // 2. Actualizar la cuenta por cobrar
    const { error: updateError } = await supabase
      .from('accounts_receivable')
      .update({
        paid_amount_ars: newPaid,
        status: newStatus,
        notes: notes ? `${receivable.notes || ''} | ${notes}` : receivable.notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', receivableId);

    if (updateError) throw updateError;

    // 3. REGISTRO EN CAJA FÍSICA ACTIVA (cash_movements)
    // Verificar si el vendedor tiene un turno de caja abierto en cash_shifts
    const { data: openShift } = await supabase
      .from('cash_shifts')
      .select('id')
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openShift) {
      const { error: moveError } = await supabase
        .from('cash_movements')
        .insert({
          shift_id: openShift.id,
          type: 'in',
          amount_ars: Number(amountPaid),
          amount_usd: 0,
          description: `Cobro Cta Cte - Cliente: ${clientName} (Deuda #${receivableId.split('-')[0].toUpperCase()})`
        });

      if (moveError) {
        console.warn('No se pudo insertar el movimiento de caja automático:', moveError);
      }
    }

    revalidatePath('/cobranzas');
    revalidatePath('/caja');
    revalidatePath('/clientes');
    return { success: true, newPaid, status: newStatus };
  } catch (error: any) {
    console.error('Error al registrar pago de deuda:', error);
    return { success: false, error: error.message || 'Error al procesar el abono' };
  }
}
