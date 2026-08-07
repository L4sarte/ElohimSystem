'use server';

import { getServiceSupabase, supabase } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';

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
  };
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

/**
 * Resolver el ID del vendedor para desarrollo local o sesiones auth reales.
 */
async function resolveSellerId(requestedSellerId?: string): Promise<string> {
  const serviceClient = getServiceSupabase();
  let sellerId = requestedSellerId;

  if (!sellerId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      sellerId = user.id;
    }
  }

  if (!sellerId) {
    const { data: profiles } = await serviceClient.from('profiles').select('id').limit(1);
    if (profiles && profiles.length > 0) {
      sellerId = profiles[0].id;
    } else {
      try {
        const email = 'dummy.seller@elohimimport.com';
        const { data: userData, error: userError } = await serviceClient.auth.admin.createUser({
          email,
          password: 'dummyPassword123!',
          email_confirm: true
        });

        if (!userError && userData.user) {
          const dummyUserId = userData.user.id;
          await serviceClient.from('profiles').insert({
            id: dummyUserId,
            email,
            role: 'admin'
          });
          sellerId = dummyUserId;
        }
      } catch (dummyErr) {
        console.error('Error al generar usuario dummy de desarrollo:', dummyErr);
      }
    }
  }

  if (!sellerId) {
    throw new Error('No se pudo determinar el vendedor para la sesión de caja.');
  }

  return sellerId;
}

/**
 * Extraer únicamente las cantidades en efectivo físico (ARS y USD) descartando cobros digitales o transferencias.
 */
