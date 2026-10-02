'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth-checks';
import { receivablePaymentSchema } from '@/lib/client-validation';
import { getTreasuryAccounts } from '@/app/actions/treasury';
import { depositToAccount } from '@/lib/treasury-ops';

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
    phone?: string | null;
    email?: string | null;
  } | null;
  sales?: {
    created_at: string;
    total_ars: number;
  } | null;
}

interface DbReceivableRow {
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
    phone?: string | null;
    email?: string | null;
  } | null;
  sales?: {
    created_at: string;
    total_ars: number;
  } | null;
}

/**
 * Obtener el listado de Cuentas por Cobrar (Fiados / Señas) con clientes e historial.
 */
export async function getAccountsReceivable(role?: UserRole): Promise<{
  success: boolean;
  data?: AccountReceivable[];
  error?: string;
}> {
  try {
    await requireAuth();

    if (!isSupabaseConfigured()) {
      return { success: true, data: [] };
    }

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

    const rows = (data || []) as unknown as DbReceivableRow[];
    const list: AccountReceivable[] = rows.map((item) => ({
      ...item,
      total_amount_ars: Number(item.total_amount_ars || 0),
      paid_amount_ars: Number(item.paid_amount_ars || 0),
    }));

    return { success: true, data: list };
  } catch (error: unknown) {
    console.error('Error al obtener cuentas por cobrar:', error);
    const msg = error instanceof Error ? error.message : 'Error al obtener deudas';
    return { success: false, error: msg };
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
  notes?: string,
  treasuryAccountId?: string
): Promise<{ success: boolean; newPaid?: number; status?: string; warning?: string; error?: string }> {
  try {
    await requireAuth();

    const validation = receivablePaymentSchema.safeParse({
      receivable_id: receivableId,
      amount_paid: amountPaid,
      notes,
      treasury_account_id: treasuryAccountId || undefined,
    });

    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Datos de pago inválidos.';
      return { success: false, error: firstError };
    }

    const clean = validation.data;

    if (!isSupabaseConfigured()) {
      return { success: true, newPaid: clean.amount_paid, status: 'paid' };
    }

    const supabase = getServiceSupabase();

    // 1. Consultar la cuenta por cobrar objetivo
    const { data: receivable, error: recError } = await supabase
      .from('accounts_receivable')
      .select('*, clients(name)')
      .eq('id', clean.receivable_id)
      .single();

    if (recError || !receivable) {
      throw new Error('No se encontró la cuenta por cobrar seleccionada.');
    }

    const currentPaid = Number(receivable.paid_amount_ars || 0);
    const totalAmount = Number(receivable.total_amount_ars || 0);
    const newPaid = currentPaid + Number(clean.amount_paid);
    const newStatus = newPaid >= totalAmount ? 'paid' : 'pending';
    const clientName = receivable.clients?.name || 'Cliente';

    // 2. Actualizar la cuenta por cobrar
    const { error: updateError } = await supabase
      .from('accounts_receivable')
      .update({
        paid_amount_ars: newPaid,
        status: newStatus,
        notes: clean.notes ? `${receivable.notes || ''} | ${clean.notes}` : receivable.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', clean.receivable_id);

    if (updateError) throw updateError;

    // 2b. SINCRONIZACIÓN BIDIRECCIONAL CON TABLA SALES Y SALE_INSTALLMENTS
    if (receivable.sale_id) {
      const { data: saleRecord } = await supabase
        .from('sales')
        .select('amount_due_ars, client_id')
        .eq('id', receivable.sale_id)
        .single();

      if (saleRecord) {
        const currentDue = Number(saleRecord.amount_due_ars || 0);
        const newDue = Math.max(0, currentDue - Number(clean.amount_paid));
        const newPaymentStatus = newDue <= 0 ? 'paid' : 'partial';

        await supabase
          .from('sales')
          .update({
            amount_due_ars: newDue,
            payment_status: newPaymentStatus,
          })
          .eq('id', receivable.sale_id);

        // Registrar abono en sale_installments para consistencia de cuotas
        await supabase.from('sale_installments').insert([
          {
            sale_id: receivable.sale_id,
            client_id: saleRecord.client_id || receivable.client_id || null,
            amount_paid_ars: Number(clean.amount_paid),
            payment_method: 'Efectivo',
          },
        ]);
      }
    }

    // 2c. IMPACTAR INGRESO EN TESORERÍA (respetando cuenta seleccionada o fallback inteligente)
    let treasuryWarning: string | null = null;
    const resAcc = await getTreasuryAccounts();
    let targetAccId: string | null = clean.treasury_account_id || null;
    let isCashAccount = true;

    if (resAcc.success && resAcc.data && resAcc.data.length > 0) {
      const matchedAcc = targetAccId ? resAcc.data.find(a => a.id === targetAccId) : null;
      const targetAcc = matchedAcc || resAcc.data.find(a => a.account_type === 'cash' || a.account_name.toLowerCase().includes('efectivo')) || resAcc.data[0];
      targetAccId = targetAcc.id;
      isCashAccount = targetAcc.account_type === 'cash' || targetAcc.account_name.toLowerCase().includes('efectivo');

      const depositOk = await depositToAccount(
        targetAcc.id,
        Number(clean.amount_paid),
        `Cobro Cta Cte - Cliente: ${clientName} (Deuda #${clean.receivable_id.split('-')[0].toUpperCase()})`,
        receivable.sale_id || clean.receivable_id
      );
      if (!depositOk) {
        console.error('[RECEIVABLE_TREASURY_DEPOSIT_FAILED]: deuda', clean.receivable_id, '- monto', clean.amount_paid);
        treasuryWarning = 'El cobro fue registrado pero NO pudo acreditarse en la cuenta de tesorería. Verificá el saldo manualmente.';
      }
    }

    // 3. REGISTRO EN CAJA FÍSICA ACTIVA (cash_movements)
    // Solo registrar en caja de mostrador si la cuenta destino es de tipo efectivo
    if (isCashAccount) {
      const { data: openShift } = await supabase
        .from('cash_shifts')
        .select('id')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openShift) {
        const { error: moveError } = await supabase.from('cash_movements').insert({
          shift_id: openShift.id,
          type: 'in',
          amount_ars: Number(clean.amount_paid),
          amount_usd: 0,
          description: `Cobro Cta Cte - Cliente: ${clientName} (Deuda #${clean.receivable_id.split('-')[0].toUpperCase()})`,
        });

        if (moveError) {
          console.warn('Advertencia al registrar movimiento en cash_movements:', moveError.message);
        }
      }
    }

    revalidatePath('/cobranzas');
    revalidatePath('/admin/finanzas/cxcobrar');
    revalidatePath('/admin/finanzas/cuotas');
    revalidatePath('/admin/finanzas/tesoreria');
    revalidatePath('/caja');
    revalidatePath('/clientes');
    return { success: true, newPaid, status: newStatus, warning: treasuryWarning || undefined };
  } catch (error: unknown) {
    console.error('Error al registrar pago de deuda:', error);
    const msg = error instanceof Error ? error.message : 'Error al procesar el abono';
    return { success: false, error: msg };
  }
}

export interface DebtorReportItem {
  id: string;
  client_name: string;
  client_phone: string;
  status: string;
  due_date: string;
  total_amount_ars: number;
  paid_amount_ars: number;
  balance_ars: number;
  created_at: string;
}

interface DbDebtorReportRow {
  id: string;
  total_amount_ars: number;
  paid_amount_ars: number;
  due_date?: string | null;
  status: string;
  created_at: string;
  clients?: {
    name: string;
    phone?: string | null;
  } | null;
}

/**
 * Consulta de datos para la generación del PDF de Cuentas por Cobrar (Deudores).
 * Filtra los registros donde status sea 'pending' u 'overdue' con datos de clientes.
 */
export async function getDebtorsForReport(role?: UserRole): Promise<{
  success: boolean;
  data?: DebtorReportItem[];
  totalOutstandingArs?: number;
  error?: string;
}> {
  try {
    await requireAuth();

    if (!isSupabaseConfigured()) {
      return { success: true, data: [], totalOutstandingArs: 0 };
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('accounts_receivable')
      .select(`
        id,
        total_amount_ars,
        paid_amount_ars,
        due_date,
        status,
        created_at,
        clients (
          name,
          phone
        )
      `)
      .in('status', ['pending', 'overdue'])
      .order('due_date', { ascending: true });

    if (error) throw error;

    let totalOutstandingArs = 0;
    const rows = (data || []) as unknown as DbDebtorReportRow[];
    const list: DebtorReportItem[] = rows.map((item) => {
      const total = Number(item.total_amount_ars || 0);
      const paid = Number(item.paid_amount_ars || 0);
      const balance = Math.max(0, total - paid);
      totalOutstandingArs += balance;

      const isOverdue =
        item.status === 'overdue' || (item.due_date ? new Date(item.due_date) < new Date() : false);

      return {
        id: item.id,
        client_name: item.clients?.name || 'Consumidor Final',
        client_phone: item.clients?.phone || 'Sin contacto',
        status: isOverdue ? 'VENCIDO' : 'PENDIENTE',
        due_date: item.due_date ? new Date(item.due_date).toLocaleDateString('es-AR') : 'Sin fecha',
        total_amount_ars: total,
        paid_amount_ars: paid,
        balance_ars: balance,
        created_at: item.created_at,
      };
    });

    return {
      success: true,
      data: list,
      totalOutstandingArs: Math.round(totalOutstandingArs),
    };
  } catch (err: unknown) {
    console.error('Error al consultar deudores para reporte:', err);
    const msg = err instanceof Error ? err.message : 'Error al consultar datos de deudores';
    return {
      success: false,
      error: msg,
    };
  }
}
