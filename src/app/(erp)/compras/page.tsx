'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import {
  getPurchases,
  getAccountsPayable,
  PurchaseRecord,
  AccountPayableRecord,
} from '@/app/actions/purchases';
import { getSuppliers, createSupplier, SupplierRecord } from '@/app/actions/suppliers';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import {
  ArrowLeft,
  Plus,
  Truck,
  PackagePlus,
  Clock,
  Check,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
  CreditCard,
  Building,
  Sparkles,
  Wallet,
  Calendar,
  AlertTriangle,
  Search,
  User,
  Phone,
  Mail,
  X,
  FileText,
  CheckCircle2,
  Coins,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import { InTransitDashboard } from '@/components/supply-chain/InTransitDashboard';
import {
  RegisterPaymentModal,
  DebtForPayment,
} from '@/components/supply-chain/RegisterPaymentModal';
import { NewPurchaseModal } from '@/components/supply-chain/NewPurchaseModal';

type ComprasTab = 'purchases' | 'payables' | 'in_transit' | 'providers';

function calculateDaysOverdue(dueDate?: string | null): number {
  if (!dueDate) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate.split('T')[0]}T00:00:00`);
  const diffMs = today.getTime() - due.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function ComprasDashboardContent() {
  const searchParams = useSearchParams();
  const productIdParam = searchParams.get('productId') || undefined;
  const tabParam = searchParams.get('tab');

  const role = useUserStore((state) => state.role);
  const { rate: rawExchangeRate, refresh: refreshRate } = useExchangeRate();
  const exchangeRate = rawExchangeRate && rawExchangeRate > 0 ? rawExchangeRate : 1250;

  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [payables, setPayables] = useState<AccountPayableRecord[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pestaña activa (4 pestañas unificadas: Historial de Compras, Cuentas por Pagar, Mercadería en Camino, Proveedores B2B)
  const [activeTab, setActiveTab] = useState<ComprasTab>(() => {
    if (tabParam === 'payables' || tabParam === 'cxp') return 'payables';
    if (tabParam === 'in_transit') return 'in_transit';
    if (tabParam === 'providers' || tabParam === 'proveedores') return 'providers';
    return 'purchases';
  });

  // Modal de Nueva Compra (+ Nueva Compra)
  const [isNewPurchaseModalOpen, setIsNewPurchaseModalOpen] = useState<boolean>(
    Boolean(productIdParam || tabParam === 'po_builder' || tabParam === 'nueva')
  );

  // Modal de Liquidación de Deuda / Pago a Proveedor
  const [selectedDebtForPayment, setSelectedDebtForPayment] =
    useState<DebtForPayment | null>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);

  // Filtros de búsqueda
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [payableFilter, setPayableFilter] = useState<'ALL' | 'PENDING' | 'OVERDUE' | 'SETTLED'>('ALL');
  const [providerSearch, setProviderSearch] = useState('');

  // Modal de Alta de Proveedor (en la pestaña Proveedores B2B)
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supNotes, setSupNotes] = useState('');
  const [supSubmitting, setSupSubmitting] = useState(false);

  const handleOpenPayModal = (debt: DebtForPayment) => {
    setSelectedDebtForPayment(debt);
    setIsPayModalOpen(true);
  };

  const fetchDashboardData = useCallback(async () => {
    if (role !== 'admin') return;
    setLoading(true);
    setError(null);

    try {
      const [pRes, cxpRes, supRes] = await Promise.all([
        getPurchases(role),
        getAccountsPayable(role),
        getSuppliers(role),
      ]);

      if (pRes.success && pRes.data) {
        setPurchases(pRes.data);
      }
      if (cxpRes.success && cxpRes.data) {
        setPayables(cxpRes.data);
      }
      if (supRes.success && supRes.data) {
        setSuppliers(supRes.data);
      }
    } catch (err) {
      console.error('Error cargando datos de /compras:', err);
      setError('Error al sincronizar los datos del módulo de compras.');
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Crear nuevo proveedor desde la pestaña Proveedores B2B
  const handleCreateSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) return;

    setSupSubmitting(true);
    const res = await createSupplier(role, {
      name: supName.trim(),
      contact_name: supContact.trim() || null,
      phone: supPhone.trim() || null,
      email: supEmail.trim() || null,
      notes: supNotes.trim() || null,
    });
    setSupSubmitting(false);

    if (res.success) {
      toast.success(`Proveedor "${supName.trim()}" registrado exitosamente.`);
      setIsSupplierModalOpen(false);
      setSupName('');
      setSupContact('');
      setSupPhone('');
      setSupEmail('');
      setSupNotes('');
      fetchDashboardData();
    } else {
      toast.error(res.error || 'Error al registrar proveedor.');
    }
  };

  // ============================================================================
  // CÁLCULO DE TARJETAS KPI (Con precisión de 2 decimales y contravalor en USD)
  // ============================================================================
  const totalPurchasesArs = useMemo(
    () =>
      purchases
        .filter((p) => p.status !== 'cancelled')
        .reduce((sum, p) => sum + Number(p.total_ars || 0), 0),
    [purchases]
  );

  const totalPurchasesUsd = useMemo(
    () =>
      purchases
        .filter((p) => p.status !== 'cancelled')
        .reduce((sum, p) => {
          const usd = Number(p.total_usd || 0);
          if (usd > 0) return sum + usd;
          const rate = Number(p.exchange_rate || exchangeRate || 1250);
          return sum + (rate > 0 ? Number(p.total_ars || 0) / rate : 0);
        }, 0),
    [purchases, exchangeRate]
  );

  // Deuda Pendiente conectada dinámicamente con la suma de `amount_remaining` de `accounts_payable`
  const totalDebtRemainingArs = useMemo(
    () =>
      payables
        .filter((c) => c.status !== 'settled' && c.status !== 'paid')
        .reduce((sum, c) => sum + Number(c.amount_remaining ?? 0), 0),
    [payables]
  );

  const totalDebtRemainingUsd = useMemo(
    () => (exchangeRate > 0 ? totalDebtRemainingArs / exchangeRate : 0),
    [totalDebtRemainingArs, exchangeRate]
  );

  const activeDebtsCount = useMemo(
    () =>
      payables.filter(
        (c) => c.status !== 'settled' && c.status !== 'paid' && Number(c.amount_remaining || 0) > 0
      ).length,
    [payables]
  );

  const overdueDebtsCount = useMemo(
    () =>
      payables.filter(
        (c) =>
          c.status !== 'settled' &&
          c.status !== 'paid' &&
          Number(c.amount_remaining || 0) > 0 &&
          calculateDaysOverdue(c.due_date) > 0
      ).length,
    [payables]
  );

  // Filtrado de Historial de Compras
  const filteredPurchases = useMemo(() => {
    const q = purchaseSearch.trim().toLowerCase();
    if (!q) return purchases;
    return purchases.filter((p) => {
      const matchId = p.id.toLowerCase().includes(q);
      const matchSup = (p.suppliers?.name || '').toLowerCase().includes(q);
      const matchProd = (p.purchase_items || []).some(
        (it) =>
          (it.products?.name || '').toLowerCase().includes(q) ||
          (it.products?.sku || '').toLowerCase().includes(q)
      );
      return matchId || matchSup || matchProd;
    });
  }, [purchases, purchaseSearch]);

  // Filtrado de Cuentas por Pagar (CXP)
  const filteredPayables = useMemo(() => {
    return payables.filter((cxp) => {
      const isSettled = cxp.status === 'settled' || cxp.status === 'paid' || cxp.amount_remaining <= 0;
      const daysOverdue = calculateDaysOverdue(cxp.due_date);
      if (payableFilter === 'PENDING') return !isSettled;
      if (payableFilter === 'OVERDUE') return !isSettled && daysOverdue > 0;
      if (payableFilter === 'SETTLED') return isSettled;
      return true;
    });
  }, [payables, payableFilter]);

  // Directorio de Proveedores enriquecido con Saldos Deudores (Cuenta Corriente) y Volumen Histórico
  const enrichedSuppliers = useMemo(() => {
    const q = providerSearch.trim().toLowerCase();
    return suppliers
      .filter((s) => {
        if (!q) return true;
        return (
          s.name.toLowerCase().includes(q) ||
          (s.contact_name || '').toLowerCase().includes(q) ||
          (s.phone || '').toLowerCase().includes(q) ||
          (s.email || '').toLowerCase().includes(q)
        );
      })
      .map((sup) => {
        const supPurchases = purchases.filter(
          (p) => (p.supplier_id || p.suppliers?.id) === sup.id && p.status !== 'cancelled'
        );
        const supDebts = payables.filter(
          (ap) =>
            ap.supplier_id === sup.id &&
            ap.status !== 'settled' &&
            ap.status !== 'paid' &&
            Number(ap.amount_remaining || 0) > 0
        );

        const totalBoughtArs = supPurchases.reduce((s, p) => s + Number(p.total_ars || 0), 0);
        const debtBalanceArs = supDebts.reduce((s, d) => s + Number(d.amount_remaining || 0), 0);
        const firstPendingDebt = supDebts[0] || null;

        return {
          ...sup,
          ordersCount: supPurchases.length,
          totalBoughtArs,
          debtBalanceArs,
          debtBalanceUsd: exchangeRate > 0 ? debtBalanceArs / exchangeRate : 0,
          pendingDebtsCount: supDebts.length,
          firstPendingDebt,
        };
      });
  }, [suppliers, purchases, payables, providerSearch, exchangeRate]);

  // Denegar acceso para rol vendedor
  if (role !== 'admin') {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 dark:bg-erp-bg dark:text-zinc-50 transition-colors duration-300">
        <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-erp-border dark:bg-erp-bg/80">
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
              <CardTitle className="text-lg font-bold text-rose-800 dark:text-rose-400">
                Acceso Restringido
              </CardTitle>
              <CardDescription className="dark:text-rose-500/80">
                El módulo de compras B2B y cuentas por pagar es exclusivo para administradores.
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
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 dark:bg-erp-bg dark:text-zinc-50 transition-colors duration-300">
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-erp-border dark:bg-erp-bg/80">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 max-w-7xl">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
              <span>Dashboard</span>
            </Link>
            <span className="text-slate-300 dark:text-zinc-800">|</span>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-md shadow-emerald-500/20">
                <PackagePlus className="h-4.5 w-4.5" />
              </div>
              <span className="text-sm font-bold tracking-tight text-slate-800 dark:text-zinc-100 uppercase font-serif">
                Compras, Proveedores & Cuentas por Pagar
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
      <main className="flex-1 container mx-auto px-4 py-8 sm:px-6 max-w-7xl">
        {/* Cabecera Ejecutiva */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-erp-surface/40 p-6 rounded-2xl border border-erp-border">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-erp-gold flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Supply Chain, Tesorería & Cuentas Corrientes
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2 font-serif mt-1">
              Gestión Integral de Compras y Cuentas por Pagar (CXP)
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Abastecimiento B2B con descuento automático en Tesorería al contado o administración de deuda a plazo con proveedores.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={fetchDashboardData}
              disabled={loading}
              className="cursor-pointer border-erp-border text-xs h-10"
            >
              <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Sincronizar
            </Button>

            <Button
              onClick={() => setIsNewPurchaseModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-lg shadow-emerald-900/20 text-xs font-bold h-10 px-4"
            >
              <Plus className="mr-2 h-4 w-4" /> + Nueva Compra
            </Button>
          </div>
        </div>

        {/* TARJETAS DE RESUMEN KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {/* KPI 1: TOTAL COMPRAS HISTÓRICAS */}
          <Card className="border-slate-200 dark:border-erp-border bg-white dark:bg-erp-surface rounded-2xl shadow-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  TOTAL COMPRAS HISTÓRICAS
                </CardDescription>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Coins className="h-4 w-4" />
                </div>
              </div>
              <CardTitle className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-1">
                ${totalPurchasesArs.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ARS
              </CardTitle>
              <div className="flex items-center justify-between text-xs font-mono pt-1">
                <span className="text-erp-gold font-bold">
                  Contravalor: u$s {totalPurchasesUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </span>
                <span className="text-[11px] text-zinc-500">
                  {purchases.length} {purchases.length === 1 ? 'operación' : 'operaciones'}
                </span>
              </div>
            </CardHeader>
          </Card>

          {/* KPI 2: DEUDA PENDIENTE (CONECTADO CON amount_remaining DE accounts_payable) */}
          <Card className="border-slate-200 dark:border-erp-border bg-white dark:bg-erp-surface rounded-2xl shadow-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-[11px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  DEUDA PENDIENTE (CUENTAS POR PAGAR)
                </CardDescription>
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                  <CreditCard className="h-4 w-4" />
                </div>
              </div>
              <CardTitle className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1">
                ${totalDebtRemainingArs.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ARS
              </CardTitle>
              <div className="flex items-center justify-between text-xs font-mono pt-1">
                <span className="text-amber-500/90 font-bold">
                  ≈ u$s {totalDebtRemainingUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </span>
                {overdueDebtsCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                    {overdueDebtsCount} vencida(s)
                  </span>
                ) : (
                  <span className="text-[11px] text-zinc-500">
                    {activeDebtsCount} {activeDebtsCount === 1 ? 'obligación activa' : 'obligaciones activas'}
                  </span>
                )}
              </div>
            </CardHeader>
          </Card>

          {/* KPI 3: PROVEEDORES B2B & FLUJO ACTIVO */}
          <Card className="border-slate-200 dark:border-erp-border bg-white dark:bg-erp-surface rounded-2xl shadow-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  PROVEEDORES B2B & COTIZACIÓN
                </CardDescription>
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Building className="h-4 w-4" />
                </div>
              </div>
              <CardTitle className="text-2xl font-black text-erp-gold font-mono mt-1">
                {suppliers.length} {suppliers.length === 1 ? 'proveedor' : 'proveedores'}
              </CardTitle>
              <div className="flex items-center justify-between text-xs font-mono pt-1">
                <span className="text-zinc-400">
                  Dólar Blue Ref: <strong className="text-white">${exchangeRate.toLocaleString('es-AR')} ARS</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('providers')}
                  className="text-[11px] font-bold text-emerald-400 hover:underline cursor-pointer"
                >
                  Ver saldos →
                </button>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* NAVEGACIÓN FLUIDA POR PESTAÑAS UNIFICADAS */}
        <div className="flex flex-wrap border-b border-slate-200 dark:border-erp-border mb-6 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('purchases')}
            className={`pb-3 px-4 font-bold text-xs transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'purchases'
                ? 'border-emerald-500 text-emerald-400 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileText className="h-4 w-4 text-emerald-400" />
            Historial de Compras ({purchases.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payables')}
            className={`pb-3 px-4 font-bold text-xs transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'payables'
                ? 'border-emerald-500 text-emerald-400 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CreditCard className="h-4 w-4 text-amber-400" />
            Cuentas por Pagar (CXP) ({activeDebtsCount})
            {overdueDebtsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-black">
                {overdueDebtsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('in_transit')}
            className={`pb-3 px-4 font-bold text-xs transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'in_transit'
                ? 'border-emerald-500 text-emerald-400 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Truck className="h-4 w-4 text-erp-gold" />
            Mercadería en Camino
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('providers')}
            className={`pb-3 px-4 font-bold text-xs transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'providers'
                ? 'border-emerald-500 text-emerald-400 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Building className="h-4 w-4 text-indigo-400" />
            Proveedores B2B ({suppliers.length})
          </button>
        </div>

        {/* CONTENIDO DE PESTAÑA 3: MERCADERÍA EN CAMINO */}
        {activeTab === 'in_transit' && <InTransitDashboard />}

        {/* CONTENIDO DE PESTAÑA 1: HISTORIAL DE COMPRAS */}
        {activeTab === 'purchases' && (
          <Card className="border-slate-200 dark:border-erp-border rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-200 dark:border-erp-border bg-slate-50/40 dark:bg-erp-surface/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Filtrar compras por proveedor, producto, SKU o #ID..."
                  value={purchaseSearch}
                  onChange={(e) => setPurchaseSearch(e.target.value)}
                  className="pl-9 h-9 text-xs bg-white dark:bg-erp-bg"
                />
              </div>
              <Button
                size="sm"
                onClick={() => setIsNewPurchaseModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Registrar Compra
              </Button>
            </div>

            <CardContent className="p-0 overflow-x-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
                  <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                    Cargando historial de compras...
                  </span>
                </div>
              ) : filteredPurchases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                  <PackagePlus className="h-10 w-10 text-slate-300 dark:text-zinc-700" />
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    Sin Compras Registradas
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm">
                    No se encontraron órdenes de compra con los filtros aplicados.
                  </p>
                  <Button
                    onClick={() => setIsNewPurchaseModalOpen(true)}
                    className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs cursor-pointer"
                  >
                    + Nueva Compra
                  </Button>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-erp-border bg-slate-50/50 dark:bg-erp-surface/40 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      <th className="p-4 pl-6">ID / Fecha</th>
                      <th className="p-4">Proveedor</th>
                      <th className="p-4 text-center">Estado Recepción</th>
                      <th className="p-4 text-right">Total (ARS)</th>
                      <th className="p-4 text-right">Contravalor (USD)</th>
                      <th className="p-4 text-center">Estado de Pago</th>
                      <th className="p-4 pr-6">Productos / Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-900 text-sm">
                    {filteredPurchases.map((p) => {
                      const isPaid =
                        p.payment_status === 'paid_cash' || p.payment_status === 'paid';
                      const isPartial = p.payment_status === 'partial_payment';

                      // Buscar deuda vinculada si existe para saber monto restante exacto
                      const linkedDebt = payables.find((ap) => ap.purchase_id === p.id);
                      const remainingArs = linkedDebt
                        ? Number(linkedDebt.amount_remaining)
                        : Number(p.total_ars || 0);

                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-erp-surface/30 transition-colors"
                        >
                          <td className="p-4 pl-6 font-mono text-xs whitespace-nowrap">
                            <div className="font-bold text-slate-900 dark:text-white">
                              #{p.id.split('-')[0].toUpperCase()}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {new Date(p.created_at).toLocaleString('es-AR')}
                            </div>
                          </td>

                          <td className="p-4">
                            <div className="font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                              <Building className="h-3.5 w-3.5 text-erp-gold shrink-0" />
                              {p.suppliers?.name || 'Proveedor N/A'}
                            </div>
                            {p.notes && (
                              <div className="text-[11px] text-zinc-500 truncate max-w-xs mt-0.5">
                                {p.notes}
                              </div>
                            )}
                          </td>

                          {/* Estado de Recepción */}
                          <td className="p-4 text-center whitespace-nowrap">
                            {p.status === 'received' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="h-3 w-3" /> Recibida en Stock
                              </span>
                            ) : p.status === 'in_transit' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                <Truck className="h-3 w-3" /> En Tránsito
                              </span>
                            ) : p.status === 'cancelled' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                Cancelada
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                                Borrador
                              </span>
                            )}
                          </td>

                          <td className="p-4 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                            ${Number(p.total_ars).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          <td className="p-4 text-right font-mono text-xs text-erp-gold font-bold whitespace-nowrap">
                            u$s {Number(p.total_usd || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* Estado de Pago */}
                          <td className="p-4 text-center whitespace-nowrap">
                            <div className="flex flex-col items-center gap-1.5">
                              {isPaid ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-500/20">
                                  <Check className="h-3 w-3" /> Pagada (Contado / Saldada)
                                </span>
                              ) : isPartial ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-500/10 dark:text-sky-400 border border-sky-500/20">
                                  <Clock className="h-3 w-3" /> Pago Parcial (Resta: ${remainingArs.toLocaleString('es-AR')})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-500/20">
                                  <Clock className="h-3 w-3" /> Crédito Pendiente (CXP)
                                </span>
                              )}

                              {!isPaid && (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleOpenPayModal({
                                      id: linkedDebt?.id || p.id,
                                      purchase_id: p.id,
                                      total_ars: Number(linkedDebt?.amount_total ?? p.total_ars ?? 0),
                                      amount_paid: Number(linkedDebt?.amount_paid ?? 0),
                                      amount_remaining: remainingArs,
                                      supplier_name: p.suppliers?.name,
                                      due_date: p.payment_due_date,
                                    })
                                  }
                                  className="h-6 px-2.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-sm flex items-center gap-1"
                                >
                                  <Wallet className="h-3 w-3" /> Registrar Pago
                                </Button>
                              )}
                            </div>
                          </td>

                          <td className="p-4 pr-6">
                            <div className="space-y-1 max-w-xs">
                              {p.purchase_items && p.purchase_items.length > 0 ? (
                                p.purchase_items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="text-xs text-slate-600 dark:text-zinc-300 flex items-center justify-between gap-2"
                                  >
                                    <span className="font-semibold truncate">
                                      {item.products?.name || 'Ítem'}
                                    </span>
                                    <span className="font-mono text-[11px] text-zinc-400 shrink-0">
                                      x{item.quantity} (${Number(item.unit_cost_ars).toLocaleString('es-AR')})
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <span className="text-xs text-zinc-500 italic">
                                  Ver detalle en OC #{p.id.slice(0, 8).toUpperCase()}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}

        {/* CONTENIDO DE PESTAÑA 2: CUENTAS POR PAGAR (CXP) */}
        {activeTab === 'payables' && (
          <Card className="border-slate-200 dark:border-erp-border rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-200 dark:border-erp-border bg-slate-50/40 dark:bg-erp-surface/50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'ALL', label: `Todas (${payables.length})` },
                  { id: 'PENDING', label: `Pendientes (${activeDebtsCount})` },
                  { id: 'OVERDUE', label: `Vencidas (${overdueDebtsCount})` },
                  { id: 'SETTLED', label: 'Saldadas' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setPayableFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      payableFilter === f.id
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-white dark:bg-erp-bg text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-erp-border hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="text-xs font-mono text-zinc-400">
                Total exigible:{' '}
                <strong className="text-amber-400">
                  ${totalDebtRemainingArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })} ARS
                </strong>
              </div>
            </div>

            <CardContent className="p-0 overflow-x-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
                  <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                    Consultando Cuentas por Pagar...
                  </span>
                </div>
              ) : filteredPayables.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                  <CreditCard className="h-10 w-10 text-slate-300 dark:text-zinc-700" />
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    Sin Deudas en esta Vista
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm">
                    No hay obligaciones pendientes de pago que coincidan con el filtro seleccionado.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-erp-border bg-slate-50/50 dark:bg-erp-surface/40 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      <th className="p-4 pl-6">Proveedor</th>
                      <th className="p-4">Factura / PO Vinculada</th>
                      <th className="p-4 text-right">Monto Original</th>
                      <th className="p-4 text-right">Abonado</th>
                      <th className="p-4 text-right">Saldo Restante</th>
                      <th className="p-4">Vencimiento</th>
                      <th className="p-4 text-center">Estado / Atraso</th>
                      <th className="p-4 pr-6 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-900 text-sm">
                    {filteredPayables.map((cxp) => {
                      const isSettled =
                        cxp.status === 'settled' ||
                        cxp.status === 'paid' ||
                        cxp.amount_remaining <= 0;
                      const daysOverdue = isSettled ? 0 : calculateDaysOverdue(cxp.due_date);
                      const isOverdue = !isSettled && daysOverdue > 0;
                      const rate = Number(cxp.exchange_rate || exchangeRate || 1250);
                      const originalUsd = rate > 0 ? cxp.amount_total / rate : 0;
                      const remainingUsd = rate > 0 ? cxp.amount_remaining / rate : 0;
                      const poRef = (cxp.purchase_id || cxp.id).slice(0, 8).toUpperCase();

                      return (
                        <tr
                          key={cxp.id}
                          className={`hover:bg-slate-50/60 dark:hover:bg-erp-surface/30 transition-colors ${
                            isOverdue ? 'bg-rose-950/10' : ''
                          }`}
                        >
                          <td className="p-4 pl-6">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <Building className="h-3.5 w-3.5 text-erp-gold shrink-0" />
                              {cxp.suppliers?.name || 'Proveedor N/A'}
                            </div>
                            {cxp.suppliers?.phone && (
                              <span className="text-[11px] font-mono text-zinc-500 block">
                                Tel: {cxp.suppliers.phone}
                              </span>
                            )}
                          </td>

                          <td className="p-4 font-mono text-xs">
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-erp-bg border border-slate-200 dark:border-erp-border font-bold text-indigo-400">
                              PO #{poRef}
                            </span>
                            <span className="block text-[11px] text-zinc-500 mt-0.5">
                              Emitida: {new Date(cxp.created_at).toLocaleDateString('es-AR')}
                            </span>
                          </td>

                          <td className="p-4 text-right font-mono whitespace-nowrap">
                            <div className="font-bold text-slate-800 dark:text-zinc-200">
                              ${cxp.amount_total.toLocaleString('es-AR', { minimumFractionDigits: 2 })} ARS
                            </div>
                            <div className="text-[11px] text-erp-gold">
                              u$s {originalUsd.toFixed(2)} USD
                            </div>
                          </td>

                          <td className="p-4 text-right font-mono text-xs text-emerald-500 font-bold whitespace-nowrap">
                            ${cxp.amount_paid.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </td>

                          <td className="p-4 text-right font-mono whitespace-nowrap">
                            <div
                              className={`font-black text-base ${
                                isSettled
                                  ? 'text-emerald-500'
                                  : isOverdue
                                  ? 'text-rose-400'
                                  : 'text-amber-500'
                              }`}
                            >
                              ${cxp.amount_remaining.toLocaleString('es-AR', { minimumFractionDigits: 2 })} ARS
                            </div>
                            {!isSettled && (
                              <div className="text-[11px] text-zinc-400">
                                ≈ u$s {remainingUsd.toFixed(2)} USD
                              </div>
                            )}
                          </td>

                          <td className="p-4 text-xs font-mono whitespace-nowrap">
                            {cxp.due_date ? (
                              <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-zinc-300">
                                <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                                {new Date(`${cxp.due_date.split('T')[0]}T12:00:00`).toLocaleDateString('es-AR')}
                              </div>
                            ) : (
                              <span className="text-zinc-500 italic">Sin vencimiento</span>
                            )}
                          </td>

                          <td className="p-4 text-center whitespace-nowrap">
                            <div className="flex flex-col items-center gap-1">
                              {isSettled ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  <Check className="h-3 w-3" /> Saldada
                                </span>
                              ) : cxp.status === 'partial' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                  Pago Parcial
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  Pendiente
                                </span>
                              )}

                              {isOverdue && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black shadow-sm">
                                  <AlertTriangle className="h-3 w-3" /> {daysOverdue}{' '}
                                  {daysOverdue === 1 ? 'día de atraso' : 'días de atraso'}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="p-4 pr-6 text-right whitespace-nowrap">
                            {!isSettled ? (
                              <Button
                                size="sm"
                                onClick={() =>
                                  handleOpenPayModal({
                                    id: cxp.id,
                                    purchase_id: cxp.purchase_id,
                                    total_ars: cxp.amount_total,
                                    amount_paid: cxp.amount_paid,
                                    amount_remaining: cxp.amount_remaining,
                                    supplier_name: cxp.suppliers?.name,
                                    due_date: cxp.due_date,
                                  })
                                }
                                className="h-8 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-sm inline-flex items-center gap-1.5"
                              >
                                <Wallet className="h-3.5 w-3.5" /> Registrar Pago
                              </Button>
                            ) : (
                              <span className="text-xs font-mono text-zinc-500">Liquidada</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}

        {/* CONTENIDO DE PESTAÑA 4: PROVEEDORES B2B (DIRECTORIO Y SALDOS DEUDORES) */}
        {activeTab === 'providers' && (
          <Card className="border-slate-200 dark:border-erp-border rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-200 dark:border-erp-border bg-slate-50/40 dark:bg-erp-surface/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar proveedor por razón social, contacto, teléfono o email..."
                  value={providerSearch}
                  onChange={(e) => setProviderSearch(e.target.value)}
                  className="pl-9 h-9 text-xs bg-white dark:bg-erp-bg"
                />
              </div>

              <Button
                size="sm"
                onClick={() => setIsSupplierModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Nuevo Proveedor B2B
              </Button>
            </div>

            <CardContent className="p-0 overflow-x-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
                  <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                    Cargando directorio de proveedores...
                  </span>
                </div>
              ) : enrichedSuppliers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                  <Building className="h-10 w-10 text-slate-300 dark:text-zinc-700" />
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    Sin Proveedores Registrados
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm">
                    Agrega distribuidores e importadores para gestionar compras y cuentas corrientes.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-erp-border bg-slate-50/50 dark:bg-erp-surface/40 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      <th className="p-4 pl-6">Proveedor / Razón Social</th>
                      <th className="p-4">Contacto Comercial</th>
                      <th className="p-4 text-center">Órdenes Históricas</th>
                      <th className="p-4 text-right">Volumen Comprado (ARS)</th>
                      <th className="p-4 text-right">Saldo Deudor (Cta. Cte.)</th>
                      <th className="p-4 pr-6 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-900 text-sm">
                    {enrichedSuppliers.map((sup) => (
                      <tr
                        key={sup.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-erp-surface/30 transition-colors"
                      >
                        <td className="p-4 pl-6">
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Building className="h-4 w-4 text-indigo-400 shrink-0" />
                            {sup.name}
                          </div>
                          {sup.notes && (
                            <span className="text-[11px] text-zinc-500 block mt-0.5 truncate max-w-xs">
                              {sup.notes}
                            </span>
                          )}
                        </td>

                        <td className="p-4 text-xs text-slate-600 dark:text-zinc-300 space-y-0.5">
                          {sup.contact_name && (
                            <div className="flex items-center gap-1.5">
                              <User className="h-3 w-3 text-zinc-400" />
                              <span>{sup.contact_name}</span>
                            </div>
                          )}
                          {sup.phone && (
                            <div className="flex items-center gap-1.5 font-mono">
                              <Phone className="h-3 w-3 text-zinc-400" />
                              <span>{sup.phone}</span>
                            </div>
                          )}
                          {sup.email && (
                            <div className="flex items-center gap-1.5">
                              <Mail className="h-3 w-3 text-zinc-400" />
                              <span>{sup.email}</span>
                            </div>
                          )}
                          {!sup.contact_name && !sup.phone && !sup.email && (
                            <span className="text-zinc-500 italic">Sin datos de contacto</span>
                          )}
                        </td>

                        <td className="p-4 text-center font-mono text-xs font-bold text-zinc-300">
                          {sup.ordersCount} {sup.ordersCount === 1 ? 'compra' : 'compras'}
                        </td>

                        <td className="p-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                          ${sup.totalBoughtArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </td>

                        <td className="p-4 text-right font-mono">
                          {sup.debtBalanceArs > 0 ? (
                            <div>
                              <span className="font-black text-amber-500 block">
                                ${sup.debtBalanceArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })} ARS
                              </span>
                              <span className="text-[11px] text-erp-gold">
                                ≈ u$s {sup.debtBalanceUsd.toFixed(2)} USD ({sup.pendingDebtsCount} fact.)
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <Check className="h-3 w-3" /> Al día ($0,00)
                            </span>
                          )}
                        </td>

                        <td className="p-4 pr-6 text-right">
                          {sup.firstPendingDebt ? (
                            <Button
                              size="sm"
                              onClick={() =>
                                handleOpenPayModal({
                                  id: sup.firstPendingDebt!.id,
                                  purchase_id: sup.firstPendingDebt!.purchase_id,
                                  total_ars: sup.firstPendingDebt!.amount_total,
                                  amount_paid: sup.firstPendingDebt!.amount_paid,
                                  amount_remaining: sup.firstPendingDebt!.amount_remaining,
                                  supplier_name: sup.name,
                                  due_date: sup.firstPendingDebt!.due_date,
                                })
                              }
                              className="h-7 px-2.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                            >
                              <Wallet className="h-3 w-3 mr-1" /> Abonar Saldo
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setIsNewPurchaseModalOpen(true)}
                              className="h-7 px-2.5 text-[11px] border-erp-border cursor-pointer"
                            >
                              <Plus className="h-3 w-3 mr-1" /> Comprar
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}

        {/* MODAL DE NUEVA COMPRA (+ Nueva Compra) */}
        <NewPurchaseModal
          isOpen={isNewPurchaseModalOpen}
          onClose={() => setIsNewPurchaseModalOpen(false)}
          onSuccess={fetchDashboardData}
          role={role}
          initialProductId={productIdParam}
        />

        {/* MODAL DE LIQUIDACIÓN DE DEUDA A PROVEEDOR (CXP) */}
        <RegisterPaymentModal
          isOpen={isPayModalOpen}
          onClose={() => setIsPayModalOpen(false)}
          onSuccess={fetchDashboardData}
          role={role}
          purchase={selectedDebtForPayment}
        />

        {/* MODAL DE ALTA DE PROVEEDOR B2B */}
        {isSupplierModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white dark:bg-erp-surface border border-slate-200 dark:border-erp-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <form onSubmit={handleCreateSupplierSubmit}>
                <CardHeader className="border-b border-slate-100 dark:border-erp-border pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 font-serif">
                      <Building className="h-5 w-5 text-indigo-400" />
                      Registrar Proveedor B2B
                    </CardTitle>
                    <button
                      type="button"
                      onClick={() => setIsSupplierModalOpen(false)}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <CardDescription className="text-xs">
                    Agrega un nuevo distribuidor o importador al directorio comercial.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3 p-6">
                  <div>
                    <label className="text-[11px] font-bold uppercase text-zinc-400 block mb-1">
                      Nombre / Razón Social *
                    </label>
                    <Input
                      required
                      placeholder="Ej. Star Company / LP Import"
                      value={supName}
                      onChange={(e) => setSupName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase text-zinc-400 block mb-1">
                      Persona de Contacto
                    </label>
                    <Input
                      placeholder="Ej. Roberto Gómez"
                      value={supContact}
                      onChange={(e) => setSupContact(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold uppercase text-zinc-400 block mb-1">
                        Teléfono / WhatsApp
                      </label>
                      <Input
                        placeholder="+54 9 11..."
                        value={supPhone}
                        onChange={(e) => setSupPhone(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold uppercase text-zinc-400 block mb-1">
                        Email
                      </label>
                      <Input
                        type="email"
                        placeholder="ventas@proveedor.com"
                        value={supEmail}
                        onChange={(e) => setSupEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase text-zinc-400 block mb-1">
                      Notas Comerciales
                    </label>
                    <Input
                      placeholder="Condiciones de cuenta corriente, marcas..."
                      value={supNotes}
                      onChange={(e) => setSupNotes(e.target.value)}
                    />
                  </div>
                </CardContent>

                <CardFooter className="border-t border-slate-100 dark:border-erp-border pt-4 flex justify-end gap-2 px-6 py-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsSupplierModalOpen(false)}
                    disabled={supSubmitting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={supSubmitting}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
                  >
                    {supSubmitting ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-1.5" />
                    ) : null}
                    Guardar Proveedor
                  </Button>
                </CardFooter>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ComprasDashboardPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-erp-bg text-zinc-400">
          <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      }
    >
      <ComprasDashboardContent />
    </React.Suspense>
  );
}
