'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { getVisualDashboardData, VisualDashboardData } from '@/app/actions/dashboardVisual';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { 
  BarChart3, PieChart as PieChartIcon, Trophy, RefreshCw, AlertCircle, 
  Sparkles, PackageX 
} from 'lucide-react';
import Link from 'next/link';

interface BarTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload?: any }>;
  label?: string;
}

// TOOLTIP PERSONALIZADO DARK MODE & GOLD PARA BAR CHART
const CustomBarTooltip = ({ active, payload, label }: BarTooltipProps) => {
  if (active && payload && payload.length >= 2) {
    const data = payload[0]?.payload;
    const ingresos = data?.ingresosBrutos ?? payload[0]?.value;
    const gananciaReal = data?.gananciaReal ?? payload[1]?.value;
    const gananciaNeta = data?.gananciaNeta ?? payload[2]?.value ?? payload[1]?.value;

    return (
      <div className="bg-erp-bg/95 border border-erp-border p-3.5 rounded-xl shadow-2xl text-xs space-y-2 backdrop-blur-md">
        <p className="font-serif font-bold text-erp-gold border-b border-erp-border pb-1 uppercase tracking-wider">
          Mes de {label}
        </p>
        <div className="space-y-1.5 font-mono">
          <div className="flex items-center justify-between gap-4 text-zinc-300">
            <span className="flex items-center gap-1.5 font-sans">
              <span className="h-2 w-2 rounded-full bg-erp-gold"></span> Facturación Bruta:
            </span>
            <span className="font-bold text-erp-gold">${Number(ingresos || 0).toLocaleString('es-AR')} ARS</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-zinc-300">
            <span className="flex items-center gap-1.5 font-sans">
              <span className="h-2 w-2 rounded-full bg-[#10B981]"></span> Ganancia Comercial Real:
            </span>
            <span className="font-bold text-emerald-400">${Number(gananciaReal || 0).toLocaleString('es-AR')} ARS</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-zinc-300">
            <span className="flex items-center gap-1.5 font-sans">
              <span className="h-2 w-2 rounded-full bg-[#2E5C47]"></span> Ganancia Neta Final:
            </span>
            <span className="font-bold text-teal-300">${Number(gananciaNeta || 0).toLocaleString('es-AR')} ARS</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

interface PieTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      name: string;
      value: number;
      amountArs: number;
    };
  }>;
}

// TOOLTIP PERSONALIZADO PARA PIE CHART / DONUT
const CustomPieTooltip = ({ active, payload }: PieTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-erp-bg/95 border border-erp-border p-3 rounded-xl shadow-2xl text-xs space-y-1 backdrop-blur-md font-mono">
        <p className="font-serif font-bold text-white font-sans">{data.name}</p>
        <p className="text-erp-gold font-bold">
          {data.value}% del Total (${Number(data.amountArs || 0).toLocaleString('es-AR')} ARS)
        </p>
      </div>
    );
  }
  return null;
};

