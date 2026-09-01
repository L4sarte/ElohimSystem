'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PublicProduct } from '@/lib/storefront-validation';
import { SystemSettingsData, DEFAULT_SYSTEM_SETTINGS } from '@/lib/settings-validation';
import { StorefrontHeader } from './StorefrontHeader';
import { StorefrontFooter } from './StorefrontFooter';
import { CartDrawer } from './CartDrawer';
import { ProductCard } from './ProductCard';
import { useCartStore } from '@/hooks/use-cart-store';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, ShoppingBag, Droplet, Package, Sparkles, 
  ShieldCheck, Truck, MessageCircle, Check, Plus, Minus, Share2 
} from 'lucide-react';
import { toast } from 'sonner';

interface ProductDetailClientProps {
  product: PublicProduct;
  related: PublicProduct[];
  decantsAvailable: Array<{ size: string; ml: number; priceArs: number; stock: number }>;
  settings?: SystemSettingsData;
}

export function ProductDetailClient({
  product,
  related,
  decantsAvailable,
  settings = DEFAULT_SYSTEM_SETTINGS,
}: ProductDetailClientProps) {
  const { addItem, openDrawer } = useCartStore();

  const [selectedFormat, setSelectedFormat] = useState(decantsAvailable[0]?.size || 'Original');
  const [quantity, setQuantity] = useState(1);

  const isDecant = product.type === 'decant_liquid';
  const exchangeRate = 1200;
  const priceUsd = (product.base_price_ars / exchangeRate).toFixed(1);

  const handleAddToCart = () => {
    if (product.stock_quantity <= 0) {
      toast.error('Producto sin stock disponible.');
      return;
    }

    addItem({
      productId: product.id,
      name: product.name,
      brand: product.brand,
      format: selectedFormat,
      priceArs: product.base_price_ars,
      quantity,
      maxStock: product.stock_quantity,
      sku: product.sku,
    });

    toast.success(`¡"${product.name}" (${quantity} ud) agregado al carrito!`);
    openDrawer();
  };

  // WhatsApp wa.me generator
  const getWhatsAppDirectLink = () => {
    const rawPhone = settings.phone || '5491155550199';
    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    const priceText = product.base_price_ars.toLocaleString('es-AR');
    const msg = `¡Hola ${settings.trade_name}! Estoy viendo el perfume *${product.name}* (${product.brand} - ${selectedFormat}) a *$${priceText} ARS* en la tienda online y quiero coordinar mi compra.`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="min-h-screen bg-[#08130E] text-zinc-100 flex flex-col font-sans selection:bg-[#D0A96B]/30 selection:text-[#E5C158]">
      
      {/* HEADER & DRAWER */}
      <StorefrontHeader settings={settings} />
      <CartDrawer />

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 container mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-12">
        
        {/* BREADCRUMB & VOLVER */}
        <div className="flex items-center justify-between">
          <Link
            href="/tienda"
            className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-[#D0A96B] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver al Catálogo</span>
          </Link>

          <span className="text-[11px] font-mono text-zinc-500">
            SKU: {product.sku || 'N/A'}
          </span>
        </div>

        {/* DETALLE PRINCIPAL: 2 COLUMNAS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-start">
          
          {/* COLUMNA IZQUIERDA: IMAGEN & PIRÁMIDE OLFATIVA */}
          <div className="space-y-6">
            
            {/* CAJA PRINCIPAL DE LA BOTELLA */}
            <div className="relative aspect-square w-full rounded-2xl bg-gradient-to-br from-[#13261E] via-[#08130E] to-[#1B362A]/40 border border-[#1B362A] flex items-center justify-center p-12 overflow-hidden shadow-2xl">
              <div className="flex flex-col items-center justify-center text-center space-y-3">
                <div className="h-28 w-28 rounded-2xl bg-[#13261E] border-2 border-[#D0A96B]/40 flex items-center justify-center text-[#D0A96B] shadow-2xl">
                  {isDecant ? (
                    <Droplet className="h-14 w-14 text-blue-400" />
                  ) : (
                    <Package className="h-14 w-14 text-[#D0A96B]" />
                  )}
                </div>
                <div className="text-xs font-mono text-zinc-400 tracking-widest uppercase">
                  {product.volume_ml ? `${product.volume_ml} ML` : 'NICHE PERFUMERY'}
                </div>
              </div>

              {/* BADGES EN LA IMAGEN */}
              <div className="absolute top-4 left-4 flex flex-col gap-1.5">
                <span className="px-3 py-1 rounded-full bg-[#D0A96B] text-[#08130E] text-[10px] font-black uppercase tracking-wider shadow-md">
                  100% Original
                </span>
                {isDecant && (
                  <span className="px-3 py-1 rounded-full bg-blue-500 text-white text-[10px] font-black uppercase tracking-wider shadow-md">
                    Decant Fraccionado
                  </span>
                )}
              </div>
            </div>

            {/* PIRÁMIDE OLFATIVA & NOTAS */}
            {product.olfactory_notes && product.olfactory_notes.length > 0 && (
              <div className="p-5 rounded-2xl bg-[#13261E] border border-[#1B362A] space-y-3 shadow-xl">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#D0A96B]">
                  <Sparkles className="h-4 w-4" />
                  <span>Pirámide & Notas Olfativas</span>
                </div>

                <p className="text-xs text-zinc-400">
                  Composición armoniosa con notas aromáticas seleccionadas:
                </p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {product.olfactory_notes.map((note, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-[#08130E] border border-[#1B362A] text-xs font-medium text-zinc-200"
                    >
                      • {note}
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* COLUMNA DERECHA: INFORMACIÓN, SELECTOR DE FORMATO Y COMPRA */}
          <div className="space-y-6">
            
            <div>
              <span className="text-xs font-extrabold uppercase tracking-widest text-[#D0A96B] font-mono">
                {product.brand}
              </span>
              <h1 className="text-2xl sm:text-4xl font-black text-white font-serif mt-1">
                {product.name}
              </h1>

              {product.olfactory_family && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1B362A] border border-[#1B362A] text-xs text-zinc-300">
                  <Sparkles className="h-3.5 w-3.5 text-[#D0A96B]" />
                  <span>Familia Olfativa: <strong className="text-white">{product.olfactory_family}</strong></span>
                </div>
              )}
            </div>

            {/* PRECIO & DISPONIBILIDAD */}
            <div className="p-5 rounded-2xl bg-[#13261E] border border-[#1B362A] space-y-2">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl sm:text-4xl font-black font-mono text-white">
                  ${product.base_price_ars.toLocaleString('es-AR')}
                </span>
                <span className="text-xs font-mono text-zinc-400">
                  ARS (~ u$s {priceUsd})
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <span className={`h-2 w-2 rounded-full ${
                  product.stock_quantity > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                }`} />
                <span className="text-xs font-bold text-zinc-300">
                  {product.stock_quantity > 0 
                    ? `Stock Disponible en Local (${product.stock_quantity} unidades)` 
                    : 'Sin Stock Momentáneo'}
                </span>
              </div>
            </div>

            {/* SELECTOR DE FORMATO */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 block">
                Selecciona Formato o Presentación:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {decantsAvailable.map((d) => (
                  <button
                    key={d.size}
                    type="button"
                    onClick={() => setSelectedFormat(d.size)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedFormat === d.size
                        ? 'bg-[#1B362A] border-[#D0A96B] text-white shadow-md'
                        : 'bg-[#13261E] border-[#1B362A] text-zinc-400 hover:border-zinc-500'
                    }`}
                  >
                    <div className="text-xs font-bold text-white flex items-center justify-between">
                      <span>{d.size}</span>
                      {selectedFormat === d.size && <Check className="h-3.5 w-3.5 text-[#D0A96B]" />}
                    </div>
                    <div className="text-[11px] font-mono text-[#D0A96B] font-semibold mt-1">
                      ${d.priceArs.toLocaleString('es-AR')} ARS
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* SELECTOR DE CANTIDAD & BOTÓN DE AGREGAR */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-4">
                
                {/* STEPPER */}
                <div className="flex items-center gap-2 bg-[#13261E] border border-[#1B362A] rounded-xl p-1">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="p-2 text-zinc-400 hover:text-white cursor-pointer"
                    title="Disminuir"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center text-sm font-bold font-mono text-white">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(Math.min(product.stock_quantity, quantity + 1))}
                    disabled={quantity >= product.stock_quantity}
                    className="p-2 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                    title="Aumentar"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {/* BOTÓN AGREGAR */}
                <Button
                  onClick={handleAddToCart}
                  disabled={product.stock_quantity <= 0}
                  className="flex-1 h-12 bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-black text-xs uppercase tracking-wider cursor-pointer shadow-xl shadow-[#D0A96B]/20 flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="h-4 w-4" />
                  <span>Agregar a la Bolsa</span>
                </Button>
              </div>

              {/* BOTÓN DE WHATSAPP DIRECTO */}
              <a
                href={getWhatsAppDirectLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-bold text-xs uppercase tracking-wider transition-all"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Consultar o Encargar por WhatsApp</span>
              </a>
            </div>

            {/* BENEFICIOS DE COMPRA */}
            <div className="border-t border-[#1B362A] pt-6 space-y-3 text-xs text-zinc-400">
              <div className="flex items-center gap-2.5">
                <Truck className="h-4 w-4 text-[#D0A96B] shrink-0" />
                <span>Envíos rápidos a todo el país o retiro sin cargo en nuestro Showroom.</span>
              </div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Garantía de originalidad y fraccionamiento estéril en envases sellados.</span>
              </div>
            </div>

          </div>

        </div>

        {/* FRAGANCIAS RELACIONADAS */}
        {related.length > 0 && (
          <section className="border-t border-[#1B362A] pt-12 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white font-serif">
                  Fragancias Similares o de la Misma Casa
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Opciones recomendadas con notas aromáticas afines.
                </p>
              </div>

              <Link
                href="/tienda"
                className="text-xs font-bold text-[#D0A96B] hover:underline"
              >
                Ver Todo
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
              {related.map((relProd) => (
                <ProductCard key={relProd.id} product={relProd} />
              ))}
            </div>
          </section>
        )}

      </main>

      {/* FOOTER */}
      <StorefrontFooter settings={settings} />

    </div>
  );
}
