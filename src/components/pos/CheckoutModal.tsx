'use client';

import React, { useState, useEffect } from 'react';
import { UserRole } from '@/types';
import { CartItem } from '@/hooks/use-pos-store';
import { getClients, createSaleTransaction, ClientRecord } from '@/app/actions/sales';
import { getTreasuryAccounts, TreasuryAccount } from '@/app/actions/treasury';
import { getSupplies } from '@/app/actions/products';
import { useFeesStore } from '@/hooks/use-fees-store';
import { DiscountType } from '@/lib/discount-calculations';
import { Modal } from '@/components/ui/modal';
import { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, X, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { DiscountSection } from './checkout/DiscountSection';
import { PackagingSelector } from './checkout/PackagingSelector';
import { PaymentSplitter } from './checkout/PaymentSplitter';
import { SuccessReceipt } from './checkout/SuccessReceipt';
import { calculateCheckoutTotals } from './checkout/checkout-calculations';
import { buildSaleItems, buildDecants, buildPaymentMethodsPayload, buildReceiptItems } from './checkout/sale-payload';
import { CompletedSaleData, PackagingSupplyOption, PackagingUsedItem } from './checkout/types';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  role: UserRole;
  totalArs: number;
  exchangeRate: number;
  cartItems: CartItem[];
}

