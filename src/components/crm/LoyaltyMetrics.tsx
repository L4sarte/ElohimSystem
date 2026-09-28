'use client';

import React, { useEffect, useState } from 'react';
import { UserRole } from '@/types';
import { getLoyaltyMetrics, LoyaltyMetrics as LoyaltyMetricsData } from '@/app/actions/retailMetrics';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, Users, Repeat, TrendingUp, AlertCircle } from 'lucide-react';

interface LoyaltyMetricsProps {
  role: UserRole;
}

/**
 * Métricas de Fidelidad CRM: tasa de recompra (% de clientes con >1 compra)
 * y LTV promedio, alimentadas por la agregación SQL de totales por cliente.
 */
export function LoyaltyMetrics({ role }: LoyaltyMetricsProps) {
  const [data, setData] = useState<LoyaltyMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    if (role !== 'admin') return;
    setLoading(true);
    setError(null);
    const res = await getLoyaltyMetrics(role);
    if (res.success && res.data) {
      setData(res.data);
    } else {
      setError(res.error || 'Error al calcular las métricas de fidelidad.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  if (role !== 'admin') return null;

  const cards = [
    {
      icon: Users,
      label: 'Clientes con Compras',
      value: data ? data.clientsWithPurchases.toLocaleString('es-AR') : '-',
      sub: data ? `$${data.totalRevenueAllClientsArs.toLocaleString('es-AR')} facturado` : '',
      accent: 'text-erp-gold',
      bg: 'bg-erp-gold/10',
    },
    {
      icon: Repeat,
      label: 'Tasa de Recompra',
      value: data ? `${data.repurchaseRatePercent}%` : '-',
      sub: data ? `${data.repeatClients.toLocaleString('es-AR')} cliente(s) con >1 compra` : '',
      accent: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      icon: TrendingUp,
      label: 'LTV Promedio',
      value: data ? `$${data.avgLtvArs.toLocaleString('es-AR')}` : '-',
      sub: data ? `$${data.avgRepeatLtvArs.toLocaleString('es-AR')} en recurrentes` : '',
      accent: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-erp-gold" /> Fidelidad CRM (LTV & Recompra)
        </h3>
        <button
          type="button"
          onClick={fetchMetrics}
          className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
          title="Actualizar métricas"
          aria-label="Actualizar métricas de fidelidad"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-erp-gold' : ''}`} />
        </button>
      </div>

      {error && !loading ? (
        <Card className="border-rose-500/30 bg-rose-500/5">
          <CardContent className="p-4 flex items-center gap-2 text-xs text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="font-medium">{error}</span>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {cards.map((card) => (
            <Card key={card.label} className="border-erp-border bg-erp-surface/80">
              <CardContent className="p-4 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  <span className={`p-1 rounded-md ${card.bg}`}>
                    <card.icon className={`h-3 w-3 ${card.accent}`} />
                  </span>
                  {card.label}
                </div>
                {loading ? (
                  <div className="h-7 w-24 rounded bg-erp-bg animate-pulse" />
                ) : (
                  <>
                    <div className={`text-xl font-black font-mono ${card.accent}`}>{card.value}</div>
                    <div className="text-[11px] text-zinc-500 font-sans">{card.sub}</div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
