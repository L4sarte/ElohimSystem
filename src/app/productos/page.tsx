'use client';

import React from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import { ProductList } from '@/components/products/ProductList';
import { BundleManager } from '@/components/products/BundleManager';
import { InventoryValuationWidget } from '@/components/inventory/InventoryValuationWidget';
import Link from 'next/link';
import { ArrowLeft, Package, RefreshCw, Layers } from 'lucide-react';

export default function ProductosPage() {
  const { role } = useUserStore();
  const { rate, loading: loadingRate, error: rateError } = useExchangeRate();
  const [activeTab, setActiveTab] = React.useState<'perfumes' | 'combos' | 'insumos'>('perfumes');

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 dark:bg-[#08130E] dark:text-zinc-50 transition-colors duration-300">
      
      {/* NAVBAR SUPERIOR */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-[#1B362A] dark:bg-[#08130E]/80">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
              <span>Volver</span>
            </Link>
            <span className="text-slate-300 dark:text-zinc-800">|</span>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-md shadow-violet-500/10">
                <Package className="h-4.5 w-4.5 text-white" />
              </div>
              <span className="text-sm font-bold tracking-tight text-slate-800 dark:text-zinc-100">
                Catálogo de Productos
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Selector de Rol para la simulación */}
            <RoleSelector />

            {/* Dólar Blue cambiario consolidado */}
            <ExchangeRateWidget role={role} />
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 container mx-auto px-4 py-8 sm:px-6 max-w-6xl">
        
        {/* Cabecera del Panel */}
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-serif">
              Gestión de Catálogo e Inventario
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
              Administración de Perfumes Sellados, Stock Líquido de Decants e Insumos de Packaging.
            </p>
          </div>

          {/* Estado de Seguridad / Vista */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="text-xs text-slate-400 dark:text-zinc-500">Vista activa:</span>
            {role === 'admin' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800 dark:bg-[#D0A96B]/10 dark:text-[#D0A96B]">
                Administración Total
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-400">
                Consulta / Ventas
              </span>
            )}
          </div>
        </div>

        {/* WIDGET DE VALORACIÓN FINANCIERA Y MÉTRICAS DE STOCK DE INVENTARIO */}
        <InventoryValuationWidget />

        {/* NAVEGACIÓN POR PESTAÑAS (TABS) */}
        <div className="flex items-center justify-between border-b border-[#1B362A] pb-4 mb-6">
          <div className="flex flex-wrap items-center gap-2 bg-[#13261E] p-1 rounded-xl border border-[#1B362A]">
            <button
              onClick={() => setActiveTab('perfumes')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'perfumes'
                  ? 'bg-[#D0A96B] text-[#08130E] text-white shadow-md shadow-violet-600/20'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              🌸 Perfumes y Decants
            </button>
            <button
              onClick={() => setActiveTab('combos')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'combos'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              🎁 Combos Promocionales
            </button>
            <button
              onClick={() => setActiveTab('insumos')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'insumos'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              📦 Insumos de Packaging
            </button>
          </div>

          {activeTab === 'insumos' && (
            <Link
              href="/admin/inventario/insumos"
              className="text-xs text-amber-400 font-bold hover:underline"
            >
              Ver Panel Dedicado Insumos →
            </Link>
          )}
        </div>

        {/* CONTENIDO SEGÚN LA PESTAÑA SELECCIONADA */}
        {activeTab === 'perfumes' ? (
          <ProductList role={role} excludeSupplies={true} />
        ) : activeTab === 'combos' ? (
          <BundleManager />
        ) : (
          <div className="space-y-4">
            <div className="p-6 rounded-2xl bg-[#13261E]/90 border border-[#1B362A] text-center space-y-3">
              <h2 className="text-lg font-bold text-white font-serif">Insumos y Envases de Fraccionamiento (JIT)</h2>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Los insumos (frascos vacíos de 5ml, 10ml, atomizadores) están aislados del catálogo comercial para evitar ventas accidentales al público. Se consumen automáticamente al fraccionar un decant.
              </p>
              <Link href="/admin/inventario/insumos">
                <button className="mt-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded-xl text-xs font-bold cursor-pointer shadow-md shadow-amber-600/20">
                  Abrir Panel Dedicado de Insumos & Packaging
                </button>
              </Link>
            </div>
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200/80 bg-white dark:border-[#1B362A] dark:bg-[#08130E] py-6 mt-12">
        <div className="container mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-zinc-500">
          <p>© 2026 Elohim Import ERP. Todos los derechos reservados.</p>
          <div className="flex gap-4">
            <span className="hover:text-slate-800 dark:hover:text-zinc-300">Security by Design (RLS)</span>
            <span>•</span>
            <span className="hover:text-slate-800 dark:hover:text-zinc-300">Precios Fijos en ARS</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
