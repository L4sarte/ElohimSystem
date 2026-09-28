'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ReceiptTicket } from '@/components/pos/ReceiptTicket';
import { CheckCircle, Download, MessageSquare, Printer, RefreshCw, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { CompletedSaleData } from './types';

interface SuccessReceiptProps {
  saleData: CompletedSaleData | null;
  clientPhone?: string;
  onFinishNewSale: () => void;
}

/**
 * Estado de venta completada: resumen de la transacción, comprobante renderizado
 * (impresión térmica aislada), descarga de imagen, envío por WhatsApp y nueva venta.
 * Incluye el cleanup seguro del timer de impresión (printTimerRef) al desmontar.
 */
export function SuccessReceipt({ saleData, clientPhone, onFinishNewSale }: SuccessReceiptProps) {
  const ticketRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const printTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Limpieza del timer de impresión al desmontar (evita window.print() fantasma sobre modal cerrado)
  useEffect(() => {
    return () => {
      if (printTimerRef.current) clearTimeout(printTimerRef.current);
    };
  }, []);

  const handlePrintTicket = () => {
    if (printTimerRef.current) clearTimeout(printTimerRef.current);
    printTimerRef.current = setTimeout(() => {
      window.print();
    }, 200);
  };

  const downloadAsImage = async () => {
    if (!ticketRef.current || !saleData) return;
    try {
      setIsDownloading(true);

      // Delay safeguard para garantizar la carga completa del DOM y recursos de imagen
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Importación dinámica de html-to-image para compatibilidad con SSR en Next.js App Router / Vercel
      const { toPng } = await import('html-to-image');

      const filter = (node: HTMLElement) => {
        if (node.tagName === 'IMG') {
          const img = node as HTMLImageElement;
          if (!img.complete || img.naturalWidth === 0 || img.style.display === 'none') {
            return false;
          }
        }
        return true;
      };

      const dataUrl = await toPng(ticketRef.current, {
        cacheBust: true,
        backgroundColor: '#FFFFFF',
        style: { margin: '0' },
        filter: filter
      });

      const ticketNum = saleData.saleId
        ? saleData.saleId.split('-')[0].toUpperCase()
        : 'TICKET';
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `ticket-${ticketNum}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Imagen de ticket descargada');
    } catch (error) {
      console.error('[ERROR_EXPORTACION_VERCEL]:', error);
      toast.error('Error al generar el archivo. Revisa la consola (F12).');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSendWhatsApp = () => {
    if (!saleData) return;

    const itemsSummary = saleData.items
      .map((it) => `${it.quantity}x ${it.name}`)
      .join(', ');

    const rawMessage = `¡Hola! Gracias por tu compra en Elohim. Tu resumen: ${itemsSummary}. Total pagado: $${saleData.totalArs.toLocaleString('es-AR')} ARS. ¡Que lo disfrutes!`;

    const rawPhone = clientPhone || '';
    const clientPhoneClean = rawPhone ? rawPhone.replace(/\D/g, '') : '';
    const encodedText = encodeURIComponent(rawMessage);

    const whatsappUrl = clientPhoneClean 
      ? `https://wa.me/${clientPhoneClean}?text=${encodedText}`
      : `https://wa.me/?text=${encodedText}`;

    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="p-6 text-center space-y-6 animate-in zoom-in-95 duration-200 print:p-0 print:m-0">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2 shadow-lg shadow-emerald-500/10 print:hidden">
        <CheckCircle className="h-10 w-10" />
      </div>

      <div className="print:hidden">
        <h2 className="text-2xl font-bold text-white font-serif">¡Venta Registrada con Éxito!</h2>
        <p className="text-xs text-zinc-400 mt-1">
          La transacción ha sido almacenada de forma atómica y el stock descontado.
        </p>
      </div>

      {saleData && (
        <div className="bg-erp-bg p-4 rounded-xl border border-erp-border space-y-2 text-left print:hidden">
          <div className="flex justify-between text-xs text-zinc-400">
            <span>N° Transacción:</span>
            <span className="font-bold font-mono text-white">#{saleData.saleId.split('-')[0].toUpperCase()}</span>
          </div>
          <div className="flex justify-between text-xs text-zinc-400">
            <span>Cliente:</span>
            <span className="font-semibold text-zinc-200">{saleData.clientName}</span>
          </div>
          {saleData.discountAmountArs > 0 && (
            <div className="flex justify-between text-xs text-emerald-400 font-mono font-medium">
              <span>Descuento Aplicado:</span>
              <span>-${saleData.discountAmountArs.toLocaleString('es-AR')} ({saleData.discountPercentage}%)</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold pt-2 border-t border-erp-border">
            <span>Total Cobrado:</span>
            <span className="font-mono text-erp-gold">${saleData.totalArs.toLocaleString('es-AR')} ARS</span>
          </div>
        </div>
      )}

      {/* CONTENEDOR OCULTO PARA CAPTURA HTML2CANVAS */}
      {saleData && (
        <div className="overflow-hidden h-0 w-0 opacity-0 pointer-events-none absolute">
          <div ref={ticketRef} className="bg-white p-4 text-slate-900 inline-block w-[380px]">
            <ReceiptTicket {...saleData} />
          </div>
        </div>
      )}

      {/* BANDERAS DE IMPRESIÓN Y TICKET RENDERIZADO AISLADO PARA EL MODAL */}
      {saleData && (
        <div className="hidden print:block print:fixed print:inset-0 print:m-0 print:p-4 print:bg-white print:z-[99999] print:w-full print:h-full print:overflow-visible">
          <ReceiptTicket {...saleData} />
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-3 pt-2 print:hidden">
        <Button
          onClick={handlePrintTicket}
          variant="outline"
          className="cursor-pointer border-erp-border bg-erp-bg font-bold text-zinc-300"
        >
          <Printer className="mr-2 h-4 w-4 text-erp-gold" /> Imprimir Ticket
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={downloadAsImage}
          disabled={isDownloading}
          className="cursor-pointer border-erp-border bg-erp-bg font-bold text-zinc-300 hover:bg-erp-surface hover:text-white"
        >
          {isDownloading ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin text-erp-gold" />
          ) : (
            <Download className="mr-2 h-4 w-4 text-erp-gold" />
          )}
          Descargar Imagen
        </Button>

        <Button
          onClick={handleSendWhatsApp}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 cursor-pointer"
        >
          <MessageSquare className="mr-2 h-4 w-4" /> Enviar por WhatsApp
        </Button>

        <Button
          onClick={onFinishNewSale}
          className="bg-erp-gold hover:bg-erp-gold-hover text-erp-bg font-extrabold text-xs shadow-md shadow-erp-gold/20 cursor-pointer"
        >
          <ShoppingBag className="mr-2 h-4 w-4" /> Nueva Venta
        </Button>
      </div>

    </div>
  );
}
