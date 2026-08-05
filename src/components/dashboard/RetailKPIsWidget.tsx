'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { getRetailKPIs, RetailKPIsData } from '@/app/actions/reports';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Receipt, Trophy, Flame, ShoppingBag, RefreshCw, AlertCircle, TrendingUp } from 'lucide-react';

export function RetailKPIsWidget() {
  const { role } = useUserStore();
  const [data, setData] = useState<RetailKPIsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKPIs = async () => {
    if (role !== 'admin') return;
    setLoading(true);
    setError(null);
    const res = await getRetailKPIs(role);
    if (res.success && res.data) {
      setData(res.data);
    } else {
      setError(res.error || 'Error al obtener métricas de Retail');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchKPIs();
  }, [role]);

  if (role !== 'admin') return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* CARD 1: TICKET PROMEDIO (AOV) */}
      <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl transition-all duration-300 hover:border-[#D0A96B]/50">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardDescription className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">
              Ticket Promedio del Mes (AOV)
            </CardDescription>
            <CardTitle className="text-3xl font-bold tracking-tight text-white mt-1 font-serif">
              {loading ? (
                <RefreshCw className="h-6 w-6 animate-spin text-[#D0A96B]" />
              ) : data ? (
                `$${data.averageOrderValueArs.toLocaleString('es-AR')}`
              ) : (
                '$0'
              )}
            </CardTitle>
          </div>
          <div className="h-11 w-11 rounded-xl bg-[#D0A96B]/10 border border-[#D0A96B]/30 flex items-center justify-center text-[#D0A96B] shrink-0">
            <Receipt className="h-6 w-6" />
          </div>
        </CardHeader>

        <CardContent className="pt-2 text-xs text-zinc-400 space-y-1">
          {data && (
            <div className="flex items-center justify-between pt-2 border-t border-[#1B362A]/60">
              <span className="text-[11px]">Transacciones del mes:</span>
              <span className="font-mono font-bold text-white">{data.totalSalesCount} ventas</span>
            </div>
          )}
          <p className="text-[10px] text-zinc-500 font-mono">
            AOV = Facturación mensual / Cantidad de ventas.
          </p>
        </CardContent>
      </Card>

      {/* CARD 2: TOP 3 BEST SELLERS DEL MES */}
      <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl transition-all duration-300 hover:border-[#D0A96B]/50">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardDescription className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-amber-500 animate-pulse" /> Top 3 Best Sellers del Mes
            </CardDescription>
            <CardTitle className="text-base font-bold text-zinc-200 mt-1 font-serif">
              Perfumes & Fragancias Más Vendidas
            </CardTitle>
          </div>
          <div className="h-11 w-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Trophy className="h-6 w-6" />
          </div>
        </CardHeader>

        <CardContent className="pt-2 px-4 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-xs text-zinc-400 gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-[#D0A96B]" />
              Cargando ranking del mes...
            </div>
          ) : !data || data.topBestSellers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-4 text-center text-zinc-500 gap-1">
              <ShoppingBag className="h-5 w-5 opacity-40 text-zinc-600" />
              <span className="text-xs">No hay ventas registradas en el mes en curso.</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {data.topBestSellers.map((item, idx) => (
                <div 
                  key={item.product_id}
                  className="flex items-center justify-between text-xs bg-[#08130E]/50 border border-[#1B362A] rounded-xl p-2.5 transition-all hover:border-[#D0A96B]/40"
                >
                  <div className="flex items-center gap-2.5 max-w-[70%]">
                    <span className={`h-6 w-6 rounded-lg font-mono text-xs font-black flex items-center justify-center shrink-0 ${
                      idx === 0 ? 'bg-[#D0A96B] text-[#08130E]' :
                      idx === 1 ? 'bg-zinc-300 text-zinc-900' :
                      'bg-amber-700 text-amber-100'
                    }`}>
                      #{idx + 1}
                    </span>
                    <div className="truncate">
                      <div className="font-bold text-white truncate" title={item.name}>
                        {item.name}
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">
                        {item.brand} • SKU: {item.sku}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono font-black text-emerald-400 text-xs">
                      {item.units_sold} {item.units_sold === 1 ? 'unidad' : 'unidades'}
                    </div>
                    <div className="text-[9px] text-zinc-400 font-mono">
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
