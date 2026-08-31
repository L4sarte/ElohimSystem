'use client';

import React, { useState, useRef } from 'react';
import { Product } from '@/types';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, X, Download, Printer, Share2, Check, DollarSign, Tag, Droplet, Crown 
} from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';

interface CatalogGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProducts: Product[];
  exchangeRateUsd?: number;
}

export function CatalogGeneratorModal({
  isOpen,
  onClose,
  selectedProducts,
  exchangeRateUsd = 1570
}: CatalogGeneratorModalProps) {
  const [currencyMode, setCurrencyMode] = useState<'ARS' | 'USD'>('ARS');
  const [themeMode, setThemeMode] = useState<'luxury_dark' | 'minimal_light'>('luxury_dark');
  const [exporting, setExporting] = useState(false);

  const captureRef = useRef<HTMLDivElement>(null);

  if (!isOpen || selectedProducts.length === 0) return null;

  const handleDownloadImage = async () => {
    if (!captureRef.current) return;
    setExporting(true);
    toast.info('Generando imagen de catálogo...');

    try {
      const canvas = await html2canvas(captureRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: themeMode === 'luxury_dark' ? '#08130E' : '#FFFFFF',
        logging: false
      });

      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `Elohim_Catalogo_${new Date().toISOString().split('T')[0]}.png`;
      link.click();

      toast.success('¡Imagen de catálogo descargada exitosamente!');
    } catch (err: any) {
      console.error('Error al exportar imagen:', err);
      toast.error('No se pudo generar la imagen. Intenta la opción de impresión.');
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="w-[95vw] sm:max-w-3xl bg-[#13261E] border border-[#1B362A] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto">
        
        {/* HEADER */}
        <CardHeader className="border-b border-[#1B362A] pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-white font-serif flex items-center gap-2">
              <Crown className="h-5 w-5 text-[#D0A96B]" />
              Generador de Catálogo Rápido ({selectedProducts.length} productos)
            </CardTitle>
            <button onClick={onClose} className="text-zinc-400 hover:text-white p-1 cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>
          <CardDescription className="text-xs text-zinc-400">
            Diseño boutique optimizado para compartir en WhatsApp, historias o clientes.
          </CardDescription>

          {/* SELECTORES DE ESTILO Y MONEDA */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Estética:</span>
              <div className="flex rounded-lg bg-[#08130E] border border-[#1B362A] p-0.5">
                <button
                  onClick={() => setThemeMode('luxury_dark')}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                    themeMode === 'luxury_dark' ? 'bg-[#13261E] text-[#D0A96B] border border-[#D0A96B]/30' : 'text-zinc-400'
                  }`}
                >
                  Luxury Dark
                </button>
                <button
                  onClick={() => setThemeMode('minimal_light')}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                    themeMode === 'minimal_light' ? 'bg-white text-zinc-900 border border-zinc-300' : 'text-zinc-400'
                  }`}
                >
                  Minimalist Light
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Moneda:</span>
              <div className="flex rounded-lg bg-[#08130E] border border-[#1B362A] p-0.5">
                <button
                  onClick={() => setCurrencyMode('ARS')}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                    currencyMode === 'ARS' ? 'bg-[#D0A96B] text-[#08130E]' : 'text-zinc-400'
                  }`}
                >
                  $ ARS
                </button>
                <button
                  onClick={() => setCurrencyMode('USD')}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                    currencyMode === 'USD' ? 'bg-[#D0A96B] text-[#08130E]' : 'text-zinc-400'
                  }`}
                >
                  u$s USD
                </button>
              </div>
            </div>
          </div>
        </CardHeader>

        {/* PREVISUALIZACIÓN DE ÁREA CAPTURABLE */}
        <CardContent className="p-4 sm:p-6 max-h-[65vh] overflow-y-auto bg-[#08130E]/50">
          
          <div 
            ref={captureRef}
            id="catalog-capture-area"
            className={`p-6 rounded-2xl shadow-2xl space-y-6 border transition-all ${
              themeMode === 'luxury_dark'
                ? 'bg-[#08130E] text-white border-[#1B362A]'
                : 'bg-white text-zinc-900 border-zinc-200'
            }`}
          >
            {/* BRANDING HEADER DEL CATÁLOGO */}
            <div className="flex items-center justify-between border-b pb-4 border-current opacity-80">
              <div className="flex items-center gap-2.5">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl font-serif font-black text-lg ${
                  themeMode === 'luxury_dark' ? 'bg-[#D0A96B] text-[#08130E]' : 'bg-zinc-900 text-white'
                }`}>
                  E
                </div>
                <div>
                  <h2 className="text-base font-extrabold tracking-widest font-serif uppercase">
                    ELOHIM
                  </h2>
                  <p className={`text-[9px] font-mono tracking-widest uppercase ${
                    themeMode === 'luxury_dark' ? 'text-[#D0A96B]' : 'text-amber-700'
                  }`}>
                    Perfumería de Nicho & Decants
                  </p>
                </div>
              </div>

              <div className="text-right text-[10px] font-mono opacity-60">
                Catálogo Selección Exclusiva
              </div>
            </div>

            {/* GRILLA DE PRODUCTOS SELECCIONADOS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {selectedProducts.map((prod) => {
                const isDecant = prod.type === 'decant_liquid';
                const priceArs = prod.base_price_ars || 0;
                const priceUsd = exchangeRateUsd > 0 ? (priceArs / exchangeRateUsd) : 0;
                const displayPrice = currencyMode === 'ARS'
                  ? `$${priceArs.toLocaleString('es-AR')} ARS`
                  : `u$s ${priceUsd.toFixed(2)} USD`;

                return (
                  <div 
                    key={prod.id} 
                    className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-all ${
                      themeMode === 'luxury_dark'
                        ? 'bg-[#13261E]/80 border-[#1B362A]'
                        : 'bg-zinc-50 border-zinc-200'
                    }`}
                  >
                    <div>
                      {/* BADGE TIPO & MARCA */}
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                        <span className={themeMode === 'luxury_dark' ? 'text-[#D0A96B]' : 'text-amber-700'}>
                          {prod.brand}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full font-mono text-[9px] ${
                          isDecant
                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                        }`}>
                          {isDecant ? 'Decant Exclusivo' : `${prod.volume_ml || 100}ml Frasco`}
                        </span>
                      </div>

                      {/* NOMBRE DEL PERFUME */}
                      <h3 className="text-sm font-extrabold font-serif leading-snug">
                        {prod.name}
                      </h3>

                      {/* FAMILIA Y NOTAS */}
                      {prod.olfactory_family && (
                        <p className="text-[11px] font-medium opacity-75 mt-1">
                          Familia: <span className="font-bold">{prod.olfactory_family}</span>
                        </p>
                      )}

                      {Array.isArray(prod.olfactory_notes) && prod.olfactory_notes.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {prod.olfactory_notes.slice(0, 4).map((note, idx) => (
                            <span 
                              key={idx}
                              className={`text-[9px] font-semibold px-2 py-0.5 rounded-md ${
                                themeMode === 'luxury_dark'
                                  ? 'bg-[#08130E] text-zinc-300 border border-[#1B362A]'
                                  : 'bg-white text-zinc-700 border border-zinc-300'
                              }`}
                            >
                              {note}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* PRECIO FINAL */}
                    <div className="pt-3 border-t border-current opacity-95 flex items-center justify-between mt-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest opacity-60 font-mono">
                        Precio Final
                      </span>
                      <span className={`text-base font-black font-mono ${
                        themeMode === 'luxury_dark' ? 'text-emerald-400' : 'text-emerald-700'
                      }`}>
                        {displayPrice}
                      </span>
                    </div>

                  </div>
                );
              })}
            </div>

            {/* FOOTER DEL CATÁLOGO */}
            <div className="pt-4 border-t border-current opacity-60 text-[10px] font-mono flex items-center justify-between">
              <span>Elohim Import ERP • Envíos a todo el país</span>
              <span>Consultá disponibilidad por WhatsApp</span>
            </div>

          </div>

        </CardContent>

        {/* ACCIONES DE EXPORTACIÓN */}
        <div className="p-4 border-t border-[#1B362A] bg-[#08130E]/60 flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={handlePrint}
            className="border-[#1B362A] bg-[#13261E] text-xs font-bold text-zinc-300 hover:bg-zinc-800 cursor-pointer"
          >
            <Printer className="mr-1.5 h-3.5 w-3.5 text-[#D0A96B]" />
            Imprimir / Vista PDF
          </Button>

          <div className="flex gap-2">
            <Button
              onClick={onClose}
              variant="outline"
              className="border-[#1B362A] bg-[#13261E] text-xs font-bold text-zinc-400 hover:text-white cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDownloadImage}
              disabled={exporting}
              className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold text-xs cursor-pointer shadow-lg"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {exporting ? 'Exportando...' : 'Descargar Imagen (PNG)'}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
