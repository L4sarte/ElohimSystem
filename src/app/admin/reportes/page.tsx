'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { getFinancialReport, FinancialReportData } from '@/app/actions/analytics';
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
import { ExchangeRatesWidget } from '@/components/rates/ExchangeRatesWidget';

const COLORS = ['#e11d48', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#64748b'];

export default function ReportesPage() {
  const { role } = useUserStore();
  const { refresh: refreshRate } = useExchangeRate();

  const [timeRange, setTimeRange] = useState<'current_month' | 'previous_month' | 'last_30_days' | 'current_year'>('current_month');
  const [report, setReport] = useState<FinancialReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado para exportación a PDF
  const [exportingPdf, setExportingPdf] = useState(false);

  const fetchReport = async () => {
    if (role !== 'admin') return;
    setLoading(true);
    setError(null);
    const res = await getFinancialReport(role, timeRange);
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

  const exportDashboardToPDF = async () => {
    const input = document.getElementById('pdf-export-area');
    if (!input) {
      alert('No se encontró el área de reporte para exportar.');
      return;
    }

    setExportingPdf(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      // Captura WYSIWYG de alta calidad respetando la estética Dark Mode Premium (zinc-950)
      const canvas = await html2canvas(input, {
        scale: 2,
        backgroundColor: '#09090b',
        useCORS: true,
        logging: false,
        windowWidth: input.scrollWidth,
        windowHeight: input.scrollHeight
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 190; // Ancho A4 en mm con márgenes (210 - 20)
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 20;

      // Fondo oscuro para la portada/hoja del PDF
      pdf.setFillColor(9, 9, 11);
      pdf.rect(0, 0, 210, 297, 'F');

      // Título nativo de documento
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.text('Elohim Import ERP - Reporte Financiero & Analítica', 10, 10);

      pdf.setFontSize(8);
      pdf.setTextColor(161, 161, 170);
      const labelRange = timeRange === 'current_month' ? 'Mes Actual' : timeRange === 'previous_month' ? 'Mes Anterior' : timeRange === 'last_30_days' ? 'Últimos 30 días' : 'Año en Curso';
      pdf.text(`Fecha de Exportación: ${new Date().toLocaleDateString('es-AR')} | Rango: ${labelRange}`, 10, 15);

      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - 20);

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.setFillColor(9, 9, 11);
        pdf.rect(0, 0, 210, 297, 'F');
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Elohim Import_Reporte_Financiero_${timeRange}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err: any) {
      console.error('Error al exportar reporte PDF:', err);
      alert('Ocurrió un error al generar la exportación PDF: ' + (err.message || 'Error desconocido'));
    } finally {
      setExportingPdf(false);
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
      
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-[#1B362A] dark:bg-[#08130E]/80">
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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
            
            {/* BOTÓN EXPORTAR REPORTE PDF */}
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
              onClick={exportDashboardToPDF}
              disabled={exportingPdf || loading}
              className="border-[#D0A96B]/40 text-[#E5C158] hover:bg-violet-950/40 hover:text-white cursor-pointer font-bold text-xs flex items-center gap-1.5 h-9 bg-[#13261E] shadow-md shadow-violet-600/10"
            >
              {exportingPdf ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#D0A96B]" />
                  <span>Generando PDF...</span>
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5 text-[#D0A96B]" />
                  <span>Exportar Reporte PDF</span>
                </>
              )}
            </Button>

            {/* Selector de Rango de Fechas */}
            <div className="flex items-center gap-1.5 bg-slate-200/70 dark:bg-[#13261E] p-1 rounded-xl border border-slate-300/60 dark:border-[#1B362A] text-xs font-bold">
              <button
                onClick={() => setTimeRange('current_month')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  timeRange === 'current_month'
                    ? 'bg-white dark:bg-zinc-800 text-slate-950 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950'
                }`}
              >
                Mes Actual
              </button>
              <button
                onClick={() => setTimeRange('previous_month')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  timeRange === 'previous_month'
                    ? 'bg-white dark:bg-zinc-800 text-slate-950 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950'
                }`}
              >
                Mes Anterior
              </button>
              <button
                onClick={() => setTimeRange('last_30_days')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  timeRange === 'last_30_days'
                    ? 'bg-white dark:bg-zinc-800 text-slate-950 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950'
                }`}
              >
                Últimos 30 días
              </button>
              <button
                onClick={() => setTimeRange('current_year')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  timeRange === 'current_year'
                    ? 'bg-white dark:bg-zinc-800 text-slate-950 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950'
                }`}
              >
                Año en Curso
              </button>
            </div>

          </div>
        </div>

        {/* ÁREA CAPTURADA PARA PDF (pdf-export-area) */}
        <div id="pdf-export-area" className="space-y-6 bg-[#08130E] p-6 rounded-2xl border border-[#1B362A] shadow-2xl">
          
          {/* LOGO EN CABECERA DEL REPORTE DE EXPORTACIÓN */}
          <div className="flex items-center justify-between pb-4 border-b border-[#1B362A]">
            <div className="flex items-center gap-3">
              <img src="/logo-elohim.png" alt="Elohim Import ERP" className="h-10 w-auto object-contain" />
              <div>
                <h2 className="text-base font-bold text-white font-serif tracking-wider">ELOHIM IMPORT ERP</h2>
                <p className="text-[10px] text-[#D0A96B] font-mono uppercase tracking-widest">Reporte Financiero Oficial</p>
              </div>
            </div>
            <div className="text-right text-[11px] font-mono text-zinc-400">
              <div>Rango: <span className="text-[#D0A96B] font-bold">{timeRange === 'current_month' ? 'Mes Actual' : timeRange === 'previous_month' ? 'Mes Anterior' : timeRange === 'last_30_days' ? 'Últimos 30 días' : 'Año en Curso'}</span></div>
              <div>Generado: {new Date().toLocaleDateString('es-AR')}</div>
            </div>
          </div>

          {/* WIDGET DE METAS MENSUALES Y RUN RATE */}
          <MonthlyGoalsWidget />

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
