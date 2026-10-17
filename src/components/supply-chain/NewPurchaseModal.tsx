'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { UserRole } from '@/types';
import { PurchaseCurrency, PaymentCondition, POStatus } from '@/types/supplyChain';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { getSuppliers, createSupplier } from '@/app/actions/suppliers';
import { getProducts } from '@/app/actions/products';
import { getTreasuryAccounts, TreasuryAccount } from '@/app/actions/treasury';
import { submitPurchase, PurchaseInput } from '@/app/actions/purchases';
import { getStockRunwayAnalysis, StockRunwayProduct } from '@/app/actions/inventoryAnalytics';
import {
  PackagePlus,
  Search,
  Plus,
  Trash2,
  Building,
  Wallet,
  Calendar,
  Truck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  DollarSign,
  Sparkles,
  ShoppingBag,
  Clock,
  Check,
  Droplet,
  Box,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface CatalogProduct {
  id: string;
  sku: string;
  name: string;
  brand: string;
  type: 'bottle' | 'decant_liquid' | 'supply';
  base_cost_ars: number;
  stock_quantity: number;
}

interface PurchaseCartItem {
  product: CatalogProduct;
  quantity: number;
  unit_cost: number; // Costo unitario en la moneda seleccionada (ARS o USD)
}

interface NewPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  role: UserRole;
  initialProductId?: string;
}

