'use client';

import React from 'react';
import { PaymentMethodConfig } from '@/app/actions/fees';
import { TreasuryAccount } from '@/app/actions/treasury';
import { Input } from '@/components/ui/input';
import {
  AlertCircle, CreditCard, DollarSign, Landmark, Percent, ShieldCheck, TrendingDown
} from 'lucide-react';

interface PaymentSplitterProps {
  activeMethods: PaymentMethodConfig[];
  selectedMethodId: string;
  onMethodIdChange: (id: string) => void;
  treasuryAccounts: TreasuryAccount[];
  selectedTreasuryAccountId?: string;
  onTreasuryAccountIdChange?: (id: string) => void;
  selectedCashAccountId: string;
  onCashAccountIdChange: (id: string) => void;
  selectedDigitalAccountId: string;
  onDigitalAccountIdChange: (id: string) => void;
  selectedUsdAccountId?: string;
  onUsdAccountIdChange?: (id: string) => void;
  cashArs: string;
  onCashArsChange: (value: string) => void;
  digitalArs: string;
  onDigitalArsChange: (value: string) => void;
  cashUsd: string;
  onCashUsdChange: (value: string) => void;
  amountPaidTodayInput: string;
  onAmountPaidTodayChange: (value: string) => void;
  feePercent: number;
  passFeeToCustomer: boolean;
  subtotalOriginalArs: number;
  subtotalAfterDiscountArs: number;
  discountAmountArs: number;
  discountPercentage: number;
  calculatedGatewayFeeArs: number;
  totalSurchargeArs: number;
  finalTotalArsToCharge: number;
  netReceivedArs: number;
  amountDueArs: number;
  totalPaidArs: number;
  differenceArs: number;
  isRegisteredClient: boolean;
  exchangeRate: number;
  totalUsd: number;
}

/**
 * Sección de división de métodos de pago del checkout bimonetario:
 * asignación multicuenta de tesorería (Efectivo / Transferencia / USD),
 * pasarela digital/cuotas, resumen en tiempo real, ingreso de valores
 * y estado del cobro.
 */
