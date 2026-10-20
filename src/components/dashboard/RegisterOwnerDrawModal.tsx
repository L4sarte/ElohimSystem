'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Wallet, DollarSign, ArrowDownRight, Building2, AlertCircle, 
  RefreshCw, ShieldCheck, X 
} from 'lucide-react';
import { toast } from 'sonner';
import { getTreasuryAccounts, TreasuryAccount } from '@/app/actions/treasury';
import { registerOwnerDraw } from '@/app/actions/ownerDraws';
import { useExchangeRate } from '@/hooks/use-exchange-rate';

interface RegisterOwnerDrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableProfitArs?: number;
  personalPayoutRate?: number;
  onSuccess?: () => void;
}

export function RegisterOwnerDrawModal({
  isOpen,
  onClose,
  availableProfitArs = 0,
  personalPayoutRate = 30,
  onSuccess,
}: RegisterOwnerDrawModalProps) {
  const { rate: exchangeRate } = useExchangeRate();

  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [amountArs, setAmountArs] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loadingAccounts, setLoadingAccounts] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Cargar cuentas de tesorería al abrir el modal
  useEffect(() => {
    if (isOpen) {
      setLoadingAccounts(true);
      getTreasuryAccounts().then((res) => {
        if (res.success && res.data && res.data.length > 0) {
          setAccounts(res.data);
          // Preseleccionar la primera cuenta activa con saldo positivo
          const withBalance = res.data.find((a) => (a.balance_ars || 0) > 0);
          setSelectedAccountId(withBalance?.id || res.data[0].id);
        }
        setLoadingAccounts(false);
      });
    }
  }, [isOpen]);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const currentAccountBalance = selectedAccount?.balance_ars || 0;

  const numAmountArs = parseFloat(amountArs) || 0;
  const numAmountUsd = exchangeRate && exchangeRate > 0 ? numAmountArs / exchangeRate : 0;

  const isExceedingAccount = numAmountArs > currentAccountBalance;
  const isExceedingPersonalPool = availableProfitArs > 0 && numAmountArs > availableProfitArs;

  const handleApplyPreset = (ratio: number) => {
    const target = Math.round(availableProfitArs * ratio);
    setAmountArs(target > 0 ? target.toString() : '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (numAmountArs <= 0) {
      toast.error('Ingresa un monto válido mayor a $0.');
      return;
    }

    if (!selectedAccountId) {
      toast.error('Selecciona una cuenta de Tesorería de origen.');
      return;
    }

    if (isExceedingAccount) {
      toast.error(`Fondos insuficientes en ${selectedAccount?.account_name || 'la cuenta seleccionada'}.`);
      return;
    }

    try {
      setSubmitting(true);
      const res = await registerOwnerDraw({
        amountArs: numAmountArs,
        accountSourceId: selectedAccountId,
        amountUsd: numAmountUsd > 0 ? Number(numAmountUsd.toFixed(2)) : undefined,
        exchangeRateUsed: exchangeRate || undefined,
        notes: notes.trim() || undefined,
      });

      if (res.success) {
        toast.success(`Retiro personal de $${Math.round(numAmountArs).toLocaleString('es-AR')} asentado con éxito.`);
        setAmountArs('');
        setNotes('');
        onClose();
        if (onSuccess) onSuccess();
      } else {
        toast.error(res.error || 'No se pudo registrar la extracción personal.');
      }
    } catch (err: unknown) {
      console.error('Error al registrar retiro:', err);
      toast.error('Error de comunicación con el servidor.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-lg">
      <div className="space-y-5">
        {/* ENCABEZADO */}
        <div className="flex items-start justify-between border-b border-erp-border/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Wallet className="h-5 w-5 text-erp-gold" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-serif tracking-wide">
                Registrar Retiro Personal
              </h3>
              <p className="text-xs text-zinc-400">
                Extracción de utilidades contra Tesorería sin impactar en OPEX.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* BANNER INFORMATIVO DISPONIBLE */}
          <div className="p-3.5 rounded-xl bg-erp-surface border border-emerald-500/30 flex items-center justify-between text-xs font-mono">
            <div>
              <span className="text-zinc-400 block text-[11px] uppercase tracking-wider">
                Disponible Personal Teórico ({personalPayoutRate}%)
              </span>
              <span className="text-emerald-400 font-extrabold text-base">
                ${Math.round(availableProfitArs).toLocaleString('es-AR')} ARS
              </span>
            </div>
            {exchangeRate ? (
              <div className="text-right">
                <span className="text-zinc-400 block text-[11px] uppercase tracking-wider">
                  Equivalente Ref. (USD)
                </span>
                <span className="text-erp-gold font-bold text-sm">
                  u$s {Math.round(availableProfitArs / exchangeRate).toLocaleString('es-AR')}
                </span>
              </div>
            ) : null}
          </div>

          {/* CUENTA DE ORIGEN DE TESORERÍA */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-erp-gold" />
                Cuenta de Tesorería de Origen *
              </span>
              {selectedAccount && (
                <span className={`text-[11px] font-mono ${currentAccountBalance > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  Saldo: ${Math.round(currentAccountBalance).toLocaleString('es-AR')}
                </span>
              )}
            </label>

            {loadingAccounts ? (
              <div className="h-11 w-full bg-erp-surface animate-pulse rounded-xl" />
            ) : (
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-erp-surface border border-erp-border text-white text-xs font-medium focus:ring-1 focus:ring-erp-gold focus:outline-none"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_name} — Saldo: ${Math.round(acc.balance_ars || 0).toLocaleString('es-AR')} ARS
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* MONTO A EXTRAER EN ARS */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
                Monto del Retiro (ARS) *
              </span>
              {exchangeRate && numAmountUsd > 0 && (
                <span className="text-[11px] font-mono text-zinc-400">
                  ≈ u$s {numAmountUsd.toFixed(2)} (@ ${exchangeRate})
                </span>
              )}
            </label>

            <Input
              type="number"
              min={1}
              step={100}
              placeholder="Ej. 150000"
              value={amountArs}
              onChange={(e) => setAmountArs(e.target.value)}
              className="bg-erp-surface border-erp-border text-emerald-300 font-mono font-bold text-lg h-11 focus:ring-emerald-500"
            />

            {/* PRESETS RÁPIDOS */}
            {availableProfitArs > 0 && (
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[11px] text-zinc-400">Retiro sugerido:</span>
                {[
                  { label: '25%', ratio: 0.25 },
                  { label: '50%', ratio: 0.5 },
                  { label: '75%', ratio: 0.75 },
                  { label: '100% Total', ratio: 1 },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handleApplyPreset(p.ratio)}
                    className="px-2 py-0.5 text-[11px] font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-erp-border transition-colors cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}

            {/* ALERTAS DE FONDOS */}
            {isExceedingAccount && (
              <p className="text-[11px] text-rose-400 flex items-center gap-1 font-mono pt-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                El monto supera el saldo disponible en la cuenta seleccionada (${Math.round(currentAccountBalance).toLocaleString('es-AR')}).
              </p>
            )}
            {!isExceedingAccount && isExceedingPersonalPool && (
              <p className="text-[11px] text-amber-400 flex items-center gap-1 font-mono pt-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Atención: El monto excede el disponible de ganancia mensual sugerida (${Math.round(availableProfitArs).toLocaleString('es-AR')}).
              </p>
            )}
          </div>

          {/* NOTAS O MOTIVO */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              Notas / Referencia (Opcional)
            </label>
            <Input
              placeholder="Ej. Retiro quincenal de utilidades, transferencia personal"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-erp-surface border-erp-border text-white text-xs h-10"
            />
          </div>

          {/* BADGE DE SEGURIDAD CONTABLE */}
          <div className="p-3 rounded-xl bg-erp-bg border border-erp-border flex items-start gap-2.5 text-[11px] text-zinc-400">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Este movimiento debita directamente el balance de Tesorería bajo concepto de extracción patrimonial privada. <strong className="text-zinc-200">No altera costos fijos ni operativos (OPEX).</strong>
            </span>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-erp-border/80">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="border-erp-border text-zinc-300 hover:bg-zinc-800"
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              disabled={submitting || numAmountArs <= 0 || isExceedingAccount || !selectedAccountId}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 px-5"
            >
              {submitting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Procesando...
                </>
              ) : (
                <>
                  <ArrowDownRight className="mr-1.5 h-4 w-4" /> Confirmar Retiro
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
