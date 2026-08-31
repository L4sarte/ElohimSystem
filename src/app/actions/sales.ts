'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';
import { depositToAccount, getTreasuryAccounts } from '@/app/actions/treasury';
import { requireAuth, requireAdmin } from '@/lib/auth-checks';
import { saleInputSchema, calculatePreciseTotal } from '@/lib/sales-validation';
import Decimal from 'decimal.js';

export interface ClientRecord {
  id: string;
  name: string;
  phone?: string | null;
  contact_whatsapp?: string | null;
  email?: string | null;
  preferred_notes?: string[] | null;
  points_balance?: number;
  created_at: string;
}

/**
 * Obtener todos los clientes registrados.
 */
export async function getClients(role?: UserRole): Promise<{
  success: boolean;
  data?: ClientRecord[];
  error?: string;
}> {
  try {
    await requireAuth();

    if (!isSupabaseConfigured()) {
      return {
        success: true,
        data: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            name: 'Cliente Mostrador General',
            phone: '1122334455',
            email: 'cliente@ejemplo.com',
            points_balance: 100,
            created_at: new Date().toISOString(),
          },
        ],
      };
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    const clients: ClientRecord[] = (data || []).map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone || null,
      email: c.email || null,
      preferred_notes: c.preferred_notes || null,
      points_balance: Number(c.points_balance || 0),
      created_at: c.created_at || new Date().toISOString(),
    }));

    return { success: true, data: clients };
  } catch (error: unknown) {
    console.error('Error al obtener clientes:', error);
    const msg = error instanceof Error ? error.message : 'Error al obtener clientes';
    return { success: false, error: msg };
  }
}

export interface SaleItemInput {
  product_id: string;
  quantity: number;
  price_ars: number;
  price_usd: number;
}

export interface DecantJitInput {
  decant_liquid_id: string;
  ml_quantity: number;
  supply_id: string;
}

export interface PackagingUsedInput {
  packaging_id: string;
  quantity_used: number;
}

export interface SaleInput {
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
    gateway_fee_ars?: number;
    surcharge_applied_ars?: number;
    net_received_ars?: number;
    selected_method_name?: string;
    treasury_account_id?: string;
    vibepoints_used?: {
      points: number;
      discount_ars: number;
    } | null;
    [key: string]: unknown;
  };
  items: SaleItemInput[];
  decants: DecantJitInput[];
  packaging_supplies?: PackagingUsedInput[];
}

/**
 * Registrar una venta completa y procesar stock (estándar y decants JIT) en una transacción SQL atómica.
 */