export function PaymentSplitter({
  activeMethods,
  selectedMethodId,
  onMethodIdChange,
  treasuryAccounts,
  selectedTreasuryAccountId,
  onTreasuryAccountIdChange,
  selectedCashAccountId,
  onCashAccountIdChange,
  selectedDigitalAccountId,
  onDigitalAccountIdChange,
  selectedUsdAccountId,
  onUsdAccountIdChange,
  cashArs,
  onCashArsChange,
  digitalArs,
  onDigitalArsChange,
  cashUsd,
  onCashUsdChange,
  amountPaidTodayInput,
  onAmountPaidTodayChange,
  feePercent,
  passFeeToCustomer,
  subtotalOriginalArs,
  subtotalAfterDiscountArs,
  discountAmountArs,
  discountPercentage,
  calculatedGatewayFeeArs,
  totalSurchargeArs,
  finalTotalArsToCharge,
  netReceivedArs,
  amountDueArs,
  totalPaidArs,
  differenceArs,
  isRegisteredClient,
  exchangeRate,
  totalUsd,
}: PaymentSplitterProps) {
  const hasDigitalPayment = Number(digitalArs) > 0 || Boolean(selectedMethodId);
  const hasCashUsd = Number(cashUsd) > 0;
  const isSplitPayment = (Number(cashArs) > 0 && hasDigitalPayment) || (Number(cashArs) > 0 && hasCashUsd) || (hasDigitalPayment && hasCashUsd);

  return (
    <>
      {/* SELECCIÓN DE CUENTAS DE DESTINO EN TESORERÍA (MULTI-CUENTA) */}
      <div className="space-y-2 pt-1 rounded-xl bg-erp-bg/80 p-3 border border-erp-border">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-erp-gold flex items-center gap-1.5">
            <Landmark className="h-3.5 w-3.5 text-erp-gold" />
            Cuentas de Tesorería Destino *
          </label>
          {isSplitPayment && (
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Pago Dividido / Multi-Cuenta
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {/* CUENTA PARA EFECTIVO */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-erp-gold" />
              Cuenta Efectivo (Caja)
            </label>
            <select
              value={selectedCashAccountId}
              onChange={(e) => {
                onCashAccountIdChange(e.target.value);
                if (onTreasuryAccountIdChange && !hasDigitalPayment) {
                  onTreasuryAccountIdChange(e.target.value);
                }
              }}
              className="flex h-8 w-full rounded-lg border border-erp-border bg-erp-surface px-2 py-1 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-erp-gold"
            >
              {treasuryAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  💵 {acc.account_name} (${acc.balance_ars.toLocaleString('es-AR')} ARS)
                </option>
              ))}
            </select>
          </div>

          {/* CUENTA PARA DIGITAL / TRANSFERENCIA */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1">
              <Landmark className="h-3 w-3 text-indigo-400" />
              Cuenta Digital / Transferencia
            </label>
            <select
              value={selectedDigitalAccountId}
              onChange={(e) => {
                onDigitalAccountIdChange(e.target.value);
                if (onTreasuryAccountIdChange && hasDigitalPayment) {
                  onTreasuryAccountIdChange(e.target.value);
                }
              }}
              className="flex h-8 w-full rounded-lg border border-erp-border bg-erp-surface px-2 py-1 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
            >
              {treasuryAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  🏛️ {acc.account_name} (${acc.balance_ars.toLocaleString('es-AR')} ARS)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* CUENTA PARA DÓLARES (SI SE INGRESA EFECTIVO USD) */}
        {hasCashUsd && (
          <div className="space-y-1 pt-1 border-t border-erp-border/60">
            <label className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
              <CreditCard className="h-3 w-3 text-emerald-400" />
              Cuenta Destino Dólares Billete
            </label>
            <select
              value={selectedUsdAccountId || selectedCashAccountId}
              onChange={(e) => onUsdAccountIdChange?.(e.target.value)}
              className="flex h-8 w-full rounded-lg border border-erp-border bg-erp-surface px-2 py-1 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
            >
              {treasuryAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  💵 {acc.account_name} (${acc.balance_ars.toLocaleString('es-AR')} ARS)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* SELECCIÓN DE PASARELA / MÉTODO DIGITAL DINÁMICO */}
      <div className="space-y-1.5 pt-1">
        <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center justify-between">
          <span>Pasarela Digital / Cuotas</span>
          {feePercent > 0 && (
            <span className="text-erp-gold font-extrabold text-[11px]">
              {passFeeToCustomer ? `+${feePercent}% Recargo Cliente` : `-${feePercent}% Retención MP`}
            </span>
          )}
        </label>

        <select
          value={selectedMethodId}
          onChange={(e) => onMethodIdChange(e.target.value)}
          className="flex h-9 w-full rounded-lg border border-erp-border bg-erp-bg px-3 py-1 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-erp-gold"
        >
          <option value="">💳 Cobro Directo / Efectivo / Transferencia (0% Recargo)</option>
          {activeMethods.map(m => {
            const mFee = m.fee_percentage !== undefined ? m.fee_percentage : (m.surcharge_percent || 0);
            const name = m.method_name || m.name || '';
            const passText = m.pass_fee_to_customer ? 'Recargo Cliente' : 'Absorbe Elohim';
            return (
              <option key={m.id} value={m.id}>
                💳 {name} {mFee > 0 ? `(${mFee}% - ${passText})` : '(0% Recargo)'}
              </option>
            );
          })}
        </select>
      </div>

      {/* RESUMEN DE LA ORDEN CON SIMULADOR EN TIEMPO REAL */}
      <div className="rounded-xl bg-erp-bg p-4 border border-erp-border space-y-2.5">
        <div className="flex justify-between items-center text-xs text-zinc-400">
          <span>Subtotal Original ARS:</span>
          <span className="font-mono font-bold text-white">
            ${subtotalOriginalArs.toLocaleString('es-AR')} ARS
          </span>
        </div>

        {discountAmountArs > 0 && (
          <div className="flex justify-between items-center text-xs text-emerald-400 font-mono font-bold">
            <span className="flex items-center gap-1">
              <TrendingDown className="h-3.5 w-3.5" /> Descuento Comercial ({discountPercentage}%):
            </span>
            <span>-${discountAmountArs.toLocaleString('es-AR')} ARS</span>
          </div>
        )}

        {discountAmountArs > 0 && (
          <div className="flex justify-between items-center text-xs text-zinc-300 font-mono">
            <span>Subtotal con Descuento:</span>
            <span className="font-bold text-white">${subtotalAfterDiscountArs.toLocaleString('es-AR')} ARS</span>
          </div>
        )}

        {/* DESGLOSE DINÁMICO DE COMISIÓN / RECARGO DE PASARELA */}
        {calculatedGatewayFeeArs > 0 && passFeeToCustomer && (
          <div className="p-2.5 rounded-lg bg-erp-gold/10 border border-erp-gold/30 text-xs text-erp-gold font-mono font-bold space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Percent className="h-3.5 w-3.5" /> Recargo Tarjeta ({feePercent}%):
              </span>
              <span>+${calculatedGatewayFeeArs.toLocaleString('es-AR')} ARS</span>
            </div>
            <div className="text-[11px] font-sans font-normal text-erp-gold-hover">
              Base con Descuento: ${subtotalAfterDiscountArs.toLocaleString('es-AR')} | Recargo Tarjeta: +${calculatedGatewayFeeArs.toLocaleString('es-AR')} | Total a Cobrar: ${finalTotalArsToCharge.toLocaleString('es-AR')}
            </div>
          </div>
        )}

        {calculatedGatewayFeeArs > 0 && !passFeeToCustomer && (
          <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 font-mono font-bold space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Retención MP ({feePercent}%):
              </span>
              <span>-${calculatedGatewayFeeArs.toLocaleString('es-AR')} ARS</span>
            </div>
            <div className="text-[11px] font-sans font-normal text-blue-300">
              El cliente abona: ${subtotalAfterDiscountArs.toLocaleString('es-AR')} | Retención MP: -${calculatedGatewayFeeArs.toLocaleString('es-AR')} | Neto a tu cuenta: ${netReceivedArs.toLocaleString('es-AR')}
            </div>
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t border-erp-border">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-500 block">
              Total Final a Cobrar (ARS)
            </span>
            <div className="text-2xl font-black text-white font-serif">
              ${finalTotalArsToCharge.toLocaleString('es-AR')}
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-500 block">
              Equiv. USD
            </span>
            <div className="text-xl font-black text-indigo-400 font-mono">
              u$s {totalUsd.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* INPUT MONTO ABONADO HOY & ADVERTENCIA PAGO PARCIAL */}
      <div className="space-y-1.5 p-3.5 rounded-xl bg-erp-bg border border-erp-border">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            Monto Abonado Hoy (ARS)
          </label>
          <span className="text-[11px] text-zinc-400">
            (Default: ${finalTotalArsToCharge.toLocaleString('es-AR')})
          </span>
        </div>
        
        <div className="relative">
          <span className="absolute left-3 top-2.5 text-xs font-bold text-zinc-500">$</span>
          <Input
            type="number"
            placeholder={`$${finalTotalArsToCharge.toLocaleString('es-AR')}`}
            value={amountPaidTodayInput}
            onChange={(e) => onAmountPaidTodayChange(e.target.value)}
            className="pl-7 bg-erp-surface border-erp-border text-white font-mono font-bold text-sm"
          />
        </div>

        {/* BADGE ESTILIZADO DE ADVERTENCIA DE SALDO PENDIENTE */}
        {amountDueArs > 0 && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400 space-y-1 mt-2">
            <div className="font-bold flex items-center gap-1.5 text-erp-gold">
              <AlertCircle className="h-4 w-4 text-erp-gold" />
              <span>Saldo Pendiente: <strong>${amountDueArs.toLocaleString('es-AR')} ARS</strong></span>
            </div>
            <p className="text-[11px] text-zinc-300 leading-snug">
              ⚡ Se registrará la venta como <strong className="text-amber-400">PAGO PARCIAL</strong>. El saldo de <strong>${amountDueArs.toLocaleString('es-AR')} ARS</strong> se enviará a Cuentas por Cobrar.
            </p>
          </div>
        )}
      </div>

      {/* ENTRADAS DE MÉTODOS DE PAGO */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 block">
          Ingreso de Valores Recibidos
        </label>
        
        <div className="grid grid-cols-3 gap-3">
          {/* EFECTIVO ARS */}
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400">
              <DollarSign className="h-3.5 w-3.5 text-erp-gold" />
              Efectivo ARS
            </label>
            <Input
              type="number"
              placeholder="ARS"
              value={cashArs}
              onChange={(e) => onCashArsChange(e.target.value)}
              className="bg-erp-bg border-erp-border text-white font-mono text-xs font-bold"
            />
          </div>

          {/* DIGITAL / TARJETA ARS */}
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400">
              <Landmark className="h-3.5 w-3.5 text-indigo-400" />
              Digital / Tarjeta
            </label>
            <Input
              type="number"
              placeholder="ARS"
              value={digitalArs}
              onChange={(e) => onDigitalArsChange(e.target.value)}
              className="bg-erp-bg border-erp-border text-white font-mono text-xs font-bold"
            />
          </div>

          {/* EFECTIVO USD */}
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400">
              <CreditCard className="h-3.5 w-3.5 text-emerald-400" />
              Dólares Billete
            </label>
            <Input
              type="number"
              placeholder="USD"
              value={cashUsd}
              onChange={(e) => onCashUsdChange(e.target.value)}
              className="bg-erp-bg border-erp-border text-white font-mono text-xs font-bold"
            />
          </div>
        </div>
      </div>

      {/* ESTADO DEL COBRO Y SALDOS */}
      <div className="rounded-xl border border-erp-border bg-erp-bg p-3 space-y-1.5 text-xs">
        <div className="flex justify-between text-zinc-400">
          <span>Total Recibido (Pesos):</span>
          <span className="font-semibold text-white font-mono">
            ${totalPaidArs.toLocaleString('es-AR')} ARS
          </span>
        </div>

        <div className="border-t border-erp-border pt-1.5 flex justify-between items-center">
          <span className="font-bold text-zinc-300">
            {differenceArs >= 0 ? 'Vuelto a Entregar:' : 'Saldo Pendiente (Fiado):'}
          </span>
          
          <div className="text-right">
            <div className={`text-base font-black font-mono ${differenceArs >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
              ${Math.abs(differenceArs).toLocaleString('es-AR')} ARS
            </div>
            <div className="text-[11px] text-zinc-500">
              o u$s {Math.abs(differenceArs / exchangeRate).toFixed(2)} USD
            </div>
          </div>
        </div>

        {amountDueArs > 0 && isRegisteredClient && (
          <div className="p-3 rounded-xl bg-erp-gold/10 border border-erp-gold/30 text-xs text-erp-gold-hover space-y-0.5">
            <div className="font-bold flex items-center gap-1 text-erp-gold">
              <span>★ Saldo a Cuenta Corriente (Fiado / Seña)</span>
            </div>
            <p className="text-[11px] opacity-90">
              Se generará automáticamente una Cuenta por Cobrar de <strong>${Math.abs(differenceArs).toLocaleString('es-AR')} ARS</strong> a nombre del cliente seleccionado.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
