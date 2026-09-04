'use client';

import React, { useState, useEffect } from 'react';
import { useSupplyChainStore } from '@/store/supplyChainStore';
import { PurchaseOrder, CheckInItemPayload } from '@/types/supplyChain';
import { getTreasuryAccounts, TreasuryAccount } from '@/app/actions/treasury';
import { 
  PackageCheck, AlertTriangle, RefreshCw, X, CheckCircle, 
  DollarSign, ArrowUpRight, ShieldCheck, Box, Wallet, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';

interface CheckInModalProps {
  order: PurchaseOrder;
  isOpen: boolean;
  onClose: () => void;
}

export function CheckInModal({ order, isOpen, onClose }: CheckInModalProps) {
  const { confirmCheckIn, error: storeError, isLoading } = useSupplyChainStore();

  // Mapear los items esperados a un estado local editable de cantidades verdaderamente recibidas
  const [receivedItems, setReceivedItems] = useState<CheckInItemPayload[]>(
    order.items?.map(item => ({
      item_id: item.id!,
      received_quantity: Number(item.expected_quantity)
    })) || []
  );

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Estados financieros de tesorería y condición de pago
  const [treasuryAccounts, setTreasuryAccounts] = useState<TreasuryAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [paymentType, setPaymentType] = useState<'immediate' | 'cxp'>('immediate');
  const [selectedTreasuryAccountId, setSelectedTreasuryAccountId] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  });

  useEffect(() => {
    if (!isOpen) return;
    async function loadAccounts() {
      setLoadingAccounts(true);
      const res = await getTreasuryAccounts();
      if (res.success && res.data && res.data.length > 0) {
        setTreasuryAccounts(res.data);
        setSelectedTreasuryAccountId(res.data[0].id);
      }
      setLoadingAccounts(false);
    }
    loadAccounts();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleQuantityChange = (itemId: string, rawVal: string | number) => {
    // Limpieza estricta de ceros iniciales (evita "096")
    const cleanStr = String(rawVal).replace(/^0+(?=\d)/, '');
    const cleanNum = parseInt(cleanStr, 10);
    const validQty = isNaN(cleanNum) || cleanNum < 0 ? 0 : cleanNum;

    setReceivedItems(prev => prev.map(item => {
      if (item.item_id === itemId) {
        return { ...item, received_quantity: validQty };
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

  // Total estimado de mercadería y orden
  const totalMerchandiseCost = receivedItems.reduce((sum, item) => {
    const origItem = order.items?.find(i => i.id === item.item_id);
    return sum + (Number(item.received_quantity || 0) * Number(origItem?.unit_cost || 0));
  }, 0);
  const grandTotalEstimated = totalMerchandiseCost + totalExpenses;

  const handleConfirmStockIngress = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    // Parsing estricto para evitar errores con entradas como "096"
    const cleanedPayload: CheckInItemPayload[] = receivedItems.map(item => {
      const cleanStr = String(item.received_quantity ?? '').replace(/^0+/, '');
      const cleanQty = parseInt(cleanStr, 10) || 0;
      return {
        item_id: item.item_id,
        received_quantity: Math.max(0, cleanQty)
      };
    });

    const totalCleanUnits = cleanedPayload.reduce((sum, item) => sum + item.received_quantity, 0);

    if (totalCleanUnits <= 0) {
      setErrorMsg('Debe confirmar la recepción de al menos 1 unidad para ingresar a stock.');
      return;
    }

    if (paymentType === 'immediate' && !selectedTreasuryAccountId) {
      setErrorMsg('Debe seleccionar una cuenta de tesorería de origen para el pago al contado.');
      return;
    }

    try {
      await confirmCheckIn(order.id, cleanedPayload, {
        isPaid: paymentType === 'immediate',
        treasuryAccountId: paymentType === 'immediate' ? selectedTreasuryAccountId : undefined,
        dueDate: paymentType === 'cxp' ? dueDate : null,
      });

      setSuccessMsg(
        paymentType === 'immediate'
          ? '¡Mercadería ingresada exitosamente! Fondos debitados contablemente de la cuenta de tesorería.'
          : '¡Mercadería ingresada exitosamente! Registrada en Cuentas por Pagar (CxP) pendiente de liquidación.'
      );
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: unknown) {
      console.error('Error al confirmar check-in:', err);
      const msg = err instanceof Error 
        ? err.message 
        : typeof err === 'object' && err !== null && 'message' in err 
          ? String((err as any).message) 
          : 'Error al ejecutar el check-in de mercadería.';
      setErrorMsg(msg);
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
          {(errorMsg || storeError) && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 dark:bg-rose-950/30 dark:border-rose-900/40 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMsg || storeError}</span>
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
                          value={currentReceived === 0 ? '' : currentReceived}
                          placeholder="0"
                          onChange={(e) => handleQuantityChange(item.id!, e.target.value)}
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

          {/* CONDICIÓN FINANCIERA & IMPUTACIÓN DE PAGO EN TESORERÍA */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-[#1B362A] bg-slate-50/70 dark:bg-[#08130E]/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-[#D0A96B]" />
                Condición Financiera & Pago a Proveedor
              </span>
              <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">
                Total a liquidar: ${grandTotalEstimated.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Opción A: Pagado al Contado / Inmediato */}
              <label 
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  paymentType === 'immediate'
                    ? 'border-emerald-500 bg-emerald-500/10 text-slate-900 dark:text-white shadow-sm'
                    : 'border-slate-200 dark:border-[#1B362A] hover:bg-slate-100 dark:hover:bg-[#13261E] text-slate-600 dark:text-zinc-400'
                }`}
              >
                <input
                  type="radio"
                  name="paymentType"
                  value="immediate"
                  checked={paymentType === 'immediate'}
                  onChange={() => setPaymentType('immediate')}
                  className="mt-0.5 accent-emerald-500"
                />
                <div className="text-xs">
                  <span className="font-bold block text-emerald-700 dark:text-emerald-400">
                    Pagado al Contado / Inmediato
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 block mt-0.5 leading-snug">
                    Descuenta los fondos automáticamente de la cuenta de tesorería hoy.
                  </span>
                </div>
              </label>

              {/* Opción B: Pendiente de Pago (CxP) */}
              <label 
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  paymentType === 'cxp'
                    ? 'border-amber-500 bg-amber-500/10 text-slate-900 dark:text-white shadow-sm'
                    : 'border-slate-200 dark:border-[#1B362A] hover:bg-slate-100 dark:hover:bg-[#13261E] text-slate-600 dark:text-zinc-400'
                }`}
              >
                <input
                  type="radio"
                  name="paymentType"
                  value="cxp"
                  checked={paymentType === 'cxp'}
                  onChange={() => setPaymentType('cxp')}
                  className="mt-0.5 accent-amber-500"
                />
                <div className="text-xs">
                  <span className="font-bold block text-amber-700 dark:text-amber-400">
                    Pendiente de Pago (CxP)
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 block mt-0.5 leading-snug">
                    Registra la orden como deuda exigible sin debitar tesorería hoy.
                  </span>
                </div>
              </label>
            </div>

            {/* Selector de Cuenta de Tesorería */}
            {paymentType === 'immediate' && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 uppercase">
                    Cuenta Financiera de Tesorería (Origen del Egreso) *
                  </label>
                  {loadingAccounts && (
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <RefreshCw className="h-3 w-3 animate-spin" /> Cargando cuentas...
                    </span>
                  )}
                </div>

                <select
                  value={selectedTreasuryAccountId}
                  onChange={(e) => setSelectedTreasuryAccountId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-300 dark:border-[#1B362A] bg-white dark:bg-[#08130E] px-3 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  {treasuryAccounts.length === 0 ? (
                    <option value="">-- No hay cuentas de tesorería activas --</option>
                  ) : (
                    treasuryAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.account_name} ({acc.account_type === 'bank' ? 'Banco' : acc.account_type === 'wallet' ? 'Billetera' : 'Efectivo'}) — Saldo disponible: ${acc.balance_ars.toLocaleString('es-AR')} ARS
                      </option>
                    ))
                  )}
                </select>
                <p className="text-[10px] text-slate-400 leading-snug">
                  • El egreso se registrará como pago a proveedor, descontando de tesorería sin computarse como gasto OPEX.
                </p>
              </div>
            )}

            {/* Selector de Fecha de Vencimiento para CxP */}
            {paymentType === 'cxp' && (
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 uppercase flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-amber-500" /> Fecha Límite de Pago a Proveedor (Vencimiento CxP)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-300 dark:border-[#1B362A] bg-white dark:bg-[#08130E] px-3 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 font-mono font-bold"
                />
                <p className="text-[10px] text-amber-600/90 dark:text-amber-400/90 leading-snug">
                  • La orden figurará en la pestaña "Cuentas por Pagar" con botón de liquidación posterior.
                </p>
              </div>
            )}
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
