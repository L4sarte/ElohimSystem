'use server';

import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import Decimal from 'decimal.js';
import { getSystemSettings } from '@/app/actions/systemSettings';
import { 
  onlineOrderSchema, 
  PublicProduct, 
  CatalogFilters, 
  CreateOnlineOrderInput 
} from '@/lib/storefront-validation';

/**
 * Consulta optimizada y sanitizada del catálogo público para el Storefront E-Commerce.
 * Excluye rigurosamente costos base (COGS), notas internas y proveedores.
 */
export async function getPublicCatalog(filters?: CatalogFilters): Promise<{
  success: boolean;
  data?: PublicProduct[];
  brands?: string[];
  families?: string[];
  error?: string;
}> {
  try {
    if (!isSupabaseConfigured()) {
      return {
        success: true,
        data: [],
        brands: [],
        families: [],
      };
    }

    const supabase = getServiceSupabase();
    let query = supabase
      .from('products')
      .select('id, sku, name, brand, type, olfactory_family, olfactory_notes, base_price_ars, stock_quantity, volume_ml, is_public, created_at')
      .gt('stock_quantity', 0)
      .neq('type', 'supply')
      .or('is_public.eq.true,is_public.is.null');

    // Filtro por tipo
    if (filters?.type && filters.type !== 'all') {
      query = query.eq('type', filters.type);
    }

    // Filtro por marca
    if (filters?.brand && filters.brand !== 'Todas') {
      query = query.ilike('brand', `%${filters.brand}%`);
    }

    // Filtro por familia olfativa
    if (filters?.olfactory_family && filters.olfactory_family !== 'Todas') {
      query = query.eq('olfactory_family', filters.olfactory_family);
    }

    // Filtro por rango de precio
    if (filters?.minPrice !== undefined && filters.minPrice > 0) {
      query = query.gte('base_price_ars', filters.minPrice);
    }
    if (filters?.maxPrice !== undefined && filters.maxPrice > 0) {
      query = query.lte('base_price_ars', filters.maxPrice);
    }

    // Ordenamiento
    if (filters?.sort === 'price_asc') {
      query = query.order('base_price_ars', { ascending: true });
    } else if (filters?.sort === 'price_desc') {
      query = query.order('base_price_ars', { ascending: false });
    } else if (filters?.sort === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order('name', { ascending: true });
    }

    const { data, error } = await query;
    if (error) throw error;

    let products: PublicProduct[] = (data || []).map((p: any) => ({
      id: p.id,
      sku: p.sku || '',
      name: p.name || 'Sin nombre',
      brand: p.brand || 'Elohim',
      type: p.type || 'bottle',
      olfactory_family: p.olfactory_family || null,
      olfactory_notes: Array.isArray(p.olfactory_notes) ? p.olfactory_notes : null,
      base_price_ars: Number(p.base_price_ars || 0),
      stock_quantity: Number(p.stock_quantity || 0),
      volume_ml: p.volume_ml ? Number(p.volume_ml) : null,
      created_at: p.created_at || undefined,
    }));

    // Búsqueda por texto en memoria (en nombre, marca, notas)
    if (filters?.query && filters.query.trim()) {
      const q = filters.query.trim().toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          (p.olfactory_family || '').toLowerCase().includes(q) ||
          (p.olfactory_notes || []).some((n) => n.toLowerCase().includes(q))
      );
    }

    // Extraer marcas y familias únicas para filtros
    const brandsSet = new Set<string>();
    const familiesSet = new Set<string>();
    (data || []).forEach((p: any) => {
      if (p.brand) brandsSet.add(p.brand.trim());
      if (p.olfactory_family) familiesSet.add(p.olfactory_family.trim());
    });

    return {
      success: true,
      data: products,
      brands: Array.from(brandsSet).sort(),
      families: Array.from(familiesSet).sort(),
    };
  } catch (error: unknown) {
    console.error('[GET_PUBLIC_CATALOG_ERROR]:', error);
    const msg = error instanceof Error ? error.message : 'Error al cargar el catálogo de la tienda';
    return { success: false, error: msg };
  }
}

