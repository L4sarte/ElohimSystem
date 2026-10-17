'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserRole } from '@/types';
import {
  CreatePOPayload,
  PurchaseOrder,
  CheckInItemPayload,
  CheckInPaymentDetails,
  PurchaseCurrency,
  PaymentCondition,
  POStatus,
  POExpenseType,
} from '@/types/supplyChain';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth-checks';
import { purchaseInputSchema, settleProviderDebtSchema } from '@/lib/purchase-validation';
import { getTreasuryAccounts } from '@/app/actions/treasury';
import { withdrawFromAccount } from '@/lib/treasury-ops';

export interface PurchaseItemInput {
  product_id: string;
  quantity: number;
  unit_cost?: number;
  unit_cost_ars: number;
  currency?: PurchaseCurrency;
}

export interface PurchaseInput {
  supplier_id: string;
  admin_id?: string;
  status?: POStatus;
  currency?: PurchaseCurrency;
  exchange_rate?: number;
  total_ars: number;
  total_usd: number;
  payment_condition?: PaymentCondition;
  payment_status: 'paid_cash' | 'pending_credit' | 'partial_payment' | 'paid' | 'unpaid';
  treasury_account_id?: string | null;
  payment_due_date?: string | null;
  due_date?: string | null;
  expected_arrival_date?: string | null;
  tracking_info?: string | null;
  notes?: string | null;
  items: PurchaseItemInput[];
  expenses?: Array<{
    expense_type: POExpenseType;
    amount: number;
    description?: string;
  }>;
}

export interface PurchaseRecord {
  id: string;
  supplier_id?: string;
  total_ars: number;
  total_usd: number;
  currency?: PurchaseCurrency;
  exchange_rate?: number;
  status: string;
  payment_status: string;
  payment_due_date?: string | null;
  treasury_account_id?: string | null;
  notes?: string | null;
  created_at: string;
  suppliers?: {
    id: string;
    name: string;
    contact_name?: string | null;
  } | null;
  purchase_items?: Array<{
    id: string;
    quantity: number;
    unit_cost_ars: number;
    unit_cost?: number;
    currency?: string;
    products?: {
      id: string;
      name: string;
      brand: string;
      sku: string;
      type?: string;
    } | null;
  }>;
}

export interface AccountPayableRecord {
  id: string;
  purchase_id?: string | null;
  supplier_id: string;
  total_amount_ars: number;
  paid_amount_ars: number;
  amount_total: number;
  amount_paid: number;
  amount_remaining: number;
  currency?: PurchaseCurrency;
  exchange_rate?: number;
  due_date?: string | null;
  status: 'pending' | 'partial' | 'settled' | 'paid';
  notes?: string | null;
  created_at: string;
  suppliers?: {
    id: string;
    name: string;
    contact_name?: string | null;
    phone?: string | null;
  } | null;
  purchases?: {
    id: string;
    created_at: string;
    total_ars: number;
    total_usd?: number;
    currency?: string;
    exchange_rate?: number;
    status?: string;
  } | null;
}

export interface SettleProviderDebtInput {
  debt_id: string;
  amount_paid: number;
  treasury_account_id: string;
  currency?: PurchaseCurrency;
  exchange_rate?: number;
  notes?: string | null;
}

function revalidateAllPurchasePaths() {
  revalidatePath('/productos');
  revalidatePath('/compras');
  revalidatePath('/compras/nueva');
  revalidatePath('/compras/proveedores');
  revalidatePath('/admin/finanzas/tesoreria');
  revalidatePath('/admin/finanzas/cxcobrar');
  revalidatePath('/admin/inventario/kardex');
  revalidatePath('/admin/inventario/insumos');
  revalidatePath('/admin/proveedores');
  revalidatePath('/');
}

/**
 * Procesa una nueva compra B2B de forma transaccional:
 * - Inserta la compra y los items.
 * - Si status === 'received', incrementa stock en catálogo y recalcula Costo Promedio Ponderado (PPP).
 * - Si status === 'in_transit', registra la orden en Mercadería en Camino sin tocar stock hasta su Check-In.
 * - Si es CONTADO ('paid_cash'): debita obligatoriamente el saldo de `treasury_account_id` con movimiento `EGRESO_COMPRA_STOCK`.
 * - Si es CUENTA_CORRIENTE ('pending_credit'): inserta deuda en `accounts_payable` con vencimiento, dejando intacta la tesorería.
 */
