import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Determina si una URL de imagen puede pasar por el optimizador de next/image.
 * Solo los hosts allowlisteados en next.config.ts (Supabase Storage) se optimizan;
 * las URLs legacy de otros hosts se renderizan sin optimizar para no romper nada.
 */
export function canOptimizeImageUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return (
      host === "supabase.co" ||
      host.endsWith(".supabase.co") ||
      host.endsWith(".supabase.in")
    )
  } catch {
    return false
  }
}
