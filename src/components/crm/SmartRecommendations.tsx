'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { matchNewArrivalsToClients, ClientMatchRecommendation } from '@/app/actions/crm';
import { Product } from '@/types';
import { 
  Sparkles, MessageSquare, Copy, ExternalLink, RefreshCw, 
  Flame, CheckCircle2, ShoppingBag, Users, Zap, Tag, Send 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface SmartRecommendationsProps {
  products: Product[];
}

export function SmartRecommendations({ products }: SmartRecommendationsProps) {
  const { role } = useUserStore();
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [targetProduct, setTargetProduct] = useState<Product | null>(null);
  const [recommendations, setRecommendations] = useState<ClientMatchRecommendation[]>([]);

  // Filtrar perfumes en stock (botellas y decants)
  const availablePerfumes = products.filter(p => p.type === 'bottle' || p.type === 'decant_liquid');

  useEffect(() => {
    if (availablePerfumes.length > 0 && !selectedProductId) {
      setSelectedProductId(availablePerfumes[0].id);
    }
  }, [availablePerfumes]);

  useEffect(() => {
    if (!selectedProductId) return;

    const runMatch = async () => {
      setLoading(true);
      const res = await matchNewArrivalsToClients(role, selectedProductId);
      if (res.success && res.recommendations) {
        setTargetProduct(res.newProduct || null);
        setRecommendations(res.recommendations);
      } else {
        toast.error(res.error || 'Error al calcular recomendaciones.');
        setRecommendations([]);
      }
      setLoading(false);
    };

    runMatch();
  }, [selectedProductId, role]);

  const handleCopyMessage = (text: string, clientName: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Mensaje para ${clientName} copiado al portapapeles.`);
  };

  return (
    <div className="bg-[#13261E] border border-[#1B362A] rounded-2xl p-6 shadow-xl space-y-6">
      
      {/* ENCABEZADO Y SELECTOR DE PRODUCTO NUEVO */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#1B362A] pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D0A96B]/10 border border-[#D0A96B]/30 text-[#D0A96B]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
              Motor de Recomendaciones Inteligentes (CRM Hot Leads)
            </h2>
            <p className="text-xs text-zinc-400">
              Cruza los nuevos ingresos con el historial de compras para enviar campañas de WhatsApp hiper-personalizadas.
            </p>
          </div>
        </div>

        {/* SELECTOR DE LANZAMIENTO */}
        <div className="min-w-[280px]">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#D0A96B] mb-1">
            Seleccionar Lanzamiento / Nuevo Perfume
          </label>
          <select
            value={selectedProductId}
            onChange={e => setSelectedProductId(e.target.value)}
            className="w-full bg-[#08130E] border border-[#1B362A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D0A96B]"
          >
            {availablePerfumes.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.brand}) {p.olfactory_family ? `— ${p.olfactory_family}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* DETALLE DEL PRODUCTO SELECCIONADO Y METRICAS */}
      {targetProduct && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-[#08130E] border border-[#1B362A] rounded-xl font-mono text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-500">Perfume Seleccionado</span>
            <p className="text-sm font-bold text-white">{targetProduct.name}</p>
            <p className="text-[11px] text-[#D0A96B]">{targetProduct.brand}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-500">Familia Olfativa</span>
            <p className="text-sm font-bold text-emerald-400">{targetProduct.olfactory_family || 'Sin especificar'}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-500">Notas Olfativas Clave</span>
            <p className="text-xs text-zinc-300 line-clamp-1">
              {Array.isArray(targetProduct.olfactory_notes) && targetProduct.olfactory_notes.length > 0
                ? targetProduct.olfactory_notes.join(', ')
                : 'Bergamota, Cedro, Vainilla'}
            </p>
          </div>
          <div className="flex flex-col justify-center items-end">
            <span className="text-[10px] uppercase font-bold text-amber-400">Hot Leads Potenciales</span>
            <p className="text-xl font-black text-amber-400 flex items-center gap-1">
              <Flame className="h-5 w-5 text-amber-500" />
              {recommendations.length} Clientes
            </p>
          </div>
        </div>
      )}

      {/* LISTA DE RECOMENDACIONES (HOT LEADS) */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-400 text-xs">
            <RefreshCw className="h-6 w-6 animate-spin text-[#D0A96B]" />
            <span>Ejecutando algoritmo de Match Olfativo en historial de ventas...</span>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-[#1B362A] rounded-xl text-zinc-500 text-xs">
            No se encontraron clientes anteriores con coincidencia directa de notas para este producto.
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="p-4 bg-[#08130E] border border-[#1B362A] rounded-xl space-y-3 hover:border-[#D0A96B]/40 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1B362A]/60 pb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 font-bold text-xs border border-amber-500/30">
                      #{idx + 1}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        {rec.clientName}
                        {rec.clientPhone && (
                          <span className="text-[10px] text-zinc-400 font-mono font-normal">
                            ({rec.clientPhone})
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-zinc-400">
                        Compró previamente: <span className="text-[#D0A96B] font-medium">{rec.previousPerfumeName}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-mono">
                      <Zap className="h-3 w-3" />
                      {rec.matchScore} Notas Coincidentes
                    </span>
                  </div>
                </div>

                {/* NOTAS COINCIDENTES TAGS */}
                {rec.matchingNotes.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-zinc-500 text-[10px] font-bold uppercase">Notas de Match:</span>
                    {rec.matchingNotes.map((note, nIdx) => (
                      <span key={nIdx} className="px-2 py-0.5 rounded bg-[#13261E] text-amber-300 border border-[#1B362A] font-mono">
                        {note}
                      </span>
                    ))}
                  </div>
                )}

                {/* MENSAJE DE WHATSAPP GENERADO */}
                <div className="relative bg-[#13261E] border border-[#1B362A] rounded-xl p-3 text-xs text-zinc-200 font-sans">
                  <p className="leading-relaxed whitespace-pre-line">{rec.whatsAppMessage}</p>
                </div>

                {/* BOTONES DE ACCIÓN */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyMessage(rec.whatsAppMessage, rec.clientName)}
                    className="border-[#1B362A] bg-[#13261E] text-zinc-300 hover:text-white text-xs h-8 cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Copiar Mensaje
                  </Button>
                  
                  <a
                    href={rec.whatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950/40 transition-colors cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Abrir en WhatsApp</span>
                  </a>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
