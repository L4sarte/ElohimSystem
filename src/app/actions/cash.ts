'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';
import { requireAuth, requireAdmin } from '@/lib/auth-checks';
import {
  openCashShiftSchema,
  closeCashShiftSchema,
  cashMovementSchema,
} from '@/lib/cash-validation';

export interface CashShift {
  id: string;
  seller_id: string;
  opened_at: string;
  closed_at?: string | null;
  initial_ars: number;
  initial_usd: number;
  declared_ars?: number | null;
  declared_usd?: number | null;
  system_calculated_ars?: number | null;
  system_calculated_usd?: number | null;
  difference_ars?: number | null;
  difference_usd?: number | null;
  status: 'open' | 'closed';
  notes?: string | null;
  profiles?: {
    email: string;
  } | null;
}

export interface CashMovement {
  id: string;
  shift_id: string;
  type: 'in' | 'out';
  amount_ars: number;
  amount_usd: number;
  description: string;
  created_at: string;
}

interface SalePaymentMethods {
  cash_ars?: number;
  cash_usd?: number;
  breakdown?: Array<{
    method_name?: string;
    amount_base?: number;
    amount_usd?: number;
  }>;
}

/**
 * Extraer únicamente las cantidades en efectivo físico (ARS y USD) descartando cobros digitales o transferencias.
 */
function extractCashFromSale(sale: { payment_methods?: unknown }): { cashArs: number; cashUsd: number } {
  let cashArs = 0;
  let cashUsd = 0;

  if (sale && sale.payment_methods && typeof sale.payment_methods === 'object') {
    const pm = sale.payment_methods as SalePaymentMethods;
    if (typeof pm.cash_ars === 'number') {
      cashArs += pm.cash_ars;
    }
    if (typeof pm.cash_usd === 'number') {
      cashUsd += pm.cash_usd;
    }

    if (!pm.cash_ars && !pm.cash_usd && Array.isArray(pm.breakdown)) {
      pm.breakdown.forEach((item) => {
        if (item.method_name && item.method_name.includes('Efectivo ARS')) {
          cashArs += Number(item.amount_base || 0);
        }
        if (item.method_name && item.method_name.includes('Dólares')) {
          cashUsd += Number(item.amount_usd || 0);
        }
      });
    }
  }

  return { cashArs, cashUsd };
}

/**
 * Verificar de forma ligera si existe un turno de caja abierto (para la insignia del Header).
 */
export async function checkActiveShiftStatus(): Promise<{ isOpen: boolean; shiftId?: string }> {
  try {
    if (!isSupabaseConfigured()) {
      return { isOpen: true, shiftId: 'mock-shift-id' };
    }

    const currentUser = await requireAuth();
    const serviceClient = getServiceSupabase();

    const { data: shift } = await serviceClient
      .from('cash_shifts')
      .select('id')
      .eq('seller_id', currentUser.id)
      .eq('status', 'open')
      .maybeSingle();

    if (shift) {
      return { isOpen: true, shiftId: shift.id };
    }

    // Verificar si hay alguna caja abierta en el sistema
    const { data: anyShift } = await serviceClient
      .from('cash_shifts')
      .select('id')
      .eq('status', 'open')
      .limit(1)
      .maybeSingle();

    return { isOpen: Boolean(anyShift), shiftId: anyShift?.id };
  } catch {
    return { isOpen: false };
  }
}

/**
 * Obtener la caja activa del vendedor con el cálculo en tiempo real de ventas en efectivo y movimientos manuales.
 */
