'use server';

import { getServiceSupabase, supabase } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';
import { depositToAccount, getTreasuryAccounts } from '@/app/actions/treasury';
import { createClient } from '@/utils/supabase/server';

/**
 * Obtener todos los clientes registrados.
 */
export async function getClients(role: UserRole): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error al obtener clientes:', error);
    return { success: false, error: error.message || 'Error al obtener clientes' };
  }
}

interface SaleItemInput {
  product_id: string;
  quantity: number;
  price_ars: number;
  price_usd: number;
}

interface DecantJitInput {
  decant_liquid_id: string;
  ml_quantity: number;
  supply_id: string;
}

interface SaleInput {
  client_id: string | null;
  seller_id: string | null;
  total_ars: number;
  total_usd_equivalent: number;
  exchange_rate_used: number;
  amount_paid_today?: number;
  amount_due_ars?: number;
  payment_status?: 'paid' | 'partial' | 'pending';
  payment_methods: {
    cash_ars?: number;
    transfer_ars?: number;
    cash_usd?: number;
    digital_ars?: number;
    [key: string]: any;
  };
  items: SaleItemInput[];
  decants: DecantJitInput[];
}

/**
 * Registrar una venta completa y procesar stock (estándar y decants JIT) en una transacción SQL atómica.
 */
