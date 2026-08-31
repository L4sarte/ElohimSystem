'use client';

import React, { useState, useEffect } from 'react';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ReceiptTicket } from '@/components/pos/ReceiptTicket';
import { X, Printer, ShoppingBag } from 'lucide-react';
import { getSaleById, SaleDetailRecord } from '@/app/actions/sales';

interface SaleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleId: string | null;
}

export function SaleDetailModal({ isOpen, onClose, saleId }: SaleDetailModalProps) {
  const [saleData, setSaleData] = useState<SaleDetailRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrintTicket, setShowPrintTicket] = useState(false);

  useEffect(() => {
    if (!isOpen || !saleId) {
      setSaleData(null);
      setShowPrintTicket(false);
      return;
    }

    async function fetchSaleDetails() {
      setLoading(true);
      setError(null);
      try {
        const res = await getSaleById(saleId as string);
        if (!res.success || !res.data) {
          throw new Error(res.error || 'No se pudo cargar el detalle de la venta.');
        }
        setSaleData(res.data);
      } catch (e: unknown) {
        console.error('Error al cargar detalle de venta:', e);
        const msg = e instanceof Error ? e.message : 'No se pudo cargar el detalle de la venta.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }

    fetchSaleDetails();
  }, [isOpen, saleId]);

  if (!isOpen || !saleId) return null;

  const ticketNum = saleId.split('-')[0].toUpperCase();
  const clientName = saleData?.clients?.name || 'Cliente Ocasional';
  const createdDateStr = saleData?.created_at ? new Date(saleData.created_at).toLocaleString('es-AR') : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="w-[95vw] sm:max-w-lg bg-[#13261E] border border-[#1B362A] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto">
        
        {/* HEADER */}
        <CardHeader className="border-b border-[#1B362A] pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-white font-serif flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-[#D0A96B]" />
              Detalle de Venta #{ticketNum}
            </CardTitle>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white transition-colors cursor-pointer p-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <CardDescription className="text-xs text-zinc-400 mt-1 flex items-center justify-between font-mono">
            <span>Cliente: <strong className="text-zinc-200">{clientName}</strong></span>
            <span>{createdDateStr}</span>
          </CardDescription>
        </CardHeader>

        {/* CONTENIDO DEL DETALLE */}
        <CardContent className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="py-12 text-center text-xs text-zinc-400 space-y-2">
              <div className="h-6 w-6 border-2 border-[#D0A96B] border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p>Cargando comprobante de venta...</p>
            </div>
          ) : error ? (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs text-center font-semibold">
              {error}
            </div>
          ) : saleData ? (
            <>
              {/* DESGLOSE DE PRODUCTOS */}
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#D0A96B] block">
                  Ítems Vendidos ({saleData.sale_items?.length || 0})
                </span>

                <div className="space-y-1.5 bg-[#08130E] border border-[#1B362A] p-3 rounded-xl">
                  {saleData.sale_items?.map((item, idx: number) => {
                    const prodName = item.products?.name || 'Producto';
                    const brand = item.products?.brand || '';
                    const itemTotal = (item.price_ars_at_moment || 0) * (item.quantity || 1);
                    return (
                      <div key={idx} className="flex justify-between items-center text-xs pb-2 border-b border-[#1B362A]/60 last:border-0 last:pb-0">
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span className="text-[#D0A96B] font-mono font-black">{item.quantity}x</span>
                            <span>{prodName}</span>
                          </div>
                          {brand && <div className="text-[10px] text-zinc-400 font-mono">{brand}</div>}
                        </div>
                        <div className="font-mono font-bold text-emerald-400">
                          ${itemTotal.toLocaleString('es-AR')} ARS
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RESUMEN FINANCIERO */}
              <div className="p-3.5 rounded-xl bg-[#08130E] border border-[#1B362A] space-y-2 text-xs font-mono">
                <div className="flex justify-between text-zinc-300">
                  <span>Monto Total Cobrado:</span>
                  <span className="font-bold text-[#D0A96B] text-sm">${saleData.total_ars?.toLocaleString('es-AR')} ARS</span>
                </div>
                {saleData.amount_due_ars > 0 && (
                  <div className="flex justify-between text-amber-400 font-bold border-t border-[#1B362A]/60 pt-1">
                    <span>Saldo Pendiente:</span>
                    <span>${saleData.amount_due_ars?.toLocaleString('es-AR')} ARS</span>
                  </div>
                )}
                <div className="flex justify-between text-zinc-400 text-[11px]">
                  <span>Estado de Pago:</span>
                  <span className={`uppercase font-bold ${saleData.payment_status === 'paid' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {saleData.payment_status === 'paid' ? 'PAGADO' : 'PAGO PARCIAL / DEUDA'}
                  </span>
                </div>
              </div>

              {/* COMPROBANTE PRINT VIEW */}
              {showPrintTicket && (
                <div className="border-t border-[#1B362A] pt-3">
                  <ReceiptTicket
                    saleId={saleId}
                    createdAt={saleData.created_at}
                    clientName={clientName}
                    items={(saleData.sale_items || []).map((i) => ({
                      name: i.products?.name || 'Producto',
                      brand: i.products?.brand || '',
                      quantity: i.quantity || 1,
                      priceArs: i.price_ars_at_moment || 0,
                      totalArs: (i.price_ars_at_moment || 0) * (i.quantity || 1),
                    }))}
                    subtotalArs={saleData.total_ars || 0}
                    totalArs={saleData.total_ars || 0}
                    totalUsd={saleData.total_usd_equivalent || (saleData.total_ars / (saleData.exchange_rate_used || 1570))}
                    exchangeRate={saleData.exchange_rate_used || 1570}
                    paymentMethods={saleData.payment_methods}
                  />
                </div>
              )}
            </>
          ) : null}
        </CardContent>

        {/* FOOTER ACCIONES */}
        <div className="p-4 border-t border-[#1B362A] bg-[#08130E]/60 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPrintTicket(!showPrintTicket)}
            className="border-[#1B362A] bg-[#13261E] text-xs font-bold text-[#D0A96B] hover:bg-zinc-800 cursor-pointer"
          >
            <Printer className="mr-1.5 h-3.5 w-3.5 text-[#D0A96B]" />
            {showPrintTicket ? 'Ocultar Ticket' : 'Ver / Imprimir Ticket'}
          </Button>

          <Button
            onClick={onClose}
            className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold text-xs cursor-pointer"
          >
            Cerrar
          </Button>
        </div>

      </div>
    </div>
  );
}