export async function getActiveCashShift(role?: UserRole): Promise<{
  success: boolean;
  shift?: CashShift;
  movements?: CashMovement[];
  cashSalesArs?: number;
  cashSalesUsd?: number;
  expectedArs?: number;
  expectedUsd?: number;
  error?: string;
}> {
  try {
    const currentUser = await requireAuth();

    if (!isSupabaseConfigured()) {
      return {
        success: true,
        shift: {
          id: 'mock-shift-1',
          seller_id: currentUser.id,
          opened_at: new Date().toISOString(),
          initial_ars: 50000,
          initial_usd: 100,
          status: 'open',
          notes: 'Turno de prueba local',
        },
        movements: [],
        cashSalesArs: 0,
        cashSalesUsd: 0,
        expectedArs: 50000,
        expectedUsd: 100,
      };
    }

    const serviceClient = getServiceSupabase();

    // 1. Obtener turno con estado 'open' para el usuario actual (o general si es admin)
    const { data: shift, error: shiftError } = await serviceClient
      .from('cash_shifts')
      .select('*')
      .eq('seller_id', currentUser.id)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .maybeSingle();

    if (shiftError) throw shiftError;

    if (!shift) {
      return { success: true, shift: undefined };
    }

    // 2. Obtener los movimientos manuales del turno (ingresos / retiros)
    const { data: movements, error: movError } = await serviceClient
      .from('cash_movements')
      .select('*')
      .eq('shift_id', shift.id)
      .order('created_at', { ascending: false });

    if (movError) throw movError;

    // 3. Obtener ventas realizadas desde la apertura del turno
    const { data: sales, error: salesError } = await serviceClient
      .from('sales')
      .select('id, payment_methods, created_at')
      .gte('created_at', shift.opened_at);

    if (salesError) throw salesError;

    // 4. Calcular ventas en efectivo físico
    let cashSalesArs = 0;
    let cashSalesUsd = 0;

    (sales || []).forEach((sale) => {
      const { cashArs, cashUsd } = extractCashFromSale(sale);
      cashSalesArs += cashArs;
      cashSalesUsd += cashUsd;
    });

    // 5. Calcular totales de movimientos manuales
    let manualArsIn = 0;
    let manualArsOut = 0;
    let manualUsdIn = 0;
    let manualUsdOut = 0;

    (movements || []).forEach((m) => {
      const ars = Number(m.amount_ars || 0);
      const usd = Number(m.amount_usd || 0);
      if (m.type === 'in') {
        manualArsIn += ars;
        manualUsdIn += usd;
      } else {
        manualArsOut += ars;
        manualUsdOut += usd;
      }
    });

    const manualNetArs = manualArsIn - manualArsOut;
    const manualNetUsd = manualUsdIn - manualUsdOut;

    // Saldo esperado acumulado
    const expectedArs = Number(shift.initial_ars || 0) + cashSalesArs + manualNetArs;
    const expectedUsd = Number(shift.initial_usd || 0) + cashSalesUsd + manualNetUsd;

    return {
      success: true,
      shift: shift as CashShift,
      movements: (movements || []) as CashMovement[],
      cashSalesArs,
      cashSalesUsd,
      expectedArs,
      expectedUsd,
    };
  } catch (error: unknown) {
    console.error('Error al obtener caja activa:', error);
    const msg = error instanceof Error ? error.message : 'Error al obtener turno de caja';
    return { success: false, error: msg };
  }
}

/**
 * Abrir un nuevo turno de caja guardando los saldos iniciales en ARS y USD billete.
 */
export async function openCashShift(
  role: UserRole,
  initialArs: number,
  initialUsd: number,
  notes?: string
): Promise<{ success: boolean; shiftId?: string; error?: string }> {
  try {
    const currentUser = await requireAuth();

    const validation = openCashShiftSchema.safeParse({
      initial_ars: Number(initialArs || 0),
      initial_usd: Number(initialUsd || 0),
      notes,
    });

    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Datos de apertura inválidos.';
      return { success: false, error: firstError };
    }

    const { initial_ars, initial_usd, notes: cleanNotes } = validation.data;

    if (!isSupabaseConfigured()) {
      return { success: true, shiftId: 'mock-shift-id' };
    }

    const serviceClient = getServiceSupabase();

    // Validar que el usuario no tenga ya un turno abierto
    const { data: existing } = await serviceClient
      .from('cash_shifts')
      .select('id')
      .eq('seller_id', currentUser.id)
      .eq('status', 'open')
      .maybeSingle();

    if (existing) {
      throw new Error('Ya tienes un turno de caja abierto en el sistema.');
    }

    const { data, error } = await serviceClient
      .from('cash_shifts')
      .insert([
        {
          seller_id: currentUser.id,
          opened_at: new Date().toISOString(),
          initial_ars: initial_ars,
          initial_usd: initial_usd,
          status: 'open',
          notes: cleanNotes || null,
        },
      ])
      .select('id')
      .single();

    if (error) throw error;

    revalidatePath('/caja');
    revalidatePath('/');
    return { success: true, shiftId: data.id };
  } catch (error: unknown) {
    console.error('Error al abrir turno de caja:', error);
    const msg = error instanceof Error ? error.message : 'Error al abrir la caja';
    return { success: false, error: msg };
  }
}

/**
 * Registrar un movimiento manual de dinero (ingreso o retiro de gastos/cambio) en la caja activa.
 */
export async function addCashMovement(
  role: UserRole,
  shiftId: string,
  type: 'in' | 'out',
  amountArs: number,
  amountUsd: number,
  description: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth();

    const validation = cashMovementSchema.safeParse({
      shiftId,
      type,
      amount_ars: Number(amountArs || 0),
      amount_usd: Number(amountUsd || 0),
      description,
    });

    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Datos del movimiento inválidos.';
      return { success: false, error: firstError };
    }

    const clean = validation.data;

    if (clean.amount_ars <= 0 && clean.amount_usd <= 0) {
      return { success: false, error: 'Debes ingresar un monto mayor a cero en Pesos o Dólares.' };
    }

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const serviceClient = getServiceSupabase();
    const { error } = await serviceClient
      .from('cash_movements')
      .insert([
        {
          shift_id: clean.shiftId,
          type: clean.type,
          amount_ars: clean.amount_ars,
          amount_usd: clean.amount_usd,
          description: clean.description,
          created_at: new Date().toISOString(),
        },
      ]);

    if (error) throw error;

    revalidatePath('/caja');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error al agregar movimiento de caja:', error);
    const msg = error instanceof Error ? error.message : 'Error al guardar movimiento';
    return { success: false, error: msg };
  }
}

