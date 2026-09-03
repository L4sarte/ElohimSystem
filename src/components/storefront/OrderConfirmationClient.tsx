'use client';

import React from 'react';
import Link from 'next/link';
import { SystemSettingsData, DEFAULT_SYSTEM_SETTINGS } from '@/lib/settings-validation';
import { StorefrontHeader } from './StorefrontHeader';
import { StorefrontFooter } from './StorefrontFooter';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, ShoppingBag, Truck, MapPin, CreditCard, 
  Landmark, MessageCircle, ArrowLeft, Copy, Clock, ShieldCheck, Sparkles 
} from 'lucide-react';
import { toast } from 'sonner';

interface OrderConfirmationClientProps {
  order: {
    id: string;
    orderNumber: string;
    createdAt: string;
    totalArs: number;
    paymentStatus: string;
    metadata: Record<string, any>;
    items: Array<{
      id: string;
      name: string;
      brand: string;
      quantity: number;
      priceArs: number;
      totalArs: number;
    }>;
    storeSettings: SystemSettingsData;
  };
}

export function OrderConfirmationClient({ order }: OrderConfirmationClientProps) {
  const settings = order.storeSettings || DEFAULT_SYSTEM_SETTINGS;
  const meta = order.metadata || {};

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado al portapapeles`);
  };

  const formattedDate = new Date(order.createdAt).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Generar mensaje de WhatsApp estructurado oficial
  const getWhatsAppConfirmationLink = () => {
    const rawPhone = settings.phone || '5493472438524';
    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    const clientName = meta.client_name || 'Cliente';
    const clientPhone = meta.client_phone || '';
    const totalText = order.totalArs.toLocaleString('es-AR');

    const deliveryText =
      meta.delivery_method === 'pickup'
        ? 'Retiro en Showroom'
        : `Envío a Domicilio (${meta.shipping_address || 'Sin dirección'}${meta.shipping_city ? `, ${meta.shipping_city}` : ''}${meta.shipping_postal_code ? ` - CP: ${meta.shipping_postal_code}` : ''})`;

    const itemsSummary = order.items
      .map((i) => `• ${i.quantity}x ${i.name} ($${i.totalArs.toLocaleString('es-AR')})`)
      .join('\n');

    const notesBlock = meta.shipping_notes
      ? `\n📝 *Notas:* ${meta.shipping_notes}\n`
      : '\n';

    const message = `✨ *NUEVO PEDIDO - ${(settings.trade_name || 'ELOHIM IMPORT').toUpperCase()}* ✨\n📋 *Orden:* #${order.orderNumber}\n👤 *Cliente:* ${clientName}\n📱 *Teléfono:* ${clientPhone}\n📍 *Entrega:* ${deliveryText}${notesBlock}\n🛍️ *DETALLE DEL PEDIDO:*\n${itemsSummary}\n\n💵 *TOTAL A PAGAR:* $${totalText} ARS\n\n¡Hola! Quiero confirmar este pedido y coordinar el pago/envío.`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const isPickup = meta.delivery_method === 'pickup';
  const isTransfer = meta.payment_method === 'transfer' || !meta.payment_method || Boolean(settings.bank_alias);

  return (
    <div className="min-h-screen bg-[#08130E] text-zinc-100 flex flex-col font-sans selection:bg-[#D0A96B]/30 selection:text-[#E5C158]">
      
      {/* HEADER */}
      <StorefrontHeader settings={settings} />

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 container mx-auto max-w-4xl px-4 sm:px-6 py-10 space-y-8">
        
        {/* ENCABEZADO DE ÉXITO */}
        <div className="text-center space-y-3 bg-[#13261E] p-6 sm:p-8 rounded-3xl border border-[#1B362A] shadow-2xl animate-in zoom-in-95 duration-300">
          <div className="h-16 w-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="h-9 w-9" />
          </div>

          <div className="space-y-1">
            <div className="text-xs font-mono font-bold uppercase tracking-widest text-[#D0A96B]">
              ¡Pedido Registrado con Éxito!
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white font-serif">
              Gracias por tu compra, {meta.client_name || 'Cliente'}
            </h1>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              Hemos reservado tus fragancias. Tu código de seguimiento es:
            </p>
            <div className="pt-2">
              <span className="inline-block px-4 py-1.5 rounded-xl bg-[#08130E] border border-[#D0A96B]/40 text-[#E5C158] font-mono font-black text-lg sm:text-xl tracking-wider shadow-inner">
                #{order.orderNumber}
              </span>
            </div>
          </div>

          {/* BOTÓN WHATSAPP DESTACADO */}
          <div className="pt-4 max-w-md mx-auto">
            <a
              href={getWhatsAppConfirmationLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2.5 h-13 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <MessageCircle className="h-5 w-5 fill-current" />
              <span>Abrir Conversación en WhatsApp 📲</span>
            </a>
          </div>
        </div>

        {/* DETALLES DEL PEDIDO EN CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* COLUMNA 1: DESGLOSE DE PRODUCTOS */}
          <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl">
            <CardHeader className="border-b border-[#1B362A] p-5">
              <CardTitle className="text-sm font-bold text-white font-serif flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-[#D0A96B]" />
                Detalle de Fragancias
              </CardTitle>
            </CardHeader>

            <CardContent className="p-5 space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between items-center text-xs pb-2 border-b border-[#1B362A]/60">
                  <div>
                    <div className="font-bold text-white font-serif">{item.name}</div>
                    <div className="text-[10px] text-zinc-400 font-mono">
                      {item.quantity} ud x ${item.priceArs.toLocaleString('es-AR')}
                    </div>
                  </div>
                  <span className="font-mono font-bold text-white">
                    ${item.totalArs.toLocaleString('es-AR')} ARS
                  </span>
                </div>
              ))}

              <div className="pt-3 space-y-1.5">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Fecha:</span>
                  <span className="font-mono text-zinc-200">{formattedDate}</span>
                </div>
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Modalidad de Entrega:</span>
                  <span className="text-zinc-200 font-semibold">
                    {isPickup ? 'Retiro en Showroom' : 'Envío a Domicilio'}
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-[#1B362A] font-bold">
                  <span className="text-white text-xs uppercase tracking-wider">Total a Abonar:</span>
                  <span className="text-base font-black font-mono text-[#D0A96B]">
                    ${order.totalArs.toLocaleString('es-AR')} ARS
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* COLUMNA 2: DATOS DE PAGO Y ENTREGA */}
          <div className="space-y-6">
            
            {/* DATOS BANCARIOS SI ES TRANSFERENCIA */}
            {isTransfer ? (
              <Card className="border border-[#D0A96B]/40 bg-gradient-to-br from-[#1B362A] to-[#08130E] rounded-2xl shadow-xl">
                <CardHeader className="p-5 border-b border-[#1B362A]">
                  <CardTitle className="text-xs font-bold text-[#D0A96B] font-serif uppercase tracking-wider flex items-center gap-2">
                    <Landmark className="h-4 w-4" />
                    Datos para tu Transferencia Bancaria
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-5 space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Banco / Billetera:</span>
                    <span className="font-bold text-white">{settings.bank_name || 'Banco Galicia / Mercado Pago'}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Titular:</span>
                    <span className="font-bold text-white">{settings.bank_account_holder || settings.company_name}</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#08130E] border border-[#1B362A] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Alias:</span>
                      <span className="font-mono font-bold text-[#E5C158] text-sm">
                        {settings.bank_alias || 'ELOHIM.PERFUMES.ARS'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopy(settings.bank_alias || 'ELOHIM.PERFUMES.ARS', 'Alias')}
                      className="px-2 py-1 rounded bg-[#13261E] text-zinc-300 hover:text-white text-[10px] font-bold cursor-pointer"
                    >
                      Copiar
                    </button>
                  </div>

                  {settings.bank_cbu_cvu && (
                    <div className="p-2.5 rounded-xl bg-[#08130E] border border-[#1B362A] flex items-center justify-between">
                      <div className="min-w-0">
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">CBU / CVU:</span>
                        <span className="font-mono font-bold text-zinc-200 text-xs truncate block">
                          {settings.bank_cbu_cvu}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopy(settings.bank_cbu_cvu, 'CBU')}
                        className="px-2 py-1 rounded bg-[#13261E] text-zinc-300 hover:text-white text-[10px] font-bold cursor-pointer shrink-0 ml-2"
                      >
                        Copiar
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl">
                <CardHeader className="p-5 border-b border-[#1B362A]">
                  <CardTitle className="text-xs font-bold text-white font-serif uppercase tracking-wider flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-[#D0A96B]" />
                    Método de Pago Seleccionado
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 text-xs text-zinc-300">
                  <p className="font-bold text-white">
                    {meta.payment_method === 'cash_on_delivery' ? 'Efectivo / Pago al Retirar' : 'Pago Digital / Tarjetas'}
                  </p>
                  <p className="text-zinc-400 mt-1">
                    Coordinaremos los detalles finales a través de WhatsApp.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* DIRECCIÓN DE ENTREGA / RETIRO */}
            <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl">
              <CardHeader className="p-5 border-b border-[#1B362A]">
                <CardTitle className="text-xs font-bold text-white font-serif uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#D0A96B]" />
                  Información de Entrega
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 text-xs text-zinc-300 space-y-1">
                {isPickup ? (
                  <div>
                    <div className="font-bold text-white">Retiro en Showroom:</div>
                    <p>{settings.address || 'Av. Santa Fe 1234, Local 12'} {settings.city ? `(${settings.city})` : ''}</p>
                    <p className="text-[11px] text-zinc-400 pt-1">
                      Horario de atención: Lunes a Sábados de 10:00 a 20:00 hs.
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="font-bold text-white">Dirección de Envío:</div>
                    <p>{meta.shipping_address} {meta.shipping_city ? `• ${meta.shipping_city}` : ''}</p>
                    {meta.shipping_notes && (
                      <p className="text-[11px] text-zinc-400 pt-1">Notas: {meta.shipping_notes}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>

        </div>

        {/* BOTÓN DE RETORNO */}
        <div className="text-center pt-4">
          <Link href="/tienda">
            <Button variant="outline" className="border-[#1B362A] text-zinc-300 hover:text-white hover:bg-[#13261E]">
              <ArrowLeft className="mr-2 h-4 w-4" /> Seguir Explorando Fragancias
            </Button>
          </Link>
        </div>

      </main>

      {/* FOOTER */}
      <StorefrontFooter settings={settings} />

    </div>
  );
}
