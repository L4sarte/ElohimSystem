'use client';

import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Selectores de elementos enfocables para la trampa de foco del diálogo.
 * Se filtran en runtime los que estén ocultos (offsetParent) o deshabilitados.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function isFocusableVisible(el: HTMLElement): boolean {
  return el.getClientRects().length > 0;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  className?: string;
  overlayClassName?: string;
  /**
   * id del elemento (título) que nombra el diálogo para lectores de pantalla.
   * Ej: <h3 id="checkout-title">…</h3> + <Modal labelledBy="checkout-title">
   */
  labelledBy?: string;
  /** Nombre accesible directo cuando no hay un título asociable por id. */
  label?: string;
}

/**
 * Primitiva accesible de modal estandarizada para toda la aplicación.
 *
 * Incluye de fábrica:
 * - Cierre con tecla Escape.
 * - Trampa de foco: Tab / Shift+Tab quedan confinados al diálogo (WCAG 2.4.3).
 * - Al abrir, el foco se mueve al primer elemento enfocable (o al panel).
 * - Al cerrar, el foco se restaura al elemento que disparó la apertura.
 * - Bloqueo de scroll del body mientras está montado (overflow: hidden).
 * - Atributos de accesibilidad (role="dialog", aria-modal, nombre accesible
 *   vía `labelledBy` o `label`).
 * - Backdrop y panel integrados con la paleta semántica (bg-card, border-erp-border).
 * - Limpieza de listeners/estilos al desmontar (sin fugas).
 */
export function Modal({
  isOpen,
  onClose,
  children,
  maxWidth = 'max-w-lg',
  className,
  overlayClassName,
  labelledBy,
  label,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Gestión de foco: mover al abrir, restaurar al cerrar
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = (document.activeElement as HTMLElement) ?? null;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(isFocusableVisible);
      (focusables[0] ?? panel).focus();
    } else {
      const trigger = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      // El disparador pudo desmontarse; focus() falla en silencio y no pasa nada.
      trigger?.focus?.();
    }
  }, [isOpen]);

  // Escape + trampa de foco (Tab / Shift+Tab)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(isFocusableVisible);
      if (focusables.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !panel.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Bloqueo de scroll del body
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto',
        overlayClassName
      )}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={label}
        tabIndex={-1}
        className={cn(
          'w-full my-auto rounded-2xl border border-erp-border bg-card text-card-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-200 outline-none',
          maxWidth,
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
