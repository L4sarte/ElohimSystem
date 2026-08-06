'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { getInventoryValuation, InventoryValuationData } from '@/app/actions/inventoryAnalytics';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Boxes, DollarSign, Sparkles, RefreshCw, AlertCircle, 
  HelpCircle, Layers, TrendingUp, Vault 
} from 'lucide-react';

export function InventoryValuationWidget() {
  const { role } = useUserStore();
  const [data, setData] = useState<InventoryValuationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchValuation = async () => {
    if (role !== 'admin') return;
    setLoading(true);
    setError(null);
    const res = await getInventoryValuation(role);
    if (res.success && res.data) {
      setData(res.data);
    } else {
      setError(res.error || 'Error al calcular valoración del inventario.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchValuation();
  }, [role]);

  if (role !== 'admin') return null;

  if (loading) {
    return (
      <div className="p-4 rounded-2xl bg-[#13261E]/90 border border-[#1B362A] flex items-center justify-center gap-2 text-xs text-zinc-400 my-4">
        <RefreshCw className="h-4 w-4 animate-spin text-[#D0A96B]" />
        Calculando valoración de inventario y capital en stock...
      </div>
    );
  }

  if (error || !data) {
    return null; // Ocultar o mostrar banner silencioso si no hay data
  }

  return (
    <div className="space-y-3 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Vault className="h-4 w-4 text-[#D0A96B]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-serif">
            Valoración y Proyección de Inventario en Estantería
          </h3>
          <span className="text-[10px] font-mono text-zinc-500 bg-[#08130E] px-2 py-0.5 rounded-md border border-[#1B362A]">
            {data.totalProductsCount} SKUs ({data.totalUnitsInStock} unidades)
          </span>
        </div>
        <button
          onClick={fetchValuation}
          className="text-zinc-500 hover:text-white transition-colors cursor-pointer text-xs"
          title="Recalcular Inventario"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* CARD 1: CAPITAL INVERTIDO (COSTO) */}
        <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl p-5 shadow-xl hover:border-[#D0A96B]/30 transition-colors">
          <CardHeader className="p-0 space-y-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                Capital Invertido (Costo Stock)
              </CardDescription>
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Boxes className="h-4 w-4" />
              </div>
            </div>

            <div>
              <CardTitle className="text-xl sm:text-2xl font-black font-mono text-indigo-300">
                ${data.capitalCostArs.toLocaleString('es-AR')} ARS
              </CardTitle>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                u$s {data.capitalCostUsd.toLocaleString('es-AR')} USD
              </p>
            </div>

            <p className="text-[11px] text-zinc-400 leading-snug pt-1 border-t border-[#1B362A]/60">
              Capital "hundido" en la compra de mercadería física almacenada hoy.
            </p>
          </CardHeader>
        </Card>

        {/* CARD 2: VALOR BRUTO POTENCIAL (VENTA) */}
        <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl p-5 shadow-xl hover:border-[#D0A96B]/30 transition-colors">
          <CardHeader className="p-0 space-y-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-[#D0A96B] flex items-center gap-1">
                Valor Bruto Potencial (Venta Total)
              </CardDescription>
              <div className="p-1.5 rounded-lg bg-[#D0A96B]/10 text-[#D0A96B] border border-[#D0A96B]/30">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>

            <div>
              <CardTitle className="text-xl sm:text-2xl font-black font-mono text-[#E5C158]">
                ${data.potentialRevenueArs.toLocaleString('es-AR')} ARS
              </CardTitle>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                u$s {data.potentialRevenueUsd.toLocaleString('es-AR')} USD
              </p>
            </div>

            <p className="text-[11px] text-zinc-400 leading-snug pt-1 border-t border-[#1B362A]/60">
              Facturación bruta si vendieras el 100% del stock al precio de lista actual.
            </p>
          </CardHeader>
        </Card>

        {/* CARD 3: GANANCIA NETA POTENCIAL */}
        <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl p-5 shadow-xl hover:border-emerald-500/30 transition-colors">
          <CardHeader className="p-0 space-y-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                Ganancia Neta Potencial
              </CardDescription>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                +{data.potentialProfitMarginPercent}% Margen
              </span>
            </div>

            <div>
              <CardTitle className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
                ${data.potentialNetProfitArs.toLocaleString('es-AR')} ARS
              </CardTitle>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                u$s {data.potentialNetProfitUsd.toLocaleString('es-AR')} USD
              </p>
            </div>

            <p className="text-[11px] text-zinc-400 leading-snug pt-1 border-t border-[#1B362A]/60">
              Utilidad limpia a generar tras recuperar la inversión total en productos.
            </p>
          </CardHeader>
        </Card>

      </div>
    </div>
  );
}
