'use server';

import { getServiceSupabase } from '@/lib/supabase';
import { UserRole, Product } from '@/types';
import { getProducts } from '@/app/actions/products';

export interface OlfactoryMatchResult {
  product: Product;
  matchingNotes: string[];
  allNotes: string[];
  matchScore: number;
  isDecantLiquid: boolean;
}

// Diccionario por defecto de notas olfativas según la familia del perfume
const DEFAULT_FAMILY_NOTES: Record<string, string[]> = {
  'Cítrico': ['Bergamota', 'Limón', 'Mandarina', 'Pomelo', 'Neroli'],
  'Amaderado': ['Sándalo', 'Cedro', 'Vetiver', 'Oud', 'Pachulí'],
  'Gourmand': ['Vainilla', 'Caramelo', 'Cacao', 'Habas Tonka', 'Almendra'],
  'Floral': ['Jazmín', 'Rosa', 'Flor de Azahar', 'Violeta', 'Ylang-Ylang'],
  'Oriental': ['Ámbar', 'Especias', 'Canela', 'Incienso', 'Vainilla'],
  'Cuero': ['Cuero', 'Tabaco', 'Gamuza', 'Humo', 'Abedul'],
  'Aromático': ['Lavanda', 'Salvia', 'Romero', 'Menta', 'Tomillo'],
  'Especiado': ['Pimienta Negra', 'Cardamomo', 'Nuez Moscada', 'Clavo', 'Canela']
};

/**
 * Algoritmo de Match Olfativo del CRM.
 * Cruza las notas preferidas del cliente con los productos activos en stock,
 * priorizando mover líquidos a granel (type === 'decant_liquid').
 */
export async function getOlfactoryMatchForClient(
  role: UserRole,
  clientId: string
): Promise<{
  success: boolean;
  data?: OlfactoryMatchResult[];
  preferredNotes?: string[];
  clientName?: string;
  error?: string;
}> {
  try {
    const supabase = getServiceSupabase();

    // 1. Obtener cliente y sus notas preferidas
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, preferred_notes')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      throw new Error('No se encontró el perfil del cliente.');
    }

    const preferredNotes: string[] = Array.isArray(client.preferred_notes) ? client.preferred_notes : [];

    if (preferredNotes.length === 0) {
      return {
        success: true,
        data: [],
        preferredNotes: [],
        clientName: client.name
      };
    }

    // 2. Obtener productos del catálogo
    const productsRes = await getProducts(role);
    if (!productsRes.success || !productsRes.data) {
      throw new Error(productsRes.error || 'Error al consultar productos');
    }

    // 3. Filtrar estrictamente productos con stock > 0
    const inStockProducts = productsRes.data.filter(p => Number(p.stock_quantity || 0) > 0);

    const matches: OlfactoryMatchResult[] = [];

    // 4. Calcular el match olfativo para cada producto
    inStockProducts.forEach(product => {
      let notes: string[] = [];
      if (Array.isArray(product.olfactory_notes) && product.olfactory_notes.length > 0) {
        notes = product.olfactory_notes;
      } else if (product.olfactory_family && DEFAULT_FAMILY_NOTES[product.olfactory_family]) {
        notes = DEFAULT_FAMILY_NOTES[product.olfactory_family];
      } else {
        notes = ['Vainilla', 'Bergamota', 'Cedro'];
      }

      // Encontrar coincidencias (case-insensitive)
      const matchingNotes = notes.filter(note =>
        preferredNotes.some(pn => pn.toLowerCase().trim() === note.toLowerCase().trim())
      );

      if (matchingNotes.length > 0) {
        matches.push({
          product,
          matchingNotes,
          allNotes: notes,
          matchScore: matchingNotes.length,
          isDecantLiquid: product.type === 'decant_liquid'
        });
      }
    });

    // 5. ORDENAMIENTO ESTRATÉGICO:
    // Prioridad 1: Productos tipo 'decant_liquid' (Líquidos a granel)
    // Prioridad 2: Cantidad de notas coincidentes de mayor a menor
    matches.sort((a, b) => {
      if (a.isDecantLiquid && !b.isDecantLiquid) return -1;
      if (!a.isDecantLiquid && b.isDecantLiquid) return 1;
      return b.matchScore - a.matchScore;
    });

    return {
      success: true,
      data: matches,
      preferredNotes,
      clientName: client.name
    };
  } catch (error: any) {
    console.error('Error al calcular Match Olfativo:', error);
    return { success: false, error: error.message || 'Error en algoritmo de match olfativo' };
  }
}

/**
 * Obtener el historial completo de VibePoints ganados o canjeados por un cliente.
 */
export async function getClientPointsHistory(
  role: UserRole,
  clientId: string
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('client_points_history')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error al consultar historial de puntos:', error);
    return { success: false, error: error.message || 'Error al obtener historial de VibePoints' };
  }
}

