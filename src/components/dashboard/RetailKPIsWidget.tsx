'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { getRetailKPIs, RetailKPIsData } from '@/app/actions/reports';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Receipt, Trophy, Flame, ShoppingBag, RefreshCw, AlertCircle, TrendingUp } from 'lucide-react';

export interface RetailKPIsWidgetProps {
  startDate?: string;
  endDate?: string;
}

export function RetailKPIsWidget({ startDate, endDate }: RetailKPIsWidgetProps = {}) {
  const role = useUserStore((state) => state.role);
  const [data, setData] = useState<RetailKPIsData | null>(null);
  const [displayLimit, setDisplayLimit] = useState<3 | 5>(3);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKPIs = async () => {
    if (role !== 'admin') return;
    setLoading(true);
    setError(null);
    const res = await getRetailKPIs(role, startDate, endDate);
    if (res.success && res.data) {
      setData(res.data);
    } else {
      setError(res.error || 'Error al obtener métricas de Retail');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchKPIs();
  }, [role, startDate, endDate]);

  if (role !== 'admin') return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* CARD 1: TICKET PROMEDIO (AOV) */}
      <Card className="border border-erp-border bg-erp-surface/90 rounded-2xl shadow-xl transition-all duration-300 hover:border-erp-gold/50">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardDescription className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-400">
              Ticket Promedio del Mes (AOV)
            </CardDescription>
            <CardTitle className="text-3xl font-bold tracking-tight text-white mt-1 font-serif">
              {loading ? (
                <RefreshCw className="h-6 w-6 animate-spin text-erp-gold" />
              ) : data ? (
                `$${data.averageOrderValueArs.toLocaleString('es-AR')}`
              ) : (
                '$0'
              )}
            </CardTitle>
          </div>
          <div className="h-11 w-11 rounded-xl bg-erp-gold/10 border border-erp-gold/30 flex items-center justify-center text-erp-gold shrink-0">
            <Receipt className="h-6 w-6" />
          </div>
        </CardHeader>

        <CardContent className="pt-2 text-xs text-zinc-400 space-y-1">
          {data && (
            <div className="flex items-center justify-between pt-2 border-t border-erp-border/60">
              <span className="text-[11px]">Transacciones del mes:</span>
              <span className="font-mono font-bold text-white">{data.totalSalesCount} ventas</span>
            </div>
          )}
          <p className="text-[11px] text-zinc-500 font-mono">
            AOV = Facturación mensual / Cantidad de ventas.
          </p>
        </CardContent>
      </Card>

      {/* CARD 2: TOP BEST SELLERS DEL MES CON TOGGLE TOP 3 / TOP 5 */}
      <Card className="border border-erp-border bg-erp-surface/90 rounded-2xl shadow-xl transition-all duration-300 hover:border-erp-gold/50">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardDescription className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-amber-500 animate-pulse" /> Top {displayLimit} Best Sellers del Mes
            </CardDescription>
            <CardTitle className="text-base font-bold text-zinc-200 mt-1 font-serif">
              Perfumes & Fragancias Más Vendidas
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-erp-bg border border-erp-border p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setDisplayLimit(3)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
                  displayLimit === 3
                    ? 'bg-erp-surface text-erp-gold border border-erp-gold/30'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Top 3
              </button>
              <button
                type="button"
                onClick={() => setDisplayLimit(5)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
                  displayLimit === 5
                    ? 'bg-erp-surface text-erp-gold border border-erp-gold/30'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Top 5
              </button>
            </div>
            <div className="h-11 w-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Trophy className="h-6 w-6" />
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-2 px-4 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-xs text-zinc-400 gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-erp-gold" />
              Cargando ranking del mes...
            </div>
          ) : !data || data.topBestSellers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-4 text-center text-zinc-500 gap-1">
              <ShoppingBag className="h-5 w-5 opacity-40 text-zinc-600" />
              <span className="text-xs">No hay ventas registradas en el mes en curso.</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {data.topBestSellers.slice(0, displayLimit).map((item, idx) => (
                <div 
                  key={item.product_id}
                  className="flex items-center justify-between text-xs bg-erp-bg/50 border border-erp-border rounded-xl p-2.5 transition-all hover:border-erp-gold/40"
                >
                  <div className="flex items-center gap-2.5 max-w-[70%]">
                    <span className={`h-6 w-6 rounded-lg font-mono text-xs font-black flex items-center justify-center shrink-0 ${
                      idx === 0 ? 'bg-erp-gold text-erp-bg' :
                      idx === 1 ? 'bg-zinc-300 text-zinc-900' :
                      idx === 2 ? 'bg-amber-700 text-amber-100' :
                      'bg-zinc-800 text-zinc-300 border border-zinc-700'
                    }`}>
                      #{idx + 1}
                    </span>
                    <div className="truncate">
                      <div className="font-bold text-white truncate" title={item.name}>
                        {item.name}
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate">
                        {item.brand} • SKU: {item.sku}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono font-black text-emerald-400 text-xs">
                      {item.units_sold} {item.units_sold === 1 ? 'unidad' : 'unidades'}
                    </div>
                    <div className="text-xs text-zinc-400 font-mono">
                      ${item.total_revenue_ars.toLocaleString('es-AR')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