export async function submitPurchase(
  role: UserRole,
  purchaseData: PurchaseInput
): Promise<{ success: boolean; purchaseId?: string; message?: string; error?: string }> {
  try {
    const adminUser = await requireAdmin();

    const validation = purchaseInputSchema.safeParse(purchaseData);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Datos de compra inválidos.';
      return { success: false, error: firstError };
    }

    const clean = validation.data;

    if (!isSupabaseConfigured()) {
      return {
        success: true,
        purchaseId: 'mock-po-' + Math.random().toString(36).substring(2, 7),
        message: 'Compra registrada en modo simulación.',
      };
    }

    const supabase = getServiceSupabase();

    const isCash =
      clean.payment_condition === 'CONTADO' ||
      (!clean.payment_condition && (clean.payment_status === 'paid_cash' || clean.payment_status === 'paid'));

    const paymentCondition: PaymentCondition = isCash ? 'CONTADO' : 'CUENTA_CORRIENTE';
    const normalizedPaymentStatus = isCash ? 'paid_cash' : 'pending_credit';
    const receptionStatus: POStatus = clean.status || 'received';
    const exchangeRate = Number(clean.exchange_rate || 1250);
    const currency: PurchaseCurrency = clean.currency || 'ARS';

    const rawDueDate = clean.payment_due_date || clean.due_date || null;
    const defaultDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const formattedDueDate = isCash ? null : rawDueDate || defaultDueDate;

    // 1. Intentar usar la versión extendida de la RPC `register_purchase_transaction`
    const { data: rpcPurchaseId, error: rpcExtendedErr } = await supabase.rpc('register_purchase_transaction', {
      p_supplier_id: clean.supplier_id,
      p_admin_id: adminUser.id,
      p_total_ars: Math.round(clean.total_ars * 100) / 100,
      p_total_usd: Math.round(clean.total_usd * 100) / 100,
      p_payment_status: normalizedPaymentStatus,
      p_due_date: formattedDueDate,
      p_items: clean.items.map((it) => ({
        product_id: it.product_id,
        quantity: it.quantity,
        unit_cost_ars: it.unit_cost_ars,
        unit_cost: it.unit_cost ?? it.unit_cost_ars,
        currency: it.currency || currency,
      })),
      p_currency: currency,
      p_exchange_rate: exchangeRate,
      p_payment_condition: paymentCondition,
      p_treasury_account_id: isCash ? clean.treasury_account_id : null,
      p_reception_status: receptionStatus,
      p_expected_arrival_date: clean.expected_arrival_date || null,
      p_tracking_info: clean.tracking_info || null,
      p_notes: clean.notes || null,
      p_expenses: clean.expenses || [],
    });

    if (!rpcExtendedErr && rpcPurchaseId) {
      revalidateAllPurchasePaths();
      return {
        success: true,
        purchaseId: String(rpcPurchaseId),
        message:
          receptionStatus === 'received'
            ? isCash
              ? '¡Compra ingresada a stock y fondos debitados de Tesorería!'
              : '¡Compra ingresada a stock y registrada en Cuentas por Pagar (CxP)!'
            : isCash
            ? '¡Orden emitida En Tránsito y abonada por Tesorería!'
            : '¡Orden emitida En Tránsito y registrada en Cuentas por Pagar (CxP)!',
      };
    }

    // Si el error es de negocio (ej. SALDO_TESORERIA_INVALIDO o CUENTA_TESORERIA_REQUERIDA), lanzarlo inmediatamente
    if (
      rpcExtendedErr &&
      (rpcExtendedErr.message.includes('SALDO_TESORERIA_INVALIDO') ||
        rpcExtendedErr.message.includes('CUENTA_') ||
        rpcExtendedErr.message.includes('PROVEEDOR_') ||
        rpcExtendedErr.message.includes('PRODUCTO_'))
    ) {
      throw new Error(rpcExtendedErr.message);
    }

    // 2. Fallback transaccional compatible si la migración SQL extendida aún no fue corrida en el motor remoto
    console.warn(
      '[PURCHASE_EXTENDED_RPC_FALLBACK]: Usando flujo compatible con esquema base:',
      rpcExtendedErr?.message
    );

    // Obtener nombre del proveedor y validar cuenta de tesorería ANTES de tocar stock
    const { data: supData } = await supabase
      .from('suppliers')
      .select('name')
      .eq('id', clean.supplier_id)
      .single();
    const supplierName = supData?.name || 'Proveedor B2B';

    let accountName = 'Tesorería';
    if (isCash) {
      if (!clean.treasury_account_id) {
        return {
          success: false,
          error: 'Debe seleccionar obligatoriamente una cuenta de tesorería para compras al Contado.',
        };
      }
      const { data: accData, error: accErr } = await supabase
        .from('treasury_accounts')
        .select('id, account_name, balance_ars')
        .eq('id', clean.treasury_account_id)
        .single();

      if (accErr || !accData) {
        return { success: false, error: 'La cuenta de tesorería seleccionada no existe.' };
      }

      if (Number(accData.balance_ars || 0) < clean.total_ars) {
        return {
          success: false,
          error: `Saldo insuficiente en "${accData.account_name}" ($${Number(accData.balance_ars || 0).toLocaleString('es-AR')} ARS disponibles) para cubrir $${clean.total_ars.toLocaleString('es-AR')} ARS.`,
        };
      }
      accountName = accData.account_name;
    }

    let createdPurchaseId = '';

    if (receptionStatus === 'in_transit') {
      // Si la compra queda En Tránsito, NO impactamos stock todavía: creamos PO + registro en purchases
      const itemsSubtotalArs = clean.items.reduce((s, i) => s + i.quantity * i.unit_cost_ars, 0);
      const expensesTotalArs = (clean.expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);

      const { data: poRow, error: poErr } = await supabase
        .from('purchase_orders')
        .insert([
          {
            supplier_id: clean.supplier_id,
            status: 'in_transit',
            expected_arrival_date: clean.expected_arrival_date || new Date().toISOString().split('T')[0],
            tracking_info: clean.tracking_info || null,
            subtotal_merchandise: itemsSubtotalArs,
            total_expenses: expensesTotalArs,
            grand_total: clean.total_ars,
            notes:
              clean.notes ||
              `[${currency} @ $${exchangeRate}] ${isCash ? `[PAGADO CONTADO: ${accountName}]` : `[CXP VENCE: ${formattedDueDate}]`}`,
          },
        ])
        .select('id')
        .single();

      if (poErr || !poRow) {
        throw new Error(poErr?.message || 'Error al registrar la orden en tránsito.');
      }

      createdPurchaseId = poRow.id;

      await supabase.from('purchase_order_items').insert(
        clean.items.map((it) => ({
          po_id: createdPurchaseId,
          product_id: it.product_id,
          expected_quantity: it.quantity,
          received_quantity: 0,
          unit_cost: it.unit_cost_ars,
        }))
      );

      if (clean.expenses && clean.expenses.length > 0) {
        await supabase.from('purchase_order_expenses').insert(
          clean.expenses.map((exp) => ({
            po_id: createdPurchaseId,
            expense_type: exp.expense_type,
            amount: exp.amount,
            description: exp.description || null,
          }))
        );
      }

      // Insertar espejo en `purchases` para que figure en Historial de Compras con estado 'in_transit'
      await supabase.from('purchases').insert([
        {
          id: createdPurchaseId,
          supplier_id: clean.supplier_id,
          admin_id: adminUser.id,
          total_ars: clean.total_ars,
          total_usd: clean.total_usd,
          status: 'in_transit',
          payment_status: isCash ? 'paid' : 'unpaid',
        },
      ]);

      await supabase.from('purchase_items').insert(
        clean.items.map((it) => ({
          purchase_id: createdPurchaseId,
          product_id: it.product_id,
          quantity: it.quantity,
          unit_cost_ars: it.unit_cost_ars,
        }))
      );

      if (!isCash) {
        await supabase.from('accounts_payable').insert([
          {
            purchase_id: createdPurchaseId,
            supplier_id: clean.supplier_id,
            total_amount_ars: clean.total_ars,
            paid_amount_ars: 0,
            due_date: formattedDueDate,
            status: 'pending',
          },
        ]);
      }
    } else {
      // Recepción inmediata a stock: usar la RPC legacy + actualizar PPP y reflejar en purchase_orders para Kardex
      const { data: legacyId, error: legacyErr } = await supabase.rpc('register_purchase_transaction', {
        p_supplier_id: clean.supplier_id,
        p_admin_id: adminUser.id,
        p_total_ars: clean.total_ars,
        p_total_usd: clean.total_usd,
        p_payment_status: isCash ? 'paid' : 'unpaid',
        p_due_date: formattedDueDate,
        p_items: clean.items.map((it) => ({
          product_id: it.product_id,
          quantity: it.quantity,
          unit_cost_ars: it.unit_cost_ars,
        })),
      });

      if (legacyErr) {
        throw legacyErr;
      }

      createdPurchaseId = String(legacyId);

      // Registrar en purchase_orders + purchase_order_items como 'received' para que el Kardex unificado lo liste
      const itemsSubtotalArs = clean.items.reduce((s, i) => s + i.quantity * i.unit_cost_ars, 0);
      const expensesTotalArs = (clean.expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);

      const { error: poMirrorErr } = await supabase.from('purchase_orders').insert([
        {
          id: createdPurchaseId,
          supplier_id: clean.supplier_id,
          status: 'received',
          expected_arrival_date: new Date().toISOString().split('T')[0],
          tracking_info: clean.tracking_info || null,
          subtotal_merchandise: itemsSubtotalArs,
          total_expenses: expensesTotalArs,
          grand_total: clean.total_ars,
          notes:
            clean.notes ||
            `[${currency} @ $${exchangeRate}] ${isCash ? `[PAGADO CONTADO: ${accountName}]` : `[CXP VENCE: ${formattedDueDate}]`}`,
        },
      ]);

      if (!poMirrorErr) {
        await supabase.from('purchase_order_items').insert(
          clean.items.map((it) => ({
            po_id: createdPurchaseId,
            product_id: it.product_id,
            expected_quantity: it.quantity,
            received_quantity: it.quantity,
            unit_cost: it.unit_cost_ars,
          }))
        );
      }
    }

    // Si es CONTADO, debitar atómicamente de la cuenta de tesorería con tipo EGRESO_COMPRA_STOCK
    if (isCash && clean.treasury_account_id) {
      const { error: treasuryErr } = await supabase.rpc('adjust_treasury_balance', {
        p_account_id: clean.treasury_account_id,
        p_delta_ars: -Math.round(clean.total_ars),
        p_delta_usd: 0,
        p_movement_type: 'EGRESO_COMPRA_STOCK',
        p_description: `Egreso por Compra de Stock — Proveedor: ${supplierName} (OC #${createdPurchaseId.slice(0, 8).toUpperCase()})`,
        p_reference_id: createdPurchaseId,
      });

      if (treasuryErr) {
        throw new Error(`Error al debitar Tesorería: ${treasuryErr.message}`);
      }
    }

    revalidateAllPurchasePaths();

    return {
      success: true,
      purchaseId: createdPurchaseId,
      message:
        receptionStatus === 'received'
          ? isCash
            ? `¡Compra ingresada a stock y $${clean.total_ars.toLocaleString('es-AR')} ARS debitados de ${accountName}!`
            : '¡Compra ingresada a stock y registrada en Cuentas por Pagar (CxP)!'
          : isCash
          ? `¡Orden emitida En Tránsito y $${clean.total_ars.toLocaleString('es-AR')} ARS debitados de ${accountName}!`
          : '¡Orden emitida En Tránsito y registrada en Cuentas por Pagar (CxP)!',
    };
  } catch (error: unknown) {
    console.error('Error al registrar transacción de compra:', error);
    const msg = error instanceof Error ? error.message : 'Error al procesar la compra';
    return { success: false, error: msg };
  }
}

