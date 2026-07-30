'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { getStockAlerts } from '@/app/actions/inventory';
import { Product } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, RefreshCw, ShoppingBag, Droplet, ArrowRight, ShieldCheck, Sparkles 
} from 'lucide-react';
import Link from 'next/link';

export function StockAlertWidget() {
  const { role } = useUserStore();
  const [alertProducts, setAlertProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = async () => {
    setLoading(true);
    setError(null);
    const res = await getStockAlerts(role);
    if (res.success && res.data) {
      setAlertProducts(res.data);
    } else {
      setError(res.error || 'Error al verificar alertas de inventario');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (role === 'admin') {
      fetchAlerts();
    }
  }, [role]);

  if (role !== 'admin') return null;

  return (
    <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl overflow-hidden">
      
      <CardHeader className="border-b border-[#1B362A] pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <AlertTriangle className="h-4.5 w-4.5" />
              {alertProducts.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                </span>
              )}
            </div>
            <div>
              <CardTitle className="text-base font-bold text-white font-serif flex items-center gap-2">
                Radar de Re-Stock & Alertas de Inventario
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400">
                Productos con stock igual o inferior a su umbral de alerta configurado.
              </CardDescription>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={fetchAlerts}
            className="text-zinc-400 hover:text-white cursor-pointer"
            title="Actualizar radar"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-xs text-zinc-400 gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-amber-400" />
            Analizando existencias de stock...
          </div>
        ) : error ? (
          <div className="text-xs text-rose-400 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
            {error}
          </div>
        ) : alertProducts.length === 0 ? (
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
            <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <div className="font-bold text-emerald-300">Inventario Saludable</div>
              <div className="text-[11px] opacity-80">Todos los perfumes y decants cuentan con niveles de stock óptimos.</div>
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {alertProducts.map(p => {
              const isDecant = p.type === 'decant_liquid';
              const minLimit = p.min_stock_alert !== undefined ? p.min_stock_alert : 5;

              return (
                <div 
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#08130E] border border-amber-900/30 hover:border-amber-500/40 transition-colors"
                >
                  <div className="space-y-0.5 max-w-[60%]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-white truncate font-serif">{p.name}</span>
                      {isDecant ? (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Decant
                        </span>
                      ) : (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-[#D0A96B]/10 text-[#E5C158] border border-[#D0A96B]/30">
                          Botella
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      {p.brand} • <code className="text-zinc-500">{p.sku}</code>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right font-mono">
                      <div className="text-xs font-black text-amber-400">
                        {p.stock_quantity} {isDecant ? 'ml' : 'uds'}
                      </div>
                      <div className="text-[9px] text-zinc-500">
                        Min: {minLimit} {isDecant ? 'ml' : 'uds'}
                      </div>
                    </div>

                    <Link href="/admin/inventario/ajustes">
                      <Button
                        size="icon-sm"
                        variant="outline"
                        className="border-amber-900/40 bg-amber-950/20 text-amber-400 hover:bg-amber-900/40 cursor-pointer h-7 w-7"
                        title="Registrar Re-Stock o Ajuste"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

    </Card>
  );
}
