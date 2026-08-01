'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { getPurchases, getAccountsPayable } from '@/app/actions/purchases';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import { 
  ArrowLeft, Plus, Truck, PackagePlus, Clock, Check, RefreshCw, 
  AlertCircle, ShieldAlert, DollarSign, FileText, CreditCard, Building
} from 'lucide-react';
import Link from 'next/link';

import { InTransitDashboard } from '@/components/supply-chain/InTransitDashboard';
import { POBuilder } from '@/components/supply-chain/POBuilder';

export default function ComprasDashboardPage() {
  const { role } = useUserStore();
  const { refresh: refreshRate } = useExchangeRate();

  const [purchases, setPurchases] = useState<any[]>([]);
  const [payables, setPayables] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'in_transit' | 'po_builder' | 'purchases' | 'payables'>('in_transit');

  const fetchDashboardData = async () => {
    if (role !== 'admin') return;
    setLoading(true);
    setError(null);

    const [pRes, cxpRes] = await Promise.all([
      getPurchases(role),
      getAccountsPayable(role)
    ]);

    if (pRes.success && pRes.data) {
      setPurchases(pRes.data);
    }
    if (cxpRes.success && cxpRes.data) {
      setPayables(cxpRes.data);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, [role]);

  // Denegar acceso para rol vendedor
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
                El módulo de compras B2B y cuentas por pagar es exclusivo para administradores.
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

  const totalSpentArs = purchases.reduce((sum, p) => sum + Number(p.total_ars || 0), 0);
  const totalPayableArs = payables.filter(c => c.status === 'pending').reduce((sum, c) => sum + Number(c.total_amount_ars || 0), 0);

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
                <PackagePlus className="h-4.5 w-4.5" />
              </div>
              <span className="text-sm font-bold tracking-tight text-slate-800 dark:text-zinc-100 uppercase">
                Módulo B2B: Compras e Inventario
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
      <main className="flex-1 container mx-auto px-4 py-8 sm:px-6 max-w-6xl">
        
        {/* Cabecera */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Gestión B2B de Compras y Proveedores
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
              Control de facturas de compra, reabastecimiento de stock y registro de Cuentas por Pagar.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/compras/proveedores">
              <Button variant="outline" className="cursor-pointer">
                <Truck className="mr-2 h-4 w-4" /> Proveedores B2B
              </Button>
            </Link>

            <Link href="/compras/nueva">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-sm">
                <Plus className="mr-2 h-4 w-4" /> Nueva Compra
              </Button>
            </Link>
          </div>
        </div>

        {/* TARJETAS DE RESUMEN KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <Card className="border-slate-200 dark:border-[#1B362A] bg-white dark:bg-[#13261E]">
            <CardHeader className="pb-2">
              <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Compras Históricas (ARS)</CardDescription>
              <CardTitle className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-1">
                ${totalSpentArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-slate-200 dark:border-[#1B362A] bg-white dark:bg-[#13261E]">
            <CardHeader className="pb-2">
              <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Deuda Pendiente (Cuentas por Pagar)</CardDescription>
              <CardTitle className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1">
                ${totalPayableArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-slate-200 dark:border-[#1B362A] bg-white dark:bg-[#13261E]">
            <CardHeader className="pb-2">
              <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Órdenes de Compra Totales</CardDescription>
              <CardTitle className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono mt-1">
                {purchases.length} compras
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* PESTAÑAS SELECCIÓN */}
        <div className="flex flex-wrap border-b border-slate-200 dark:border-[#1B362A] mb-6 gap-2">
          <button
            onClick={() => setActiveTab('in_transit')}
            className={`pb-3 px-4 font-bold text-xs transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'in_transit'
                ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Truck className="h-4 w-4" /> Mercadería en Camino
          </button>

          <button
            onClick={() => setActiveTab('po_builder')}
            className={`pb-3 px-4 font-bold text-xs transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'po_builder'
                ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Plus className="h-4 w-4" /> Creador PO Builder
          </button>

          <button
            onClick={() => setActiveTab('purchases')}
            className={`pb-3 px-4 font-bold text-xs transition-colors border-b-2 cursor-pointer ${
              activeTab === 'purchases'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Historial de Compras B2B ({purchases.length})
          </button>

          <button
            onClick={() => setActiveTab('payables')}
            className={`pb-3 px-4 font-bold text-xs transition-colors border-b-2 cursor-pointer ${
              activeTab === 'payables'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Cuentas por Pagar ({payables.length})
          </button>
        </div>

        {/* CONTENIDO PESTAÑAS */}
        {activeTab === 'in_transit' ? (
          <InTransitDashboard />
        ) : activeTab === 'po_builder' ? (
          <POBuilder onSuccess={() => setActiveTab('in_transit')} />
        ) : (
          <Card className="border-slate-200 dark:border-[#1B362A]">
            <CardContent className="p-0 overflow-x-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
                  <span className="text-sm font-medium text-slate-500 dark:text-zinc-400">Cargando datos de compras...</span>
                </div>
              ) : activeTab === 'purchases' ? (
              
              /* TABLA DE COMPRAS */
              purchases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                  <PackagePlus className="h-10 w-10 text-slate-300 dark:text-zinc-700" />
                  <h3 className="font-bold text-slate-900 dark:text-white">Sin Compras Registradas</h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-sm">No se han registrado facturas de compras B2B aún.</p>
                  <Link href="/compras/nueva" className="mt-2">
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">Ingresar Primera Compra</Button>
                  </Link>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-[#1B362A] bg-slate-50/50 dark:bg-[#13261E]/40 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      <th className="p-4 pl-6">ID / Fecha</th>
                      <th className="p-4">Proveedor</th>
                      <th className="p-4 text-right">Total Factura (ARS)</th>
                      <th className="p-4 text-right">Equiv. (USD)</th>
                      <th className="p-4 text-center">Estado Pago</th>
                      <th className="p-4 pr-6">Productos Ingresados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-900 text-sm">
                    {purchases.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-[#13261E]/30 transition-colors">
                        <td className="p-4 pl-6 font-mono text-xs">
                          <div className="font-bold text-slate-900 dark:text-white">
                            #{p.id.split('-')[0].toUpperCase()}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(p.created_at).toLocaleString('es-AR')}
                          </div>
                        </td>

                        <td className="p-4">
                          <div className="font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                            <Building className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                            {p.suppliers?.name || 'Proveedor N/A'}
                          </div>
                        </td>

                        <td className="p-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                          ${Number(p.total_ars).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </td>

                        <td className="p-4 text-right font-mono text-xs text-indigo-600 dark:text-indigo-400 font-bold">
                          u$s {Number(p.total_usd || 0).toFixed(2)}
                        </td>

                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold ${
                            p.payment_status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400'
                          }`}>
                            {p.payment_status === 'paid' ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                            {p.payment_status === 'paid' ? 'Pagada' : 'Pendiente (CxP)'}
                          </span>
                        </td>

                        <td className="p-4 pr-6">
                          <div className="space-y-1">
                            {p.purchase_items?.map((item: any) => (
                              <div key={item.id} className="text-xs text-slate-600 dark:text-zinc-300">
                                <span className="font-bold">{item.products?.name}</span> x {item.quantity} ud
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )

            ) : (

              /* TABLA DE CUENTAS POR PAGAR */
              payables.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                  <CreditCard className="h-10 w-10 text-slate-300 dark:text-zinc-700" />
                  <h3 className="font-bold text-slate-900 dark:text-white">Sin Deudas Pendientes</h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-sm">No hay registros pendientes de pago en Cuentas por Pagar.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-[#1B362A] bg-slate-50/50 dark:bg-[#13261E]/40 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      <th className="p-4 pl-6">Proveedor</th>
                      <th className="p-4">Fecha Compra</th>
                      <th className="p-4 text-right">Monto Deuda (ARS)</th>
                      <th className="p-4">Fecha Vencimiento</th>
                      <th className="p-4 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-900 text-sm">
                    {payables.map(cxp => (
                      <tr key={cxp.id} className="hover:bg-slate-50/60 dark:hover:bg-[#13261E]/30 transition-colors">
                        <td className="p-4 pl-6 font-bold text-slate-900 dark:text-white">
                          {cxp.suppliers?.name || 'N/A'}
                        </td>

                        <td className="p-4 text-xs font-mono text-slate-500">
                          {new Date(cxp.created_at).toLocaleDateString('es-AR')}
                        </td>

                        <td className="p-4 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                          ${Number(cxp.total_amount_ars).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </td>

                        <td className="p-4 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                          {cxp.due_date ? new Date(cxp.due_date).toLocaleDateString('es-AR') : 'Sin fecha fijada'}
                        </td>

                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold ${
                            cxp.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400'
                          }`}>
                            {cxp.status === 'paid' ? 'Saldada' : 'Pendiente'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )

            )}
          </CardContent>
        </Card>
        )}

      </main>

    </div>
  );
}
