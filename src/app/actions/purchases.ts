'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserRole } from '@/types';
import { CreatePOPayload, PurchaseOrder, CheckInItemPayload } from '@/types/supplyChain';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth-checks';
import { purchaseInputSchema } from '@/lib/purchase-validation';

export interface PurchaseItemInput {
  product_id: string;
  quantity: number;
  unit_cost_ars: number;
}

export interface PurchaseInput {
  supplier_id: string;
  admin_id?: string;
  total_ars: number;
  total_usd: number;
  payment_status: 'paid' | 'unpaid';
  due_date?: string | null;
  items: PurchaseItemInput[];
}

export interface PurchaseRecord {
  id: string;
  total_ars: number;
  total_usd: number;
  status: string;
  payment_status: string;
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
    products?: {
      id: string;
      name: string;
      brand: string;
      sku: string;
    } | null;
  }>;
}

export interface AccountPayableRecord {
  id: string;
  total_amount_ars: number;
  paid_amount_ars: number;
  due_date?: string | null;
  status: string;
  created_at: string;
  suppliers?: {
    id: string;
    name: string;
  } | null;
  purchases?: {
    id: string;
    created_at: string;
    total_ars: number;
  } | null;
}

/**
 * Procesar una nueva compra B2B registrando el ingreso de stock e inventario mediante RPC transaccional (Solo Admin).
 */
export async function submitPurchase(
  role: UserRole,
  purchaseData: PurchaseInput
): Promise<{ success: boolean; purchaseId?: string; error?: string }> {
  try {
    const adminUser = await requireAdmin();

    const validation = purchaseInputSchema.safeParse(purchaseData);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Datos de compra inválidos.';
      return { success: false, error: firstError };
    }

    const clean = validation.data;

    if (!isSupabaseConfigured()) {
      return { success: true, purchaseId: 'mock-po-' + Math.random().toString(36).substring(2, 7) };
    }

    const serviceClient = getServiceSupabase();

    // Formatear la fecha de vencimiento (null si está pagada o no se especifica)
    const formattedDueDate = clean.payment_status === 'unpaid' && clean.due_date
      ? clean.due_date
      : null;

    // Invocar la función RPC transaccional en Supabase
    const { data, error } = await serviceClient.rpc('register_purchase_transaction', {
      p_supplier_id: clean.supplier_id,
      p_admin_id: adminUser.id,
      p_total_ars: clean.total_ars,
      p_total_usd: clean.total_usd,
      p_payment_status: clean.payment_status,
      p_due_date: formattedDueDate,
      p_items: clean.items,
    });

    if (error) {
      throw error;
    }

    // Revalidar cachés de rutas dependientes
    revalidatePath('/productos');
    revalidatePath('/compras');
    revalidatePath('/compras/nueva');
    revalidatePath('/compras/proveedores');
    revalidatePath('/');

    return { success: true, purchaseId: data as string };
  } catch (error: unknown) {
    console.error('Error al registrar transacción de compra:', error);
    const msg = error instanceof Error ? error.message : 'Error al procesar la compra';
    return { success: false, error: msg };
  }
}

/**
 * Obtener historial de compras registradas (Solo Admin).
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
        id,
        total_ars,
        total_usd,
        status,
        payment_status,
        created_at,
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
            sku
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return { success: true, data: (data || []) as unknown as PurchaseRecord[] };
  } catch (error: unknown) {
    console.error('Error al obtener compras:', error);
    const msg = error instanceof Error ? error.message : 'Error al recuperar compras';
    return { success: false, error: msg };
  }
}

/**
 * Obtener listado de Cuentas por Pagar (Accounts Payable) (Solo Admin).
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
        id,
        total_amount_ars,
        paid_amount_ars,
        due_date,
        status,
        created_at,
        suppliers (
          id,
          name
        ),
        purchases (
          id,
          created_at,
          total_ars
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return { success: true, data: (data || []) as unknown as AccountPayableRecord[] };
  } catch (error: unknown) {
    console.error('Error al obtener cuentas por pagar:', error);
    const msg = error instanceof Error ? error.message : 'Error al recuperar cuentas por pagar';
    return { success: false, error: msg };
  }
}

/**
 * Crear una Orden de Compra (B2B Supply Chain) de forma atómica en el backend.
 * Omite RLS usando getServiceSupabase() tras validar privilegios de administrador.
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

    // 1. Insertar Cabecera de PO
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
      // 2. Insertar Items de Mercadería
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

      // 3. Insertar Gastos Adicionales si existen
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
      // Rollback lógico si falla la inserción de ítems o gastos
      await supabase.from('purchase_orders').delete().eq('id', po.id);
      throw innerError;
    }

    revalidatePath('/compras');
    revalidatePath('/productos');
    revalidatePath('/');

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
        items:purchase_order_items(*, product:products(id, name, brand, sku, stock_quantity, base_cost_ars)),
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
 * Realiza la recepción de forma atómica y consistente directamente con Service Supabase:
 * 1. Actualiza received_quantity en purchase_order_items.
 * 2. Prorratea gastos logísticos/aduaneros en el costo unitario landed.
 * 3. Incrementa el stock_quantity de cada perfume (bottle) o insumo (supply) en la tabla products.
 * 4. Recalcula el Costo Promedio Ponderado (PPP) de reposición (base_cost_ars).
 * 5. Actualiza el estado de la orden a 'received' y recalcula grand_total.
 * 6. Revalida todas las rutas de inventario, compras y kardex.
 */
