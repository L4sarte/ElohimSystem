'use client';

import React, { useState, useEffect } from 'react';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Activity, Coins, DollarSign, RefreshCw, ShoppingBag, 
  TrendingUp, Percent, ShieldAlert, Sparkles, Check, ChevronRight, ArrowLeft 
} from 'lucide-react';
import Link from 'next/link';
import { useUserStore } from '@/hooks/use-user-store';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import { ShiftStatusBadge } from '@/components/cash/ShiftStatusBadge';
import { getDashboardData } from '@/app/actions/reports';
import { StockAlertWidget } from '@/components/products/StockAlertWidget';
import { MonthlyGoalsWidget } from '@/components/goals/MonthlyGoalsWidget';
import { RetailKPIsWidget } from '@/components/dashboard/RetailKPIsWidget';
import { InventoryValuationWidget } from '@/components/inventory/InventoryValuationWidget';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { QuickAccessPills } from '@/components/dashboard/QuickAccessPills';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload;
    const ventas = data?.Ventas ?? payload[0]?.value;
    const gananciaReal = data?.Ganancias ?? payload[1]?.value;
    const gananciaNeta = data?.GananciaNeta !== undefined ? data?.GananciaNeta : payload[2]?.value;

    return (
      <div className="bg-erp-bg/95 border border-erp-border p-3 rounded-xl shadow-2xl text-xs space-y-1.5 backdrop-blur-md min-w-[220px]">
        <p className="font-serif font-bold text-erp-gold border-b border-erp-border pb-1">Día: {label}</p>
        <p className="text-zinc-200 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-erp-gold"></span> Facturación:
          </span>
          <span className="font-mono text-erp-gold font-bold">${Number(ventas || 0).toLocaleString('es-AR')}</span>
        </p>
        <p className="text-zinc-200 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Ganancia Comercial:
          </span>
          <span className="font-mono text-emerald-400 font-bold">${Number(gananciaReal || 0).toLocaleString('es-AR')}</span>
        </p>
        {gananciaNeta !== undefined && (
          <p className="text-zinc-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-teal-400"></span> Ganancia Neta:
            </span>
            <span className="font-mono text-teal-300 font-bold">${Number(gananciaNeta || 0).toLocaleString('es-AR')}</span>
          </p>
        )}
      </div>
    );
  }
  return null;
};