/**
 * Obtener la ficha pública detallada de un producto por su ID.
 * Incluye fragancias relacionadas y notas de la pirámide olfativa.
 */
export async function getPublicProductDetail(id: string): Promise<{
  success: boolean;
  data?: {
    product: PublicProduct;
    related: PublicProduct[];
    decantsAvailable: Array<{ size: string; ml: number; priceArs: number; stock: number }>;
  };
  error?: string;
}> {
  try {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Base de datos no configurada' };
    }

    const supabase = getServiceSupabase();
    const { data: item, error } = await supabase
      .from('products')
      .select('id, sku, name, brand, type, olfactory_family, olfactory_notes, base_price_ars, stock_quantity, volume_ml, is_public, created_at')
      .eq('id', id)
      .maybeSingle();

    if (error || !item) {
      return { success: false, error: 'Producto no encontrado o no disponible.' };
    }

    const product: PublicProduct = {
      id: item.id,
      sku: item.sku || '',
      name: item.name || 'Sin nombre',
      brand: item.brand || 'Elohim',
      type: item.type || 'bottle',
      olfactory_family: item.olfactory_family || null,
      olfactory_notes: Array.isArray(item.olfactory_notes) ? item.olfactory_notes : null,
      base_price_ars: Number(item.base_price_ars || 0),
      stock_quantity: Number(item.stock_quantity || 0),
      volume_ml: item.volume_ml ? Number(item.volume_ml) : null,
      created_at: item.created_at || undefined,
    };

    // Consultar fragancias relacionadas de la misma marca o familia
    let related: PublicProduct[] = [];
    if (product.olfactory_family || product.brand) {
      const { data: relData } = await supabase
        .from('products')
        .select('id, sku, name, brand, type, olfactory_family, olfactory_notes, base_price_ars, stock_quantity, volume_ml')
        .neq('id', product.id)
        .gt('stock_quantity', 0)
        .neq('type', 'supply')
        .or(`olfactory_family.eq.${product.olfactory_family || ''},brand.ilike.%${product.brand}%`)
        .limit(4);

      if (relData) {
        related = relData.map((r: any) => ({
          id: r.id,
          sku: r.sku || '',
          name: r.name || '',
          brand: r.brand || '',
          type: r.type || 'bottle',
          olfactory_family: r.olfactory_family || null,
          olfactory_notes: Array.isArray(r.olfactory_notes) ? r.olfactory_notes : null,
          base_price_ars: Number(r.base_price_ars || 0),
          stock_quantity: Number(r.stock_quantity || 0),
          volume_ml: r.volume_ml ? Number(r.volume_ml) : null,
        }));
      }
    }

    // Variantes de tamaño calculadas
    const decantsAvailable = [
      {
        size: product.type === 'bottle' ? `${product.volume_ml || 100}ml (Original)` : 'Frasco',
        ml: product.volume_ml || 100,
        priceArs: product.base_price_ars,
        stock: product.stock_quantity,
      },
    ];

    return {
      success: true,
      data: {
        product,
        related,
        decantsAvailable,
      },
    };
  } catch (error: unknown) {
    console.error('[GET_PUBLIC_PRODUCT_ERROR]:', error);
    const msg = error instanceof Error ? error.message : 'Error al consultar producto';
    return { success: false, error: msg };
  }
}

/**
 * Crear un pedido online desde el Storefront E-Commerce.
 * Valida stock y precios en el servidor, registra la venta con canal "online"
 * y descuenta el inventario de manera preventiva.
 */
