'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { getFinancialReport, FinancialReportData } from '@/app/actions/analytics';
import { getInventoryValuation } from '@/app/actions/inventoryAnalytics';
import { getRetailKPIs } from '@/app/actions/reports';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import { 
  ArrowLeft, ShieldAlert, RefreshCw, AlertCircle, TrendingUp, 
  TrendingDown, DollarSign, PieChart as PieChartIcon, BarChart3, 
  Percent, Coins, Layers, CreditCard, ShoppingBag, Download, FileText, RotateCcw 
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

import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const COLORS = ['#e11d48', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#64748b'];

const getFirstDayOfMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
};

const getTodayDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export default function ReportesPage() {
  const { role } = useUserStore();
  const { refresh: refreshRate } = useExchangeRate();

  const [timeRange, setTimeRange] = useState<'current_month' | 'previous_month' | 'last_30_days' | 'current_year' | 'custom'>('current_month');
  const [startDate, setStartDate] = useState<string>(getFirstDayOfMonth());
  const [endDate, setEndDate] = useState<string>(getTodayDate());
  const [report, setReport] = useState<FinancialReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    if (role !== 'admin') return;
    setLoading(true);
    setError(null);
    let res;
    if (timeRange === 'custom') {
      res = await getFinancialReport(role, 'custom', startDate, endDate);
    } else {
      res = await getFinancialReport(role, timeRange, startDate, endDate);
    }

    if (res.success && res.data) {
      setReport(res.data);
    } else {
      setError(res.error || 'Error al calcular el estado de resultados.');
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

  const [generatingPdf, setGeneratingPdf] = useState(false);

  const handleDownloadPDF = async () => {
    if (!report) {
      toast.error('No hay datos analíticos disponibles para exportar.');
      return;
    }

    try {
      setGeneratingPdf(true);
      toast.info('Generando reporte financiero corporativo...');

      // 1. Obtener datos de inventario y KPIs de retail en paralelo
      const [invRes, retailRes] = await Promise.all([
        getInventoryValuation(role),
        getRetailKPIs(role)
      ]);

      const inventoryData = invRes.success ? invRes.data : null;
      const retailData = retailRes.success ? retailRes.data : null;

      // 2. Inicialización limpia de jsPDF A4 en puntos (pt)
      const doc = new jsPDF('p', 'pt', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();

      // Formateador numérico estricto a moneda local ARS
      const formatARS = (valor: number) =>
        new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(valor || 0);

      // 3. Encabezado Corporativo (Fondo Blanco Nativo)
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, 842, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(8, 19, 14); // Verde marca Elohim [8, 19, 14]
      doc.text('ELOHIM IMPORT - REPORTE FINANCIERO', 40, 40);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);

      const periodText = timeRange === 'custom'
        ? `Desde ${startDate} hasta ${endDate}`
        : timeRange === 'current_month' ? 'Mes Actual' : timeRange === 'previous_month' ? 'Mes Anterior' : timeRange === 'last_30_days' ? 'Últimos 30 días' : 'Año en Curso';

      doc.text(`Fecha de Generación: ${new Date().toLocaleDateString('es-AR')}  |  Período: ${periodText}`, 40, 56);

      // Línea separadora
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(1);
      doc.line(40, 66, pageWidth - 40, 66);

      // Opciones visuales estandarizadas para autoTable (Verde marca en cabeceras)
      const autoTableOptions = {
        theme: 'grid' as const,
        headStyles: { fillColor: [8, 19, 14] as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const, fontSize: 9 },
        bodyStyles: { textColor: [30, 41, 59] as [number, number, number], fontSize: 9 },
        alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
        margin: { left: 40, right: 40 },
        styles: { cellPadding: 6 }
      };

      // --- TABLA 1: ESTADO DE RESULTADOS ---
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(8, 19, 14);
      doc.text('Estado de Resultados', 40, 85);

      const estadoResultadosBody = [
        ['Ingresos Brutos', formatARS(report.grossRevenue)],
        ['Costo Mercadería (COGS)', formatARS(-report.cogs)],
        ['Comisiones Pasarelas (Costo Bancario)', formatARS(-report.gatewayFeeArs)],
        ['Gastos Operativos (OPEX)', formatARS(-report.opex)],
        ['Ganancia Neta del Período', `${formatARS(report.netProfit)} (${report.profitMarginPercent}% Margen)`]
      ];

      autoTable(doc, {
        ...autoTableOptions,
        startY: 93,
        head: [['Concepto', 'Monto (ARS)']],
        body: estadoResultadosBody
      });

      let currentY = (doc as any).lastAutoTable.finalY + 22;

      // --- TABLA 2: VALORACIÓN DE INVENTARIO ---
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(8, 19, 14);
      doc.text('Valoración de Inventario', 40, currentY);

      const valoracionBody = [
        ['Capital Invertido (Costo en Stock)', formatARS(inventoryData?.capitalInvertido || 0)],
        ['Valor Bruto Potencial (Venta en Stock)', formatARS(inventoryData?.valorBrutoVenta || 0)],
        ['Ganancia Neta Potencial', formatARS(inventoryData?.gananciaNetaPotencial || 0)]
      ];

      autoTable(doc, {
        ...autoTableOptions,
        startY: currentY + 8,
        head: [['Métrica de Inventario', 'Valor (ARS)']],
        body: valoracionBody
      });

      currentY = (doc as any).lastAutoTable.finalY + 22;

      // --- TABLA 3: KPIS RETAIL ---
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(8, 19, 14);
      doc.text('KPIs Retail del Mes', 40, currentY);

      const kpiBody = [
        ['Ticket Promedio (AOV)', formatARS(retailData?.averageOrderValueArs || 0)],
        ['Transacciones Totales del Mes', `${retailData?.totalSalesCount || 0} ventas`]
      ];

      autoTable(doc, {
        ...autoTableOptions,
        startY: currentY + 8,
        head: [['Métrica KPI', 'Valor']],
        body: kpiBody
      });

      // Pie de página corporativo
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Elohim Import ERP • Reporte Financiero Corporativo — Página ${i} de ${totalPages}`, 40, 820);
      }

      doc.save(`Reporte_Financiero_Elohim_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('Reporte PDF corporativo generado exitosamente');
    } catch (error: any) {
      console.error('[ERROR_GENERACION_PDF_CORPORATIVO]:', error);
      toast.error('Ocurrió un error al generar el PDF corporativo.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Acceso restringido para vendedores
  if (role !== 'admin') {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 dark:bg-[#08130E] dark:text-zinc-50 transition-colors duration-300">
        <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-[#1B362A] dark:bg-[#08130E]/80">
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
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 dark:bg-[#08130E] dark:text-zinc-50 transition-colors duration-300">
      
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
        }
      `}</style>

      {/* NAVBAR */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-[#1B362A] dark:bg-[#08130E]/80 print:hidden">
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
                className="border-[#1B362A] bg-[#13261E] text-[#D0A96B] hover:bg-zinc-800 cursor-pointer font-bold text-xs flex items-center gap-1.5 h-9"
              >
                <PieChartIcon className="h-3.5 w-3.5 text-[#D0A96B]" />
                <span>Dashboard Visual Mensual</span>
              </Button>
            </Link>

            <Button
              variant="outline"
              onClick={handleDownloadPDF}
              disabled={loading || generatingPdf}
              className="border-[#D0A96B]/40 text-[#E5C158] hover:bg-violet-950/40 hover:text-white cursor-pointer font-bold text-xs flex items-center gap-1.5 h-9 bg-[#13261E] shadow-md shadow-violet-600/10"
            >
              {generatingPdf ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#D0A96B]" />
              ) : (
                <Download className="h-3.5 w-3.5 text-[#D0A96B]" />
              )}
              <span>{generatingPdf ? 'Generando...' : 'Descargar PDF'}</span>
            </Button>

            {/* PRESETS DE RANGO DE FECHAS */}
            <div className="flex items-center gap-1.5 bg-slate-200/70 dark:bg-[#13261E] p-1 rounded-xl border border-slate-300/60 dark:border-[#1B362A] text-xs font-bold">
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
            <div className="flex items-center gap-2 bg-[#13261E] p-1.5 rounded-xl border border-[#1B362A]">
              <div className="flex items-center gap-1">
                <span className="text-[10px] uppercase font-bold text-zinc-400">Desde:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setTimeRange('custom');
                  }}
                  className="bg-[#08130E] border border-[#1B362A] rounded-lg px-2 py-1 text-xs text-white font-mono"
                />
              </div>

              <div className="flex items-center gap-1">
                <span className="text-[10px] uppercase font-bold text-zinc-400">Hasta:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setTimeRange('custom');
                  }}
                  className="bg-[#08130E] border border-[#1B362A] rounded-lg px-2 py-1 text-xs text-white font-mono"
                />
              </div>

              <Button
                size="sm"
                onClick={fetchReport}
                className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-bold text-xs h-7 px-3 cursor-pointer"
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
          className="space-y-6 bg-[#08130E] text-[#FAFAFA] p-6 rounded-2xl border border-[#1B362A] shadow-2xl"
        >
          
          {/* LOGO EN CABECERA DEL REPORTE DE EXPORTACIÓN */}
          <div className="flex items-center justify-between pb-4 border-b border-[#1B362A]">
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
                <p className="text-[10px] text-[#D0A96B] font-mono uppercase tracking-widest">Reporte Financiero Oficial</p>
              </div>
            </div>
            <div className="text-right text-[11px] font-mono text-zinc-400">
              <div>Rango: <span className="text-[#D0A96B] font-bold">
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
            <RetailKPIsWidget />
          </div>

          {/* MONITOR DE COTIZACIONES EN VIVO */}
          <ExchangeRatesWidget />

        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
            <span className="text-sm font-medium text-slate-500 dark:text-zinc-400">Calculando reporte financiero...</span>
          </div>
        ) : error || !report ? (
          <div className="flex flex-col items-center justify-center py-20 text-rose-500 gap-2">
            <AlertCircle className="h-10 w-10 text-rose-600" />
            <p className="text-sm font-semibold">{error || 'No se pudieron recuperar las métricas.'}</p>
            <Button variant="outline" onClick={fetchReport} className="mt-2">Reintentar</Button>
          </div>
        ) : (
          <>
            {/* GRILLA DE 6 KPI CARDS GRANDES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              
              {/* 1. INGRESOS BRUTOS */}
              <Card className="border-slate-200 dark:border-[#1B362A] bg-white dark:bg-[#13261E]">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
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
              <Card className="border-slate-200 dark:border-[#1B362A] bg-white dark:bg-[#13261E]">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
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

              {/* 3. COMISIONES PASARELAS (COSTO BANCARIO) */}
              <Card className="border-slate-200 dark:border-[#1B362A] bg-white dark:bg-[#13261E]">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-[#D0A96B]">
                      Comisiones Pasarelas (Costo Bancario)
                    </CardDescription>
                    <div className="p-1.5 rounded-lg bg-[#D0A96B]/10 text-[#D0A96B] border border-[#D0A96B]/30">
                      <CreditCard className="h-4 w-4" />
                    </div>
                  </div>
                  <CardTitle className="text-xl font-black text-[#D0A96B] font-mono mt-2">
                    -${(report.gatewayFeeArs !== undefined ? report.gatewayFeeArs : report.financialCost).toLocaleString('es-AR')} ARS
                  </CardTitle>
                </CardHeader>
              </Card>

              {/* 4. GASTOS OPERATIVOS (OPEX) */}
              <Card className="border-slate-200 dark:border-[#1B362A] bg-white dark:bg-[#13261E]">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
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

              {/* 5. GANANCIA NETA */}
              <Card className={`border-slate-200 dark:border-[#1B362A] bg-white dark:bg-[#13261E] shadow-md border-l-4 ${
                report.netProfit >= 0 ? 'border-l-emerald-500' : 'border-l-rose-500'
              }`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Ganancia Neta
                    </CardDescription>
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
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

              {/* 6. CUENTAS POR COBRAR (DINERO EN LA CALLE) */}
              <Card className="border-slate-200 dark:border-[#1B362A] bg-white dark:bg-[#13261E]">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-[#D0A96B]">
                      Cuentas por Cobrar (Dinero en la calle)
                    </CardDescription>
                    <div className="p-1.5 rounded-lg bg-[#D0A96B]/10 text-[#D0A96B] border border-[#D0A96B]/30">
                      <Coins className="h-4 w-4" />
                    </div>
                  </div>
                  <CardTitle className="text-xl font-black text-amber-400 font-mono mt-2">
                    ${(report.totalAmountDueArs || 0).toLocaleString('es-AR')} ARS
                  </CardTitle>
                </CardHeader>
              </Card>

              {/* 7. DEVOLUCIONES Y REINTEGROS */}
              <Card className="border-slate-200 dark:border-[#1B362A] bg-white dark:bg-[#13261E]">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* GRÁFICO 1: EVOLUCIÓN TEMPORAL (BAR CHART RECHARTS) */}
              <Card className="border-slate-200 dark:border-[#1B362A] lg:col-span-2">
                <CardHeader className="pb-2 border-b border-slate-100 dark:border-zinc-900">
                  <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="h-4.5 w-4.5 text-emerald-600" />
                    Evolución de Ingresos Brutos vs. Ganancia Estimada
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
                        <BarChart data={report.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#33415520" />
                          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                          <Tooltip 
                            formatter={(value: any) => [`$${Number(value).toLocaleString('es-AR')} ARS`, '']}
                            contentStyle={{ borderRadius: '8px', fontSize: '12px', background: '#09090b', color: '#fff', border: '1px solid #27272a' }}
                          />
                          <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="ganancia" name="Ganancia Neta Est." fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* GRÁFICO 2: PIE CHART DE OPEX POR CATEGORÍA */}
              <Card className="border-slate-200 dark:border-[#1B362A]">
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
                    <div className="h-72 w-full flex items-center justify-center">
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
                          <Tooltip formatter={(val: any) => [`$${Number(val).toLocaleString('es-AR')} ARS`, 'Monto']} />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>

          </>
        )}

        </div>
      </main>

    </div>
  );
}