/**
 * Obtener historial completo de compras registradas (Solo Admin).
 * Normaliza estados y montos en ARS y USD para las tablas y tarjetas KPI.
 */
export async function getPurchases(role?: UserRole): Promise<{
  success: boolean;
  data?: PurchaseRecord[];
  error?: string;
}> {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured()) {
      return { success: true, data: [] };
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('purchases')
      .select(`
        *,
        suppliers (
          id,
          name,
          contact_name
        ),
        purchase_items (
          id,
          quantity,
          unit_cost_ars,
          products (
            id,
            name,
            brand,
            sku,
            type
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Obtener también datos complementarios de purchase_orders y accounts_payable para enriquecer estado
    const [{ data: poRows }, { data: apRows }] = await Promise.all([
      supabase.from('purchase_orders').select('id, status, tracking_info, expected_arrival_date, notes'),
      supabase.from('accounts_payable').select('purchase_id, total_amount_ars, paid_amount_ars, due_date, status'),
    ]);

    const poMap = new Map((poRows || []).map((po: any) => [po.id, po]));
    const apMap = new Map((apRows || []).map((ap: any) => [ap.purchase_id, ap]));

    const normalized: PurchaseRecord[] = (data || []).map((row: any) => {
      const po = poMap.get(row.id);
      const ap = apMap.get(row.id);

      const totalArs = Number(row.total_ars || 0);
      const exchangeRate = Number(row.exchange_rate || 1250);
      const rawTotalUsd = Number(row.total_usd || 0);
      const totalUsd = rawTotalUsd > 0 ? rawTotalUsd : exchangeRate > 0 ? Number((totalArs / exchangeRate).toFixed(2)) : 0;

      // Normalizar payment_status ('paid_cash' | 'pending_credit' | 'partial_payment')
      let paymentStatus = row.payment_status || 'paid_cash';
      if (ap) {
        const paidArs = Number(ap.paid_amount_ars || 0);
        const totArs = Number(ap.total_amount_ars || totalArs);
        if (ap.status === 'settled' || ap.status === 'paid' || (totArs > 0 && paidArs >= totArs)) {
          paymentStatus = 'paid_cash';
        } else if (paidArs > 0 && paidArs < totArs) {
          paymentStatus = 'partial_payment';
        } else {
          paymentStatus = 'pending_credit';
        }
      } else if (paymentStatus === 'paid') {
        paymentStatus = 'paid_cash';
      } else if (paymentStatus === 'unpaid') {
        paymentStatus = 'pending_credit';
      }

      return {
        id: row.id,
        supplier_id: row.supplier_id,
        total_ars: totalArs,
        total_usd: totalUsd,
        currency: (row.currency as PurchaseCurrency) || 'ARS',
        exchange_rate: exchangeRate,
        status: po?.status || row.status || 'received',
        payment_status: paymentStatus,
        payment_due_date: row.payment_due_date || ap?.due_date || null,
        treasury_account_id: row.treasury_account_id || null,
        notes: row.notes || po?.notes || null,
        created_at: row.created_at,
        suppliers: Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers,
        purchase_items: row.purchase_items || [],
      };
    });

    return { success: true, data: normalized };
  } catch (error: unknown) {
    console.error('Error al obtener compras:', error);
    const msg = error instanceof Error ? error.message : 'Error al recuperar compras';
    return { success: false, error: msg };
  }
}

/**
 * Obtener listado de Cuentas por Pagar (Accounts Payable) con cálculo exacto de
 * `amount_total`, `amount_paid` y `amount_remaining` (Solo Admin).
 */
export async function getAccountsPayable(role?: UserRole): Promise<{
  success: boolean;
  data?: AccountPayableRecord[];
  error?: string;
}> {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured()) {
      return { success: true, data: [] };
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('accounts_payable')
      .select(`
        *,
        suppliers (
          id,
          name,
          contact_name,
          phone
        ),
        purchases (
          id,
          created_at,
          total_ars,
          total_usd,
          status
        )
      `)
      .order('due_date', { ascending: true });

    if (error) {
      throw error;
    }

    const records: AccountPayableRecord[] = (data || []).map((row: any) => {
      const amountTotal = Number(row.amount_total ?? row.total_amount_ars ?? 0);
      const amountPaid = Number(row.amount_paid ?? row.paid_amount_ars ?? 0);
      const amountRemaining =
        row.amount_remaining !== undefined && row.amount_remaining !== null
          ? Math.max(0, Number(row.amount_remaining))
          : Math.max(0, Number((amountTotal - amountPaid).toFixed(2)));

      let status: AccountPayableRecord['status'] = 'pending';
      if (row.status === 'settled' || row.status === 'paid' || (amountTotal > 0 && amountRemaining <= 0.01)) {
        status = 'settled';
      } else if (row.status === 'partial' || (amountPaid > 0 && amountRemaining > 0)) {
        status = 'partial';
      }

      return {
        id: row.id,
        purchase_id: row.purchase_id || (Array.isArray(row.purchases) ? row.purchases[0]?.id : row.purchases?.id) || null,
        supplier_id: row.supplier_id,
        total_amount_ars: amountTotal,
        paid_amount_ars: amountPaid,
        amount_total: amountTotal,
        amount_paid: amountPaid,
        amount_remaining: amountRemaining,
        currency: (row.currency as PurchaseCurrency) || 'ARS',
        exchange_rate: Number(row.exchange_rate || 1250),
        due_date: row.due_date || null,
        status,
        notes: row.notes || null,
        created_at: row.created_at,
        suppliers: Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers,
        purchases: Array.isArray(row.purchases) ? row.purchases[0] : row.purchases,
      };
    });

    return { success: true, data: records };
  } catch (error: unknown) {
    console.error('Error al obtener cuentas por pagar:', error);
    const msg = error instanceof Error ? error.message : 'Error al recuperar cuentas por pagar';
    return { success: false, error: msg };
  }
}

/**
 * Liquida total o parcialmente una deuda de proveedor (Cuentas por Pagar - CXP).
 * Invoca la RPC `settle_provider_debt` o ejecuta la actualización atómica contra Tesorería.
 */
export async function settleProviderDebtAction(
  role: UserRole,
  input: SettleProviderDebtInput
): Promise<{
  success: boolean;
  message?: string;
  data?: {
    debt_id: string;
    amount_paid_ars: number;
    amount_remaining_ars: number;
    status: string;
  };
  error?: string;
}> {
  try {
    await requireAdmin();

    const validation = settleProviderDebtSchema.safeParse(input);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Parámetros de pago inválidos.';
      return { success: false, error: firstError };
    }

    const clean = validation.data;

    if (!isSupabaseConfigured()) {
      return {
        success: true,
        message: 'Pago registrado correctamente en modo simulación.',
      };
    }

    const supabase = getServiceSupabase();

    // 1. Intentar ejecutar la RPC transaccional `settle_provider_debt`
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('settle_provider_debt', {
      p_debt_id: clean.debt_id,
      p_amount_paid: clean.amount_paid,
      p_treasury_account_id: clean.treasury_account_id,
      p_currency: clean.currency,
      p_exchange_rate: clean.exchange_rate,
      p_notes: clean.notes || null,
    });

    if (!rpcErr && rpcRes) {
      revalidateAllPurchasePaths();
      const resObj = rpcRes as any;
      const paidArs = Number(resObj.amount_paid_ars || clean.amount_paid);
      const remArs = Number(resObj.amount_remaining_ars || 0);
      const accName = resObj.account_name || 'Tesorería';
      const supName = resObj.supplier_name || 'Proveedor';

      return {
        success: true,
        data: {
          debt_id: resObj.debt_id || clean.debt_id,
          amount_paid_ars: paidArs,
          amount_remaining_ars: remArs,
          status: resObj.status || (remArs <= 0 ? 'settled' : 'partial'),
        },
        message:
          remArs <= 0
            ? `¡Deuda con ${supName} saldada en su totalidad ($${paidArs.toLocaleString('es-AR')} ARS debitados de ${accName})!`
            : `¡Pago parcial de $${paidArs.toLocaleString('es-AR')} ARS registrado desde ${accName}! Saldo pendiente: $${remArs.toLocaleString('es-AR')} ARS.`,
      };
    }

    if (
      rpcErr &&
      (rpcErr.message.includes('SALDO_TESORERIA_INVALIDO') ||
        rpcErr.message.includes('MONTO_EXCEDE_DEUDA') ||
        rpcErr.message.includes('DEUDA_YA_SALDADA'))
    ) {
      throw new Error(rpcErr.message);
    }

    // 2. Fallback seguro compatible con el esquema base si la RPC `settle_provider_debt` aún no está desplegada
    console.warn('[SETTLE_DEBT_RPC_FALLBACK]: Aplicando liquidación directa con adjust_treasury_balance:', rpcErr?.message);

    // Buscar el registro en `accounts_payable` por `id` o por `purchase_id`
    const { data: debtRows } = await supabase
      .from('accounts_payable')
      .select('*, suppliers(name)')
      .or(`id.eq.${clean.debt_id},purchase_id.eq.${clean.debt_id}`)
      .limit(1);

    let debt = debtRows && debtRows.length > 0 ? debtRows[0] : null;

    if (!debt) {
      // Si se invocó desde una compra que no tenía fila en accounts_payable, buscar en purchases
      const { data: pur } = await supabase
        .from('purchases')
        .select('id, supplier_id, total_ars, suppliers(name)')
        .eq('id', clean.debt_id)
        .single();

      if (!pur) {
        return { success: false, error: 'No se encontró la deuda ni la factura de compra asociada.' };
      }

      const { data: createdDebt, error: createDebtErr } = await supabase
        .from('accounts_payable')
        .insert([
          {
            purchase_id: pur.id,
            supplier_id: pur.supplier_id,
            total_amount_ars: pur.total_ars,
            paid_amount_ars: 0,
            due_date: new Date().toISOString().split('T')[0],
            status: 'pending',
          },
        ])
        .select('*, suppliers(name)')
        .single();

      if (createDebtErr || !createdDebt) {
        throw new Error(createDebtErr?.message || 'No se pudo inicializar el registro de deuda.');
      }
      debt = createdDebt;
    }

    const totalArs = Number(debt.amount_total ?? debt.total_amount_ars ?? 0);
    const currentPaidArs = Number(debt.amount_paid ?? debt.paid_amount_ars ?? 0);
    const currentRemainingArs = Math.max(0, Number((totalArs - currentPaidArs).toFixed(2)));

    if (currentRemainingArs <= 0) {
      return { success: false, error: 'Esta deuda ya se encuentra completamente saldada.' };
    }

    const paymentArs =
      clean.currency === 'USD'
        ? Math.round(clean.amount_paid * clean.exchange_rate * 100) / 100
        : Math.round(clean.amount_paid * 100) / 100;

    if (paymentArs > currentRemainingArs + 1) {
      return {
        success: false,
        error: `El monto a abonar ($${paymentArs.toLocaleString('es-AR')} ARS) supera el saldo pendiente ($${currentRemainingArs.toLocaleString('es-AR')} ARS).`,
      };
    }

    const effectivePaymentArs = Math.min(paymentArs, currentRemainingArs);
    const newPaidArs = Number((currentPaidArs + effectivePaymentArs).toFixed(2));
    const newRemainingArs = Math.max(0, Number((totalArs - newPaidArs).toFixed(2)));
    const isSettled = newRemainingArs <= 0.01;
    const supplierName = (debt.suppliers as any)?.name || 'Proveedor B2B';

    // Obtener cuenta de tesorería
    const { data: acc, error: accErr } = await supabase
      .from('treasury_accounts')
      .select('id, account_name, balance_ars')
      .eq('id', clean.treasury_account_id)
      .single();

    if (accErr || !acc) {
      return { success: false, error: 'Cuenta de tesorería de origen no encontrada.' };
    }

    if (Number(acc.balance_ars || 0) < effectivePaymentArs) {
      return {
        success: false,
        error: `Saldo insuficiente en "${acc.account_name}". Disponible: $${Number(acc.balance_ars || 0).toLocaleString('es-AR')} ARS.`,
      };
    }

    // Debitar mediante adjust_treasury_balance
    const paymentDesc = `Pago CxP a ${supplierName} (${isSettled ? 'Liquidación Total' : 'Pago Parcial'})${
      clean.notes ? ` — ${clean.notes}` : ''
    }`;

    const { error: adjErr } = await supabase.rpc('adjust_treasury_balance', {
      p_account_id: clean.treasury_account_id,
      p_delta_ars: -Math.round(effectivePaymentArs),
      p_delta_usd: 0,
      p_movement_type: 'EGRESO_COMPRA_STOCK',
      p_description: paymentDesc,
      p_reference_id: debt.purchase_id || debt.id,
    });

    if (adjErr) {
      throw new Error(adjErr.message);
    }

    // Actualizar accounts_payable
    await supabase
      .from('accounts_payable')
      .update({
        paid_amount_ars: isSettled ? totalArs : newPaidArs,
        status: isSettled ? 'paid' : 'partial',
      })
      .eq('id', debt.id);

    // Actualizar purchases si tiene purchase_id
    if (debt.purchase_id) {
      await supabase
        .from('purchases')
        .update({
          payment_status: isSettled ? 'paid' : 'partial_payment',
        })
        .eq('id', debt.purchase_id);
    }

    revalidateAllPurchasePaths();

    return {
      success: true,
      data: {
        debt_id: debt.id,
        amount_paid_ars: effectivePaymentArs,
        amount_remaining_ars: isSettled ? 0 : newRemainingArs,
        status: isSettled ? 'settled' : 'partial',
      },
      message: isSettled
        ? `¡Deuda con ${supplierName} saldada en su totalidad ($${effectivePaymentArs.toLocaleString('es-AR')} ARS debitados de ${acc.account_name})!`
        : `¡Abono parcial de $${effectivePaymentArs.toLocaleString('es-AR')} ARS registrado desde ${acc.account_name}! Saldo restante: $${newRemainingArs.toLocaleString('es-AR')} ARS.`,
    };
  } catch (error: unknown) {
    console.error('Error en settleProviderDebtAction:', error);
    const msg = error instanceof Error ? error.message : 'Error al registrar el pago de deuda';
    return { success: false, error: msg };
  }
}

/**
 * Crear una Orden de Compra (B2B Supply Chain) de forma atómica en el backend.
 */
export async function createPurchaseOrderAction(payload: CreatePOPayload): Promise<{
  success: boolean;
  data?: PurchaseOrder;
  error?: string;
}> {
  try {
    await requireAdmin();

    if (!payload.supplier_id) {
      return { success: false, error: 'Debe especificar un proveedor válido.' };
    }

    if (!payload.items || payload.items.length === 0) {
      return { success: false, error: 'La orden de compra debe contener al menos un producto.' };
    }

    if (!isSupabaseConfigured()) {
      return {
        success: true,
        data: {
          id: 'mock-po-' + Math.random().toString(36).substring(2, 7),
          supplier_id: payload.supplier_id,
          status: payload.status,
          order_date: new Date().toISOString(),
          expected_arrival_date: payload.expected_arrival_date,
          tracking_info: payload.tracking_info,
          subtotal_merchandise: 0,
          total_expenses: 0,
          grand_total: 0,
          notes: payload.notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };
    }

    const supabase = getServiceSupabase();

    const subtotal_merchandise = payload.items.reduce(
      (sum, item) => sum + item.expected_quantity * item.unit_cost,
      0
    );
    const total_expenses = (payload.expenses || []).reduce(
      (sum, exp) => sum + Number(exp.amount),
      0
    );
    const grand_total = subtotal_merchandise + total_expenses;

    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .insert([
        {
          supplier_id: payload.supplier_id,
          status: payload.status,
          expected_arrival_date: payload.expected_arrival_date || null,
          tracking_info: payload.tracking_info || null,
          notes: payload.notes || null,
          subtotal_merchandise,
          total_expenses,
          grand_total,
        },
      ])
      .select()
      .single();

    if (poError || !po) {
      throw new Error(`Error al crear cabecera de orden: ${poError?.message || 'Error desconocido'}`);
    }

    try {
      const itemsToInsert = payload.items.map((item) => ({
        po_id: po.id,
        product_id: item.product_id,
        expected_quantity: item.expected_quantity,
        received_quantity: 0,
        unit_cost: item.unit_cost,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(itemsToInsert);

      if (itemsError) {
        throw new Error(`Error al guardar items de la orden: ${itemsError.message}`);
      }

      if (payload.expenses && payload.expenses.length > 0) {
        const expensesToInsert = payload.expenses.map((exp) => ({
          po_id: po.id,
          expense_type: exp.expense_type,
          amount: exp.amount,
          description: exp.description || null,
        }));

        const { error: expError } = await supabase
          .from('purchase_order_expenses')
          .insert(expensesToInsert);

        if (expError) {
          throw new Error(`Error al guardar gastos adicionales: ${expError.message}`);
        }
      }
    } catch (innerError) {
      await supabase.from('purchase_orders').delete().eq('id', po.id);
      throw innerError;
    }

    revalidateAllPurchasePaths();

    return { success: true, data: po as unknown as PurchaseOrder };
  } catch (error: unknown) {
    console.error('Error en createPurchaseOrderAction:', error);
    const msg = error instanceof Error ? error.message : 'Error al crear la orden de compra';
    return { success: false, error: msg };
  }
}

/**
 * Obtener órdenes de compra filtradas por estado desde el backend (Solo Admin).
 */
export async function getPurchaseOrdersByStatusAction(status?: string): Promise<{
  success: boolean;
  data?: PurchaseOrder[];
  error?: string;
}> {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured()) {
      return { success: true, data: [] };
    }

    const supabase = getServiceSupabase();
    let query = supabase
      .from('purchase_orders')
      .select(`
        *,
        supplier:suppliers(*),
        items:purchase_order_items(*, product:products(id, name, brand, sku, type, stock_quantity, base_cost_ars)),
        expenses:purchase_order_expenses(*)
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return { success: true, data: (data || []) as unknown as PurchaseOrder[] };
  } catch (error: unknown) {
    console.error('Error al obtener órdenes de compra:', error);
    const msg = error instanceof Error ? error.message : 'Error al consultar órdenes de compra';
    return { success: false, error: msg };
  }
}

