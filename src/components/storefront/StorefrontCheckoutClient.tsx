'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCartStore } from '@/hooks/use-cart-store';
import { createWhatsAppOrderAction } from '@/app/actions/storefront';
import { SystemSettingsData, DEFAULT_SYSTEM_SETTINGS } from '@/lib/settings-validation';
import { StorefrontHeader } from './StorefrontHeader';
import { StorefrontFooter } from './StorefrontFooter';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, ShoppingBag, Truck, MapPin, CreditCard, 
  Landmark, ShieldCheck, CheckCircle2, RefreshCw, Sparkles, 
  DollarSign, Phone, Mail, User, FileText, Copy, AlertCircle, MessageCircle 
} from 'lucide-react';
import { toast } from 'sonner';

interface StorefrontCheckoutClientProps {
  settings?: SystemSettingsData;
}

export function StorefrontCheckoutClient({ settings = DEFAULT_SYSTEM_SETTINGS }: StorefrontCheckoutClientProps) {
  const router = useRouter();
  const { items, getSubtotalArs, clearCart } = useCartStore();

  const subtotalArs = getSubtotalArs();
  const exchangeRate = 1200;
  const subtotalUsd = (subtotalArs / exchangeRate).toFixed(1);

  // Formulario del cliente
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientDni, setClientDni] = useState('');

  // Modalidad de entrega
  const [deliveryMethod, setDeliveryMethod] = useState<'shipping' | 'pickup'>('shipping');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingPostalCode, setShippingPostalCode] = useState('');
  const [shippingNotes, setShippingNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado al portapapeles`);
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError(null);

    if (items.length === 0) {
      toast.error('Tu bolsa de compras está vacía.');
      return;
    }

    if (!clientName.trim() || !clientPhone.trim()) {
      toast.error('Por favor completa tu nombre y número de WhatsApp.');
      return;
    }

    if (deliveryMethod === 'shipping' && !shippingAddress.trim()) {
      toast.error('Por favor ingresa la dirección para el envío a domicilio.');
      return;
    }

    try {
      setSubmitting(true);
      toast.info('Registrando pedido y preparando WhatsApp...');

      const payload = {
        client_name: clientName,
        client_phone: clientPhone,
        client_email: clientEmail || '',
        delivery_method: deliveryMethod,
        shipping_address: shippingAddress || '',
        shipping_city: shippingCity || '',
        shipping_postal_code: shippingPostalCode || '',
        shipping_notes: shippingNotes || '',
        items: items.map((i) => ({
          product_id: i.productId,
          quantity: i.quantity,
          format: i.format,
          unit_price_ars: i.priceArs,
        })),
      };

      const res = await createWhatsAppOrderAction(payload);

      if (res.success && res.orderId) {
        clearCart();
        toast.success('¡Pedido registrado con éxito! Abriendo WhatsApp...');

        // Abrir WhatsApp en pestaña nueva
        if (res.whatsAppUrl) {
          window.open(res.whatsAppUrl, '_blank');
        }

        router.push(`/tienda/pedido/${res.orderId}`);
      } else {
        const msg = res.error || 'No se pudo generar el pedido. Intenta nuevamente.';
        setOrderError(msg);
        toast.error(msg);
      }
    } catch (err: unknown) {
      console.error('Error al generar pedido:', err);
      const msg = err instanceof Error ? err.message : 'Error inesperado al procesar el pedido';
      setOrderError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#08130E] text-zinc-100 flex flex-col font-sans selection:bg-[#D0A96B]/30 selection:text-[#E5C158]">
      
      {/* HEADER */}
      <StorefrontHeader settings={settings} />

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 container mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-8">
        
        {/* BREADCRUMB */}
        <div className="flex items-center justify-between">
          <Link
            href="/tienda"
            className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-[#D0A96B] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver a la Tienda</span>
          </Link>
          <span className="text-xs font-mono text-[#D0A96B] font-bold">
            Checkout Seguro
          </span>
        </div>

        {items.length === 0 ? (
          <div className="py-24 text-center space-y-4 max-w-md mx-auto">
            <div className="h-16 w-16 rounded-full bg-[#13261E] border border-[#1B362A] flex items-center justify-center mx-auto text-zinc-600">
              <ShoppingBag className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">No tienes productos en tu carrito</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Agrega al menos un perfume o decant para continuar al checkout.
              </p>
            </div>
            <Link href="/tienda">
              <Button className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-bold text-xs">
                Ir al Catálogo
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmitOrder}>
            
            {/* ALERTA DE ERROR SI FALLA */}
            {orderError && (
              <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-start gap-3 shadow-lg">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-rose-300">
                    No se pudo completar el pedido
                  </div>
                  <p className="text-xs text-rose-200">{orderError}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* COLUMNA IZQUIERDA: FORMULARIOS (8 COLS) */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* 1. DATOS DEL CLIENTE */}
                <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl overflow-hidden">
                  <CardHeader className="border-b border-[#1B362A] p-5">
                    <CardTitle className="text-sm font-bold text-white font-serif flex items-center gap-2">
                      <User className="h-4 w-4 text-[#D0A96B]" />
                      1. Tus Datos de Contacto
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-400">
                      Información para coordinar la entrega y el seguimiento de tu pedido.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-300">
                          Nombre y Apellido *
                        </label>
                        <Input
                          required
                          placeholder="Ej. Juan Pérez"
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          className="bg-[#08130E] border-[#1B362A] text-white text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-300">
                          WhatsApp / Teléfono *
                        </label>
                        <Input
                          required
                          placeholder="Ej. +54 9 11 2345-6789"
                          value={clientPhone}
                          onChange={(e) => setClientPhone(e.target.value)}
                          className="bg-[#08130E] border-[#1B362A] text-white text-xs font-mono"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-300">
                          Correo Electrónico (Opcional)
                        </label>
                        <Input
                          type="email"
                          placeholder="juan@ejemplo.com"
                          value={clientEmail}
                          onChange={(e) => setClientEmail(e.target.value)}
                          className="bg-[#08130E] border-[#1B362A] text-white text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-300">
                          DNI o CUIT (Opcional)
                        </label>
                        <Input
                          placeholder="Ej. 38450123"
                          value={clientDni}
                          onChange={(e) => setClientDni(e.target.value)}
                          className="bg-[#08130E] border-[#1B362A] text-white text-xs font-mono"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 2. FORMA DE ENTREGA */}
                <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl overflow-hidden">
                  <CardHeader className="border-b border-[#1B362A] p-5">
                    <CardTitle className="text-sm font-bold text-white font-serif flex items-center gap-2">
                      <Truck className="h-4 w-4 text-[#D0A96B]" />
                      2. Modalidad de Entrega
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-400">
                      Elige si prefieres envío a tu domicilio o retirar en nuestro showroom.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      
                      {/* ENVÍO A DOMICILIO */}
                      <button
                        type="button"
                        onClick={() => setDeliveryMethod('shipping')}
                        className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                          deliveryMethod === 'shipping'
                            ? 'bg-[#1B362A] border-[#D0A96B] text-white shadow-md'
                            : 'bg-[#08130E] border-[#1B362A] text-zinc-400 hover:border-zinc-500'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-xs text-white">
                          <span className="flex items-center gap-1.5">
                            <Truck className="h-4 w-4 text-[#D0A96B]" /> Envío a Domicilio
                          </span>
                          {deliveryMethod === 'shipping' && <CheckCircle2 className="h-4 w-4 text-[#D0A96B]" />}
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-1">
                          Despacho a todo el país vía correo/encomienda.
                        </p>
                      </button>

                      {/* RETIRO EN SHOWROOM */}
                      <button
                        type="button"
                        onClick={() => setDeliveryMethod('pickup')}
                        className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                          deliveryMethod === 'pickup'
                            ? 'bg-[#1B362A] border-[#D0A96B] text-white shadow-md'
                            : 'bg-[#08130E] border-[#1B362A] text-zinc-400 hover:border-zinc-500'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-xs text-white">
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4 text-emerald-400" /> Retiro en Local
                          </span>
                          {deliveryMethod === 'pickup' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-1">
                          Sin cargo en nuestro showroom.
                        </p>
                      </button>

                    </div>

                    {/* CAMPOS DE DIRECCIÓN SI ES ENVÍO */}
                    {deliveryMethod === 'shipping' ? (
                      <div className="pt-2 space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-zinc-300">
                            Dirección de Entrega (Calle, Número, Piso/Depto) *
                          </label>
                          <Input
                            required
                            placeholder="Ej. Av. Corrientes 1234, Piso 4 B"
                            value={shippingAddress}
                            onChange={(e) => setShippingAddress(e.target.value)}
                            className="bg-[#08130E] border-[#1B362A] text-white text-xs"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-xs font-bold text-zinc-300">
                              Ciudad / Localidad *
                            </label>
                            <Input
                              required={deliveryMethod === 'shipping'}
                              placeholder="Ej. Córdoba Capital / Rosario"
                              value={shippingCity}
                              onChange={(e) => setShippingCity(e.target.value)}
                              className="bg-[#08130E] border-[#1B362A] text-white text-xs"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-zinc-300">
                              Código Postal
                            </label>
                            <Input
                              placeholder="Ej. 5000"
                              value={shippingPostalCode}
                              onChange={(e) => setShippingPostalCode(e.target.value)}
                              className="bg-[#08130E] border-[#1B362A] text-white text-xs font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-[#08130E] border border-[#1B362A] text-xs text-zinc-300 space-y-1">
                        <div className="font-bold text-[#D0A96B] flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" /> Dirección de Retiro:
                        </div>
                        <p>{settings.address || 'Chaco 50'} {settings.city ? `(${settings.city})` : ''}</p>
                        <p className="text-[11px] text-zinc-400 pt-1">
                          Te avisaremos por WhatsApp en cuanto tu fragancia esté empaquetada.
                        </p>
                      </div>
                    )}

                  </CardContent>
                </Card>

                {/* 3. ATENCIÓN PERSONALIZADA Y CIERRE POR WHATSAPP */}
                <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl overflow-hidden">
                  <CardHeader className="border-b border-[#1B362A] p-5">
                    <CardTitle className="text-sm font-bold text-white font-serif flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-emerald-400" />
                      3. Cierre y Coordinación por WhatsApp 📲
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-400">
                      Atención boutique personalizada sin pasarelas de pago engorrosas.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-5 space-y-4">
                    <div className="p-4 rounded-xl bg-[#08130E] border border-emerald-500/30 text-xs space-y-2">
                      <div className="font-bold text-emerald-400 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>¿Cómo finaliza tu compra?</span>
                      </div>
                      <p className="text-zinc-300 leading-relaxed text-[11px]">
                        Al presionar el botón <strong className="text-emerald-400">"Finalizar Pedido por WhatsApp 📲"</strong>, registraremos tu orden en el ERP y se abrirá WhatsApp con el resumen listo para enviar al número oficial de <strong className="text-white">{settings.trade_name}</strong>.
                      </p>
                      <p className="text-zinc-400 text-[11px]">
                        Por ese medio coordinaremos el medio de pago (<strong className="text-zinc-200">Transferencia Bancaria</strong> o <strong className="text-zinc-200">Efectivo contra entrega</strong>) y los tiempos exactos de despacho.
                      </p>
                    </div>

                    {/* DATOS DE TRANSFERENCIA BANCARIA INFORMATIVOS */}
                    {settings.bank_alias && (
                      <div className="p-4 rounded-xl bg-gradient-to-br from-[#1B362A]/60 to-[#08130E] border border-[#D0A96B]/40 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#D0A96B] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                            <Landmark className="h-3.5 w-3.5" /> Datos para Transferencia (Opcional):
                          </span>
                          <span className="text-[10px] font-mono text-zinc-400">
                            {settings.bank_name || 'Banco'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-[#1B362A]">
                          <div>
                            <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Alias:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-[#E5C158] text-sm">
                                {settings.bank_alias}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(settings.bank_alias || '', 'Alias')}
                                className="text-zinc-400 hover:text-white p-1 cursor-pointer"
                                title="Copiar Alias"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {settings.bank_account_holder && (
                            <div>
                              <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Titular:</span>
                              <span className="font-bold text-white text-xs">
                                {settings.bank_account_holder}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5 pt-1">
                      <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-[#D0A96B]" />
                        <span>Notas u Observaciones adicionales (Opcional):</span>
                      </label>
                      <Input
                        placeholder="Ej. Horario de entrega preferido / Aclaraciones de packaging"
                        value={shippingNotes}
                        onChange={(e) => setShippingNotes(e.target.value)}
                        className="bg-[#08130E] border-[#1B362A] text-white text-xs"
                      />
                    </div>
                  </CardContent>
                </Card>

              </div>

              {/* COLUMNA DERECHA: RESUMEN DE COMPRA (5 COLS) */}
              <div className="lg:col-span-5 space-y-6">
                
                <Card className="border border-[#1B362A] bg-[#13261E] rounded-2xl shadow-xl sticky top-24">
                  <CardHeader className="border-b border-[#1B362A] p-5">
                    <CardTitle className="text-sm font-bold text-white font-serif flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-[#D0A96B]" />
                      Resumen del Pedido
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="p-5 space-y-4">
                    
                    {/* ITEMS DEL PEDIDO */}
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                      {items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 text-xs pb-2 border-b border-[#1B362A]/60">
                          <div>
                            <div className="font-bold text-white font-serif">{item.name}</div>
                            <div className="text-[10px] text-zinc-400 font-mono">
                              {item.quantity}x {item.format}
                            </div>
                          </div>
                          <span className="font-mono font-bold text-white shrink-0">
                            ${(item.priceArs * item.quantity).toLocaleString('es-AR')}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* TOTALES */}
                    <div className="space-y-2 pt-2">
                      <div className="flex justify-between text-xs text-zinc-400">
                        <span>Subtotal:</span>
                        <span className="font-mono text-white font-bold">${subtotalArs.toLocaleString('es-AR')} ARS</span>
                      </div>
                      <div className="flex justify-between text-xs text-zinc-400">
                        <span>Envío:</span>
                        <span className="text-emerald-400 font-semibold">
                          {deliveryMethod === 'pickup' ? 'Gratis (Retiro en Local)' : 'A coordinar'}
                        </span>
                      </div>
                      <div className="flex justify-between text-base pt-3 border-t border-[#1B362A] font-bold">
                        <span className="text-white uppercase tracking-wider text-xs">Total a Pagar:</span>
                        <div className="text-right">
                          <div className="font-mono text-lg font-black text-[#D0A96B]">
                            ${subtotalArs.toLocaleString('es-AR')} ARS
                          </div>
                          <div className="text-[10px] font-mono text-zinc-400">
                            ~ u$s {subtotalUsd}
                          </div>
                        </div>
                      </div>
                    </div>

                  </CardContent>

                  <CardFooter className="p-5 border-t border-[#1B362A] bg-[#08130E]/60 flex flex-col gap-3">
                    <Button
                      type="submit"
                      disabled={submitting || items.length === 0}
                      className="w-full h-14 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-sm uppercase tracking-wider cursor-pointer shadow-xl shadow-emerald-600/25 flex items-center justify-center gap-2 rounded-xl transition-all"
                    >
                      {submitting ? (
                        <>
                          <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Procesando Pedido...
                        </>
                      ) : (
                        <>
                          <MessageCircle className="mr-2 h-5 w-5 fill-current" /> Finalizar Pedido por WhatsApp 📲
                        </>
                      )}
                    </Button>

                    <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-400">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Compra 100% segura y directa con {settings.trade_name}.</span>
                    </div>
                  </CardFooter>
                </Card>

              </div>

            </div>
          </form>
        )}

      </main>

      {/* FOOTER */}
      <StorefrontFooter settings={settings} />

    </div>
  );
}
