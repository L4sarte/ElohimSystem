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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Componente Tooltip personalizado para el gráfico de Recharts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#08130E]/95 border border-[#1B362A] p-3.5 rounded-xl shadow-2xl text-xs space-y-1.5 backdrop-blur-md">
        <p className="font-mono font-bold text-zinc-400 border-b border-[#1B362A] pb-1">{label}</p>
        <p className="font-bold text-[#D0A96B] flex items-center justify-between gap-3">
          <span>Ventas Brutas:</span>
          <span className="font-mono">${Number(payload[0].value).toLocaleString('es-AR')}</span>
        </p>
        {payload[1] && (
          <p className="font-bold text-emerald-400 flex items-center justify-between gap-3">
            <span>Ganancia Neta:</span>
            <span className="font-mono">${Number(payload[1].value).toLocaleString('es-AR')}</span>
          </p>
        )}
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const { role } = useUserStore();
  const { refresh: refreshRate } = useExchangeRate();

  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);

  const loadDashboardData = async () => {
    if (role === 'admin') {
      setLoadingStats(true);
      const res = await getDashboardData(role);
      if (res.success && res.data) {
        setStats(res.data);
      }
      setLoadingStats(false);
    } else {
      setStats(null);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [role]);

  return (
    <div className="flex flex-col min-h-screen bg-[#08130E] text-zinc-50 transition-colors duration-300">
      
      {/* HEADER MINIMALISTA CONTROL BAR */}
      <header className="sticky top-0 z-40 w-full border-b border-[#1B362A] bg-[#08130E]/90 backdrop-blur-md">
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
            <kbd className="hidden lg:inline-flex items-center gap-1 text-[10px] font-mono px-2.5 py-1 rounded-xl bg-[#13261E] border border-[#1B362A] text-[#D0A96B] font-extrabold shadow-sm">
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
            
            {loadingStats ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 border border-[#1B362A] bg-[#13261E]/60 rounded-2xl">
                <RefreshCw className="h-8 w-8 animate-spin text-[#D0A96B]" />
                <span className="text-sm font-semibold text-zinc-400">Cargando analíticas comerciales...</span>
              </div>
            ) : stats ? (
              <>
                {/* GRILLA KPI CARDS CON JERARQUÍA TYPOGRAPHY Y ICONOS DORADOS */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  
                  {/* Ingresos ARS */}
                  <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl transition-all duration-300 hover:border-[#D0A96B]/50">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                      <div>
                        <CardDescription className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">Ingresos Totales (ARS)</CardDescription>
                        <CardTitle className="text-3xl sm:text-4xl font-bold tracking-tight text-white mt-1.5 font-serif">
                          ${Math.round(stats.totalRevenueArs).toLocaleString('es-AR')}
                        </CardTitle>
                      </div>
                      <div className="h-11 w-11 rounded-xl bg-[#D0A96B]/10 border border-[#D0A96B]/30 flex items-center justify-center text-[#D0A96B] shrink-0">
                        <Coins className="h-6 w-6" />
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Volumen USD */}
                  <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl transition-all duration-300 hover:border-[#D0A96B]/50">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                      <div>
                        <CardDescription className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">Volumen Comercial (USD)</CardDescription>
                        <CardTitle className="text-3xl sm:text-4xl font-bold tracking-tight text-white mt-1.5 font-serif">
                          u$s {stats.totalRevenueUsd.toFixed(2)}
                        </CardTitle>
                      </div>
                      <div className="h-11 w-11 rounded-xl bg-[#D0A96B]/10 border border-[#D0A96B]/30 flex items-center justify-center text-[#D0A96B] shrink-0">
                        <TrendingUp className="h-6 w-6" />
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Ganancias ARS */}
                  <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl transition-all duration-300 hover:border-emerald-500/40">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                      <div>
                        <CardDescription className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">Ganancia Neta (ARS)</CardDescription>
                        <CardTitle className="text-3xl sm:text-4xl font-bold tracking-tight text-emerald-400 mt-1.5 font-serif">
                          ${Math.round(stats.estimatedProfitArs).toLocaleString('es-AR')}
                        </CardTitle>
                      </div>
                      <div className="h-11 w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                        <DollarSign className="h-6 w-6 text-[#D0A96B]" />
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Rentabilidad promedio */}
                  <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl transition-all duration-300 hover:border-[#D0A96B]/50">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                      <div>
                        <CardDescription className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">Rentabilidad Promedio</CardDescription>
                        <CardTitle className="text-3xl sm:text-4xl font-bold tracking-tight text-[#E5C158] mt-1.5 font-serif">
                          {stats.totalRevenueArs > 0 
                            ? `${((stats.estimatedProfitArs / stats.totalRevenueArs) * 100).toFixed(1)}%` 
                            : '0.0%'}
                        </CardTitle>
                      </div>
                      <div className="h-11 w-11 rounded-xl bg-[#D0A96B]/10 border border-[#D0A96B]/30 flex items-center justify-center text-[#D0A96B] shrink-0">
                        <Percent className="h-6 w-6" />
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
                    <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl p-6 shadow-xl space-y-4">
                      <CardHeader className="px-0 pt-0 pb-6 border-b border-[#1B362A]">
                        <CardTitle className="text-sm font-bold text-zinc-200 font-serif flex items-center gap-2">
                          <Activity className="h-4.5 w-4.5 text-[#D0A96B]" />
                          Historial Diario de Facturación y Utilidad (ARS)
                        </CardTitle>
                        <CardDescription className="text-xs text-zinc-400">Visualización histórica de ventas versus margen neto agrupado.</CardDescription>
                      </CardHeader>
                      
                      {stats.salesByDate.length > 0 ? (
                        <div className="h-72 w-full mt-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.salesByDate} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a80" />
                              <XAxis dataKey="date" tickLine={false} axisLine={false} style={{ fontSize: '10px', fill: '#71717a' }} />
                              <YAxis tickLine={false} axisLine={false} style={{ fontSize: '10px', fill: '#71717a' }} />
                              <Tooltip content={<CustomTooltip />} />
                              <Bar name="Ventas" dataKey="Ventas" fill="#D0A96B" radius={[6, 6, 0, 0]} barSize={22} />
                              <Bar name="Ganancias" dataKey="Ganancias" fill="#10b981" radius={[6, 6, 0, 0]} barSize={22} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center space-y-2 border border-dashed border-[#1B362A] rounded-2xl bg-[#08130E]/50 my-4">
                          <Activity className="h-10 w-10 text-[#D0A96B]/50" />
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
                    <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl">
                      <CardHeader className="pb-3 border-b border-[#1B362A]">
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
                              <div key={prod.id} className="flex items-center justify-between text-xs bg-[#08130E]/40 border border-[#1B362A] rounded-xl p-2.5">
                                <div className="max-w-[70%]">
                                  <div className="font-bold text-white truncate" title={prod.name}>
                                    {prod.name}
                                  </div>
                                  <div className="text-[10px] text-zinc-500 mt-0.5 truncate">
                                    SKU: {prod.sku} • {prod.type === 'bottle' ? 'Botella' : 'Envase'}
                                  </div>
                                </div>
                                <span className={`font-mono font-extrabold px-2 py-0.5 rounded-lg text-[10px] ${
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
                        <CardFooter className="pb-4 border-t border-[#1B362A] px-4 pt-3 flex justify-end">
                          <Link href="/productos" className="text-[10px] font-bold text-[#D0A96B] hover:text-[#E5C158] flex items-center gap-0.5">
                            Gestionar Inventario <ChevronRight className="h-3 w-3" />
                          </Link>
                        </CardFooter>
                      )}
                    </Card>

                    {/* PANEL 2: ÚLTIMAS VENTAS */}
                    <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl">
                      <CardHeader className="pb-3 border-b border-[#1B362A]">
                        <CardTitle className="text-xs font-extrabold text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-[#D0A96B]" />
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
                          <div className="space-y-3">
                            {stats.recentSales.map((sale: any) => (
                              <div key={sale.id} className="flex items-center justify-between text-xs pb-3 border-b border-[#1B362A]/60 last:border-0 last:pb-0">
                                <div>
                                  <div className="font-bold text-zinc-200">
                                    {sale.client_name}
                                  </div>
                                  <div className="text-[9px] text-zinc-500 font-mono mt-0.5">
                                    {new Date(sale.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} • ID: #{sale.id.split('-')[0].toUpperCase()}
                                  </div>
                                </div>
                                <span className="font-mono font-black text-emerald-400">
                                  +${sale.total_ars.toLocaleString('es-AR')}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                      {stats.recentSales.length > 0 && (
                        <CardFooter className="pb-4 border-t border-[#1B362A] px-4 pt-3 flex justify-end">
                          <Link href="/clientes" className="text-[10px] font-bold text-[#D0A96B] hover:text-[#E5C158] flex items-center gap-0.5">
                            Ver Clientes & Ventas <ChevronRight className="h-3 w-3" />
                          </Link>
                        </CardFooter>
                      )}
                    </Card>

                  </div>

                </div>

              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 gap-3 border border-[#1B362A] bg-[#13261E]/90 rounded-2xl text-zinc-400">
                <AlertCircle className="h-10 w-10 text-rose-500" />
                <h3 className="font-bold text-white">Error de Carga</h3>
                <p className="text-xs text-zinc-500">No se pudieron recuperar las métricas desde la base de datos.</p>
                <Button onClick={loadDashboardData} className="mt-2">Reintentar</Button>
              </div>
            )}

          </div>
        )}

        {/* ------------------ VISTA DE VENDEDOR ------------------ */}
        {role === 'seller' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Mensaje de Bienvenida */}
            <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl p-6 overflow-hidden relative">
              <div className="absolute top-0 right-0 h-40 w-40 bg-gradient-to-bl from-violet-500/10 to-transparent rounded-full -mr-10 -mt-10" />
              <div className="space-y-2 max-w-lg">
                <div className="flex items-center gap-1.5 text-[#D0A96B] text-xs font-bold uppercase tracking-widest">
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
              <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl hover:border-emerald-500/40 transition-all duration-300 flex flex-col justify-between">
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
              <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl hover:border-indigo-500/40 transition-all duration-300 flex flex-col justify-between">
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
              <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl hover:border-[#D0A96B]/40 transition-all duration-300 flex flex-col justify-between">
                <CardHeader>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D0A96B]/10 border border-violet-500/20 text-[#D0A96B]">
                    <Users className="h-5 w-5" />
                  </div>
                  <CardTitle className="mt-4 font-serif text-lg text-white">CRM de Clientes</CardTitle>
                  <CardDescription className="text-xs text-zinc-400">
                    Administra contactos de clientes, registra nuevos y consulta perfiles olfativos.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Link href="/clientes" className="w-full">
                    <Button className="w-full justify-center bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold shadow-md shadow-[#D0A96B]/20 text-white cursor-pointer h-10 text-xs font-bold shadow-md shadow-violet-600/20 transition-all hover:scale-[1.02]">
                      Ver Clientes <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>

            </div>

          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="border-t border-[#1B362A] bg-[#08130E] py-6 mt-12">
        <div className="container mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 max-w-6xl">
          <p>© 2026 Elohim Import ERP. Todos los derechos reservados.</p>
          <div className="flex gap-4">
            <span className="hover:text-zinc-300">Security by Design (RLS)</span>
            <span>•</span>
            <span className="hover:text-zinc-300">Bimonetario Base ARS</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
