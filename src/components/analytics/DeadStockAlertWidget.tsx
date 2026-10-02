'use client';

import React, { useState, useEffect } from 'react';
import { UserRole } from '@/types';
import { getDeadStockAnalysis, DeadStockAnalysis, DeadStockProduct, RotationZone } from '@/app/actions/retailMetrics';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, Clock, Archive, DollarSign, RefreshCw, 
  Tag, ArrowRight, ShieldAlert, Sparkles, Filter, Droplet, Package 
} from 'lucide-react';
import Link from 'next/link';

interface DeadStockAlertWidgetProps {
  role: UserRole;
}

export function DeadStockAlertWidget({ role }: DeadStockAlertWidgetProps) {
  const [data, setData] = useState<DeadStockAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<'all' | 'dead_stock' | 'slow'>('all');

  const fetchData = async () => {
    if (role !== 'admin') return;
    setLoading(true);
    setError(null);
    const res = await getDeadStockAnalysis(role);
    if (res.success && res.data) {
      setData(res.data);
    } else {
      setError(res.error || 'Error al analizar stock inmovilizado');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [role]);

  if (role !== 'admin') return null;

  const filteredItems = (data?.items || []).filter((item) => {
    if (selectedZone === 'all') return item.zone === 'dead_stock' || item.zone === 'slow';
    return item.zone === selectedZone;
  });

  return (
    <Card className="border-slate-200 dark:border-erp-border bg-white dark:bg-erp-surface shadow-xl">
      <CardHeader className="pb-3 border-b border-slate-100 dark:border-zinc-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <Archive className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 font-serif">
                Alerta de Dead Stock & Envejecimiento de Inventario
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-zinc-400">
                Monitoreo de capital inmovilizado cruzando fecha de última venta y última recepción de stock.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <RefreshCw className="h-6 w-6 animate-spin text-erp-gold" />
            <span className="text-xs text-slate-500 dark:text-zinc-400">Analizando rotación y antigüedad de catálogo...</span>
          </div>
        ) : error || !data ? (
          <div className="text-center py-8 text-rose-500 text-xs">
            {error || 'No se pudo obtener el análisis de dead stock.'}
          </div>
        ) : (
          <>
            {/* KPI SUMMARY CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. CAPITAL HUNDIDO (DEAD STOCK) */}
              <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/10">
                <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 text-xs font-bold uppercase tracking-wider">
                  <span>Capital Inmovilizado</span>
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="mt-2">
                  <div className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono">
                    ${data.summary.deadStockCapitalArs.toLocaleString('es-AR')} ARS
                  </div>
                  <div className="text-xs text-rose-700/80 dark:text-rose-300/80 font-mono mt-0.5">
                    ≈ ${data.summary.deadStockCapitalUsd.toLocaleString('es-AR')} USD
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-slate-500 dark:text-zinc-400">
                  {data.summary.deadStockSkuCount} fragancias sin rotar por &gt; 60 días
                </div>
              </div>

              {/* 2. EN OBSERVACIÓN / LENTO */}
              <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/10">
                <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
                  <span>Rotación Lenta</span>
                  <Clock className="h-4 w-4" />
                </div>
                <div className="mt-2">
                  <div className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
                    ${data.summary.slowStockCapitalArs.toLocaleString('es-AR')} ARS
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-slate-500 dark:text-zinc-400">
                  {data.summary.slowStockSkuCount} fragancias con 30-60 días sin ventas
                </div>
              </div>

              {/* 3. STOCK ACTIVO Y SALUDABLE */}
              <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/10">
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  <span>Stock Activo (&lt;30d)</span>
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="mt-2">
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    ${data.summary.activeStockCapitalArs.toLocaleString('es-AR')} ARS
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-slate-500 dark:text-zinc-400">
                  {data.summary.activeStockSkuCount} fragancias con rotación frecuente
                </div>
              </div>

              {/* 4. ÍNDICE DE CAPITAL EN RIESGO */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-erp-border bg-slate-50/50 dark:bg-erp-bg/60">
                <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider">
                  <span>% Capital Hundido</span>
                  <Tag className="h-4 w-4" />
                </div>
                <div className="mt-2">
                  <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
                    {data.summary.deadStockPercentage}%
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                    del total del catálogo valorizado
                  </div>
                </div>
              </div>
            </div>

            {/* FILTROS Y CONTROLES DE LA TABLA */}
            <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-erp-bg p-1 rounded-xl border border-slate-200 dark:border-erp-border text-xs font-bold">
                <button
                  onClick={() => setSelectedZone('all')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    selectedZone === 'all'
                      ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                  }`}
                >
                  Todos en Riesgo ({data.summary.deadStockSkuCount + data.summary.slowStockSkuCount})
                </button>
                <button
                  onClick={() => setSelectedZone('dead_stock')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    selectedZone === 'dead_stock'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-rose-600 dark:text-rose-400 hover:text-rose-700'
                  }`}
                >
                  Dead Stock (&gt;60d) ({data.summary.deadStockSkuCount})
                </button>
                <button
                  onClick={() => setSelectedZone('slow')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    selectedZone === 'slow'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-amber-600 dark:text-amber-400 hover:text-amber-700'
                  }`}
                >
                  Lento (30-60d) ({data.summary.slowStockSkuCount})
                </button>
              </div>

              <Link href="/productos">
                <Button
                  size="sm"
                  className="bg-erp-gold hover:bg-erp-gold-hover text-erp-bg font-extrabold text-xs h-8 cursor-pointer"
                >
                  Crear Combos / Descuentos
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
            </div>

            {/* TABLA DE PRODUCTOS ENVEJECIDOS */}
            {filteredItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 dark:text-zinc-400 bg-slate-50 dark:bg-erp-bg/40 rounded-xl border border-slate-200 dark:border-erp-border">
                No hay productos en la zona seleccionada. ¡Excelente salud de rotación!
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-erp-border">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-erp-border bg-slate-50/70 dark:bg-erp-surface/60 font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      <th className="p-3 pl-4">Fragancia / SKU</th>
                      <th className="p-3">Formato</th>
                      <th className="p-3 text-right">Stock</th>
                      <th className="p-3 text-right">Capital Inmovilizado</th>
                      <th className="p-3 text-center">Días sin Rotar</th>
                      <th className="p-3 pr-4 text-right">Acción Comercial</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-900">
                    {filteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-erp-surface/40 transition-colors">
                        <td className="p-3 pl-4">
                          <div className="font-bold text-slate-900 dark:text-white font-serif">{item.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {item.brand} • SKU: {item.sku}
                          </div>
                        </td>
                        <td className="p-3">
                          {item.type === 'decant_liquid' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                              <Droplet className="h-3 w-3" /> Granel
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              <Package className="h-3 w-3" /> Botella
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono font-semibold text-slate-700 dark:text-zinc-300">
                          {item.stockQuantity} {item.type === 'decant_liquid' ? 'ml' : 'ud'}
                        </td>
                        <td className="p-3 text-right font-mono">
                          <div className="font-bold text-slate-900 dark:text-white">
                            ${item.capitalHundidoArs.toLocaleString('es-AR')}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            ≈ ${item.capitalHundidoUsd.toLocaleString('es-AR')} USD
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          {item.zone === 'dead_stock' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-500/10 text-rose-500 border border-rose-500/30">
                              <AlertTriangle className="h-3 w-3" />
                              {item.daysWithoutSale} días
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30">
                              <Clock className="h-3 w-3" />
                              {item.daysWithoutSale} días
                            </span>
                          )}
                        </td>
                        <td className="p-3 pr-4 text-right">
                          <Link href={`/productos?search=${encodeURIComponent(item.name)}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-[11px] h-7 px-2.5 border-erp-gold/30 text-erp-gold hover:bg-erp-gold/10 cursor-pointer font-bold"
                            >
                              Liquidación / Promo
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