function extractCashFromSale(sale: any): { cashArs: number; cashUsd: number } {
  let cashArs = 0;
  let cashUsd = 0;

  if (sale && sale.payment_methods) {
    const pm = sale.payment_methods;
    if (typeof pm.cash_ars === 'number') {
      cashArs += pm.cash_ars;
    }
    if (typeof pm.cash_usd === 'number') {
      cashUsd += pm.cash_usd;
    }

    if (!pm.cash_ars && !pm.cash_usd && Array.isArray(pm.breakdown)) {
      pm.breakdown.forEach((item: any) => {
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
    const serviceClient = getServiceSupabase();
    const sellerId = await resolveSellerId();

    const { data: shift } = await serviceClient
      .from('cash_shifts')
      .select('id')
      .eq('seller_id', sellerId)
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

    return { isOpen: !!anyShift, shiftId: anyShift?.id };
  } catch (error) {
    return { isOpen: false };
  }
}

/**
 * Obtener la caja activa del vendedor con el cálculo en tiempo real de ventas en efectivo y movimientos manuales.
 */
export async function getActiveCashShift(role: UserRole): Promise<{
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
    const serviceClient = getServiceSupabase();
    const sellerId = await resolveSellerId();

    // 1. Obtener turno con estado 'open'
    const { data: shift, error: shiftError } = await serviceClient
      .from('cash_shifts')
      .select('*')
      .eq('seller_id', sellerId)
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

    (sales || []).forEach(sale => {
      const { cashArs, cashUsd } = extractCashFromSale(sale);
      cashSalesArs += cashArs;
      cashSalesUsd += cashUsd;
    });

    // 5. Calcular totales de movimientos manuales
    let manualArsIn = 0;
    let manualArsOut = 0;
    let manualUsdIn = 0;
    let manualUsdOut = 0;

    (movements || []).forEach(m => {
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
      shift,
      movements: movements || [],
      cashSalesArs,
      cashSalesUsd,
      expectedArs,
      expectedUsd
    };
  } catch (error: any) {
    console.error('Error al obtener caja activa:', error);
    return { success: false, error: error.message || 'Error al obtener turno de caja' };
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
    const serviceClient = getServiceSupabase();
    const sellerId = await resolveSellerId();

    // Validar que no haya un turno ya abierto
    const { data: existing } = await serviceClient
      .from('cash_shifts')
      .select('id')
      .eq('seller_id', sellerId)
      .eq('status', 'open')
      .maybeSingle();

    if (existing) {
      throw new Error('Ya tienes un turno de caja abierto en el sistema.');
    }

    const { data, error } = await serviceClient
      .from('cash_shifts')
      .insert([
        {
          seller_id: sellerId,
          opened_at: new Date().toISOString(),
          initial_ars: Math.max(0, initialArs),
          initial_usd: Math.max(0, initialUsd),
          status: 'open',
          notes: notes?.trim() || null
        }
      ])
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/caja');
    revalidatePath('/');
    return { success: true, shiftId: data.id };
  } catch (error: any) {
    console.error('Error al abrir turno de caja:', error);
    return { success: false, error: error.message || 'Error al abrir la caja' };
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
    if (!description || description.trim() === '') {
      throw new Error('Debes ingresar la descripción del movimiento.');
    }

    if (amountArs <= 0 && amountUsd <= 0) {
      throw new Error('Debes ingresar un monto mayor a cero en Pesos o Dólares.');
    }

    const serviceClient = getServiceSupabase();
    const { error } = await serviceClient
      .from('cash_movements')
      .insert([
        {
          shift_id: shiftId,
          type,
          amount_ars: Math.max(0, amountArs),
          amount_usd: Math.max(0, amountUsd),
          description: description.trim(),
          created_at: new Date().toISOString()
        }
      ]);

    if (error) throw error;

    revalidatePath('/caja');
    return { success: true };
  } catch (error: any) {
    console.error('Error al agregar movimiento de caja:', error);
    return { success: false, error: error.message || 'Error al guardar movimiento' };
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
    const serviceClient = getServiceSupabase();

    // 1. Obtener la caja activa
    const { data: shift, error: shiftError } = await serviceClient
      .from('cash_shifts')
      .select('*')
      .eq('id', shiftId)
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

    (sales || []).forEach(sale => {
      const { cashArs, cashUsd } = extractCashFromSale(sale);
      cashSalesArs += cashArs;
      cashSalesUsd += cashUsd;
    });

    // 3. Consultar movimientos manuales del turno
    const { data: movements, error: movError } = await serviceClient
      .from('cash_movements')
      .select('*')
      .eq('shift_id', shiftId);

    if (movError) throw movError;

    let manualArsIn = 0;
    let manualArsOut = 0;
    let manualUsdIn = 0;
    let manualUsdOut = 0;

    (movements || []).forEach(m => {
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

    // 4. Calcular el saldo esperado del sistema (system_calculated)
    const systemCalculatedArs = Number(shift.initial_ars || 0) + cashSalesArs + manualNetArs;
    const systemCalculatedUsd = Number(shift.initial_usd || 0) + cashSalesUsd + manualNetUsd;

    // 5. Calcular la diferencia (declared - systemCalculated)
    const differenceArs = declaredArs - systemCalculatedArs;
    const differenceUsd = declaredUsd - systemCalculatedUsd;

    // 6. Actualizar el turno a 'closed'
    const { error: updateError } = await serviceClient
      .from('cash_shifts')
      .update({
        closed_at: new Date().toISOString(),
        declared_ars: declaredArs,
        declared_usd: declaredUsd,
        system_calculated_ars: systemCalculatedArs,
        system_calculated_usd: systemCalculatedUsd,
        difference_ars: differenceArs,
        difference_usd: differenceUsd,
        status: 'closed',
        notes: notes ? `${shift.notes ? shift.notes + ' | ' : ''}${notes.trim()}` : shift.notes
      })
      .eq('id', shiftId);

    if (updateError) throw updateError;

    revalidatePath('/caja');
    revalidatePath('/auditoria/caja');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Error al cerrar turno de caja:', error);
    return { success: false, error: error.message || 'Error al cerrar el turno' };
  }
}

/**
 * Obtener el historial completo de turnos cerrados para auditoría (Exclusivo Admin).
 */
export async function getClosedShifts(role: UserRole): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Se requiere rol de Administrador.');
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

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error al obtener historial de auditoría de cajas:', error);
    return { success: false, error: error.message || 'Error al consultar historial de cajas' };
  }
}