export default function AdminDashboardPage() {
  const role = useUserStore((state) => state.role);
  const { rate, refresh: refreshRate } = useExchangeRate();

  const [stats, setStats] = useState<{
    totalRevenueArs: number;
    totalRevenueUsd: number;
    grossMarginArs: number;
    grossMarginPercent: number;
    estimatedProfitArs: number;
    salesByDate: Array<{
      date: string;
      Ventas: number;
      Ganancias: number;
      GananciaReal?: number;
      GananciaNeta?: number;
    }>;
  }>({
    totalRevenueArs: 0,
    totalRevenueUsd: 0,
    grossMarginArs: 0,
    grossMarginPercent: 0,
    estimatedProfitArs: 0,
    salesByDate: []
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    const res = await getDashboardData(role);
    if (res.success && res.data) {
      setStats({
        totalRevenueArs: res.data.totalRevenueArs,
        totalRevenueUsd: res.data.totalRevenueUsd,
        grossMarginArs: res.data.grossMarginArs || 0,
        grossMarginPercent: res.data.grossMarginPercent || 0,
        estimatedProfitArs: res.data.estimatedProfitArs,
        salesByDate: res.data.salesByDate || []
      });
    } else {
      setError(res.error || 'Error al cargar estadísticas del panel');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, [role]);

  if (role !== 'admin') {
    return (
      <div className="min-h-screen bg-erp-bg flex flex-col items-center justify-center text-center p-4">
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 max-w-md space-y-4 shadow-2xl">
          <ShieldAlert className="h-12 w-12 mx-auto text-rose-500" />
          <h2 className="text-xl font-bold font-serif">Acceso Restringido</h2>
          <p className="text-xs text-zinc-400">
            El Panel General de Administración es exclusivo para usuarios con rol Administrador.
          </p>
          <Link href="/">
            <Button variant="outline" size="sm" className="border-erp-border bg-erp-bg text-xs font-bold text-white">
              Volver al Inicio
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-erp-bg text-zinc-50 transition-colors duration-300">
      
      {/* NAVBAR GLASSMORPHISM */}
      <header className="sticky top-0 z-40 w-full border-b border-erp-border bg-erp-bg/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 max-w-7xl">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
              <span>Inicio</span>
            </Link>
            <span className="text-zinc-800">|</span>
            <div className="flex items-center gap-2">
              <img src="/logo-elohim.png" alt="Elohim Import" className="h-7 w-auto object-contain" />
              <span className="text-sm font-bold tracking-tight text-white uppercase font-serif hidden sm:inline-block">
                Panel General de Administración
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ShiftStatusBadge />
            <RoleSelector />
            <ExchangeRateWidget role={role} onRateChange={refreshRate} />
          </div>
        </div>
      </header>

      {/* CUERPO PRINCIPAL DEL DASHBOARD ADMIN */}
      <main className="flex-1 container mx-auto px-4 py-8 sm:px-6 max-w-7xl space-y-6">
        
        {/* BANNER BIENVENIDA */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-erp-surface p-6 rounded-2xl border border-erp-border shadow-xl">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-erp-gold flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Elohim Import ERP Enterprise
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white font-serif mt-1">
              Panel Control de Gestión
            </h1>
            <p className="text-xs text-zinc-400 mt-1 max-w-xl">
              Consolidación bimonetaria de inventario, ventas, margen neta y valuación de capital en stock.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStats}
              disabled={loading}
              className="border-erp-border bg-erp-bg text-xs font-semibold text-zinc-300 hover:bg-zinc-800 cursor-pointer"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 text-erp-gold ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </div>

        {/* ACCIONES RÁPIDAS DE COMPRAS Y POS */}
        <QuickActions />

        {/* LAS 4 TARJETAS DE MÉTRICAS PRINCIPALES */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          
          {/* 1. Ingresos ARS */}
          <Card className="border border-erp-border bg-erp-surface/90 rounded-2xl shadow-xl transition-all duration-300 hover:border-erp-gold/50">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardDescription className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-400">Ingresos Totales (ARS)</CardDescription>
                <CardTitle className="text-3xl sm:text-4xl font-bold tracking-tight text-white mt-1.5 font-serif">
                  ${Math.round(stats.totalRevenueArs).toLocaleString('es-AR')}
                </CardTitle>
              </div>
              <div className="h-11 w-11 rounded-xl bg-erp-gold/10 border border-erp-gold/30 flex items-center justify-center text-erp-gold shrink-0">
                <Coins className="h-6 w-6" />
              </div>
            </CardHeader>
          </Card>

          {/* 2. Ganancia Comercial Real */}
          <Card className="border border-erp-border bg-erp-surface/90 rounded-2xl shadow-xl transition-all duration-300 hover:border-erp-gold/50">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardDescription className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-400">Ganancia Comercial Real</CardDescription>
                <CardTitle className="text-3xl sm:text-4xl font-bold tracking-tight text-erp-gold mt-1.5 font-serif">
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

          {/* 3. Ganancia Neta Final */}
          <Card className="border border-erp-border bg-erp-surface/90 rounded-2xl shadow-xl transition-all duration-300 hover:border-emerald-500/40">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardDescription className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-400">Ganancia Neta Final</CardDescription>
                <CardTitle className="text-3xl sm:text-4xl font-bold tracking-tight text-emerald-400 mt-1.5 font-serif">
                  ${Math.round(stats.estimatedProfitArs).toLocaleString('es-AR')}
                </CardTitle>
                <p className="text-[11px] text-emerald-400/90 font-mono mt-1">
                  {stats.totalRevenueArs > 0 
                    ? `${((stats.estimatedProfitArs / stats.totalRevenueArs) * 100).toFixed(1)}%` 
                    : '0.0%'} margen neto (de bolsillo)
                </p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <DollarSign className="h-6 w-6 text-erp-gold" />
              </div>
            </CardHeader>
          </Card>

          {/* 4. Volumen Comercial USD */}
          <Card className="border border-erp-border bg-erp-surface/90 rounded-2xl shadow-xl transition-all duration-300 hover:border-erp-gold/50">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardDescription className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-400">Volumen Comercial (USD)</CardDescription>
                <CardTitle className="text-3xl sm:text-4xl font-bold tracking-tight text-erp-gold-hover mt-1.5 font-serif">
                  u$s {stats.totalRevenueUsd.toFixed(2)}
                </CardTitle>
                <p className="text-[11px] text-zinc-400 font-mono mt-1">
                  Equivalente oficial al tipo de cambio
                </p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-erp-gold/10 border border-erp-gold/30 flex items-center justify-center text-erp-gold shrink-0">
                <Percent className="h-6 w-6" />
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* WIDGET DE VALORACIÓN Y PROYECCIÓN DE INVENTARIO (FILA/GRID EXCLUSIVA UBICADA JUSTO DEBAJO) */}
        <div className="my-6">
          <InventoryValuationWidget />
        </div>

        {/* WIDGET DE KPIS RETAIL: TICKET PROMEDIO (AOV) & TOP 3 BEST SELLERS */}
        <div>
          <RetailKPIsWidget />
        </div>

        {/* WIDGET DE METAS MENSUALES Y RUN RATE */}
        <div className="mb-6">
          <MonthlyGoalsWidget />
        </div>

        {/* GRILLA INFERIOR ESTRUCTURADA: GRÁFICO (COL 2) + PANELS (COL 1) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* GRÁFICO RECHARTS (Col-span 2) */}
          <div className="lg:col-span-2">
            <Card className="border border-erp-border bg-erp-surface/90 rounded-2xl p-6 shadow-xl space-y-4">
              <CardHeader className="px-0 pt-0 pb-6 border-b border-erp-border">
                <CardTitle className="text-sm font-bold text-zinc-200 font-serif flex items-center gap-2">
                  <Activity className="h-4.5 w-4.5 text-erp-gold" />
                  Historial Diario de Facturación y Utilidades (ARS)
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">Visualización comparativa de facturación bruta, ganancia comercial real y ganancia neta.</CardDescription>
              </CardHeader>
              
              {loading ? (
                <div className="h-72 w-full mt-4 rounded-2xl bg-erp-surface/60 border border-erp-border animate-pulse" />
              ) : stats.salesByDate.length > 0 ? (
                <div className="h-72 w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.salesByDate} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} style={{ fontSize: '11px', fill: 'var(--muted-foreground)' }} />
                      <YAxis tickLine={false} axisLine={false} style={{ fontSize: '11px', fill: 'var(--muted-foreground)' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: '11px' }}
                        formatter={(value) => <span className="text-zinc-400">{value}</span>}
                      />
                      <Bar name="Facturación" dataKey="Ventas" fill="#D0A96B" radius={[4, 4, 0, 0]} barSize={16} />
                      <Bar name="Ganancia Comercial Real" dataKey="Ganancias" fill="#10b981" radius={[4, 4, 0, 0]} barSize={16} />
                      <Bar name="Ganancia Neta Final" dataKey="GananciaNeta" fill="#0d9488" radius={[4, 4, 0, 0]} barSize={16} />
                    </BarChart>
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
            <StockAlertWidget />
          </div>

        </div>

        {/* BARRA INFERIOR DE ACCESOS RÁPIDOS MÓDULOS */}
        <QuickAccessPills />

      </main>

    </div>
  );
}
