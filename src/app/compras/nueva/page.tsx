'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { getSuppliers } from '@/app/actions/suppliers';
import { getProducts } from '@/app/actions/products';
import { submitPurchase, PurchaseInput, PurchaseItemInput } from '@/app/actions/purchases';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import { 
  ArrowLeft, Search, Plus, Trash2, PackagePlus, Truck, DollarSign, 
  Calendar, Check, RefreshCw, AlertCircle, ShieldAlert, ShoppingBag, X, CheckCircle2, Clock 
} from 'lucide-react';
import Link from 'next/link';

interface CartItem extends PurchaseItemInput {
  product_name: string;
  brand: string;
  sku: string;
  type: string;
}

export default function NuevaCompraPage() {
  const { role } = useUserStore();
  const { rate: exchangeRate, refresh: refreshRate } = useExchangeRate();

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');

  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [cart, setCart] = useState<CartItem[]>([]);

  const [loadingInit, setLoadingInit] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal Confirmación de Compra
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('paid');
  const [dueDate, setDueDate] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadInitialData = async () => {
    if (role !== 'admin') return;
    setLoadingInit(true);
    setError(null);

    const [supRes, prodRes] = await Promise.all([
      getSuppliers(role),
      getProducts(role)
    ]);

    if (supRes.success && supRes.data) {
      setSuppliers(supRes.data);
      if (supRes.data.length > 0) {
        setSelectedSupplierId(supRes.data[0].id);
      }
    }

    if (prodRes.success && prodRes.data) {
      setProducts(prodRes.data);
    }

    setLoadingInit(false);
  };

  useEffect(() => {
    loadInitialData();
  }, [role]);

  // Filtrar productos para la búsqueda predictiva
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddToCart = (product: any) => {
    const existingIndex = cart.findIndex(item => item.product_id === product.id);
    if (existingIndex > -1) {
      // Incrementar cantidad
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      // Agregar nuevo ítem con costo sugerido (base_cost_ars o price_ars)
      const suggestedCost = Number(product.base_cost_ars || product.price_ars || 0);
      setCart(prev => [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          brand: product.brand,
          sku: product.sku,
          type: product.type,
          quantity: 1,
          unit_cost_ars: suggestedCost
        }
      ]);
    }
  };

  const handleUpdateItemQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(productId);
      return;
    }
    setCart(prev => prev.map(item => 
      item.product_id === productId ? { ...item, quantity } : item
    ));
  };

  const handleUpdateItemCost = (productId: string, unit_cost_ars: number) => {
    setCart(prev => prev.map(item => 
      item.product_id === productId ? { ...item, unit_cost_ars: Math.max(0, unit_cost_ars) } : item
    ));
  };

  const handleRemoveItem = (productId: string) => {
    setCart(prev => prev.filter(item => item.product_id !== productId));
  };

  // Totales
  const totalArs = cart.reduce((sum, item) => sum + (item.quantity * item.unit_cost_ars), 0);
  const totalUsd = exchangeRate && exchangeRate > 0 ? (totalArs / exchangeRate) : 0;

  const handleOpenConfirm = () => {
    if (!selectedSupplierId) {
      alert('Por favor selecciona un proveedor.');
      return;
    }
    if (cart.length === 0) {
      alert('Agrega al menos un producto al carrito de compras.');
      return;
    }
    setIsConfirmOpen(true);
  };

  const handleSubmitPurchase = async () => {
    if (!selectedSupplierId || cart.length === 0) return;

    setSubmitting(true);
    setError(null);

    const purchasePayload: PurchaseInput = {
      supplier_id: selectedSupplierId,
      total_ars: totalArs,
      total_usd: Number(totalUsd.toFixed(2)),
      payment_status: paymentStatus,
      due_date: paymentStatus === 'unpaid' ? dueDate : null,
      items: cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost_ars: item.unit_cost_ars
      }))
    };

    const res = await submitPurchase(role, purchasePayload);
    setSubmitting(false);

    if (res.success) {
      setIsConfirmOpen(false);
      setCart([]);
      setSuccessMessage('¡Ingreso de stock e inventario registrado correctamente!');
      loadInitialData(); // Recargar inventario actualizado
    } else {
      setError(res.error || 'Error al registrar el ingreso de compra.');
    }
  };

  // Denegar acceso si es vendedor
  if (role !== 'admin') {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 dark:bg-[#08130E] dark:text-zinc-50 transition-colors duration-300">
        <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-[#1B362A] dark:bg-[#08130E]/80">
          <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 max-w-6xl">
            <Link 
              href="/"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
              <span>Volver</span>
            </Link>
            <RoleSelector />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-rose-200 dark:border-rose-900/30 bg-rose-50/20 dark:bg-rose-950/5 shadow-lg">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 mb-4">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <CardTitle className="text-lg font-bold text-rose-800 dark:text-rose-400">Acceso Restringido</CardTitle>
              <CardDescription className="dark:text-rose-500/80">
                El ingreso de compras e inventario B2B es exclusivo para administradores.
              </CardDescription>
            </CardHeader>
            <CardFooter className="pt-2">
              <Link href="/" className="w-full">
                <Button variant="outline" className="w-full justify-center">
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
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 dark:bg-[#08130E] dark:text-zinc-50 transition-colors duration-300">
      
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-[#1B362A] dark:bg-[#08130E]/80">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 max-w-6xl">
          <div className="flex items-center gap-4">
            <Link 
              href="/compras"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
              <span>Módulo Compras</span>
            </Link>
            <span className="text-slate-300 dark:text-zinc-800">|</span>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-md shadow-emerald-500/20">
                <PackagePlus className="h-4.5 w-4.5" />
              </div>
              <span className="text-sm font-bold tracking-tight text-slate-800 dark:text-zinc-100 uppercase">
                Punto de Compra B2B
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
      <main className="flex-1 container mx-auto px-4 py-6 sm:px-6 max-w-6xl">
        
        {/* Cabecera */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Ingreso de Mercadería e Inventario
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
              Registra nuevas facturas de compra, actualiza costos unitarios y reabastece el stock comercial.
            </p>
          </div>

          <Link href="/compras/proveedores">
            <Button variant="outline" size="sm" className="cursor-pointer">
              <Truck className="mr-1.5 h-3.5 w-3.5" /> Directorio Proveedores
            </Button>
          </Link>
        </div>

        {/* MENSAJE ÉXITO */}
        {successMessage && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300 flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-sm">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800 cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* CONTENEDOR PRINCIPAL DOS COLUMNAS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* COLUMNA IZQUIERDA: SELECCIÓN PROVEEDOR Y CATÁLOGO (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* PANEL SELECCIÓN DE PROVEEDOR */}
            <Card className="border-slate-200 dark:border-[#1B362A]">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                  <Truck className="h-4 w-4 text-indigo-500" />
                  1. Selección de Proveedor B2B *
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {suppliers.length === 0 ? (
                  <div className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300">
                    <span>No hay proveedores registrados aún.</span>
                    <Link href="/compras/proveedores" className="font-bold underline">Crear Proveedor</Link>
                  </div>
                ) : (
                  <select
                    className="w-full h-10 px-3 py-2 text-sm bg-white dark:bg-[#13261E] border border-slate-200 dark:border-[#1B362A] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                  >
                    {suppliers.map(sup => (
                      <option key={sup.id} value={sup.id}>
                        {sup.name} {sup.contact_name ? `(${sup.contact_name})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </CardContent>
            </Card>

            {/* PANEL BUSCADOR DE PRODUCTOS DEL CATÁLOGO */}
            <Card className="border-slate-200 dark:border-[#1B362A]">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                  <Search className="h-4 w-4 text-indigo-500" />
                  2. Buscador de Productos del Catálogo
                </CardTitle>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Buscar producto por SKU, nombre o marca..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </CardHeader>

              <CardContent className="pt-0 max-h-96 overflow-y-auto space-y-2">
                {loadingInit ? (
                  <div className="flex items-center justify-center py-10 gap-2">
                    <RefreshCw className="h-5 w-5 animate-spin text-indigo-500" />
                    <span className="text-xs text-slate-400">Cargando catálogo...</span>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    No se encontraron productos coincidentes.
                  </div>
                ) : (
                  filteredProducts.map(product => (
                    <div 
                      key={product.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-100/80 dark:border-zinc-900 dark:bg-[#13261E]/40 dark:hover:bg-[#13261E] transition-colors"
                    >
                      <div className="max-w-[70%]">
                        <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {product.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-2 mt-0.5">
                          <span>{product.brand}</span>
                          <span>•</span>
                          <span className="font-mono text-[11px]">SKU: {product.sku}</span>
                          <span>•</span>
                          <span className="font-semibold text-slate-700 dark:text-zinc-300">
                            Stock: {product.stock_quantity} {product.type === 'bottle' ? 'ud' : product.type === 'decant_liquid' ? 'ml' : 'frascos'}
                          </span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleAddToCart(product)}
                        className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 text-white cursor-pointer h-8 text-xs"
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Agregar
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

          </div>

          {/* COLUMNA DERECHA: CARRITO Y RESUMEN FACTURA (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            <Card className="border-slate-200 dark:border-[#1B362A] flex flex-col h-full justify-between">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-zinc-900">
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ShoppingBag className="h-4.5 w-4.5 text-emerald-600" />
                    Orden de Compra B2B
                  </span>
                  <span className="text-xs font-normal text-slate-400 font-mono">
                    {cart.length} ítem(s)
                  </span>
                </CardTitle>
              </CardHeader>

              {/* LISTA DE ÍTEMS EN EL CARRITO */}
              <CardContent className="pt-4 flex-1 overflow-y-auto max-h-[420px] space-y-4">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2 text-center text-slate-400">
                    <PackagePlus className="h-10 w-10 opacity-30" />
                    <span className="text-xs">El carrito de compra está vacío.</span>
                    <span className="text-[11px] text-slate-400">Selecciona productos del catálogo a la izquierda.</span>
                  </div>
                ) : (
                  cart.map(item => {
                    const subtotal = item.quantity * item.unit_cost_ars;
                    return (
                      <div 
                        key={item.product_id}
                        className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 dark:border-zinc-900 dark:bg-[#13261E]/50 space-y-2"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-bold text-xs text-slate-900 dark:text-white">
                              {item.product_name}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {item.brand} • SKU: {item.sku}
                            </div>
                          </div>

                          <button 
                            onClick={() => handleRemoveItem(item.product_id)}
                            className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                            title="Quitar producto"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* INPUTS EDITABLES DE CANTIDAD Y COSTO */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 block uppercase">Cantidad Ingresada</label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItemQuantity(item.product_id, parseInt(e.target.value) || 0)}
                              className="h-8 text-xs font-bold"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-400 block uppercase">Costo Unit. (ARS)</label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_cost_ars}
                              onChange={(e) => handleUpdateItemCost(item.product_id, parseFloat(e.target.value) || 0)}
                              className="h-8 text-xs font-mono font-bold"
                            />
                          </div>
                        </div>

                        <div className="text-right text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 pt-1">
                          Subtotal: ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </div>

                      </div>
                    );
                  })
                )}
              </CardContent>

              {/* TOTALES Y BOTÓN DE CONFIRMACIÓN */}
              <CardFooter className="border-t border-slate-100 dark:border-zinc-900 flex-col space-y-4 pt-4 bg-slate-50/50 dark:bg-[#13261E]/30">
                <div className="w-full space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-slate-600 dark:text-zinc-400">Total Factura (ARS):</span>
                    <span className="font-mono font-black text-xl text-slate-900 dark:text-white">
                      ${totalArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Equivalencia Ref. (USD):</span>
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      u$s {totalUsd.toFixed(2)} {exchangeRate ? `(dólar: $${exchangeRate})` : ''}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={handleOpenConfirm}
                  disabled={cart.length === 0 || !selectedSupplierId}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer h-11 font-bold shadow-md"
                >
                  <PackagePlus className="mr-2 h-5 w-5" /> Confirmar Ingreso de Compra
                </Button>
              </CardFooter>

            </Card>

          </div>

        </div>

      </main>

      {/* MODAL DE CONFIRMACIÓN DE COMPRA Y ESTADO DE PAGO */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-[#08130E] border border-slate-200 dark:border-[#1B362A] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            
            <CardHeader className="border-b border-slate-100 dark:border-zinc-900 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <PackagePlus className="h-5 w-5 text-emerald-600" />
                  Confirmar Ingreso de Mercadería
                </CardTitle>
                <button
                  type="button"
                  onClick={() => setIsConfirmOpen(false)}
                  disabled={submitting}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <CardDescription className="mt-1">
                Verifica las condiciones de pago y plazo de la factura antes de impactar el inventario.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 p-6">
              
              {/* Resumen del Proveedor y Totales */}
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#13261E]/50 border border-slate-100 dark:border-[#1B362A] text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Proveedor:</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200">
                    {suppliers.find(s => s.id === selectedSupplierId)?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Factura:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    ${totalArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })} (u$s {totalUsd.toFixed(2)})
                  </span>
                </div>
              </div>

              {/* Selector de Estado de Pago */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Estado Financiero de la Factura *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('paid')}
                    className={`flex items-center justify-center gap-2 h-10 rounded-lg border font-bold text-xs transition-colors cursor-pointer ${
                      paymentStatus === 'paid'
                        ? 'bg-emerald-600 border-emerald-700 text-white shadow-sm'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700 dark:bg-[#13261E] dark:border-[#1B362A] dark:text-zinc-300'
                    }`}
                  >
                    <Check className="h-4 w-4" /> Pagada (Contado)
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentStatus('unpaid')}
                    className={`flex items-center justify-center gap-2 h-10 rounded-lg border font-bold text-xs transition-colors cursor-pointer ${
                      paymentStatus === 'unpaid'
                        ? 'bg-amber-600 border-amber-700 text-white shadow-sm'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700 dark:bg-[#13261E] dark:border-[#1B362A] dark:text-zinc-300'
                    }`}
                  >
                    <Clock className="h-4 w-4" /> Pendiente (Deuda CxP)
                  </button>
                </div>
              </div>

              {/* Campo opcional de Fecha de Vencimiento */}
              {paymentStatus === 'unpaid' && (
                <div className="space-y-1 pt-2 animate-in fade-in duration-200">
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                    Fecha de Vencimiento de Deuda (Opcional)
                  </label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="h-10 text-xs font-semibold"
                  />
                  <p className="text-[10px] text-slate-400">
                    Generará una obligación de pago registrada en Cuentas por Pagar.
                  </p>
                </div>
              )}

            </CardContent>

            <CardFooter className="border-t border-slate-100 dark:border-zinc-900 pt-4 flex justify-end gap-3 bg-slate-50/50 dark:bg-[#13261E]/20 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsConfirmOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={submitting}
                onClick={handleSubmitPurchase}
                className="bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Procesando Compra...
                  </>
                ) : (
                  'Impactar Inventario'
                )}
              </Button>
            </CardFooter>

          </div>
        </div>
      )}

    </div>
  );
}
