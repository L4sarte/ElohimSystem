'use server';

import { z } from 'zod';
import { getServiceSupabase } from '@/lib/supabase';
import { Product, UserRole, ProductType, DecantAssemblyItem } from '@/types';
import { revalidatePath } from 'next/cache';

// Esquema de validación con Zod para creación y actualización de productos
const productSchema = z.object({
  sku: z.string().min(2, 'El SKU debe tener al menos 2 caracteres').trim().toUpperCase(),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').trim(),
  brand: z.string().min(2, 'La marca debe tener al menos 2 caracteres').trim(),
  type: z.enum(['bottle', 'decant_liquid', 'supply'] as const, {
    message: 'Tipo de producto inválido',
  }),
  batch_code: z.string().optional().or(z.literal('')),
  olfactory_family: z.string().optional().or(z.literal('')),
  olfactory_notes: z.array(z.string()).optional().default([]),
  is_public: z.boolean().optional().default(true),
  min_stock_alert: z.coerce.number().min(0, 'El stock mínimo no puede ser negativo').optional().default(5),
  base_cost_ars: z.coerce.number().min(0, 'El costo base debe ser un número positivo o cero'),
  base_price_ars: z.coerce.number().min(0, 'El precio base debe ser un número positivo o cero'),
  stock_quantity: z.coerce.number().min(0, 'El stock debe ser un número positivo o cero'),
  volume_ml: z.coerce.number().optional().nullable().or(z.literal('')),
});

/**
 * Obtener todos los productos filtrados por rol del usuario.
 * Cumple con Security by Design: el rol 'seller' nunca recibe 'base_cost_ars' desde la base de datos.
 */
export async function getProducts(role: UserRole): Promise<{ success: boolean; data?: Product[]; error?: string }> {
  try {
    const supabase = getServiceSupabase();
    let query;

    if (role === 'admin') {
      // Admin tiene acceso total
      query = supabase.from('products').select('*').order('created_at', { ascending: false });
    } else {
      // Vendedor no tiene acceso a base_cost_ars
      query = supabase
        .from('products')
        .select('id, sku, name, brand, type, batch_code, olfactory_family, olfactory_notes, is_public, min_stock_alert, base_price_ars, stock_quantity, volume_ml, created_at')
        .order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Mapear los datos de vendedor para que contengan base_cost_ars = 0 por compatibilidad de tipos
    const products: Product[] = (data || []).map((item: any) => ({
      ...item,
      base_cost_ars: item.base_cost_ars !== undefined ? Number(item.base_cost_ars) : 0,
      base_price_ars: Number(item.base_price_ars),
      stock_quantity: Number(item.stock_quantity),
      volume_ml: item.volume_ml !== null ? Number(item.volume_ml) : undefined,
    }));

    return { success: true, data: products };
  } catch (error: any) {
    console.error('Error al obtener productos:', error);
    return { success: false, error: error.message || 'Error desconocido al cargar productos' };
  }
}

/**
 * Crear un nuevo producto en la base de datos (Solo Admin)
 */
export async function createProduct(role: UserRole, formData: any): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // Seguridad a nivel de servidor: Rechazar si no es admin
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Se requiere rol de Administrador.');
    }

    // Validar datos recibidos con Zod
    const validatedData = productSchema.parse(formData);

    const supabase = getServiceSupabase();
    
    // Tratamiento para volumen opcional
    const volume = validatedData.volume_ml === '' || validatedData.volume_ml === null || validatedData.volume_ml === undefined 
      ? null 
      : Number(validatedData.volume_ml);

    const insertData = {
      sku: validatedData.sku,
      name: validatedData.name,
      brand: validatedData.brand,
      type: validatedData.type,
      batch_code: validatedData.batch_code || null,
      olfactory_family: validatedData.olfactory_family || null,
      olfactory_notes: validatedData.olfactory_notes || [],
      is_public: validatedData.is_public ?? true,
      min_stock_alert: validatedData.min_stock_alert ?? 5,
      base_cost_ars: validatedData.base_cost_ars,
      base_price_ars: validatedData.base_price_ars,
      stock_quantity: validatedData.stock_quantity,
      volume_ml: volume,
    };

    const { data, error } = await supabase.from('products').insert(insertData).select('id');

    if (error) {
      if (error.code === '23505') {
        throw new Error(`El SKU "${validatedData.sku}" ya está registrado para otro producto.`);
      }
      throw error;
    }

    revalidatePath('/productos');
    return { success: true, id: data && data.length > 0 ? data[0].id : undefined };
  } catch (error: any) {
    console.error('Error al crear producto:', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues.map(e => e.message).join(', ') };
    }
    return { success: false, error: error.message || 'Error desconocido al crear producto' };
  }
}

