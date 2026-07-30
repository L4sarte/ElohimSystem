'use client';

import React, { useState, useEffect } from 'react';
import { getPublicCatalog } from '@/app/actions/public';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { Product, ProductType } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Search, ShoppingBag, Droplet, Sparkles, MessageCircle, 
  RefreshCw, AlertCircle, Filter, Check, ArrowUpRight, Flame, Heart
} from 'lucide-react';

const FAMILIES = ['Todas', 'Cítrico', 'Amaderado', 'Gourmand', 'Floral', 'Oriental', 'Cuero', 'Aromático', 'Especiado'];
const TYPES = [
  { label: 'Todos los productos', value: 'all' },
  { label: 'Decants (ml)', value: 'decant_liquid' },
  { label: 'Botellas Selladas', value: 'bottle' }
];

export default function CatalogoPublicoPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFamily, setSelectedFamily] = useState('Todas');
  const [selectedType, setSelectedType] = useState('all');

  // Cotización informativa Dólar Blue
  const { rate: exchangeRate } = useExchangeRate();

  const fetchCatalog = async () => {
    setLoading(true);
    setError(null);
    const res = await getPublicCatalog();
    if (res.success && res.data) {
      setProducts(res.data);
    } else {
      setError(res.error || 'Error al cargar la vidriera digital');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  // WhatsApp wa.me Link Generator
  const getWhatsAppLink = (product: Product) => {
    const phone = process.env.NEXT_PUBLIC_WHATSAPP_PHONE || '5491122334455';
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const priceText = product.base_price_ars.toLocaleString('es-AR');
    const typeLabel = product.type === 'decant_liquid' ? 'Decant Fraccionado' : 'Botella Sellada';
    
    const message = `¡Hola Elohim Import! Vi el perfume *${product.name}* (${product.brand} - ${typeLabel}) en el catálogo digital a *$${priceText} ARS* y quiero encargarlo. ¿Tienen disponibilidad?`;
    
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  // Filtrado
  const filteredProducts = products.filter(p => {
    const textMatch = 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.olfactory_family || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.olfactory_notes || []).some(n => n.toLowerCase().includes(searchTerm.toLowerCase()));

    const familyMatch = selectedFamily === 'Todas' || p.olfactory_family === selectedFamily;
    const typeMatch = selectedType === 'all' || p.type === selectedType;

    return textMatch && familyMatch && typeMatch;
  });

  return (
    <div className="min-h-screen bg-[#08130E] text-zinc-50 flex flex-col font-sans selection:bg-violet-500/30 selection:text-violet-200">
      
      {/* HEADER ES MERILADO FIX (GLASSMORPHISM) - MOBILE FIRST */}
      <header className="sticky top-0 z-40 w-full border-b border-[#1B362A] bg-[#08130E]/85 backdrop-blur-md px-4 py-3.5 sm:px-6">
        <div className="container mx-auto max-w-5xl space-y-3">
          
          {/* Marca / Logo Centrado */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src="/logo-elohim.png" alt="Elohim Import" className="h-9 w-auto object-contain" />
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-extrabold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Stock & Precios en Vivo
            </div>
          </div>

          {/* BUSCADOR DE PRODUCTOS */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Buscar perfume, marca, nota olfativa..."
              className="pl-9 bg-[#13261E]/90 border-[#1B362A] text-sm placeholder:text-zinc-500 rounded-xl focus-visible:ring-[#D0A96B]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

        </div>
      </header>

      {/* BARRA DE FILTROS RÁPIDOS SCROLLEABLE (CHIPS) */}
      <div className="border-b border-[#1B362A]/60 bg-[#08130E]/60 px-4 py-2.5 sm:px-6 overflow-x-auto no-scrollbar">
        <div className="container mx-auto max-w-5xl flex items-center gap-2 whitespace-nowrap">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mr-1 shrink-0 flex items-center gap-1">
            <Filter className="h-3 w-3" /> Familia:
          </span>

          {FAMILIES.map(fam => (
            <button
              key={fam}
              onClick={() => setSelectedFamily(fam)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 border ${
                selectedFamily === fam
                  ? 'bg-[#D0A96B] text-[#08130E] text-white border-violet-500 shadow-md shadow-violet-600/30'
                  : 'bg-[#13261E] border-[#1B362A] text-zinc-400 hover:text-white hover:border-[#1B362A]'
              }`}
            >
              {fam}
            </button>
          ))}
        </div>
      </div>

      {/* SEGUNDA BARRA DE FILTROS: TIPO DE PRODUCTO */}
      <div className="px-4 py-2 sm:px-6 bg-[#13261E]/30 border-b border-[#1B362A]/40">
        <div className="container mx-auto max-w-5xl flex items-center justify-between text-xs">
          <div className="flex gap-2">
            {TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setSelectedType(t.value)}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  selectedType === t.value
                    ? 'bg-zinc-800 text-[#E5C158] border border-[#1B362A]'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="text-[10px] text-zinc-500 font-mono hidden sm:block">
            Mostrando {filteredProducts.length} perfumes
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL / GRILLA DE PRODUCTOS RESPONSIVA */}
      <main className="flex-1 container mx-auto px-4 py-6 sm:px-6 max-w-5xl">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-[#D0A96B]" />
            <span className="text-xs font-semibold text-zinc-400">Cargando vidriera digital...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-rose-400 gap-2 border border-[#1B362A] rounded-2xl bg-[#13261E]/40 p-6">
            <AlertCircle className="h-10 w-10" />
            <h3 className="font-bold text-white">Error de Carga</h3>
            <p className="text-xs text-zinc-400">{error}</p>
            <Button variant="outline" onClick={fetchCatalog} className="mt-2 border-[#1B362A] bg-[#13261E]">Reintentar</Button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center border border-[#1B362A] rounded-2xl bg-[#13261E]/40 p-6">
            <Sparkles className="h-10 w-10 text-zinc-700" />
            <h3 className="font-bold text-white text-lg font-serif">Sin resultados</h3>
            <p className="text-xs text-zinc-400 max-w-xs">
              No encontramos perfumes que coincidan con tus filtros. Intenta buscando otro término o seleccionando &apos;Todas&apos;.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map(product => {
              const isDecant = product.type === 'decant_liquid';
              const notes = product.olfactory_notes || [];

              return (
                <Card 
                  key={product.id}
                  className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl hover:border-[#D0A96B]/40 transition-all duration-300 flex flex-col justify-between overflow-hidden group"
                >
                  <CardHeader className="p-4 pb-3 space-y-2">
                    
                    {/* Insignia de tipo */}
                    <div className="flex items-center justify-between">
                      {isDecant ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <Droplet className="h-3 w-3" /> Decant Fraccionado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-[#D0A96B]/10 text-[#E5C158] border border-[#D0A96B]/30">
                          <ShoppingBag className="h-3 w-3" /> Botella Sellada
                        </span>
                      )}

                      {product.olfactory_family && (
                        <span className="text-[9px] font-bold text-zinc-400 bg-[#08130E] px-2 py-0.5 rounded-md border border-[#1B362A]">
                          {product.olfactory_family}
                        </span>
                      )}
                    </div>

                    {/* Nombre y Marca */}
                    <div>
                      <h3 className="font-serif font-bold text-base text-white group-hover:text-[#E5C158] transition-colors leading-tight">
                        {product.name}
                      </h3>
                      <div className="text-xs text-zinc-400 mt-0.5 flex items-center justify-between">
                        <span>Marca: <strong className="text-zinc-200">{product.brand}</strong></span>
                        {product.volume_ml && (
                          <span className="text-[10px] text-zinc-500 font-mono">{product.volume_ml} ml</span>
                        )}
                      </div>
                    </div>

                    {/* Notas Olfativas en Badges */}
                    {notes.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {notes.slice(0, 4).map(note => (
                          <span key={note} className="text-[9px] px-1.5 py-0.5 rounded bg-[#08130E] text-zinc-400 border border-[#1B362A] font-medium">
                            {note}
                          </span>
                        ))}
                      </div>
                    )}

                  </CardHeader>

                  {/* Footer con Precio y Botón de WhatsApp */}
                  <CardFooter className="p-4 pt-3 border-t border-[#1B362A] bg-[#08130E]/40 flex flex-col space-y-3">
                    
                    <div className="w-full flex items-baseline justify-between">
                      <div>
                        <div className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-500">Precio ARS</div>
                        <div className="text-xl font-bold font-mono text-white tracking-tight">
                          ${product.base_price_ars.toLocaleString('es-AR')}
                        </div>
                      </div>

                      {exchangeRate && (
                        <div className="text-right text-[10px] font-mono text-indigo-400">
                          u$s {(product.base_price_ars / exchangeRate).toFixed(2)}
                        </div>
                      )}
                    </div>

                    {/* BOTÓN PRINCIPAL DE CONSULTA POR WHATSAPP */}
                    <a
                      href={getWhatsAppLink(product)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full"
                    >
                      <Button 
                        className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs h-10 rounded-xl cursor-pointer shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                      >
                        <MessageCircle className="h-4 w-4 fill-white" />
                        Pedir por WhatsApp <ArrowUpRight className="h-3.5 w-3.5 opacity-70" />
                      </Button>
                    </a>

                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

      </main>

      {/* FOOTER PÚBLICO MINIMALISTA */}
      <footer className="border-t border-[#1B362A] bg-[#08130E] py-8 mt-12 text-center text-xs text-zinc-500">
        <div className="container mx-auto px-4 max-w-5xl space-y-2">
          <div className="flex items-center justify-center gap-2 text-zinc-400 font-serif font-bold text-sm">
            <span>Elohim Import Perfumería</span>
          </div>
          <p>© 2026 Catálogo Digital Link-in-Bio. Lista de precios oficial actualizada.</p>
        </div>
      </footer>

    </div>
  );
}
