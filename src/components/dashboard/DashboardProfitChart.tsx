'use client';

import React, { useState, useMemo, memo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Activity } from 'lucide-react';

export type ChartCurrency = 'ARS' | 'USD_BLUE' | 'USDT';

const formatCurrencyValue = (val: number, currency: ChartCurrency) => {
  if (currency === 'ARS') {
    return `$${Math.round(val).toLocaleString('es-AR')}`;
  }
  if (currency === 'USD_BLUE') {
    return `u$s ${val.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `₮ ${val.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

interface TooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  currency?: ChartCurrency;
}

const CustomTooltip = memo(({ active, payload, label, currency = 'ARS' }: TooltipProps) => {
  if (active && payload && payload.length) {
    const payloadData = payload[0]?.payload;
    const ventas = payloadData?.Ventas ?? 0;
    const gananciaReal = payloadData?.GananciaReal ?? payloadData?.Ganancias ?? 0;
    const gananciaNeta = payloadData?.GananciaNeta ?? payloadData?.Ganancias ?? 0;
    const mesAnterior = payloadData?.VentasMesAnterior;

    const marginRealPercent = ventas > 0 ? ((gananciaReal / ventas) * 100).toFixed(1) : null;
    const marginNetPercent = ventas > 0 ? ((gananciaNeta / ventas) * 100).toFixed(1) : null;

    return (
      <div className="bg-erp-bg/95 border border-erp-border p-3.5 rounded-xl shadow-2xl text-xs space-y-1.5 backdrop-blur-md min-w-[240px]">
        <p className="font-mono font-bold text-zinc-400 border-b border-erp-border pb-1">Día: {label}</p>
        <div className="space-y-1.5 pt-0.5">
          <p className="font-bold text-erp-gold flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 font-sans">
              <span className="h-2 w-2 rounded-full bg-erp-gold"></span> Facturación Bruta:
            </span>
            <span className="font-mono">{formatCurrencyValue(ventas, currency)}</span>
          </p>
          <p className="font-bold text-emerald-400 flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 font-sans">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Ganancia Comercial Real:
            </span>
            <span className="font-mono">{formatCurrencyValue(gananciaReal, currency)}</span>
          </p>
          <p className="font-bold text-teal-300 flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 font-sans">
              <span className="h-2 w-2 rounded-full bg-teal-400"></span> Ganancia Neta Final:
            </span>
            <span className="font-mono">{formatCurrencyValue(gananciaNeta, currency)}</span>
          </p>
          <div className="border-t border-erp-border/60 pt-1 text-[11px] space-y-0.5 font-mono">
            <div className="flex items-center justify-between text-zinc-400">
              <span>Margen Comercial Real:</span>
              <span className="text-emerald-400 font-bold">{marginRealPercent ? `${marginRealPercent}%` : '-'}</span>
            </div>
            <div className="flex items-center justify-between text-zinc-400">
              <span>Margen Neto Final:</span>
              <span className="text-teal-300 font-bold">{marginNetPercent ? `${marginNetPercent}%` : '-'}</span>
            </div>
          </div>
          {mesAnterior !== undefined && (
            <p className="font-semibold text-zinc-400 flex items-center justify-between gap-3 border-t border-erp-border/60 pt-1 text-[11px]">
              <span>Ref. Mes Anterior:</span>
              <span className="font-mono text-zinc-300">{formatCurrencyValue(mesAnterior, currency)}</span>
            </p>
          )}
        </div>
      </div>
    );
  }
  return null;
});
CustomTooltip.displayName = 'CustomTooltip';

interface DashboardProfitChartProps {
  salesByDate: any[];
  exchangeRates: {
    blue: number;
    usdt: number;
  };
}

export const DashboardProfitChart = memo(function DashboardProfitChart({
  salesByDate,
  exchangeRates,
}: DashboardProfitChartProps) {
  const [chartCurrency, setChartCurrency] = useState<ChartCurrency>('ARS');

  const convertedChartData = useMemo(() => {
    if (!salesByDate || salesByDate.length === 0) return [];
    if (chartCurrency === 'ARS') return salesByDate;

    const rate = chartCurrency === 'USD_BLUE'
      ? (exchangeRates.blue || 1540)
      : (exchangeRates.usdt || 1590);

    return salesByDate.map((item: any) => ({
      ...item,
      Ventas: Number((item.Ventas / rate).toFixed(2)),
      Ganancias: Number((item.Ganancias / rate).toFixed(2)),
      GananciaReal: Number(((item.GananciaReal !== undefined ? item.GananciaReal : item.Ganancias) / rate).toFixed(2)),
      GananciaNeta: Number(((item.GananciaNeta !== undefined ? item.GananciaNeta : item.Ganancias) / rate).toFixed(2)),
      VentasMesAnterior: Number((item.VentasMesAnterior / rate).toFixed(2)),
    }));
  }, [salesByDate, chartCurrency, exchangeRates.blue, exchangeRates.usdt]);

  const yAxisTickFormatter = useMemo(() => {
    return (value: number) => {
      if (chartCurrency === 'ARS') {
        if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `$${Math.round(value / 1000)}k`;
        return `$${value}`;
      }
      if (chartCurrency === 'USD_BLUE') {
        if (value >= 1000) return `u$s ${(value / 1000).toFixed(1)}k`;
        return `u$s ${Math.round(value)}`;
      }
      if (value >= 1000) return `₮ ${(value / 1000).toFixed(1)}k`;
      return `₮ ${Math.round(value)}`;
    };
  }, [chartCurrency]);

  return (
    <Card className="border border-erp-border bg-erp-surface/90 rounded-2xl p-6 shadow-xl space-y-4">
      <CardHeader className="px-0 pt-0 pb-4 border-b border-erp-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-sm font-bold text-zinc-200 font-serif flex items-center gap-2">
            <Activity className="h-4.5 w-4.5 text-erp-gold" />
            Historial Diario de Facturación y Utilidades ({chartCurrency === 'ARS' ? 'ARS' : chartCurrency === 'USD_BLUE' ? 'USD Blue' : 'USDT'})
          </CardTitle>
          <CardDescription className="text-xs text-zinc-400">
            Comparativa diaria entre Facturación Bruta, Ganancia Comercial Real y Ganancia Neta Final.
          </CardDescription>
        </div>

        {/* SELECTOR SEGMENTED CONTROL TRIMONETARIO */}
        <div className="flex items-center gap-1 bg-erp-bg border border-erp-border p-0.5 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setChartCurrency('ARS')}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-colors duration-150 cursor-pointer ${
              chartCurrency === 'ARS'
                ? 'bg-erp-surface text-erp-gold border border-erp-gold/30 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            ARS ($)
          </button>
          <button
            type="button"
            onClick={() => setChartCurrency('USD_BLUE')}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-colors duration-150 cursor-pointer ${
              chartCurrency === 'USD_BLUE'
                ? 'bg-erp-surface text-erp-gold border border-erp-gold/30 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title={`Conversión basada en Dólar Blue ($${exchangeRates.blue} ARS)`}
          >
            USD Blue (u$s)
          </button>
          <button
            type="button"
            onClick={() => setChartCurrency('USDT')}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-colors duration-150 cursor-pointer ${
              chartCurrency === 'USDT'
                ? 'bg-erp-surface text-erp-gold border border-erp-gold/30 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title={`Conversión basada en USDT Binance ($${exchangeRates.usdt} ARS)`}
          >
            USDT (₮)
          </button>
        </div>
      </CardHeader>
      
      {convertedChartData.length > 0 ? (
        <div className="h-72 w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={convertedChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} style={{ fontSize: '11px', fill: 'var(--muted-foreground)' }} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={yAxisTickFormatter} style={{ fontSize: '11px', fill: 'var(--muted-foreground)' }} />
              <Tooltip content={<CustomTooltip currency={chartCurrency} />} />
              <Legend
                wrapperStyle={{ fontSize: '11px' }}
                formatter={(value) => <span className="text-zinc-400">{value}</span>}
              />
              <Bar name="Facturación Bruta" dataKey="Ventas" fill="#D0A96B" radius={[4, 4, 0, 0]} barSize={18} />
              <Area type="monotone" name="Ganancia Comercial Real" dataKey="Ganancias" fill="url(#profitGradient)" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981', strokeWidth: 1 }} activeDot={{ r: 5 }} />
              <Line type="monotone" name="Ganancia Neta Final" dataKey="GananciaNeta" stroke="#2dd4bf" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 2.5, fill: '#2dd4bf' }} activeDot={{ r: 4 }} />
              <Line
                type="monotone"
                name="Ref. Mes Anterior"
                dataKey="VentasMesAnterior"
                stroke="var(--muted-foreground)"
                strokeDasharray="3 3"
                strokeWidth={1.5}
                dot={convertedChartData.length === 1 ? { r: 4, fill: 'var(--muted-foreground)' } : false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-2 border border-dashed border-erp-border rounded-2xl bg-erp-bg/50 my-4">
          <Activity className="h-10 w-10 text-erp-gold/50" />
          <div className="text-sm font-bold text-white font-serif">Sin movimientos registrados</div>
          <div className="text-xs text-zinc-400 max-w-xs">No se registran transacciones en el período seleccionado.</div>
        </div>
      )}
    </Card>
  );
});