/**
 * Orquestador conciso del checkout bimonetario: gestiona la primitiva Modal,
 * la carga de datos, los cálculos puros (checkout/checkout-calculations.ts) y
 * el envío de la transacción (checkout/sale-payload.ts). Los controles de cobro
 * viven en los submódulos de checkout/.
 */
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

  const [clients, setClients] = useState<ClientRecord[]>([]);
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

  // Ajuste de Precio / Descuentos en Checkout
  const [discountType, setDiscountType] = useState<DiscountType>('none');
  const [discountInputValue, setDiscountInputValue] = useState<string>('');

  // Insumos de Packaging Utilizados en la Venta
  const [availableSupplies, setAvailableSupplies] = useState<PackagingSupplyOption[]>([]);
  const [selectedPackaging, setSelectedPackaging] = useState<PackagingUsedItem[]>([]);

  // Venta completada para impresión de ticket
  const [completedSaleData, setCompletedSaleData] = useState<CompletedSaleData | null>(null);

  // Cargar lista de clientes, pasarela de cuotas y cuentas de tesorería al abrir el modal
  useEffect(() => {
    if (!isOpen) return;

    async function loadData() {
      setLoadingClients(true);
      setError(null);

      const [resClients, resAcc, resSupplies] = await Promise.all([
        getClients(role),
        getTreasuryAccounts(),
        getSupplies(),
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

      if (resSupplies.success && resSupplies.data) {
        setAvailableSupplies(resSupplies.data);
      }
    }

    loadData();
    // Limpiar inputs al abrir (los submódulos remontan con estado fresco)
    setStep('checkout');
    setCashArs('');
    setDigitalArs('');
    setCashUsd('');
    setClientId('default');
    setSelectedMethodId('');
    setDiscountType('none');
    setDiscountInputValue('');
    setAmountPaidTodayInput('');
    setUseVibePoints(false);
    setSelectedPackaging([]);
    setCompletedSaleData(null);
  }, [isOpen, role]);

  if (!isOpen) return null;

  // Cliente seleccionado
  const selectedClient = clients.find(c => c.id === clientId);
  const clientPoints = selectedClient?.points_balance || 0;
  const isRegisteredClient = clientId !== 'default' && clientId !== '';

  // Motor de cálculo puro del checkout bimonetario
  const totals = calculateCheckoutTotals({
    role,
    totalArs,
    exchangeRate,
    cartItems,
    activeMethods,
    selectedMethodId,
    cashArs,
    digitalArs,
    cashUsd,
    discountType,
    discountInputValue,
    amountPaidTodayInput,
    useVibePoints,
    clientPoints,
    isRegisteredClient,
  });

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!totals.isCovered) {
      if (!isRegisteredClient) {
        setError('El total pagado debe cubrir la venta. Para fiar o ingresar señas a Cuenta Corriente, debes seleccionar un cliente registrado.');
        return;
      }
      if (totals.totalPaidArs <= 0) {
        setError('Debes ingresar al menos una seña o pago inicial para cerrar la venta a cuenta corriente.');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      // Mapear ítems, decants JIT, packaging y metadata de métodos de pago
      const items = buildSaleItems(cartItems, exchangeRate);
      const decants = buildDecants(cartItems);
      const packaging_supplies = selectedPackaging.map(p => ({
        packaging_id: p.packaging_id,
        quantity_used: p.quantity_used
      }));
      const paymentMethodsPayload = buildPaymentMethodsPayload(totals, selectedTreasuryAccountId);

      // Enviar transacción con el TOTAL FINAL, subtotal, descuento, abonado hoy, saldo pendiente y packaging
      const res = await createSaleTransaction(role, {
        client_id: clientId === 'default' ? null : clientId,
        seller_id: null,
        subtotal_ars: totals.subtotalOriginalArs,
        discount_type: totals.discountResult.discountType,
        discount_value: totals.discountResult.discountValue,
        discount_amount_ars: totals.discountResult.discountAmountArs,
        discount_percentage: totals.discountResult.discountPercentage,
        total_ars: totals.effectiveTotalArsToPay,
        total_usd_equivalent: totals.totalUsd,
        exchange_rate_used: exchangeRate,
        amount_paid_today: totals.amountPaidToday,
        amount_due_ars: totals.amountDueArs,
        payment_status: totals.paymentStatus,
        payment_methods: paymentMethodsPayload,
        items,
        decants,
        packaging_supplies
      });

      if (!res.success) {
        throw new Error(res.error || 'Error al procesar la venta en la base de datos');
      }
      if (res.warning) {
        toast.warning(res.warning);
      }

      // Mapear objeto de venta completada para el ticket
      const selectedClientObj = clients.find(c => c.id === clientId);
      setCompletedSaleData({
        saleId: res.saleId || 'TICK-NUEVO',
        createdAt: new Date(),
        clientName: selectedClientObj ? selectedClientObj.name : 'Consumidor Final',
        items: buildReceiptItems(cartItems, selectedPackaging),
        subtotalArs: totals.subtotalOriginalArs,
        discountAmountArs: totals.discountResult.discountAmountArs,
        discountPercentage: totals.discountResult.discountPercentage,
        surchargeArs: totals.totalSurchargeArs,
        totalArs: totals.finalTotalArsToCharge,
        totalUsd: totals.totalUsd,
        exchangeRate,
        paymentMethods: paymentMethodsPayload
      });

      setStep('success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ocurrió un error inesperado al procesar el checkout';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-lg"
      className="w-[95vw] sm:max-w-lg overflow-hidden my-auto print:overflow-visible print:bg-transparent print:border-none print:shadow-none print:w-full print:max-w-none print:my-0"
      overlayClassName="print:static print:bg-transparent print:p-0 print:overflow-visible"
    >
      {step === 'checkout' ? (
        <form onSubmit={handleCheckout}>
          
          <CardHeader className="border-b border-erp-border pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold text-white font-serif flex items-center gap-2">
                <CheckCircle className="h-5.5 w-5.5 text-erp-gold" />
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

          <CardContent className="space-y-4 p-6 max-h-[65dvh] overflow-y-auto">
            
            {error && (
              <div className="flex gap-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* SELECCIÓN DE CLIENTE + BADGE Y CANJE DE VIBEPOINTS */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Cliente de la Venta
              </label>
              {loadingClients ? (
                <div className="flex items-center text-xs text-zinc-400 gap-1.5 py-1">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-erp-gold" />
                  Cargando clientes...
                </div>
              ) : (
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-erp-border bg-erp-bg px-3 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-erp-gold"
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
                <div className="p-3 rounded-xl bg-erp-gold/10 border border-erp-gold/30 text-xs text-erp-gold-hover space-y-2 mt-2">
                  <div className="flex items-center justify-between">
                    <div className="font-bold flex items-center gap-1.5 text-erp-gold">
                      <Sparkles className="h-4 w-4 text-erp-gold" />
                      <span>VibePoints Disponibles: <strong>{clientPoints} pts</strong></span>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400">
                      Equiv. ${clientPoints * 10} ARS
                    </span>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs text-white">
                    <input
                      type="checkbox"
                      checked={useVibePoints}
                      onChange={(e) => setUseVibePoints(e.target.checked)}
                      className="h-4 w-4 rounded border-erp-border bg-erp-surface text-erp-gold focus:ring-erp-gold cursor-pointer"
                    />
                    <span className="font-semibold">Canjear VibePoints como descuento en esta compra</span>
                  </label>

                  {useVibePoints && totals.vibePointsDiscountArs > 0 && (
                    <div className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                      ✔ Descuento aplicado: <strong>-${totals.vibePointsDiscountArs.toLocaleString('es-AR')} ARS</strong> ({totals.vibePointsCountUsed} pts canjeados)
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* AJUSTE DE PRECIO / DESCUENTOS EN VENTA POS */}
            <DiscountSection
              role={role}
              discountType={discountType}
              discountInputValue={discountInputValue}
              onTypeChange={setDiscountType}
              onInputValueChange={setDiscountInputValue}
              discountResult={totals.discountResult}
              isSellerOverLimit={totals.isSellerOverLimit}
              isBelowCogs={totals.isBelowCogs}
              subtotalOriginalArs={totals.subtotalOriginalArs}
              subtotalAfterDiscountArs={totals.subtotalAfterDiscountArs}
              totalCartCogs={totals.totalCartCogs}
            />

            {/* COBRO BIMONETARIO: TESORERÍA, PASARELA, RESUMEN Y VUELTO */}
            <PaymentSplitter
              activeMethods={activeMethods}
              selectedMethodId={selectedMethodId}
              onMethodIdChange={setSelectedMethodId}
              treasuryAccounts={treasuryAccounts}
              selectedTreasuryAccountId={selectedTreasuryAccountId}
              onTreasuryAccountIdChange={setSelectedTreasuryAccountId}
              cashArs={cashArs}
              onCashArsChange={setCashArs}
              digitalArs={digitalArs}
              onDigitalArsChange={setDigitalArs}
              cashUsd={cashUsd}
              onCashUsdChange={setCashUsd}
              amountPaidTodayInput={amountPaidTodayInput}
              onAmountPaidTodayChange={setAmountPaidTodayInput}
              feePercent={totals.feePercent}
              passFeeToCustomer={totals.passFeeToCustomer}
              subtotalOriginalArs={totals.subtotalOriginalArs}
              subtotalAfterDiscountArs={totals.subtotalAfterDiscountArs}
              discountAmountArs={totals.discountResult.discountAmountArs}
              discountPercentage={totals.discountResult.discountPercentage}
              calculatedGatewayFeeArs={totals.calculatedGatewayFeeArs}
              totalSurchargeArs={totals.totalSurchargeArs}
              finalTotalArsToCharge={totals.finalTotalArsToCharge}
              netReceivedArs={totals.netReceivedArs}
              amountDueArs={totals.amountDueArs}
              totalPaidArs={totals.totalPaidArs}
              differenceArs={totals.differenceArs}
              isRegisteredClient={isRegisteredClient}
              exchangeRate={exchangeRate}
              totalUsd={totals.totalUsd}
            />

            {/* INSUMOS DE PACKAGING UTILIZADOS (OPCIONAL) */}
            <PackagingSelector
              availableSupplies={availableSupplies}
              selectedPackaging={selectedPackaging}
              onSelectedPackagingChange={setSelectedPackaging}
            />

          </CardContent>

          <CardFooter className="border-t border-erp-border pt-4 flex justify-end gap-3 bg-erp-bg/60 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="border-erp-border bg-erp-surface text-zinc-300 hover:bg-zinc-800"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !totals.canProceed}
              className="bg-erp-gold hover:bg-erp-gold-hover text-erp-bg font-extrabold text-xs shadow-md shadow-erp-gold/20 cursor-pointer"
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
        <SuccessReceipt
          saleData={completedSaleData}
          clientPhone={selectedClient?.contact_whatsapp || selectedClient?.phone || ''}
          onFinishNewSale={() => {
            onSuccess();
            onClose();
          }}
        />
      )}
    </Modal>
  );
}