export function NewPurchaseModal({
  isOpen,
  onClose,
  onSuccess,
  role,
  initialProductId,
}: NewPurchaseModalProps) {
  const { rate: rawExchangeRate } = useExchangeRate();
  const liveBlueRate = rawExchangeRate && rawExchangeRate > 0 ? rawExchangeRate : 1250;

  // Datos maestros
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [treasuryAccounts, setTreasuryAccounts] = useState<TreasuryAccount[]>([]);
  const [runwayMap, setRunwayMap] = useState<Record<string, StockRunwayProduct>>({});
  const [loadingInit, setLoadingInit] = useState<boolean>(false);

  // Estado del formulario de compra
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [currency, setCurrency] = useState<PurchaseCurrency>('ARS');
  const [frozenExchangeRate, setFrozenExchangeRate] = useState<number>(liveBlueRate);

  // Alta rápida de proveedor inline
  const [showQuickSupplier, setShowQuickSupplier] = useState<boolean>(false);
  const [quickSupplierName, setQuickSupplierName] = useState<string>('');
  const [quickSupplierPhone, setQuickSupplierPhone] = useState<string>('');
  const [creatingSupplier, setCreatingSupplier] = useState<boolean>(false);

  // Buscador de catálogo y filtros
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'bottle' | 'decant_liquid' | 'supply'>('ALL');
  const [cart, setCart] = useState<PurchaseCartItem[]>([]);

  // Switch de Condición de Pago: CONTADO vs CUENTA_CORRIENTE
  const [paymentCondition, setPaymentCondition] = useState<PaymentCondition>('CONTADO');
  const [selectedTreasuryAccountId, setSelectedTreasuryAccountId] = useState<string>('');
  const [paymentDueDate, setPaymentDueDate] = useState<string>(() => {
    const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  });

  // Switch de Recepción de Stock: 'received' vs 'in_transit'
  const [receptionStatus, setReceptionStatus] = useState<POStatus>('received');
  const [expectedArrivalDate, setExpectedArrivalDate] = useState<string>(() => {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  });
  const [trackingInfo, setTrackingInfo] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (liveBlueRate > 0) {
      setFrozenExchangeRate(liveBlueRate);
    }
  }, [liveBlueRate]);

  useEffect(() => {
    if (!isOpen || role !== 'admin') return;
    setErrorMsg(null);

    async function loadMasterData() {
      setLoadingInit(true);
      try {
        const [supRes, prodRes, accRes, runwayRes] = await Promise.all([
          getSuppliers(role),
          getProducts(),
          getTreasuryAccounts(),
          getStockRunwayAnalysis(),
        ]);

        if (supRes.success && supRes.data) {
          setSuppliers(supRes.data);
          if (supRes.data.length > 0 && !selectedSupplierId) {
            setSelectedSupplierId(supRes.data[0].id);
          }
        }

        if (prodRes.success && prodRes.data) {
          const mapped: CatalogProduct[] = prodRes.data.map((p: any) => ({
            id: p.id,
            sku: p.sku || 'S/SKU',
            name: p.name,
            brand: p.brand || 'Elohim',
            type: (p.type as CatalogProduct['type']) || 'bottle',
            base_cost_ars: Number(p.base_cost_ars || 0),
            stock_quantity: Number(p.stock_quantity || 0),
          }));
          setProducts(mapped);

          if (initialProductId) {
            const target = mapped.find((p) => p.id === initialProductId);
            if (target) {
              setCart((prev) => {
                if (prev.some((i) => i.product.id === target.id)) return prev;
                return [
                  ...prev,
                  {
                    product: target,
                    quantity: Math.max(5, 10 - target.stock_quantity),
                    unit_cost: target.base_cost_ars || 0,
                  },
                ];
              });
            }
          }
        }

        if (accRes.success && accRes.data) {
          setTreasuryAccounts(accRes.data);
          if (accRes.data.length > 0 && !selectedTreasuryAccountId) {
            setSelectedTreasuryAccountId(accRes.data[0].id);
          }
        }

        if (runwayRes.success && runwayRes.data) {
          setRunwayMap(runwayRes.data.byProductId);
        }
      } catch (err) {
        console.error('Error al cargar datos del modal de compra:', err);
      } finally {
        setLoadingInit(false);
      }
    }

    loadMasterData();
  }, [isOpen, role, initialProductId]);

  // Convertir los costos unitarios del carrito cuando el usuario cambia entre ARS y USD
  const handleCurrencyChange = (newCurrency: PurchaseCurrency) => {
    if (newCurrency === currency) return;
    const rate = frozenExchangeRate > 0 ? frozenExchangeRate : 1250;

    setCart((prev) =>
      prev.map((item) => {
        if (newCurrency === 'USD') {
          return {
            ...item,
            unit_cost: Number((item.unit_cost / rate).toFixed(2)),
          };
        } else {
          return {
            ...item,
            unit_cost: Math.round(item.unit_cost * rate),
          };
        }
      })
    );
    setCurrency(newCurrency);
  };

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return products
      .filter((p) => {
        if (typeFilter !== 'ALL' && p.type !== typeFilter) return false;
        if (!term) return true;
        return (
          p.name.toLowerCase().includes(term) ||
          p.brand.toLowerCase().includes(term) ||
          p.sku.toLowerCase().includes(term)
        );
      })
      .slice(0, 35);
  }, [products, searchTerm, typeFilter]);

  const handleAddToCart = (product: CatalogProduct) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      const rate = frozenExchangeRate > 0 ? frozenExchangeRate : 1250;
      const defaultUnitCost =
        currency === 'USD'
          ? Number(((product.base_cost_ars || 0) / rate).toFixed(2))
          : Number(product.base_cost_ars || 0);

      return [
        ...prev,
        {
          product,
          quantity: 1,
          unit_cost: defaultUnitCost,
        },
      ];
    });
  };

  const handleUpdateCartQuantity = (productId: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.product.id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity: qty } : item))
    );
  };

  const handleUpdateCartUnitCost = (productId: string, cost: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, unit_cost: Math.max(0, cost) } : item
      )
    );
  };

  const handleRemoveCartItem = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const handleCreateQuickSupplier = async () => {
    if (!quickSupplierName.trim()) {
      toast.error('Ingresa el nombre del proveedor.');
      return;
    }
    setCreatingSupplier(true);
    const res = await createSupplier(role, {
      name: quickSupplierName.trim(),
      phone: quickSupplierPhone.trim() || null,
    });
    setCreatingSupplier(false);

    if (res.success && res.data) {
      setSuppliers((prev) => [...prev, res.data]);
      setSelectedSupplierId(res.data.id);
      setQuickSupplierName('');
      setQuickSupplierPhone('');
      setShowQuickSupplier(false);
      toast.success(`Proveedor "${res.data.name}" creado y seleccionado.`);
    } else {
      toast.error(res.error || 'Error al crear proveedor.');
    }
  };

  // Cálculos totales multimoneda con dólar blue congelado
  const rate = frozenExchangeRate > 0 ? frozenExchangeRate : 1250;

  const subtotalInSelectedCurrency = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0),
    [cart]
  );

  const totalArs = useMemo(() => {
    if (currency === 'ARS') return Number(subtotalInSelectedCurrency.toFixed(2));
    return Number((subtotalInSelectedCurrency * rate).toFixed(2));
  }, [currency, subtotalInSelectedCurrency, rate]);

  const totalUsd = useMemo(() => {
    if (currency === 'USD') return Number(subtotalInSelectedCurrency.toFixed(2));
    return Number((subtotalInSelectedCurrency / rate).toFixed(2));
  }, [currency, subtotalInSelectedCurrency, rate]);

  const totalUnits = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const selectedTreasuryAccount = treasuryAccounts.find(
    (a) => a.id === selectedTreasuryAccountId
  );
  const hasInsufficientFunds =
    paymentCondition === 'CONTADO' &&
    selectedTreasuryAccount !== undefined &&
    totalArs > selectedTreasuryAccount.balance_ars;

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedSupplierId) {
      setErrorMsg('Debe seleccionar un proveedor.');
      return;
    }

    if (cart.length === 0) {
      setErrorMsg('Debe agregar al menos un producto o insumo a la compra.');
      return;
    }

    if (totalArs <= 0) {
      setErrorMsg('El monto total de la compra debe ser mayor a $0.');
      return;
    }

    if (paymentCondition === 'CONTADO' && !selectedTreasuryAccountId) {
      setErrorMsg(
        'Para compras con Pago Inmediato (Contado) es obligatorio seleccionar la cuenta de tesorería de origen.'
      );
      return;
    }

    if (hasInsufficientFunds && selectedTreasuryAccount) {
      setErrorMsg(
        `Saldo insuficiente en "${selectedTreasuryAccount.account_name}" (Disponible: $${selectedTreasuryAccount.balance_ars.toLocaleString('es-AR')} ARS | Requerido: $${totalArs.toLocaleString('es-AR')} ARS).`
      );
      return;
    }

    if (paymentCondition === 'CUENTA_CORRIENTE' && !paymentDueDate) {
      setErrorMsg('Debe especificar una Fecha de Vencimiento para enviar la factura a Cuentas por Pagar.');
      return;
    }

    setSubmitting(true);

    const payload: PurchaseInput = {
      supplier_id: selectedSupplierId,
      status: receptionStatus,
      currency,
      exchange_rate: rate,
      total_ars: totalArs,
      total_usd: totalUsd,
      payment_condition: paymentCondition,
      payment_status: paymentCondition === 'CONTADO' ? 'paid_cash' : 'pending_credit',
      treasury_account_id: paymentCondition === 'CONTADO' ? selectedTreasuryAccountId : null,
      payment_due_date: paymentCondition === 'CUENTA_CORRIENTE' ? paymentDueDate : null,
      due_date: paymentCondition === 'CUENTA_CORRIENTE' ? paymentDueDate : null,
      expected_arrival_date: receptionStatus === 'in_transit' ? expectedArrivalDate : null,
      tracking_info: receptionStatus === 'in_transit' ? trackingInfo.trim() || null : null,
      notes: notes.trim() || null,
      items: cart.map((item) => {
        const unitCostArs =
          currency === 'USD'
            ? Number((item.unit_cost * rate).toFixed(2))
            : Number(item.unit_cost.toFixed(2));
        return {
          product_id: item.product.id,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          unit_cost_ars: unitCostArs,
          currency,
        };
      }),
    };

    const res = await submitPurchase(role, payload);
    setSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Error al registrar la compra.');
      return;
    }

    toast.success(res.message || 'Compra registrada exitosamente.');
    setCart([]);
    setNotes('');
    setTrackingInfo('');
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl rounded-2xl bg-white dark:bg-erp-surface border border-slate-200 dark:border-erp-border shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] animate-in zoom-in-95 duration-200">
        {/* CABECERA DEL MODAL */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-200 dark:border-erp-border bg-slate-50/80 dark:bg-erp-bg/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
              <PackagePlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white font-serif flex items-center gap-2">
                Registrar Nueva Compra B2B
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Abastecimiento atómico con impacto en Kardex/PPP, Tesorería o Cuentas por Pagar (CXP).
              </p>
            </div>
          </div>

          {/* SELECTOR DE MONEDA Y DÓLAR BLUE CONGELADO */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-erp-bg border border-erp-border text-xs">
              <DollarSign className="h-3.5 w-3.5 text-erp-gold" />
              <span className="text-zinc-400 font-medium">Dólar Blue Congelado:</span>
              <input
                type="number"
                min="1"
                step="1"
                value={frozenExchangeRate}
                onChange={(e) => setFrozenExchangeRate(Math.max(1, parseFloat(e.target.value) || 1250))}
                className="w-20 bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-right font-mono font-bold text-erp-gold focus:outline-none focus:border-erp-gold"
                title="Cotización dólar blue utilizada para congelar la factura"
              />
              <span className="text-[11px] font-mono text-zinc-500">ARS</span>
            </div>

            <div className="inline-flex rounded-xl border border-slate-200 dark:border-erp-border bg-slate-100 dark:bg-erp-bg p-1">
              <button
                type="button"
                onClick={() => handleCurrencyChange('ARS')}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                  currency === 'ARS'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-white'
                }`}
              >
                Moneda ARS ($)
              </button>
              <button
                type="button"
                onClick={() => handleCurrencyChange('USD')}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                  currency === 'USD'
                    ? 'bg-erp-gold text-erp-bg shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-white'
                }`}
              >
                Moneda USD (u$s)
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-lg cursor-pointer transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* CUERPO SCROLLABLE */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 dark:bg-rose-950/30 dark:border-rose-900/40 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* FILA SUPERIOR: PROVEEDOR + CONDICIÓN DE PAGO + CONDICIÓN DE RECEPCIÓN */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* 1. PROVEEDOR (4 cols) */}
            <div className="lg:col-span-4 p-4 rounded-xl border border-slate-200 dark:border-erp-border bg-slate-50/50 dark:bg-erp-bg/50 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Building className="h-4 w-4 text-erp-gold" />
                  1. Proveedor B2B *
                </label>
                <button
                  type="button"
                  onClick={() => setShowQuickSupplier((v) => !v)}
                  className="text-[11px] font-bold text-emerald-500 hover:text-emerald-400 cursor-pointer flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> {showQuickSupplier ? 'Cancelar' : 'Nuevo Proveedor'}
                </button>
              </div>

              {showQuickSupplier ? (
                <div className="space-y-2 p-2.5 rounded-lg bg-white dark:bg-erp-surface border border-emerald-500/30">
                  <Input
                    placeholder="Nombre o Razón Social *"
                    value={quickSupplierName}
                    onChange={(e) => setQuickSupplierName(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder="Teléfono / WhatsApp"
                      value={quickSupplierPhone}
                      onChange={(e) => setQuickSupplierPhone(e.target.value)}
                      className="h-8 text-xs flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={creatingSupplier}
                      onClick={handleCreateQuickSupplier}
                      className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                    >
                      {creatingSupplier ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Guardar'}
                    </Button>
                  </div>
                </div>
              ) : (
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-300 dark:border-erp-border bg-white dark:bg-erp-surface px-3 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Seleccionar Proveedor --</option>
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name} {sup.contact_name ? `(${sup.contact_name})` : ''}
                    </option>
                  ))}
                </select>
              )}

              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                  Notas / Nº Factura o Remito (Opcional)
                </label>
                <Input
                  placeholder="Ej: Factura A #0004-1290 / Lote Árabes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-9 text-xs bg-white dark:bg-erp-surface"
                />
              </div>
            </div>

            {/* 2. SWITCH DE CONDICIÓN DE PAGO (4 cols) */}
            <div className="lg:col-span-4 p-4 rounded-xl border border-slate-200 dark:border-erp-border bg-slate-50/50 dark:bg-erp-bg/50 space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-emerald-500" />
                2. Condición de Pago *
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentCondition('CONTADO')}
                  className={`flex items-center justify-center gap-1.5 h-9 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                    paymentCondition === 'CONTADO'
                      ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm'
                      : 'bg-white dark:bg-erp-surface border-slate-200 dark:border-erp-border text-slate-600 dark:text-zinc-400 hover:text-white'
                  }`}
                >
                  <Check className="h-3.5 w-3.5" /> Pago Inmediato (Contado)
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentCondition('CUENTA_CORRIENTE')}
                  className={`flex items-center justify-center gap-1.5 h-9 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                    paymentCondition === 'CUENTA_CORRIENTE'
                      ? 'bg-amber-600 border-amber-500 text-white shadow-sm'
                      : 'bg-white dark:bg-erp-surface border-slate-200 dark:border-erp-border text-slate-600 dark:text-zinc-400 hover:text-white'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" /> A Pagar / Crédito (CXP)
                </button>
              </div>

              {paymentCondition === 'CONTADO' ? (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-emerald-500 block">
                    Cuenta de Tesorería a Debitar *
                  </label>
                  <select
                    value={selectedTreasuryAccountId}
                    onChange={(e) => setSelectedTreasuryAccountId(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-300 dark:border-erp-border bg-white dark:bg-erp-surface px-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {treasuryAccounts.length === 0 ? (
                      <option value="">-- Sin cuentas activas --</option>
                    ) : (
                      treasuryAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.account_name} — Saldo: ${acc.balance_ars.toLocaleString('es-AR')} ARS
                        </option>
                      ))
                    )}
                  </select>
                  {hasInsufficientFunds && selectedTreasuryAccount && (
                    <span className="text-[11px] text-rose-400 font-semibold block">
                      ⚠️ Saldo insuficiente (${selectedTreasuryAccount.balance_ars.toLocaleString('es-AR')} ARS disponibles).
                    </span>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-amber-500 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Fecha de Vencimiento de Factura *
                  </label>
                  <Input
                    type="date"
                    required
                    value={paymentDueDate}
                    onChange={(e) => setPaymentDueDate(e.target.value)}
                    className="h-9 text-xs font-mono font-bold bg-white dark:bg-erp-surface"
                  />
                  <span className="text-[10px] text-zinc-400 block">
                    Se enviará a Cuentas por Pagar sin descontar dinero de Tesorería hoy.
                  </span>
                </div>
              )}
            </div>

            {/* 3. SWITCH DE RECEPCIÓN DE STOCK (4 cols) */}
            <div className="lg:col-span-4 p-4 rounded-xl border border-slate-200 dark:border-erp-border bg-slate-50/50 dark:bg-erp-bg/50 space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-indigo-400" />
                3. Recepción de Stock *
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReceptionStatus('received')}
                  className={`flex items-center justify-center gap-1.5 h-9 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                    receptionStatus === 'received'
                      ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm'
                      : 'bg-white dark:bg-erp-surface border-slate-200 dark:border-erp-border text-slate-600 dark:text-zinc-400 hover:text-white'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Ingreso Inmediato
                </button>

                <button
                  type="button"
                  onClick={() => setReceptionStatus('in_transit')}
                  className={`flex items-center justify-center gap-1.5 h-9 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                    receptionStatus === 'in_transit'
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                      : 'bg-white dark:bg-erp-surface border-slate-200 dark:border-erp-border text-slate-600 dark:text-zinc-400 hover:text-white'
                  }`}
                >
                  <Truck className="h-3.5 w-3.5" /> En Tránsito
                </button>
              </div>

              {receptionStatus === 'received' ? (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-600 dark:text-emerald-300 leading-relaxed">
                  <strong>Impacta Kardex y Stock ya:</strong> Suma las unidades al inventario físico y recalcula el Costo Promedio Ponderado (PPP).
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-indigo-400 block mb-0.5">
                      Llegada Est. (ETA)
                    </label>
                    <Input
                      type="date"
                      value={expectedArrivalDate}
                      onChange={(e) => setExpectedArrivalDate(e.target.value)}
                      className="h-8 text-xs font-mono bg-white dark:bg-erp-surface"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-indigo-400 block mb-0.5">
                      Tracking / Guía
                    </label>
                    <Input
                      placeholder="DHL / Andreani..."
                      value={trackingInfo}
                      onChange={(e) => setTrackingInfo(e.target.value)}
                      className="h-8 text-xs bg-white dark:bg-erp-surface"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* GRILLA INFERIOR: BUSCADOR DE CATÁLOGO / DECANTS (6 cols) + DETALLE DE COMPRA (6 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* COLUMNA IZQUIERDA: SELECTOR DE ITEMS DE CATÁLOGO O DECANTS */}
            <div className="lg:col-span-6 flex flex-col rounded-xl border border-slate-200 dark:border-erp-border bg-slate-50/40 dark:bg-erp-bg/40 overflow-hidden">
              <div className="p-3.5 border-b border-slate-200 dark:border-erp-border space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Search className="h-4 w-4 text-erp-gold" />
                    Catálogo de Perfumes, Decants e Insumos
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">
                    {products.length} referencias
                  </span>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Buscar por SKU, nombre o marca (Ej: Lattafa, Khamrah, Frasco 5ml)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-9 text-xs bg-white dark:bg-erp-surface"
                  />
                </div>

                {/* Filtros por tipo (Perfumes, Decants, Insumos) */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'ALL', label: 'Todos' },
                    { id: 'bottle', label: 'Perfumes Sellados' },
                    { id: 'decant_liquid', label: 'Decants / Granel (ml)' },
                    { id: 'supply', label: 'Insumos & Frascos' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setTypeFilter(tab.id as any)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                        typeFilter === tab.id
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white dark:bg-erp-surface text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-erp-border hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-erp-border/60">
                {loadingInit ? (
                  <div className="flex items-center justify-center py-12 gap-2 text-xs text-zinc-400">
                    <RefreshCw className="h-4 w-4 animate-spin text-emerald-500" />
                    Cargando catálogo...
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="py-12 text-center text-xs text-zinc-500">
                    No se encontraron productos coincidentes.
                  </div>
                ) : (
                  filteredProducts.map((prod) => {
                    const unitLabel = prod.type === 'decant_liquid' ? 'ml' : 'ud';
                    const runway = runwayMap[prod.id];
                    return (
                      <div
                        key={prod.id}
                        className="py-2.5 px-2 flex items-center justify-between gap-3 hover:bg-slate-100/70 dark:hover:bg-erp-surface/60 rounded-lg transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                                prod.type === 'bottle'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : prod.type === 'decant_liquid'
                                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}
                            >
                              {prod.type === 'bottle'
                                ? 'Perfume'
                                : prod.type === 'decant_liquid'
                                ? 'Decant'
                                : 'Insumo'}
                            </span>
                            <span className="text-[11px] font-mono text-erp-gold font-bold truncate">
                              {prod.brand}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-500">
                              • {prod.sku}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate mt-0.5">
                            {prod.name}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 flex items-center gap-3 mt-0.5">
                            <span>
                              Stock: <strong>{prod.stock_quantity}</strong> {unitLabel}
                            </span>
                            <span>
                              PPP: ${(prod.base_cost_ars || 0).toLocaleString('es-AR')} ARS
                            </span>
                            {runway && runway.urgency === 'critico' && (
                              <span className="text-rose-400 font-bold">
                                🚨 {runway.coverageDays}d
                              </span>
                            )}
                          </div>
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleAddToCart(prod)}
                          className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer shrink-0"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* COLUMNA DERECHA: ÍTEMS SELECCIONADOS EN LA COMPRA */}
            <div className="lg:col-span-6 flex flex-col rounded-xl border border-slate-200 dark:border-erp-border bg-slate-50/40 dark:bg-erp-bg/40 overflow-hidden">
              <div className="p-3.5 border-b border-slate-200 dark:border-erp-border flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <ShoppingBag className="h-4 w-4 text-emerald-500" />
                  Detalle de Factura ({cart.length} ítems / {totalUnits} uds)
                </span>
                <span className="text-xs font-mono font-bold text-erp-gold">
                  Moneda de carga: {currency}
                </span>
              </div>

              <div className="flex-1 max-h-80 overflow-y-auto p-3 space-y-2.5">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-500 gap-2">
                    <Box className="h-9 w-9 opacity-30" />
                    <p className="text-xs font-medium">No hay productos cargados en la orden.</p>
                    <p className="text-[11px] text-zinc-500">
                      Selecciona perfumes, decants o insumos del panel izquierdo.
                    </p>
                  </div>
                ) : (
                  cart.map((item) => {
                    const lineSubtotal = item.quantity * item.unit_cost;
                    const unitCostArsPreview =
                      currency === 'USD' ? item.unit_cost * rate : item.unit_cost;

                    return (
                      <div
                        key={item.product.id}
                        className="p-3 rounded-xl bg-white dark:bg-erp-surface border border-slate-200 dark:border-erp-border space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {item.product.name}
                            </div>
                            <div className="text-[11px] font-mono text-zinc-400">
                              {item.product.brand} • SKU: {item.product.sku}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCartItem(item.product.id)}
                            className="text-zinc-400 hover:text-rose-500 cursor-pointer p-1"
                            title="Eliminar ítem"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2 items-end pt-1">
                          <div>
                            <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-0.5">
                              Cantidad ({item.product.type === 'decant_liquid' ? 'ml' : 'uds'})
                            </label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                handleUpdateCartQuantity(
                                  item.product.id,
                                  parseInt(e.target.value, 10) || 0
                                )
                              }
                              className="h-8 text-xs font-mono font-bold"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-0.5">
                              Costo Unit. ({currency})
                            </label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_cost}
                              onChange={(e) =>
                                handleUpdateCartUnitCost(
                                  item.product.id,
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="h-8 text-xs font-mono font-bold"
                            />
                          </div>

                          <div className="text-right font-mono">
                            <span className="text-[10px] uppercase text-zinc-400 block">
                              Subtotal ({currency})
                            </span>
                            <span className="text-xs font-bold text-emerald-500">
                              {currency === 'ARS' ? '$' : 'u$s '}
                              {lineSubtotal.toLocaleString('es-AR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                            {currency === 'USD' && (
                              <span className="block text-[10px] text-zinc-400">
                                (${(unitCostArsPreview * item.quantity).toLocaleString('es-AR', { minimumFractionDigits: 0 })} ARS)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* PIE DEL MODAL CON RESUMEN MULTIMONEDA Y ACCIÓN ATÓMICA */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-slate-200 dark:border-erp-border">
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                  Total Compra en Pesos (ARS)
                </span>
                <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                  ${totalArs.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="border-l border-slate-200 dark:border-erp-border pl-6">
                <span className="text-[11px] font-bold uppercase tracking-wider text-erp-gold block">
                  Contravalor Congelado (USD)
                </span>
                <span className="text-xl font-black font-mono text-erp-gold">
                  u$s {totalUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="block text-[10px] font-mono text-zinc-400">
                  TC: $1 USD = ${rate.toLocaleString('es-AR')} ARS
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={submitting}
                className="cursor-pointer text-xs"
              >
                Cancelar
              </Button>

              <Button
                type="submit"
                disabled={submitting || cart.length === 0 || hasInsufficientFunds}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-11 px-6 shadow-lg shadow-emerald-900/30 cursor-pointer gap-2"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Procesando Transacción...
                  </>
                ) : (
                  <>
                    <PackagePlus className="h-4 w-4" />
                    {paymentCondition === 'CONTADO'
                      ? 'Confirmar Compra y Debitar Tesorería'
                      : 'Confirmar Compra a Cuenta Corriente (CXP)'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