/**
 * Procesar el Arqueo Ciego y cierre de turno de caja.
 * Compara lo declarado por el vendedor contra el total del sistema y calcula las diferencias.
 */
export async function closeCashShift(
  role: UserRole,
  shiftId: string,
  declaredArs: number,
  declaredUsd: number,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth();

    const validation = closeCashShiftSchema.safeParse({
      shiftId,
      declared_ars: Number(declaredArs || 0),
      declared_usd: Number(declaredUsd || 0),
      notes,
    });

    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Datos de cierre de caja inválidos.';
      return { success: false, error: firstError };
    }

    const clean = validation.data;

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const serviceClient = getServiceSupabase();

    // 1. Obtener la caja activa
    const { data: shift, error: shiftError } = await serviceClient
      .from('cash_shifts')
      .select('*')
      .eq('id', clean.shiftId)
      .single();

    if (shiftError || !shift) {
      throw new Error('No se encontró el turno de caja a cerrar.');
    }

    if (shift.status === 'closed') {
      throw new Error('Este turno de caja ya ha sido cerrado anteriormente.');
    }

    // 2. Consultar ventas en efectivo desde la fecha de apertura
    const { data: sales, error: salesError } = await serviceClient
      .from('sales')
      .select('id, payment_methods, created_at')
      .gte('created_at', shift.opened_at);

    if (salesError) throw salesError;

    let cashSalesArs = 0;
    let cashSalesUsd = 0;

    (sales || []).forEach((sale) => {
      const { cashArs, cashUsd } = extractCashFromSale(sale);
      cashSalesArs += cashArs;
      cashSalesUsd += cashUsd;
    });

    // 3. Consultar movimientos manuales del turno
    const { data: movements, error: movError } = await serviceClient
      .from('cash_movements')
      .select('*')
      .eq('shift_id', clean.shiftId);

    if (movError) throw movError;

    let manualArsIn = 0;
    let manualArsOut = 0;
    let manualUsdIn = 0;
    let manualUsdOut = 0;

    (movements || []).forEach((m) => {
      const ars = Number(m.amount_ars || 0);
      const usd = Number(m.amount_usd || 0);
      if (m.type === 'in') {
        manualArsIn += ars;
        manualUsdIn += usd;
      } else {
        manualArsOut += ars;
        manualUsdOut += usd;
      }
    });

    const manualNetArs = manualArsIn - manualArsOut;
    const manualNetUsd = manualUsdIn - manualUsdOut;

    // 4. Calcular saldo esperado del sistema (system_calculated)
    const systemCalculatedArs = Number(shift.initial_ars || 0) + cashSalesArs + manualNetArs;
    const systemCalculatedUsd = Number(shift.initial_usd || 0) + cashSalesUsd + manualNetUsd;

    // 5. Calcular la diferencia (declared - systemCalculated)
    const differenceArs = clean.declared_ars - systemCalculatedArs;
    const differenceUsd = clean.declared_usd - systemCalculatedUsd;

    // 6. Actualizar el turno a 'closed'
    const finalNotes = clean.notes
      ? `${shift.notes ? shift.notes + ' | ' : ''}${clean.notes}`
      : shift.notes;

    const { error: updateError } = await serviceClient
      .from('cash_shifts')
      .update({
        closed_at: new Date().toISOString(),
        declared_ars: clean.declared_ars,
        declared_usd: clean.declared_usd,
        system_calculated_ars: systemCalculatedArs,
        system_calculated_usd: systemCalculatedUsd,
        difference_ars: differenceArs,
        difference_usd: differenceUsd,
        status: 'closed',
        notes: finalNotes,
      })
      .eq('id', clean.shiftId);

    if (updateError) throw updateError;

    revalidatePath('/caja');
    revalidatePath('/auditoria/caja');
    revalidatePath('/');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error al cerrar turno de caja:', error);
    const msg = error instanceof Error ? error.message : 'Error al cerrar el turno';
    return { success: false, error: msg };
  }
}

/**
 * Obtener el historial completo de turnos cerrados para auditoría (Exclusivo Admin).
 */
export async function getClosedShifts(role?: UserRole): Promise<{
  success: boolean;
  data?: CashShift[];
  error?: string;
}> {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured()) {
      return { success: true, data: [] };
    }

    const serviceClient = getServiceSupabase();
    const { data, error } = await serviceClient
      .from('cash_shifts')
      .select(`
        *,
        profiles (
          email
        )
      `)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false });

    if (error) throw error;

    return { success: true, data: (data || []) as unknown as CashShift[] };
  } catch (error: unknown) {
    console.error('Error al obtener historial de auditoría de cajas:', error);
    const msg = error instanceof Error ? error.message : 'Error al consultar historial de cajas';
    return { success: false, error: msg };
  }
}
