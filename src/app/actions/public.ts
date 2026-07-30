'use server';

import { getServiceSupabase } from '@/lib/supabase';
import { Product } from '@/types';

/**
 * Obtener productos públicos para la vidriera digital B2C (/catalogo o /tienda).
 * Filtra los productos donde is_public = true y stock_quantity > 0.
 * Acceso público sin requerir sesión ni rol.
 */
export async function getPublicCatalog(): Promise<{
  success: boolean;
  data?: Product[];
  error?: string;
}> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('products')
      .select('id, sku, name, brand, type, batch_code, olfactory_family, olfactory_notes, is_public, base_price_ars, stock_quantity, volume_ml, created_at')
      .gt('stock_quantity', 0)
      .neq('type', 'supply') // Excluir insumos vacíos de la vidriera pública
      .or('is_public.eq.true,is_public.is.null')
      .order('name', { ascending: true });

    if (error) throw error;

    const list: Product[] = (data || []).map((item: any) => ({
      ...item,
      base_cost_ars: 0, // Ocultar costo base por seguridad en API pública
      base_price_ars: Number(item.base_price_ars || 0),
      stock_quantity: Number(item.stock_quantity || 0),
      volume_ml: item.volume_ml ? Number(item.volume_ml) : undefined
    }));

    return { success: true, data: list };
  } catch (error: any) {
    console.error('Error al obtener catálogo público:', error);
    return { success: false, error: error.message || 'Error al cargar catálogo público' };
  }
}