export function MonthlyDashboard() {
  const role = useUserStore((state) => state.role);
  const [visualData, setVisualData] = useState<VisualDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    if (role !== 'admin') return;
    setLoading(true);
    setError(null);
    const res = await getVisualDashboardData(role);
    if (res.success && res.data) {
      setVisualData(res.data);
    } else {
      setError(res.error || 'Error al conectar con la base de datos de Supabase.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, [role]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 space-y-4">
        <RefreshCw className="h-8 w-8 animate-spin text-erp-gold" />
        <p className="text-sm font-medium text-zinc-400">Consultando datos reales de Supabase...</p>
      </div>
    );
  }

  if (error || !visualData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 space-y-3 text-center">
        <AlertCircle className="h-10 w-10 text-rose-500" />
        <h3 className="text-base font-bold">No se pudieron cargar las métricas reales</h3>
        <p className="text-xs text-zinc-400 max-w-md">{error || 'Ocurrió un error al obtener la analítica gráfica.'}</p>
        <Button variant="outline" onClick={fetchDashboardData} className="border-erp-border bg-erp-bg text-xs font-bold text-white">
          Reintentar
        </Button>
      </div>
    );
  }

  const { monthlyRevenueData, paymentMethodDistribution, topSellingProducts, totalCurrentMonthGross } = visualData;

  return (
    <div className="space-y-6">
      
      {/* HEADER DE BIENVENIDA Y ACCIONES DE REPORTES */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-erp-surface p-6 rounded-2xl border border-erp-border shadow-xl">
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-erp-gold flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" /> Analítica Real en Tiempo Real
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-white font-serif mt-1">
            Dashboard Visual de Reportes Mensuales
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl">
            Facturación acumulada real, márgenes netos deduciendo costos y distribución por canales de cobro.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchDashboardData}
            className="border-erp-border bg-erp-bg text-xs font-semibold text-zinc-300 hover:bg-zinc-800 cursor-pointer"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5 text-erp-gold" /> Actualizar
          </Button>

          <Link href="/admin/reportes">
            <Button variant="outline" size="sm" className="border-erp-border bg-erp-bg text-xs font-semibold text-zinc-300 hover:bg-zinc-800 cursor-pointer">
              <BarChart3 className="mr-1.5 h-3.5 w-3.5 text-erp-gold" /> Reporte Numérico / PDF
            </Button>
          </Link>
        </div>
      </div>

      {/* SECCIÓN DE GRÁFICOS INTERACTIVOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* GRÁFICO PRINCIPAL (BAR CHART): EVOLUCIÓN DE INGRESOS Y GANANCIAS */}
        <Card className="border border-erp-border bg-erp-surface lg:col-span-2 rounded-2xl shadow-xl overflow-hidden">
          <CardHeader className="pb-2 border-b border-erp-border">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-white font-serif flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-erp-gold" />
                  Evolución de Ingresos y Ganancias (Últimos 6 Meses)
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400 mt-0.5">
                  Comparativa semestral real entre Facturación Bruta, Ganancia Comercial Real y Margen Neto.
                </CardDescription>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono flex-wrap">
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <span className="h-3 w-3 rounded bg-erp-gold"></span> Facturación Bruta
                </div>
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <span className="h-3 w-3 rounded bg-[#10B981]"></span> Ganancia Real
                </div>
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <span className="h-3 w-3 rounded bg-[#2E5C47]"></span> Ganancia Neta
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            {monthlyRevenueData.length > 0 ? (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    stroke="var(--muted-foreground)" 
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="var(--muted-foreground)" 
                    fontSize={11}
                    tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar 
                    dataKey="ingresosBrutos" 
                    name="Facturación Bruta" 
                    fill="#D0A96B" 
                    radius={[6, 6, 0, 0]} 
                  />
                  <Bar 
                    dataKey="gananciaReal" 
                    name="Ganancia Comercial Real" 
                    fill="#10B981" 
                    radius={[6, 6, 0, 0]} 
                  />
                  <Bar 
                    dataKey="gananciaNeta" 
                    name="Ganancia Neta" 
                    fill="#2E5C47" 
                    radius={[6, 6, 0, 0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center text-zinc-500 space-y-2 border border-dashed border-erp-border rounded-2xl bg-erp-bg/50">
                <BarChart3 className="h-8 w-8 text-zinc-600" />
                <p className="text-xs font-bold text-zinc-400">Sin datos suficientes para el gráfico</p>
                <p className="text-[11px] max-w-xs">Aún no hay ventas registradas en los últimos 6 meses.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* GRÁFICO SECUNDARIO (DONUT CHART): DISTRIBUCIÓN POR MEDIO DE PAGO */}
        <Card className="border border-erp-border bg-erp-surface rounded-2xl shadow-xl flex flex-col justify-between overflow-hidden">
          <CardHeader className="pb-2 border-b border-erp-border">
            <CardTitle className="text-base font-bold text-white font-serif flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-emerald-400" />
              Distribución por Medio de Pago
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400 mt-0.5">
              Porcentaje recaudado según canal y pasarela de cobro.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4 flex-1 flex flex-col justify-center">
            {totalCurrentMonthGross === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-zinc-500 space-y-2">
                <PackageX className="h-8 w-8 text-zinc-600" />
                <p className="text-xs">Sin ventas registradas en el mes en curso.</p>
              </div>
            ) : (
              <>
                <div className="h-56 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentMethodDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {paymentMethodDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="#13261E" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Centro Informativo en el Donut */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                    <span className="text-[11px] uppercase font-extrabold tracking-widest text-zinc-500">Recaudado</span>
                    <span className="text-sm font-bold text-white font-mono">${(totalCurrentMonthGross / 1000000).toFixed(2)}M</span>
                  </div>
                </div>

                {/* Leyenda personalizada */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-erp-border text-xs font-mono">
                  {paymentMethodDistribution.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                      <div className="truncate">
                        <span className="text-zinc-300 font-sans text-[11px] block truncate">{item.name}</span>
                        <span className="font-bold text-erp-gold">{item.value}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

      </div>

      {/* RANKING TOP 5 PERFUMES MÁS VENDIDOS */}
      <Card className="border border-erp-border bg-erp-surface rounded-2xl shadow-xl overflow-hidden">
        <CardHeader className="border-b border-erp-border pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-white font-serif flex items-center gap-2">
                <Trophy className="h-5 w-5 text-erp-gold" />
                Top 5 Fragancias Más Vendidas (Ranking Mes Actual)
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400 mt-1">
                Los productos estrella de perfumería con mayor rotación de stock e ingresos en Supabase.
              </CardDescription>
            </div>
            <span className="text-xs font-mono text-erp-gold bg-erp-gold/10 px-3 py-1 rounded-full border border-erp-gold/30 font-bold hidden sm:inline-block">
              ★ Best Sellers Reales
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {topSellingProducts.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs space-y-1">
              <p className="font-bold text-zinc-400">Sin registros de venta suficientes en este mes</p>
              <p>Las fragancias más vendidas aparecerán automáticamente al realizar cobros en el POS.</p>
            </div>
          ) : (
            <div className="divide-y divide-erp-border">
              {topSellingProducts.map((prod) => (
                <div key={prod.rank} className="p-4 flex items-center justify-between hover:bg-erp-bg/40 transition-colors">
                  
                  <div className="flex items-center gap-4">
                    {/* Badge de Ranking */}
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-serif font-black text-base shadow-md ${
                      prod.rank === 1 ? 'bg-erp-gold text-erp-bg shadow-erp-gold/20' :
                      prod.rank === 2 ? 'bg-zinc-300 text-zinc-900' :
                      prod.rank === 3 ? 'bg-amber-700 text-amber-100' :
                      'bg-erp-bg text-zinc-400 border border-erp-border'
                    }`}>
                      #{prod.rank}
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-white font-serif flex items-center gap-2">
                        {prod.name}
                      </h4>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Marca: <strong className="text-zinc-300">{prod.brand}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-bold text-erp-gold font-mono">
                      ${prod.totalRevenueArs.toLocaleString('es-AR')} ARS
                    </div>
                    <div className="text-xs text-emerald-400 font-bold font-mono mt-0.5">
                      {prod.salesCount} unidades vendidas
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
