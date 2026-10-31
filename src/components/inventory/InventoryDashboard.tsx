'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { getStockAlerts } from '@/app/actions/inventory';
import { Product, UserRole } from '@/types';
import {
  Boxes, DollarSign, RefreshCw, CheckCircle2, AlertTriangle, PackageOpen,
  Search, Filter, Plus, Layers, Activity, Droplet, Calculator, Archive,
  PackageX, ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type Urgency = 'OUT' | 'CRITICAL' | 'LOW';

interface EnrichedAlertProduct extends Product {
  stock: number;
  minAlert: number;
  suggestedQty: number;
  estimatedCostArs: number;
  urgency: Urgency;
}

/** Atajos a los sub-módulos del inventario (misma estructura del Sidebar). */
const INVENTORY_MODULES = [
  { href: '/productos', label: 'Catálogo de Productos', description: 'Botellas selladas, precios y márgenes', icon: Boxes, color: 'text-violet-400' },
  { href: '/admin/inventario/decants', label: 'Hub Decants & Granel', description: 'Fraccionamiento JIT y líquidos a granel', icon: Droplet, color: 'text-cyan-400' },
  { href: '/admin/inventario/kardex', label: 'Kardex & Movimientos', description: 'Trazabilidad de entradas y salidas (PPP)', icon: Activity, color: 'text-emerald-400' },
  { href: '/admin/inventario/recetas', label: 'Recetas Decants (BOM)', description: 'Ingeniería de costos por presentación', icon: Calculator, color: 'text-erp-gold' },
  { href: '/admin/inventario/insumos', label: 'Insumos de Packaging', description: 'Frascos, atomizadores, cajas y bolsas', icon: Archive, color: 'text-amber-400' },
  { href: '/admin/inventario/ajustes', label: 'Ajustes / Mermas', description: 'Bajas, roturas, testers y arqueo físico', icon: PackageX, color: 'text-rose-400' },
] as const;

const formatArs = (amount: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);

const URGENCY_META: Record<Urgency, { label: string; text: string; bg: string; dot: string }> = {
  OUT: { label: 'AGOTADO', text: 'text-rose-400', bg: 'bg-rose-950/50 border border-rose-800/50', dot: 'bg-rose-500' },
  CRITICAL: { label: 'CRÍTICO', text: 'text-amber-300', bg: 'bg-amber-950/50 border border-amber-800/50', dot: 'bg-amber-400' },
  LOW: { label: 'STOCK BAJO', text: 'text-yellow-300', bg: 'bg-yellow-950/40 border border-yellow-800/40', dot: 'bg-yellow-400' },
};

export function InventoryDashboard({ role: propRole }: { role?: UserRole }) {
  const storeRole = useUserStore((state) => state.role);
  const role = propRole || storeRole;

  const [alerts, setAlerts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterUrgency, setFilterUrgency] = useState<'ALL' | Urgency>('ALL');

  const fetchInventoryData = async () => {
    setLoading(true);
    const res = await getStockAlerts(role);
    if (res.success && res.data) {
      setAlerts(res.data);
    } else {
      setAlerts([]);
      toast.error(res.error || 'Error al obtener alertas de stock.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInventoryData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  /** Enriquece cada producto con nivel de urgencia y sugerencia de reorden. */
  const enrichedAlerts = useMemo<EnrichedAlertProduct[]>(() => {
    return alerts.map((p) => {
      const stock = Number(p.stock_quantity || 0);
      const minAlert = Number(p.min_stock_alert ?? 5);
      const targetStock = Math.max(minAlert * 2, 10);
      const suggestedQty = Math.max(1, targetStock - stock);

      let urgency: Urgency = 'LOW';
      if (stock <= 0) urgency = 'OUT';
      else if (stock <= Math.ceil(minAlert / 2)) urgency = 'CRITICAL';

      return {
        ...p,
        stock,
        minAlert,
        suggestedQty,
        estimatedCostArs: suggestedQty * Number(p.base_cost_ars || 0),
        urgency,
      };
    });
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    return enrichedAlerts.filter((p) => {
      if (filterType !== 'ALL' && p.type !== filterType) return false;
      if (filterUrgency !== 'ALL' && p.urgency !== filterUrgency) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const match =
          p.name?.toLowerCase().includes(term) ||
          (p.brand || '').toLowerCase().includes(term) ||
          (p.sku || '').toLowerCase().includes(term);
        if (!match) return false;
      }
      return true;
    });
  }, [enrichedAlerts, filterType, filterUrgency, searchTerm]);

  const summary = useMemo(() => {
    const outCount = enrichedAlerts.filter((p) => p.urgency === 'OUT').length;
    const criticalCount = enrichedAlerts.filter((p) => p.urgency === 'CRITICAL').length;
    const totalInvestment = enrichedAlerts.reduce((sum, p) => sum + p.estimatedCostArs, 0);
    return { total: enrichedAlerts.length, outCount, criticalCount, totalInvestment };
  }, [enrichedAlerts]);

  return (
    <div className="space-y-6">

      {/* KPIS DE URGENCIA */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-erp-surface/60 border border-erp-border space-y-1">
          <span className="text-[11px] text-zinc-400 uppercase font-semibold flex items-center gap-1.5">
            <Layers className="h-3 w-3" /> Ítems en Alerta
          </span>
          <div className="text-2xl font-bold text-white font-mono">{summary.total}</div>
          <span className="text-[11px] text-zinc-400">Por debajo del umbral mínimo</span>
        </div>

        <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-800/30 space-y-1">
          <span className="text-[11px] text-rose-400 uppercase font-semibold flex items-center gap-1.5">
            <PackageOpen className="h-3 w-3" /> Agotados (Stock 0)
          </span>
          <div className="text-2xl font-bold text-rose-400 font-mono">{summary.outCount}</div>
          <span className="text-[11px] text-rose-400/70">Quiebre total — prioridad máxima</span>
        </div>

        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/30 space-y-1">
          <span className="text-[11px] text-amber-400 uppercase font-semibold flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3" /> Críticos (&le; 50% del mínimo)
          </span>
          <div className="text-2xl font-bold text-amber-400 font-mono">{summary.criticalCount}</div>
          <span className="text-[11px] text-amber-400/70">Riesgo de quiebre inminente</span>
        </div>

        <div className="p-4 rounded-xl bg-erp-surface/60 border border-erp-border space-y-1">
          <span className="text-[11px] text-erp-gold uppercase font-semibold flex items-center gap-1.5">
            <DollarSign className="h-3 w-3" /> Inversión de Reposición
          </span>
          <div className="text-2xl font-bold text-erp-gold font-mono">{formatArs(summary.totalInvestment)}</div>
          <span className="text-[11px] text-zinc-400">Estimada para cubrir el déficit</span>
        </div>
      </div>

      {/* FILTROS Y BÚSQUEDA */}
      <div className="p-4 rounded-2xl bg-erp-surface/60 border border-erp-border flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, marca o SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-erp-bg border border-erp-border rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-erp-gold transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="h-4 w-4 text-zinc-400 shrink-0" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="flex-1 md:w-44 bg-erp-bg border border-erp-border rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-erp-gold cursor-pointer"
          >
            <option value="ALL">📦 Todas las Categorías</option>
            <option value="bottle">🌸 Perfumes Sellados</option>
            <option value="decant_liquid">💧 Decants Granel (ml)</option>
            <option value="supply">📦 Insumos Packaging</option>
          </select>

          <select
            value={filterUrgency}
            onChange={(e) => setFilterUrgency(e.target.value as 'ALL' | Urgency)}
            className="flex-1 md:w-44 bg-erp-bg border border-erp-border rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-erp-gold cursor-pointer"
          >
            <option value="ALL">🚨 Todas las Urgencias</option>
            <option value="OUT">🔴 Agotados</option>
            <option value="CRITICAL">🟠 Críticos</option>
            <option value="LOW">🟡 Stock Bajo</option>
          </select>

          <Button
            onClick={fetchInventoryData}
            variant="outline"
            disabled={loading}
            className="bg-erp-bg border-erp-border text-zinc-300 hover:text-white text-xs h-9 shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-erp-gold' : ''}`} />
            <span className="hidden sm:inline ml-1.5">Actualizar</span>
          </Button>
        </div>
      </div>

      {/* TABLA DE ALERTAS */}
      <div className="rounded-2xl border border-erp-border bg-erp-surface/80 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-erp-border bg-erp-table text-zinc-400 text-[11px] uppercase tracking-wider font-semibold">
                <th className="py-3.5 px-4">Estado</th>
                <th className="py-3.5 px-4">Producto & SKU</th>
                <th className="py-3.5 px-4 text-center">Stock Actual</th>
                <th className="py-3.5 px-4 text-center">Mínimo</th>
                <th className="py-3.5 px-4 text-center">Sugerido</th>
                <th className="py-3.5 px-4 text-right">Costo Estimado</th>
                <th className="py-3.5 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-erp-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-zinc-400">
                    <RefreshCw className="h-6 w-6 animate-spin text-erp-gold mx-auto mb-2" />
                    <span className="text-xs">Analizando niveles de stock...</span>
                  </td>
                </tr>
              ) : filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-zinc-400">
                    <ShieldCheck className="h-10 w-10 text-emerald-500/50 mx-auto mb-2" />
                    <p className="font-bold text-zinc-200 text-sm">Inventario Saludable</p>
                    <p className="text-xs text-zinc-400">Sin ítems por debajo del umbral con los filtros actuales.</p>
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((p) => {
                  const meta = URGENCY_META[p.urgency];
                  const unitLabel = p.type === 'decant_liquid' ? 'ml' : 'uds';
                  return (
                    <tr key={p.id} className="hover:bg-secondary/40 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold ${meta.bg} ${meta.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${p.urgency === 'OUT' ? 'animate-pulse' : ''}`} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-white truncate max-w-[220px]">{p.name}</div>
                        <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-2">
                          {p.brand && <span>{p.brand}</span>}
                          {p.sku && <code className="font-mono bg-erp-bg px-1.5 py-0.5 rounded border border-erp-border text-zinc-300">{p.sku}</code>}
                        </div>
                      </td>
                      <td className={`py-3 px-4 text-center font-mono font-bold ${p.stock <= 0 ? 'text-rose-400' : 'text-amber-400'}`}>
                        {p.stock} {unitLabel}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-zinc-400">
                        {p.minAlert} {unitLabel}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-emerald-400">
                        +{p.suggestedQty} {unitLabel}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-erp-gold font-bold">
                        {formatArs(p.estimatedCostArs)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Link href={`/compras?productId=${p.id}`}>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold h-8 px-3 rounded-lg shadow-sm cursor-pointer"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Reordenar
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-erp-border bg-erp-table text-xs text-zinc-400 flex items-center justify-between">
          <span>Mostrando {filteredAlerts.length} de {summary.total} ítems en alerta</span>
          <Link href="/compras" className="text-erp-gold hover:underline font-semibold">
            Ir a Compras →
          </Link>
        </div>
      </div>

      {/* ACCESOS A SUB-MÓDULOS DEL INVENTARIO */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 mb-3">Módulos de Inventario</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {INVENTORY_MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.href}
                href={mod.href}
                className="group p-4 rounded-xl bg-erp-surface/60 border border-erp-border hover:border-erp-gold/40 transition-colors flex items-start gap-3"
              >
                <div className={`p-2 rounded-lg bg-erp-bg border border-erp-border ${mod.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white group-hover:text-erp-gold transition-colors truncate">{mod.label}</div>
                  <div className="text-[11px] text-zinc-400 truncate">{mod.description}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

    </div>
  );
}
