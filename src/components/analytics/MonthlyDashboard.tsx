'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { 
  BarChart3, PieChart as PieChartIcon, Trophy, Download, Calendar, 
  TrendingUp, DollarSign, CreditCard, Award, ArrowUpRight, Sparkles, Filter 
} from 'lucide-react';
import Link from 'next/link';

export interface MonthlyDashboardProps {
  monthlyRevenueData?: Array<{
    month: string;
    ingresosBrutos: number;
    gananciaNeta: number;
  }>;
  paymentMethodDistribution?: Array<{
    name: string;
    value: number;
    amountArs: number;
    color: string;
  }>;
  topSellingProducts?: Array<{
    rank: number;
    name: string;
    brand: string;
    salesCount: number;
    totalRevenueArs: number;
  }>;
}

// DATOS MOCKEADOS POR DEFECTO REEMPLAZANDO EL EXCEL TRADICIONAL
const DEFAULT_MONTHLY_REVENUE = [
  { month: 'Feb', ingresosBrutos: 3450000, gananciaNeta: 1725000 },
  { month: 'Mar', ingresosBrutos: 4100000, gananciaNeta: 2050000 },
  { month: 'Abr', ingresosBrutos: 4850000, gananciaNeta: 2425000 },
  { month: 'May', ingresosBrutos: 5600000, gananciaNeta: 2800000 },
  { month: 'Jun', ingresosBrutos: 6900000, gananciaNeta: 3450000 },
  { month: 'Jul', ingresosBrutos: 8250000, gananciaNeta: 4125000 }
];

const DEFAULT_PAYMENT_DISTRIBUTION = [
  { name: 'Transferencia / Alias', value: 45, amountArs: 3712500, color: '#D0A96B' }, // Dorado
  { name: 'Mercado Pago / Tarjetas', value: 30, amountArs: 2475000, color: '#2E5C47' }, // Esmeralda Claro
  { name: 'Efectivo ARS', value: 15, amountArs: 1237500, color: '#F59E0B' }, // Amber
  { name: 'Dólares Billete', value: 10, amountArs: 825000, color: '#6366F1' } // Indigo
];

const DEFAULT_TOP_PRODUCTS = [
  { rank: 1, name: 'Creed Aventus EDP 100ml', brand: 'Creed', salesCount: 34, totalRevenueArs: 1870000 },
  { rank: 2, name: 'Dior Sauvage Elixir 60ml', brand: 'Dior', salesCount: 28, totalRevenueArs: 1400000 },
  { rank: 3, name: 'Parfums de Marly Delina 75ml', brand: 'Parfums de Marly', salesCount: 22, totalRevenueArs: 1320000 },
  { rank: 4, name: 'Tom Ford Tobacco Vanille 50ml', brand: 'Tom Ford', salesCount: 18, totalRevenueArs: 1170000 },
  { rank: 5, name: 'Armaf Club de Nuit Intense 105ml', brand: 'Armaf', salesCount: 42, totalRevenueArs: 840000 }
];

// TOOLTIP PERSONALIZADO DARK MODE & GOLD PARA BAR CHART
const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#08130E]/95 border border-[#1B362A] p-3.5 rounded-xl shadow-2xl text-xs space-y-2 backdrop-blur-md">
        <p className="font-serif font-bold text-[#D0A96B] border-b border-[#1B362A] pb-1 uppercase tracking-wider">
          Mes de {label}
        </p>
        <div className="space-y-1 font-mono">
          <div className="flex items-center justify-between gap-4 text-zinc-300">
            <span className="flex items-center gap-1.5 font-sans">
              <span className="h-2 w-2 rounded-full bg-[#D0A96B]"></span> Facturación Bruta:
            </span>
            <span className="font-bold text-[#D0A96B]">${Number(payload[0].value).toLocaleString('es-AR')} ARS</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-zinc-300">
            <span className="flex items-center gap-1.5 font-sans">
              <span className="h-2 w-2 rounded-full bg-[#2E5C47]"></span> Ganancia Neta:
            </span>
            <span className="font-bold text-emerald-400">${Number(payload[1].value).toLocaleString('es-AR')} ARS</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// TOOLTIP PERSONALIZADO PARA PIE CHART / DONUT
const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#08130E]/95 border border-[#1B362A] p-3 rounded-xl shadow-2xl text-xs space-y-1 backdrop-blur-md font-mono">
        <p className="font-serif font-bold text-white font-sans">{data.name}</p>
        <p className="text-[#D0A96B] font-bold">
          {data.value}% del Total (${Number(data.amountArs).toLocaleString('es-AR')} ARS)
        </p>
      </div>
    );
  }
  return null;
};

