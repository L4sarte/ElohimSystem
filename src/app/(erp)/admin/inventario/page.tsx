'use client';

import React from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import { InventoryDashboard } from '@/components/inventory/InventoryDashboard';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

/**
 * Overview central de Inventario: KPIs de urgencia, tabla de alertas con
 * filtros y accesos directos a los sub-módulos (decants, kardex, recetas,
 * insumos, ajustes). Complementa —no duplica— el Hub de Decants.
 */
export default function InventarioOverviewPage() {
  const role = useUserStore((state) => state.role);
  const { refresh: refreshRate } = useExchangeRate();

  if (role !== 'admin') {
    return (
      <div className="min-h-screen bg-erp-bg flex flex-col items-center justify-center text-center p-4">
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 max-w-md space-y-4 shadow-xl">
          <ShieldAlert className="h-12 w-12 mx-auto text-rose-500" />
          <h2 className="text-xl font-bold font-serif">Acceso Restringido</h2>
          <p className="text-xs text-zinc-400">
            El Overview de Inventario es exclusivo para usuarios con rol Administrador.
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
    <div className="flex flex-col min-h-screen bg-erp-bg text-zinc-50 font-sans">

      {/* NAVBAR */}
      <header className="sticky top-0 z-40 w-full border-b border-erp-border bg-erp-bg/95">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 max-w-7xl">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              <span aria-hidden>←</span>
              <span>Dashboard</span>
            </Link>
            <span className="text-zinc-800">|</span>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-erp-gold/10 border border-erp-gold/30 text-erp-gold">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>
              <div>
                <span className="text-sm font-bold tracking-tight text-white uppercase">
                  Overview de Inventario
                </span>
                <span className="hidden sm:inline-block ml-2 text-[11px] font-mono text-erp-gold bg-erp-gold/10 px-2 py-0.5 rounded-full border border-erp-gold/30">
                  Radar de Stock
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <RoleSelector />
            <ExchangeRateWidget role={role} onRateChange={refreshRate} />
          </div>
        </div>
      </header>

      {/* CUERPO PRINCIPAL */}
      <main className="flex-1 container mx-auto px-4 py-8 sm:px-6 max-w-7xl space-y-6">

        {/* ENCABEZADO */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-erp-border pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-serif">
              Estado Consolidado del Inventario
            </h1>
            <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
              Radar unificado de existencias: ítems agotados, críticos y con necesidad de reposición,
              con la inversión estimada para restablecer niveles de seguridad.
            </p>
          </div>
        </div>

        <InventoryDashboard role={role} />

        <Card className="border border-erp-border/60 bg-erp-surface/40 rounded-2xl">
          <CardHeader className="p-4">
            <CardTitle className="text-xs font-bold text-zinc-300">¿Cómo se calcula la urgencia?</CardTitle>
            <CardDescription className="text-[11px] text-zinc-400 leading-relaxed">
              <span className="text-rose-400 font-bold">AGOTADO</span> = stock en 0.{' '}
              <span className="text-amber-300 font-bold">CRÍTICO</span> = stock igual o menor al 50% del umbral mínimo
              configurado por producto.{' '}
              <span className="text-yellow-300 font-bold">STOCK BAJO</span> = igual o menor al umbral mínimo. La
              sugerencia de reorden apunta a duplicar el stock mínimo (mínimo 10 unidades) para recuperar margen de seguridad.
            </CardDescription>
          </CardHeader>
        </Card>

      </main>
    </div>
  );
}