/**
 * Actualizar un producto existente (Solo Admin)
 */
export async function updateProduct(role: UserRole, id: string, formData: any): Promise<{ success: boolean; error?: string }> {
  try {
    // Seguridad a nivel de servidor: Rechazar si no es admin
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Se requiere rol de Administrador.');
    }

    // Validar datos recibidos con Zod
    const validatedData = productSchema.parse(formData);

    const supabase = getServiceSupabase();

    // Tratamiento para volumen opcional
    const volume = validatedData.volume_ml === '' || validatedData.volume_ml === null || validatedData.volume_ml === undefined 
      ? null 
      : Number(validatedData.volume_ml);

    const updateData = {
      sku: validatedData.sku,
      name: validatedData.name,
      brand: validatedData.brand,
      type: validatedData.type,
      batch_code: validatedData.batch_code || null,
      olfactory_family: validatedData.olfactory_family || null,
      olfactory_notes: validatedData.olfactory_notes || [],
      is_public: validatedData.is_public ?? true,
      min_stock_alert: validatedData.min_stock_alert ?? 5,
      base_cost_ars: validatedData.base_cost_ars,
      base_price_ars: validatedData.base_price_ars,
      stock_quantity: validatedData.stock_quantity,
      volume_ml: volume,
    };

    const { error } = await supabase.from('products').update(updateData).eq('id', id);

    if (error) {
      if (error.code === '23505') {
        throw new Error(`El SKU "${validatedData.sku}" ya está registrado para otro producto.`);
      }
      throw error;
    }

    revalidatePath('/productos');
    return { success: true };
  } catch (error: any) {
    console.error('Error al actualizar producto:', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues.map(e => e.message).join(', ') };
    }
    return { success: false, error: error.message || 'Error desconocido al actualizar producto' };
  }
}

/**
 * Eliminar un producto (Solo Admin)
 */
export async function deleteProduct(role: UserRole, id: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Seguridad a nivel de servidor: Rechazar si no es admin
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Se requiere rol de Administrador.');
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase.from('products').delete().eq('id', id);

    if (error) {
      throw error;
    }

    revalidatePath('/productos');
    return { success: true };
  } catch (error: any) {
    console.error('Error al eliminar producto:', error);
    return { success: false, error: error.message || 'Error desconocido al eliminar producto' };
  }
}

/**
 * Obtener todos los productos tipo 'decant_liquid' (Líquidos a granel).
 */
export async function getDecantLiquids(role: UserRole): Promise<{ success: boolean; data?: Product[]; error?: string }> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('type', 'decant_liquid')
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    const products: Product[] = (data || []).map((item: any) => ({
      ...item,
      base_cost_ars: item.base_cost_ars !== undefined ? Number(item.base_cost_ars) : 0,
      base_price_ars: Number(item.base_price_ars),
      stock_quantity: Number(item.stock_quantity),
      volume_ml: item.volume_ml !== null ? Number(item.volume_ml) : undefined,
    }));

    return { success: true, data: products };
  } catch (error: any) {
    console.error('Error al obtener líquidos de decant:', error);
    return { success: false, error: error.message || 'Error al obtener decants' };
  }
}

/**
 * Fraccionar una botella: resta 1 unidad de la botella y suma p_volume_ml al decant seleccionado.
 * Invoca la función transaccional de base de datos 'fractionate_bottle'.
 */