export function MonthlyDashboard({
  monthlyRevenueData = DEFAULT_MONTHLY_REVENUE,
  paymentMethodDistribution = DEFAULT_PAYMENT_DISTRIBUTION,
  topSellingProducts = DEFAULT_TOP_PRODUCTS
}: MonthlyDashboardProps) {

  const totalCurrentMonthGross = monthlyRevenueData[monthlyRevenueData.length - 1]?.ingresosBrutos || 0;
  const totalCurrentMonthNet = monthlyRevenueData[monthlyRevenueData.length - 1]?.gananciaNeta || 0;

  return (
    <div className="space-y-6">
      
      {/* HEADER DE BIENVENIDA Y ACCIONES DE REPORTES */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-[#13261E] p-6 rounded-2xl border border-[#1B362A] shadow-xl">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#D0A96B] flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" /> Reemplazo de Matriz Excel
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-white font-serif mt-1">
            Dashboard Visual de Reportes Mensuales
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl">
            Analítica de facturación, márgenes reales de rentabilidad y desglose por pasarelas de pago.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/admin/reportes">
            <Button variant="outline" size="sm" className="border-[#1B362A] bg-[#08130E] text-xs font-semibold text-zinc-300 hover:bg-zinc-800">
              <BarChart3 className="mr-1.5 h-3.5 w-3.5 text-[#D0A96B]" /> Reporte Numérico / PDF
            </Button>
          </Link>
        </div>
      </div>

      {/* SECCIÓN DE GRÁFICOS INTERACTIVOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* GRÁFICO PRINCIPAL (BAR CHART): EVOLUCIÓN DE INGRESOS Y GANANCIAS */}
        <Card className="border border-[#1B362A] bg-[#13261E] lg:col-span-2 rounded-2xl shadow-xl overflow-hidden">
          <CardHeader className="pb-2 border-b border-[#1B362A]">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-white font-serif flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-[#D0A96B]" />
                  Evolución de Ingresos y Ganancias (Últimos 6 Meses)
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400 mt-0.5">
                  Comparativa semestral entre Facturación Bruta y Margen Neto Real.
                </CardDescription>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono hidden sm:flex">
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <span className="h-3 w-3 rounded bg-[#D0A96B]"></span> Facturación Bruta
                </div>
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <span className="h-3 w-3 rounded bg-[#2E5C47]"></span> Ganancia Neta
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenueData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1B362A" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    stroke="#71717a" 
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#71717a" 
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
                    dataKey="gananciaNeta" 
                    name="Ganancia Neta" 
                    fill="#2E5C47" 
                    radius={[6, 6, 0, 0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* GRÁFICO SECUNDARIO (DONUT CHART): DISTRIBUCIÓN POR MEDIO DE PAGO */}
        <Card className="border border-[#1B362A] bg-[#13261E] rounded-2xl shadow-xl flex flex-col justify-between overflow-hidden">
          <CardHeader className="pb-2 border-b border-[#1B362A]">
            <CardTitle className="text-base font-bold text-white font-serif flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-emerald-400" />
              Distribución por Medio de Pago
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400 mt-0.5">
              Porcentaje recaudado según canal y pasarela de cobro.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4 flex-1 flex flex-col justify-center">
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
                <span className="text-[10px] uppercase font-extrabold tracking-widest text-zinc-500">Recaudado</span>
                <span className="text-sm font-bold text-white font-mono">${(totalCurrentMonthGross / 1000000).toFixed(2)}M</span>
              </div>
            </div>

            {/* Leyenda personalizada */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1B362A] text-xs font-mono">
              {paymentMethodDistribution.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                  <div className="truncate">
                    <span className="text-zinc-300 font-sans text-[11px] block truncate">{item.name}</span>
                    <span className="font-bold text-[#D0A96B]">{item.value}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>

      {/* RANKING TOP 5 PERFUMES MÁS VENDIDOS */}
      <Card className="border border-[#1B362A] bg-[#13261E] rounded-2xl shadow-xl overflow-hidden">
        <CardHeader className="border-b border-[#1B362A] pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-white font-serif flex items-center gap-2">
                <Trophy className="h-5 w-5 text-[#D0A96B]" />
                Top 5 Fragancias Más Vendidas (Ranking Mes Actual)
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400 mt-1">
                Los productos estrella de perfumería con mayor rotación de stock e ingresos.
              </CardDescription>
            </div>
            <span className="text-xs font-mono text-[#D0A96B] bg-[#D0A96B]/10 px-3 py-1 rounded-full border border-[#D0A96B]/30 font-bold hidden sm:inline-block">
              ★ Best Sellers
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="divide-y divide-[#1B362A]">
            {topSellingProducts.map((prod) => (
              <div key={prod.rank} className="p-4 flex items-center justify-between hover:bg-[#08130E]/40 transition-colors">
                
                <div className="flex items-center gap-4">
                  {/* Badge de Ranking */}
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-serif font-black text-base shadow-md ${
                    prod.rank === 1 ? 'bg-[#D0A96B] text-[#08130E] shadow-[#D0A96B]/20' :
                    prod.rank === 2 ? 'bg-zinc-300 text-zinc-900' :
                    prod.rank === 3 ? 'bg-amber-700 text-amber-100' :
                    'bg-[#08130E] text-zinc-400 border border-[#1B362A]'
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
                  <div className="text-sm font-bold text-[#D0A96B] font-mono">
                    ${prod.totalRevenueArs.toLocaleString('es-AR')} ARS
                  </div>
                  <div className="text-xs text-emerald-400 font-bold font-mono mt-0.5">
                    {prod.salesCount} frascos vendidos
                  </div>
                </div>

              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
