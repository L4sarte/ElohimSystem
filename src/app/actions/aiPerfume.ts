'use server';

import { UserRole } from '@/types';

export interface ExtractedPerfumeData {
  notas_salida: string[];
  notas_corazon: string[];
  notas_fondo: string[];
  acordes_principales: string[];
  estilo: string;
  familia_olfativa: string;
}

export interface ExtractPerfumeResponse {
  success: boolean;
  data?: ExtractedPerfumeData;
  error?: string;
}

/**
 * Server Action para extraer notas olfativas y estilo de perfumes a partir de texto crudo de Fragrantica.
 * Procesa estructuras de texto en español e inglés y devuelve un objeto JSON estructurado.
 */
export async function extractPerfumeData(
  role: UserRole,
  rawText: string
): Promise<ExtractPerfumeResponse> {
  try {
    if (role !== 'admin') {
      throw new Error('Operación no autorizada. Se requiere rol de Administrador.');
    }

    if (!rawText || rawText.trim().length < 5) {
      throw new Error('El texto ingresado es demasiado corto para extraer datos olfativos.');
    }

    const text = rawText.trim();

    // 1. Algoritmo de Extracción Estructurada NTL / Regex Avanzado para Fragrantica (Español & Inglés)
    const result: ExtractedPerfumeData = {
      notas_salida: [],
      notas_corazon: [],
      notas_fondo: [],
      acordes_principales: [],
      estilo: 'Elegante & Sofisticado',
      familia_olfativa: 'Amaderado'
    };

    // --- A. EXTRAER NOTAS DE SALIDA (Top Notes) ---
    const salidaRegex = /(?:notas?\s+de?\s+salida|top\s+notes?|salida|cabeza)[:\s]+([^.\n;]+)/i;
    const salidaMatch = text.match(salidaRegex);
    if (salidaMatch && salidaMatch[1]) {
      result.notas_salida = parseNotesList(salidaMatch[1]);
    }

    // --- B. EXTRAER NOTAS DE CORAZÓN / MEDIAS (Heart / Middle Notes) ---
    const corazonRegex = /(?:notas?\s+de?\s+coraz[oó]n|middle\s+notes?|heart\s+notes?|coraz[oó]n|medio)[:\s]+([^.\n;]+)/i;
    const corazonMatch = text.match(corazonRegex);
    if (corazonMatch && corazonMatch[1]) {
      result.notas_corazon = parseNotesList(corazonMatch[1]);
    }

    // --- C. EXTRAER NOTAS DE FONDO (Base Notes) ---
    const fondoRegex = /(?:notas?\s+de?\s+fondo|base\s+notes?|fondo)[:\s]+([^.\n;]+)/i;
    const fondoMatch = text.match(fondoRegex);
    if (fondoMatch && fondoMatch[1]) {
      result.notas_fondo = parseNotesList(fondoMatch[1]);
    }

    // --- D. EXTRAER ACORDES PRINCIPALES (Main Accords) ---
    const acordesRegex = /(?:acordes?\s+principales?|main\s+accords?|acordes)[:\s]+([^.\n;]+)/i;
    const acordesMatch = text.match(acordesRegex);
    if (acordesMatch && acordesMatch[1]) {
      result.acordes_principales = parseNotesList(acordesMatch[1]);
    }

    // --- E. FALLBACK INTELIGENTE SI NO SE DETECTAN ETIQUETAS EXPLÍCITAS ---
    if (result.notas_salida.length === 0 && result.notas_corazon.length === 0 && result.notas_fondo.length === 0) {
      // Buscar lista general de notas olfativas mencionadas
      const commonPerfumeNotes = [
        'Bergamota', 'Limón', 'Mandarina', 'Naranja', 'Pomelo', 'Pimienta Rosa', 'Cardamomo', 'Lavanda',
        'Piña', 'Manzana Verde', 'Grosellas Negras', 'Jazmín', 'Rosa', 'Iris', 'Violeta', 'Flor de Azahar',
        'Vainilla', 'Pachulí', 'Ámbar', 'Sándalo', 'Cedro', 'Almizcle', 'Cuero', 'Tabaco', 'Haba Tonka',
        'Oakmoss', 'Musgo de Roble', 'Vetiver', 'Incienso', 'Benjuí', 'Mirra', 'Canela'
      ];

      const foundNotes: string[] = [];
      commonPerfumeNotes.forEach(note => {
        if (new RegExp(`\\b${note}\\b`, 'i').test(text)) {
          foundNotes.push(note);
        }
      });

      if (foundNotes.length > 0) {
        result.notas_salida = foundNotes.slice(0, 3);
        result.notas_corazon = foundNotes.slice(3, 6);
        result.notas_fondo = foundNotes.slice(6);
      }
    }

    // --- F. DETERMINAR FAMILIA OLFATIVA Y ESTILO SUGERIDO ---
    const lowerText = text.toLowerCase();
    if (lowerText.includes('amaderad') || lowerText.includes('woody') || lowerText.includes('cedro') || lowerText.includes('sándalo')) {
      result.familia_olfativa = 'Amaderado';
      result.estilo = 'Amaderado Elegante';
    } else if (lowerText.includes('cítric') || lowerText.includes('citrus') || lowerText.includes('bergamot') || lowerText.includes('limón')) {
      result.familia_olfativa = 'Cítrico';
      result.estilo = 'Fresco Cítrico Veraniego';
    } else if (lowerText.includes('vainilla') || lowerText.includes('gourmand') || lowerText.includes('dulce') || lowerText.includes('tonka')) {
      result.familia_olfativa = 'Gourmand';
      result.estilo = 'Gourmand Cálido Nocturno';
    } else if (lowerText.includes('oriental') || lowerText.includes('ámbar') || lowerText.includes('amber') || lowerText.includes('especiad')) {
      result.familia_olfativa = 'Oriental';
      result.estilo = 'Oriental Especiado Exótico';
    } else if (lowerText.includes('cuero') || lowerText.includes('leather')) {
      result.familia_olfativa = 'Cuero';
      result.estilo = 'Cuero Intenso Masculino';
    } else if (lowerText.includes('floral') || lowerText.includes('rose') || lowerText.includes('jazmín')) {
      result.familia_olfativa = 'Floral';
      result.estilo = 'Floral Sofisticado';
    } else if (lowerText.includes('aromátic') || lowerText.includes('lavanda') || lowerText.includes('fougère')) {
      result.familia_olfativa = 'Aromático';
      result.estilo = 'Aromático Fougère Moderno';
    }

    return {
      success: true,
      data: result
    };
  } catch (error: any) {
    console.error('Error al extraer datos olfativos con IA:', error);
    return {
      success: false,
      error: error.message || 'Error al procesar el texto olfativo'
    };
  }
}

/**
 * Convierte un fragmento de texto separado por comas, guiones o saltos en un array limpio de cadenas.
 */
function parseNotesList(input: string): string[] {
  return input
    .split(/[,;\n/–—]/)
    .map(s => s.replace(/^y\s+/i, '').replace(/[\.\(\)]/g, '').trim())
    .filter(s => s.length > 1);
}
