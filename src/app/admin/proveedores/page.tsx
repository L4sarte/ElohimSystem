'use client';

import React from 'react';
import Link from 'next/link';
import { useUserStore } from '@/hooks/use-user-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ArrowLeft, ShoppingBag, Truck, Construction, ShieldAlert, Sparkles } from 'lucide-react';

export default function ProveedoresPage() {
  const { role } = useUserStore();
  const { refresh: refreshRate } = useExchangeRate();

  if (role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#08130E] flex flex-col items-center justify-center text-center p-4">
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 max-w-md space-y-3">
          <ShieldAlert className="h-10 w-10 mx-auto" />
          <h2 className="text-lg font-bold">Acceso Restringido</h2>
          <p className="text-xs text-zinc-400">El módulo de proveedores y compras es exclusivo para administradores.</p>
          <Link href="/">
            <button className="mt-2 text-xs font-bold underline cursor-pointer">Volver al Inicio</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#08130E] text-zinc-50 transition-colors duration-300">
      
      {/* NAVBAR GLASSMORPHISM */}
      <header className="sticky top-0 z-40 w-full border-b border-[#1B362A] bg-[#08130E]/80 backdrop-blur-md">
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#13261E] border border-[#1B362A] text-sky-400">
                <ShoppingBag className="h-4.5 w-4.5" />
              </div>
              <span className="text-sm font-bold tracking-tight text-white uppercase font-serif">
                Proveedores & Compras
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <RoleSelector />
            <ExchangeRateWidget role={role} onRateChange={refreshRate} />
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 container mx-auto px-4 py-8 sm:px-6 max-w-7xl space-y-6">
        
        {/* ENCABEZADO */}
        <div className="bg-[#13261E] p-6 rounded-2xl border border-[#1B362A] shadow-xl">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#D0A96B] flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" /> Módulo de Supply Chain & Importaciones
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white font-serif mt-1">
            Gestión de Proveedores & Órdenes de Compra
          </h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl">
            Gestión de proveedores de perfumería, importadores y órdenes de compra.
          </p>
        </div>

        {/* CARD PLACEHOLDER / SCAFFOLDING */}
        <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl p-12 text-center shadow-xl space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-lg">
            <Truck className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white font-serif">Módulo de Compras & Proveedores en Construcción</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1">
              Próximamente podrás registrar proveedores bimonetarios (ARS/USD/USDT), cargar órdenes de compra y automatizar la recepción de inventario.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#08130E] border border-[#1B362A] text-[11px] font-mono text-[#D0A96B]">
            <Construction className="h-3.5 w-3.5" /> Próxima actualización v2.6
          </div>
        </Card>

      </main>

    </div>
  );
}
