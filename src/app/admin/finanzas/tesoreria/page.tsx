'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { 
  getTreasuryAccounts, 
  createTreasuryAccount, 
  updateAccountBalance, 
  transferBetweenAccounts, 
  TreasuryAccount 
} from '@/app/actions/treasury';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import { ExchangeRatesWidget } from '@/components/rates/ExchangeRatesWidget';
import { 
  ArrowLeft, RefreshCw, AlertCircle, DollarSign, Wallet, Landmark, 
  ArrowLeftRight, Plus, SlidersHorizontal, CheckCircle2, ShieldCheck, 
  Coins, Sparkles, Building2, CreditCard, Layers, X
} from 'lucide-react';
import Link from 'next/link';

export default function TesoreriaPage() {
  const { role } = useUserStore();
  const { rate: exchangeRate, refresh: refreshRate } = useExchangeRate();

  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal Transferencias
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [transferAmountInput, setTransferAmountInput] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  // Modal Ajuste Manual
  const [selectedAdjustAccount, setSelectedAdjustAccount] = useState<TreasuryAccount | null>(null);
  const [newBalanceInput, setNewBalanceInput] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Modal Nueva Cuenta
  const [isNewAccountModalOpen, setIsNewAccountModalOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState('wallet');
  const [newInitialBalance, setNewInitialBalance] = useState('0');
  const [newAccountSubmitting, setNewAccountSubmitting] = useState(false);
  const [newAccountError, setNewAccountError] = useState<string | null>(null);

  const fetchAccounts = async () => {
    setLoading(true);
    setError(null);
    const res = await getTreasuryAccounts();
    if (res.success && res.data) {
      setAccounts(res.data);
    } else {
      setError(res.error || 'Error al cargar las cuentas de tesorería');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  // Totales y Métricas
  const totalPatrimonioArs = accounts.reduce((sum, acc) => sum + acc.balance_ars, 0);
  const totalBancosArs = accounts.filter(acc => acc.account_type === 'bank').reduce((sum, acc) => sum + acc.balance_ars, 0);
  const totalBilleterasArs = accounts.filter(acc => acc.account_type === 'wallet').reduce((sum, acc) => sum + acc.balance_ars, 0);
  const totalEfectivoArs = accounts.filter(acc => acc.account_type === 'cash').reduce((sum, acc) => sum + acc.balance_ars, 0);

  // Handlers
  const handleOpenTransferModal = () => {
    if (accounts.length >= 2) {
      setFromAccountId(accounts[0].id);
      setToAccountId(accounts[1].id);
    }
    setTransferAmountInput('');
    setTransferNotes('');
    setTransferError(null);
    setIsTransferModalOpen(true);
  };

  const handleConfirmTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(transferAmountInput);
    if (isNaN(amount) || amount <= 0) {
      setTransferError('Ingresa un monto válido mayor a $0 ARS.');
      return;
    }

    setTransferSubmitting(true);
    setTransferError(null);

    const res = await transferBetweenAccounts(role, fromAccountId, toAccountId, amount, transferNotes);
    setTransferSubmitting(false);

    if (res.success) {
      setIsTransferModalOpen(false);
      fetchAccounts();
    } else {
      setTransferError(res.error || 'Error al realizar la transferencia');
    }
  };

  const handleOpenAdjustModal = (acc: TreasuryAccount) => {
    setSelectedAdjustAccount(acc);
    setNewBalanceInput(acc.balance_ars.toString());
    setAdjustReason('');
    setAdjustError(null);
  };

  const handleConfirmAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdjustAccount) return;

    const newBal = parseFloat(newBalanceInput);
    if (isNaN(newBal)) {
      setAdjustError('Ingresa un valor numérico válido.');
      return;
    }

    setAdjustSubmitting(true);
    setAdjustError(null);

    const res = await updateAccountBalance(role, selectedAdjustAccount.id, newBal, adjustReason);
    setAdjustSubmitting(false);

    if (res.success) {
      setSelectedAdjustAccount(null);
      fetchAccounts();
    } else {
      setAdjustError(res.error || 'Error al actualizar el saldo de la cuenta');
    }
  };

  const handleConfirmNewAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountName.trim()) {
      setNewAccountError('Ingresa el nombre de la cuenta (Ej: Naranja X).');
      return;
    }

    setNewAccountSubmitting(true);
    setNewAccountError(null);

    const res = await createTreasuryAccount(role, {
      account_name: newAccountName.trim(),
      account_type: newAccountType,
      initial_balance_ars: parseFloat(newInitialBalance) || 0
    });

    setNewAccountSubmitting(false);

    if (res.success) {
      setIsNewAccountModalOpen(false);
      setNewAccountName('');
      setNewInitialBalance('0');
      fetchAccounts();
    } else {
      setNewAccountError(res.error || 'Error al crear la cuenta');
    }
  };

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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#13261E] border border-[#1B362A] text-[#D0A96B]">
                <Landmark className="h-4.5 w-4.5" />
              </div>
              <span className="text-sm font-bold tracking-tight text-white uppercase font-serif">
                Tesorería Global & Cuentas
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-serif flex items-center gap-2">
              Flujo de Caja Continuo (Cash Flow 100% Online)
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Control centralizado de saldos reales por cuenta bancaria y billetera virtual, sin cierres diarios ni apertura de turno.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleOpenTransferModal}
              className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold text-xs shadow-md shadow-[#D0A96B]/20 cursor-pointer"
            >
              <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" /> Transferir entre Cuentas
            </Button>

            {role === 'admin' && (
              <Button
                variant="outline"
                onClick={() => {
                  setNewAccountName('');
                  setNewInitialBalance('0');
                  setNewAccountError(null);
                  setIsNewAccountModalOpen(true);
                }}
                className="border-[#1B362A] bg-[#13261E] text-xs font-semibold text-zinc-200 hover:bg-zinc-800 cursor-pointer"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5 text-[#D0A96B]" /> Nueva Cuenta
              </Button>
            )}

            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchAccounts}
              className="border-[#1B362A] bg-[#13261E] text-xs font-semibold text-zinc-400 hover:bg-zinc-800 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5 text-[#D0A96B]" />
            </Button>
          </div>
        </div>

        {/* MONITOR DE COTIZACIONES EN VIVO */}
        <ExchangeRatesWidget />

        {/* GRILLA DE METRICAS PRINCIPALES */}
        <div className="grid gap-4 sm:grid-cols-4">
          
          {/* PATRIMONIO TOTAL */}
          <Card className="border border-[#1B362A] bg-[#13261E] rounded-2xl shadow-xl sm:col-span-1">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardDescription className="text-[10px] font-extrabold uppercase tracking-widest text-[#D0A96B]">
                  Patrimonio Total Cuentas
                </CardDescription>
                <CardTitle className="text-2xl font-black text-[#D0A96B] font-mono mt-1.5 font-serif">
                  ${totalPatrimonioArs.toLocaleString('es-AR')} ARS
                </CardTitle>
                <div className="text-[10px] text-zinc-400 font-mono mt-1">
                  u$s {(totalPatrimonioArs / (exchangeRate || 1)).toFixed(2)} USD
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-[#D0A96B]/10 border border-[#D0A96B]/30 flex items-center justify-center text-[#D0A96B]">
                <Coins className="h-5 w-5" />
              </div>
            </CardHeader>
          </Card>

          {/* BILLETERAS VIRTUALES */}
          <Card className="border border-[#1B362A] bg-[#13261E] rounded-2xl shadow-xl">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardDescription className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400">
                  Billeteras (MP / Naranja X)
                </CardDescription>
                <CardTitle className="text-xl font-bold text-white font-mono mt-1.5 font-serif">
                  ${totalBilleterasArs.toLocaleString('es-AR')} ARS
                </CardTitle>
              </div>
              <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Wallet className="h-4.5 w-4.5" />
              </div>
            </CardHeader>
          </Card>

          {/* BANCOS */}
          <Card className="border border-[#1B362A] bg-[#13261E] rounded-2xl shadow-xl">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardDescription className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
                  Cuentas Bancarias
                </CardDescription>
                <CardTitle className="text-xl font-bold text-white font-mono mt-1.5 font-serif">
                  ${totalBancosArs.toLocaleString('es-AR')} ARS
                </CardTitle>
              </div>
              <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Landmark className="h-4.5 w-4.5" />
              </div>
            </CardHeader>
          </Card>

          {/* EFECTIVO */}
          <Card className="border border-[#1B362A] bg-[#13261E] rounded-2xl shadow-xl">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardDescription className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
                  Efectivo Físico
                </CardDescription>
                <CardTitle className="text-xl font-bold text-white font-mono mt-1.5 font-serif">
                  ${totalEfectivoArs.toLocaleString('es-AR')} ARS
                </CardTitle>
              </div>
              <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <DollarSign className="h-4.5 w-4.5" />
              </div>
            </CardHeader>
          </Card>

        </div>

        {/* LISTADO DE CUENTAS DE TESORERÍA */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white font-serif flex items-center gap-2">
              <Layers className="h-4.5 w-4.5 text-[#D0A96B]" />
              Saldos en Tiempo Real por Cuenta
            </h2>
            <span className="text-xs text-zinc-400 font-mono">{accounts.length} cuentas activas</span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 bg-[#13261E] rounded-2xl border border-[#1B362A]">
              <RefreshCw className="h-8 w-8 animate-spin text-[#D0A96B]" />
              <span className="text-xs text-zinc-400">Cargando saldos de tesorería...</span>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs text-center space-y-2">
              <AlertCircle className="h-8 w-8 mx-auto" />
              <p className="font-bold">{error}</p>
              <Button variant="outline" onClick={fetchAccounts} size="sm" className="border-rose-500/30">Reintentar</Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {accounts.map((acc) => {
                const isPositive = acc.balance_ars >= 0;
                let IconComponent = Wallet;
                let typeBadge = 'Billetera Virtual';
                let badgeColor = 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30';

                if (acc.account_type === 'bank') {
                  IconComponent = Landmark;
                  typeBadge = 'Cuenta Bancaria';
                  badgeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
                } else if (acc.account_type === 'cash') {
                  IconComponent = DollarSign;
                  typeBadge = 'Efectivo';
                  badgeColor = 'text-amber-400 bg-amber-500/10 border-amber-500/30';
                }

                return (
                  <Card key={acc.id} className="border border-[#1B362A] bg-[#13261E] rounded-2xl shadow-xl hover:border-[#D0A96B]/50 transition-all flex flex-col justify-between">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                          <IconComponent className="h-3 w-3" /> {typeBadge}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          Activa
                        </span>
                      </div>

                      <CardTitle className="text-lg font-bold text-white font-serif mt-3">
                        {acc.account_name}
                      </CardTitle>
                      
                      <div className="pt-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 block">
                          Saldo Disponible
                        </span>
                        <div className={`text-2xl font-black font-mono mt-0.5 ${isPositive ? 'text-white' : 'text-rose-400'}`}>
                          ${acc.balance_ars.toLocaleString('es-AR')} <span className="text-xs text-zinc-400">ARS</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                          u$s {(acc.balance_ars / (exchangeRate || 1)).toFixed(2)} USD
                        </div>
                      </div>
                    </CardHeader>

                    {role === 'admin' && (
                      <CardFooter className="pt-3 border-t border-[#1B362A] bg-[#08130E]/40 px-6 py-3 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenAdjustModal(acc)}
                          className="h-7 text-[11px] font-bold border-[#1B362A] bg-[#08130E] text-zinc-300 hover:bg-zinc-800 hover:text-white cursor-pointer"
                        >
                          <SlidersHorizontal className="mr-1 h-3 w-3 text-[#D0A96B]" /> Ajustar Saldo
                        </Button>
                      </CardFooter>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

      </main>

      {/* MODAL TRANSFERENCIA ENTRE CUENTAS */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#13261E] border border-[#1B362A] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <form onSubmit={handleConfirmTransfer}>
              <CardHeader className="border-b border-[#1B362A] pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold text-white font-serif flex items-center gap-2">
                    <ArrowLeftRight className="h-5 w-5 text-[#D0A96B]" />
                    Transferir entre Cuentas
                  </CardTitle>
                  <button
                    type="button"
                    onClick={() => setIsTransferModalOpen(false)}
                    className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <CardDescription className="text-xs text-zinc-400 mt-1">
                  Mueve saldo entre tus cuentas de forma atómica y transparente.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 p-6 max-h-[70vh] overflow-y-auto">
                {transferError && (
                  <div className="flex gap-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-400">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span className="font-medium">{transferError}</span>
                  </div>
                )}

                {/* Cuenta Origen */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Desde Cuenta (Origen) *
                  </label>
                  <select
                    value={fromAccountId}
                    onChange={(e) => setFromAccountId(e.target.value)}
                    disabled={transferSubmitting}
                    className="flex h-9 w-full rounded-lg border border-[#1B362A] bg-[#08130E] px-3 py-1 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-[#D0A96B] disabled:opacity-50"
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.account_name} (${acc.balance_ars.toLocaleString('es-AR')} ARS)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cuenta Destino */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#D0A96B]">
                    Hacia Cuenta (Destino) *
                  </label>
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    disabled={transferSubmitting}
                    className="flex h-9 w-full rounded-lg border border-[#1B362A] bg-[#08130E] px-3 py-1 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-[#D0A96B] disabled:opacity-50"
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.account_name} (${acc.balance_ars.toLocaleString('es-AR')} ARS)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Monto a Transferir */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Monto a Transferir (ARS) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-zinc-500">$</span>
                    <Input
                      required
                      type="number"
                      placeholder="Monto ARS..."
                      value={transferAmountInput}
                      onChange={(e) => setTransferAmountInput(e.target.value)}
                      disabled={transferSubmitting}
                      className="pl-7 bg-[#08130E] border-[#1B362A] text-white font-mono font-bold text-sm disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Notas u Observaciones */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Notas / Motivo (Opcional)
                  </label>
                  <Input
                    placeholder="Ej. Traspaso de saldo a Brubank para pago de insumos..."
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    disabled={transferSubmitting}
                    className="bg-[#08130E] border-[#1B362A] text-xs text-white disabled:opacity-50"
                  />
                </div>
              </CardContent>

              <CardFooter className="border-t border-[#1B362A] pt-4 flex justify-end gap-3 bg-[#08130E]/60 px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsTransferModalOpen(false)}
                  disabled={transferSubmitting}
                  className="border-[#1B362A] bg-[#13261E] text-zinc-300 hover:bg-zinc-800"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={transferSubmitting}
                  className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold text-xs shadow-md shadow-[#D0A96B]/20 cursor-pointer"
                >
                  {transferSubmitting ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Transferiendo...
                    </>
                  ) : (
                    'Confirmar Transferencia'
                  )}
                </Button>
              </CardFooter>
            </form>
          </div>
        </div>
      )}

      {/* MODAL AJUSTE MANUAL DE SALDO */}
      {selectedAdjustAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#13261E] border border-[#1B362A] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <form onSubmit={handleConfirmAdjust}>
              <CardHeader className="border-b border-[#1B362A] pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold text-white font-serif flex items-center gap-2">
                    <SlidersHorizontal className="h-5 w-5 text-[#D0A96B]" />
                    Ajuste Manual de Saldo
                  </CardTitle>
                  <button
                    type="button"
                    onClick={() => setSelectedAdjustAccount(null)}
                    className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <CardDescription className="text-xs text-zinc-400 mt-1">
                  Cuenta: <strong className="text-white">{selectedAdjustAccount.account_name}</strong>
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 p-6 max-h-[70vh] overflow-y-auto">
                {adjustError && (
                  <div className="flex gap-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-400">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span className="font-medium">{adjustError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#D0A96B]">
                    Nuevo Saldo Real (ARS) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-zinc-500">$</span>
                    <Input
                      required
                      type="number"
                      value={newBalanceInput}
                      onChange={(e) => setNewBalanceInput(e.target.value)}
                      disabled={adjustSubmitting}
                      className="pl-7 bg-[#08130E] border-[#1B362A] text-white font-mono font-bold text-sm disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Motivo / Explicación del Ajuste
                  </label>
                  <Input
                    placeholder="Ej. Corrección por cobro no registrado o comisión..."
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    disabled={adjustSubmitting}
                    className="bg-[#08130E] border-[#1B362A] text-xs text-white disabled:opacity-50"
                  />
                </div>
              </CardContent>

              <CardFooter className="border-t border-[#1B362A] pt-4 flex justify-end gap-3 bg-[#08130E]/60 px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedAdjustAccount(null)}
                  disabled={adjustSubmitting}
                  className="border-[#1B362A] bg-[#13261E] text-zinc-300 hover:bg-zinc-800"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={adjustSubmitting}
                  className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold text-xs shadow-md shadow-[#D0A96B]/20 cursor-pointer"
                >
                  {adjustSubmitting ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                    </>
                  ) : (
                    'Guardar Nuevo Saldo'
                  )}
                </Button>
              </CardFooter>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NUEVA CUENTA */}
      {isNewAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#13261E] border border-[#1B362A] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <form onSubmit={handleConfirmNewAccount}>
              <CardHeader className="border-b border-[#1B362A] pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold text-white font-serif flex items-center gap-2">
                    <Plus className="h-5 w-5 text-[#D0A96B]" />
                    Agregar Nueva Cuenta
                  </CardTitle>
                  <button
                    type="button"
                    onClick={() => setIsNewAccountModalOpen(false)}
                    className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <CardDescription className="text-xs text-zinc-400 mt-1">
                  Registra un nuevo banco, billetera virtual o caja física en el sistema.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 p-6 max-h-[70vh] overflow-y-auto">
                {newAccountError && (
                  <div className="flex gap-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-400">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span className="font-medium">{newAccountError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Nombre de la Cuenta *
                  </label>
                  <Input
                    required
                    placeholder="Ej. Ualá, Banco Galicia, Naranja X 2..."
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    disabled={newAccountSubmitting}
                    className="bg-[#08130E] border-[#1B362A] text-white text-xs font-bold disabled:opacity-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Tipo de Cuenta *
                  </label>
                  <select
                    value={newAccountType}
                    onChange={(e) => setNewAccountType(e.target.value)}
                    disabled={newAccountSubmitting}
                    className="flex h-9 w-full rounded-lg border border-[#1B362A] bg-[#08130E] px-3 py-1 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-[#D0A96B] disabled:opacity-50"
                  >
                    <option value="wallet">💳 Billetera Virtual (Mercado Pago, Naranja X, etc.)</option>
                    <option value="bank">🏦 Banco (Brubank, BBVA, Galicia, etc.)</option>
                    <option value="cash">💵 Efectivo Físico</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#D0A96B]">
                    Saldo Inicial (ARS)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-zinc-500">$</span>
                    <Input
                      type="number"
                      placeholder="0"
                      value={newInitialBalance}
                      onChange={(e) => setNewInitialBalance(e.target.value)}
                      disabled={newAccountSubmitting}
                      className="pl-7 bg-[#08130E] border-[#1B362A] text-white font-mono font-bold text-sm disabled:opacity-50"
                    />
                  </div>
                </div>
              </CardContent>

              <CardFooter className="border-t border-[#1B362A] pt-4 flex justify-end gap-3 bg-[#08130E]/60 px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsNewAccountModalOpen(false)}
                  disabled={newAccountSubmitting}
                  className="border-[#1B362A] bg-[#13261E] text-zinc-300 hover:bg-zinc-800"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={newAccountSubmitting}
                  className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold text-xs shadow-md shadow-[#D0A96B]/20 cursor-pointer"
                >
                  {newAccountSubmitting ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Creando...
                    </>
                  ) : (
                    'Crear Cuenta'
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
