'use client';

import React from 'react';
import Link from 'next/link';
import { useCartStore } from '@/hooks/use-cart-store';
import { 
  X, ShoppingBag, Trash2, Plus, Minus, ArrowRight, 
  Sparkles, ShieldCheck, Truck, Droplet, Package 
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CartDrawer() {
  const { 
    items, 
    isDrawerOpen, 
    closeDrawer, 
    updateQuantity, 
    removeItem, 
    getSubtotalArs,
    clearCart
  } = useCartStore();

  const subtotalArs = getSubtotalArs();

  if (!isDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      
      {/* OVERLAY OSCURO CON BACKDROP BLUR */}
      <div 
        onClick={closeDrawer}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      />

      {/* DRAWER CONTENIDO */}
      <div className="relative z-10 flex flex-col w-full max-w-md h-full bg-[#08130E] border-l border-[#1B362A] text-zinc-100 shadow-2xl animate-in slide-in-from-right duration-300">
        
        {/* CABECERA DEL DRAWER */}
        <div className="p-4 sm:p-5 border-b border-[#1B362A] bg-[#13261E] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1B362A] text-[#D0A96B]">
              <ShoppingBag className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-serif uppercase tracking-wider">
                Bolsa de Compras
              </h2>
              <p className="text-[10px] text-zinc-400 font-mono">
                {items.length} {items.length === 1 ? 'producto' : 'productos'} en tu pedido
              </p>
            </div>
          </div>

          <button
            onClick={closeDrawer}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1B362A] transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* LISTADO DE ITEMS */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-[#13261E] border border-[#1B362A] flex items-center justify-center text-zinc-600">
                <ShoppingBag className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Tu carrito está vacío</h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-xs">
                  Explora nuestra colección de perfumes de nicho y decants fraccionados.
                </p>
              </div>
              <Button
                onClick={closeDrawer}
                className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-black text-xs cursor-pointer shadow-lg shadow-[#D0A96B]/20 px-6"
              >
                Explorar Catálogo
              </Button>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-[#13261E] border border-[#1B362A] flex items-center justify-between gap-3 shadow-md group"
              >
                {/* ICONO / THUMBNAIL */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#08130E] border border-[#1B362A] text-[#D0A96B]">
                  {item.format.toLowerCase().includes('decant') ? (
                    <Droplet className="h-6 w-6 text-blue-400" />
                  ) : (
                    <Package className="h-6 w-6 text-[#D0A96B]" />
                  )}
                </div>

                {/* DETALLES */}
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">
                    {item.brand}
                  </div>
                  <div className="text-xs font-bold text-white truncate font-serif">
                    {item.name}
                  </div>
                  <div className="text-[10px] text-[#D0A96B] font-semibold mt-0.5">
                    {item.format} • ${item.priceArs.toLocaleString('es-AR')}
                  </div>
                </div>

                {/* STEPPER DE CANTIDAD & ELIMINAR */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <div className="flex items-center gap-1.5 bg-[#08130E] border border-[#1B362A] rounded-lg p-0.5">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="p-1 text-zinc-400 hover:text-white cursor-pointer"
                      title="Disminuir"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-5 text-center text-xs font-bold font-mono text-white">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      disabled={item.quantity >= item.maxStock}
                      className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                      title="Aumentar"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-[10px] text-zinc-500 hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer"
                    title="Eliminar producto"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Quitar</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* PIE DEL DRAWER: TOTALES & CHECKOUT */}
        {items.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-[#1B362A] bg-[#13261E] space-y-4">
            
            {/* SUBTOTAR ARS */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Subtotal Productos:</span>
                <span className="font-mono font-bold text-white">
                  ${subtotalArs.toLocaleString('es-AR')} ARS
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Modalidad de Envío:</span>
                <span className="text-emerald-400 font-semibold">A coordinar en Checkout</span>
              </div>
              <div className="flex items-center justify-between text-sm pt-2 border-t border-[#1B362A]">
                <span className="font-bold text-white uppercase tracking-wider text-xs">Total Estimado:</span>
                <span className="text-base font-black font-mono text-[#D0A96B]">
                  ${subtotalArs.toLocaleString('es-AR')} ARS
                </span>
              </div>
            </div>

            {/* BOTÓN CHECKOUT */}
            <div className="space-y-2">
              <Link href="/tienda/checkout" onClick={closeDrawer} className="block w-full">
                <Button className="w-full h-11 bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg shadow-[#D0A96B]/20 flex items-center justify-center gap-2">
                  <span>Iniciar Checkout / Comprar</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>

              <button
                onClick={clearCart}
                className="w-full text-center text-[10px] text-zinc-500 hover:text-zinc-300 py-1 transition-colors cursor-pointer"
              >
                Vaciar Carrito
              </button>
            </div>

            {/* GARANTÍAS */}
            <div className="pt-2 flex items-center justify-center gap-4 text-[10px] text-zinc-400 border-t border-[#1B362A]/60">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Compra 100% Segura
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Truck className="h-3.5 w-3.5 text-[#D0A96B]" /> Envíos a todo el país
              </span>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
