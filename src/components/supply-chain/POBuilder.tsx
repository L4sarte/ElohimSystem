'use client';

import React, { useState, useEffect } from 'react';
import { useSupplyChainStore } from '@/store/supplyChainStore';
import { supabase } from '@/lib/supabase';
import { POExpenseType, POStatus, CreatePOPayload } from '@/types/supplyChain';
import { 
  Building, Calendar, Search, Plus, Trash2, DollarSign, 
  Package, Truck, ArrowRight, ArrowLeft, Check, AlertCircle, RefreshCw, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';

interface ProductSearchResult {
  id: string;
  name: string;
  brand?: string;
  sku?: string;
  base_cost_ars: number;
  stock_quantity: number;
}

interface CartItem {
  product: ProductSearchResult;
  expected_quantity: number;
  unit_cost: number;
}

interface ExpenseItem {
  expense_type: POExpenseType;
  amount: number;
  description: string;
}

interface POBuilderProps {
  onSuccess?: () => void;
}

export function POBuilder({ onSuccess }: POBuilderProps) {
  const { suppliers, fetchSuppliers, createPurchaseOrder, isLoading, error: storeError } = useSupplyChainStore();

  // Estado del Wizard Step (1: Proveedor, 2: Carrito Perfumes, 3: Gastos y Confirmación)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Paso 1: Datos del Proveedor y Fechas
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [expectedArrivalDate, setExpectedArrivalDate] = useState<string>('');
  const [trackingInfo, setTrackingInfo] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Paso 2: Búsqueda de Productos y Carrito
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [productResults, setProductResults] = useState<ProductSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Paso 3: Gastos Asociados
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [newExpenseType, setNewExpenseType] = useState<POExpenseType>('flete');
  const [newExpenseAmount, setNewExpenseAmount] = useState<string>('');
  const [newExpenseDesc, setNewExpenseDesc] = useState<string>('');

  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  // Búsqueda dinámica de productos en Supabase
  useEffect(() => {
    if (!searchTerm.trim()) {
      setProductResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      const { data } = await supabase
        .from('products')
        .select('id, name, brand, sku, base_cost_ars, stock_quantity')
        .or(`name.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`)
        .limit(10);

      setProductResults(data || []);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);

  // Agregar producto al carrito
  const handleAddToCart = (product: ProductSearchResult) => {
    const existingIndex = cartItems.findIndex(i => i.product.id === product.id);
    if (existingIndex >= 0) {
      const updated = [...cartItems];
      updated[existingIndex].expected_quantity += 1;
      setCartItems(updated);
    } else {
      setCartItems(prev => [
        ...prev,
        {
          product,
          expected_quantity: 1,
          unit_cost: product.base_cost_ars || 0
        }
      ]);
    }
  };

  const handleUpdateCartItem = (productId: string, field: 'expected_quantity' | 'unit_cost', value: number) => {
    setCartItems(prev => prev.map(item => {
      if (item.product.id === productId) {
        return { ...item, [field]: value < 0 ? 0 : value };
      }
      return item;
    }));
  };

  const handleRemoveCartItem = (productId: string) => {
    setCartItems(prev => prev.filter(item => item.product.id !== productId));
  };

  // Agregar Gasto Asociado
  const handleAddExpense = () => {
    const amountNum = parseFloat(newExpenseAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setLocalError('El monto del gasto debe ser un número mayor a cero.');
      return;
    }
    setExpenses(prev => [
      ...prev,
      {
        expense_type: newExpenseType,
        amount: amountNum,
        description: newExpenseDesc
      }
    ]);
    setNewExpenseAmount('');
    setNewExpenseDesc('');
    setLocalError(null);
  };

  const handleRemoveExpense = (index: number) => {
    setExpenses(prev => prev.filter((_, idx) => idx !== index));
  };

  // Cálculos monetarios
  const subtotalMerchandise = cartItems.reduce(
    (sum, item) => sum + (item.expected_quantity * item.unit_cost), 
    0
  );
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const grandTotal = subtotalMerchandise + totalExpenses;

  // Guardar Orden de Compra (Draft o In-Transit)
  const handleSubmitOrder = async (targetStatus: POStatus) => {
    setLocalError(null);
    if (!selectedSupplierId) {
      setLocalError('Debe seleccionar un proveedor para emitir la orden.');
      setCurrentStep(1);
      return;
    }
    if (cartItems.length === 0) {
      setLocalError('Debe agregar al menos un producto a la orden de compra.');
      setCurrentStep(2);
      return;
    }

    setIsSubmitting(true);

    const payload: CreatePOPayload = {
      supplier_id: selectedSupplierId,
      status: targetStatus,
      expected_arrival_date: expectedArrivalDate || undefined,
      tracking_info: trackingInfo || undefined,
      notes: notes || undefined,
      items: cartItems.map(item => ({
        product_id: item.product.id,
        expected_quantity: item.expected_quantity,
        unit_cost: item.unit_cost
      })),
      expenses: expenses.map(exp => ({
        expense_type: exp.expense_type,
        amount: exp.amount,
        description: exp.description || undefined
      }))
    };

    try {
      await createPurchaseOrder(payload);
      setIsSubmitting(false);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear la orden de compra.';
      setLocalError(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* INDICADOR DE PASOS WIZARD */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 border-b border-slate-200 dark:border-[#1B362A] pb-4">
        <button
          type="button"
          onClick={() => setCurrentStep(1)}
          className={`flex items-center gap-2 p-2 rounded-lg text-xs font-bold transition-all text-left cursor-pointer ${
            currentStep === 1 
              ? 'bg-indigo-600 text-white shadow' 
              : 'bg-slate-100 text-slate-600 dark:bg-[#13261E] dark:text-zinc-400'
          }`}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">1</span>
          <span className="truncate">1. Proveedor & Fechas</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentStep(2)}
          className={`flex items-center gap-2 p-2 rounded-lg text-xs font-bold transition-all text-left cursor-pointer ${
            currentStep === 2 
              ? 'bg-indigo-600 text-white shadow' 
              : 'bg-slate-100 text-slate-600 dark:bg-[#13261E] dark:text-zinc-400'
          }`}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">2</span>
          <span className="truncate">2. Productos ({cartItems.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentStep(3)}
          className={`flex items-center gap-2 p-2 rounded-lg text-xs font-bold transition-all text-left cursor-pointer ${
            currentStep === 3 
              ? 'bg-indigo-600 text-white shadow' 
              : 'bg-slate-100 text-slate-600 dark:bg-[#13261E] dark:text-zinc-400'
          }`}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">3</span>
          <span className="truncate">3. Gastos & Confirmación</span>
        </button>
      </div>

      {(localError || storeError) && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{localError || storeError}</span>
        </div>
      )}

      {/* PASO 1: SELECCIONAR PROVEEDOR Y FECHAS */}
      {currentStep === 1 && (
        <Card className="border-slate-200 dark:border-[#1B362A] bg-white dark:bg-[#13261E]">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building className="h-5 w-5 text-indigo-500" />
              Paso 1: Selección de Proveedor y Logística
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">
                Proveedor *
              </label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm dark:border-[#1B362A] dark:bg-[#08130E] dark:text-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Seleccionar Proveedor --</option>
                {suppliers.map(sup => (
                  <option key={sup.id} value={sup.id}>
                    {sup.name} ({sup.preferred_currency}) {sup.contact_whatsapp ? `- WA: ${sup.contact_whatsapp}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">
                  Fecha Estimada de Llegada (ETA)
                </label>
                <input
                  type="date"
                  value={expectedArrivalDate}
                  onChange={(e) => setExpectedArrivalDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm dark:border-[#1B362A] dark:bg-[#08130E] dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">
                  Código de Guía / Tracking Info
                </label>
                <input
                  type="text"
                  placeholder="Ej: DHL-89240192 / Guía Aérea"
                  value={trackingInfo}
                  onChange={(e) => setTrackingInfo(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm dark:border-[#1B362A] dark:bg-[#08130E] dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">
                Notas / Observaciones de la Orden
              </label>
              <textarea
                rows={2}
                placeholder="Instrucciones especiales de packaging o entrega..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm dark:border-[#1B362A] dark:bg-[#08130E] dark:text-white"
              />
            </div>
          </CardContent>

          <CardFooter className="justify-end pt-4 border-t border-slate-100 dark:border-[#1B362A]">
            <Button
              onClick={() => {
                if (!selectedSupplierId) {
                  setLocalError('Por favor seleccione un proveedor antes de continuar.');
                  return;
                }
                setLocalError(null);
                setCurrentStep(2);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 cursor-pointer"
            >
              Siguiente: Agregar Productos <ArrowRight className="h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* PASO 2: BUSCADOR DE PRODUCTOS Y CARRITO DE COMPRA */}
      {currentStep === 2 && (
        <div className="space-y-6">
          {/* BUSCADOR */}
          <Card className="border-slate-200 dark:border-[#1B362A] bg-white dark:bg-[#13261E]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Search className="h-5 w-5 text-indigo-500" />
                Paso 2: Buscador de Perfumes e Insumos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar por marca, nombre o SKU (Ej: Lattafa, Asad, Club de Nuit)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white p-3 pl-10 text-sm dark:border-[#1B362A] dark:bg-[#08130E] dark:text-white"
                />
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                {isSearching && (
                  <RefreshCw className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-indigo-500" />
                )}
              </div>

              {/* RESULTADOS DE BÚSQUEDA */}
              {productResults.length > 0 && (
                <div className="divide-y divide-slate-100 dark:divide-[#1B362A] rounded-lg border border-slate-200 dark:border-[#1B362A] bg-slate-50/50 dark:bg-[#08130E]/50 max-h-56 overflow-y-auto">
                  {productResults.map(p => (
                    <div 
                      key={p.id} 
                      className="p-3 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-[#13261E] transition-colors"
                    >
                      <div>
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 block">{p.brand}</span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{p.name}</span>
                        <div className="text-[11px] text-slate-400 flex gap-3 mt-0.5">
                          <span>SKU: {p.sku || 'N/A'}</span>
                          <span>Stock actual: {p.stock_quantity} ud</span>
                          <span>Costo actual: ${Number(p.base_cost_ars).toLocaleString('es-AR')}</span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleAddToCart(p)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" /> Agregar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* TABLA DEL CARRITO DE COMPRAS */}
          <Card className="border-slate-200 dark:border-[#1B362A] bg-white dark:bg-[#13261E]">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Package className="h-5 w-5 text-emerald-500" />
                Detalle de Perfumes Solicitados ({cartItems.length})
              </CardTitle>

              <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">
                Subtotal: ${subtotalMerchandise.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </CardHeader>

            <CardContent className="p-0 overflow-x-auto">
              {cartItems.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No has agregado ningún perfume a la orden de compra. Usa el buscador superior.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-[#1B362A] bg-slate-50 dark:bg-[#08130E]/60 text-slate-500 uppercase font-bold">
                      <th className="p-3 pl-4">Producto</th>
                      <th className="p-3 text-center w-32">Cant. Ordenada</th>
                      <th className="p-3 text-right w-36">Costo Unit. (ARS)</th>
                      <th className="p-3 text-right w-36">Subtotal</th>
                      <th className="p-3 text-center w-16">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1B362A]">
                    {cartItems.map((item) => (
                      <tr key={item.product.id} className="hover:bg-slate-50/50 dark:hover:bg-[#08130E]/30">
                        <td className="p-3 pl-4 font-medium text-slate-900 dark:text-white">
                          <div className="font-bold text-indigo-600 dark:text-indigo-400">{item.product.brand}</div>
                          {item.product.name}
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.expected_quantity}
                            onChange={(e) => handleUpdateCartItem(item.product.id, 'expected_quantity', parseInt(e.target.value) || 0)}
                            className="w-20 rounded border border-slate-300 p-1 text-center font-bold dark:border-[#1B362A] dark:bg-[#08130E] dark:text-white"
                          />
                        </td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_cost}
                            onChange={(e) => handleUpdateCartItem(item.product.id, 'unit_cost', parseFloat(e.target.value) || 0)}
                            className="w-28 rounded border border-slate-300 p-1 text-right font-mono font-bold dark:border-[#1B362A] dark:bg-[#08130E] dark:text-white"
                          />
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-800 dark:text-zinc-200">
                          ${(item.expected_quantity * item.unit_cost).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleRemoveCartItem(item.product.id)}
                            className="text-rose-500 hover:text-rose-700 cursor-pointer p-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>

            <CardFooter className="justify-between pt-4 border-t border-slate-100 dark:border-[#1B362A]">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(1)}
                className="gap-2 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" /> Volver a Proveedor
              </Button>

              <Button
                onClick={() => {
                  if (cartItems.length === 0) {
                    setLocalError('Agregue al menos un producto a la orden.');
                    return;
                  }
                  setLocalError(null);
                  setCurrentStep(3);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 cursor-pointer"
              >
                Siguiente: Cargar Gastos <ArrowRight className="h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* PASO 3: GASTOS ASOCIADOS Y RESUMEN GENERAL */}
      {currentStep === 3 && (
        <div className="space-y-6">
          {/* SECCIÓN DE GASTOS ASOCIADOS */}
          <Card className="border-slate-200 dark:border-[#1B362A] bg-white dark:bg-[#13261E]">
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Truck className="h-5 w-5 text-amber-500" />
                Paso 3: Gastos Asociados (Prorrateables)
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Tipo de Gasto</label>
                  <select
                    value={newExpenseType}
                    onChange={(e) => setNewExpenseType(e.target.value as POExpenseType)}
                    className="w-full rounded border border-slate-300 bg-white p-2 text-xs dark:border-[#1B362A] dark:bg-[#08130E] dark:text-white"
                  >
                    <option value="flete">Flete / Envío</option>
                    <option value="aduana">Impuestos de Aduana</option>
                    <option value="packaging">Packaging / Insumos Protec.</option>
                    <option value="comisiones">Comisiones del Proveedor</option>
                    <option value="otro">Otro Gasto Logístico</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Monto (ARS)</label>
                  <input
                    type="number"
                    placeholder="Monto ARS"
                    value={newExpenseAmount}
                    onChange={(e) => setNewExpenseAmount(e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white p-2 text-xs font-mono font-bold dark:border-[#1B362A] dark:bg-[#08130E] dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Descripción (Opcional)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ej: Currier internacional"
                      value={newExpenseDesc}
                      onChange={(e) => setNewExpenseDesc(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white p-2 text-xs dark:border-[#1B362A] dark:bg-[#08130E] dark:text-white"
                    />
                    <Button
                      type="button"
                      onClick={handleAddExpense}
                      className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 text-xs cursor-pointer"
                    >
                      <Plus className="h-4 w-4" /> Add
                    </Button>
                  </div>
                </div>
              </div>

              {/* LISTA DE GASTOS AGREGADOS */}
              {expenses.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">Gastos Registrados:</span>
                  {expenses.map((exp, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between p-2 rounded bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs"
                    >
                      <span className="capitalize font-medium text-slate-800 dark:text-zinc-200">
                        • {exp.expense_type} {exp.description ? `(${exp.description})` : ''}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                          ${exp.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                        <button
                          onClick={() => handleRemoveExpense(idx)}
                          className="text-rose-500 hover:text-rose-700 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* RESUMEN MONETARIO FINAL */}
          <Card className="border-slate-200 dark:border-[#1B362A] bg-slate-900 text-white">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-400" />
                Resumen de la Orden de Compra
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 font-mono text-sm">
              <div className="flex justify-between text-slate-300">
                <span>Subtotal Mercadería ({cartItems.reduce((s, i) => s + i.expected_quantity, 0)} uds):</span>
                <span>${subtotalMerchandise.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="flex justify-between text-amber-400">
                <span>Gastos Logísticos Adicionales ({expenses.length}):</span>
                <span>+${totalExpenses.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="flex justify-between text-lg font-black border-t border-slate-700 pt-2 text-emerald-400">
                <span>GRAND TOTAL INVERSIÓN:</span>
                <span>${grandTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-800">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(2)}
                disabled={isSubmitting}
                className="w-full sm:w-auto text-slate-900 bg-white hover:bg-slate-100 border-none cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Volver a Productos
              </Button>

              <div className="flex gap-3 w-full sm:w-auto ml-auto">
                <Button
                  variant="outline"
                  onClick={() => handleSubmitOrder('draft')}
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-initial text-slate-300 border-slate-700 hover:bg-slate-800 cursor-pointer"
                >
                  Guardar Borrador
                </Button>

                <Button
                  onClick={() => handleSubmitOrder('in_transit')}
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 cursor-pointer shadow-lg shadow-emerald-600/30"
                >
                  {isSubmitting ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Truck className="h-4 w-4" />
                  )}
                  Emitir Orden "En Tránsito"
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
