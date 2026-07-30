'use client';

import React, { useState, useEffect } from 'react';
import { UserRole } from '@/types';
import { processReturn } from '@/app/actions/returns';
import { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RotateCcw, X, AlertCircle, RefreshCw, CheckCircle2, ShieldAlert, PackageCheck, AlertTriangle } from 'lucide-react';

interface ReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sale: any | null;
  role: UserRole;
}

export function ReturnModal({
  isOpen,
  onClose,
  onSuccess,
  sale,
  role
}: ReturnModalProps) {
  const [returnReason, setReturnReason] = useState('');
  const [restockItem, setRestockItem] = useState(true);
  const [refundAmountInput, setRefundAmountInput] = useState('');
  
  // Confirmación previa de seguridad
  const [confirmStep, setConfirmStep] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !sale) return;
    setReturnReason('');
    setRestockItem(true);
    setRefundAmountInput(sale.total_ars ? sale.total_ars.toString() : '');
    setConfirmStep(false);
    setError(null);
  }, [isOpen, sale]);

  if (!isOpen || !sale) return null;

  const ticketNum = sale.id ? sale.id.split('-')[0].toUpperCase() : 'TICKET';
  const clientName = sale.clients?.name || 'Consumidor Final';
  const valRefundAmount = parseFloat(refundAmountInput) || 0;

  const handleStartSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!returnReason.trim()) {
      setError('Debes ingresar el motivo de la devolución.');
      return;
    }

    if (valRefundAmount < 0) {
      setError('El monto a reintegrar no puede ser negativo.');
      return;
    }

    setError(null);
    setConfirmStep(true);
  };

  const handleExecuteReturn = async () => {
    setSubmitting(true);
    setError(null);

    const res = await processReturn(role, {
      sale_id: sale.id,
      return_reason: returnReason.trim(),
      restock_item: restockItem,
      refund_amount_ars: valRefundAmount
    });

    setSubmitting(false);

    if (res.success) {
      onSuccess();
      onClose();
    } else {
      setError(res.error || 'Error al procesar la devolución');
      setConfirmStep(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="w-[95vw] sm:max-w-lg bg-[#13261E] border border-[#1B362A] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto">
        
        {!confirmStep ? (
          <form onSubmit={handleStartSubmit}>
            
            <CardHeader className="border-b border-[#1B362A] pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold text-white font-serif flex items-center gap-2">
                  <RotateCcw className="h-5 w-5 text-[#D0A96B]" />
                  Procesar Devolución / Cambio
                </CardTitle>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <CardDescription className="text-xs text-zinc-400 mt-1">
                Ticket: <strong className="text-white">#{ticketNum}</strong> | Cliente: <strong className="text-white">{clientName}</strong>
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 p-6 max-h-[65vh] overflow-y-auto">
              
              {error && (
                <div className="flex gap-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              {/* DETALLES DE LA VENTA ORIGINAL */}
              <div className="p-3.5 rounded-xl bg-[#08130E] border border-[#1B362A] space-y-2 text-xs">
                <div className="flex justify-between font-bold text-zinc-300 font-serif">
                  <span>Productos Comprados:</span>
                  <span className="font-mono text-[#D0A96B]">${sale.total_ars?.toLocaleString('es-AR')} ARS</span>
                </div>

                <div className="space-y-1 pt-1 border-t border-[#1B362A]/60 max-h-32 overflow-y-auto font-mono text-[11px]">
                  {sale.sale_items && sale.sale_items.length > 0 ? (
                    sale.sale_items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-zinc-400">
                        <span>{item.quantity}x {item.products?.name || 'Producto'} ({item.products?.brand || ''})</span>
                        <span>${Number(item.price_ars_at_moment || 0).toLocaleString('es-AR')} ARS</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-zinc-500 italic">Sin detalle de ítems</div>
                  )}
                </div>
              </div>

              {/* MOTIVO DE LA DEVOLUCIÓN */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Motivo de la Devolución *
                </label>
                <Input
                  required
                  placeholder="Ej. Cambio de opinión, falla de perfume, caja dañada..."
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="bg-[#08130E] border-[#1B362A] text-white"
                />
              </div>

              {/* MONTO A REINTEGRAR (ARS) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#D0A96B]">
                  Monto a Reintegrar al Cliente (ARS) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-zinc-500">$</span>
                  <Input
                    required
                    type="number"
                    min="0"
                    placeholder={`Default: $${sale.total_ars?.toLocaleString('es-AR')}`}
                    value={refundAmountInput}
                    onChange={(e) => setRefundAmountInput(e.target.value)}
                    className="pl-7 bg-[#08130E] border-[#1B362A] text-white font-mono font-bold text-sm"
                  />
                </div>
              </div>

              {/* REINGRESAR AL STOCK CHECKBOX */}
              <div className="p-3.5 rounded-xl bg-[#08130E] border border-[#1B362A] space-y-2">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="restock_checkbox"
                    checked={restockItem}
                    onChange={(e) => setRestockItem(e.target.checked)}
                    className="h-4 w-4 rounded border-[#1B362A] bg-[#13261E] text-[#D0A96B] focus:ring-[#D0A96B] cursor-pointer"
                  />
                  <label htmlFor="restock_checkbox" className="text-xs font-bold text-white cursor-pointer select-none flex items-center gap-1.5">
                    <PackageCheck className="h-4 w-4 text-[#D0A96B]" /> Reingresar mercadería al Stock de Inventario
                  </label>
                </div>
                <p className="text-[10px] text-zinc-400 leading-snug pl-7">
                  {restockItem ? (
                    <span className="text-emerald-400">
                      ✔ El inventario se incrementará automáticamente con los ítems devueltos.
                    </span>
                  ) : (
                    <span className="text-amber-400">
                      ⚠️ El producto NO se restockeará (marca esta casilla si la mercadería está rota, fallada o inutilizable).
                    </span>
                  )}
                </p>
              </div>

            </CardContent>

            <CardFooter className="border-t border-[#1B362A] pt-4 flex justify-end gap-3 bg-[#08130E]/60 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="border-[#1B362A] bg-[#13261E] text-zinc-300 hover:bg-zinc-800"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold text-xs shadow-md shadow-[#D0A96B]/20 cursor-pointer"
              >
                Continuar a Confirmación
              </Button>
            </CardFooter>

          </form>
        ) : (
          /* STEP DE CONFIRMACIÓN DE SEGURIDAD ATÓMICA */
          <div className="p-6 text-center space-y-5 animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 mb-1 shadow-lg shadow-amber-500/10">
              <AlertTriangle className="h-8 w-8 text-[#D0A96B]" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white font-serif">¿Confirmar Procesamiento de Devolución?</h2>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                Esta acción impactará atómicamente la venta, el stock y la caja chica.
              </p>
            </div>

            <div className="bg-[#08130E] p-4 rounded-xl border border-[#1B362A] space-y-2 text-left text-xs font-mono">
              <div className="flex justify-between text-zinc-400">
                <span>N° Ticket:</span>
                <span className="text-white font-bold">#{ticketNum}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Motivo:</span>
                <span className="text-zinc-200 font-sans">{returnReason}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Reingreso a Stock:</span>
                <span className={restockItem ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                  {restockItem ? 'Sí (Stock +Qty)' : 'No (Producto dañado)'}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-2 border-t border-[#1B362A]">
                <span>Egreso de Caja Chica:</span>
                <span className="text-rose-400">-${valRefundAmount.toLocaleString('es-AR')} ARS</span>
              </div>
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmStep(false)}
                disabled={submitting}
                className="border-[#1B362A] bg-[#08130E] text-zinc-300 hover:bg-zinc-800"
              >
                Modificar Datos
              </Button>

              <Button
                type="button"
                onClick={handleExecuteReturn}
                disabled={submitting}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Procesando...
                  </>
                ) : (
                  'Sí, Ejecutar Devolución'
                )}
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
