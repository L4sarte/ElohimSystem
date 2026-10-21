'use client';

import React, { useState, memo, useId } from 'react';
import { Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShoppingBag, Droplet, Plus, Sparkles } from 'lucide-react';
import { formatArs } from './pos-formatters';

interface POSProductCardProps {
  product: Product;
  emptyBottles: Product[];
  onAddToCart: (product: Product) => void;
  onAddDecantToCart: (product: Product, ml: number, supplyProduct: Product) => void;
}

function POSProductCardComponent({
  product,
  emptyBottles,
  onAddToCart,
  onAddDecantToCart,
}: POSProductCardProps) {
  const isDecant = product.type === 'decant_liquid';
  const defaultSupplyId = emptyBottles[0]?.id || '';

  // Estado estrictamente local: cambiar ml o envase aquí NO re-renderiza todo el catálogo
  const [decantMl, setDecantMl] = useState<number>(5);
  const [selectedSupplyId, setSelectedSupplyId] = useState<string>(defaultSupplyId);

  const activeSupplyId = selectedSupplyId || defaultSupplyId;
  const activeSupply = emptyBottles.find((b) => b.id === activeSupplyId);
  const supplyPrice = activeSupply ? activeSupply.base_price_ars : 0;
  const sampleTotal = (product.base_price_ars * (decantMl || 5)) + supplyPrice;

  const hasStock = product.stock_quantity > 0;
  const canAssembleDecant = isDecant && hasStock && product.stock_quantity >= decantMl && emptyBottles.length > 0;

  const handleDecantSubmit = () => {
    if (!activeSupply) return;
    onAddDecantToCart(product, decantMl || 5, activeSupply);
  };

  return (
    <div
      className="bg-white dark:bg-erp-surface border border-slate-200 dark:border-erp-border rounded-xl p-4 flex flex-col justify-between shadow-xs hover:border-erp-gold/50 transition-colors duration-150 will-change-auto"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 240px' }}
    >
      <div className="space-y-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-1.5">
            {isDecant ? (
              <span className="p-1 rounded-md bg-blue-500/10 text-blue-400">
                <Droplet className="h-4 w-4" />
              </span>
            ) : (
              <span className="p-1 rounded-md bg-amber-500/10 text-erp-gold">
                <ShoppingBag className="h-4 w-4" />
              </span>
            )}
            <span className="text-[11px] font-bold font-mono text-slate-400 tracking-wider">
              {product.sku}
            </span>
          </div>

          <span
            className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
              hasStock
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
            }`}
          >
            {hasStock
              ? `Stock: ${product.stock_quantity} ${isDecant ? 'ml' : 'uds'}`
              : 'Sin Stock'}
          </span>
        </div>

        <div>
          <h4 className="font-bold text-slate-900 dark:text-white line-clamp-1 text-sm">
            {product.name}
          </h4>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5 truncate">
            Marca: {product.brand}
          </p>
        </div>
      </div>

      {/* ÁREA DE ACCIONES */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-erp-border space-y-3">
        {isDecant ? (
          <div className="space-y-2">
            {/* Selector JIT para decant */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-400">
                  Capacidad (ml)
                </label>
                <Input
                  type="number"
                  min="1"
                  max={Math.max(1, product.stock_quantity)}
                  value={decantMl}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10);
                    setDecantMl(isNaN(parsed) || parsed < 1 ? 1 : parsed);
                  }}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-400">
                  Envase vacío
                </label>
                <select
                  value={activeSupplyId}
                  onChange={(e) => setSelectedSupplyId(e.target.value)}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-xs focus:outline-none dark:border-input/40 dark:bg-input/10 text-white"
                >
                  {emptyBottles.map((bottle) => (
                    <option key={bottle.id} value={bottle.id} className="bg-erp-surface text-white">
                      {bottle.name} ({formatArs(bottle.base_price_ars)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1 bg-blue-50/30 dark:bg-blue-950/20 rounded-lg p-2 text-xs border border-blue-500/10">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-zinc-400">Precio / ml:</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200 font-mono">
                  {formatArs(product.base_price_ars)} ARS
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px] pt-1 border-t border-blue-500/10">
                <span className="text-slate-500 dark:text-zinc-400">Total muestra ({decantMl || 5}ml):</span>
                <span className="font-black text-blue-600 dark:text-blue-400 font-mono">
                  {formatArs(sampleTotal)} ARS
                </span>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleDecantSubmit}
              disabled={!canAssembleDecant}
              className="w-full h-8 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer text-xs font-semibold shadow-xs"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Ensamblar Decant JIT
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] text-slate-400">Precio unitario</div>
              <div className="font-extrabold text-slate-950 dark:text-zinc-50 font-mono text-base">
                {formatArs(product.base_price_ars)}
              </div>
            </div>
            <Button
              type="button"
              disabled={!hasStock}
              onClick={() => onAddToCart(product)}
              className="bg-erp-gold hover:bg-erp-gold-hover text-erp-bg font-extrabold shadow-sm shadow-erp-gold/20 cursor-pointer h-8 text-xs px-3"
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Agregar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export const POSProductCard = memo(POSProductCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.product.stock_quantity === nextProps.product.stock_quantity &&
    prevProps.product.base_price_ars === nextProps.product.base_price_ars &&
    prevProps.product.name === nextProps.product.name &&
    prevProps.emptyBottles === nextProps.emptyBottles &&
    prevProps.onAddToCart === nextProps.onAddToCart &&
    prevProps.onAddDecantToCart === nextProps.onAddDecantToCart
  );
});