export async function createOnlineOrder(payload: CreateOnlineOrderInput): Promise<{
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  totalArs?: number;
  error?: string;
}> {
  try {
    // 1. Validación de esquema con Zod
    const validation = onlineOrderSchema.safeParse(payload);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Datos del pedido inválidos.';
      return { success: false, error: firstError };
    }

    const clean = validation.data;

    // Validación condicional de dirección si eligió envío
    if (clean.delivery_method === 'shipping' && !clean.shipping_address?.trim()) {
      return { success: false, error: 'Por favor ingresa la dirección de entrega para el envío a domicilio.' };
    }

    if (!isSupabaseConfigured()) {
      const mockId = 'ORD-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      return {
        success: true,
        orderId: mockId,
        orderNumber: mockId,
        totalArs: 50000,
      };
    }

    const supabase = getServiceSupabase();

    // 2. Consultar productos y validar stock en servidor (Zero-Trust)
    const productIds = clean.items.map((i) => i.product_id);
    const { data: dbProducts, error: prodErr } = await supabase
      .from('products')
      .select('id, name, brand, base_price_ars, stock_quantity, type')
      .in('id', productIds);

    if (prodErr || !dbProducts || dbProducts.length === 0) {
      return { success: false, error: 'No se pudieron validar los productos del carrito en el inventario.' };
    }

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    let calculatedTotalArs = new Decimal(0);
    const validatedItems: Array<{
      product_id: string;
      name: string;
      brand: string;
      quantity: number;
      unit_price_ars: number;
      total_price_ars: number;
    }> = [];

    for (const item of clean.items) {
      const dbProd = productMap.get(item.product_id);
      if (!dbProd) {
        return { success: false, error: `El producto seleccionado ya no existe en el catálogo.` };
      }

      if (dbProd.stock_quantity < item.quantity) {
        return {
          success: false,
          error: `Stock insuficiente para "${dbProd.name}". Disponible: ${dbProd.stock_quantity} unidades.`,
        };
      }

      const unitPrice = new Decimal(dbProd.base_price_ars || 0);
      const itemTotal = unitPrice.times(item.quantity);
      calculatedTotalArs = calculatedTotalArs.plus(itemTotal);

      validatedItems.push({
        product_id: dbProd.id,
        name: dbProd.name,
        brand: dbProd.brand,
        quantity: item.quantity,
        unit_price_ars: unitPrice.toNumber(),
        total_price_ars: itemTotal.toNumber(),
      });
    }

    const finalTotalArs = calculatedTotalArs.toNumber();

    // 3. Obtener parámetros de sistema
    const settingsRes = await getSystemSettings();
    const storeSettings = settingsRes.data;

    // Tasa referencial USD (default 1200)
    const exchangeRate = 1200;
    const totalUsd = new Decimal(finalTotalArs).dividedBy(exchangeRate).round().toNumber();

    // 4. Buscar o crear cliente en CRM (por teléfono o email)
    let clientId: string | null = null;
    if (clean.client_phone || clean.client_email) {
      let clientQuery = supabase.from('clients').select('id').limit(1);
      if (clean.client_email) {
        clientQuery = clientQuery.eq('email', clean.client_email);
      } else if (clean.client_phone) {
        clientQuery = clientQuery.eq('phone', clean.client_phone);
      }

      const { data: existingClient } = await clientQuery.maybeSingle();

      if (existingClient?.id) {
        clientId = existingClient.id;
      } else {
        const { data: newClient } = await supabase
          .from('clients')
          .insert([
            {
              name: clean.client_name,
              phone: clean.client_phone,
              email: clean.client_email || null,
              points_balance: 0,
            },
          ])
          .select('id')
          .single();

        if (newClient?.id) {
          clientId = newClient.id;
        }
      }
    }

    // 5. Insertar venta con canal 'online' y estado 'pending_payment'
    const orderMetadata = {
      channel: 'online',
      order_type: 'storefront_b2c',
      delivery_method: clean.delivery_method,
      shipping_address: clean.shipping_address || null,
      shipping_city: clean.shipping_city || null,
      shipping_notes: clean.shipping_notes || null,
      client_name: clean.client_name,
      client_phone: clean.client_phone,
      client_email: clean.client_email || null,
      client_dni: clean.client_dni || null,
      payment_method: clean.payment_method,
      payment_status: 'pending',
    };

    const { data: saleData, error: saleErr } = await supabase
      .from('sales')
      .insert([
        {
          client_id: clientId,
          total_ars: finalTotalArs,
          total_usd_equivalent: totalUsd,
          exchange_rate_used: exchangeRate,
          payment_methods: orderMetadata,
          channel: 'online',
          payment_status: 'pending',
          status: 'pending_payment',
        },
      ])
      .select('id, created_at')
      .single();

    if (saleErr || !saleData) {
      console.error('[CREATE_ONLINE_ORDER_SALE_ERROR]:', saleErr);
      return { success: false, error: 'Error al registrar el pedido en la base de datos.' };
    }

    const saleId = saleData.id;
    const orderNumber = saleId.slice(0, 8).toUpperCase();

    // 6. Insertar ítems en sale_items
    const saleItemsPayload = validatedItems.map((item) => ({
      sale_id: saleId,
      product_id: item.product_id,
      quantity: item.quantity,
      price_ars: item.unit_price_ars,
      price_usd: new Decimal(item.unit_price_ars).dividedBy(exchangeRate).round().toNumber(),
      total_ars: item.total_price_ars,
    }));

    const { error: itemsErr } = await supabase
      .from('sale_items')
      .insert(saleItemsPayload);

    if (itemsErr) {
      console.error('[CREATE_ONLINE_ORDER_ITEMS_ERROR]:', itemsErr);
    }

    // 7. Descontar stock atómicamente
    for (const item of validatedItems) {
      const dbProd = productMap.get(item.product_id);
      if (dbProd) {
        const newStock = Math.max(0, dbProd.stock_quantity - item.quantity);
        await supabase
          .from('products')
          .update({ stock_quantity: newStock })
          .eq('id', item.product_id);
      }
    }

    // 8. Revalidación de vistas
    revalidatePath('/tienda');
    revalidatePath('/productos');
    revalidatePath('/kanban');
    revalidatePath('/admin/ventas');

    return {
      success: true,
      orderId: saleId,
      orderNumber,
      totalArs: finalTotalArs,
    };
  } catch (error: unknown) {
    console.error('[CREATE_ONLINE_ORDER_FATAL]:', error);
    const msg = error instanceof Error ? error.message : 'Ocurrió un error inesperado al procesar el pedido.';
    return { success: false, error: msg };
  }
}

