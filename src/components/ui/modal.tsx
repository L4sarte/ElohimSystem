'use client';

import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  className?: string;
  overlayClassName?: string;
}

/**
 * Primitiva accesible de modal estandarizada para toda la aplicación.
 *
 * Incluye de fábrica:
 * - Cierre con tecla Escape.
 * - Bloqueo de scroll del body mientras está montado (overflow: hidden).
 * - Atributos de accesibilidad (role="dialog", aria-modal="true").
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
}: ModalProps) {
  // Cierre con tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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
      role="dialog"
      aria-modal="true"
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto',
        overlayClassName
      )}
    >
      <div
        className={cn(
          'w-full my-auto rounded-2xl border border-erp-border bg-card text-card-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-200',
          maxWidth,
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
