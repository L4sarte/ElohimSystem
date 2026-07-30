'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { 
  getPaymentMethodsConfig, 
  createPaymentMethodConfig, 
  updatePaymentMethodConfig, 
  togglePaymentMethodStatus,
  deletePaymentMethodConfig,
  PaymentMethodConfig,
  PaymentMethodConfigInput 
} from '@/app/actions/fees';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import { 
  ArrowLeft, Plus, Edit, RefreshCw, AlertCircle, ShieldAlert, 
  CreditCard, Check, X, Percent, Layers, Power, DollarSign, Sparkles, Trash2, ArrowRight
} from 'lucide-react';
import Link from 'next/link';

export default function ComisionesConfigPage() {
  const { role } = useUserStore();
  const { refresh: refreshRate } = useExchangeRate();

  const [methods, setMethods] = useState<PaymentMethodConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PaymentMethodConfig | null>(null);

  const [formMethodName, setFormMethodName] = useState('');
  const [formFeePercentage, setFormFeePercentage] = useState<number>(0);
  const [formFixedFeeArs, setFormFixedFeeArs] = useState<number>(0);
  const [formPassFeeToCustomer, setFormPassFeeToCustomer] = useState<boolean>(false);
  const [formActive, setFormActive] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchConfigs = async () => {
    if (role !== 'admin') return;
    setLoading(true);
    setError(null);
    const res = await getPaymentMethodsConfig(role);
    if (res.success && res.data) {
      setMethods(res.data);
    } else {
      setError(res.error || 'Error al cargar las reglas de comisiones');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchConfigs();
  }, [role]);

  const handleOpenForm = (item?: PaymentMethodConfig) => {
    if (item) {
      setEditingItem(item);
      setFormMethodName(item.method_name || item.name || '');
      setFormFeePercentage(item.fee_percentage !== undefined ? item.fee_percentage : (item.surcharge_percent || 0));
      setFormFixedFeeArs(item.fixed_fee_ars || 0);
      setFormPassFeeToCustomer(Boolean(item.pass_fee_to_customer));
      setFormActive(Boolean(item.is_active));
    } else {
      setEditingItem(null);
      setFormMethodName('');
      setFormFeePercentage(0);
      setFormFixedFeeArs(0);
      setFormPassFeeToCustomer(false);
      setFormActive(true);
    }
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (item: PaymentMethodConfig) => {
    const newStatus = !item.is_active;
    const res = await togglePaymentMethodStatus(role, item.id, newStatus);
    if (res.success) {
      fetchConfigs();
    } else {
      alert(res.error || 'Error al cambiar estado');
    }
  };

  const handleDeleteItem = async (item: PaymentMethodConfig) => {
    if (confirm(`¿Eliminar la regla de pasarela "${item.method_name || item.name}"?`)) {
      const res = await deletePaymentMethodConfig(role, item.id);
      if (res.success) {
        fetchConfigs();
      } else {
        alert(res.error || 'Error al eliminar');
      }
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMethodName.trim()) return;

    setSubmitting(true);
    setError(null);

    const input: PaymentMethodConfigInput = {
      method_name: formMethodName.trim(),
      fee_percentage: Number(formFeePercentage || 0),
      fixed_fee_ars: Number(formFixedFeeArs || 0),
      pass_fee_to_customer: formPassFeeToCustomer,
      is_active: formActive
    };

    let res;
    if (editingItem) {
      res = await updatePaymentMethodConfig(role, editingItem.id, input);
    } else {
      res = await createPaymentMethodConfig(role, input);
    }

    setSubmitting(false);

    if (res.success) {
      setIsModalOpen(false);
      fetchConfigs();
    } else {
      setError(res.error || 'Error al guardar la regla');
    }
  };

  // Denegar acceso si es vendedor
  if (role !== 'admin') {
    return (
      <div className="flex flex-col min-h-screen bg-[#08130E] text-zinc-50 transition-colors duration-300">
        <header className="sticky top-0 z-40 w-full border-b border-[#1B362A] bg-[#08130E]/80 backdrop-blur-md">
          <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 max-w-6xl">
            <Link 
              href="/"
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
              <span>Volver</span>
            </Link>
            <RoleSelector />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-rose-900/30 bg-[#13261E] shadow-xl">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 mb-4">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <CardTitle className="text-lg font-bold text-rose-400 font-serif">Acceso Restringido</CardTitle>
              <CardDescription className="text-zinc-400">
                La configuración de pasarelas de pago y comisiones es exclusiva para administradores.
              </CardDescription>
            </CardHeader>
            <CardFooter className="pt-2">
              <Link href="/" className="w-full">
                <Button variant="outline" className="w-full justify-center border-[#1B362A] bg-[#08130E]">
                  Volver al Dashboard
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#08130E] text-zinc-50 transition-colors duration-300">
      
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 w-full border-b border-[#1B362A] bg-[#08130E]/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 max-w-6xl">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
              <span>Dashboard</span>
            </Link>
            <span className="text-zinc-800">|</span>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#13261E] border border-[#1B362A] text-[#D0A96B]">
                <CreditCard className="h-4.5 w-4.5" />
              </div>
              <span className="text-sm font-bold tracking-tight text-white uppercase font-serif">
                Pasarelas de Pago & Simulador de Comisiones
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <RoleSelector />
            <ExchangeRateWidget role={role} onRateChange={refreshRate} />
          </div>
        </div>
      </header>

      {/* CUERPO PRINCIPAL */}
      <main className="flex-1 container mx-auto px-4 py-8 sm:px-6 max-w-6xl space-y-6">
        
        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-serif flex items-center gap-2">
              Configuración de Métodos de Pago & Tasas
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Administra los porcentajes de retención y recargo que impactarán dinámicamente en el POS.
            </p>
          </div>

          <Button 
            onClick={() => handleOpenForm()} 
            className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold text-xs shadow-md shadow-[#D0A96B]/20 cursor-pointer"
          >
            <Plus className="mr-2 h-4 w-4" /> Agregar Método de Pago
          </Button>
        </div>

        {/* DATA TABLE DE MÉTODOS DE PAGO */}
        <Card className="border border-[#1B362A] bg-[#13261E] rounded-2xl shadow-xl overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-[#D0A96B]" />
                <span className="text-sm font-medium text-zinc-400">Cargando reglas de comisiones...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 text-rose-400 gap-2">
                <AlertCircle className="h-10 w-10" />
                <p className="text-sm font-semibold">{error}</p>
                <Button variant="outline" onClick={fetchConfigs} className="mt-2 border-[#1B362A]">Reintentar</Button>
              </div>
            ) : methods.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                <CreditCard className="h-10 w-10 text-zinc-600" />
                <h3 className="font-bold text-white font-serif">Sin Métodos Configurados</h3>
                <p className="text-xs text-zinc-400 max-w-sm">No hay pasarelas ni reglas de recargos registradas aún.</p>
                <Button onClick={() => handleOpenForm()} className="mt-2 bg-[#D0A96B] text-[#08130E] font-bold">Crear Primera Regla</Button>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1B362A] bg-[#08130E]/60 text-xs font-bold uppercase tracking-wider text-zinc-400 font-serif">
                    <th className="p-4 pl-6">Nombre Comercial</th>
                    <th className="p-4 text-center">Comisión Pasarela (%)</th>
                    <th className="p-4 text-center">Costo Fijo (ARS)</th>
                    <th className="p-4 text-center">Transferencia de Recargo</th>
                    <th className="p-4 text-center">Estado</th>
                    <th className="p-4 pr-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1B362A]/60 text-xs">
                  {methods.map((item) => {
                    const feePct = item.fee_percentage !== undefined ? item.fee_percentage : (item.surcharge_percent || 0);
                    const name = item.method_name || item.name || '';

                    return (
                      <tr key={item.id} className="hover:bg-[#08130E]/40 transition-colors">
                        
                        {/* Nombre */}
                        <td className="p-4 pl-6 font-bold text-white font-serif">
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-[#D0A96B]" />
                            <span>{name}</span>
                          </div>
                        </td>

                        {/* Comisión % */}
                        <td className="p-4 text-center font-mono font-bold">
                          {feePct > 0 ? (
                            <span className="text-[#D0A96B]">
                              {feePct.toFixed(2)}%
                            </span>
                          ) : (
                            <span className="text-emerald-400">
                              0.00% (Sin Comisión)
                            </span>
                          )}
                        </td>

                        {/* Costo Fijo */}
                        <td className="p-4 text-center font-mono font-bold text-zinc-300">
                          ${(item.fixed_fee_ars || 0).toLocaleString('es-AR')} ARS
                        </td>

                        {/* Recargo al Cliente o Absorbe Elohim */}
                        <td className="p-4 text-center">
                          {item.pass_fee_to_customer ? (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-extrabold bg-[#D0A96B]/10 text-[#E5C158] border border-[#D0A96B]/30">
                              ⚡ Recargo al Cliente (Suma al Total)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-extrabold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              🏢 Absorbe Elohim (Retención MP)
                            </span>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleToggleStatus(item)}
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                              item.is_active
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                                : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:bg-zinc-700'
                            }`}
                          >
                            <Power className="h-3 w-3" />
                            {item.is_active ? 'Activo en POS' : 'Inactivo'}
                          </button>
                        </td>

                        {/* Acciones */}
                        <td className="p-4 pr-6 text-right space-x-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleOpenForm(item)}
                            className="text-zinc-400 hover:text-white cursor-pointer"
                            title="Editar regla"
                          >
                            <Edit className="h-4 w-4 text-[#D0A96B]" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDeleteItem(item)}
                            className="text-zinc-400 hover:text-rose-400 cursor-pointer"
                            title="Eliminar regla"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

      </main>

      {/* MODAL ALTA / EDICIÓN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#13261E] border border-[#1B362A] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <form onSubmit={handleSubmitForm}>
              <CardHeader className="border-b border-[#1B362A] pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold text-white font-serif flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-[#D0A96B]" />
                    {editingItem ? 'Editar Método de Pago' : 'Nuevo Método de Pago'}
                  </CardTitle>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <CardDescription className="text-xs text-zinc-400 mt-1">
                  Configura el nombre comercial, el porcentaje de pasarela y si el costo se traslada al cliente.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 p-6">
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Nombre Comercial *
                  </label>
                  <Input
                    required
                    placeholder="Ej. MercadoPago - 3 Cuotas / Crédito 1 Pago"
                    value={formMethodName}
                    onChange={(e) => setFormMethodName(e.target.value)}
                    className="bg-[#08130E] border-[#1B362A] text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#D0A96B]">
                      Comisión Pasarela (%) *
                    </label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="15.00"
                        value={formFeePercentage}
                        onChange={(e) => setFormFeePercentage(parseFloat(e.target.value) || 0)}
                        className="bg-[#08130E] border-[#1B362A] text-white pr-7 font-mono font-bold text-right"
                      />
                      <Percent className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                      Costo Fijo (ARS)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-xs text-zinc-500">$</span>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={formFixedFeeArs}
                        onChange={(e) => setFormFixedFeeArs(parseFloat(e.target.value) || 0)}
                        className="bg-[#08130E] border-[#1B362A] text-white pl-6 font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* PASAR RECARGO AL CLIENTE VS ABSORBE ELOHIM */}
                <div className="p-3.5 rounded-xl bg-[#08130E] border border-[#1B362A] space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 block">
                    Modo de Impacto Financiero
                  </label>
                  
                  <div className="flex items-center gap-3 pt-1">
                    <input
                      type="checkbox"
                      id="pass_fee_checkbox"
                      checked={formPassFeeToCustomer}
                      onChange={(e) => setFormPassFeeToCustomer(e.target.checked)}
                      className="h-4 w-4 rounded border-[#1B362A] bg-[#13261E] text-[#D0A96B] focus:ring-[#D0A96B] cursor-pointer"
                    />
                    <label htmlFor="pass_fee_checkbox" className="text-xs font-semibold text-white cursor-pointer select-none">
                      Recargar costo financiero al cliente (+ Total POS)
                    </label>
                  </div>

                  <p className="text-[10px] text-zinc-400 leading-snug">
                    {formPassFeeToCustomer ? (
                      <span className="text-[#E5C158]">
                        ⚡ **Recargo al cliente:** El valor cobrado en el POS se incrementará para cubrir la tasa de la tarjeta.
                      </span>
                    ) : (
                      <span className="text-blue-400">
                        🏢 **Elohim absorbe la comisión:** El cliente abonará el precio lista/subtotal y la retención se descontará del neto recibido.
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="is_active_checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="h-4 w-4 rounded border-[#1B362A] bg-[#13261E] text-[#D0A96B] focus:ring-[#D0A96B] cursor-pointer"
                  />
                  <label htmlFor="is_active_checkbox" className="text-xs font-bold text-zinc-300 cursor-pointer">
                    Método de Pago Activo (Disponible en POS)
                  </label>
                </div>

              </CardContent>

              <CardFooter className="border-t border-[#1B362A] pt-4 flex justify-end gap-3 bg-[#08130E]/60 px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="border-[#1B362A] bg-[#13261E] text-zinc-300 hover:bg-zinc-800"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold text-xs shadow-md shadow-[#D0A96B]/20 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                    </>
                  ) : (
                    'Guardar Regla'
                  )}
                </Button>
              </CardFooter>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
