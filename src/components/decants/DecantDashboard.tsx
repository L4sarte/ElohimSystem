'use client';

import React, { useMemo } from 'react';
import { Product } from '@/types';
import { Droplet, AlertTriangle, PackageOpen, TrendingUp, Layers } from 'lucide-react';
import Link from 'next/link';

/**
 * Radar de salud del stock de decants a granel.
 *
 * KPIs derivados del catálogo de productos (type = 'decant_liquid'):
 *  - Fragancias activas y ml totales en granel
 *  - Graneles agotados (stock 0) y críticos (<= 15 ml, umbral operativo del hub)
 *  - Margen potencial del granel (venta - costo inmovilizado)
 *
 * Complementa (no duplica) el Monitor de Granel del Hub de Decants:
 * aquí se resume la SALUD del conjunto; allí se detalla cada fragancia.
 */

const CRITICAL_ML_THRESHOLD = 15;

export interface DecantHealthStats {
  totalDecants: number;
  totalMl: number;
  emptyDecants: number;
  criticalDecants: number;
  immobilizedCostArs: number;
  potentialRevenueArs: number;
}

export function computeDecantHealth(decantLiquids: Product[]): DecantHealthStats {
  const totalDecants = decantLiquids.length;
  const totalMl = decantLiquids.reduce((acc, d) => acc + Number(d.stock_quantity || 0), 0);
  const emptyDecants = decantLiquids.filter((d) => Number(d.stock_quantity || 0) <= 0).length;
  const criticalDecants = decantLiquids.filter((d) => {
    const ml = Number(d.stock_quantity || 0);
    return ml > 0 && ml <= CRITICAL_ML_THRESHOLD;
  }).length;
  const immobilizedCostArs = decantLiquids.reduce(
    (acc, d) => acc + Number(d.stock_quantity || 0) * Number(d.base_cost_ars || 0),
    0
  );
  const potentialRevenueArs = decantLiquids.reduce(
    (acc, d) => acc + Number(d.stock_quantity || 0) * Number(d.base_price_ars || 0),
    0
  );

  return {
    totalDecants,
    totalMl,
    emptyDecants,
    criticalDecants,
    immobilizedCostArs,
    potentialRevenueArs,
  };
}

export function DecantHealthStrip({ decantLiquids }: { decantLiquids: Product[] }) {
  const stats = useMemo(() => computeDecantHealth(decantLiquids), [decantLiquids]);

  const potentialMarginArs = stats.potentialRevenueArs - stats.immobilizedCostArs;
  const marginPercent = stats.potentialRevenueArs > 0
    ? (potentialMarginArs / stats.potentialRevenueArs) * 100
    : 0;

  const formatArs = (amount: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);

  const hasCritical = stats.criticalDecants > 0 || stats.emptyDecants > 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">

      <div className="p-4 rounded-xl bg-erp-surface/60 border border-erp-border space-y-1">
        <span className="text-[11px] text-zinc-400 uppercase font-semibold flex items-center gap-1.5">
          <Layers className="h-3 w-3" /> Fragancias en Granel
        </span>
        <div className="text-2xl font-bold text-white font-mono">{stats.totalDecants}</div>
        <span className="text-[11px] text-zinc-400">
          {stats.totalMl.toLocaleString('es-AR')} ml totales disponibles
        </span>
      </div>

      <div
        className={`p-4 rounded-xl space-y-1 ${
          stats.emptyDecants > 0
            ? 'bg-rose-950/20 border border-rose-800/40'
            : 'bg-erp-surface/60 border border-erp-border'
        }`}
      >
        <span className={`text-[11px] uppercase font-semibold flex items-center gap-1.5 ${stats.emptyDecants > 0 ? 'text-rose-400' : 'text-zinc-400'}`}>
          <PackageOpen className="h-3 w-3" /> Agotados
        </span>
        <div className={`text-2xl font-bold font-mono ${stats.emptyDecants > 0 ? 'text-rose-400' : 'text-white'}`}>
          {stats.emptyDecants}
        </div>
        <span className="text-[11px] text-zinc-400">
          {stats.emptyDecants > 0 ? 'Reabrir botella sellada para recargar' : 'Todos los graneles con stock'}
        </span>
      </div>

      <div
        className={`p-4 rounded-xl space-y-1 ${
          stats.criticalDecants > 0
            ? 'bg-amber-950/20 border border-amber-800/40'
            : 'bg-erp-surface/60 border border-erp-border'
        }`}
      >
        <span className={`text-[11px] uppercase font-semibold flex items-center gap-1.5 ${stats.criticalDecants > 0 ? 'text-amber-400' : 'text-zinc-400'}`}>
          <AlertTriangle className="h-3 w-3" /> Casi Agotados
        </span>
        <div className={`text-2xl font-bold font-mono ${stats.criticalDecants > 0 ? 'text-amber-400' : 'text-white'}`}>
          {stats.criticalDecants}
        </div>
        <span className="text-[11px] text-zinc-400">&le; {CRITICAL_ML_THRESHOLD} ml restantes</span>
      </div>

      <div className="p-4 rounded-xl bg-erp-surface/60 border border-erp-border space-y-1">
        <span className="text-[11px] text-zinc-400 uppercase font-semibold flex items-center gap-1.5">
          <Droplet className="h-3 w-3" /> Costo Inmovilizado
        </span>
        <div className="text-xl font-bold text-emerald-400 font-mono">{formatArs(stats.immobilizedCostArs)}</div>
        <span className="text-[11px] text-zinc-400">Capital invertido en granel</span>
      </div>

      <div
        className={`p-4 rounded-xl space-y-1 ${
          hasCritical
            ? 'bg-gradient-to-br from-erp-gold/5 to-transparent border border-erp-gold/30'
            : 'bg-erp-surface/60 border border-erp-border'
        }`}
      >
        <span className="text-[11px] text-erp-gold uppercase font-semibold flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3" /> Margen Potencial
        </span>
        <div className="text-xl font-bold text-erp-gold font-mono">{formatArs(potentialMarginArs)}</div>
        <span className="text-[11px] text-zinc-400">
          {marginPercent.toFixed(1)}% s/ venta potencial de granel
        </span>
      </div>

      {hasCritical && (
        <Link
          href="/admin/inventario/ajustes"
          className="col-span-2 lg:col-span-5 flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 hover:bg-amber-500/20 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Hay {stats.emptyDecants + stats.criticalDecants} granel(es) que requieren atención: reabrí una botella sellada
            o registrá el ajuste correspondiente.
          </span>
          <span className="font-bold shrink-0">Ir a Acciones →</span>
        </Link>
      )}
    </div>
  );
}
