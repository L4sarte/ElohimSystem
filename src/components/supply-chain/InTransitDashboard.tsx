'use client';

import React, { useState, useEffect } from 'react';
import { useSupplyChainStore } from '@/store/supplyChainStore';
import { PurchaseOrder } from '@/types/supplyChain';
import { 
  Truck, Calendar, DollarSign, ChevronDown, ChevronUp, 
  PackageCheck, AlertCircle, RefreshCw, Box, Tag, MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { CheckInModal } from './CheckInModal';

export function InTransitDashboard() {
  const { inTransitOrders, fetchInTransitOrders, isLoading, error } = useSupplyChainStore();
  const [expandedPoId, setExpandedPoId] = useState<string | null>(null);
  const [selectedOrderForCheckIn, setSelectedOrderForCheckIn] = useState<PurchaseOrder | null>(null);

  useEffect(() => {
    fetchInTransitOrders();
  }, [fetchInTransitOrders]);

  const toggleExpand = (id: string) => {
    setExpandedPoId(prev => (prev === id ? null : id));
  };

  const totalCapitalInTransit = inTransitOrders.reduce((sum, po) => sum + Number(po.grand_total || 0), 0);

  return (
    <div className="space-y-6">
      {/* HEADER RESUMEN KANBAN / GRID */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-white dark:border-[#1B362A] dark:bg-[#13261E] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Truck className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Mercadería en Camino (In-Transit)
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Órdenes de compra enviadas por el proveedor pendientes de recepción en almacén.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Capital Total Inmovilizado
            </span>
            <span className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
              ${totalCapitalInTransit.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchInTransitOrders()}
            disabled={isLoading}
            className="cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ESTADO DE CARGA / VACÍO */}
      {isLoading && inTransitOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
          <span className="text-sm font-medium text-slate-500 dark:text-zinc-400">
            Cargando envíos en camino...
          </span>
        </div>
      ) : inTransitOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-slate-300 dark:border-[#1B362A] rounded-xl bg-slate-50/50 dark:bg-[#13261E]/30 text-center gap-3">
          <Box className="h-12 w-12 text-slate-300 dark:text-zinc-700" />
          <h3 className="font-bold text-slate-700 dark:text-zinc-300">
            Sin envíos en tránsito actualmente
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm">
            Todas las órdenes de compra han sido ingresadas a stock o no se han emitido nuevos pedidos en tránsito.
          </p>
        </div>
      ) : (
        /* GRID DE TARJETAS DE ÓRDENES EN TRÁNSITO */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {inTransitOrders.map((po) => {
            const isExpanded = expandedPoId === po.id;
            const itemsCount = po.items?.length || 0;
            const totalUnits = po.items?.reduce((sum, item) => sum + Number(item.expected_quantity), 0) || 0;

            return (
              <Card 
                key={po.id} 
                className="flex flex-col border-slate-200 dark:border-[#1B362A] bg-white dark:bg-[#13261E] transition-all hover:shadow-md"
              >
                <CardHeader className="pb-3 border-b border-slate-100 dark:border-[#1B362A]/60">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">
                      #{po.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-900/40">
                      <Truck className="h-3 w-3 animate-pulse" /> En Tránsito
                    </span>
                  </div>

                  <CardTitle className="text-base font-bold text-slate-900 dark:text-white mt-2 flex items-center gap-2">
                    {po.supplier?.name || 'Proveedor Desconocido'}
                  </CardTitle>
                </CardHeader>

                <CardContent className="pt-4 flex-1 space-y-3">
                  {/* DATOS CLAVE DE TARJETA */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 dark:bg-[#08130E]/60 p-2.5 rounded-lg border border-slate-100 dark:border-[#1B362A]">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-slate-500" /> Llegada Estimada (ETA)
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-zinc-200 mt-1 block">
                        {po.expected_arrival_date 
                          ? new Date(po.expected_arrival_date).toLocaleDateString('es-AR') 
                          : 'Por confirmar'}
                      </span>
                    </div>

                    <div className="bg-slate-50 dark:bg-[#08130E]/60 p-2.5 rounded-lg border border-slate-100 dark:border-[#1B362A]">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-emerald-500" /> Capital Inmovilizado
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1 block">
                        ${Number(po.grand_total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {po.tracking_info && (
                    <div className="text-xs text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-[#08130E]/40 p-2 rounded border border-slate-100 dark:border-[#1B362A] flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                      <span className="truncate">Tracking: {po.tracking_info}</span>
                    </div>
                  )}

                  {/* SECCIÓN DESPLEGABLE CON DESGLOSE EXACTO DE PERFUMES */}
                  <div className="pt-2 border-t border-slate-100 dark:border-[#1B362A]/60">
                    <button
                      type="button"
                      onClick={() => toggleExpand(po.id)}
                      className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-indigo-600 dark:text-zinc-300 dark:hover:text-indigo-400 transition-colors py-1 cursor-pointer"
                    >
                      <span>
                        Desglose de productos ({itemsCount} ítems / {totalUnits} uds)
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {po.items && po.items.length > 0 ? (
                          po.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between text-xs p-2 rounded bg-slate-50 dark:bg-[#08130E] border border-slate-100 dark:border-[#1B362A]"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <Tag className="h-3 w-3 text-indigo-500 shrink-0" />
                                <span className="font-medium text-slate-800 dark:text-zinc-200 truncate">
                                  {item.product?.name || 'Perfume N/A'}
                                </span>
                              </div>
                              <div className="text-right shrink-0 font-mono">
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                  {item.expected_quantity}x
                                </span>
                                <span className="text-[10px] text-slate-400 ml-1">
                                  (${Number(item.unit_cost).toLocaleString('es-AR')}/u)
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 italic block py-1">
                            Sin detalle de productos cargados.
                          </span>
                        )}

                        {po.expenses && po.expenses.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200 dark:border-[#1B362A]">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                              Gastos de importación / flete asociados:
                            </span>
                            {po.expenses.map((exp, idx) => (
                              <div key={idx} className="flex justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                                <span className="capitalize">• {exp.expense_type} ({exp.description || 'Sin desc.'})</span>
                                <span className="font-mono">${Number(exp.amount).toLocaleString('es-AR')}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="pt-3 pb-4 border-t border-slate-100 dark:border-[#1B362A]">
                  <Button
                    onClick={() => setSelectedOrderForCheckIn(po)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-2 shadow-sm cursor-pointer"
                  >
                    <PackageCheck className="h-4 w-4" /> Recibir Orden en Almacén
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* MODAL DE CHECK-IN Y VERIFICACIÓN DE FALTANTES/ROTURAS */}
      {selectedOrderForCheckIn && (
        <CheckInModal
          order={selectedOrderForCheckIn}
          isOpen={Boolean(selectedOrderForCheckIn)}
          onClose={() => setSelectedOrderForCheckIn(null)}
        />
      )}
    </div>
  );
}
