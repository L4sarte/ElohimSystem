'use server';

import { getServiceSupabase } from '@/lib/supabase';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';

export interface OlfactoryFamilyItem {
  id: string;
  name: string;
  description?: string;
}

export interface OlfactoryNoteItem {
  id: string;
  name: string;
  category?: string; // 'Salida' | 'Corazón' | 'Fondo' | 'General'
}

// Catálogo inicial por defecto
const DEFAULT_FAMILIES: string[] = [
  'Amaderada', 'Cítrica', 'Floral', 'Oriental / Ambarada', 
  'Gourmand', 'Fougère', 'Chypre', 'Acuática / Marina', 'Especiada', 'Cuero'
];

const DEFAULT_NOTES: string[] = [
  'Bergamota', 'Vainilla de Madagascar', 'Ámbar', 'Cedro del Líbano', 
  'Pachulí', 'Haba Tonka', 'Rosa de Damasco', 'Jazmín', 'Oudh (Madera de Agar)', 
  'Lavanda', 'Pimienta Negra', 'Cardamomo', 'Canela', 'Vetiver', 'Almizcle', 
  'Cuero', 'Pomelo', 'Iris', 'Mandarina', 'Incienso'
];

/**
 * Obtener todas las familias olfativas registradas.
 */
export async function getOlfactoryFamilies(): Promise<{ success: boolean; data: string[]; error?: string }> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('olfactory_families')
      .select('name')
      .order('name', { ascending: true });

    if (error || !data || data.length === 0) {
      return { success: true, data: DEFAULT_FAMILIES };
    }

    return { success: true, data: data.map(f => f.name) };
  } catch (err: any) {
    return { success: true, data: DEFAULT_FAMILIES };
  }
}

/**
 * Obtener todas las notas olfativas registradas.
 */
export async function getOlfactoryNotes(): Promise<{ success: boolean; data: string[]; error?: string }> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('olfactory_notes_catalog')
      .select('name')
      .order('name', { ascending: true });

    if (error || !data || data.length === 0) {
      return { success: true, data: DEFAULT_NOTES };
    }

    return { success: true, data: data.map(n => n.name) };
  } catch (err: any) {
    return { success: true, data: DEFAULT_NOTES };
  }
}

/**
 * Crear una nueva familia olfativa.
 */
export async function createOlfactoryFamily(role: UserRole, familyName: string): Promise<{ success: boolean; data?: string[]; error?: string }> {
  try {
    if (role !== 'admin') {
      throw new Error('Solo administradores pueden modificar el catálogo olfativo.');
    }

    const trimmed = familyName.trim();
    if (!trimmed) throw new Error('El nombre de la familia no puede estar vacío.');

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from('olfactory_families')
      .insert([{ name: trimmed }]);

    if (error) {
      console.warn('Advertencia al insertar en DB, continuando con catálogo:', error.message);
    }

    revalidatePath('/productos');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al guardar familia olfativa' };
  }
}

/**
 * Crear una nueva nota olfativa.
 */
export async function createOlfactoryNote(role: UserRole, noteName: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (role !== 'admin') {
      throw new Error('Solo administradores pueden modificar el catálogo olfativo.');
    }

    const trimmed = noteName.trim();
    if (!trimmed) throw new Error('El nombre de la nota no puede estar vacío.');

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from('olfactory_notes_catalog')
      .insert([{ name: trimmed }]);

    if (error) {
      console.warn('Advertencia al insertar nota en DB:', error.message);
    }

    revalidatePath('/productos');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al guardar nota olfativa' };
  }
}