export async function confirmCheckInAction(
  poId: string,
  items: CheckInItemPayload[]
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured()) {
      return { success: true, message: 'Recepción simulada correctamente' };
    }

    const supabase = getServiceSupabase();

    // 1. Obtener la orden de compra con sus items y gastos asociados
    const { data: po, error: poErr } = await supabase
      .from('purchase_orders')
      .select(`
        id,
        status,
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

    // 2. Mapeo y saneamiento de cantidades recibidas enviadas por el frontend
    const itemsMap = new Map<string, number>();
    if (Array.isArray(items)) {
      items.forEach((it) => {
        const rawQty = String(it.received_quantity ?? '').replace(/^0+/, '');
        const cleanQty = parseInt(rawQty, 10) || 0;
        itemsMap.set(it.item_id, Math.max(0, cleanQty));
      });
    }

    // 3. Gastos asociados totales
    const expensesList = po.purchase_order_expenses || [];
    const totalExpenses = expensesList.reduce((sum: number, exp: any) => sum + Number(exp.amount || 0), 0);

    // 4. Procesar ítems y calcular unidades totales recibidas
    const poItems = po.purchase_order_items || [];
    let totalReceivedUnits = 0;
    let totalMerchandiseCost = 0;

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
      totalMerchandiseCost += receivedQty * Number(item.unit_cost || 0);

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

    // Gasto logístico prorrateado por cada unidad que ingresa
    const expensePerUnit = totalExpenses > 0 ? totalExpenses / totalReceivedUnits : 0;

    // 5. Actualizar received_quantity en purchase_order_items
    for (const it of itemsToProcess) {
      const { error: poiUpdateErr } = await supabase
        .from('purchase_order_items')
        .update({ received_quantity: it.receivedQty })
        .eq('id', it.poiId);

      if (poiUpdateErr) {
        console.error('Error al actualizar purchase_order_items:', poiUpdateErr);
        return {
          success: false,
          error: `Error al actualizar cantidades de la orden: ${poiUpdateErr.message}`,
        };
      }
    }

    // 6. Incrementar stock y recalcular Costo Promedio Ponderado (PPP) en products
    for (const it of itemsToProcess) {
      if (it.receivedQty <= 0) continue;

      const { data: product, error: prodErr } = await supabase
        .from('products')
        .select('id, name, type, stock_quantity, base_cost_ars')
        .eq('id', it.productId)
        .single();

      if (prodErr || !product) {
        console.error(`Producto ID ${it.productId} no encontrado al recibir stock:`, prodErr);
        continue;
      }

      const currentStock = Number(product.stock_quantity || 0);
      const currentCost = Number(product.base_cost_ars || 0);
      const newStock = currentStock + it.receivedQty;

      // Costo landed unitario (costo proveedor + flete/gasto prorrateado)
      const landedUnitCost = it.unitCost + expensePerUnit;

      // Cálculo del nuevo Costo Promedio Ponderado (Weighted Average Cost)
      let newAverageCost = landedUnitCost;
      if (newStock > 0) {
        newAverageCost = ((currentStock * currentCost) + (it.receivedQty * landedUnitCost)) / newStock;
      }
      newAverageCost = Math.round(newAverageCost * 100) / 100;

      // Actualizar tabla products (compatible tanto con perfumes bottle como insumos supply)
      const { error: updateProdErr } = await supabase
        .from('products')
        .update({
          stock_quantity: newStock,
          base_cost_ars: newAverageCost,
        })
        .eq('id', it.productId);

      if (updateProdErr) {
        console.error(`Error actualizando stock de producto ${product.name}:`, updateProdErr);
        return {
          success: false,
          error: `Error actualizando stock de ${product.name}: ${updateProdErr.message}`,
        };
      }
    }

    // 7. Actualizar la orden purchase_orders a 'received'
    const grandTotal = totalMerchandiseCost + totalExpenses;

    const { error: updatePoErr } = await supabase
      .from('purchase_orders')
      .update({
        status: 'received',
        total_expenses: totalExpenses,
        grand_total: grandTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', poId);

    if (updatePoErr) {
      console.error('Error al actualizar estado de purchase_orders:', updatePoErr);
      return {
        success: false,
        error: `Error al actualizar estado de la orden: ${updatePoErr.message}`,
      };
    }

    // 8. Revalidar rutas clave del sistema
    revalidatePath('/compras');
    revalidatePath('/productos');
    revalidatePath('/admin/inventario/kardex');
    revalidatePath('/admin/inventario/insumos');
    revalidatePath('/admin/proveedores');
    revalidatePath('/');

    return {
      success: true,
      message: `¡Mercadería ingresada exitosamente! Se sumaron +${totalReceivedUnits} unidades al stock disponible con costo landed actualizado.`,
    };
  } catch (error: unknown) {
    console.error('Error en confirmCheckInAction:', error);
    const msg = error instanceof Error 
      ? error.message 
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as any).message)
        : 'Error inesperado al confirmar ingreso a stock';
    return { success: false, error: msg };
  }
}
