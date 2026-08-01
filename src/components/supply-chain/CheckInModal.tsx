'use client';

import React, { useState } from 'react';
import { useSupplyChainStore } from '@/store/supplyChainStore';
import { PurchaseOrder, CheckInItemPayload } from '@/types/supplyChain';
import { 
  PackageCheck, AlertTriangle, RefreshCw, X, CheckCircle, 
  DollarSign, ArrowUpRight, ShieldCheck, Box
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';

interface CheckInModalProps {
  order: PurchaseOrder;
  isOpen: boolean;
  onClose: () => void;
}

export function CheckInModal({ order, isOpen, onClose }: CheckInModalProps) {
  const { confirmCheckIn, isLoading } = useSupplyChainStore();

  // Mapear los items esperados a un estado local editable de cantidades verdaderamente recibidas
  const [receivedItems, setReceivedItems] = useState<CheckInItemPayload[]>(
    order.items?.map(item => ({
      item_id: item.id!,
      received_quantity: Number(item.expected_quantity)
    })) || []
  );

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleQuantityChange = (itemId: string, newQty: number) => {
    setReceivedItems(prev => prev.map(item => {
      if (item.item_id === itemId) {
        return { ...item, received_quantity: newQty < 0 ? 0 : newQty };
      }
      return item;
    }));
  };

  // Gastos totales de la orden
  const totalExpenses = Number(order.total_expenses || 0);

  // Total de unidades recibidas segun la edicion del modal
  const totalUnitsReceived = receivedItems.reduce((sum, item) => sum + Number(item.received_quantity), 0);

  // Gasto logístico prorrateado por unidad ingresada
  const expensePerUnit = totalUnitsReceived > 0 ? totalExpenses / totalUnitsReceived : 0;

  const handleConfirmStockIngress = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (totalUnitsReceived <= 0) {
      setErrorMsg('Debe confirmar la recepción de al menos 1 unidad para ingresar a stock.');
      return;
    }

    try {
      await confirmCheckIn(order.id, receivedItems);
      setSuccessMsg('¡Mercadería ingresada exitosamente! El stock y costo promedio fueron actualizados.');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al ejecutar el check-in de mercadería.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-xl bg-white dark:bg-[#13261E] border border-slate-200 dark:border-[#1B362A] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* CABECERA DEL MODAL */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#1B362A] bg-slate-50/50 dark:bg-[#08130E]/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <PackageCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Check-in de Recepción de Mercadería
              </h2>
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
                Orden #{order.id.slice(0, 8).toUpperCase()} - Proveedor: {order.supplier?.name}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* CUERPO DEL MODAL */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 dark:bg-rose-950/30 dark:border-rose-900/40 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2 dark:bg-emerald-950/30 dark:border-emerald-900/40 dark:text-emerald-400">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="p-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 text-xs text-indigo-900 dark:text-indigo-300">
            <span className="font-bold block mb-1">Instrucciones de Verificación:</span>
            Confirme o edite la cantidad recibida en caso de faltantes o roturas en el envío. El sistema recalculará automáticamente el costo medio ponderado sumando el prorrateo de los gastos logísticos (${totalExpenses.toLocaleString('es-AR')}).
          </div>

          {/* TABLA DE PRODUCTOS ESPERADOS VS RECIBIDOS */}
          <div className="border border-slate-200 dark:border-[#1B362A] rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 dark:bg-[#08130E] text-slate-500 uppercase font-bold border-b border-slate-200 dark:border-[#1B362A]">
                  <th className="p-3 pl-4">Producto / Perfume</th>
                  <th className="p-3 text-center">Cant. Esperada</th>
                  <th className="p-3 text-center">Cant. Recibida (Real)</th>
                  <th className="p-3 text-right">Costo Landed Est.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1B362A]">
                {order.items?.map((item) => {
                  const currentReceived = receivedItems.find(i => i.item_id === item.id)?.received_quantity ?? Number(item.expected_quantity);
                  const isDifference = currentReceived !== Number(item.expected_quantity);
                  const landedUnitCost = Number(item.unit_cost) + expensePerUnit;

                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-slate-50/50 dark:hover:bg-[#08130E]/30 ${
                        isDifference ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''
                      }`}
                    >
                      <td className="p-3 pl-4 font-medium text-slate-900 dark:text-white">
                        <div className="font-bold text-indigo-600 dark:text-indigo-400">
                          {item.product?.brand || 'Marca'}
                        </div>
                        {item.product?.name || 'Producto N/A'}
                        {isDifference && (
                          <span className="block text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                            ⚠️ Diferencia detectada (Faltante / Rotura)
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-center font-bold text-slate-600 dark:text-zinc-400">
                        {item.expected_quantity} ud
                      </td>

                      <td className="p-3 text-center">
                        <input
                          type="number"
                          min="0"
                          max={Number(item.expected_quantity)}
                          value={currentReceived}
                          onChange={(e) => handleQuantityChange(item.id!, parseFloat(e.target.value) || 0)}
                          className={`w-24 rounded border p-1 text-center font-bold text-xs ${
                            isDifference
                              ? 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
                              : 'border-slate-300 bg-white dark:border-[#1B362A] dark:bg-[#08130E] dark:text-white'
                          }`}
                        />
                      </td>

                      <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        ${landedUnitCost.toLocaleString('es-AR', { minimumFractionDigits: 2 })}/u
                        <span className="block text-[9px] text-slate-400 font-normal">
                          (${Number(item.unit_cost).toLocaleString('es-AR')} + ${expensePerUnit.toFixed(2)} flete)
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* RESUMEN DE PRORRATEO Y STOCK */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#08130E] border border-slate-200 dark:border-[#1B362A]">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Unidades Recibidas</span>
              <span className="text-base font-black text-slate-900 dark:text-white font-mono mt-0.5 block">
                {totalUnitsReceived} unidades
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#08130E] border border-slate-200 dark:border-[#1B362A]">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Gastos Prorrateados / Unidad</span>
              <span className="text-base font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5 block">
                +${expensePerUnit.toLocaleString('es-AR', { minimumFractionDigits: 2 })} / unidad
              </span>
            </div>
          </div>
        </div>

        {/* PIE DE PÁGINA Y BOTÓN DE CONFIRMACIÓN DE INGRESO */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-[#1B362A] bg-slate-50/50 dark:bg-[#08130E]/50">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="cursor-pointer text-xs"
          >
            Cancelar
          </Button>

          <Button
            onClick={handleConfirmStockIngress}
            disabled={isLoading || Boolean(successMsg)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 text-xs cursor-pointer shadow-md shadow-emerald-600/20"
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Confirmar Ingreso Definitivo a Stock
          </Button>
        </div>
      </div>
    </div>
  );
}
