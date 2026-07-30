'use client';

import React, { useState, useEffect } from 'react';
import { UserRole } from '@/types';
import { CartItem } from '@/hooks/use-pos-store';
import { getClients, createSaleTransaction } from '@/app/actions/sales';
import { getTreasuryAccounts, TreasuryAccount } from '@/app/actions/treasury';
import { useFeesStore } from '@/hooks/use-fees-store';
import { PaymentMethodConfig } from '@/app/actions/fees';
import { ReceiptTicket } from '@/components/pos/ReceiptTicket';
import { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, DollarSign, CreditCard, Landmark, CheckCircle, RefreshCw, AlertCircle, Sparkles, Percent, Printer, ShoppingBag, ShieldCheck } from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  role: UserRole;
  totalArs: number;
  exchangeRate: number;
  cartItems: CartItem[];
}

export function CheckoutModal({
  isOpen,
  onClose,
  onSuccess,
  role,
  totalArs,
  exchangeRate,
  cartItems
}: CheckoutModalProps) {
  const { activeMethods, fetchActiveMethods } = useFeesStore();

  const [step, setStep] = useState<'checkout' | 'success'>('checkout');

  const [clients, setClients] = useState<any[]>([]);
  const [clientId, setClientId] = useState<string>('default');
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Métodos de pago ingresados
  const [cashArs, setCashArs] = useState<string>('');
  const [digitalArs, setDigitalArs] = useState<string>('');
  const [cashUsd, setCashUsd] = useState<string>('');

  // Cuentas de tesorería
  const [treasuryAccounts, setTreasuryAccounts] = useState<TreasuryAccount[]>([]);
  const [selectedTreasuryAccountId, setSelectedTreasuryAccountId] = useState<string>('');

  // Método de pago digital seleccionado desde la pasarela de cuotas
  const [selectedMethodId, setSelectedMethodId] = useState<string>('');

  const [amountPaidTodayInput, setAmountPaidTodayInput] = useState<string>('');
  const [useVibePoints, setUseVibePoints] = useState(false);

  // Venta completada para impresión de ticket
  const [completedSaleData, setCompletedSaleData] = useState<any | null>(null);

  // Cargar lista de clientes, pasarela de cuotas y cuentas de tesorería al abrir el modal
  useEffect(() => {
    if (!isOpen) return;

    async function loadData() {
      setLoadingClients(true);
      setError(null);

      const [resClients, resAcc] = await Promise.all([
        getClients(role),
        getTreasuryAccounts(),
        fetchActiveMethods()
      ]);

      setLoadingClients(false);

      if (resClients.success && resClients.data) {
        setClients(resClients.data);
      } else if (resClients.error) {
        setError(resClients.error);
      }

      if (resAcc.success && resAcc.data) {
        setTreasuryAccounts(resAcc.data);
        if (resAcc.data.length > 0 && !selectedTreasuryAccountId) {
          setSelectedTreasuryAccountId(resAcc.data[0].id);
        }
      }
    }

    loadData();
    // Limpiar inputs al abrir
    setStep('checkout');
    setCashArs('');
    setDigitalArs('');
    setCashUsd('');
    setClientId('default');
    setSelectedMethodId('');
    setAmountPaidTodayInput('');
    setUseVibePoints(false);
    setCompletedSaleData(null);
  }, [isOpen, role]);

  if (!isOpen) return null;

  // Cliente seleccionado
  const selectedClient = clients.find(c => c.id === clientId);
  const clientPoints = selectedClient?.points_balance || 0;

  // Valores parseados
  const valCashArs = parseFloat(cashArs) || 0;
  const valDigitalArs = parseFloat(digitalArs) || 0;
  const valCashUsd = parseFloat(cashUsd) || 0;

  // Conversión de USD a ARS
  const usdInArs = Math.round(valCashUsd * exchangeRate);

  // Método de pago seleccionado
  const selectedMethod: PaymentMethodConfig | undefined = activeMethods.find(m => m.id === selectedMethodId);
  
  const feePercent = selectedMethod ? Number(selectedMethod.fee_percentage !== undefined ? selectedMethod.fee_percentage : (selectedMethod.surcharge_percent || 0)) : 0;
  const fixedFeeArs = selectedMethod ? Number(selectedMethod.fixed_fee_ars || 0) : 0;
  const passFeeToCustomer = selectedMethod ? Boolean(selectedMethod.pass_fee_to_customer) : false;

  // Subtotal base sin recargos
  const subtotalArs = totalArs;

  // Comisión calculada de la pasarela
  const calculatedGatewayFeeArs = (feePercent > 0 || fixedFeeArs > 0)
    ? Math.round(subtotalArs * (feePercent / 100) + fixedFeeArs)
    : 0;

  let totalSurchargeArs = 0;
  let finalTotalArsToCharge = subtotalArs;
  let netReceivedArs = subtotalArs;

  if (calculatedGatewayFeeArs > 0) {
    if (passFeeToCustomer) {
      // Recargo transferido al cliente (se le suma al total a pagar)
      totalSurchargeArs = calculatedGatewayFeeArs;
      finalTotalArsToCharge = subtotalArs + totalSurchargeArs;
      netReceivedArs = subtotalArs;
    } else {
      // Elohim absorbe la comisión (el cliente paga el subtotal)
      totalSurchargeArs = 0;
      finalTotalArsToCharge = subtotalArs;
      netReceivedArs = Math.max(0, subtotalArs - calculatedGatewayFeeArs);
    }
  }

  // Canje de VibePoints (1 pt = 10 ARS descuento)
  const maxDiscountArs = clientPoints * 10;
  const vibePointsDiscountArs = (useVibePoints && clientPoints > 0)
    ? Math.min(maxDiscountArs, Math.max(0, finalTotalArsToCharge - 1))
    : 0;
  const vibePointsCountUsed = Math.ceil(vibePointsDiscountArs / 10);

  // Total a pagar neto aplicando el canje de VibePoints
  const effectiveTotalArsToPay = Math.max(0, finalTotalArsToCharge - vibePointsDiscountArs);

  // Monto Abonado Hoy y Saldo Pendiente (Pagos Parciales / Fiado)
  const rawAmountPaidToday = amountPaidTodayInput !== '' ? parseFloat(amountPaidTodayInput) : effectiveTotalArsToPay;
  const amountPaidToday = isNaN(rawAmountPaidToday) ? effectiveTotalArsToPay : Math.max(0, rawAmountPaidToday);
  const amountDueArs = Math.max(0, Math.round(effectiveTotalArsToPay - amountPaidToday));
  const paymentStatus = amountDueArs > 0 ? 'partial' : 'paid';

  // Total abonado por el usuario en desglose
  const digitalFinalArs = valDigitalArs;
  const totalPaidArs = valCashArs + usdInArs + digitalFinalArs;
  const differenceArs = totalPaidArs - amountPaidToday;

  const isCovered = totalPaidArs >= amountPaidToday - 0.01;
  const isRegisteredClient = clientId !== 'default' && clientId !== '';
  const canProceed = isCovered || (amountDueArs > 0 && isRegisteredClient);

  const totalUsd = effectiveTotalArsToPay / exchangeRate;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isCovered) {
      if (!isRegisteredClient) {
        setError('El total pagado debe cubrir la venta. Para fiar o ingresar señas a Cuenta Corriente, debes seleccionar un cliente registrado.');
        return;
      }
      if (totalPaidArs <= 0) {
        setError('Debes ingresar al menos una seña o pago inicial para cerrar la venta a cuenta corriente.');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Mapear ítems del carrito
      const items = cartItems.map(item => {
        let priceArs = item.product.base_price_ars;
        if (item.product.type === 'decant_liquid' && item.decantMl && item.selectedSupplyPrice) {
          priceArs = (item.product.base_price_ars * item.decantMl) + item.selectedSupplyPrice;
        }

        return {
          product_id: item.product.id,
          quantity: item.quantity,
          price_ars: priceArs,
          price_usd: priceArs / exchangeRate
        };
      });

      // 2. Mapear decants JIT
      const decants = cartItems
        .filter(item => item.product.type === 'decant_liquid')
        .map(item => {
          if (!item.decantMl || !item.selectedSupplyId) {
            throw new Error(`Configuración de decant incompleta para ${item.product.name}`);
          }
          return {
            decant_liquid_id: item.product.id,
            ml_quantity: item.decantMl * item.quantity,
            supply_id: item.selectedSupplyId
          };
        });

      // 3. Estructurar metadata JSONB de métodos de pago y desgloses
      const methodName = selectedMethod ? (selectedMethod.method_name || selectedMethod.name || 'Digital') : 'Efectivo / Directo';
      
      const breakdown = [];
      if (valCashArs > 0) {
        breakdown.push({
          method_name: 'Efectivo ARS',
          amount_base: valCashArs,
          surcharge_applied: 0,
          final_amount: valCashArs
        });
      }

      if (valCashUsd > 0) {
        breakdown.push({
          method_name: 'Dólares Billete',
          amount_base: usdInArs,
          surcharge_applied: 0,
          final_amount: usdInArs,
          amount_usd: valCashUsd
        });
      }

      if (valDigitalArs > 0) {
        breakdown.push({
          method_name: methodName,
          amount_base: valDigitalArs,
          surcharge_applied: totalSurchargeArs,
          gateway_fee_ars: calculatedGatewayFeeArs,
          net_received_ars: netReceivedArs,
          final_amount: digitalFinalArs
        });
      }

      if (vibePointsDiscountArs > 0) {
        breakdown.push({
          method_name: 'VibePoints (Canje)',
          amount_base: vibePointsDiscountArs,
          surcharge_applied: 0,
          final_amount: vibePointsDiscountArs,
          points_redeemed: vibePointsCountUsed
        });
      }

      const paymentMethodsPayload: any = {
        cash_ars: valCashArs > 0 ? valCashArs : 0,
        digital_ars: valDigitalArs > 0 ? valDigitalArs : 0,
        cash_usd: valCashUsd > 0 ? valCashUsd : 0,
        exchange_rate_usd: exchangeRate,
        surcharge_applied_ars: totalSurchargeArs,
        gateway_fee_ars: calculatedGatewayFeeArs,
        net_received_ars: netReceivedArs,
        pass_fee_to_customer: passFeeToCustomer,
        fee_percentage: feePercent,
        fixed_fee_ars: fixedFeeArs,
        selected_method_id: selectedMethod ? selectedMethod.id : null,
        selected_method_name: methodName,
        vibepoints_used: vibePointsDiscountArs > 0 ? {
          points: vibePointsCountUsed,
          discount_ars: vibePointsDiscountArs
        } : null,
        treasury_account_id: selectedTreasuryAccountId,
        breakdown
      };

      // 4. Enviar transacción con el TOTAL FINAL, abonado hoy y saldo pendiente
      const res = await createSaleTransaction(role, {
        client_id: clientId === 'default' ? null : clientId,
        seller_id: null,
        total_ars: finalTotalArsToCharge,
        total_usd_equivalent: totalUsd,
        exchange_rate_used: exchangeRate,
        amount_paid_today: amountPaidToday,
        amount_due_ars: amountDueArs,
        payment_status: paymentStatus,
        payment_methods: paymentMethodsPayload,
        items,
        decants
      });

      if (!res.success) {
        throw new Error(res.error || 'Error al procesar la venta en la base de datos');
      }

      // 5. Mapear objeto de venta completada para el ticket
      const selectedClientObj = clients.find(c => c.id === clientId);
      const receiptItems = cartItems.map(item => {
        let priceArs = item.product.base_price_ars;
        if (item.product.type === 'decant_liquid' && item.decantMl && item.selectedSupplyPrice) {
          priceArs = (item.product.base_price_ars * item.decantMl) + item.selectedSupplyPrice;
        }

        let nameDisplay = item.product.name;
        if (item.product.type === 'decant_liquid' && item.decantMl) {
          nameDisplay = `Decant ${item.product.name} (${item.decantMl}ml)`;
        }

        return {
          name: nameDisplay,
          brand: item.product.brand,
          quantity: item.quantity,
          priceArs,
          totalArs: priceArs * item.quantity
        };
      });

      setCompletedSaleData({
        saleId: res.saleId || 'TICK-NUEVO',
        createdAt: new Date(),
        clientName: selectedClientObj ? selectedClientObj.name : 'Consumidor Final',
        items: receiptItems,
        subtotalArs,
        surchargeArs: totalSurchargeArs,
        totalArs: finalTotalArsToCharge,
        totalUsd,
        exchangeRate,
        paymentMethods: paymentMethodsPayload
      });

      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado al procesar el checkout');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintTicket = () => {
    window.print();
  };

  const handleFinishNewSale = () => {
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="w-[95vw] sm:max-w-lg bg-[#13261E] border border-[#1B362A] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto">
        
        {step === 'checkout' ? (
          <form onSubmit={handleCheckout}>
            
            <CardHeader className="border-b border-[#1B362A] pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold text-white font-serif flex items-center gap-2">
                  <CheckCircle className="h-5.5 w-5.5 text-[#D0A96B]" />
                  Registrar Cobro Bimonetario
                </CardTitle>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <CardDescription className="text-xs text-zinc-400 mt-1">
                Selecciona el cliente, el medio digital de cuotas y desglosa los montos recibidos.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 p-6 max-h-[65vh] overflow-y-auto">
              
              {error && (
                <div className="flex gap-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              {/* SELECCIÓN DE CLIENTE */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Cliente de la Venta
                </label>
                {loadingClients ? (
                  <div className="flex items-center text-xs text-zinc-400 gap-1.5 py-1">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#D0A96B]" />
                    Cargando clientes...
                  </div>
                ) : (
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="flex h-9 w-full rounded-lg border border-[#1B362A] bg-[#08130E] px-3 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#D0A96B]"
                  >
                    <option value="default">👤 Consumidor Final (General)</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        👤 {client.name} {client.points_balance !== undefined ? `(${client.points_balance} pts VibePoints)` : ''}
                      </option>
                    ))}
                  </select>
                )}

                {/* BADGE Y CANJE DE VIBEPOINTS */}
                {selectedClient && clientPoints > 0 && (
                  <div className="p-3 rounded-xl bg-[#D0A96B]/10 border border-[#D0A96B]/30 text-xs text-[#E5C158] space-y-2 mt-2">
                    <div className="flex items-center justify-between">
                      <div className="font-bold flex items-center gap-1.5 text-[#D0A96B]">
                        <Sparkles className="h-4 w-4 text-[#D0A96B]" />
                        <span>VibePoints Disponibles: <strong>{clientPoints} pts</strong></span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400">
                        Equiv. ${clientPoints * 10} ARS
                      </span>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs text-white">
                      <input
                        type="checkbox"
                        checked={useVibePoints}
                        onChange={(e) => setUseVibePoints(e.target.checked)}
                        className="h-4 w-4 rounded border-[#1B362A] bg-[#13261E] text-[#D0A96B] focus:ring-[#D0A96B] cursor-pointer"
                      />
                      <span className="font-semibold">Canjear VibePoints como descuento en esta compra</span>
                    </label>

                    {useVibePoints && vibePointsDiscountArs > 0 && (
                      <div className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                        ✔ Descuento aplicado: <strong>-${vibePointsDiscountArs.toLocaleString('es-AR')} ARS</strong> ({vibePointsCountUsed} pts canjeados)
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SELECCIÓN DE CUENTA DE DESTINO EN TESORERÍA */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[#D0A96B] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Landmark className="h-3.5 w-3.5" /> Cuenta de Destino en Tesorería *
                  </span>
                </label>
                <select
                  value={selectedTreasuryAccountId}
                  onChange={(e) => setSelectedTreasuryAccountId(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-[#1B362A] bg-[#08130E] px-3 py-1 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-[#D0A96B]"
                >
                  {treasuryAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      🏦 {acc.account_name} (${acc.balance_ars.toLocaleString('es-AR')} ARS)
                    </option>
                  ))}
                </select>
              </div>

              {/* SELECCIÓN DE PASARELA / MÉTODO DIGITAL DINÁMICO */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center justify-between">
                  <span>Pasarela Digital / Cuotas</span>
                  {selectedMethod && (feePercent > 0 || fixedFeeArs > 0) && (
                    <span className="text-[#D0A96B] font-extrabold text-[10px]">
                      {passFeeToCustomer ? `+${feePercent}% Recargo Cliente` : `-${feePercent}% Retención MP`}
                    </span>
                  )}
                </label>

                <select
                  value={selectedMethodId}
                  onChange={(e) => setSelectedMethodId(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-[#1B362A] bg-[#08130E] px-3 py-1 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-[#D0A96B]"
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
              <div className="rounded-xl bg-[#08130E] p-4 border border-[#1B362A] space-y-2.5">
                <div className="flex justify-between items-center text-xs text-zinc-400">
                  <span>Subtotal Base ARS:</span>
                  <span className="font-mono font-bold text-white">
                    ${subtotalArs.toLocaleString('es-AR')} ARS
                  </span>
                </div>

                {/* DESGLOSE DINÁMICO DE COMISIÓN / RECARGO DE PASARELA */}
                {calculatedGatewayFeeArs > 0 && passFeeToCustomer && (
                  <div className="p-2.5 rounded-lg bg-[#D0A96B]/10 border border-[#D0A96B]/30 text-xs text-[#D0A96B] font-mono font-bold space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Percent className="h-3.5 w-3.5" /> Recargo Tarjeta ({feePercent}%):
                      </span>
                      <span>+${calculatedGatewayFeeArs.toLocaleString('es-AR')} ARS</span>
                    </div>
                    <div className="text-[10px] font-sans font-normal text-[#E5C158]">
                      Subtotal: ${subtotalArs.toLocaleString('es-AR')} | Recargo Tarjeta: ${calculatedGatewayFeeArs.toLocaleString('es-AR')} | Total a Cobrar: ${finalTotalArsToCharge.toLocaleString('es-AR')}
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
                    <div className="text-[10px] font-sans font-normal text-blue-300">
                      El cliente abona: ${subtotalArs.toLocaleString('es-AR')} | Retención MP: -${calculatedGatewayFeeArs.toLocaleString('es-AR')} | Neto a tu cuenta: ${netReceivedArs.toLocaleString('es-AR')}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-[#1B362A]">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 block">
                      Total Final a Cobrar (ARS)
                    </span>
                    <div className="text-2xl font-black text-white font-serif">
                      ${finalTotalArsToCharge.toLocaleString('es-AR')}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 block">
                      Equiv. USD
                    </span>
                    <div className="text-xl font-black text-indigo-400 font-mono">
                      u$s {totalUsd.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* INPUT MONTO ABONADO HOY & ADVERTENCIA PAGO PARCIAL */}
              <div className="space-y-1.5 p-3.5 rounded-xl bg-[#08130E] border border-[#1B362A]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Monto Abonado Hoy (ARS)
                  </label>
                  <span className="text-[10px] text-zinc-400">
                    (Default: ${finalTotalArsToCharge.toLocaleString('es-AR')})
                  </span>
                </div>
                
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-zinc-500">$</span>
                  <Input
                    type="number"
                    placeholder={`$${finalTotalArsToCharge.toLocaleString('es-AR')}`}
                    value={amountPaidTodayInput}
                    onChange={(e) => setAmountPaidTodayInput(e.target.value)}
                    className="pl-7 bg-[#13261E] border-[#1B362A] text-white font-mono font-bold text-sm"
                  />
                </div>

                {/* BADGE ESTILIZADO DE ADVERTENCIA DE SALDO PENDIENTE */}
                {amountDueArs > 0 && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400 space-y-1 mt-2">
                    <div className="font-bold flex items-center gap-1.5 text-[#D0A96B]">
                      <AlertCircle className="h-4 w-4 text-[#D0A96B]" />
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
                    <label className="flex items-center gap-1 text-[10px] font-semibold text-zinc-400">
                      <DollarSign className="h-3.5 w-3.5 text-[#D0A96B]" />
                      Efectivo ARS
                    </label>
                    <Input
                      type="number"
                      placeholder="ARS"
                      value={cashArs}
                      onChange={(e) => setCashArs(e.target.value)}
                      className="bg-[#08130E] border-[#1B362A] text-white font-mono text-xs font-bold"
                    />
                  </div>

                  {/* DIGITAL / TARJETA ARS */}
                  <div className="space-y-1">
                    <label className="flex items-center gap-1 text-[10px] font-semibold text-zinc-400">
                      <Landmark className="h-3.5 w-3.5 text-indigo-400" />
                      Digital / Tarjeta
                    </label>
                    <Input
                      type="number"
                      placeholder="ARS"
                      value={digitalArs}
                      onChange={(e) => setDigitalArs(e.target.value)}
                      className="bg-[#08130E] border-[#1B362A] text-white font-mono text-xs font-bold"
                    />
                  </div>

                  {/* EFECTIVO USD */}
                  <div className="space-y-1">
                    <label className="flex items-center gap-1 text-[10px] font-semibold text-zinc-400">
                      <CreditCard className="h-3.5 w-3.5 text-emerald-400" />
                      Dólares Billete
                    </label>
                    <Input
                      type="number"
                      placeholder="USD"
                      value={cashUsd}
                      onChange={(e) => setCashUsd(e.target.value)}
                      className="bg-[#08130E] border-[#1B362A] text-white font-mono text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* ESTADO DEL COBRO Y SALDOS */}
              <div className="rounded-xl border border-[#1B362A] bg-[#08130E] p-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Total Recibido (Pesos):</span>
                  <span className="font-semibold text-white font-mono">
                    ${totalPaidArs.toLocaleString('es-AR')} ARS
                  </span>
                </div>

                <div className="border-t border-[#1B362A] pt-1.5 flex justify-between items-center">
                  <span className="font-bold text-zinc-300">
                    {differenceArs >= 0 ? 'Vuelto a Entregar:' : 'Saldo Pendiente (Fiado):'}
                  </span>
                  
                  <div className="text-right">
                    <div className={`text-base font-black font-mono ${differenceArs >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      ${Math.abs(differenceArs).toLocaleString('es-AR')} ARS
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      o u$s {Math.abs(differenceArs / exchangeRate).toFixed(2)} USD
                    </div>
                  </div>
                </div>

                {amountDueArs > 0 && isRegisteredClient && (
                  <div className="p-3 rounded-xl bg-[#D0A96B]/10 border border-[#D0A96B]/30 text-xs text-[#E5C158] space-y-0.5">
                    <div className="font-bold flex items-center gap-1 text-[#D0A96B]">
                      <span>★ Saldo a Cuenta Corriente (Fiado / Seña)</span>
                    </div>
                    <p className="text-[11px] opacity-90">
                      Se generará automáticamente una Cuenta por Cobrar de <strong>${Math.abs(differenceArs).toLocaleString('es-AR')} ARS</strong> a nombre del cliente seleccionado.
                    </p>
                  </div>
                )}
              </div>

            </CardContent>

            <CardFooter className="border-t border-[#1B362A] pt-4 flex justify-end gap-3 bg-[#08130E]/60 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="border-[#1B362A] bg-[#13261E] text-zinc-300 hover:bg-zinc-800"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading || !canProceed}
                className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold text-xs shadow-md shadow-[#D0A96B]/20 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Procesando Venta...
                  </>
                ) : (
                  'Confirmar Venta'
                )}
              </Button>
            </CardFooter>
            
          </form>
        ) : (
          /* ------------------ VISTA DE VENTA EXITOSA & TICKET ------------------ */
          <div className="p-6 text-center space-y-6 animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2 shadow-lg shadow-emerald-500/10">
              <CheckCircle className="h-10 w-10" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white font-serif">¡Venta Registrada con Éxito!</h2>
              <p className="text-xs text-zinc-400 mt-1">
                La transacción ha sido almacenada de forma atómica y el stock descontado.
              </p>
            </div>

            {completedSaleData && (
              <div className="bg-[#08130E] p-4 rounded-xl border border-[#1B362A] space-y-2 text-left">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>N° Transacción:</span>
                  <span className="font-bold font-mono text-white">#{completedSaleData.saleId.split('-')[0].toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Cliente:</span>
                  <span className="font-semibold text-zinc-200">{completedSaleData.clientName}</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-[#1B362A]">
                  <span>Total Cobrado:</span>
                  <span className="font-mono text-[#D0A96B]">${completedSaleData.totalArs.toLocaleString('es-AR')} ARS</span>
                </div>
              </div>
            )}

            {/* BANDERAS DE IMPRESIÓN Y TICKET RENDERIZADO */}
            {completedSaleData && (
              <div className="no-print hidden">
                <ReceiptTicket {...completedSaleData} />
              </div>
            )}

            <div className="flex justify-center gap-3 pt-2">
              <Button
                onClick={handlePrintTicket}
                variant="outline"
                className="cursor-pointer border-[#1B362A] bg-[#08130E] font-bold text-zinc-300"
              >
                <Printer className="mr-2 h-4 w-4 text-[#D0A96B]" /> Imprimir Ticket
              </Button>

              <Button
                onClick={handleFinishNewSale}
                className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold text-xs shadow-md shadow-[#D0A96B]/20"
              >
                <ShoppingBag className="mr-2 h-4 w-4" /> Nueva Venta
              </Button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
