'use client';

import React, { memo } from 'react';
import { CartItem } from '@/hooks/use-pos-store';
import { Button } from '@/components/ui/button';
import { Minus, Plus, Trash2, Droplet, Archive } from 'lucide-react';
import { formatArs } from './pos-formatters';

interface POSCartItemRowProps {
  item: CartItem;
  onRemove: (key: string) => void;
  onUpdateQuantity: (key: string, qty: number) => void;
}

function calculateItemTotal(item: CartItem): number {
  if (item.product.type === 'decant_liquid' && item.decantMl) {
    const supplyPrice = Number(item.selectedSupplyPrice ?? 0);
    const unitDecantPrice = (item.product.base_price_ars * item.decantMl) + supplyPrice;
    return item.quantity * unitDecantPrice;
  }
  return item.quantity * item.product.base_price_ars;
}

function POSCartItemRowComponent({
  item,
  onRemove,
  onUpdateQuantity,
}: POSCartItemRowProps) {
  const itemTotal = calculateItemTotal(item);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-100 dark:border-erp-border bg-slate-50/50 dark:bg-erp-surface/40 p-3 relative">
      <button
        type="button"
        onClick={() => onRemove(item.key)}
        className="absolute top-2 right-2 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer p-0.5"
        title="Remover"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <div>
        <h5 className="font-bold text-xs text-slate-900 dark:text-zinc-100 pr-5 truncate">
          {item.product.name}
        </h5>
        <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
          SKU: {item.product.sku}
        </p>

        {item.product.type === 'decant_liquid' && item.decantMl && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-bold text-blue-800 dark:bg-blue-500/10 dark:text-blue-400">
              <Droplet className="h-2.5 w-2.5" /> JIT: {item.decantMl} ml
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-500/10 dark:text-amber-400 truncate max-w-[140px]">
              <Archive className="h-2.5 w-2.5" /> {item.selectedSupplyName}
            </span>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-1 pt-1.5 border-t border-slate-100 dark:border-erp-border">
        {/* Selector de cantidad */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => onUpdateQuantity(item.key, item.quantity - 1)}
            className="h-6 w-6 rounded border border-slate-200 dark:border-erp-border cursor-pointer hover:bg-zinc-800"
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-8 text-center text-xs font-mono font-bold">
            {item.quantity}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => onUpdateQuantity(item.key, item.quantity + 1)}
            className="h-6 w-6 rounded border border-slate-200 dark:border-erp-border cursor-pointer hover:bg-zinc-800"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        {/* Total del ítem */}
        <div className="text-right font-mono font-bold text-xs text-slate-900 dark:text-zinc-100">
          {formatArs(itemTotal)} ARS
        </div>
      </div>
    </div>
  );
}

export const POSCartItemRow = memo(POSCartItemRowComponent);
