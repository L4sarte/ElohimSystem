'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { getInventoryValuation, InventoryValuationMetrics } from '@/app/actions/inventoryAnalytics';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { 
  Boxes, DollarSign, Sparkles, RefreshCw, AlertCircle, 
  TrendingUp, Wallet, PiggyBank, Vault 
} from 'lucide-react';

const DEFAULT_METRICS: InventoryValuationMetrics = {
  capitalInvertido: 0,
  valorBrutoVenta: 0,
  gananciaNetaPotencial: 0,
  capitalInvertidoUsd: 0,
  valorBrutoVentaUsd: 0,
  gananciaNetaPotencialUsd: 0,
  totalUnitsInStock: 0,
  totalProductsCount: 0,
  potentialProfitMarginPercent: 0
};

export function InventoryValuationWidget() {
  const { role } = useUserStore();
  const [metrics, setMetrics] = useState<InventoryValuationMetrics>(DEFAULT_METRICS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatArs = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const fetchValuation = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getInventoryValuation(role);
      if (res.success && res.data) {
        setMetrics(res.data);
      } else {
        setMetrics(DEFAULT_METRICS);
        setError(res.error || 'No se pudieron calcular las métricas del inventario.');
      }
    } catch (err: any) {
      console.error('Error en el cliente al invocar getInventoryValuation:', err);
      setMetrics(DEFAULT_METRICS);
      setError(err.message || 'Error inesperado al cargar la valoración de stock.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchValuation();
  }, [role]);

  return (
    <div className="space-y-3 mb-6 w-full">
      {/* CABECERA DEL WIDGET */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Vault className="h-4 w-4 text-[#D0A96B]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-serif">
            Valoración y Proyección de Inventario en Estantería
          </h3>
          {!isLoading && (
            <span className="text-[10px] font-mono text-zinc-400 bg-[#08130E] px-2 py-0.5 rounded-md border border-[#1B362A]">
              {metrics.totalProductsCount} SKUs ({metrics.totalUnitsInStock} unidades)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {error && (
            <span className="text-[10px] font-mono text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Error en cálculo
            </span>
          )}

          <button
            onClick={fetchValuation}
            disabled={isLoading}
            className="text-zinc-400 hover:text-white transition-colors cursor-pointer text-xs p-1 rounded-lg hover:bg-[#13261E]"
            title="Recalcular Inventario"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-[#D0A96B]' : ''}`} />
          </button>
        </div>
      </div>

      {/* ESTADO 1: SKELETON / CARGANDO */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl p-5 shadow-xl animate-pulse">
              <div className="space-y-3">
                <div className="h-3 w-1/2 bg-[#1B362A] rounded"></div>
                <div className="h-7 w-3/4 bg-[#1B362A] rounded"></div>
                <div className="h-3 w-2/3 bg-[#1B362A] rounded"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        /* ESTADOS 2 Y 3: DATA REAL O MOSTRAR VALORES EN $0 SI OCURRIÓ UN ERROR (NUNCA DEVUELVE NULL) */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* CARD 1: CAPITAL INVERTIDO (COSTO) */}
          <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl p-5 shadow-xl hover:border-[#D0A96B]/50 transition-all">
            <CardHeader className="p-0 space-y-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                  Capital Invertido (Costo)
                </CardDescription>
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Wallet className="h-4 w-4" />
                </div>
              </div>

              <CardContent className="p-0">
                <CardTitle className="text-xl sm:text-2xl font-black font-mono text-indigo-300">
                  {formatArs(metrics.capitalInvertido)}
                </CardTitle>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">
                  u$s {metrics.capitalInvertidoUsd.toLocaleString('es-AR')} USD
                </p>
              </CardContent>

              <p className="text-[11px] text-zinc-400 leading-snug pt-1 border-t border-[#1B362A]/60">
                Si vendieras todo tu stock hoy a precio de costo.
              </p>
            </CardHeader>
          </Card>

          {/* CARD 2: VALOR BRUTO POTENCIAL (VENTA TOTAL) */}
          <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl p-5 shadow-xl hover:border-[#D0A96B]/50 transition-all">
            <CardHeader className="p-0 space-y-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-[#D0A96B] flex items-center gap-1">
                  Valor Bruto Potencial (Venta)
                </CardDescription>
                <div className="p-1.5 rounded-lg bg-[#D0A96B]/10 text-[#D0A96B] border border-[#D0A96B]/30">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>

              <CardContent className="p-0">
                <CardTitle className="text-xl sm:text-2xl font-black font-mono text-[#E5C158]">
                  {formatArs(metrics.valorBrutoVenta)}
                </CardTitle>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">
                  u$s {metrics.valorBrutoVentaUsd.toLocaleString('es-AR')} USD
                </p>
              </CardContent>

              <p className="text-[11px] text-zinc-400 leading-snug pt-1 border-t border-[#1B362A]/60">
                Facturación bruta potencial al 100% de ocupación.
              </p>
            </CardHeader>
          </Card>

          {/* CARD 3: GANANCIA NETA POTENCIAL */}
          <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl p-5 shadow-xl hover:border-emerald-500/50 transition-all">
            <CardHeader className="p-0 space-y-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                  Ganancia Neta Potencial
                </CardDescription>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                    +{metrics.potentialProfitMarginPercent}% Margen
                  </span>
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <PiggyBank className="h-4 w-4" />
                  </div>
                </div>
              </div>

              <CardContent className="p-0">
                <CardTitle className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
                  {formatArs(metrics.gananciaNetaPotencial)}
                </CardTitle>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">
                  u$s {metrics.gananciaNetaPotencialUsd.toLocaleString('es-AR')} USD
                </p>
              </CardContent>

              <p className="text-[11px] text-zinc-400 leading-snug pt-1 border-t border-[#1B362A]/60">
                Utilidad neta proyectada tras recuperar la inversión.
              </p>
            </CardHeader>
          </Card>

        </div>
      )}
    </div>
  );
}
