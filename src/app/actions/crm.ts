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

export interface ClientMatchRecommendation {
  clientId?: string;
  clientName: string;
  clientPhone?: string;
  previousPerfumeName: string;
  matchingNotes: string[];
  matchScore: number;
  whatsAppMessage: string;
  whatsAppUrl: string;
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
 * Algoritmo de Recomendaciones Inteligentes para Lanzamientos / Nuevos Ingresos (Hot Leads CRM).
 * Cruza el nuevo producto ingresado con el historial de ventas para detectar qué clientes
 * compraron previamente perfumes que comparten al menos 2 notas olfativas similares.
 * Genera automáticamente un mensaje de campaña personalizado para WhatsApp Web.
 */
export async function matchNewArrivalsToClients(
  role: UserRole,
  newProductId: string
): Promise<{
  success: boolean;
  newProduct?: Product;
  recommendations?: ClientMatchRecommendation[];
  error?: string;
}> {
  try {
    const supabase = getServiceSupabase();

    // 1. Obtener producto objetivo
    const { data: targetProduct, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .eq('id', newProductId)
      .single();

    if (prodErr || !targetProduct) {
      throw new Error('Producto de lanzamiento no encontrado.');
    }

    const newNotes: string[] = Array.isArray(targetProduct.olfactory_notes) && targetProduct.olfactory_notes.length > 0
      ? targetProduct.olfactory_notes
      : (targetProduct.olfactory_family && DEFAULT_FAMILY_NOTES[targetProduct.olfactory_family] ? DEFAULT_FAMILY_NOTES[targetProduct.olfactory_family] : ['Vainilla', 'Bergamota', 'Cedro']);

    // 2. Obtener el historial de ventas con productos comprados y clientes asociados mediante JOIN relacional
    const { data: salesItems, error: salesErr } = await supabase
      .from('sale_items')
      .select(`
        quantity,
        sale_id,
        sales!inner (
          created_at,
          client_id,
          clients (
            id,
            name,
            phone
          )
        ),
        products!inner (
          id,
          name,
          brand,
          olfactory_family,
          olfactory_notes
        )
      `)
      .not('products', 'is', null);

    if (salesErr) throw salesErr;

    // 3. Procesar y agrupar por cliente
    const clientMatchesMap = new Map<string, {
      clientName: string;
      clientPhone?: string;
      previousPerfumeName: string;
      matchingNotes: Set<string>;
      matchScore: number;
    }>();

    (salesItems || []).forEach(item => {
      const sale = item.sales as any;
      const product = item.products as any;
      const client = sale?.clients as any;

      // Fallback de protección: omitir si no hay datos de cliente o si el cliente fue eliminado
      if (!sale || !client || !client.name || !product || product.id === newProductId) return;

      const clientName = client.name.trim();
      const clientPhone = client.phone || '';
      const boughtNotes: string[] = Array.isArray(product.olfactory_notes) && product.olfactory_notes.length > 0
        ? product.olfactory_notes
        : (product.olfactory_family && DEFAULT_FAMILY_NOTES[product.olfactory_family] ? DEFAULT_FAMILY_NOTES[product.olfactory_family] : []);

      // Calcular coincidencias olfativas con el nuevo producto
      const sharedNotes = boughtNotes.filter(bn =>
        newNotes.some(nn => nn.toLowerCase().trim() === bn.toLowerCase().trim())
      );

      // Si comparte notas o la misma familia olfativa
      const sameFamily = product.olfactory_family && targetProduct.olfactory_family &&
        product.olfactory_family.toLowerCase() === targetProduct.olfactory_family.toLowerCase();

      if (sharedNotes.length >= 1 || sameFamily) {
        const key = clientName.toLowerCase();
        const existing = clientMatchesMap.get(key);

        const currentNotes = existing ? existing.matchingNotes : new Set<string>();
        sharedNotes.forEach(sn => currentNotes.add(sn));

        const score = currentNotes.size + (sameFamily ? 1 : 0);

        if (!existing || score > existing.matchScore) {
          clientMatchesMap.set(key, {
            clientName,
            clientPhone,
            previousPerfumeName: product.name,
            matchingNotes: currentNotes,
            matchScore: score
          });
        }
      }
    });

    // 4. Convertir mapa a array y construir mensajes de WhatsApp personalizados
    const recommendations: ClientMatchRecommendation[] = [];

    clientMatchesMap.forEach(val => {
      const notesList = Array.from(val.matchingNotes);
      const notesFormatted = notesList.length > 0 ? notesList.join(', ') : (targetProduct.olfactory_family || 'notas especiadas');

      const messageText = `Hola ${val.clientName}! 👋 Vimos que compraste ${val.previousPerfumeName} y nos acordamos de vos. Acaba de ingresar a Elohim Import el nuevo ${targetProduct.name} de ${targetProduct.brand}, que comparte notas olfativas de ${notesFormatted}. ¡Tenemos decants disponibles para que lo pruebes! ¿Te reservamos uno? 🛍️✨`;

      let rawPhone = val.clientPhone ? val.clientPhone.replace(/\D/g, '') : '';
      if (rawPhone && !rawPhone.startsWith('54')) {
        rawPhone = '549' + rawPhone;
      }
      const whatsAppUrl = rawPhone ? `https://wa.me/${rawPhone}?text=${encodeURIComponent(messageText)}` : `https://wa.me/?text=${encodeURIComponent(messageText)}`;

      recommendations.push({
        clientName: val.clientName,
        clientPhone: val.clientPhone,
        previousPerfumeName: val.previousPerfumeName,
        matchingNotes: notesList,
        matchScore: val.matchScore,
        whatsAppMessage: messageText,
        whatsAppUrl
      });
    });

    // Ordenar de mayor coincidencia a menor
    recommendations.sort((a, b) => b.matchScore - a.matchScore);

    return {
      success: true,
      newProduct: targetProduct,
      recommendations
    };
  } catch (error: any) {
    console.error('Error al generar recomendaciones de lanzamientos:', error);
    return { success: false, error: error.message || 'Error al procesar recomendaciones.' };
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