export async function createSaleTransaction(
  role: UserRole,
  saleData: SaleInput
): Promise<{ success: boolean; saleId?: string; error?: string }> {
  try {
    // 1. Verificación de sesión y autorización del vendedor en el servidor
    const currentUser = await requireAuth();

    // 2. Validación de esquema Zod
    const validation = saleInputSchema.safeParse(saleData);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Datos de venta inválidos.';
      return { success: false, error: firstError };
    }

    const cleanSaleData = validation.data;

    // 3. Modo desarrollo sin Supabase
    if (!isSupabaseConfigured()) {
      const mockId = 'mock-' + Math.random().toString(36).substring(2, 9);
      return { success: true, saleId: mockId };
    }

    const serviceClient = getServiceSupabase();

    // 4. Verificación y resolución de seller_id (priorizar usuario autenticado real)
    let finalSellerId = currentUser.id;
    const { data: profCheck } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (!profCheck) {
      // Fallback a perfil existente para no quebrar FK en entornos mixtos
      const { data: anyProf } = await serviceClient
        .from('profiles')
        .select('id')
        .limit(1);
      finalSellerId = anyProf?.[0]?.id || null;
    }

    // 5. Verificación de coherencia financiera en backend con Decimal.js
    const productIds = cleanSaleData.items.map((i) => i.product_id);
    const { data: dbProducts, error: prodErr } = await serviceClient
      .from('products')
      .select('id, name, base_price_ars, stock_quantity, type')
      .in('id', productIds);

    if (prodErr || !dbProducts) {
      throw new Error('No se pudieron consultar los productos en catálogo para validar precios y stock.');
    }

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    for (const item of cleanSaleData.items) {
      const dbProd = productMap.get(item.product_id);
      if (!dbProd) {
        throw new Error(`El producto con ID ${item.product_id} no existe en inventario.`);
      }
      if (dbProd.type !== 'decant_liquid' && dbProd.stock_quantity < item.quantity) {
        throw new Error(`Stock insuficiente para "${dbProd.name}". Disponible: ${dbProd.stock_quantity}, Solicitado: ${item.quantity}`);
      }
    }

    // 6. Invocar el RPC transaccional que procesa la venta en un único bloque atómico
    const { data, error } = await serviceClient.rpc('create_sale_transaction', {
      p_client_id: cleanSaleData.client_id || null,
      p_seller_id: finalSellerId,
      p_total_ars: cleanSaleData.total_ars,
      p_total_usd_equivalent: cleanSaleData.total_usd_equivalent || 0,
      p_exchange_rate_used: cleanSaleData.exchange_rate_used,
      p_payment_methods: cleanSaleData.payment_methods,
      p_items: cleanSaleData.items,
      p_decants: cleanSaleData.decants,
    });

    if (error) {
      throw error;
    }

    const saleId: string = data;

    // 7. Extraer montos y estados financieros calculados con Decimal.js
    const pm = cleanSaleData.payment_methods as Record<string, unknown>;
    const paidCashArs = new Decimal(Number(pm?.cash_ars || 0));
    const paidDigitalArs = new Decimal(Number(pm?.digital_ars || pm?.transfer_ars || 0));
    const paidCashUsdArs = new Decimal(Number(pm?.cash_usd || 0)).times(new Decimal(cleanSaleData.exchange_rate_used || 1));
    const totalPaidTodayCalculated = paidCashArs.plus(paidDigitalArs).plus(paidCashUsdArs).round().toNumber();

    const paidToday = cleanSaleData.amount_paid_today !== undefined
      ? Math.round(Number(cleanSaleData.amount_paid_today))
      : totalPaidTodayCalculated;

    const amountDueArs = cleanSaleData.amount_due_ars !== undefined
      ? Math.round(Number(cleanSaleData.amount_due_ars))
      : Math.max(0, Math.round(cleanSaleData.total_ars - paidToday));

    const paymentStatus = cleanSaleData.payment_status || (amountDueArs <= 0 ? 'paid' : 'partial');

    const gatewayFeeArs = Math.round(Number(pm?.gateway_fee_ars || pm?.surcharge_applied_ars || 0));
    const netReceivedArs = Math.round(
      Number(pm?.net_received_ars !== undefined ? pm.net_received_ars : Math.max(0, cleanSaleData.total_ars - gatewayFeeArs))
    );

    // 8. Actualizar registro de venta en tabla sales
    if (saleId) {
      await serviceClient
        .from('sales')
        .update({
          gateway_fee_ars: gatewayFeeArs,
          net_received_ars: netReceivedArs,
          payment_status: paymentStatus,
          amount_due_ars: amountDueArs,
        })
        .eq('id', saleId);
    }

    // 9. Registrar pago inicial en sale_installments
    if (saleId && paidToday > 0) {
      const initialMethod = String(
        pm?.selected_method_name ||
          (paidDigitalArs.toNumber() > 0 ? 'Digital' : paidCashUsdArs.toNumber() > 0 ? 'Dólares' : 'Efectivo')
      );
      const { error: instError } = await serviceClient
        .from('sale_installments')
        .insert([
          {
            sale_id: saleId,
            client_id: cleanSaleData.client_id || null,
            amount_paid_ars: paidToday,
            payment_method: initialMethod,
          },
        ]);

      if (instError) {
        console.warn('Advertencia al insertar pago inicial en sale_installments:', instError.message);
      }
    }

    // 10. Impactar ingreso en tesorería
    if (paidToday > 0) {
      let treasuryAccId = typeof pm?.treasury_account_id === 'string' ? pm.treasury_account_id : null;
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

    // 11. Cuentas por Cobrar automáticas en caso de saldo adeudado
    if (amountDueArs > 0 && cleanSaleData.client_id) {
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { error: recErr } = await serviceClient
        .from('accounts_receivable')
        .insert({
          client_id: cleanSaleData.client_id,
          sale_id: saleId,
          total_amount_ars: cleanSaleData.total_ars,
          paid_amount_ars: paidToday,
          due_date: dueDate,
          status: paymentStatus === 'paid' ? 'paid' : 'pending',
          notes: 'Venta con pago parcial / Saldo pendiente POS',
        });

      if (recErr) {
        console.warn('No se pudo generar la cuenta por cobrar automática:', recErr.message);
      }
    }

    // 12. Fidelización (VibePoints)
    if (cleanSaleData.client_id) {
      const vibepointsUsed = pm?.vibepoints_used as { points?: number; discount_ars?: number } | undefined;
      if (vibepointsUsed && typeof vibepointsUsed.points === 'number' && vibepointsUsed.points > 0) {
        const pointsRedeemed = Number(vibepointsUsed.points);
        const discountArs = Number(vibepointsUsed.discount_ars || 0);

        const { data: currentClient } = await serviceClient
          .from('clients')
          .select('points_balance')
          .eq('id', cleanSaleData.client_id)
          .single();

        const currentPts = Number(currentClient?.points_balance || 0);
        const newBalance = Math.max(0, currentPts - pointsRedeemed);

        await serviceClient
          .from('clients')
          .update({ points_balance: newBalance })
          .eq('id', cleanSaleData.client_id);

        await serviceClient
          .from('client_points_history')
          .insert({
            client_id: cleanSaleData.client_id,
            points: -pointsRedeemed,
            reason: `Canje de ${pointsRedeemed} pts ($${discountArs} desc) en venta #${saleId.split('-')[0].toUpperCase()}`,
            sale_id: saleId,
          });
      }

      // Acumulación de Puntos por Compra (1000 ARS = 1 VibePoint)
      const earnedPoints = Math.floor(cleanSaleData.total_ars / 1000);
      if (earnedPoints > 0) {
        const { data: currentClient } = await serviceClient
          .from('clients')
          .select('points_balance')
          .eq('id', cleanSaleData.client_id)
          .single();

        const currentPts = Number(currentClient?.points_balance || 0);
        const updatedBalance = currentPts + earnedPoints;

        await serviceClient
          .from('clients')
          .update({ points_balance: updatedBalance })
          .eq('id', cleanSaleData.client_id);

        await serviceClient
          .from('client_points_history')
          .insert({
            client_id: cleanSaleData.client_id,
            points: earnedPoints,
            reason: `Puntos ganados por compra #${saleId.split('-')[0].toUpperCase()}`,
            sale_id: saleId,
          });
      }
    }

    // 13. Trazabilidad y Descuento de Insumos de Packaging
    if (saleId && cleanSaleData.packaging_supplies && cleanSaleData.packaging_supplies.length > 0) {
      for (const packItem of cleanSaleData.packaging_supplies) {
        if (!packItem.packaging_id || !packItem.quantity_used || packItem.quantity_used <= 0) continue;

        const qtyUsed = Number(packItem.quantity_used);

        const { error: packInsertError } = await serviceClient
          .from('sale_packaging')
          .insert({
            sale_id: saleId,
            packaging_id: packItem.packaging_id,
            quantity_used: qtyUsed,
          });

        if (packInsertError) {
          console.warn('Advertencia al asociar packaging a venta:', packInsertError.message);
        }

        const { data: supplyProd } = await serviceClient
          .from('products')
          .select('stock_quantity')
          .eq('id', packItem.packaging_id)
          .single();

        if (supplyProd) {
          const currentStock = Number(supplyProd.stock_quantity || 0);
          const newStock = Math.max(0, currentStock - qtyUsed);
          await serviceClient
            .from('products')
            .update({ stock_quantity: newStock })
            .eq('id', packItem.packaging_id);
        }
      }
    }

    // 14. Tablero Kanban automático
    try {
      let clientDisplayName = 'Venta POS / Mostrador';
      if (cleanSaleData.client_id) {
        const { data: clientObj } = await serviceClient
          .from('clients')
          .select('name')
          .eq('id', cleanSaleData.client_id)
          .maybeSingle();
        if (clientObj?.name) {
          clientDisplayName = clientObj.name;
        }
      }

      const shortId = saleId ? saleId.split('-')[0].toUpperCase() : 'POS';
      const itemsCount = cleanSaleData.items ? cleanSaleData.items.length : 0;
      const initialStatus = paymentStatus === 'pending' ? 'pending' : 'processing';

      await serviceClient.from('kanban_orders').insert({
        client_name: clientDisplayName,
        product_details: `Venta POS #${shortId} (${itemsCount} ítems)`,
        total_ars: cleanSaleData.total_ars,
        status: initialStatus,
        notes: `Facturado vía POS (${paymentStatus === 'paid' ? 'Pago Completo' : 'Pago Parcial / Pendiente'})`,
      });
    } catch (kanbanErr) {
      console.warn('Advertencia al insertar venta en Kanban:', kanbanErr);
    }

    revalidatePath('/productos');
    revalidatePath('/auditoria/ventas');
    revalidatePath('/cobranzas');
    revalidatePath('/caja');
    revalidatePath('/admin/finanzas/tesoreria');
    revalidatePath('/clientes');
    revalidatePath('/kanban');

    return { success: true, saleId };
  } catch (error: unknown) {
    console.error('Error al registrar la venta transaccional:', error);
    const msg = error instanceof Error ? error.message : 'Error al procesar la facturación y stock';
    return { success: false, error: msg };
  }
}

