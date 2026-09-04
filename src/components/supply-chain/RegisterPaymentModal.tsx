'use client';

import React, { useState, useEffect } from 'react';
import { UserRole } from '@/types';
import { getTreasuryAccounts, TreasuryAccount } from '@/app/actions/treasury';
import { registerPurchasePaymentAction } from '@/app/actions/purchases';
import { 
  Wallet, AlertTriangle, CheckCircle, RefreshCw, X, Building 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface RegisterPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  role: UserRole;
  purchase: {
    id: string;
    total_ars: number;
    supplier_name?: string;
  } | null;
}

export function RegisterPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  role,
  purchase,
}: RegisterPaymentModalProps) {
  const [treasuryAccounts, setTreasuryAccounts] = useState<TreasuryAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setNotes('');

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
  }, [isOpen]);

  if (!isOpen || !purchase) return null;

  const totalAmount = Number(purchase.total_ars || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedAccountId) {
      setErrorMsg('Por favor seleccione una cuenta de tesorería para debitar el pago.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await registerPurchasePaymentAction(role, {
        purchaseId: purchase.id,
        treasuryAccountId: selectedAccountId,
        notes: notes.trim() || undefined,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-[#13261E] border border-slate-200 dark:border-[#1B362A] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* CABECERA */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#1B362A] bg-slate-50/50 dark:bg-[#08130E]/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Registrar Pago a Proveedor
              </h2>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                Orden #{purchase.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* FORMULARIO */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 dark:bg-rose-950/30 dark:border-rose-900/40 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* DETALLES DE LA ORDEN */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#08130E] border border-slate-200 dark:border-[#1B362A] space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-600 dark:text-zinc-400">
              <span>Proveedor:</span>
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                <Building className="h-3 w-3 text-[#D0A96B]" />
                {purchase.supplier_name || 'Proveedor B2B'}
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-600 dark:text-zinc-400 border-t border-slate-200 dark:border-[#1B362A]/60 pt-2">
              <span>Importe Total a Liquidar:</span>
              <span className="font-mono text-base font-black text-emerald-600 dark:text-emerald-400">
                ${totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })} ARS
              </span>
            </div>
          </div>

          {/* SELECTOR DE CUENTA DE TESORERÍA */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 uppercase">
                Cuenta de Tesorería de Origen *
              </label>
              {loadingAccounts && (
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Cargando...
                </span>
              )}
            </div>

            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-300 dark:border-[#1B362A] bg-white dark:bg-[#08130E] px-3 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 font-medium"
            >
              {treasuryAccounts.length === 0 ? (
                <option value="">-- No hay cuentas de tesorería activas --</option>
              ) : (
                treasuryAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_name} ({acc.account_type === 'bank' ? 'Banco' : acc.account_type === 'wallet' ? 'Billetera' : 'Efectivo'}) — Saldo: ${acc.balance_ars.toLocaleString('es-AR')} ARS
                  </option>
                ))
              )}
            </select>
            <p className="text-[10px] text-slate-400 leading-snug">
              El pago se debitará contablemente de la cuenta seleccionada sin mezclarse con gastos operativos (OPEX).
            </p>
          </div>

          {/* NOTAS / COMPROBANTE */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 uppercase">
              Notas / Referencia de Transferencia (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej: Transferencia nº 894120 / Factura A cancelada"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-300 dark:border-[#1B362A] bg-white dark:bg-[#08130E] px-3 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* ACCIONES */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-[#1B362A]">
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
              disabled={isLoading || treasuryAccounts.length === 0}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20"
            >
              {isLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              Confirmar Pago y Descontar Fondos
            </Button>
          </div>
        </form>

      </div>
    </div>
  );
}
