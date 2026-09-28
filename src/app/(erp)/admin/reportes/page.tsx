'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { getFinancialReport, FinancialReportData } from '@/app/actions/analytics';
import { getInventoryValuation } from '@/app/actions/inventoryAnalytics';
import { getRetailKPIs } from '@/app/actions/reports';
import { getMonthlyProjection } from '@/app/actions/goals';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import { 
  ArrowLeft, ShieldAlert, RefreshCw, AlertCircle, TrendingUp, 
  TrendingDown, DollarSign, PieChart as PieChartIcon, BarChart3, 
  Percent, Coins, Layers, CreditCard, ShoppingBag, Download, FileText, RotateCcw, FileSpreadsheet 
} from 'lucide-react';
import Link from 'next/link';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';

import { MonthlyGoalsWidget } from '@/components/goals/MonthlyGoalsWidget';
import { InventoryValuationWidget } from '@/components/inventory/InventoryValuationWidget';
import { RetailKPIsWidget } from '@/components/dashboard/RetailKPIsWidget';
import { ExchangeRatesWidget } from '@/components/rates/ExchangeRatesWidget';
import { FormatMarginWidget } from '@/components/analytics/FormatMarginWidget';
import { FamilyRotationWidget } from '@/components/analytics/FamilyRotationWidget';

import { toast } from 'sonner';
import { generateFinancialReportPDF, exportFinancialReportToCsv } from '@/lib/pdf-financial-report';
import { getSystemSettings } from '@/app/actions/systemSettings';
import { getTreasuryAccounts } from '@/app/actions/treasury';
import { SystemSettingsData, DEFAULT_SYSTEM_SETTINGS } from '@/lib/settings-validation';

const COLORS = ['#e11d48', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#64748b'];

// Tooltip personalizado adaptativo (claro/oscuro) con fallback seguro a cero —
// reemplaza el Tooltip default con contentStyle dark hardcodeado.
const CustomBarTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number; name?: string; color?: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 dark:bg-erp-bg/95 border border-slate-200 dark:border-erp-border p-3 rounded-xl shadow-2xl text-xs space-y-1.5 backdrop-blur-md min-w-[220px]">
        <p className="font-serif font-bold text-slate-900 dark:text-erp-gold border-b border-slate-200 dark:border-erp-border pb-1">{label}</p>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4 text-slate-700 dark:text-zinc-300">
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

const CustomPieTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload?: { name?: string; value?: number } }> }) => {
  if (active && payload && payload.length && payload[0]?.payload) {
    const data = payload[0].payload;
    return (
      <div className="bg-white/95 dark:bg-erp-bg/95 border border-slate-200 dark:border-erp-border p-3 rounded-xl shadow-2xl text-xs space-y-1 backdrop-blur-md font-mono">
        <p className="font-serif font-bold text-slate-900 dark:text-white font-sans">{data.name}</p>
        <p className="text-erp-gold font-bold">${Number(data.value || 0).toLocaleString('es-AR')} ARS</p>
      </div>
    );
  }
  return null;
};

const getFirstDayOfMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
};

const getTodayDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export default function ReportesPage() {
  const role = useUserStore((state) => state.role);
  const { refresh: refreshRate } = useExchangeRate();

  const [timeRange, setTimeRange] = useState<'current_month' | 'previous_month' | 'last_30_days' | 'current_year' | 'custom'>('current_month');
  const [startDate, setStartDate] = useState<string>(getFirstDayOfMonth());
  const [endDate, setEndDate] = useState<string>(getTodayDate());
  const [report, setReport] = useState<FinancialReportData | null>(null);
  const [settings, setSettings] = useState<SystemSettingsData>(DEFAULT_SYSTEM_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    if (role !== 'admin') return;
    setLoading(true);
    setError(null);
    const [resReport, resSettings] = await Promise.all([
      timeRange === 'custom'
        ? getFinancialReport(role, 'custom', startDate, endDate)
        : getFinancialReport(role, timeRange, startDate, endDate),
      getSystemSettings(),
    ]);

    if (resReport.success && resReport.data) {
      setReport(resReport.data);
    } else {
      setError(resReport.error || 'Error al calcular el estado de resultados.');
    }

    if (resSettings.success && resSettings.data) {
      setSettings(resSettings.data);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchReport();
  }, [role, timeRange]);

  const handlePresetChange = (preset: 'current_month' | 'previous_month' | 'last_30_days' | 'current_year') => {
    const now = new Date();
    let s = '';
    let e = getTodayDate();

    if (preset === 'current_month') {
      s = getFirstDayOfMonth();
    } else if (preset === 'previous_month') {
      const prevMonthLast = new Date(now.getFullYear(), now.getMonth(), 0);
      const prevMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
      s = `${prevMonthYear}-${String(prevMonth).padStart(2, '0')}-01`;
      e = `${prevMonthYear}-${String(prevMonth).padStart(2, '0')}-${String(prevMonthLast.getDate()).padStart(2, '0')}`;
    } else if (preset === 'last_30_days') {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      s = `${past30.getFullYear()}-${String(past30.getMonth() + 1).padStart(2, '0')}-${String(past30.getDate()).padStart(2, '0')}`;
    } else if (preset === 'current_year') {
      s = `${now.getFullYear()}-01-01`;
    }

    setStartDate(s);
    setEndDate(e);
    setTimeRange(preset);
  };

  const chartAreaRef = useRef<HTMLDivElement>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const getPeriodLabel = (goalsData?: any) => {
    if (goalsData?.monthName) return goalsData.monthName;
    if (timeRange === 'custom') return `Desde ${startDate} hasta ${endDate}`;
    if (timeRange === 'current_month') return 'Mes Actual';
    if (timeRange === 'previous_month') return 'Mes Anterior';
    if (timeRange === 'last_30_days') return 'Últimos 30 días';
    return 'Año en Curso';
  };

  const handleDownloadPDF = async () => {
    if (!report) {
      toast.error('No hay datos analíticos disponibles para exportar.');
      return;
    }

    try {
      setGeneratingPdf(true);
      toast.info('Generando reporte contable oficial en PDF...');

      // 1. Obtener métricas adicionales en paralelo
      const [invRes, retailRes, goalsRes, treasuryRes] = await Promise.all([
        getInventoryValuation(),
        getRetailKPIs(role, startDate, endDate),
        getMonthlyProjection(startDate, endDate),
        getTreasuryAccounts(),
      ]);

      const inventoryData = invRes.success ? invRes.data : null;
      const retailData = retailRes.success ? retailRes.data : null;
      const goalsData = goalsRes.success ? goalsRes.data : null;
      const treasuryAccounts = treasuryRes.success ? treasuryRes.data : null;

      const periodLabel = getPeriodLabel(goalsData);

      const doc = generateFinancialReportPDF({
        report,
        retailData,
        goalsData,
        inventoryData,
        treasuryAccounts,
        periodLabel,
        storeName: settings.trade_name || settings.company_name || 'Elohim Import ERP',
      });

      doc.save(`Reporte_Financiero_Elohim_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('Reporte PDF analítico descargado exitosamente');
    } catch (error: unknown) {
      console.error('[ERROR_GENERACION_PDF]:', error);
      toast.error('Ocurrió un error al generar el PDF analítico.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!report) {
      toast.error('No hay datos analíticos disponibles para exportar.');
      return;
    }

    try {
      const periodLabel = getPeriodLabel();
      exportFinancialReportToCsv({
        report,
        periodLabel,
        storeName: settings.trade_name || settings.company_name || 'Elohim Import ERP',
      });
      toast.success('Libro contable CSV descargado exitosamente');
    } catch (error: unknown) {
      console.error('[ERROR_GENERACION_CSV]:', error);
      toast.error('Error al exportar los datos contables.');
    }
  };

  // Acceso restringido para vendedores
  if (role !== 'admin') {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 dark:bg-erp-bg dark:text-zinc-50 transition-colors duration-300">
        <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-erp-border dark:bg-erp-bg/80">
          <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 max-w-6xl">
            <Link 
              href="/"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
              <span>Volver</span>
            </Link>
            <RoleSelector />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-rose-200 dark:border-rose-900/30 bg-rose-50/20 dark:bg-rose-950/5 shadow-lg">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 mb-4">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <CardTitle className="text-lg font-bold text-rose-800 dark:text-rose-400">Acceso Restringido</CardTitle>
              <CardDescription className="dark:text-rose-500/80">
                La analítica financiera y el estado de resultados son exclusivos para administradores.
              </CardDescription>
            </CardHeader>
            <CardFooter className="pt-2">
              <Link href="/" className="w-full">
                <Button variant="outline" className="w-full justify-center">
                  Volver al Dashboard
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 dark:bg-erp-bg dark:text-zinc-50 transition-colors duration-300">
      
      {/* ESTILOS GLOBALES DE IMPRESIÓN / EXPORTACIÓN NATIVA PDF */}
      <style>{`
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
          }
          .print\\:hidden, header, nav, aside, button {
            display: none !important;
          }
          #pdf-export-area {
            background-color: #ffffff !important;
            color: #000000 !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .border, [class*="border-"] {
            border-color: #e4e4e7 !important;
          }
          .text-white, .text-zinc-200, .text-zinc-300, .text-zinc-400 {
            color: #18181b !important;
          }
          /* Fondo de exportación: forzar blanco también en cards y superficies del ERP */
          [class*="bg-erp-"] {
            background-color: #ffffff !important;
          }
          /* SVG de Recharts: asegurar trazos y ticks legibles sobre fondo blanco en impresión */
          .recharts-surface {
            background-color: #ffffff !important;
          }
          .recharts-cartesian-axis-tick text {
            fill: #3f3f46 !important;
          }
        }
      `}</style>

      {/* NAVBAR */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-erp-border dark:bg-erp-bg/80 print:hidden">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 max-w-6xl">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
              <span>Dashboard</span>
            </Link>
            <span className="text-slate-300 dark:text-zinc-800">|</span>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-md shadow-emerald-500/20">
                <BarChart3 className="h-4.5 w-4.5" />
              </div>
              <span className="text-sm font-bold tracking-tight text-slate-800 dark:text-zinc-100 uppercase">
                Estado de Resultados y Rentabilidad
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <RoleSelector />
            <ExchangeRateWidget role={role} onRateChange={refreshRate} />
          </div>
        </div>
      </header>

      {/* CUERPO PRINCIPAL */}
      <main className="flex-1 container mx-auto px-4 py-8 sm:px-6 max-w-6xl space-y-6">
        
        {/* Cabecera y Filtros */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Analítica Financiera y Flujo de Caja
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
              Estado de Resultados real deduciendo COGS, Comisiones Financieras y OPEX.
            </p>
          </div>

          {/* Acciones de Cabecera: Exportar PDF y Selector de Fechas */}
          <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
            
            {/* BOTÓN EXPORTAR REPORTE PDF / IMPRIMIR NATIVO */}
            <Link href="/admin/reportes/mensual">
              <Button
                variant="outline"
                className="border-erp-border bg-erp-surface text-erp-gold hover:bg-zinc-800 cursor-pointer font-bold text-xs flex items-center gap-1.5 h-9"
              >
                <PieChartIcon className="h-3.5 w-3.5 text-erp-gold" />
                <span>Dashboard Visual Mensual</span>
              </Button>
            </Link>

            {/* BOTÓN EXPORTAR REPORTE PDF */}
            <Button
              variant="outline"
              onClick={handleDownloadPDF}
              disabled={loading || generatingPdf}
              className="border-erp-gold/40 text-erp-gold-hover hover:bg-violet-950/40 hover:text-white cursor-pointer font-bold text-xs flex items-center gap-1.5 h-9 bg-erp-surface shadow-md shadow-violet-600/10"
            >
              {generatingPdf ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-erp-gold" />
              ) : (
                <Download className="h-3.5 w-3.5 text-erp-gold" />
              )}
              <span>{generatingPdf ? 'Generando...' : 'Descargar PDF'}</span>
            </Button>

            {/* BOTÓN EXPORTAR EXCEL / CSV */}
            <Button
              variant="outline"
              onClick={handleDownloadCSV}
              disabled={loading}
              className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-950/40 hover:text-white cursor-pointer font-bold text-xs flex items-center gap-1.5 h-9 bg-erp-surface shadow-md"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
              <span>Exportar Excel (CSV)</span>
            </Button>

            {/* PRESETS DE RANGO DE FECHAS */}
            <div className="flex items-center gap-1.5 bg-slate-200/70 dark:bg-erp-surface p-1 rounded-xl border border-slate-300/60 dark:border-erp-border text-xs font-bold">
              <button
                onClick={() => handlePresetChange('current_month')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  timeRange === 'current_month'
                    ? 'bg-white dark:bg-zinc-800 text-slate-950 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950'
                }`}
              >
                Mes Actual
              </button>
              <button
                onClick={() => handlePresetChange('previous_month')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  timeRange === 'previous_month'
                    ? 'bg-white dark:bg-zinc-800 text-slate-950 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950'
                }`}
              >
                Mes Anterior
              </button>
              <button
                onClick={() => handlePresetChange('last_30_days')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  timeRange === 'last_30_days'
                    ? 'bg-white dark:bg-zinc-800 text-slate-950 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950'
                }`}
              >
                Últimos 30 días
              </button>
              <button
                onClick={() => handlePresetChange('current_year')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  timeRange === 'current_year'
                    ? 'bg-white dark:bg-zinc-800 text-slate-950 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950'
                }`}
              >
                Año en Curso
              </button>
            </div>

            {/* INPUTS DE RANGO PERSONALIZADO (DESDE / HASTA) */}
            <div className="flex items-center gap-2 bg-erp-surface p-1.5 rounded-xl border border-erp-border">
              <div className="flex items-center gap-1">
                <span className="text-[11px] uppercase font-bold text-zinc-400">Desde:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setTimeRange('custom');
                  }}
                  className="bg-erp-bg border border-erp-border rounded-lg px-2 py-1 text-xs text-white font-mono"
                />
              </div>

              <div className="flex items-center gap-1">
                <span className="text-[11px] uppercase font-bold text-zinc-400">Hasta:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setTimeRange('custom');
                  }}
                  className="bg-erp-bg border border-erp-border rounded-lg px-2 py-1 text-xs text-white font-mono"
                />
              </div>

              <Button
                size="sm"
                onClick={fetchReport}
                className="bg-erp-gold hover:bg-erp-gold-hover text-erp-bg font-bold text-xs h-7 px-3 cursor-pointer"
              >
                Filtrar
              </Button>
            </div>

          </div>
        </div>

        {/* REPORTE FINANCIERO VISUAL */}
        <div 
          id="reporte-financiero-pdf" 
          style={{ backgroundColor: '#08130E', color: '#FAFAFA', borderColor: '#1B362A' }}
          className="space-y-6 bg-erp-bg text-foreground p-6 rounded-2xl border border-erp-border shadow-2xl"
        >
          
          {/* LOGO EN CABECERA DEL REPORTE DE EXPORTACIÓN */}
          <div className="flex items-center justify-between pb-4 border-b border-erp-border">
            <div className="flex items-center gap-3">
              <img 
                src="/logo-elohim.png" 
                alt="Elohim Import ERP" 
                className="h-10 w-auto object-contain" 
                crossOrigin="anonymous" 
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div>
                <h2 className="text-base font-bold text-white font-serif tracking-wider">ELOHIM IMPORT ERP</h2>
                <p className="text-[11px] text-erp-gold font-mono uppercase tracking-widest">Reporte Financiero Oficial</p>
              </div>
            </div>
            <div className="text-right text-[11px] font-mono text-zinc-400">
              <div>Rango: <span className="text-erp-gold font-bold">
                {timeRange === 'custom' 
                  ? `Desde ${startDate} hasta ${endDate}`
                  : timeRange === 'current_month' ? 'Mes Actual' : timeRange === 'previous_month' ? 'Mes Anterior' : timeRange === 'last_30_days' ? 'Últimos 30 días' : 'Año en Curso'}
              </span></div>
              <div>Generado: {new Date().toLocaleDateString('es-AR')}</div>
            </div>
          </div>

          {/* WIDGET DE METAS MENSUALES Y RUN RATE */}
          <MonthlyGoalsWidget startDate={startDate} endDate={endDate} />

          {/* WIDGET DE VALORACIÓN DE INVENTARIO */}
          <InventoryValuationWidget />

          {/* WIDGET DE KPIS RETAIL: TICKET PROMEDIO Y TOP 3 BEST SELLERS */}
          <div className="w-full">
            <RetailKPIsWidget startDate={startDate} endDate={endDate} />
          </div>

          {/* MONITOR DE COTIZACIONES EN VIVO */}
          <ExchangeRatesWidget />

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="h-28 rounded-2xl bg-slate-100 dark:bg-erp-surface animate-pulse" />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 h-80 rounded-2xl bg-slate-100 dark:bg-erp-surface animate-pulse" />
              <div className="h-80 rounded-2xl bg-slate-100 dark:bg-erp-surface animate-pulse" />
            </div>
          </div>
        ) : error || !report ? (
          <div className="flex flex-col items-center justify-center py-20 text-rose-500 gap-2">
            <AlertCircle className="h-10 w-10 text-rose-600" />
            <p className="text-sm font-semibold">{error || 'No se pudieron recuperar las métricas.'}</p>
            <Button variant="outline" onClick={fetchReport} className="mt-2">Reintentar</Button>
          </div>
        ) : (
          <>
            {/* GRILLA DE 8 KPI CARDS SIMÉTRICAS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* 1. INGRESOS BRUTOS */}
              <Card className="border-slate-200 dark:border-erp-border bg-white dark:bg-erp-surface">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Ingresos Brutos
                    </CardDescription>
                    <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                  </div>
                  <CardTitle className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-2">
                    ${report.grossRevenue.toLocaleString('es-AR')} ARS
                  </CardTitle>
                </CardHeader>
              </Card>

              {/* 2. COSTO MERCADERÍA (COGS) */}
              <Card className="border-slate-200 dark:border-erp-border bg-white dark:bg-erp-surface">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Costo Mercadería (COGS)
                    </CardDescription>
                    <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600">
                      <ShoppingBag className="h-4 w-4" />
                    </div>
                  </div>
                  <CardTitle className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono mt-2">
                    -${report.cogs.toLocaleString('es-AR')} ARS
                  </CardTitle>
                </CardHeader>
              </Card>

              {/* 3. GANANCIA COMERCIAL REAL (LIMPIA) */}
              <Card className="border-slate-200 dark:border-erp-border bg-white dark:bg-erp-surface border-l-4 border-l-erp-gold">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-[11px] font-bold uppercase tracking-wider text-erp-gold">
                      Ganancia Comercial Real
                    </CardDescription>
                    <span className="text-[11px] font-extrabold px-1.5 py-0.5 rounded bg-erp-gold/10 text-erp-gold border border-erp-gold/30 font-mono">
                      {report.grossMarginPercent.toFixed(1)}% Margen
                    </span>
                  </div>
                  <CardTitle className="text-xl font-black text-erp-gold font-mono mt-2">
                    ${report.grossMargin.toLocaleString('es-AR')} ARS
                  </CardTitle>
                </CardHeader>
              </Card>

              {/* 4. GASTOS OPERATIVOS (OPEX) */}
              <Card className="border-slate-200 dark:border-erp-border bg-white dark:bg-erp-surface">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Gastos Operativos (OPEX)
                    </CardDescription>
                    <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-500/10 text-rose-600">
                      <Layers className="h-4 w-4" />
                    </div>
                  </div>
                  <CardTitle className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono mt-2">
                    -${report.opex.toLocaleString('es-AR')} ARS
                  </CardTitle>
                </CardHeader>
              </Card>

              {/* 5. COMISIONES PASARELAS (COSTO BANCARIO) */}
              <Card className="border-slate-200 dark:border-erp-border bg-white dark:bg-erp-surface">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Comisiones Pasarelas (Bancos)
                    </CardDescription>
                    <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      <CreditCard className="h-4 w-4" />
                    </div>
                  </div>
                  <CardTitle className="text-xl font-black text-amber-400 font-mono mt-2">
                    -${(report.gatewayFeeArs !== undefined ? report.gatewayFeeArs : report.financialCost).toLocaleString('es-AR')} ARS
                  </CardTitle>
                </CardHeader>
              </Card>

              {/* 6. GANANCIA NETA FINAL */}
              <Card className={`border-slate-200 dark:border-erp-border bg-white dark:bg-erp-surface shadow-md border-l-4 ${
                report.netProfit >= 0 ? 'border-l-emerald-500' : 'border-l-rose-500'
              }`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                      Ganancia Neta Final (Bolsillo)
                    </CardDescription>
                    <span className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded ${
                      report.netProfit >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {report.profitMarginPercent}% Margen
                    </span>
                  </div>
                  <CardTitle className={`text-xl font-black font-mono mt-2 ${
                    report.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    ${report.netProfit.toLocaleString('es-AR')} ARS
                  </CardTitle>
                </CardHeader>
              </Card>

              {/* 7. CUENTAS POR COBRAR (DINERO EN LA CALLE) */}
              <Card className="border-slate-200 dark:border-erp-border bg-white dark:bg-erp-surface">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-[11px] font-bold uppercase tracking-wider text-erp-gold">
                      Cuentas por Cobrar (En calle)
                    </CardDescription>
                    <div className="p-1.5 rounded-lg bg-erp-gold/10 text-erp-gold border border-erp-gold/30">
                      <Coins className="h-4 w-4" />
                    </div>
                  </div>
                  <CardTitle className="text-xl font-black text-amber-400 font-mono mt-2">
                    ${(report.totalAmountDueArs || 0).toLocaleString('es-AR')} ARS
                  </CardTitle>
                </CardHeader>
              </Card>

              {/* 8. DEVOLUCIONES Y REINTEGROS */}
              <Card className="border-slate-200 dark:border-erp-border bg-white dark:bg-erp-surface">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
                      Devoluciones & Reintegros
                    </CardDescription>
                    <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30">
                      <RotateCcw className="h-4 w-4" />
                    </div>
                  </div>
                  <CardTitle className="text-xl font-black text-rose-400 font-mono mt-2">
                    -${(report.totalRefundsArs || 0).toLocaleString('es-AR')} ARS
                  </CardTitle>
                </CardHeader>
              </Card>

            </div>

            {/* SECCIÓN DE GRÁFICOS ANALÍTICOS */}
            <div ref={chartAreaRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* GRÁFICO 1: EVOLUCIÓN TEMPORAL (BAR CHART RECHARTS) */}
              <Card className="border-slate-200 dark:border-erp-border lg:col-span-2">
                <CardHeader className="pb-2 border-b border-slate-100 dark:border-zinc-900">
                  <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="h-4.5 w-4.5 text-erp-gold" />
                    Evolución de Facturación, Ganancia Real y Margen Neto
                  </CardTitle>
                </CardHeader>

                <CardContent className="pt-6">
                  {report.trendData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-xs">
                      No hay ventas registradas en el periodo seleccionado.
                    </div>
                  ) : (
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={report.trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                          <Tooltip content={<CustomBarTooltip />} />
                          <Bar dataKey="ingresos" name="Facturación Bruta" fill="#D0A96B" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="gananciaReal" name="Ganancia Comercial Real" fill="#10b981" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="gananciaNeta" name="Ganancia Neta Final" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* GRÁFICO 2: PIE CHART DE OPEX POR CATEGORÍA */}
              <Card className="border-slate-200 dark:border-erp-border">
                <CardHeader className="pb-2 border-b border-slate-100 dark:border-zinc-900">
                  <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <PieChartIcon className="h-4.5 w-4.5 text-rose-600" />
                    Distribución de OPEX por Categoría
                  </CardTitle>
                </CardHeader>

                <CardContent className="pt-6">
                  {report.categoryBreakdown.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-xs">
                      Sin gastos cargados en este periodo.
                    </div>
                  ) : (
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={report.categoryBreakdown}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {report.categoryBreakdown.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomPieTooltip />} />
                          <Legend
                            wrapperStyle={{ fontSize: '11px' }}
                            formatter={(value) => <span className="text-slate-700 dark:text-zinc-300">{value}</span>}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>

            {/* MÉTRICAS AVANZADAS DE RETAIL/PERFUMERÍA */}
            <FormatMarginWidget role={role} startDate={startDate} endDate={endDate} />
            <FamilyRotationWidget role={role} />

          </>
        )}

        </div>
      </main>

    </div>
  );
}