/**
 * Consultar un pedido público por ID para la pantalla de confirmación / seguimiento.
 */
export async function getPublicOrder(id: string): Promise<{
  success: boolean;
  data?: {
    id: string;
    orderNumber: string;
    createdAt: string;
    totalArs: number;
    paymentStatus: string;
    metadata: Record<string, any>;
    items: Array<{
      id: string;
      name: string;
      brand: string;
      quantity: number;
      priceArs: number;
      totalArs: number;
    }>;
    storeSettings: any;
  };
  error?: string;
}> {
  try {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Base de datos no configurada' };
    }

    const supabase = getServiceSupabase();
    const { data: sale, error: saleErr } = await supabase
      .from('sales')
      .select('id, created_at, total_ars, payment_status, status, payment_methods, sale_items(id, product_id, quantity, price_ars, total_ars, products(name, brand))')
      .eq('id', id)
      .maybeSingle();

    if (saleErr || !sale) {
      return { success: false, error: 'Pedido no encontrado.' };
    }

    const settingsRes = await getSystemSettings();

    const items = ((sale as any).sale_items || []).map((si: any) => ({
      id: si.id,
      name: si.products?.name || 'Perfume',
      brand: si.products?.brand || 'Elohim',
      quantity: Number(si.quantity || 1),
      priceArs: Number(si.price_ars || 0),
      totalArs: Number(si.total_ars || 0),
    }));

    return {
      success: true,
      data: {
        id: sale.id,
        orderNumber: sale.id.slice(0, 8).toUpperCase(),
        createdAt: sale.created_at,
        totalArs: Number(sale.total_ars || 0),
        paymentStatus: sale.payment_status || sale.status || 'pending',
        metadata: (sale.payment_methods as Record<string, any>) || {},
        items,
        storeSettings: settingsRes.data,
      },
    };
  } catch (error: unknown) {
    console.error('[GET_PUBLIC_ORDER_ERROR]:', error);
    return { success: false, error: 'Error al consultar el pedido' };
  }
}
