'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useUserStore } from '@/hooks/use-user-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, Settings, ShieldAlert, Save, RefreshCw, Sparkles, Building, 
  FileText, Bell, CheckCircle2, Upload, Image as ImageIcon, Phone, Mail, 
  MapPin, Globe, AtSign, Landmark, CreditCard, Receipt, ShieldCheck, Crown, Copy
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  updateSystemSettings, 
  uploadCompanyLogo 
} from '@/app/actions/systemSettings';
import { 
  SystemSettingsData,
  DEFAULT_SYSTEM_SETTINGS 
} from '@/lib/settings-validation';

interface ConfiguracionClientProps {
  initialSettings?: SystemSettingsData;
}

export function ConfiguracionClient({ initialSettings = DEFAULT_SYSTEM_SETTINGS }: ConfiguracionClientProps) {
  const { role } = useUserStore();
  const { refresh: refreshRate } = useExchangeRate();

  const [activeTab, setActiveTab] = useState<'branding' | 'contact' | 'pos' | 'banking'>('branding');
  const [settings, setSettings] = useState<SystemSettingsData>(initialSettings);

  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (field: keyof SystemSettingsData, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('El logotipo supera el tamaño máximo de 2MB.');
      return;
    }

    try {
      setUploadingLogo(true);
      toast.info('Subiendo logotipo oficial...');
      const formData = new FormData();
      formData.append('file', file);

      const res = await uploadCompanyLogo(formData);
      if (res.success && res.url) {
        handleChange('logo_url', res.url);
        toast.success('Logotipo cargado exitosamente');
      } else {
        toast.error(res.error || 'Error al subir el logotipo');
      }
    } catch (err: unknown) {
      console.error('Error al subir logotipo:', err);
      toast.error('Ocurrió un error inesperado al subir la imagen.');
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!settings.trade_name.trim()) {
      toast.error('El nombre comercial es obligatorio.');
      setErrorMessage('El nombre comercial / de fantasía no puede estar vacío.');
      return;
    }

    setSaving(true);
    const res = await updateSystemSettings({
      ...settings,
      store_name: settings.trade_name,
    });
    setSaving(false);

    if (res.success) {
      setErrorMessage(null);
      toast.success('¡Configuración global guardada exitosamente!');
    } else {
      const err = res.error || 'Error al guardar la configuración';
      setErrorMessage(err);
      toast.error(err, { duration: 6000 });
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado al portapapeles`);
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
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 max-w-6xl">
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
      <main className="flex-1 container mx-auto px-4 py-8 sm:px-6 max-w-5xl space-y-6">
        
        {/* ENCABEZADO */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#13261E] p-6 rounded-2xl border border-[#1B362A] shadow-xl">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#D0A96B] flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Parámetros Globales & Branding
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white font-serif mt-1">
              Identidad de Empresa & Parámetros Operativos
            </h1>
            <p className="text-xs text-zinc-400 mt-1 max-w-xl">
              Configura el nombre comercial, logotipo oficial, tickets de venta, canales de cobro y umbrales de stock.
            </p>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-black text-xs cursor-pointer shadow-lg shadow-[#D0A96B]/20 px-6 py-2.5 shrink-0 self-start sm:self-auto"
          >
            {saving ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Guardando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> Guardar Todos los Cambios
              </>
            )}
          </Button>
        </div>

        {/* ALERTA DE ERROR VISIBLE SI FALLA EL GUARDADO */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-start gap-3 shadow-lg animate-in fade-in duration-200">
            <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-rose-300">
                Fallo al persistir la configuración
              </div>
              <p className="text-xs text-rose-200 font-mono leading-relaxed">
                {errorMessage}
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">
                Si el error indica que faltan columnas en la base de datos, ejecuta la migración SQL provista en el SQL Editor de Supabase.
              </p>
            </div>
          </div>
        )}

        {/* SELECTOR DE PESTAÑAS */}
        <div className="flex rounded-2xl bg-[#13261E] border border-[#1B362A] p-1.5 gap-1.5 overflow-x-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('branding')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer shrink-0 ${
              activeTab === 'branding'
                ? 'bg-[#1B362A] text-[#D0A96B] border border-[#D0A96B]/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Crown className="h-4 w-4" />
            <span>Identidad & Branding</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('contact')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer shrink-0 ${
              activeTab === 'contact'
                ? 'bg-[#1B362A] text-[#D0A96B] border border-[#D0A96B]/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <MapPin className="h-4 w-4" />
            <span>Contacto & Sucursal</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pos')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer shrink-0 ${
              activeTab === 'pos'
                ? 'bg-[#1B362A] text-[#D0A96B] border border-[#D0A96B]/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Receipt className="h-4 w-4" />
            <span>Punto de Venta (POS) & Tickets</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('banking')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer shrink-0 ${
              activeTab === 'banking'
                ? 'bg-[#1B362A] text-[#D0A96B] border border-[#D0A96B]/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Landmark className="h-4 w-4" />
            <span>Datos Bancarios (Transferencias)</span>
          </button>
        </div>

        {/* FORMULARIO PRINCIPAL */}
        <form onSubmit={handleSubmit}>
          
          {/* PESTAÑA 1: IDENTIDAD & BRANDING */}
          {activeTab === 'branding' && (
            <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-200">
              <CardHeader className="border-b border-[#1B362A] p-6">
                <CardTitle className="text-lg font-bold text-white font-serif flex items-center gap-2">
                  <Crown className="h-5 w-5 text-[#D0A96B]" />
                  Identidad Corporativa y Logotipo
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Define la presencia visual de la marca reflejada en tickets impresos, reportes PDF y paneles.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                
                {/* UPLOADER DE LOGO CON PREVIEW */}
                <div className="p-5 rounded-xl bg-[#08130E] border border-[#1B362A] space-y-4">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-[#D0A96B]" />
                    Logotipo Oficial de la Empresa (logo_url)
                  </label>

                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    {/* CAJA PREVIEW DARK/LIGHT */}
                    <div className="flex items-center gap-4">
                      <div className="h-20 w-36 rounded-xl bg-[#13261E] border border-[#1B362A] flex items-center justify-center p-2 overflow-hidden shadow-inner">
                        {settings.logo_url ? (
                          <img
                            src={settings.logo_url}
                            alt="Logo Oficial"
                            className="max-h-full max-w-full object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-zinc-600" />
                        )}
                      </div>

                      <div className="h-20 w-36 rounded-xl bg-white border border-zinc-300 flex items-center justify-center p-2 overflow-hidden shadow-inner">
                        {settings.logo_url ? (
                          <img
                            src={settings.logo_url}
                            alt="Logo Oficial Light"
                            className="max-h-full max-w-full object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-zinc-400" />
                        )}
                      </div>
                    </div>

                    {/* BOTÓN DE CARGA */}
                    <div className="flex-1 space-y-2 text-center sm:text-left">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                        onChange={handleLogoUpload}
                        className="hidden"
                        disabled={saving || uploadingLogo}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={saving || uploadingLogo}
                        className="border-[#D0A96B]/40 bg-[#13261E] text-xs font-bold text-[#E5C158] hover:bg-zinc-800 cursor-pointer"
                      >
                        {uploadingLogo ? (
                          <>
                            <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> Subiendo imagen...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-3.5 w-3.5" /> Seleccionar Imagen (PNG, JPG, SVG, WebP)
                          </>
                        )}
                      </Button>
                      <p className="text-[11px] text-zinc-400">
                        Recomendado: Imagen en formato PNG transparente de hasta 2MB (ej: 400x120 px).
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* RAZÓN SOCIAL */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                      <Building className="h-4 w-4 text-[#D0A96B]" />
                      Razón Social / Empresa Legal (company_name) *
                    </label>
                    <Input
                      required
                      placeholder="Ej. Elohim Import S.R.L."
                      value={settings.company_name}
                      onChange={(e) => handleChange('company_name', e.target.value)}
                      disabled={saving}
                      className="bg-[#08130E] border-[#1B362A] text-white font-semibold focus:ring-1 focus:ring-[#D0A96B]"
                    />
                    <p className="text-[11px] text-zinc-400">
                      Nombre legal utilizado en encabezados contables y reportes impositivos.
                    </p>
                  </div>

                  {/* NOMBRE COMERCIAL */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                      <Crown className="h-4 w-4 text-[#D0A96B]" />
                      Nombre Comercial / Marca de Fantasía (trade_name) *
                    </label>
                    <Input
                      required
                      placeholder="Ej. Elohim Perfumería & Decants"
                      value={settings.trade_name}
                      onChange={(e) => {
                        handleChange('trade_name', e.target.value);
                        handleChange('store_name', e.target.value);
                      }}
                      disabled={saving}
                      className="bg-[#08130E] border-[#1B362A] text-white font-semibold focus:ring-1 focus:ring-[#D0A96B]"
                    />
                    <p className="text-[11px] text-zinc-400">
                      Nombre público visible en la cabecera de la tienda, POS y Sidebar.
                    </p>
                  </div>

                  {/* SLOGAN / LEMA */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-400" />
                      Slogan o Lema Comercial (slogan)
                    </label>
                    <Input
                      placeholder="Ej. Alta Perfumería de Nicho & Decants Fraccionados"
                      value={settings.slogan}
                      onChange={(e) => handleChange('slogan', e.target.value)}
                      disabled={saving}
                      className="bg-[#08130E] border-[#1B362A] text-white focus:ring-1 focus:ring-[#D0A96B]"
                    />
                  </div>

                  {/* CUIT / TAX ID */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-indigo-400" />
                      CUIT / Identificación Fiscal (cuit_tax_id)
                    </label>
                    <Input
                      placeholder="Ej. 30-71829384-9"
                      value={settings.cuit_tax_id}
                      onChange={(e) => handleChange('cuit_tax_id', e.target.value)}
                      disabled={saving}
                      className="bg-[#08130E] border-[#1B362A] text-white font-mono focus:ring-1 focus:ring-[#D0A96B]"
                    />
                  </div>
                </div>

              </CardContent>
            </Card>
          )}

          {/* PESTAÑA 2: CONTACTO & SUCURSAL */}
          {activeTab === 'contact' && (
            <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-200">
              <CardHeader className="border-b border-[#1B362A] p-6">
                <CardTitle className="text-lg font-bold text-white font-serif flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-[#D0A96B]" />
                  Datos de Contacto, Sucursal y Redes Sociales
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Información de atención al cliente y ubicación física mostrada en comprobantes y catálogo público.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  
                  {/* TELÉFONO / WHATSAPP */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                      <Phone className="h-4 w-4 text-emerald-400" />
                      Teléfono / WhatsApp de Atención (phone)
                    </label>
                    <Input
                      placeholder="Ej. +54 9 11 5555-0199"
                      value={settings.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      disabled={saving}
                      className="bg-[#08130E] border-[#1B362A] text-white font-mono focus:ring-1 focus:ring-[#D0A96B]"
                    />
                  </div>

                  {/* EMAIL */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                      <Mail className="h-4 w-4 text-sky-400" />
                      Email de Contacto (email)
                    </label>
                    <Input
                      type="email"
                      placeholder="Ej. contacto@elohimimport.com"
                      value={settings.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      disabled={saving}
                      className="bg-[#08130E] border-[#1B362A] text-white focus:ring-1 focus:ring-[#D0A96B]"
                    />
                  </div>

                  {/* DIRECCIÓN */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[#D0A96B]" />
                      Dirección del Local / Showroom (address)
                    </label>
                    <Input
                      placeholder="Ej. Av. Santa Fe 1234, Local 12"
                      value={settings.address}
                      onChange={(e) => handleChange('address', e.target.value)}
                      disabled={saving}
                      className="bg-[#08130E] border-[#1B362A] text-white focus:ring-1 focus:ring-[#D0A96B]"
                    />
                  </div>

                  {/* CIUDAD */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                      <Globe className="h-4 w-4 text-indigo-400" />
                      Ciudad / Provincia (city)
                    </label>
                    <Input
                      placeholder="Ej. CABA, Buenos Aires"
                      value={settings.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                      disabled={saving}
                      className="bg-[#08130E] border-[#1B362A] text-white focus:ring-1 focus:ring-[#D0A96B]"
                    />
                  </div>

                  {/* INSTAGRAM */}
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                      <AtSign className="h-4 w-4 text-pink-400" />
                      Usuario de Instagram (instagram_handle)
                    </label>
                    <Input
                      placeholder="Ej. @elohim.perfumes"
                      value={settings.instagram_handle}
                      onChange={(e) => handleChange('instagram_handle', e.target.value)}
                      disabled={saving}
                      className="bg-[#08130E] border-[#1B362A] text-white focus:ring-1 focus:ring-[#D0A96B]"
                    />
                  </div>

                </div>
              </CardContent>
            </Card>
          )}

          {/* PESTAÑA 3: PUNTO DE VENTA & TICKETS */}
          {activeTab === 'pos' && (
            <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-200">
              <CardHeader className="border-b border-[#1B362A] p-6">
                <CardTitle className="text-lg font-bold text-white font-serif flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-[#D0A96B]" />
                  Punto de Venta, Tickets y Reglas de Inventario
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Ajusta los textos impresos en la comanda térmica y el comportamiento de alertas automáticas.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                
                {/* ENCABEZADO DE TICKET */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#D0A96B]" />
                    Leyenda de Cabecera del Ticket (receipt_header)
                  </label>
                  <Input
                    placeholder="Ej. DOCUMENTO NO VÁLIDO COMO FACTURA"
                    value={settings.receipt_header}
                    onChange={(e) => handleChange('receipt_header', e.target.value)}
                    disabled={saving}
                    className="bg-[#08130E] border-[#1B362A] text-white font-semibold focus:ring-1 focus:ring-[#D0A96B]"
                  />
                  <p className="text-[11px] text-zinc-400">
                    Leyenda legal destacada en la cabecera del comprobante térmico.
                  </p>
                </div>

                {/* PIE DE PÁGINA DE TICKET */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-indigo-400" />
                    Mensaje de Pie de Página del Ticket (receipt_footer_message)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ej. ¡Gracias por elegir Elohim Perfumería! Conserva este ticket para cambios de producto."
                    value={settings.receipt_footer_message}
                    onChange={(e) => {
                      handleChange('receipt_footer_message', e.target.value);
                      handleChange('receipt_footer_text', e.target.value);
                    }}
                    disabled={saving}
                    className="w-full rounded-lg border border-[#1B362A] bg-[#08130E] p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#D0A96B] leading-relaxed disabled:opacity-50"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* DÍAS DE POLÍTICA DE CAMBIO */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                      Plazo de Garantía / Cambios en Días (warranty_policy_days)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={365}
                      value={settings.warranty_policy_days}
                      onChange={(e) => handleChange('warranty_policy_days', parseInt(e.target.value, 10) || 0)}
                      disabled={saving}
                      className="bg-[#08130E] border-[#1B362A] text-white font-mono focus:ring-1 focus:ring-[#D0A96B]"
                    />
                    <p className="text-[11px] text-zinc-400">
                      Cantidad de días hábiles/corridos permitidos para cambios de mercadería.
                    </p>
                  </div>

                  {/* UMBRAL DE STOCK MÍNIMO POR DEFECTO */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                      <Bell className="h-4 w-4 text-amber-400" />
                      Umbral Mínimo de Alerta de Stock (default_min_stock_alert)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={settings.default_min_stock_alert}
                      onChange={(e) => handleChange('default_min_stock_alert', parseInt(e.target.value, 10) || 0)}
                      disabled={saving}
                      className="bg-[#08130E] border-[#1B362A] text-white font-mono focus:ring-1 focus:ring-[#D0A96B]"
                    />
                    <p className="text-[11px] text-zinc-400">
                      Nivel de existencias a partir del cual el ERP marcará un SKU en Stock Crítico.
                    </p>
                  </div>
                </div>

                {/* SWITCH DE ALERTAS AUTOMÁTICAS */}
                <div className="p-4 rounded-xl bg-[#08130E] border border-[#1B362A] flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                      <Bell className="h-4 w-4 text-amber-400" />
                      Habilitar Alertas Automáticas de Stock
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Mostrar notificaciones en tiempo real en el Dashboard y en el catálogo.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleChange('enable_auto_stock_alerts', !settings.enable_auto_stock_alerts)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                      settings.enable_auto_stock_alerts ? 'bg-emerald-500' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        settings.enable_auto_stock_alerts ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

              </CardContent>
            </Card>
          )}

          {/* PESTAÑA 4: DATOS BANCARIOS (TRANSFERENCIAS) */}
          {activeTab === 'banking' && (
            <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-200">
              <CardHeader className="border-b border-[#1B362A] p-6">
                <CardTitle className="text-lg font-bold text-white font-serif flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-[#D0A96B]" />
                  Cuentas Bancarias Oficiales para Cobros por Transferencia
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Datos bancarios presentados al cliente en mostrador o WhatsApp al abonar mediante alias o CBU/CVU.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                
                {/* TARJETA INTERACTIVA DE PREVIEW BANCARIO */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-[#1B362A] to-[#08130E] border border-[#D0A96B]/40 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-[#D0A96B]" />
                      <span className="text-xs font-bold tracking-widest text-[#D0A96B] uppercase font-serif">
                        {settings.bank_name || 'Banco Galicia / Mercado Pago'}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                      Cuenta Verificada
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Titular de la Cuenta:</span>
                    <span className="text-base font-black text-white font-serif block">
                      {settings.bank_account_holder || 'Elohim Import S.R.L.'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#1B362A]">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Alias Bancario:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-bold text-[#E5C158]">
                          {settings.bank_alias || 'ELOHIM.PERFUMES.ARS'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(settings.bank_alias, 'Alias')}
                          className="text-zinc-400 hover:text-white p-1 cursor-pointer"
                          title="Copiar Alias"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] text-zinc-400 uppercase tracking-wider">CBU / CVU:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-zinc-200 truncate">
                          {settings.bank_cbu_cvu || '0070123400000012345678'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(settings.bank_cbu_cvu, 'CBU/CVU')}
                          className="text-zinc-400 hover:text-white p-1 cursor-pointer shrink-0"
                          title="Copiar CBU"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* NOMBRE BANCO */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                      <Landmark className="h-4 w-4 text-[#D0A96B]" />
                      Entidad Bancaria o Billetera (bank_name)
                    </label>
                    <Input
                      placeholder="Ej. Banco Galicia / Mercado Pago"
                      value={settings.bank_name}
                      onChange={(e) => handleChange('bank_name', e.target.value)}
                      disabled={saving}
                      className="bg-[#08130E] border-[#1B362A] text-white focus:ring-1 focus:ring-[#D0A96B]"
                    />
                  </div>

                  {/* TITULAR */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                      <Building className="h-4 w-4 text-emerald-400" />
                      Titular de la Cuenta (bank_account_holder)
                    </label>
                    <Input
                      placeholder="Ej. Elohim Import S.R.L."
                      value={settings.bank_account_holder}
                      onChange={(e) => handleChange('bank_account_holder', e.target.value)}
                      disabled={saving}
                      className="bg-[#08130E] border-[#1B362A] text-white focus:ring-1 focus:ring-[#D0A96B]"
                    />
                  </div>

                  {/* CBU / CVU */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-indigo-400" />
                      CBU / CVU (22 dígitos) (bank_cbu_cvu)
                    </label>
                    <Input
                      placeholder="Ej. 0070123400000012345678"
                      value={settings.bank_cbu_cvu}
                      onChange={(e) => handleChange('bank_cbu_cvu', e.target.value)}
                      disabled={saving}
                      className="bg-[#08130E] border-[#1B362A] text-white font-mono focus:ring-1 focus:ring-[#D0A96B]"
                    />
                  </div>

                  {/* ALIAS */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-400" />
                      Alias Bancario (bank_alias)
                    </label>
                    <Input
                      placeholder="Ej. ELOHIM.PERFUMES.ARS"
                      value={settings.bank_alias}
                      onChange={(e) => handleChange('bank_alias', e.target.value)}
                      disabled={saving}
                      className="bg-[#08130E] border-[#1B362A] text-white font-mono font-bold focus:ring-1 focus:ring-[#D0A96B]"
                    />
                  </div>
                </div>

              </CardContent>
            </Card>
          )}

          <CardFooter className="border-t border-[#1B362A] p-6 bg-[#08130E]/60 flex items-center justify-end mt-4 rounded-2xl">
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
                  <Save className="mr-2 h-4 w-4" /> Guardar Todos los Cambios
                </>
              )}
            </Button>
          </CardFooter>

        </form>

      </main>

    </div>
  );
}