/**
 * Confirmar ingreso / recepción de orden de compra (Solo Admin).
 */
export async function confirmCheckInAction(
  poId: string,
  items: CheckInItemPayload[],
  paymentDetails?: CheckInPaymentDetails
): Promise<{
  success: boolean;
  message?: string;
  warning?: string;
  error?: string;
}> {
  try {
    const adminUser = await requireAdmin();

    if (!isSupabaseConfigured()) {
      return { success: true, message: 'Recepción simulada correctamente' };
    }

    const supabase = getServiceSupabase();

    const { data: po, error: poErr } = await supabase
      .from('purchase_orders')
      .select(`
        id,
        supplier_id,
        status,
        notes,
        created_at,
        suppliers ( name ),
        purchase_order_items (
          id,
          product_id,
          expected_quantity,
          received_quantity,
          unit_cost
        ),
        purchase_order_expenses (
          amount
        )
      `)
      .eq('id', poId)
      .single();

    if (poErr || !po) {
      const errMsg = poErr?.message || `Orden de compra con ID ${poId} no encontrada.`;
      return { success: false, error: errMsg };
    }

    if (po.status === 'received') {
      return { success: false, error: 'Esta orden de compra ya fue ingresada previamente a stock.' };
    }

    if (po.status === 'cancelled') {
      return { success: false, error: 'No se puede ingresar mercadería de una orden de compra cancelada.' };
    }

    const itemsMap = new Map<string, number>();
    if (Array.isArray(items)) {
      items.forEach((it) => {
        const rawQty = String(it.received_quantity ?? '').replace(/^0+/, '');
        const cleanQty = parseInt(rawQty, 10) || 0;
        itemsMap.set(it.item_id, Math.max(0, cleanQty));
      });
    }

    const poItems = po.purchase_order_items || [];
    let totalReceivedUnits = 0;

    const itemsToProcess: Array<{
      poiId: string;
      productId: string;
      receivedQty: number;
      unitCost: number;
    }> = [];

    for (const item of poItems) {
      const receivedQty = itemsMap.has(item.id)
        ? itemsMap.get(item.id)!
        : Number(item.expected_quantity || 0);

      totalReceivedUnits += receivedQty;

      itemsToProcess.push({
        poiId: item.id,
        productId: item.product_id,
        receivedQty,
        unitCost: Number(item.unit_cost || 0),
      });
    }

    if (totalReceivedUnits <= 0) {
      return {
        success: false,
        error: 'Debe confirmar la recepción de al menos 1 unidad para ingresar la orden a stock.',
      };
    }

    const isPaid = paymentDetails ? Boolean(paymentDetails.isPaid) : true;

    let targetAccId: string | null = null;
    let usedAccountName = '';
    if (isPaid) {
      targetAccId = paymentDetails?.treasuryAccountId || null;
      if (!targetAccId) {
        const resAcc = await getTreasuryAccounts();
        if (resAcc.success && resAcc.data && resAcc.data.length > 0) {
          targetAccId = resAcc.data[0].id;
          usedAccountName = resAcc.data[0].account_name;
        }
      } else {
        const { data: accData } = await supabase
          .from('treasury_accounts')
          .select('account_name')
          .eq('id', targetAccId)
          .single();
        if (accData) usedAccountName = accData.account_name;
      }
    }

    const paymentNote = isPaid
      ? `[PAGADO CONTADO: ${usedAccountName || 'Tesorería'}]`
      : `[PENDIENTE CxP - Vence: ${paymentDetails?.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}]`;
    const previousNotes = (po as any).notes;
    const finalNotes = previousNotes ? `${previousNotes} | ${paymentNote}` : paymentNote;

    const { data: rpcData, error: rpcError } = await supabase.rpc('confirm_purchase_order_checkin', {
      p_po_id: poId,
      p_admin_id: adminUser.id,
      p_items: itemsToProcess.map((it) => ({
        poi_id: it.poiId,
        received_qty: it.receivedQty,
      })),
      p_is_paid: isPaid,
      p_treasury_account_id: targetAccId,
      p_due_date: isPaid ? null : paymentDetails?.dueDate || null,
      p_notes: finalNotes,
      p_description: `Pago a Proveedor ${(po.suppliers as any)?.name || 'B2B'} - Orden #${poId.slice(0, 8).toUpperCase()}`,
    });

    if (rpcError) {
      console.error('[CONFIRM_CHECKIN_RPC_ERROR]:', rpcError);
      throw rpcError;
    }

    const rpcRows = (rpcData as unknown as Array<{ o_received_units: number; o_grand_total: number }> | null) || [];
    const receivedUnitsFinal = Number(rpcRows[0]?.o_received_units ?? totalReceivedUnits);
    const grandTotalFinal = Number(rpcRows[0]?.o_grand_total ?? 0);

    revalidateAllPurchasePaths();

    const financialFeedback = isPaid
      ? `Fondos de $${grandTotalFinal.toLocaleString('es-AR')} debitados contablemente de ${usedAccountName || 'Tesorería'}.`
      : `Orden registrada en Cuentas por Pagar (CxP) pendiente de liquidación.`;

    return {
      success: true,
      message: `¡Mercadería ingresada exitosamente! Se sumaron +${receivedUnitsFinal} unidades al stock. ${financialFeedback}`,
    };
  } catch (error: unknown) {
    console.error('Error en confirmCheckInAction:', error);
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as any).message)
        : 'Error inesperado al confirmar ingreso a stock';
    return { success: false, error: msg };
  }
}