export async function fractionateBottle(
  role: UserRole,
  bottleId: string,
  decantId: string,
  volumeMl: number
): Promise<{ success: boolean; error?: string }> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Se requiere rol de Administrador.');
    }

    if (!bottleId || !decantId || !volumeMl || volumeMl <= 0) {
      throw new Error('Parámetros de fraccionamiento inválidos.');
    }

    const supabase = getServiceSupabase();
    
    // Llamada al RPC de Supabase que ejecuta la transacción SQL atómica
    const { error } = await supabase.rpc('fractionate_bottle', {
      p_bottle_id: bottleId,
      p_decant_id: decantId,
      p_volume_ml: volumeMl
    });

    if (error) {
      throw error;
    }

    revalidatePath('/productos');
    return { success: true };
  } catch (error: any) {
    console.error('Error al fraccionar botella:', error);
    return { success: false, error: error.message || 'Error al procesar el fraccionamiento en base de datos' };
  }
}

/**
 * Procesa la lógica transaccional JIT para ensamble de decants en el POS.
 * Recibe un lote (array) de ítems a ensamblar y llama a la función RPC 'assemble_decants_batch'.
 * Si algún stock falla, el motor de base de datos hace rollback automático.
 */
export async function prepareDecantSaleTransaction(
  role: UserRole,
  items: DecantAssemblyItem[]
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!items || items.length === 0) {
      throw new Error('No hay ítems para ensamblar.');
    }

    // Validaciones básicas de integridad en el servidor
    for (const item of items) {
      if (!item.decant_liquid_id || !item.supply_id || !item.ml_quantity || item.ml_quantity <= 0) {
        throw new Error('Parámetros de ensamble inválidos en uno de los productos.');
      }
    }

    const supabase = getServiceSupabase();
    
    // Llamamos al RPC transaccional enviando el array JSON
    const { error } = await supabase.rpc('assemble_decants_batch', {
      p_items: items
    });

    if (error) {
      throw error;
    }

    revalidatePath('/productos');
    return { success: true };
  } catch (error: any) {
    console.error('Error en transacción de ensamble JIT:', error);
    return { success: false, error: error.message || 'Error al procesar la venta y ensamble JIT' };
  }
}

/**
 * Alternar la visibilidad pública de un producto (is_public = true/false) para la vidriera digital / link-in-bio.
 */
export async function toggleProductVisibility(
  role: UserRole,
  productId: string,
  isPublic: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Se requiere rol de Administrador.');
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from('products')
      .update({ is_public: isPublic })
      .eq('id', productId);

    if (error) throw error;

    revalidatePath('/productos');
    revalidatePath('/catalogo');
    revalidatePath('/tienda');
    return { success: true };
  } catch (error: any) {
    console.error('Error al cambiar visibilidad pública del producto:', error);
    return { success: false, error: error.message || 'Error al actualizar visibilidad' };
  }
}

/**
 * Obtener únicamente insumos de packaging (type = 'supply') para el panel dedicado de insumos.
 */
export async function getSupplies(role: UserRole): Promise<{ success: boolean; data?: Product[]; error?: string }> {
  try {
    const supabase = getServiceSupabase();
    let query;

    if (role === 'admin') {
      query = supabase
        .from('products')
        .select('*')
        .eq('type', 'supply')
        .order('name', { ascending: true });
    } else {
      query = supabase
        .from('products')
        .select('id, sku, name, brand, type, is_public, min_stock_alert, base_price_ars, stock_quantity, volume_ml, created_at')
        .eq('type', 'supply')
        .order('name', { ascending: true });
    }

    const { data, error } = await query;
    if (error) throw error;

    const list: Product[] = (data || []).map((item: any) => ({
      ...item,
      base_cost_ars: item.base_cost_ars !== undefined ? Number(item.base_cost_ars) : 0,
      base_price_ars: Number(item.base_price_ars || 0),
      stock_quantity: Number(item.stock_quantity || 0),
      volume_ml: item.volume_ml !== null && item.volume_ml !== undefined ? Number(item.volume_ml) : undefined,
    }));

    return { success: true, data: list };
  } catch (error: any) {
    console.error('Error al obtener insumos de packaging:', error);
    return { success: false, error: error.message || 'Error al consultar insumos de packaging' };
  }
}