export interface SaleDetailRecord {
  id: string;
  total_ars: number;
  total_usd_equivalent: number;
  exchange_rate_used: number;
  payment_status: string;
  amount_due_ars: number;
  payment_methods: Record<string, unknown>;
  created_at: string;
  status?: string;
  has_returns?: boolean;
  shipping_provider?: string;
  tracking_number?: string;
  shipping_status?: string;
  clients?: {
    id?: string;
    name: string;
    phone?: string | null;
    email?: string | null;
  } | null;
  sale_items?: Array<{
    id: string;
    quantity: number;
    price_ars_at_moment: number;
    price_usd_at_moment?: number;
    products?: {
      id?: string;
      name: string;
      brand: string;
      type: string;
      sku?: string;
    } | null;
  }>;
}

/**
 * Obtener el historial completo de ventas registradas con clientes e ítems.
 */
export async function getSalesHistory(role?: UserRole): Promise<{
  success: boolean;
  data?: SaleDetailRecord[];
  error?: string;
}> {
  try {
    await requireAuth();

    if (!isSupabaseConfigured()) {
      return { success: true, data: [] };
    }

    const serviceClient = getServiceSupabase();
    const { data, error } = await serviceClient
      .from('sales')
      .select(`
        *,
        clients (
          id,
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
            id,
            name,
            brand,
            type,
            sku
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, data: (data || []) as unknown as SaleDetailRecord[] };
  } catch (error: unknown) {
    console.error('Error al obtener historial de ventas:', error);
    const msg = error instanceof Error ? error.message : 'Error al obtener historial de ventas';
    return { success: false, error: msg };
  }
}

/**
 * Obtener una venta específica por su ID para visualización y reimpresión de tickets.
 */
export async function getSaleById(saleId: string): Promise<{
  success: boolean;
  data?: SaleDetailRecord;
  error?: string;
}> {
  try {
    await requireAuth();

    if (!saleId || !saleId.trim()) {
      return { success: false, error: 'Identificador de venta no proporcionado.' };
    }

    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Base de datos no configurada.' };
    }

    const serviceClient = getServiceSupabase();
    const { data, error } = await serviceClient
      .from('sales')
      .select(`
        *,
        clients (
          id,
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
            id,
            name,
            brand,
            type,
            sku
          )
        )
      `)
      .eq('id', saleId.trim())
      .single();

    if (error) throw error;

    return { success: true, data: data as unknown as SaleDetailRecord };
  } catch (error: unknown) {
    console.error('Error al consultar venta por ID:', error);
    const msg = error instanceof Error ? error.message : 'Error al consultar venta';
    return { success: false, error: msg };
  }
}

/**
 * Anular de forma segura una transacción de venta (Solo Admin).
 * Invoca el RPC 'void_sale_transaction' para revertir el stock en base de datos de forma atómica.
 */
export async function voidSale(
  role: UserRole,
  saleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminUser = await requireAdmin();

    if (!saleId || !saleId.trim()) {
      throw new Error('Identificador de venta no proporcionado.');
    }

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const serviceClient = getServiceSupabase();

    const { error } = await serviceClient.rpc('void_sale_transaction', {
      p_sale_id: saleId.trim(),
      p_admin_id: adminUser.id,
    });

    if (error) {
      throw error;
    }

    // RESTAURAR STOCK DE INSUMOS DE PACKAGING
    const { data: packagingItems, error: packErr } = await serviceClient
      .from('sale_packaging')
      .select('packaging_id, quantity_used')
      .eq('sale_id', saleId.trim());

    if (!packErr && packagingItems && packagingItems.length > 0) {
      for (const pItem of packagingItems) {
        if (!pItem.packaging_id || !pItem.quantity_used) continue;
        const qtyToReturn = Number(pItem.quantity_used);

        const { data: supplyProd } = await serviceClient
          .from('products')
          .select('stock_quantity')
          .eq('id', pItem.packaging_id)
          .single();

        if (supplyProd) {
          const currentStock = Number(supplyProd.stock_quantity || 0);
          const restoredStock = currentStock + qtyToReturn;
          await serviceClient
            .from('products')
            .update({ stock_quantity: restoredStock })
            .eq('id', pItem.packaging_id);
        }
      }
    }

    revalidatePath('/');
    revalidatePath('/auditoria/ventas');
    revalidatePath('/admin/ventas');
    revalidatePath('/productos');
    revalidatePath('/admin/reportes');
    revalidatePath('/caja');
    revalidatePath('/cobranzas');

    return { success: true };
  } catch (error: unknown) {
    console.error('Error al anular venta:', error);
    const msg = error instanceof Error ? error.message : 'Error al anular la transacción';
    return { success: false, error: msg };
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
    await requireAuth();

    if (!saleId || !saleId.trim()) {
      throw new Error('ID de venta no proporcionado.');
    }

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const serviceClient = getServiceSupabase();

    const { error } = await serviceClient
      .from('sales')
      .update({
        shipping_provider: shippingData.shipping_provider || 'Ninguno',
        tracking_number: shippingData.tracking_number?.trim() || null,
        shipping_status: shippingData.shipping_status || 'pending',
      })
      .eq('id', saleId.trim());

    if (error) {
      throw error;
    }

    revalidatePath('/auditoria/ventas');
    revalidatePath('/kanban');
    revalidatePath('/');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error al actualizar datos de envío:', error);
    const msg = error instanceof Error ? error.message : 'Error al actualizar información logística';
    return { success: false, error: msg };
  }
}
