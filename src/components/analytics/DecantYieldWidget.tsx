'use client';

import React, { useState, useEffect } from 'react';
import { UserRole } from '@/types';
import { getDecantYieldReport, DecantYieldReport, DecantYieldItem } from '@/app/actions/retailMetrics';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Droplet, TrendingUp, Sparkles, RefreshCw, 
  Layers, Package, DollarSign, ArrowUpRight, HelpCircle 
} from 'lucide-react';

interface DecantYieldWidgetProps {
  role: UserRole;
}

export function DecantYieldWidget({ role }: DecantYieldWidgetProps) {
  const [data, setData] = useState<DecantYieldReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (role !== 'admin') return;
    setLoading(true);
    setError(null);
    const res = await getDecantYieldReport(role);
    if (res.success && res.data) {
      setData(res.data);
    } else {
      setError(res.error || 'Error al obtener rendimiento de decants');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [role]);

  if (role !== 'admin') return null;

  return (
    <Card className="border-slate-200 dark:border-erp-border bg-white dark:bg-erp-surface shadow-xl">
      <CardHeader className="pb-3 border-b border-slate-100 dark:border-zinc-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Droplet className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 font-serif">
                Rendimiento de Fraccionamiento & BOM Multiplier
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-zinc-400">
                Multiplicador de valor obtenido al vender decants fraccionados en comparación con la botella sellada equivalente.
              </CardDescription>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="border-slate-200 dark:border-erp-border text-xs h-8 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <RefreshCw className="h-6 w-6 animate-spin text-erp-gold" />
            <span className="text-xs text-slate-500 dark:text-zinc-400">Calculando ratios de rendimiento y multiplicación BOM...</span>
          </div>
        ) : error || !data ? (
          <div className="text-center py-8 text-rose-500 text-xs">
            {error || 'No se pudo obtener el reporte de rendimiento.'}
          </div>
        ) : (
          <>
            {/* KPI SUMMARY CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. MULTIPLICADOR PROMEDIO */}
              <div className="p-4 rounded-xl border border-cyan-200 dark:border-cyan-900/40 bg-cyan-50/50 dark:bg-cyan-950/10">
                <div className="flex items-center justify-between text-cyan-600 dark:text-cyan-400 text-xs font-bold uppercase tracking-wider">
                  <span>BOM Multiplier Promedio</span>
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div className="mt-2 text-2xl font-black text-cyan-600 dark:text-cyan-400 font-mono">
                  {data.summary.avgYieldMultiplier}x
                </div>
                <div className="mt-2 text-[11px] text-slate-500 dark:text-zinc-400">
                  Rendimiento relativo vs botella cerrada
                </div>
              </div>

              {/* 2. PLUS DE GANANCIA GENERADO */}
              <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/10">
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  <span>Plus por Fraccionar</span>
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  +${data.summary.totalExtraRevenueArs.toLocaleString('es-AR')} ARS
                </div>
                <div className="mt-2 text-[11px] text-slate-500 dark:text-zinc-400">
                  Ingreso adicional sobre el valor de botellas
                </div>
              </div>

              {/* 3. VOLUMEN FRACCIONADO VENDIDO */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-erp-border bg-slate-50/50 dark:bg-erp-bg/60">
                <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider">
                  <span>Volumen Vendido</span>
                  <Droplet className="h-4 w-4" />
                </div>
                <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white font-mono">
                  {data.summary.totalMlSold.toLocaleString('es-AR')} ml
                </div>
                <div className="mt-2 text-[11px] text-slate-500 dark:text-zinc-400">
                  En {data.summary.totalDecantsTracked} fragancias a granel
                </div>
              </div>

              {/* 4. FACTURACIÓN DECANT TOTAL */}
              <div className="p-4 rounded-xl border border-erp-gold/30 bg-erp-gold/5">
                <div className="flex items-center justify-between text-erp-gold text-xs font-bold uppercase tracking-wider">
                  <span>Facturación Decants</span>
                  <DollarSign className="h-4 w-4" />
                </div>
                <div className="mt-2 text-2xl font-black text-erp-gold font-mono">
                  ${data.summary.totalDecantRevenueArs.toLocaleString('es-AR')} ARS
                </div>
                <div className="mt-2 text-[11px] text-slate-500 dark:text-zinc-400">
                  Equivalente botella: ${data.summary.totalBottleEquivalentArs.toLocaleString('es-AR')}
                </div>
              </div>
            </div>

            {/* TABLA COMPARATIVA DE FRAGANCIAS */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-erp-border">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-erp-border bg-slate-50/70 dark:bg-erp-surface/60 font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    <th className="p-3 pl-4">Fragancia Decant</th>
                    <th className="p-3">Botella Equivalente</th>
                    <th className="p-3 text-right">ml Vendidos</th>
                    <th className="p-3 text-right">Facturación Decant</th>
                    <th className="p-3 text-right">Equivalente Botella</th>
                    <th className="p-3 text-center">BOM Multiplier</th>
                    <th className="p-3 pr-4 text-right">Plus Ganancia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-900">
                  {data.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-erp-surface/40 transition-colors">
                      <td className="p-3 pl-4">
                        <div className="font-bold text-slate-900 dark:text-white font-serif">{item.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {item.brand} • Stock: {item.stockMl} ml
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-slate-800 dark:text-zinc-200 font-medium">
                          {item.bottleName || `${item.brand} (Estimado)`}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          ${item.bottlePricePerMlArs.toLocaleString('es-AR')}/ml • {item.bottleVolumeMl}ml
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-cyan-600 dark:text-cyan-400">
                        {item.totalMlSold} ml
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        ${item.totalRevenueArs.toLocaleString('es-AR')}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-500 dark:text-zinc-400">
                        ${item.equivalentBottleRevenueArs.toLocaleString('es-AR')}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-extrabold ${
                          item.yieldMultiplier >= 2.0
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                            : item.yieldMultiplier >= 1.5
                            ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                            : 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                        }`}>
                          <ArrowUpRight className="h-3 w-3" />
                          {item.yieldMultiplier}x
                        </span>
                        {!item.hasSales && (
                          <div className="text-[10px] text-slate-400 mt-0.5">Proyectado</div>
                        )}
                      </td>
                      <td className="p-3 pr-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {item.extraRevenueArs > 0 ? `+$${item.extraRevenueArs.toLocaleString('es-AR')}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
