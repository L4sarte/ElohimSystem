'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { getAuditLogs } from '@/app/actions/reports';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import { 
  ArrowLeft, ShieldAlert, RefreshCw, AlertCircle, ShieldCheck, 
  Clock, Package, FileText, Sparkles 
} from 'lucide-react';
import Link from 'next/link';

export default function AuditoriaPage() {
  const { role } = useUserStore();
  const { rate: exchangeRate, refresh: refreshRate } = useExchangeRate();

  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    if (role !== 'admin') return;
    setLoading(true);
    setError(null);
    const res = await getAuditLogs(role);
    if (res.success && res.data) {
      setLogs(res.data);
    } else {
      setError(res.error || 'Error al cargar logs de auditoría');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [role]);

  // Si el usuario es seller, denegar acceso inmediatamente en el frontend
  if (role !== 'admin') {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 dark:bg-[#08130E] dark:text-zinc-50 transition-colors duration-300">
        
        {/* NAVBAR MINIMALISTA */}
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

        {/* PANTALLA DENEGADO */}
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-rose-200 dark:border-rose-900/30 bg-rose-50/20 dark:bg-rose-950/5 shadow-lg">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 mb-4">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <CardTitle className="text-lg font-bold text-rose-800 dark:text-rose-400">Acceso Denegado</CardTitle>
              <CardDescription className="dark:text-rose-500/80">
                Esta sección del sistema es estrictamente de carácter administrativo y está restringida para el rol Vendedor.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center text-xs text-slate-500 dark:text-zinc-400">
              Usa el simulador de roles en la parte superior derecha para cambiar tu rol a **Admin** si deseas auditar los movimientos de stock e insumos.
            </CardContent>
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

  const renderActionBadge = (action: string) => {
    if (action === 'fractionation') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800 dark:bg-[#D0A96B]/10 dark:text-[#D0A96B]">
          <Sparkles className="h-3 w-3" /> Fraccionamiento
        </span>
      );
    }
    if (action === 'decant_assembly_jit') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-500/10 dark:text-blue-400">
          <Clock className="h-3 w-3 animate-pulse" /> Ensamble JIT
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800 dark:bg-zinc-800 dark:text-zinc-300">
        {action}
      </span>
    );
  };

  const renderDetailsSummary = (log: any) => {
    const { action, details } = log;
    if (action === 'fractionation') {
      return (
        <div className="space-y-1">
          <p className="font-semibold text-slate-800 dark:text-zinc-200">
            Apertura de botella comercial.
          </p>
          <p className="text-[11px] text-slate-500">
            Se descontó 1 botella y se sumaron **+{details.volume_ml} ml** de stock al granel (ID Decant: {details.decant_id?.split('-')[0]}).
          </p>
        </div>
      );
    }
    if (action === 'decant_assembly_jit') {
      return (
        <div className="space-y-1">
          <p className="font-semibold text-slate-800 dark:text-zinc-200">
            Envasado JIT al momento de la venta.
          </p>
          <p className="text-[11px] text-slate-500">
            Se consumieron **-{details.ml_quantity} ml** de granel y se restó **1 frasco vacío** (ID Insumo: {details.supply_id?.split('-')[0]}).
          </p>
        </div>
      );
    }
    return <span className="font-mono text-xs text-slate-400">{JSON.stringify(details)}</span>;
  };

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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-[#13261E] border border-slate-200 dark:border-[#1B362A]">
                <ShieldCheck className="h-4.5 w-4.5 text-[#D0A96B] dark:text-[#D0A96B]" />
              </div>
              <span className="text-sm font-bold tracking-tight text-slate-800 dark:text-zinc-100 uppercase">
                Visor de Auditoría RLS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <RoleSelector />
            <ExchangeRateWidget role={role} onRateChange={refreshRate} />
          </div>
        </div>
      </header>

      {/* CUERPO */}
      <main className="flex-1 container mx-auto px-4 py-8 sm:px-6 max-w-6xl">
        
        {/* Cabecera */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Registro de Auditoría de Inventario
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
              Monitoreo inmutable de transacciones físicas, aperturas de botellas y ensambles JIT en mostrador.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLogs} className="cursor-pointer">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Actualizar
          </Button>
        </div>

        {/* TABLA DE AUDITORÍA */}
        <Card className="border-slate-200 dark:border-[#1B362A]">
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-[#D0A96B]" />
                <span className="text-sm font-medium text-slate-500 dark:text-zinc-400">Cargando logs de auditoría...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 text-rose-500 gap-2">
                <AlertCircle className="h-10 w-10 text-rose-600" />
                <p className="text-sm font-semibold">{error}</p>
                <Button variant="outline" onClick={fetchLogs} className="mt-2">Reintentar</Button>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                <FileText className="h-10 w-10 text-slate-300 dark:text-zinc-700" />
                <h3 className="font-bold text-slate-900 dark:text-white">Sin movimientos</h3>
                <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-sm">No hay registros de auditoría históricos registrados aún.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#1B362A] bg-slate-50/50 dark:bg-[#13261E]/40 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    <th className="p-4 pl-6">Fecha y Hora</th>
                    <th className="p-4">Acción</th>
                    <th className="p-4">Perfume Implicado</th>
                    <th className="p-4">Descripción del Ajuste Físico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-900 text-sm">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-[#13261E]/30 transition-colors">
                      
                      {/* Fecha */}
                      <td className="p-4 pl-6 text-xs text-slate-500 font-mono">
                        {new Date(log.created_at).toLocaleString('es-AR')}
                      </td>

                      {/* Acción */}
                      <td className="p-4">
                        {renderActionBadge(log.action)}
                      </td>

                      {/* Producto */}
                      <td className="p-4">
                        {log.products ? (
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                              <Package className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              {log.products.name}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Marca: {log.products.brand} • SKU: {log.products.sku}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Producto eliminado / no disponible</span>
                        )}
                      </td>

                      {/* Ajuste */}
                      <td className="p-4">
                        {renderDetailsSummary(log)}
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

      </main>

    </div>
  );
}
