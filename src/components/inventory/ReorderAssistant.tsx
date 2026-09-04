'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { getStockAlerts } from '@/app/actions/inventory';
import { Product, UserRole } from '@/types';
import { 
  AlertTriangle, ShoppingBag, Droplet, Archive, Package, 
  Search, RefreshCw, Download, ArrowRight, CheckCircle2, 
  Sparkles, DollarSign, ShieldAlert, TrendingDown, Layers, Box
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

interface ReorderAssistantProps {
  role?: UserRole;
}

export function ReorderAssistant({ role: propRole }: ReorderAssistantProps) {
  const { role: storeRole } = useUserStore();
  const role = propRole || storeRole;
  const { rate: rawExchangeRate } = useExchangeRate();
  const exchangeRate = rawExchangeRate || 1250;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterUrgency, setFilterUrgency] = useState<'ALL' | 'OUT' | 'CRITICAL' | 'LOW'>('ALL');

  const fetchAlerts = async () => {
    setLoading(true);
    const res = await getStockAlerts(role);
    if (res.success && res.data) {
      setProducts(res.data);
    } else {
      toast.error(res.error || 'Error al obtener alertas de stock.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAlerts();
  }, [role]);

  // Cálculo de Reorden Sugerido y Métricas
  const enrichedProducts = useMemo(() => {
    return products.map((p) => {
      const stock = Number(p.stock_quantity || 0);
      const minAlert = Number(p.min_stock_alert ?? 5);
      
      // Sugerencia: llevar a min_stock * 2 o al menos cubrir el déficit con buffer
      const targetStock = Math.max(minAlert * 2, 10);
      const suggestedQty = Math.max(1, targetStock - stock);
      const unitCost = Number(p.base_cost_ars || 0);
      const estimatedCostArs = suggestedQty * unitCost;

      let urgency: 'OUT' | 'CRITICAL' | 'LOW' = 'LOW';
      if (stock <= 0) {
        urgency = 'OUT';
      } else if (stock <= Math.ceil(minAlert / 2)) {
        urgency = 'CRITICAL';
      }

      return {
        ...p,
        stock,
        minAlert,
        suggestedQty,
        unitCost,
        estimatedCostArs,
        urgency,
      };
    });
  }, [products]);

  // Filtrado reactivo
  const filteredProducts = useMemo(() => {
    return enrichedProducts.filter((p) => {
      if (filterType !== 'ALL' && p.type !== filterType) {
        return false;
      }
      if (filterUrgency !== 'ALL' && p.urgency !== filterUrgency) {
        return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchName = p.name.toLowerCase().includes(term);
        const matchBrand = (p.brand || '').toLowerCase().includes(term);
        const matchSku = (p.sku || '').toLowerCase().includes(term);
        if (!matchName && !matchBrand && !matchSku) {
          return false;
        }
      }
      return true;
    });
  }, [enrichedProducts, filterType, filterUrgency, searchTerm]);

  // KPIs del asistente
  const summaryKpis = useMemo(() => {
    let outCount = 0;
    let criticalCount = 0;
    let suppliesCount = 0;
    let totalEstimatedInvestment = 0;

    enrichedProducts.forEach((p) => {
      if (p.urgency === 'OUT') outCount++;
      if (p.urgency === 'CRITICAL') criticalCount++;
      if (p.type === 'supply') suppliesCount++;
      totalEstimatedInvestment += p.estimatedCostArs;
    });

    return {
      totalAlerts: enrichedProducts.length,
      outCount,
      criticalCount,
      suppliesCount,
      totalEstimatedInvestment,
    };
  }, [enrichedProducts]);

  // Exportar lista de compras a CSV
  const handleExportReorderCsv = () => {
    if (filteredProducts.length === 0) {
      toast.error('No hay productos en lista de reorden para exportar.');
      return;
    }

    const dateStamp = new Date().toISOString().split('T')[0];
    const rows: string[][] = [
      ['ASISTENTE DE REORDEN Y COMPRAS - ELOHIM IMPORT ERP'],
      [`Fecha: ${new Date().toLocaleString('es-AR')}`],
      [`Cotización Dólar: 1 USD = $${exchangeRate.toLocaleString('es-AR')} ARS`],
      [`Total de Ítems Críticos: ${filteredProducts.length}`],
      [''],
      [
        'SKU',
        'Producto',
        'Marca',
        'Tipo',
        'Estado Urgencia',
        'Stock Actual',
        'Stock Mínimo',
        'Sugerido a Comprar',
        'Costo Unitario (ARS)',
        'Subtotal Estimado (ARS)',
        'Subtotal Estimado (USD)',
      ],
    ];

    filteredProducts.forEach((p) => {
      const urgencyLabel = p.urgency === 'OUT' ? 'AGOTADO' : p.urgency === 'CRITICAL' ? 'CRÍTICO' : 'STOCK BAJO';
      const usdSubtotal = exchangeRate > 0 ? (p.estimatedCostArs / exchangeRate).toFixed(2) : '0';
      rows.push([
        `"${(p.sku || '').replace(/"/g, '""')}"`,
        `"${(p.name || '').replace(/"/g, '""')}"`,
        `"${(p.brand || '').replace(/"/g, '""')}"`,
        `"${p.type}"`,
        `"${urgencyLabel}"`,
        String(p.stock),
        String(p.minAlert),
        String(p.suggestedQty),
        p.unitCost.toFixed(2),
        p.estimatedCostArs.toFixed(2),
        usdSubtotal,
      ]);
    });

    const csvContent = '\uFEFF' + rows.map((r) => r.join(';')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Sugerido_Reorden_Elohim_${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Lista de compras sugeridas descargada en CSV.');
  };

  return (
    <div className="space-y-6">
      
      {/* CABECERA DEL ASISTENTE */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#13261E]/80 border border-[#1B362A] p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#D0A96B] uppercase tracking-wider mb-1">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Planificación Inteligente de Compras & Abastecimiento</span>
          </div>
          <h2 className="text-xl font-bold font-serif text-white tracking-tight">
            Asistente de Reorden de Inventario
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
            Detecta automáticamente productos agotados o por debajo del umbral mínimo de seguridad. 
            Permite proyectar la inversión de reposición y emitir órdenes de compra con un solo clic.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={fetchAlerts}
            variant="outline"
            disabled={loading}
            className="bg-[#08130E] border-[#1B362A] text-zinc-300 hover:text-white text-xs h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>

          <Button
            onClick={handleExportReorderCsv}
            variant="outline"
            className="bg-[#08130E] border-[#1B362A] text-zinc-300 hover:text-white text-xs h-9"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Exportar CSV
          </Button>

          <Link href="/compras">
            <Button className="bg-[#D0A96B] hover:bg-[#c29b5c] text-[#08130E] text-xs font-bold h-9 shadow-md">
              <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />
              Ir al PO Builder en Compras
            </Button>
          </Link>
        </div>
      </div>

      {/* KPIS DE URGENCIA Y REPOSICIÓN */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-[#13261E]/60 border border-[#1B362A] space-y-1">
          <span className="text-[10px] text-zinc-400 uppercase font-semibold">Total Ítems en Alerta</span>
          <div className="text-2xl font-bold text-white font-mono">{summaryKpis.totalAlerts}</div>
          <span className="text-[10px] text-zinc-500">Por debajo del stock mínimo</span>
        </div>

        <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-800/30 space-y-1">
          <span className="text-[10px] text-rose-400 uppercase font-semibold flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Agotados (Stock 0)
          </span>
          <div className="text-2xl font-bold text-rose-400 font-mono">{summaryKpis.outCount}</div>
          <span className="text-[10px] text-rose-400/70">Quiebre total de stock</span>
        </div>

        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/30 space-y-1">
          <span className="text-[10px] text-amber-400 uppercase font-semibold flex items-center gap-1">
            <Archive className="h-3 w-3" /> Insumos Packaging
          </span>
          <div className="text-2xl font-bold text-amber-300 font-mono">{summaryKpis.suppliesCount}</div>
          <span className="text-[10px] text-amber-400/70">Frascos y atomizadores críticos</span>
        </div>

        <div className="p-4 rounded-xl bg-[#13261E]/60 border border-[#1B362A] space-y-1">
          <span className="text-[10px] text-[#D0A96B] uppercase font-semibold">Inversión Estimada Reposición</span>
          <div className="text-2xl font-bold text-[#D0A96B] font-mono">
            ${summaryKpis.totalEstimatedInvestment.toLocaleString('es-AR')}
          </div>
          <span className="text-[10px] text-zinc-500">
            ≈ USD ${(exchangeRate > 0 ? (summaryKpis.totalEstimatedInvestment / exchangeRate).toFixed(0) : '0')}
          </span>
        </div>
      </div>

      {/* FILTROS Y BÚSQUEDA */}
      <div className="p-4 rounded-2xl bg-[#13261E]/60 border border-[#1B362A] space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar producto por nombre, diseñador o código SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#08130E] border border-[#1B362A] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D0A96B] transition-colors"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="w-full md:w-52">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full bg-[#08130E] border border-[#1B362A] rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-[#D0A96B] cursor-pointer"
            >
              <option value="ALL">📦 Todas las Categorías</option>
              <option value="bottle">🌸 Perfumes Sellados</option>
              <option value="decant_liquid">💧 Decants Granel (ml)</option>
              <option value="supply">📦 Insumos Packaging</option>
            </select>
          </div>

          <div className="w-full md:w-48">
            <select
              value={filterUrgency}
              onChange={(e) => setFilterUrgency(e.target.value as any)}
              className="w-full bg-[#08130E] border border-[#1B362A] rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-[#D0A96B] cursor-pointer"
            >
              <option value="ALL">🚨 Todas las Urgencias</option>
              <option value="OUT">🔴 Agotados (Stock 0)</option>
              <option value="CRITICAL">🟠 Críticos (&le; 50% alerta)</option>
              <option value="LOW">🟡 Reposición Requerida</option>
            </select>
          </div>

        </div>
      </div>

      {/* TABLA DE PRODUCTOS PARA REORDEN */}
      <div className="rounded-2xl border border-[#1B362A] bg-[#13261E]/80 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1B362A] bg-[#0A1812] text-zinc-400 text-[11px] uppercase tracking-wider font-semibold">
                <th className="py-3.5 px-4">Estado Urgencia</th>
                <th className="py-3.5 px-4">Producto & SKU</th>
                <th className="py-3.5 px-4 text-center">Stock Actual</th>
                <th className="py-3.5 px-4 text-center">Stock Mínimo</th>
                <th className="py-3.5 px-4 text-center">Reorden Sugerido</th>
                <th className="py-3.5 px-4 text-right">Costo Unitario</th>
                <th className="py-3.5 px-4 text-right">Inversión Estimada</th>
                <th className="py-3.5 px-4 text-right">Acción Rápida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1B362A]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-zinc-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="h-6 w-6 animate-spin text-[#D0A96B]" />
                      <span className="text-xs">Analizando catálogo de inventario y alertas...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-zinc-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <CheckCircle2 className="h-10 w-10 text-emerald-500/60" />
                      <p className="font-bold text-zinc-200 text-sm">¡Inventario Saludable!</p>
                      <p className="text-xs text-zinc-500 max-w-sm">
                        No hay productos en niveles críticos de stock que coincidan con los filtros seleccionados.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const unitLabel = p.type === 'decant_liquid' ? 'ml' : 'uds';
                  return (
                    <tr key={p.id} className="hover:bg-[#1B362A]/40 transition-colors group">
                      
                      {/* Estado Urgencia */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {p.urgency === 'OUT' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-950/60 text-rose-400 border border-rose-800/50">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                            AGOTADO
                          </span>
                        ) : p.urgency === 'CRITICAL' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-800/50">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                            CRÍTICO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-yellow-950/40 text-yellow-300 border border-yellow-800/40">
                            <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                            STOCK BAJO
                          </span>
                        )}
                      </td>

                      {/* Producto & SKU */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white group-hover:text-[#D0A96B] transition-colors">
                          {p.name}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                          {p.brand && <span>{p.brand}</span>}
                          {p.sku && (
                            <span className="font-mono bg-[#08130E] px-1.5 py-0.2 rounded border border-[#1B362A] text-zinc-300">
                              {p.sku}
                            </span>
                          )}
                          <span className="text-zinc-500">•</span>
                          <span className="text-zinc-400">
                            {p.type === 'bottle' ? 'Perfume Sellado' : p.type === 'decant_liquid' ? 'Granel Decant' : 'Insumo Packaging'}
                          </span>
                        </div>
                      </td>

                      {/* Stock Actual */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap font-mono font-bold">
                        <span className={p.stock <= 0 ? 'text-rose-400' : 'text-amber-400'}>
                          {p.stock} {unitLabel}
                        </span>
                      </td>

                      {/* Stock Mínimo */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap font-mono text-zinc-400">
                        {p.minAlert} {unitLabel}
                      </td>

                      {/* Reorden Sugerido */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap font-mono font-bold text-emerald-400">
                        +{p.suggestedQty} {unitLabel}
                      </td>

                      {/* Costo Unitario */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono text-zinc-300">
                        ${p.unitCost.toLocaleString('es-AR')}
                      </td>

                      {/* Inversión Estimada */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono font-bold text-[#D0A96B]">
                        ${p.estimatedCostArs.toLocaleString('es-AR')}
                      </td>

                      {/* Acción Rápida */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {p.type === 'decant_liquid' ? (
                          <Link href="/admin/inventario/decants">
                            <Button 
                              size="sm"
                              className="bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold h-8 px-3 rounded-lg shadow-sm"
                            >
                              <Droplet className="h-3 w-3 mr-1" />
                              Fraccionar Botella
                            </Button>
                          </Link>
                        ) : (
                          <Link href={`/compras?productId=${p.id}`}>
                            <Button 
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold h-8 px-3 rounded-lg shadow-sm"
                            >
                              <ShoppingBag className="h-3 w-3 mr-1" />
                              Crear Orden B2B
                            </Button>
                          </Link>
                        )}
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PIE DE TABLA */}
        <div className="p-4 border-t border-[#1B362A] bg-[#0A1812] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-500">
          <span>Mostrando {filteredProducts.length} productos con necesidad de reposición</span>
          <span className="font-mono text-[11px]">Asistente de Reorden Automatizado • Elohim Import</span>
        </div>
      </div>

    </div>
  );
}