export interface RegisterPurchasePaymentInput {
  purchaseId: string;
  treasuryAccountId: string;
  amountPaid?: number;
  currency?: PurchaseCurrency;
  exchangeRate?: number;
  notes?: string;
}

/**
 * Registra un pago (total o parcial) a proveedor sobre una deuda o compra pendiente.
 * Internamente delega a `settleProviderDebtAction`.
 */
export async function registerPurchasePaymentAction(
  role: UserRole,
  input: RegisterPurchasePaymentInput
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    await requireAdmin();

    if (!input.purchaseId || !input.treasuryAccountId) {
      return { success: false, error: 'Debe especificar la deuda/orden y la cuenta de tesorería de origen.' };
    }

    let amountToPay = Number(input.amountPaid || 0);

    if (amountToPay <= 0 && isSupabaseConfigured()) {
      const supabase = getServiceSupabase();
      const { data: ap } = await supabase
        .from('accounts_payable')
        .select('total_amount_ars, paid_amount_ars')
        .or(`id.eq.${input.purchaseId},purchase_id.eq.${input.purchaseId}`)
        .limit(1)
        .maybeSingle();

      if (ap) {
        amountToPay = Math.max(0, Number(ap.total_amount_ars || 0) - Number(ap.paid_amount_ars || 0));
      } else {
        const { data: pur } = await supabase
          .from('purchases')
          .select('total_ars')
          .eq('id', input.purchaseId)
          .maybeSingle();
        if (pur) {
          amountToPay = Number(pur.total_ars || 0);
        }
      }
    }

    const res = await settleProviderDebtAction(role, {
      debt_id: input.purchaseId,
      amount_paid: amountToPay,
      treasury_account_id: input.treasuryAccountId,
      currency: input.currency || 'ARS',
      exchange_rate: input.exchangeRate || 1250,
      notes: input.notes || null,
    } as SettleProviderDebtInput);

    return {
      success: res.success,
      message: res.message,
      error: res.error,
    };
  } catch (error: unknown) {
    console.error('Error en registerPurchasePaymentAction:', error);
    const msg = error instanceof Error ? error.message : 'Error inesperado al registrar pago a proveedor';
    return { success: false, error: msg };
  }
}
