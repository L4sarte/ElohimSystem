'use client';

import React, { useState } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { updateSaleShipping, ShippingUpdateInput } from '@/app/actions/sales';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Truck, ExternalLink, RefreshCw, Check, PackageCheck, Clock, MapPin } from 'lucide-react';
import { toast } from 'sonner';

export interface ShippingManagerProps {
  saleId: string;
  initialProvider?: string;
  initialTracking?: string;
  initialStatus?: 'pending' | 'shipped' | 'delivered';
  onUpdateSuccess?: () => void;
  compact?: boolean;
}

export function ShippingManager({
  saleId,
  initialProvider = 'Ninguno',
  initialTracking = '',
  initialStatus = 'pending',
  onUpdateSuccess,
  compact = false
}: ShippingManagerProps) {
  const { role } = useUserStore();

  const [provider, setProvider] = useState<string>(initialProvider || 'Ninguno');
  const [trackingNumber, setTrackingNumber] = useState<string>(initialTracking || '');
  const [status, setStatus] = useState<'pending' | 'shipped' | 'delivered'>(initialStatus || 'pending');
  const [saving, setSaving] = useState(false);

  // Helper para generar URL dinámica de rastreo
  const getTrackingUrl = (prov: string, code: string): string => {
    const cleanCode = code.trim();
    if (!cleanCode) return '#';

    const provLower = prov.toLowerCase();
    if (provLower.includes('andreani')) {
      return `https://seguimiento.andreani.com/envio/${cleanCode}`;
    }
    if (provLower.includes('correo') || provLower.includes('argentino')) {
      return `https://www.correoargentino.com.ar/formularios/ondeliv?id=${cleanCode}`;
    }
    return `https://www.google.com/search?q=${encodeURIComponent(`Seguimiento ${prov} ${cleanCode}`)}`;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const input: ShippingUpdateInput = {
      shipping_provider: provider,
      tracking_number: trackingNumber,
      shipping_status: status
    };

    const res = await updateSaleShipping(role, saleId, input);
    setSaving(false);

    if (res.success) {
      toast.success('Información de envío y rastreo actualizada');
      if (onUpdateSuccess) onUpdateSuccess();
    } else {
      toast.error(res.error || 'Error al guardar datos de envío');
    }
  };

  const trackingUrl = getTrackingUrl(provider, trackingNumber);

  return (
    <Card className="border border-[#1B362A] bg-[#13261E] rounded-2xl shadow-xl overflow-hidden">
      <CardHeader className="pb-3 border-b border-[#1B362A] bg-[#08130E]/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold text-white font-serif flex items-center gap-2">
            <Truck className="h-4.5 w-4.5 text-[#D0A96B]" />
            Gestión Logística & Envíos
          </CardTitle>

          {/* Badge de Estado del Envío */}
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold font-mono border ${
            status === 'delivered'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : status === 'shipped'
              ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
          }`}>
            {status === 'delivered' && <PackageCheck className="h-3 w-3" />}
            {status === 'shipped' && <Truck className="h-3 w-3" />}
            {status === 'pending' && <Clock className="h-3 w-3" />}
            {status === 'delivered' ? 'Entregado' : status === 'shipped' ? 'Despachado' : 'Pendiente'}
          </span>
        </div>
        {!compact && (
          <CardDescription className="text-xs text-zinc-400">
            Asigna el proveedor de logística, código de seguimiento y actualiza el estado del paquete.
          </CardDescription>
        )}
      </CardHeader>

      <form onSubmit={handleSave}>
        <CardContent className="p-4 space-y-3">
          
          {/* GRID DE FORMULARIO */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* PROVEEDOR LOGÍSTICO */}
            <div className="space-y-1">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">
                Empresa de Transporte
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-[#1B362A] bg-[#08130E] px-3 py-1 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-[#D0A96B]"
              >
                <option value="Ninguno">🚫 Sin Envío (Retiro en Local)</option>
                <option value="Andreani">🚚 Andreani</option>
                <option value="Correo Argentino">📦 Correo Argentino</option>
                <option value="Cadetería">🛵 Cadetería / Mensajería Local</option>
              </select>
            </div>

            {/* ESTADO DEL ENVÍO */}
            <div className="space-y-1">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">
                Estado del Envío
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="flex h-9 w-full rounded-lg border border-[#1B362A] bg-[#08130E] px-3 py-1 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-[#D0A96B]"
              >
                <option value="pending">⏳ Pendiente de Despacho</option>
                <option value="shipped">🚚 Despachado / En Tránsito</option>
                <option value="delivered">✅ Entregado al Cliente</option>
              </select>
            </div>
          </div>

          {/* CÓDIGO DE SEGUIMIENTO */}
          <div className="space-y-1">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">
              Número de Seguimiento (Tracking ID)
            </label>
            <Input
              type="text"
              placeholder="Ej: AND123456789AR"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="bg-[#08130E] border-[#1B362A] text-white font-mono text-xs font-bold"
            />
          </div>

          {/* BOTÓN DE RASTREO DINÁMICO */}
          {trackingNumber.trim() !== '' && (
            <div className="pt-1">
              <a
                href={trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 text-xs font-bold transition-all"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Rastrear Encomienda en {provider || 'Línea'}
              </a>
            </div>
          )}

        </CardContent>

        <CardFooter className="border-t border-[#1B362A] bg-[#08130E]/30 px-4 py-3 flex justify-end">
          <Button
            type="submit"
            disabled={saving}
            className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold text-xs shadow-md shadow-[#D0A96B]/20 cursor-pointer h-8"
          >
            {saving ? (
              <>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Guardando...
              </>
            ) : (
              <>
                <Check className="mr-1.5 h-3.5 w-3.5" /> Actualizar Logística
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
