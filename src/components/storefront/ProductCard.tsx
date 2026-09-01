'use client';

import React from 'react';
import Link from 'next/link';
import { PublicProduct } from '@/lib/storefront-validation';
import { useCartStore } from '@/hooks/use-cart-store';
import { 
  ShoppingBag, Droplet, Sparkles, ArrowUpRight, 
  Check, Flame, Heart, Package 
} from 'lucide-react';
import { toast } from 'sonner';

interface ProductCardProps {
  product: PublicProduct;
  exchangeRate?: number;
}

export function ProductCard({ product, exchangeRate = 1200 }: ProductCardProps) {
  const { addItem } = useCartStore();

  const isDecant = product.type === 'decant_liquid';
  const formatLabel = isDecant ? 'Decant Fraccionado' : `${product.volume_ml || 100}ml (Original)`;
  const priceUsd = (product.base_price_ars / exchangeRate).toFixed(1);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (product.stock_quantity <= 0) {
      toast.error('Producto sin stock disponible.');
      return;
    }

    addItem({
      productId: product.id,
      name: product.name,
      brand: product.brand,
      format: formatLabel,
      priceArs: product.base_price_ars,
      quantity: 1,
      maxStock: product.stock_quantity,
      sku: product.sku,
    });

    toast.success(`¡"${product.name}" agregado a tu bolsa de compras!`);
  };

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl bg-[#13261E] border border-[#1B362A] hover:border-[#D0A96B]/60 p-4 sm:p-5 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-[#D0A96B]/5">
      
      <div>
        {/* CABECERA DE LA CARD: BADGES DE FORMATO Y STOCK */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
            isDecant 
              ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' 
              : 'bg-[#D0A96B]/15 text-[#E5C158] border border-[#D0A96B]/30'
          }`}>
            {isDecant ? <Droplet className="h-3 w-3" /> : <Package className="h-3 w-3" />}
            <span>{isDecant ? 'Decant' : 'Sellado'}</span>
          </span>

          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
            product.stock_quantity <= 3
              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          }`}>
            {product.stock_quantity <= 3 ? `¡Últimas ${product.stock_quantity} ud!` : 'Disponible'}
          </span>
        </div>

        {/* CONTENEDOR VISUAL DECORATIVO */}
        <Link href={`/tienda/producto/${product.id}`} className="block">
          <div className="relative aspect-square w-full rounded-xl bg-gradient-to-br from-[#1B362A]/60 to-[#08130E] border border-[#1B362A] flex items-center justify-center p-6 mb-4 overflow-hidden group-hover:scale-[1.02] transition-transform">
            <div className="flex flex-col items-center justify-center text-center space-y-2">
              <div className="h-16 w-16 rounded-full bg-[#13261E] border border-[#D0A96B]/30 flex items-center justify-center text-[#D0A96B] shadow-lg group-hover:border-[#D0A96B] transition-colors">
                {isDecant ? (
                  <Droplet className="h-8 w-8 text-blue-400" />
                ) : (
                  <Package className="h-8 w-8 text-[#D0A96B]" />
                )}
              </div>
              <span className="text-[10px] font-mono text-zinc-400 tracking-widest uppercase">
                {product.volume_ml ? `${product.volume_ml} ML` : 'NICHE PERFUME'}
              </span>
            </div>

            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="h-7 w-7 rounded-full bg-[#D0A96B] text-[#08130E] flex items-center justify-center shadow-md">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
          </div>
        </Link>

        {/* INFO DEL PRODUCTO */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#D0A96B] font-mono">
            {product.brand}
          </div>

          <Link href={`/tienda/producto/${product.id}`} className="block">
            <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-[#D0A96B] transition-colors font-serif line-clamp-1">
              {product.name}
            </h3>
          </Link>

          {/* FAMILIA Y NOTAS */}
          {product.olfactory_family && (
            <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 pt-0.5">
              <Sparkles className="h-3 w-3 text-amber-400 shrink-0" />
              <span className="truncate">{product.olfactory_family}</span>
            </div>
          )}

          {product.olfactory_notes && product.olfactory_notes.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {product.olfactory_notes.slice(0, 3).map((note, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 rounded bg-[#08130E] border border-[#1B362A] text-[9px] text-zinc-300 font-mono"
                >
                  {note}
                </span>
              ))}
              {product.olfactory_notes.length > 3 && (
                <span className="text-[9px] text-zinc-500 font-mono self-center">
                  +{product.olfactory_notes.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* FOOTER DE LA CARD: PRECIO Y BOTÓN AGREGAR */}
      <div className="pt-4 mt-4 border-t border-[#1B362A] flex items-center justify-between gap-2">
        <div>
          <div className="text-base sm:text-lg font-black font-mono text-white">
            ${product.base_price_ars.toLocaleString('es-AR')}
          </div>
          <div className="text-[10px] font-mono text-zinc-400">
            ~ u$s {priceUsd}
          </div>
        </div>

        <button
          onClick={handleQuickAdd}
          disabled={product.stock_quantity <= 0}
          className="px-3.5 py-2 rounded-xl bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#D0A96B]/20 transition-all disabled:opacity-40"
          title="Agregar al Carrito"
        >
          <ShoppingBag className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Agregar</span>
        </button>
      </div>

    </div>
  );
}
