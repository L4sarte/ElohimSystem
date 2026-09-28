'use client';

import React, { useEffect, useState } from 'react';
import { UserRole } from '@/types';
import { getFamilyRotationAnalysis, FamilyRotationAnalysis, FamilyRotationStatus } from '@/app/actions/retailMetrics';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { RefreshCw, AlertCircle, Layers, Boxes } from 'lucide-react';

interface FamilyRotationWidgetProps {
  role: UserRole;
}

const STATUS_STYLES: Record<FamilyRotationStatus, { label: string; className: string }> = {
  alta_rotacion: {
    label: 'Alta rotación',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  },
  media: {
    label: 'Rotación media',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  },
  estancada: {
    label: 'Estancada',
    className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
  },
  sin_ventas: {
    label: 'Sin ventas (90d)',
    className: 'bg-slate-200/60 text-slate-500 dark:bg-erp-surface dark:text-zinc-400 border border-slate-300 dark:border-erp-border',
  },
};

/**
 * Rotación por Familia Olfativa: capital inmovilizado en stock vs. volumen de
 * ventas de los últimos 90 días, agrupado por familia. Identifica familias de
 * alta rotación vs. stock estancado para orientar la compra internacional B2B.
 */
export function FamilyRotationWidget({ role }: FamilyRotationWidgetProps) {
  const [data, setData] = useState<FamilyRotationAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = async () => {
    if (role !== 'admin') return;
    setLoading(true);
    setError(null);
    const res = await getFamilyRotationAnalysis(role);
    if (res.success && res.data) {
      setData(res.data);
    } else {
      setError(res.error || 'Error al calcular la rotación por familia.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  return (
    <Card className="border-slate-200 dark:border-erp-border">
      <CardHeader className="pb-2 border-b border-slate-100 dark:border-zinc-900">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="h-4.5 w-4.5 text-erp-gold" />
            Rotación por Familia Olfativa
          </CardTitle>
          <button
            type="button"
            onClick={fetchAnalysis}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg cursor-pointer"
            title="Recalcular rotación"
            aria-label="Recalcular rotación por familia"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-erp-gold' : ''}`} />
          </button>
        </div>
        <CardDescription className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
          Capital inmovilizado vs. ventas de los últimos {data?.periodDays ?? 90} días. Índice = ingresos / capital (1 = el stock rotó completo).
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4 space-y-3">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-slate-100 dark:bg-erp-surface animate-pulse" />
            ))}
          </div>
        ) : error || !data ? (
          <div className="flex flex-col items-center justify-center py-10 text-rose-500 gap-2">
            <AlertCircle className="h-8 w-8 text-rose-600" />
            <p className="text-xs font-semibold">{error || 'No se pudieron calcular las métricas.'}</p>
          </div>
        ) : data.rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400 dark:text-zinc-500 space-y-2">
            <Boxes className="h-8 w-8 opacity-40" />
            <p className="text-xs">Sin stock activo para analizar rotación.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400 font-semibold">
                {data.rows.length} familia(s) con stock activo
              </span>
              <span className="font-mono font-bold text-erp-gold">
                Capital total: ${data.totalImmobilizedArs.toLocaleString('es-AR')}
              </span>
            </div>

            {/* TABLA DE FAMILIAS ORDENADA POR ROTACIÓN */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-erp-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-erp-border bg-slate-50 dark:bg-erp-table text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">
                    <th scope="col" className="text-left px-3 py-2">Familia</th>
                    <th scope="col" className="text-right px-3 py-2">Capital Stock</th>
                    <th scope="col" className="text-right px-3 py-2">Ventas 90d</th>
                    <th scope="col" className="text-right px-3 py-2">Índice</th>
                    <th scope="col" className="text-right px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => {
                    const status = STATUS_STYLES[row.status];
                    return (
                      <tr key={row.family} className="border-b border-slate-100 dark:border-erp-border/60 last:border-b-0">
                        <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white">
                          {row.family}
                          <span className="ml-1.5 text-[10px] font-mono text-slate-400 dark:text-zinc-500">({row.stockUnits.toLocaleString('es-AR')} u)</span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-zinc-100">
                          ${row.stockCapitalArs.toLocaleString('es-AR')}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-700 dark:text-zinc-300">
                          ${row.salesRevenueArs.toLocaleString('es-AR')}
                        </td>
                        <td className={`px-3 py-2.5 text-right font-mono font-bold ${row.rotationIndex >= 1 ? 'text-emerald-600 dark:text-emerald-400' : row.rotationIndex > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                          {row.rotationIndex === 99.999 ? '∞ (agotado)' : row.rotationIndex}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${status.className}`}>
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
