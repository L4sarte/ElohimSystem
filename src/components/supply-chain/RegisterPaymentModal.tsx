'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { UserRole } from '@/types';
import { PurchaseCurrency } from '@/types/supplyChain';
import { getTreasuryAccounts, TreasuryAccount } from '@/app/actions/treasury';
import { settleProviderDebtAction } from '@/app/actions/purchases';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import {
  Wallet,
  AlertTriangle,
  RefreshCw,
  X,
  Building,
  DollarSign,
  Coins,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export interface DebtForPayment {
  id: string;
  purchase_id?: string | null;
  total_ars: number;
  amount_paid?: number;
  amount_remaining?: number;
  supplier_name?: string;
  due_date?: string | null;
}

interface RegisterPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  role: UserRole;
  purchase: DebtForPayment | null;
}

export function RegisterPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  role,
  purchase,
}: RegisterPaymentModalProps) {
  const { rate: rawExchangeRate } = useExchangeRate();
  const exchangeRate = rawExchangeRate && rawExchangeRate > 0 ? rawExchangeRate : 1250;

  const [treasuryAccounts, setTreasuryAccounts] = useState<TreasuryAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [currency, setCurrency] = useState<PurchaseCurrency>('ARS');
  const [amountInput, setAmountInput] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const totalDebtArs = Number(purchase?.total_ars || 0);
  const alreadyPaidArs = Number(purchase?.amount_paid || 0);
  const remainingDebtArs = useMemo(() => {
    if (!purchase) return 0;
    if (purchase.amount_remaining !== undefined && purchase.amount_remaining !== null) {
      return Math.max(0, Number(purchase.amount_remaining));
    }
    return Math.max(0, Number((totalDebtArs - alreadyPaidArs).toFixed(2)));
  }, [purchase, totalDebtArs, alreadyPaidArs]);

  const remainingDebtUsd = useMemo(
    () => (exchangeRate > 0 ? Number((remainingDebtArs / exchangeRate).toFixed(2)) : 0),
    [remainingDebtArs, exchangeRate]
  );

  useEffect(() => {
    if (!isOpen || !purchase) return;
    setErrorMsg(null);
    setNotes('');
    setCurrency('ARS');
    setAmountInput(remainingDebtArs.toFixed(2));

    async function loadAccounts() {
      setLoadingAccounts(true);
      const res = await getTreasuryAccounts();
      if (res.success && res.data && res.data.length > 0) {
        setTreasuryAccounts(res.data);
        setSelectedAccountId(res.data[0].id);
      }
      setLoadingAccounts(false);
    }

    loadAccounts();
  }, [isOpen, purchase, remainingDebtArs]);

  if (!isOpen || !purchase) return null;

  const parsedAmount = parseFloat(amountInput) || 0;
  const effectiveArsToDebit =
    currency === 'USD'
      ? Number((parsedAmount * exchangeRate).toFixed(2))
      : Number(parsedAmount.toFixed(2));

  const selectedAccount = treasuryAccounts.find((a) => a.id === selectedAccountId);
  const hasInsufficientFunds =
    selectedAccount !== undefined && effectiveArsToDebit > selectedAccount.balance_ars;

  const isPartialPayment =
    effectiveArsToDebit > 0 && effectiveArsToDebit < remainingDebtArs - 0.5;

  const handleSetPercentage = (pct: number) => {
    if (currency === 'ARS') {
      setAmountInput(((remainingDebtArs * pct) / 100).toFixed(2));
    } else {
      setAmountInput(((remainingDebtUsd * pct) / 100).toFixed(2));
    }
  };

  const handleCurrencySwitch = (newCurr: PurchaseCurrency) => {
    setCurrency(newCurr);
    if (newCurr === 'ARS') {
      setAmountInput(remainingDebtArs.toFixed(2));
    } else {
      setAmountInput(remainingDebtUsd.toFixed(2));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedAccountId) {
      setErrorMsg('Por favor seleccione una cuenta de tesorería para debitar el pago.');
      return;
    }

    if (parsedAmount <= 0) {
      setErrorMsg('Ingrese un monto válido mayor a 0.');
      return;
    }

    if (effectiveArsToDebit > remainingDebtArs + 1) {
      setErrorMsg(
        `El monto a abonar ($${effectiveArsToDebit.toLocaleString('es-AR', { minimumFractionDigits: 2 })} ARS) supera el saldo pendiente ($${remainingDebtArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })} ARS).`
      );
      return;
    }

    if (hasInsufficientFunds && selectedAccount) {
      setErrorMsg(
        `Saldo insuficiente en "${selectedAccount.account_name}" (Disponible: $${selectedAccount.balance_ars.toLocaleString('es-AR')} ARS).`
      );
      return;
    }

    setIsLoading(true);

    try {
      const res = await settleProviderDebtAction(role, {
        debt_id: purchase.id,
        amount_paid: parsedAmount,
        treasury_account_id: selectedAccountId,
        currency,
        exchange_rate: exchangeRate,
        notes: notes.trim() || null,
      });

      if (!res.success) {
        throw new Error(res.error || 'Error al registrar el pago');
      }

      toast.success(res.message || 'Pago a proveedor registrado exitosamente.');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Error al registrar pago:', err);
      const msg = err instanceof Error ? err.message : 'Error al registrar pago';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const refCode = (purchase.purchase_id || purchase.id).slice(0, 8).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-erp-surface border border-slate-200 dark:border-erp-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* CABECERA */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-erp-border bg-slate-50/50 dark:bg-erp-bg/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white font-serif">
                Liquidación de Deuda a Proveedor (CXP)
              </h2>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                Comprobante #{refCode} • Cotización Blue: ${exchangeRate.toLocaleString('es-AR')} ARS
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg cursor-pointer transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* FORMULARIO */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 dark:bg-rose-950/30 dark:border-rose-900/40 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* DETALLES DE LA DEUDA */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-erp-bg border border-slate-200 dark:border-erp-border space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-600 dark:text-zinc-400">
              <span>Proveedor Acreedor:</span>
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5 text-erp-gold" />
                {purchase.supplier_name || 'Proveedor B2B'}
              </span>
            </div>

            {alreadyPaidArs > 0 && (
              <div className="flex justify-between items-center text-slate-500 dark:text-zinc-400 text-[11px]">
                <span>Monto Original / Abonado Previamente:</span>
                <span className="font-mono">
                  ${totalDebtArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })} /{' '}
                  <strong className="text-emerald-500">
                    ${alreadyPaidArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </strong>
                </span>
              </div>
            )}

            <div className="flex justify-between items-center text-slate-600 dark:text-zinc-400 border-t border-slate-200 dark:border-erp-border/60 pt-2">
              <span className="font-semibold">Saldo Pendiente Restante:</span>
              <div className="text-right">
                <span className="font-mono text-base font-black text-amber-600 dark:text-amber-400 block">
                  ${remainingDebtArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })} ARS
                </span>
                <span className="font-mono text-[11px] text-erp-gold font-bold">
                  ≈ u$s {remainingDebtUsd.toFixed(2)} USD
                </span>
              </div>
            </div>
          </div>

          {/* SELECTOR DE MONEDA Y MONTO A ABONAR (TOTAL O PARCIAL) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 uppercase">
                Monto a Abonar (Pago Total o Parcial) *
              </label>

              <div className="inline-flex rounded-lg border border-slate-200 dark:border-erp-border bg-slate-100 dark:bg-erp-bg p-0.5">
                <button
                  type="button"
                  onClick={() => handleCurrencySwitch('ARS')}
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                    currency === 'ARS'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-500 dark:text-zinc-400 hover:text-white'
                  }`}
                >
                  ARS ($)
                </button>
                <button
                  type="button"
                  onClick={() => handleCurrencySwitch('USD')}
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                    currency === 'USD'
                      ? 'bg-erp-gold text-erp-bg shadow-sm'
                      : 'text-slate-500 dark:text-zinc-400 hover:text-white'
                  }`}
                >
                  USD (u$s)
                </button>
              </div>
            </div>

            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-mono font-bold text-slate-400">
                {currency === 'ARS' ? '$' : 'u$s'}
              </span>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="pl-10 font-mono font-bold text-sm h-10 bg-white dark:bg-erp-bg border-slate-300 dark:border-erp-border"
              />
            </div>

            {/* Botones rápidos de porcentaje */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSetPercentage(25)}
                  className="px-2 py-0.5 rounded border border-slate-200 dark:border-erp-border bg-slate-50 dark:bg-erp-bg text-[11px] font-mono text-slate-600 dark:text-zinc-300 hover:border-emerald-500 cursor-pointer"
                >
                  25%
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPercentage(50)}
                  className="px-2 py-0.5 rounded border border-slate-200 dark:border-erp-border bg-slate-50 dark:bg-erp-bg text-[11px] font-mono text-slate-600 dark:text-zinc-300 hover:border-emerald-500 cursor-pointer"
                >
                  50%
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPercentage(100)}
                  className="px-2.5 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 cursor-pointer"
                >
                  100% (Saldar Total)
                </button>
              </div>

              <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
                Débito: <strong className="text-emerald-400">${effectiveArsToDebit.toLocaleString('es-AR', { minimumFractionDigits: 2 })} ARS</strong>
              </span>
            </div>

            {isPartialPayment && (
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-600 dark:text-amber-300 flex items-center justify-between">
                <span>Se registrará como <strong>Pago Parcial</strong>.</span>
                <span className="font-mono font-bold">
                  Restarán: ${(remainingDebtArs - effectiveArsToDebit).toLocaleString('es-AR', { minimumFractionDigits: 2 })} ARS
                </span>
              </div>
            )}
          </div>

          {/* SELECTOR DE CUENTA DE TESORERÍA */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 uppercase">
                Cuenta de Tesorería de Origen *
              </label>
              {loadingAccounts && (
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Cargando...
                </span>
              )}
            </div>

            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-300 dark:border-erp-border bg-white dark:bg-erp-bg px-3 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 font-medium"
            >
              {treasuryAccounts.length === 0 ? (
                <option value="">-- No hay cuentas de tesorería activas --</option>
              ) : (
                treasuryAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_name} (
                    {acc.account_type === 'bank'
                      ? 'Banco'
                      : acc.account_type === 'wallet'
                      ? 'Billetera'
                      : 'Efectivo'}
                    ) — Saldo: ${acc.balance_ars.toLocaleString('es-AR')} ARS
                  </option>
                ))
              )}
            </select>

            {hasInsufficientFunds && selectedAccount && (
              <p className="text-[11px] text-rose-500 font-semibold flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Saldo insuficiente en {selectedAccount.account_name} (${selectedAccount.balance_ars.toLocaleString('es-AR')} ARS).
              </p>
            )}

            <p className="text-[11px] text-slate-400 leading-snug">
              Genera un asiento <code className="text-emerald-400">EGRESO_COMPRA_STOCK</code> en Tesorería sin contaminar OPEX.
            </p>
          </div>

          {/* NOTAS / COMPROBANTE */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 uppercase">
              Notas / Comprobante de Pago (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej: Transferencia #894120 / Recibo parcial..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-300 dark:border-erp-border bg-white dark:bg-erp-bg px-3 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* ACCIONES */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-erp-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="text-xs cursor-pointer"
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              disabled={isLoading || treasuryAccounts.length === 0 || hasInsufficientFunds}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20"
            >
              {isLoading ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {isPartialPayment ? 'Registrar Pago Parcial' : 'Liquidar Deuda Total'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
