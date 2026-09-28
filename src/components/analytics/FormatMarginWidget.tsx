'use client';

import React, { useEffect, useState } from 'react';
import { UserRole } from '@/types';
import { getFormatMarginAnalysis, FormatMarginAnalysis } from '@/app/actions/retailMetrics';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { RefreshCw, Droplet, ShoppingBag, TrendingUp, AlertCircle } from 'lucide-react';

interface FormatMarginWidgetProps {
  role: UserRole;
  startDate?: string;
  endDate?: string;
}

interface FormatTooltipPayloadItem {
  value?: number;
  name?: string;
  color?: string;
}

const CustomFormatTooltip = ({ active, payload, label }: { active?: boolean; payload?: FormatTooltipPayloadItem[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-erp-bg/95 border border-erp-border p-3 rounded-xl shadow-2xl text-xs space-y-1.5 backdrop-blur-md min-w-[220px]">
        <p className="font-serif font-bold text-erp-gold border-b border-erp-border pb-1">{label}</p>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4 text-zinc-300">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color || 'var(--muted-foreground)' }}></span>
              {p.name}
            </span>
            <span className="font-mono font-bold">${Number(p.value || 0).toLocaleString('es-AR')} ARS</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

/**
 * Análisis de Rentabilidad por Formato: margen bruto (%) y masa de margen (ARS)
 * comparando ventas de Decants Fraccionados frente a Frasco Cerrado en el período.
 */
export function FormatMarginWidget({ role, startDate, endDate }: FormatMarginWidgetProps) {
  const [data, setData] = useState<FormatMarginAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = async () => {
    if (role !== 'admin') return;
    setLoading(true);
    setError(null);
    const res = await getFormatMarginAnalysis(role, startDate, endDate);
    if (res.success && res.data) {
      setData(res.data);
    } else {
      setError(res.error || 'Error al calcular la rentabilidad por formato.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, startDate, endDate]);

  const chartData = (data?.rows || []).map((row) => ({
    name: row.label,
    Ingresos: row.totalRevenueArs,
    'Margen (ARS)': row.grossMarginArs,
  }));

  return (
    <Card className="border-slate-200 dark:border-erp-border">
      <CardHeader className="pb-2 border-b border-slate-100 dark:border-zinc-900">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="h-4.5 w-4.5 text-erp-gold" />
            Rentabilidad por Formato (Decant vs. Frasco Cerrado)
          </CardTitle>
          <button
            type="button"
            onClick={fetchAnalysis}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg cursor-pointer"
            title="Recalcular análisis"
            aria-label="Recalcular análisis de rentabilidad por formato"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-erp-gold' : ''}`} />
          </button>
        </div>
        <CardDescription className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
          Costo congelado de cada venta (misma fuente que el P&L). {data && data.marginDeltaPercent !== 0 ? `Delta de margen: ${data.marginDeltaPercent > 0 ? '+' : ''}${data.marginDeltaPercent}% ${data.marginDeltaPercent > 0 ? 'a favor del decant' : 'a favor del frasco'}.` : ''}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {loading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="h-24 rounded-xl bg-slate-100 dark:bg-erp-surface animate-pulse" />
              <div className="h-24 rounded-xl bg-slate-100 dark:bg-erp-surface animate-pulse" />
            </div>
            <div className="h-56 rounded-xl bg-slate-100 dark:bg-erp-surface animate-pulse" />
          </div>
        ) : error || !data ? (
          <div className="flex flex-col items-center justify-center py-10 text-rose-500 gap-2">
            <AlertCircle className="h-8 w-8 text-rose-600" />
            <p className="text-xs font-semibold">{error || 'No se pudieron calcular las métricas.'}</p>
          </div>
        ) : data.rows.every((r) => r.totalRevenueArs === 0) ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400 dark:text-zinc-500 space-y-2">
            <ShoppingBag className="h-8 w-8 opacity-40" />
            <p className="text-xs">Sin ventas en el período seleccionado.</p>
          </div>
        ) : (
          <>
            {/* BLOQUES COMPARATIVOS POR FORMATO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.rows.map((row) => {
                const isDecant = row.format === 'decant_liquid';
                const hasData = row.totalRevenueArs > 0;
                return (
                  <div
                    key={row.format}
                    className={`p-3.5 rounded-xl border space-y-2 ${
                      isDecant
                        ? 'bg-emerald-500/5 border-emerald-500/20 dark:bg-emerald-500/10'
                        : 'bg-slate-50 dark:bg-erp-bg border-slate-200 dark:border-erp-border'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                        {isDecant ? <Droplet className="h-3.5 w-3.5 text-emerald-500" /> : <ShoppingBag className="h-3.5 w-3.5 text-erp-gold" />}
                        {row.label}
                      </div>
                      <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${hasData ? (row.grossMarginArs >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400') : 'bg-slate-200/50 text-slate-400 dark:bg-erp-surface'}`}>
                        {hasData ? `${row.grossMarginPercent}% margen` : 'Sin ventas'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div>
                        <span className="block text-slate-400 dark:text-zinc-500 uppercase text-[10px] font-sans font-bold">Ingresos</span>
                        <span className="font-bold text-slate-900 dark:text-white">${row.totalRevenueArs.toLocaleString('es-AR')}</span>
                      </div>
                      <div>
                        <span className="block text-slate-400 dark:text-zinc-500 uppercase text-[10px] font-sans font-bold">Margen ARS</span>
                        <span className={`font-bold ${row.grossMarginArs >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                          ${row.grossMarginArs.toLocaleString('es-AR')}
                        </span>
                      </div>
                      <div>
                        <span className="block text-slate-400 dark:text-zinc-500 uppercase text-[10px] font-sans font-bold">Ventas</span>
                        <span className="font-bold text-slate-900 dark:text-white">{row.salesCount}</span>
                      </div>
                      <div>
                        <span className="block text-slate-400 dark:text-zinc-500 uppercase text-[10px] font-sans font-bold">Unidades</span>
                        <span className="font-bold text-slate-900 dark:text-white">{row.unitsSold.toLocaleString('es-AR')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* MINI GRÁFICO COMPARATIVO */}
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} />
                  <Tooltip content={<CustomFormatTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '11px' }}
                    formatter={(value) => <span className="text-slate-700 dark:text-zinc-300">{value}</span>}
                  />
                  <Bar name="Ingresos" dataKey="Ingresos" fill="#D0A96B" radius={[4, 4, 0, 0]} />
                  <Bar name="Margen (ARS)" dataKey="Margen (ARS)" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
