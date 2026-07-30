'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { getProducts } from '@/app/actions/products';
import { getInventoryAdjustments, adjustInventory, InventoryAdjustmentRecord } from '@/app/actions/inventory';
import { Product } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import { 
  ArrowLeft, Search, Plus, Minus, RefreshCw, AlertCircle, Sparkles, 
  PackageX, Flame, CheckCircle, Clock, FileText, TrendingDown, ShieldAlert 
} from 'lucide-react';
import Link from 'next/link';

const ADJUSTMENT_TYPES = [
  { label: '💧 Derrame / Pérdida de Líquido', value: 'Derrame/Pérdida' },
  { label: '💥 Rotura de Frasco / Botella', value: 'Rotura' },
  { label: '🎁 Regalo Promocional / Muestra', value: 'Regalo Promocional' },
  { label: '📊 Corrección de Arqueo Físico', value: 'Corrección de Arqueo' }
];

export default function AjustesInventarioPage() {
  const { role } = useUserStore();
  const { rate: exchangeRate, refresh: refreshRate } = useExchangeRate();

  const [products, setProducts] = useState<Product[]>([]);
  const [adjustments, setAdjustments] = useState<InventoryAdjustmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [searchProduct, setSearchProduct] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [adjType, setAdjType] = useState('Derrame/Pérdida');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const [pRes, aRes] = await Promise.all([
      getProducts(role),
      getInventoryAdjustments(role)
    ]);

    if (pRes.success && pRes.data) {
      setProducts(pRes.data);
    }
    if (aRes.success && aRes.data) {
      setAdjustments(aRes.data);
    } else if (aRes.error) {
      setError(aRes.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [role]);

  // Selección de producto
  const selectedProduct = products.find(p => p.id === selectedProductId);

  // Filtrado de productos para el combo
  const filteredProducts = products.filter(p => {
    const term = searchProduct.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.brand.toLowerCase().includes(term) ||
      p.sku.toLowerCase().includes(term)
    );
  });

  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      setFormError('Debes seleccionar un producto del catálogo.');
      return;
    }

    const valQty = parseFloat(quantity);
    if (isNaN(valQty) || valQty === 0) {
      setFormError('Ingresa una cantidad numérica válida distinta de cero (negativa para mermas, positiva para ingresos).');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    const res = await adjustInventory(role, selectedProductId, adjType, valQty, reason);
    setSubmitting(false);

    if (res.success) {
      setFormSuccess(`¡Ajuste de inventario registrado con éxito! ${valQty < 0 ? 'Se descontó el stock e insertó la merma en OPEX.' : 'Stock sumado correctamente.'}`);
      setQuantity('');
      setReason('');
      setSelectedProductId('');
      setSearchProduct('');
      fetchData();
    } else {
      setFormError(res.error || 'Error al procesar el ajuste de inventario');
    }
  };

  if (role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#08130E] text-white flex items-center justify-center p-4">
        <Card className="max-w-md border-rose-900/40 bg-[#13261E] p-6 text-center">
          <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-2" />
          <h2 className="text-lg font-bold">Acceso Restringido</h2>
          <p className="text-xs text-zinc-400 mt-1">El módulo de mermas y ajustes de inventario es exclusivo para Administradores.</p>
          <Link href="/">
            <Button className="mt-4 bg-zinc-800 hover:bg-zinc-700">Volver al Dashboard</Button>
          </Link>
        </Card>
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
              <span>Dashboard</span>
            </Link>
            <span className="text-zinc-800">|</span>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-md">
                <PackageX className="h-4.5 w-4.5" />
              </div>
              <span className="text-sm font-bold tracking-tight text-white uppercase font-serif">
                Ajustes de Inventario & Mermas
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
      <main className="flex-1 container mx-auto px-4 py-8 sm:px-6 max-w-6xl space-y-8">
        
        {/* Cabecera */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-serif flex items-center gap-2">
              Control Físico y Registro de Mermas
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Ajusta manualmente existencias por roturas, derrames o mermas con cálculo de costo automático en OPEX.
            </p>
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchData}
            className="border-[#1B362A] bg-[#13261E] text-xs font-semibold hover:bg-zinc-800 cursor-pointer self-start sm:self-center"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5 text-amber-400" /> Actualizar Lista
          </Button>
        </div>

        {/* FORMULARIO DE AJUSTE DE INVENTARIO */}
        <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl">
          <CardHeader className="border-b border-[#1B362A] pb-4">
            <CardTitle className="text-lg font-bold text-white font-serif flex items-center gap-2">
              <PackageX className="h-5 w-5 text-amber-400" />
              Registrar Nuevo Ajuste de Stock
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              Selecciona el producto, el tipo de ajuste y especifica la cantidad (negativa para descontar mermas).
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmitAdjustment}>
            <CardContent className="p-6 space-y-4">
              
              {formError && (
                <div className="flex gap-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3.5 text-xs text-rose-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="font-medium">{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="flex gap-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3.5 text-xs text-emerald-400">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span className="font-medium">{formSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* BUSCADOR Y SELECCIÓN DE PRODUCTO */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    1. Seleccionar Producto *
                  </label>
                  
                  <div className="space-y-2">
                    <Input
                      placeholder="Buscar por nombre, marca o SKU..."
                      value={searchProduct}
                      onChange={(e) => setSearchProduct(e.target.value)}
                      className="bg-[#08130E] border-[#1B362A] text-xs"
                    />

                    <select
                      required
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="flex h-10 w-full rounded-xl border border-[#1B362A] bg-[#08130E] px-3 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="">-- Selecciona producto del catálogo --</option>
                      {filteredProducts.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.brand}) • Stock: {p.stock_quantity} {p.type === 'decant_liquid' ? 'ml' : 'uds'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedProduct && (
                    <div className="p-3 rounded-xl bg-[#08130E] border border-[#1B362A] text-xs text-zinc-300 font-mono space-y-0.5">
                      <div>Stock Actual: <strong className="text-amber-400">{selectedProduct.stock_quantity} {selectedProduct.type === 'decant_liquid' ? 'ml' : 'uds'}</strong></div>
                      <div>Costo Adquisición: <strong>${Number(selectedProduct.base_cost_ars || 0).toLocaleString('es-AR')} ARS</strong></div>
                    </div>
                  )}
                </div>

                {/* TIPO DE AJUSTE Y CANTIDAD */}
                <div className="space-y-4">
                  
                  {/* Tipo de Ajuste */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      2. Tipo de Ajuste / Motivo Comercial *
                    </label>
                    <select
                      value={adjType}
                      onChange={(e) => setAdjType(e.target.value)}
                      className="flex h-10 w-full rounded-xl border border-[#1B362A] bg-[#08130E] px-3 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      {ADJUSTMENT_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Cantidad de Ajuste */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center justify-between">
                      <span>3. Cantidad a Ajustar *</span>
                      <span className="text-[10px] text-zinc-500 font-normal">Negativo = Restar, Positivo = Sumar</span>
                    </label>
                    <Input
                      required
                      type="number"
                      step="any"
                      placeholder="Ej. -10 (para restar 10 ml/uds por merma)"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="bg-[#08130E] border-amber-900/40 text-amber-300 font-mono font-bold focus-visible:ring-amber-500"
                    />
                  </div>

                </div>

              </div>

              {/* MOTIVO DETALLADO */}
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Observaciones / Detalle del Ajuste
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej. Se rompió frasco de 100ml durante empaque o derrame accidental al fraccionar decant"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="flex w-full rounded-xl border border-[#1B362A] bg-[#08130E] px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-zinc-600"
                />
              </div>

              {/* BANNER REGLA FINANCIERA OPEX */}
              <div className="p-3.5 rounded-xl bg-[#D0A96B]/10 border border-[#D0A96B]/30 text-xs text-[#E5C158] space-y-1 leading-normal">
                <div className="font-bold flex items-center gap-1.5 text-[#D0A96B]">
                  <ShieldAlert className="h-4 w-4" /> Impacto Automático en Estado de Resultados (OPEX)
                </div>
                <p className="text-[11px] opacity-90">
                  Si registras una cantidad negativa (merma/rotura), el sistema calculará automáticamente la pérdida basada en el costo directo del producto e insertará un registro en <code className="text-violet-200">operating_expenses</code> bajo la categoría <strong>&apos;Merma de Inventario&apos;</strong>, deduciéndolo de la Ganancia Neta.
                </p>
              </div>

            </CardContent>

            <CardFooter className="border-t border-[#1B362A] pt-4 flex justify-end gap-3 bg-[#13261E]/40 px-6 py-4">
              <Button
                type="submit"
                disabled={submitting}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-10 px-6 cursor-pointer shadow-md shadow-amber-600/20"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Procesando Ajuste...
                  </>
                ) : (
                  'Confirmar y Registrar Ajuste'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* DATA TABLE DE HISTORIAL DE AJUSTES */}
        <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl">
          <CardHeader className="border-b border-[#1B362A] pb-4">
            <CardTitle className="text-base font-bold text-white font-serif flex items-center gap-2">
              <Clock className="h-4.5 w-4.5 text-zinc-400" />
              Historial de Ajustes y Mermas Registradas
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              Registro auditado de todas las modificaciones físicas realizadas sobre el inventario.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-amber-500" />
                <span className="text-xs font-medium text-zinc-400">Cargando historial de ajustes...</span>
              </div>
            ) : adjustments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                <PackageX className="h-10 w-10 text-zinc-700" />
                <h3 className="font-bold text-white">Sin Ajustes Registrados</h3>
                <p className="text-xs text-zinc-400 max-w-xs">No se han registrado mermas o ajustes manuales de stock hasta la fecha.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1B362A] bg-[#13261E]/40 text-xs font-bold uppercase tracking-wider text-zinc-400">
                    <th className="p-4 pl-6">Fecha / Hora</th>
                    <th className="p-4">Producto</th>
                    <th className="p-4">Tipo de Ajuste</th>
                    <th className="p-4 text-right">Cantidad</th>
                    <th className="p-4">Motivo / Observación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80 text-sm">
                  {adjustments.map(item => {
                    const isNegative = Number(item.quantity || 0) < 0;

                    return (
                      <tr key={item.id} className="hover:bg-[#13261E]/50 transition-colors">
                        
                        {/* Fecha */}
                        <td className="p-4 pl-6 font-mono text-xs text-zinc-400">
                          {new Date(item.created_at).toLocaleString('es-AR')}
                        </td>

                        {/* Producto */}
                        <td className="p-4">
                          <div className="font-bold text-white font-serif">{item.products?.name || 'Producto'}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">
                            {item.products?.brand} • {item.products?.sku}
                          </div>
                        </td>

                        {/* Tipo de Ajuste */}
                        <td className="p-4 text-xs font-semibold text-zinc-300">
                          {item.type}
                        </td>

                        {/* Cantidad */}
                        <td className="p-4 text-right font-mono font-bold">
                          {isNegative ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-rose-500/10 text-rose-400 border border-rose-500/30">
                              <Minus className="h-3 w-3" /> {item.quantity} {item.products?.type === 'decant_liquid' ? 'ml' : 'uds'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              <Plus className="h-3 w-3" /> +{item.quantity} {item.products?.type === 'decant_liquid' ? 'ml' : 'uds'}
                            </span>
                          )}
                        </td>

                        {/* Motivo */}
                        <td className="p-4 text-xs text-zinc-400 max-w-xs truncate">
                          {item.reason || 'Sin observación'}
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

    </div>
  );
}
