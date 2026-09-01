'use client';

import React from 'react';
import { SystemSettingsData, DEFAULT_SYSTEM_SETTINGS } from '@/lib/settings-validation';

export interface ReceiptItem {
  name: string;
  brand?: string;
  quantity: number;
  priceArs: number;
  totalArs: number;
}

export interface ReceiptTicketProps {
  saleId?: string;
  createdAt?: string | Date;
  clientName?: string;
  items: ReceiptItem[];
  subtotalArs: number;
  surchargeArs?: number;
  totalArs: number;
  totalUsd: number;
  exchangeRate: number;
  paymentMethods?: any;
  sellerName?: string;
  settings?: SystemSettingsData;
}

export function ReceiptTicket({
  saleId = 'TEMP-001',
  createdAt = new Date(),
  clientName = 'Consumidor Final',
  items = [],
  subtotalArs,
  surchargeArs = 0,
  totalArs,
  totalUsd,
  exchangeRate,
  paymentMethods,
  sellerName = 'Vendedor',
  settings = DEFAULT_SYSTEM_SETTINGS,
}: ReceiptTicketProps) {
  const formattedDate = new Date(createdAt).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const ticketNumber = `TICK-${saleId.split('-')[0].toUpperCase()}`;

  // Extraer información de pagos recibidos
  const breakdown = paymentMethods?.breakdown || [];

  return (
    <div>
      {/* Estilos CSS aislados para impresión térmica en comandera (80mm / 58mm) */}
      <style>{`
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0.2cm !important;
            font-family: monospace !important;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-receipt-area, #printable-receipt-area * {
            visibility: visible !important;
          }
          #printable-receipt-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 80mm !important;
            margin: 0 auto !important;
            padding: 4px !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
        }
      `}</style>

      <div 
        id="printable-receipt-area"
        className="w-full max-w-[80mm] mx-auto p-4 bg-white text-black font-mono text-[11px] leading-tight border border-dashed border-slate-300 rounded-lg shadow-md print:border-none print:p-1 print:m-0 print:shadow-none print:w-full print:bg-white print:text-black"
      >
        {/* CABECERA CON LOGO CENTRADO Y MARCA OFICIAL */}
        <div className="text-center space-y-1 pb-3 border-b border-dashed border-black">
          <img 
            src={settings.logo_url || '/logo-elohim.png'} 
            alt={settings.trade_name} 
            className="w-24 h-auto mx-auto mb-1.5 object-contain print:w-24" 
            crossOrigin="anonymous"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <h2 className="text-sm font-black uppercase tracking-widest text-black">
            {settings.trade_name || 'ELOHIM IMPORT'}
          </h2>
          {settings.slogan && (
            <p className="text-[9px] text-zinc-800">{settings.slogan}</p>
          )}
          
          <div className="text-[9px] text-zinc-700 space-y-0.5 pt-0.5">
            {settings.cuit_tax_id && <div>CUIT: {settings.cuit_tax_id}</div>}
            {settings.address && <div>{settings.address} {settings.city ? `• ${settings.city}` : ''}</div>}
            {settings.phone && <div>Tel / WhatsApp: {settings.phone}</div>}
          </div>

          <div className="text-[9px] font-bold border border-black px-2 py-0.5 mt-1 inline-block text-black uppercase">
            {settings.receipt_header || 'DOCUMENTO NO VÁLIDO COMO FACTURA'}
          </div>
        </div>

        {/* METADATA DE LA TRANSACCIÓN */}
        <div className="py-2 border-b border-dashed border-black space-y-1 text-[10px] text-black">
          <div className="flex justify-between">
            <span>N° Ticket:</span>
            <span className="font-bold">#{ticketNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>Fecha/Hora:</span>
            <span>{formattedDate}</span>
          </div>
          <div className="flex justify-between">
            <span>Cliente:</span>
            <span className="font-bold truncate max-w-[140px]">{clientName}</span>
          </div>
          <div className="flex justify-between">
            <span>Vendedor:</span>
            <span>{sellerName}</span>
          </div>
        </div>

        {/* CUERPO - PRODUCTOS, DECANTS Y PACKAGING */}
        <div className="py-2.5 border-b border-dashed border-black space-y-2 text-black">
          <div className="flex justify-between font-bold border-b border-black pb-1 text-[10px]">
            <span className="w-1/2">CONCEPTO</span>
            <span className="w-1/4 text-center">CANT x P.U</span>
            <span className="w-1/4 text-right">TOTAL</span>
          </div>

          {items.map((item, idx) => (
            <div key={idx} className="space-y-0.5">
              <div className="font-bold truncate">
                {item.brand ? `[${item.brand}] ` : ''}{item.name}
              </div>
              <div className="flex justify-between text-[10px] pl-2">
                <span className="w-1/2"></span>
                <span className="w-1/4 text-center">
                  {item.quantity} x ${item.priceArs.toLocaleString('es-AR')}
                </span>
                <span className="w-1/4 text-right font-bold">
                  ${item.totalArs.toLocaleString('es-AR')}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* DESGLOSE FINANCIERO */}
        <div className="py-2.5 border-b border-dashed border-black space-y-1.5 text-black">
          <div className="flex justify-between">
            <span>Subtotal Base ARS:</span>
            <span>${subtotalArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
          </div>

          {surchargeArs > 0 && (
            <div className="flex justify-between font-bold text-[10px]">
              <span>Costo Financiero Cuotas:</span>
              <span>+${surchargeArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
          )}

          <div className="flex justify-between font-black text-sm pt-1 border-t border-black">
            <span>TOTAL FINAL ARS:</span>
            <span>${totalArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
          </div>

          <div className="flex justify-between text-[10px] text-zinc-800">
            <span>Equiv. Dólares (USD):</span>
            <span>u$s {totalUsd.toFixed(2)} (Tasa: ${exchangeRate})</span>
          </div>
        </div>

        {/* MEDIOS DE PAGO RECIBIDOS */}
        <div className="py-2 border-b border-dashed border-black space-y-1 text-[10px] text-black">
          <span className="font-bold block uppercase tracking-wider text-[9px] mb-1">Medios de Pago:</span>
          
          {breakdown.length > 0 ? (
            breakdown.map((b: any, i: number) => (
              <div key={i} className="flex justify-between">
                <span>• {b.method_name}:</span>
                <span className="font-bold">${Number(b.final_amount || b.amount_base || 0).toLocaleString('es-AR')} ARS</span>
              </div>
            ))
          ) : (
            <div className="flex justify-between">
              <span>• Pago General:</span>
              <span className="font-bold">${totalArs.toLocaleString('es-AR')} ARS</span>
            </div>
          )}
        </div>

        {/* PIE Y AGRADECIMIENTO */}
        <div className="pt-3 text-center space-y-1 text-[10px] text-black">
          <p className="font-bold">{settings.receipt_footer_message || settings.receipt_footer_text}</p>
          <p className="text-[9px]">
            Conserve este comprobante para cambios o devoluciones dentro de los {settings.warranty_policy_days || 30} días.
          </p>
          {settings.instagram_handle && (
            <p className="text-[9px] font-semibold">Instagram: {settings.instagram_handle}</p>
          )}
          <div className="pt-2 text-[8px] tracking-widest text-zinc-600 uppercase font-sans">
            {settings.trade_name} ERP • Sistema Bimonetario
          </div>
        </div>
      </div>
    </div>
  );
}
