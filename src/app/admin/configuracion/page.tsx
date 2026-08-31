'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useUserStore } from '@/hooks/use-user-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, Settings, ShieldAlert, Sliders, Save, 
  RefreshCw, Sparkles, Building, FileText, Bell, CheckCircle2 
} from 'lucide-react';
import { toast } from 'sonner';
import { getSystemSettings, updateSystemSettings, SystemSettingsData } from '@/app/actions/systemSettings';

export default function ConfiguracionPage() {
  const { role } = useUserStore();
  const { refresh: refreshRate } = useExchangeRate();

  const [storeName, setStoreName] = useState('');
  const [receiptFooterText, setReceiptFooterText] = useState('');
  const [enableAutoStockAlerts, setEnableAutoStockAlerts] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    const res = await getSystemSettings();
    if (res.success && res.data) {
      setStoreName(res.data.store_name);
      setReceiptFooterText(res.data.receipt_footer_text);
      setEnableAutoStockAlerts(res.data.enable_auto_stock_alerts);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) {
      toast.error('El nombre de la tienda es obligatorio.');
      return;
    }

    setSaving(true);
    const res = await updateSystemSettings(role, {
      store_name: storeName,
      receipt_footer_text: receiptFooterText,
      enable_auto_stock_alerts: enableAutoStockAlerts
    });
    setSaving(false);

    if (res.success) {
      toast.success('Configuración guardada exitosamente');
      fetchSettings();
    } else {
      toast.error(res.error || 'Error al guardar la configuración');
    }
  };

  if (role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#08130E] flex flex-col items-center justify-center text-center p-4">
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 max-w-md space-y-3 shadow-xl">
          <ShieldAlert className="h-10 w-10 mx-auto" />
          <h2 className="text-lg font-bold">Acceso Restringido</h2>
          <p className="text-xs text-zinc-400">La configuración del sistema es exclusiva para administradores.</p>
          <Link href="/">
            <Button variant="outline" className="mt-2 border-[#1B362A] text-zinc-300">
              Volver al Inicio
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#08130E] text-zinc-50 transition-colors duration-300">
      
      {/* NAVBAR GLASSMORPHISM */}
      <header className="sticky top-0 z-40 w-full border-b border-[#1B362A] bg-[#08130E]/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 max-w-7xl">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
              <span>Inicio</span>
            </Link>
            <span className="text-zinc-800">|</span>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#13261E] border border-[#1B362A] text-zinc-300">
                <Settings className="h-4.5 w-4.5" />
              </div>
              <span className="text-sm font-bold tracking-tight text-white uppercase font-serif">
                Configuración del Sistema
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <RoleSelector />
            <ExchangeRateWidget role={role} onRateChange={refreshRate} />
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 container mx-auto px-4 py-8 sm:px-6 max-w-4xl space-y-6">
        
        {/* ENCABEZADO */}
        <div className="bg-[#13261E] p-6 rounded-2xl border border-[#1B362A] shadow-xl">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#D0A96B] flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" /> Parámetros Generales ERP
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white font-serif mt-1">
            Configuración del Sistema
          </h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl">
            Personaliza los datos de tu perfumería, texto de tickets de venta y comportamiento de las alertas automáticas.
          </p>
        </div>

        {/* FORMULARIO DE CONFIGURACIÓN */}
        {loading ? (
          <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl p-12 text-center shadow-xl">
            <RefreshCw className="h-8 w-8 animate-spin text-[#D0A96B] mx-auto mb-3" />
            <span className="text-sm font-medium text-zinc-400">Cargando parámetros de configuración...</span>
          </Card>
        ) : (
          <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl overflow-hidden">
            <form onSubmit={handleSubmit}>
              
              <CardHeader className="border-b border-[#1B362A] p-6">
                <CardTitle className="text-lg font-bold text-white font-serif flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-[#D0A96B]" />
                  Ajustes Globales del Negocio
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Los valores guardados se aplicarán de inmediato a los comprobantes impresos y las vistas del sistema.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                
                {/* NOMBRE DE LA TIENDA */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                    <Building className="h-4 w-4 text-[#D0A96B]" />
                    Nombre de la Tienda (store_name) *
                  </label>
                  <Input
                    required
                    placeholder="Ej. Elohim Perfumería & Decants"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    disabled={saving}
                    className="bg-[#08130E] border-[#1B362A] text-white font-semibold focus:ring-1 focus:ring-[#D0A96B] disabled:opacity-50"
                  />
                  <p className="text-[11px] text-zinc-400">
                    Nombre oficial del establecimiento mostrado en la cabecera de tickets y reportes.
                  </p>
                </div>

                {/* TEXTO DE PIE DE PÁGINA DE TICKET */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-indigo-400" />
                    Texto del Pie de Página del Ticket (receipt_footer_text)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ej. ¡Gracias por elegir Elohim Perfumería! Conserva este ticket para cambios de producto."
                    value={receiptFooterText}
                    onChange={(e) => setReceiptFooterText(e.target.value)}
                    disabled={saving}
                    className="w-full rounded-lg border border-[#1B362A] bg-[#08130E] p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#D0A96B] leading-relaxed disabled:opacity-50"
                  />
                  <p className="text-[11px] text-zinc-400">
                    Mensaje o política de cambios al final de cada ticket impreso o digital.
                  </p>
                </div>

                {/* SWITCH DE ALERTAS AUTOMÁTICAS DE STOCK */}
                <div className="p-4 rounded-xl bg-[#08130E] border border-[#1B362A] flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                      <Bell className="h-4 w-4 text-amber-400" />
                      Alertas Automáticas de Stock (enable_auto_stock_alerts)
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Notificar cuando los productos o decants alcancen el umbral de stock mínimo.
                    </p>
                  </div>

                  {/* Switch toggle custom */}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setEnableAutoStockAlerts(!enableAutoStockAlerts)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                      enableAutoStockAlerts ? 'bg-emerald-500' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        enableAutoStockAlerts ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

              </CardContent>

              <CardFooter className="border-t border-[#1B362A] p-6 bg-[#08130E]/60 flex items-center justify-end">
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-black text-xs cursor-pointer shadow-lg shadow-[#D0A96B]/20 px-6 py-2.5"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" /> Guardar Cambios
                    </>
                  )}
                </Button>
              </CardFooter>

            </form>
          </Card>
        )}

      </main>

    </div>
  );
}