export async function createSaleTransaction(
  role: UserRole,
  saleData: SaleInput
): Promise<{ success: boolean; saleId?: string; error?: string }> {
  try {
    // Validar integridad de los ítems de venta
    if (!saleData.items || saleData.items.length === 0) {
      throw new Error('La venta debe tener al menos un ítem.');
    }

    const serviceClient = getServiceSupabase();

    // Intentar recuperar el ID del vendedor (usuario actual) de la sesión de Supabase SSR
    let sellerId = saleData.seller_id;
    if (!sellerId) {
      const serverSupabase = await createClient();
      const { data: { user } } = await serverSupabase.auth.getUser();
      if (user) {
        sellerId = user.id;
      }
    }

    // Bypass de desarrollo: Si no hay usuario autenticado, buscar el primer perfil de la DB
    if (!sellerId) {
      const { data: profiles } = await serviceClient.from('profiles').select('id').limit(1);
      if (profiles && profiles.length > 0) {
        sellerId = profiles[0].id;
      } else {
        // Si no hay perfiles en la base de datos, creamos un usuario y perfil dummy automáticamente
        try {
          const email = 'dummy.seller@elohimimport.com';
          const { data: userData, error: userError } = await serviceClient.auth.admin.createUser({
            email,
            password: 'dummyPassword123!',
            email_confirm: true
          });

          if (userError) {
            throw userError;
          }

          const dummyUserId = userData.user.id;
          
          // Insertar manualmente en la tabla profiles
          const { error: profileError } = await serviceClient.from('profiles').insert({
            id: dummyUserId,
            email,
            role: 'admin'
          });

          if (profileError) {
            throw profileError;
          }

          sellerId = dummyUserId;
          console.log('Bypass Desarrollo: Creado usuario y perfil dummy exitosamente:', sellerId);
        } catch (dummyErr: any) {
          console.error('Bypass Desarrollo: Error al crear usuario dummy:', dummyErr);
        }
      }
    }

    // Invocar el RPC transaccional que procesa la venta en un único bloque atómico
    const { data, error } = await serviceClient.rpc('create_sale_transaction', {
      p_client_id: saleData.client_id,
      p_seller_id: sellerId,
      p_total_ars: saleData.total_ars,
      p_total_usd_equivalent: saleData.total_usd_equivalent,
      p_exchange_rate_used: saleData.exchange_rate_used,
      p_payment_methods: saleData.payment_methods,
      p_items: saleData.items,
      p_decants: saleData.decants
    });

    if (error) {
      throw error;
    }

    const saleId = data;

    // EXTRAER MONTOS Y ESTADOS FINANCIEROS
    const pm = saleData.payment_methods as any;
    const paidCashArs = Number(pm?.cash_ars || 0);
    const paidDigitalArs = Number(pm?.digital_ars || pm?.transfer_ars || 0);
    const paidCashUsdArs = Number(pm?.cash_usd || 0) * Number(saleData.exchange_rate_used || 1);
    const totalPaidTodayCalculated = Math.round(paidCashArs + paidDigitalArs + paidCashUsdArs);

    const paidToday = saleData.amount_paid_today !== undefined
      ? Math.round(Number(saleData.amount_paid_today))
      : totalPaidTodayCalculated;

    const amountDueArs = saleData.amount_due_ars !== undefined
      ? Math.round(Number(saleData.amount_due_ars))
      : Math.max(0, Math.round(saleData.total_ars - paidToday));

    const paymentStatus = saleData.payment_status || (amountDueArs <= 0 ? 'paid' : 'partial');

    const gatewayFeeArs = Math.round(Number(pm?.gateway_fee_ars || pm?.surcharge_applied_ars || 0));
    const netReceivedArs = Math.round(Number(pm?.net_received_ars !== undefined ? pm.net_received_ars : Math.max(0, saleData.total_ars - gatewayFeeArs)));

    // ACTUALIZAR REGISTRO DE VENTA EN LA TABLA SALES
    if (saleId) {
      await serviceClient
        .from('sales')
        .update({
          gateway_fee_ars: gatewayFeeArs,
          net_received_ars: netReceivedArs,
          payment_status: paymentStatus,
          amount_due_ars: amountDueArs
        })
        .eq('id', saleId);
    }

    // REGISTRAR PAGO INICIAL EN LA TABLA SALE_INSTALLMENTS
    if (saleId && paidToday > 0) {
      const initialMethod = pm?.selected_method_name || (paidDigitalArs > 0 ? 'Digital' : paidCashUsdArs > 0 ? 'Dólares' : 'Efectivo');
      const { error: instError } = await serviceClient
        .from('sale_installments')
        .insert([
          {
            sale_id: saleId,
            client_id: saleData.client_id || null,
            amount_paid_ars: paidToday,
            payment_method: initialMethod
          }
        ]);

      if (instError) {
        console.warn('Advertencia al insertar pago inicial en sale_installments:', instError);
      }
    }

    // IMPACTAR INGRESO EN LA CUENTA DE TESORERÍA SELECCIONADA
    if (paidToday > 0) {
      let treasuryAccId = pm?.treasury_account_id;
      if (!treasuryAccId) {
        const resAcc = await getTreasuryAccounts();
        if (resAcc.success && resAcc.data && resAcc.data.length > 0) {
          treasuryAccId = resAcc.data[0].id;
        }
      }

      if (treasuryAccId) {
        const amountToDeposit = netReceivedArs > 0 ? netReceivedArs : paidToday;
        await depositToAccount(treasuryAccId, amountToDeposit);
      }
    }

    // DETECTAR VENTA FIADA / SEÑA (ACCOUNTS_RECEIVABLE)
    if (amountDueArs > 0 && saleData.client_id) {
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { error: recErr } = await serviceClient
        .from('accounts_receivable')
        .insert({
          client_id: saleData.client_id,
          sale_id: saleId,
          total_amount_ars: saleData.total_ars,
          paid_amount_ars: paidToday,
          due_date: dueDate,
          status: paymentStatus === 'paid' ? 'paid' : 'pending',
          notes: 'Venta con pago parcial / Saldo pendiente POS'
        });

      if (recErr) {
        console.warn('No se pudo generar la cuenta por cobrar automática:', recErr);
      }
    }

    // PROGRAMA DE FIDELIZACIÓN (VIBEPOINTS)
    if (saleData.client_id) {
      // 1. Canje de Puntos (si usó VibePoints en esta compra)
      if (pm?.vibepoints_used && typeof pm.vibepoints_used.points === 'number' && pm.vibepoints_used.points > 0) {
        const pointsRedeemed = Number(pm.vibepoints_used.points);
        const discountArs = Number(pm.vibepoints_used.discount_ars || 0);

        const { data: currentClient } = await serviceClient
          .from('clients')
          .select('points_balance')
          .eq('id', saleData.client_id)
          .single();

        const currentPts = Number(currentClient?.points_balance || 0);
        const newBalance = Math.max(0, currentPts - pointsRedeemed);

        await serviceClient
          .from('clients')
          .update({ points_balance: newBalance })
          .eq('id', saleData.client_id);

        await serviceClient
          .from('client_points_history')
          .insert({
            client_id: saleData.client_id,
            points: -pointsRedeemed,
            reason: `Canje de ${pointsRedeemed} pts ($${discountArs} desc) en venta #${saleId.split('-')[0].toUpperCase()}`,
            sale_id: saleId
          });
      }

      // 2. Acumulación de Puntos por Compra (1000 ARS = 1 VibePoint)
      const earnedPoints = Math.floor(Number(saleData.total_ars || 0) / 1000);
      if (earnedPoints > 0) {
        const { data: currentClient } = await serviceClient
          .from('clients')
          .select('points_balance')
          .eq('id', saleData.client_id)
          .single();

        const currentPts = Number(currentClient?.points_balance || 0);
        const updatedBalance = currentPts + earnedPoints;

        await serviceClient
          .from('clients')
          .update({ points_balance: updatedBalance })
          .eq('id', saleData.client_id);

        await serviceClient
          .from('client_points_history')
          .insert({
            client_id: saleData.client_id,
            points: earnedPoints,
            reason: `Puntos ganados por compra #${saleId.split('-')[0].toUpperCase()}`,
            sale_id: saleId
          });
      }
    }

    revalidatePath('/productos');
    revalidatePath('/auditoria/ventas');
    revalidatePath('/cobranzas');
    revalidatePath('/caja');
    revalidatePath('/admin/finanzas/tesoreria');
    revalidatePath('/clientes');
    revalidatePath('/pos');
    return { success: true, saleId };
  } catch (error: any) {
    console.error('Error al registrar la venta transaccional:', error);
    return { success: false, error: error.message || 'Error al procesar la facturación y stock en base de datos' };
  }
}

