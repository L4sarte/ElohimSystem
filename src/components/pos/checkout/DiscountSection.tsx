'use client';

import React from 'react';
import { UserRole } from '@/types';
import { Input } from '@/components/ui/input';
import { AlertCircle, Tag } from 'lucide-react';
import {
  DiscountType,
  DiscountCalculationResult,
  convertDiscountValueBetweenModes
} from '@/lib/discount-calculations';

interface DiscountSectionProps {
  role: UserRole;
  discountType: DiscountType;
  discountInputValue: string;
  onTypeChange: (mode: DiscountType) => void;
  onInputValueChange: (value: string) => void;
  discountResult: DiscountCalculationResult;
  isSellerOverLimit: boolean;
  isBelowCogs: boolean;
  subtotalOriginalArs: number;
  subtotalAfterDiscountArs: number;
  totalCartCogs: number;
}

/**
 * Sección de Ajuste de Precio / Descuentos en el checkout POS:
 * pills responsivas de modos, botones rápidos de porcentaje, input condicional
 * según el modo, validaciones del motor, tope de vendedor y resumen en vivo.
 */
export function DiscountSection({
  role,
  discountType,
  discountInputValue,
  onTypeChange,
  onInputValueChange,
  discountResult,
  isSellerOverLimit,
  isBelowCogs,
  subtotalOriginalArs,
  subtotalAfterDiscountArs,
  totalCartCogs,
}: DiscountSectionProps) {
  const handleModeChange = (newMode: DiscountType) => {
    if (newMode === discountType) return;
    if (newMode === 'none') {
      onTypeChange('none');
      onInputValueChange('');
      return;
    }

    const converted = convertDiscountValueBetweenModes(
      discountResult,
      newMode,
      subtotalOriginalArs
    );
    onTypeChange(newMode);
    onInputValueChange(converted);
  };

  const handleQuickPercent = (pct: number) => {
    onTypeChange('percentage');
    onInputValueChange(pct.toString());
  };

  return (
    <div className="rounded-xl bg-erp-bg border border-erp-border p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-erp-gold">
          <Tag className="h-3.5 w-3.5" />
          <span>Ajuste de Precio / Descuento</span>
        </div>
        {role !== 'admin' ? (
          <span className="text-[11px] font-semibold text-zinc-400 bg-erp-surface px-2 py-0.5 rounded border border-erp-border">
            Tope vendedor: 20%
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-erp-gold bg-erp-gold/10 px-2 py-0.5 rounded border border-erp-gold/30">
            Administrador (Sin tope)
          </span>
        )}
      </div>

      {/* SELECTOR DE MODOS (Pills / Segmented Control) */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-1 bg-erp-surface p-1 rounded-lg border border-erp-border text-[11px] font-medium">
        <button
          type="button"
          onClick={() => handleModeChange('none')}
          className={`py-1 rounded text-center transition-all cursor-pointer ${
            discountType === 'none'
              ? 'bg-erp-gold text-erp-bg font-bold shadow-sm'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Sin desc.
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('percentage')}
          className={`py-1 rounded text-center transition-all cursor-pointer ${
            discountType === 'percentage'
              ? 'bg-erp-gold text-erp-bg font-bold shadow-sm'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Desc. %
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('fixed')}
          className={`py-1 rounded text-center transition-all cursor-pointer ${
            discountType === 'fixed'
              ? 'bg-erp-gold text-erp-bg font-bold shadow-sm'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Desc. $
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('target_amount')}
          className={`py-1 rounded text-center transition-all cursor-pointer ${
            discountType === 'target_amount'
              ? 'bg-erp-gold text-erp-bg font-bold shadow-sm'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Cobrar $
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('target_percentage')}
          className={`py-1 rounded text-center transition-all cursor-pointer ${
            discountType === 'target_percentage'
              ? 'bg-erp-gold text-erp-bg font-bold shadow-sm'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Cobrar %
        </button>
      </div>

      {/* BOTONES RÁPIDOS DE PORCENTAJE (CHIPS) */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] text-zinc-400 font-mono">Rápidos:</span>
        {[5, 10, 15, 20, 25].map((pct) => {
          const isExceedingSeller = role !== 'admin' && pct > 20;
          return (
            <button
              key={pct}
              type="button"
              onClick={() => handleQuickPercent(pct)}
              disabled={isExceedingSeller}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
                discountType === 'percentage' && Number(discountInputValue) === pct
                  ? 'bg-erp-gold text-erp-bg'
                  : isExceedingSeller
                  ? 'bg-erp-surface/40 text-zinc-600 border border-zinc-800 cursor-not-allowed'
                  : 'bg-erp-surface text-zinc-300 hover:text-white hover:bg-secondary border border-erp-border'
              }`}
              title={isExceedingSeller ? 'Excede el límite del 20% para vendedores' : `Aplicar ${pct}%`}
            >
              {pct}%
            </button>
          );
        })}
        {discountType !== 'none' && (
          <button
            type="button"
            onClick={() => handleModeChange('none')}
            className="text-[11px] text-rose-400 hover:text-rose-300 ml-auto underline cursor-pointer"
          >
            Quitar descuento
          </button>
        )}
      </div>

      {/* INPUT CONDICIONAL SEGÚN EL MODO SELECCIONADO */}
      {discountType !== 'none' && (
        <div className="space-y-1.5">
          <div className="relative">
            <span className="absolute left-3 top-2 text-xs font-bold text-zinc-400">
              {discountType === 'percentage' && '% Descuento:'}
              {discountType === 'fixed' && '$ Descuento:'}
              {discountType === 'target_amount' && '$ Cobrar:'}
              {discountType === 'target_percentage' && '% Cobrar:'}
            </span>
            <Input
              type="number"
              step={discountType === 'percentage' || discountType === 'target_percentage' ? '0.1' : '1'}
              min="0"
              max={discountType === 'percentage' || discountType === 'target_percentage' ? '100' : subtotalOriginalArs.toString()}
              value={discountInputValue}
              onChange={(e) => onInputValueChange(e.target.value)}
              placeholder={
                discountType === 'percentage'
                  ? 'Ej. 10'
                  : discountType === 'fixed'
                  ? 'Ej. 5000'
                  : discountType === 'target_amount'
                  ? `Ej. ${Math.round(subtotalOriginalArs * 0.9)}`
                  : 'Ej. 90'
              }
              className="pl-28 bg-erp-surface border-erp-border text-white font-mono font-bold text-sm h-8"
            />
          </div>

          {/* ERROR DE VALIDACIÓN DEL MOTOR O TOPE DE VENDEDOR */}
          {(!discountResult.isValid || isSellerOverLimit) && (
            <div className="text-[11px] text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20 font-medium">
              {isSellerOverLimit
                ? `⚠️ Límite superado: Los vendedores solo pueden aplicar hasta un 20% de descuento (solicitado: ${discountResult.discountPercentage}%). Se requiere autorización de un Administrador.`
                : discountResult.errorMessage}
            </div>
          )}

          {/* ALERTA DE MARGEN NEGATIVO (SUBTOTAL < COGS) */}
          {isBelowCogs && (
            <div className="text-[11px] text-amber-400 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20 font-medium flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>
                ⚠️ <strong>Alerta de Margen:</strong> El precio final (${subtotalAfterDiscountArs.toLocaleString('es-AR')}) está por debajo del costo de reposición estimado (${Math.round(totalCartCogs).toLocaleString('es-AR')}).
              </span>
            </div>
          )}

          {/* RESUMEN EN TIEMPO REAL DEL DESCUENTO */}
          {discountResult.isValid && discountResult.discountAmountArs > 0 && !isSellerOverLimit && (
            <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-erp-surface/60 border border-erp-border text-[11px] font-mono">
              <div>
                <span className="text-zinc-500 block text-xs uppercase">Descuento</span>
                <span className="text-emerald-400 font-bold">
                  -${discountResult.discountAmountArs.toLocaleString('es-AR')}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block text-xs uppercase">Equiv. %</span>
                <span className="text-emerald-400 font-bold">
                  {discountResult.discountPercentage}%
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block text-xs uppercase">Nuevo Subtotal</span>
                <span className="text-white font-bold">
                  ${subtotalAfterDiscountArs.toLocaleString('es-AR')}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
