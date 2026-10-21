'use client';

import React, { useMemo } from 'react';
import { usePosStore, CartItem } from '@/hooks/use-pos-store';
import { Button } from '@/components/ui/button';
import { ShoppingCart, X } from 'lucide-react';
import { POSCartItemRow } from './POSCartItemRow';
import { formatArsDec, formatUsd } from './pos-formatters';

interface POSCartPanelProps {
  exchangeRate: number | null;
  onOpenCheckout: () => void;
  isMobileExpanded?: boolean;
  onToggleMobileExpanded?: (expanded: boolean) => void;
  variant: 'desktop' | 'mobile_drawer' | 'mobile_bar';
}

function calculateItemTotal(item: CartItem): number {
  if (item.product.type === 'decant_liquid' && item.decantMl) {
    const supplyPrice = Number(item.selectedSupplyPrice ?? 0);
    const unitDecantPrice = (item.product.base_price_ars * item.decantMl) + supplyPrice;
    return item.quantity * unitDecantPrice;
  }
  return item.quantity * item.product.base_price_ars;
}

export function POSCartPanel({
  exchangeRate,
  onOpenCheckout,
  isMobileExpanded = false,
  onToggleMobileExpanded,
  variant,
}: POSCartPanelProps) {
  const cart = usePosStore((state) => state.cart);
  const removeItem = usePosStore((state) => state.removeItem);
  const updateQuantity = usePosStore((state) => state.updateQuantity);
  const clearCart = usePosStore((state) => state.clearCart);

  // Cálculos memoizados
  const totalItemsCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const cartTotalArs = useMemo(() => {
    return cart.reduce((total, item) => total + calculateItemTotal(item), 0);
  }, [cart]);

  const cartTotalUsd = useMemo(() => {
    return exchangeRate && exchangeRate > 0 ? cartTotalArs / exchangeRate : 0;
  }, [cartTotalArs, exchangeRate]);

  // Contenido de la lista del carrito
  const cartItemsList = (
    cart.length === 0 ? (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2.5 py-12">
        <ShoppingCart className="h-10 w-10 opacity-30 text-erp-gold" />
        <span className="text-sm font-medium">El carrito está vacío</span>
        <p className="text-[11px] text-slate-400 max-w-[180px] text-center">
          Selecciona productos o escanea un código para comenzar.
        </p>
      </div>
    ) : (
      cart.map((item) => (
        <POSCartItemRow
          key={item.key}
          item={item}
          onRemove={removeItem}
          onUpdateQuantity={updateQuantity}
        />
      ))
    )
  );

  // 1. Barra inferior móvil colapsada
  if (variant === 'mobile_bar') {
    return (
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        <button
          type="button"
          onClick={() => onToggleMobileExpanded?.(true)}
          className="flex items-center gap-2 text-left cursor-pointer min-w-0"
          aria-label="Abrir detalle del carrito"
        >
          <span className="text-xs bg-slate-200 dark:bg-zinc-800 px-2 py-0.5 rounded-full font-bold text-slate-900 dark:text-zinc-100 shrink-0">
            {totalItemsCount} ítems
          </span>
          <span className="text-sm font-black font-mono text-slate-950 dark:text-zinc-50 truncate">
            {formatArsDec(cartTotalArs)}
          </span>
          <span className="text-[11px] text-slate-400 shrink-0">Ver detalle</span>
        </button>
        <Button
          type="button"
          onClick={onOpenCheckout}
          disabled={cart.length === 0}
          className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white font-bold text-xs cursor-pointer h-9 px-4 shrink-0 shadow-sm"
        >
          Cobrar Orden
        </Button>
      </div>
    );
  }

  // 2. Drawer móvil expandido
  if (variant === 'mobile_drawer') {
    return (
      <div className="max-h-[60dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-erp-border sticky top-0 bg-white dark:bg-erp-bg z-10">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
            <ShoppingCart className="h-4 w-4 text-erp-gold" />
            Detalle del Carrito
          </h3>
          <button
            type="button"
            onClick={() => onToggleMobileExpanded?.(false)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg cursor-pointer"
            aria-label="Cerrar detalle del carrito"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {cartItemsList}
        </div>

        <div className="border-t border-slate-100 dark:border-erp-border p-3 px-4 flex items-center justify-between gap-3 sticky bottom-0 bg-white dark:bg-erp-bg">
          <div className="min-w-0">
            <span className="block text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
              {formatUsd(cartTotalUsd)}
            </span>
            <span className="block text-base font-black text-slate-950 dark:text-zinc-50 font-mono truncate">
              {formatArsDec(cartTotalArs)}
            </span>
          </div>
          <Button
            type="button"
            onClick={onOpenCheckout}
            disabled={cart.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white font-bold text-xs cursor-pointer h-9 px-4 shrink-0 shadow-sm"
          >
            Cobrar Orden
          </Button>
        </div>
      </div>
    );
  }

  // 3. Panel Desktop lateral
  return (
    <div className="bg-white dark:bg-erp-surface border border-slate-200 dark:border-erp-border rounded-xl flex flex-col justify-between h-[calc(100dvh-8.5rem)] max-lg:hidden shadow-xs overflow-hidden">
      
      {/* HEADER */}
      <div className="border-b border-slate-100 dark:border-erp-border p-4 bg-slate-50/50 dark:bg-erp-surface/50 flex items-center justify-between">
        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm font-serif">
          <ShoppingCart className="h-4.5 w-4.5 text-erp-gold" />
          Detalle del Carrito
        </h3>
        <span className="text-xs bg-slate-200 dark:bg-zinc-800 px-2 py-0.5 rounded-full font-bold font-mono text-zinc-300">
          {totalItemsCount} ítems
        </span>
      </div>

      {/* LISTA DE ITEMS VIRTUAL/SCROLL */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 overscroll-contain">
        {cartItemsList}
      </div>

      {/* FOOTER TOTAL Y ACCIONES */}
      <div className="border-t border-slate-100 dark:border-erp-border p-4 bg-slate-50/50 dark:bg-erp-surface/50 space-y-4">
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-500 dark:text-zinc-400 font-mono">
            <span>Subtotal Ref. USD:</span>
            <span className="font-semibold text-slate-800 dark:text-zinc-200">
              {formatUsd(cartTotalUsd)}
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-bold text-slate-900 dark:text-white">Total Venta:</span>
            <div className="text-right">
              <div className="text-xl font-black text-slate-950 dark:text-zinc-50 font-mono">
                {formatArsDec(cartTotalArs)}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={clearCart}
            disabled={cart.length === 0}
            className="w-full text-xs cursor-pointer h-9 flex items-center justify-center gap-1.5 border-erp-border text-zinc-300 hover:bg-zinc-800"
            title="Vaciar carrito (Atajo: F8)"
          >
            <span>Vaciar</span>
            <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-erp-bg border border-slate-200 dark:border-erp-border text-[10px] font-mono opacity-75">
              F8
            </kbd>
          </Button>

          <Button
            type="button"
            onClick={onOpenCheckout}
            disabled={cart.length === 0}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer h-9 shadow-sm shadow-emerald-900/30 flex items-center justify-center gap-1.5"
            title="Abrir ventana de cobro (Atajo: F4)"
          >
            <span>Cobrar Orden</span>
            <kbd className="px-1 py-0.5 rounded bg-emerald-700/60 border border-emerald-400/30 text-[10px] font-mono text-emerald-100">
              F4
            </kbd>
          </Button>
        </div>
      </div>

    </div>
  );
}