/**
 * Obtener el historial completo de ventas registradas con clientes e ítems.
 */
export async function getSalesHistory(role: UserRole): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const serviceClient = getServiceSupabase();
    const { data, error } = await serviceClient
      .from('sales')
      .select(`
        *,
        clients (
          name,
          phone,
          email
        ),
        sale_items (
          id,
          quantity,
          price_ars_at_moment,
          price_usd_at_moment,
          products (
            name,
            brand,
            type
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error al obtener historial de ventas:', error);
    return { success: false, error: error.message || 'Error al obtener historial de ventas' };
  }
}

/**
 * Obtener una venta específica por su ID para reimpresión de ticket.
 */
export async function getSaleById(saleId: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const serviceClient = getServiceSupabase();
    const { data, error } = await serviceClient
      .from('sales')
      .select(`
        *,
        clients (
          name,
          phone,
          email
        ),
        sale_items (
          id,
          quantity,
          price_ars_at_moment,
          price_usd_at_moment,
          products (
            name,
            brand,
            type
          )
        )
      `)
      .eq('id', saleId)
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error: any) {
    console.error('Error al consultar venta por ID:', error);
    return { success: false, error: error.message || 'Error al consultar venta' };
  }
}

/**
 * Anular de forma segura una transacción de venta (Solo Admin).
 * Invoca el RPC 'void_sale_transaction' para revertir el stock en base de datos de forma atómica
 * manteniendo el registro físico para auditoría comercial.
 */
export async function voidSale(
  role: UserRole,
  saleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Se requiere rol de Administrador para anular ventas.');
    }

    if (!saleId) {
      throw new Error('Identificador de venta no proporcionado.');
    }

    const serviceClient = getServiceSupabase();

    // Recuperar ID de administrador para auditoría (con fallback dev bypass)
    let adminId: string | null = null;
    const { data: { user } } = await serviceClient.auth.getUser();
    if (user) {
      adminId = user.id;
    }

    if (!adminId) {
      const { data: profiles } = await serviceClient.from('profiles').select('id').limit(1);
      if (profiles && profiles.length > 0) {
        adminId = profiles[0].id;
      }
    }

    if (!adminId) {
      adminId = '00000000-0000-0000-0000-000000000000';
    }

    // Invocar RPC transaccional que revierte stock y marca status = 'voided'
    const { error } = await serviceClient.rpc('void_sale_transaction', {
      p_sale_id: saleId,
      p_admin_id: adminId
    });

    if (error) {
      throw error;
    }

    revalidatePath('/');
    revalidatePath('/auditoria/ventas');
    revalidatePath('/admin/ventas');
    revalidatePath('/productos');
    revalidatePath('/admin/reportes');
    revalidatePath('/caja');
    revalidatePath('/cobranzas');

    return { success: true };
  } catch (error: any) {
    console.error('Error al anular venta:', error);
    return { success: false, error: error.message || 'Error al anular la transacción' };
  }
}

export interface ShippingUpdateInput {
  shipping_provider: string;
  tracking_number: string;
  shipping_status: 'pending' | 'shipped' | 'delivered';
}

/**
 * Actualizar información logística de envío y número de seguimiento para una venta.
 */
export async function updateSaleShipping(
  role: UserRole,
  saleId: string,
  shippingData: ShippingUpdateInput
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!saleId) {
      throw new Error('ID de venta no proporcionado.');
    }

    const serviceClient = getServiceSupabase();

    const { error } = await serviceClient
      .from('sales')
      .update({
        shipping_provider: shippingData.shipping_provider || 'Ninguno',
        tracking_number: shippingData.tracking_number?.trim() || null,
        shipping_status: shippingData.shipping_status || 'pending'
      })
      .eq('id', saleId);

    if (error) {
      throw error;
    }

    revalidatePath('/auditoria/ventas');
    revalidatePath('/kanban');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Error al actualizar datos de envío:', error);
    return { success: false, error: error.message || 'Error al actualizar información logística' };
  }
}


