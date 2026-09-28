'use client';

import React, { useState, useEffect } from 'react';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Activity, CreditCard, Database, DollarSign, RefreshCw, ShoppingBag, 
  ShieldCheck, HelpCircle, ShoppingCart, User, ShieldCheck as AuditIcon, 
  AlertCircle, Coins, TrendingUp, Percent, Users, AlertTriangle, Clock, 
  ChevronRight, ArrowRight, Sparkles, Check, PackagePlus, Truck, FileText, Printer, ExternalLink 
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useUserStore } from '@/hooks/use-user-store';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import { ShiftStatusBadge } from '@/components/cash/ShiftStatusBadge';
import { getDashboardData } from '@/app/actions/reports';
import { StockAlertWidget } from '@/components/products/StockAlertWidget';
import { MonthlyGoalsWidget } from '@/components/goals/MonthlyGoalsWidget';
import { RetailKPIsWidget } from '@/components/dashboard/RetailKPIsWidget';
import { InventoryValuationWidget } from '@/components/inventory/InventoryValuationWidget';
import { ExchangeRatesWidget } from '@/components/rates/ExchangeRatesWidget';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { QuickAccessPills } from '@/components/dashboard/QuickAccessPills';
import { ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type ChartCurrency = 'ARS' | 'USD_BLUE' | 'USDT';

const formatCurrencyValue = (val: number, currency: ChartCurrency) => {
  if (currency === 'ARS') {
    return `$${Math.round(val).toLocaleString('es-AR')}`;
  }
  if (currency === 'USD_BLUE') {
    return `u$s ${val.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  }
  return `₮ ${val.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
};

// Componente Tooltip personalizado para el gráfico de Recharts con ROI Diario y Soporte Trimonetario
const CustomTooltip = ({ active, payload, label, currency = 'ARS' }: { active?: boolean; payload?: any[]; label?: string; currency?: ChartCurrency }) => {
  if (active && payload && payload.length) {
    const payloadData = payload[0]?.payload;
    const ventas = Number(payload.find((p: any) => p.dataKey === 'Ventas')?.value || 0);
    const gananciaReal = Number(payload.find((p: any) => p.dataKey === 'Ganancias')?.value || 0);
    const gananciaNeta = Number(payload.find((p: any) => p.dataKey === 'GananciaNeta')?.value ?? payloadData?.GananciaNeta ?? gananciaReal);
    const mesAnteriorItem = payload.find((p: any) => p.dataKey === 'VentasMesAnterior');
    const mesAnterior = mesAnteriorItem ? Number(mesAnteriorItem.value) : undefined;

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
};

import { SaleDetailModal } from '@/components/pos/SaleDetailModal';

export default function DashboardPage() {
  const role = useUserStore((state) => state.role);
  const { refresh: refreshRate, rate: activeStoreRate } = useExchangeRate();

  const [stats, setStats] = useState<any>(null);
  const [period, setPeriod] = useState<'current_month' | 'all_time'>('current_month');
  const [chartCurrency, setChartCurrency] = useState<ChartCurrency>('ARS');
  const [exchangeRates, setExchangeRates] = useState<{ blue: number; usdt: number }>({
    blue: 1540,
    usdt: 1590,
  });
  const [loadingStats, setLoadingStats] = useState<boolean>(true);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  const loadDashboardData = async (selectedPeriod: 'current_month' | 'all_time' = period) => {
    if (role === 'admin') {
      setLoadingStats(true);
      const res = await getDashboardData(role, selectedPeriod);
      if (res.success && res.data) {
        setStats(res.data);
      }
      setLoadingStats(false);
    } else {
      setStats(null);
    }
  };

  useEffect(() => {
    loadDashboardData(period);
  }, [role, period]);

  useEffect(() => {
    // Sincronizar cotizaciones en vivo para Blue y USDT
    Promise.allSettled([
      fetch('https://dolarapi.com/v1/dolares/blue').then(res => res.ok ? res.json() : null),
      fetch('https://criptoya.com/api/binance/usdt/ars').then(res => res.ok ? res.json() : null),
    ]).then(([resBlue, resBinance]) => {
      let blueVal = activeStoreRate || 1540;
      let usdtVal = 1590;
      if (resBlue.status === 'fulfilled' && resBlue.value?.venta) {
        const v = Number(resBlue.value.venta);
        if (v > 0) blueVal = v;
      }
      if (resBinance.status === 'fulfilled' && resBinance.value?.ask) {
        const v = Number(resBinance.value.ask);
        if (v > 0) usdtVal = v;
      }
      setExchangeRates({ blue: blueVal, usdt: usdtVal });
    }).catch(() => {
      if (activeStoreRate) {
        setExchangeRates({ blue: activeStoreRate, usdt: activeStoreRate });
      }
    });
  }, [activeStoreRate]);

  const convertedChartData = React.useMemo(() => {
    if (!stats?.salesByDate) return [];
    if (chartCurrency === 'ARS') return stats.salesByDate;

    const rate = chartCurrency === 'USD_BLUE'
      ? (exchangeRates.blue || activeStoreRate || 1540)
      : (exchangeRates.usdt || 1590);

    return stats.salesByDate.map((item: any) => ({
      ...item,
      Ventas: Number((item.Ventas / rate).toFixed(2)),
      Ganancias: Number((item.Ganancias / rate).toFixed(2)),
      GananciaReal: Number(((item.GananciaReal !== undefined ? item.GananciaReal : item.Ganancias) / rate).toFixed(2)),
      GananciaNeta: Number(((item.GananciaNeta !== undefined ? item.GananciaNeta : item.Ganancias) / rate).toFixed(2)),
      VentasMesAnterior: Number((item.VentasMesAnterior / rate).toFixed(2)),
    }));
  }, [stats?.salesByDate, chartCurrency, exchangeRates, activeStoreRate]);

  const yAxisTickFormatter = (value: number) => {
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

  return (
    <div className="flex flex-col min-h-screen bg-erp-bg text-zinc-50 transition-colors duration-300">
      
      {/* HEADER MINIMALISTA CONTROL BAR */}
      <header className="sticky top-0 z-40 w-full border-b border-erp-border bg-erp-bg/90 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 max-w-7xl">
          <div>
            <h1 className="text-base font-bold text-white font-serif tracking-wider">
              {role === 'admin' ? 'Dashboard de Control Financiero' : 'Panel de Operaciones POS'}
            </h1>
            <p className="text-[11px] text-zinc-400 font-mono">
              Elohim Import ERP • Modulo Enterprise
            </p>
          </div>

          <div className="flex items-center gap-3">
            <kbd className="hidden lg:inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-xl bg-erp-surface border border-erp-border text-erp-gold font-extrabold shadow-sm">
              <span className="text-xs">⌘</span> K Omnibar
            </kbd>
            <ShiftStatusBadge />
            <RoleSelector />
            <ExchangeRateWidget role={role} onRateChange={refreshRate} />
          </div>
        </div>
      </header>

      {/* CUERPO PRINCIPAL */}
      <main className="flex-1 container mx-auto px-4 py-6 sm:px-6 max-w-7xl space-y-6">
        
        {/* MONITOR DE COTIZACIONES EN VIVO */}
        <ExchangeRatesWidget />

        {/* BOTONERA DE ACCIONES RÁPIDAS (QUICK ACTIONS) */}
        <QuickActions />

        {/* ------------------ VISTA DE ADMINISTRADOR ------------------ */}
        {role === 'admin' && (
          <div className="space-y-6">
            
            {/* CONTROL DE PERÍODO DEL DASHBOARD */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-erp-border pb-4">
              <div>
                <h2 className="text-lg font-bold font-serif text-white flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-erp-gold" />
                  {period === 'current_month' ? 'Resumen Financiero del Mes en Curso' : 'Resumen Financiero Histórico Total'}
                </h2>
                <p className="text-xs text-zinc-400">
                  {period === 'current_month' 
                    ? 'Facturación real, margen comercial bruto, OPEX y rentabilidad neta del mes actual.' 
                    : 'Acumulado comercial histórico consolidado de todas las operaciones.'}
                </p>
              </div>

              <div className="flex items-center gap-1.5 bg-erp-bg border border-erp-border p-1 rounded-xl self-start sm:self-auto">
                <button
                  onClick={() => setPeriod('current_month')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    period === 'current_month'
                      ? 'bg-erp-surface text-erp-gold border border-erp-gold/30 shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Mes Actual
                </button>
                <button
                  onClick={() => setPeriod('all_time')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    period === 'all_time'
                      ? 'bg-erp-surface text-erp-gold border border-erp-gold/30 shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Histórico Total
                </button>
              </div>
            </div>

            {loadingStats ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 border border-erp-border bg-erp-surface/60 rounded-2xl">
                <RefreshCw className="h-8 w-8 animate-spin text-erp-gold" />
                <span className="text-sm font-semibold text-zinc-400">Cargando analíticas comerciales...</span>
              </div>
            ) : stats ? (
              <>
                {/* GRILLA KPI CARDS CON JERARQUÍA TYPOGRAPHY Y ICONOS DORADOS */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  
                  {/* Card 1: Facturación / Ingresos Totales */}
                  <Card className="border border-erp-border bg-erp-surface/90 rounded-2xl shadow-xl transition-all duration-300 hover:border-erp-gold/50">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                      <div>
                        <CardDescription className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-400">
                          {period === 'current_month' ? 'Facturación del Mes (ARS)' : 'Facturación Total (ARS)'}
                        </CardDescription>
                        <CardTitle className="text-3xl font-bold tracking-tight text-white mt-1.5 font-serif">
                          ${Math.round(stats.totalRevenueArs).toLocaleString('es-AR')}
                        </CardTitle>
                        <p className="text-[11px] text-zinc-400 font-mono mt-1">
                          u$s {stats.totalRevenueUsd.toFixed(2)} equiv.
                        </p>
                      </div>
                      <div className="h-11 w-11 rounded-xl bg-erp-gold/10 border border-erp-gold/30 flex items-center justify-center text-erp-gold shrink-0">
                        <Coins className="h-6 w-6" />
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Card 2: Ganancia Comercial Real (Limpia) */}
                  <Card className="border border-erp-border bg-erp-surface/90 rounded-2xl shadow-xl transition-all duration-300 hover:border-erp-gold/50">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                      <div>
                        <CardDescription className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-400">
                          Ganancia Comercial Real (Limpia)
                        </CardDescription>
                        <CardTitle className="text-3xl font-bold tracking-tight text-erp-gold mt-1.5 font-serif">
                          ${Math.round(stats.grossMarginArs || 0).toLocaleString('es-AR')}
                        </CardTitle>
                        <p className="text-[11px] text-zinc-400 font-mono mt-1">
                          {stats.grossMarginPercent}% sobre ventas (s/ productos)
                        </p>
                      </div>
                      <div className="h-11 w-11 rounded-xl bg-erp-gold/10 border border-erp-gold/30 flex items-center justify-center text-erp-gold shrink-0">
                        <TrendingUp className="h-6 w-6" />
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Card 3: Gastos Operativos (OPEX) */}
                  <Card className="border border-erp-border bg-erp-surface/90 rounded-2xl shadow-xl transition-all duration-300 hover:border-amber-500/40">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                      <div>
                        <CardDescription className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-400">
                          Gastos Operativos (OPEX)
                        </CardDescription>
                        <CardTitle className="text-3xl font-bold tracking-tight text-amber-400 mt-1.5 font-serif">
                          ${Math.round(stats.opexArs || 0).toLocaleString('es-AR')}
                        </CardTitle>
                        <p className="text-[11px] text-zinc-400 font-mono mt-1">
                          Testers, mermas y suministros
                        </p>
                      </div>
                      <div className="h-11 w-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                        <CreditCard className="h-6 w-6 text-amber-400" />
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Card 4: Ganancia Neta Final (de Bolsillo) */}
                  <Card className="border border-erp-border bg-erp-surface/90 rounded-2xl shadow-xl transition-all duration-300 hover:border-emerald-500/40">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                      <div>
                        <CardDescription className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-400">
                          Ganancia Neta Final (de Bolsillo)
                        </CardDescription>
                        <CardTitle className="text-3xl font-bold tracking-tight text-emerald-400 mt-1.5 font-serif">
                          ${Math.round(stats.estimatedProfitArs).toLocaleString('es-AR')}
                        </CardTitle>
                        <p className="text-[11px] text-emerald-400/90 font-mono mt-1">
                          {stats.totalRevenueArs > 0 
                            ? `${((stats.estimatedProfitArs / stats.totalRevenueArs) * 100).toFixed(1)}% margen neto` 
                            : '0.0% margen neto'} (deduciendo OPEX y pasarelas)
                        </p>
                      </div>
                      <div className="h-11 w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                        <DollarSign className="h-6 w-6 text-erp-gold" />
                      </div>
                    </CardHeader>
                  </Card>
                </div>

                {/* WIDGET DE VALORACIÓN Y PROYECCIÓN DE INVENTARIO (NUEVA FILA EXCLUSIVA) */}
                {role === 'admin' && (
                  <div className="my-6">
                    <InventoryValuationWidget />
                  </div>
                )}

                {/* WIDGET DE KPIS RETAIL: TICKET PROMEDIO (AOV) & TOP 3 BEST SELLERS */}
                {role === 'admin' && (
                  <div>
                    <RetailKPIsWidget />
                  </div>
                )}

                {/* WIDGET DE METAS MENSUALES Y RUN RATE */}
                {role === 'admin' && (
                  <div className="mb-6">
                    <MonthlyGoalsWidget />
                  </div>
                )}

                {/* GRILLA INFERIOR ESTRUCTURADA: GRÁFICO (COL 2) + PANELS (COL 1) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* GRÁFICO RECHARTS (Col-span 2) */}
                  <div className="lg:col-span-2">
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
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
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
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
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
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
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
                  </div>

                  {/* PANELES LATERALES (Col-span 1) */}
                  <div className="space-y-6">
                    
                    {/* RADAR DE RE-STOCK & ALERTAS */}
                    <StockAlertWidget />
                    
                    {/* PANEL 1: ALERTAS STOCK CRÍTICO */}
                    <Card className="border border-erp-border bg-erp-surface/90 rounded-2xl shadow-xl">
                      <CardHeader className="pb-3 border-b border-erp-border">
                        <CardTitle className="text-xs font-extrabold text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          Stock Crítico (&lt; 3)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4 px-4 pb-4">
                        {stats.criticalStock.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                              <Check className="h-4 w-4" />
                            </div>
                            <span className="text-xs font-semibold text-emerald-400">¡Todo el stock está en niveles seguros!</span>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {stats.criticalStock.map((prod: any) => (
                              <div key={prod.id} className="flex items-center justify-between text-xs bg-erp-bg/40 border border-erp-border rounded-xl p-2.5">
                                <div className="max-w-[70%]">
                                  <div className="font-bold text-white truncate" title={prod.name}>
                                    {prod.name}
                                  </div>
                                  <div className="text-[11px] text-zinc-500 mt-0.5 truncate">
                                    SKU: {prod.sku} • {prod.type === 'bottle' ? 'Botella' : 'Envase'}
                                  </div>
                                </div>
                                <span className={`font-mono font-extrabold px-2 py-0.5 rounded-lg text-[11px] ${
                                  prod.stock_quantity === 0 
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}>
                                  {prod.stock_quantity} {prod.type === 'bottle' ? 'ud' : 'frascos'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                      {stats.criticalStock.length > 0 && (
                        <CardFooter className="pb-4 border-t border-erp-border px-4 pt-3 flex justify-end">
                          <Link href="/productos" className="text-[11px] font-bold text-erp-gold hover:text-erp-gold-hover flex items-center gap-0.5">
                            Gestionar Inventario <ChevronRight className="h-3 w-3" />
                          </Link>
                        </CardFooter>
                      )}
                    </Card>

                    {/* PANEL 2: ÚLTIMAS VENTAS */}
                    <Card className="border border-erp-border bg-erp-surface/90 rounded-2xl shadow-xl">
                      <CardHeader className="pb-3 border-b border-erp-border">
                        <CardTitle className="text-xs font-extrabold text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-erp-gold" />
                          Últimas 5 Ventas
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4 px-4 pb-4">
                        {stats.recentSales.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-6 text-center text-zinc-500 gap-1">
                            <ShoppingCart className="h-6 w-6 opacity-35 text-zinc-600" />
                            <span className="text-xs">No se registran ventas históricas.</span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {stats.recentSales.map((sale: any) => (
                              <div 
                                key={sale.id} 
                                onClick={() => setSelectedSaleId(sale.id)}
                                className="flex items-center justify-between text-xs p-2 rounded-xl border border-erp-border/60 bg-erp-bg/30 hover:bg-erp-bg hover:border-erp-gold/50 transition-all cursor-pointer group"
                                title="Ver comprobante y detalle de venta"
                              >
                                <div>
                                  <div className="font-bold text-zinc-200 group-hover:text-erp-gold transition-colors">
                                    {sale.client_name}
                                  </div>
                                  <div className="text-xs text-zinc-500 font-mono mt-0.5">
                                    {new Date(sale.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} • Ticket: #{sale.id.split('-')[0].toUpperCase()}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="font-mono font-black text-emerald-400 block">
                                    +${sale.total_ars.toLocaleString('es-AR')}
                                  </span>
                                  <span className="text-xs text-zinc-500 underline group-hover:text-zinc-300">Ver detalle</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                      {stats.recentSales.length > 0 && (
                        <CardFooter className="pb-4 border-t border-erp-border px-4 pt-3 flex justify-end">
                          <Link href="/clientes" className="text-[11px] font-bold text-erp-gold hover:text-erp-gold-hover flex items-center gap-0.5">
                            Ver Clientes & Ventas <ChevronRight className="h-3 w-3" />
                          </Link>
                        </CardFooter>
                      )}
                    </Card>

                  </div>

                </div>

              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 gap-3 border border-erp-border bg-erp-surface/90 rounded-2xl text-zinc-400">
                <AlertCircle className="h-10 w-10 text-rose-500" />
                <h3 className="font-bold text-white">Error de Carga</h3>
                <p className="text-xs text-zinc-500">No se pudieron recuperar las métricas desde la base de datos.</p>
                <Button onClick={() => loadDashboardData(period)} className="mt-2">Reintentar</Button>
              </div>
            )}

          </div>
        )}

        {/* ------------------ VISTA DE VENDEDOR ------------------ */}
        {role === 'seller' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Mensaje de Bienvenida */}
            <Card className="border border-erp-border bg-erp-surface/90 rounded-2xl shadow-xl p-6 overflow-hidden relative">
              <div className="absolute top-0 right-0 h-40 w-40 bg-gradient-to-bl from-violet-500/10 to-transparent rounded-full -mr-10 -mt-10" />
              <div className="space-y-2 max-w-lg">
                <div className="flex items-center gap-1.5 text-erp-gold text-xs font-bold uppercase tracking-widest">
                  <Sparkles className="h-4 w-4" /> Vendedor Autorizado
                </div>
                <h2 className="text-xl font-bold font-serif text-white">
                  ¡Terminal de Ventas Elohim Import ERP Lista!
                </h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Tienes acceso operativo rápido para atender clientes en mostrador, realizar cotizaciones y registrar la salida de perfumes sellados e insumos con ensamble JIT de decants en vivo.
                </p>
              </div>
            </Card>

            {/* Accesos rápidos de Vendedor */}
            <div className="grid gap-6 md:grid-cols-3">
              
              {/* Acceso POS */}
              <Card className="border border-erp-border bg-erp-surface/90 rounded-2xl shadow-xl hover:border-emerald-500/40 transition-all duration-300 flex flex-col justify-between">
                <CardHeader>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <ShoppingCart className="h-5 w-5" />
                  </div>
                  <CardTitle className="mt-4 font-serif text-lg text-white">Punto de Venta (POS)</CardTitle>
                  <CardDescription className="text-xs text-zinc-400">
                    Registra facturación bimonetaria mixta, calcula vueltos y realiza envasado de decants JIT.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Link href="/pos" className="w-full">
                    <Button className="w-full justify-center bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer h-10 text-xs font-bold shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02]">
                      Abrir Terminal <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Acceso Catálogo */}
              <Card className="border border-erp-border bg-erp-surface/90 rounded-2xl shadow-xl hover:border-indigo-500/40 transition-all duration-300 flex flex-col justify-between">
                <CardHeader>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <CardTitle className="mt-4 font-serif text-lg text-white">Consultar Catálogo</CardTitle>
                  <CardDescription className="text-xs text-zinc-400">
                    Visualiza el stock disponible de botellas comerciales, mililitros líquidos y frascos de envases.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Link href="/productos" className="w-full">
                    <Button className="w-full justify-center bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer h-10 text-xs font-bold shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02]">
                      Ver Stock <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Acceso CRM */}
              <Card className="border border-erp-border bg-erp-surface/90 rounded-2xl shadow-xl hover:border-erp-gold/40 transition-all duration-300 flex flex-col justify-between">
                <CardHeader>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-erp-gold/10 border border-violet-500/20 text-erp-gold">
                    <Users className="h-5 w-5" />
                  </div>
                  <CardTitle className="mt-4 font-serif text-lg text-white">CRM de Clientes</CardTitle>
                  <CardDescription className="text-xs text-zinc-400">
                    Administra contactos de clientes, registra nuevos y consulta perfiles olfativos.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Link href="/clientes" className="w-full">
                    <Button className="w-full justify-center bg-erp-gold hover:bg-erp-gold-hover text-erp-bg font-extrabold shadow-md shadow-erp-gold/20 text-white cursor-pointer h-10 text-xs font-bold shadow-md shadow-violet-600/20 transition-all hover:scale-[1.02]">
                      Ver Clientes <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>

            </div>

          </div>
        )}

        {/* BARRA INFERIOR DE ACCESOS RÁPIDOS MÓDULOS */}
        <QuickAccessPills />

      </main>

      {/* FOOTER */}
      <footer className="border-t border-erp-border bg-erp-bg py-6 mt-12">
        <div className="container mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 max-w-6xl">
          <p>© 2026 Elohim Import ERP. Todos los derechos reservados.</p>
          <div className="flex gap-4">
            <span className="hover:text-zinc-300">Security by Design (RLS)</span>
            <span>•</span>
            <span className="hover:text-zinc-300">Bimonetario Base ARS</span>
          </div>
        </div>
      </footer>

      {/* MODAL DE DETALLE Y COMPROBANTE DE VENTA */}
      <SaleDetailModal
        isOpen={!!selectedSaleId}
        onClose={() => setSelectedSaleId(null)}
        saleId={selectedSaleId}
      />
    </div>
  );
}
