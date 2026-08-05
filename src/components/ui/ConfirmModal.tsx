'use client';

import React from 'react';
import { AlertTriangle, Info, ShieldAlert, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const iconMap = {
    danger: <ShieldAlert className="h-6 w-6 text-rose-500" />,
    warning: <AlertTriangle className="h-6 w-6 text-amber-500" />,
    info: <Info className="h-6 w-6 text-indigo-400" />,
    success: <CheckCircle2 className="h-6 w-6 text-emerald-500" />,
  };

  const buttonStyleMap = {
    danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20',
    info: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-md rounded-2xl bg-[#13261E] border border-[#1B362A] p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 text-zinc-100"
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-[#08130E] border border-[#1B362A] shrink-0">
            {iconMap[variant]}
          </div>
          <div className="space-y-1 pr-4">
            <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">{description}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1B362A]">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isLoading}
            className="border-[#1B362A] bg-[#08130E] text-zinc-300 hover:bg-zinc-800 hover:text-white text-xs cursor-pointer"
          >
            {cancelText}
          </Button>

          <Button
            size="sm"
            onClick={onConfirm}
            disabled={isLoading}
            className={`font-bold text-xs shadow-md cursor-pointer ${buttonStyleMap[variant]}`}
          >
            {isLoading ? 'Procesando...' : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
