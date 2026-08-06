'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { getSalesHistory, voidSale } from '@/app/actions/sales';
import { ReceiptTicket } from '@/components/pos/ReceiptTicket';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import { 
  ArrowLeft, RefreshCw, AlertCircle, Printer, ShoppingCart, 
  Search, FileText, CheckCircle2, X, Ban, AlertTriangle, RotateCcw 
} from 'lucide-react';
import Link from 'next/link';
import { ReturnModal } from '@/components/pos/ReturnModal';

export default function HistorialVentasPage() {
  const { role } = useUserStore();
  const { refresh: refreshRate } = useExchangeRate();

  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Modal Reimpresión Ticket
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Modal Devolución de Venta
  const [selectedReturnSale, setSelectedReturnSale] = useState<any | null>(null);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);

  // Modal Anulación de Venta (AlertDialog)
  const [saleToVoid, setSaleToVoid] = useState<any | null>(null);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  const fetchSales = async () => {
    setLoading(true);
    setError(null);
    const res = await getSalesHistory(role);
    if (res.success && res.data) {
      setSales(res.data);
    } else {
      setError(res.error || 'Error al cargar el historial de ventas.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSales();
  }, [role]);

  const handleOpenPrintModal = (sale: any) => {
    setSelectedSale(sale);
    setIsPrintModalOpen(true);
  };

  const handleOpenReturnModal = (sale: any) => {
    setSelectedReturnSale(sale);
    setIsReturnModalOpen(true);
  };

  const handleOpenVoidModal = (sale: any) => {
    setSaleToVoid(sale);
    setVoidError(null);
    setIsVoidModalOpen(true);
  };

  const handleConfirmVoid = async () => {
    if (!saleToVoid) return;

    setIsVoiding(true);
    setVoidError(null);

    const res = await voidSale(role, saleToVoid.id);
    setIsVoiding(false);

    if (res.success) {
      setIsVoidModalOpen(false);
      setSaleToVoid(null);
      fetchSales();
    } else {
      setVoidError(res.error || 'Error al anular la transacción');
    }
  };

  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Filtrado predictivo por cliente o ID de ticket
  const filteredSales = sales.filter(s => {
    const term = search.toLowerCase();
    const ticketId = s.id.toLowerCase();
    const clientName = s.clients?.name?.toLowerCase() || 'consumidor final';
    return ticketId.includes(term) || clientName.includes(term);
  });

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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-md shadow-emerald-500/20">
                <ShoppingCart className="h-4.5 w-4.5" />
              </div>
              <span className="text-sm font-bold tracking-tight text-white uppercase font-serif">
                Historial de Ventas & Reimpresión
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-serif flex items-center gap-2">
              Registro Histórico de Transacciones
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Consulta comprobantes emitidos, dispara reimpresiones térmicas y administra la anulación segura de ventas.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar por Ticket o Cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-[#1B362A] bg-[#13261E] text-white focus:outline-none focus:ring-1 focus:ring-[#D0A96B]"
              />
            </div>
            <Button variant="outline" size="sm" onClick={fetchSales} className="border-[#1B362A] bg-[#13261E] text-xs font-semibold cursor-pointer hover:bg-zinc-800">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5 text-[#D0A96B]" /> Actualizar
            </Button>
          </div>
        </div>

        {/* DATA TABLE DE VENTAS */}
        <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl">
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
                <span className="text-sm font-medium text-zinc-400">Cargando transacciones de venta...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 text-rose-400 gap-2">
                <AlertCircle className="h-10 w-10" />
                <p className="text-sm font-semibold">{error}</p>
                <Button variant="outline" onClick={fetchSales} className="mt-2">Reintentar</Button>
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                <ShoppingCart className="h-10 w-10 text-zinc-700" />
                <h3 className="font-bold text-white">Sin Ventas Registradas</h3>
                <p className="text-sm text-zinc-400 max-w-sm">No se encontraron comprobantes de venta que coincidan con la búsqueda.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1B362A] bg-[#13261E]/40 text-xs font-bold uppercase tracking-wider text-zinc-400">
                    <th className="p-4 pl-6">N° Ticket</th>
                    <th className="p-4">Fecha y Hora</th>
                    <th className="p-4">Cliente</th>
                    <th className="p-4 text-center">Estado</th>
                    <th className="p-4 text-right font-mono">Total ARS</th>
                    <th className="p-4 text-right font-mono">Equiv. USD</th>
                    <th className="p-4 pr-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80 text-sm">
                  {filteredSales.map((s) => {
                    const isVoided = s.status === 'voided';

                    return (
                      <tr 
                        key={s.id} 
                        className={`transition-colors ${isVoided ? 'bg-rose-950/10 hover:bg-rose-950/20' : 'hover:bg-[#13261E]/50'}`}
                      >
                        
                        {/* Ticket ID */}
                        <td className="p-4 pl-6 font-mono font-bold text-white">
                          #TICK-{s.id.split('-')[0].toUpperCase()}
                        </td>

                        {/* Fecha */}
                        <td className="p-4 text-xs font-mono text-zinc-400">
                          {new Date(s.created_at).toLocaleString('es-AR')}
                        </td>

                        {/* Cliente */}
                        <td className="p-4 font-semibold text-zinc-200 text-xs">
                          👤 {s.clients?.name || 'Consumidor Final'}
                        </td>

                        {/* Estado */}
                        <td className="p-4 text-center">
                          {isVoided ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
                              <Ban className="h-3 w-3" /> Anulada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 className="h-3 w-3" /> Completada
                            </span>
                          )}
                        </td>

                        {/* Total ARS */}
                        <td className={`p-4 text-right font-mono font-bold ${
                          isVoided 
                            ? 'line-through text-zinc-500 opacity-50' 
                            : 'text-emerald-400'
                        }`}>
                          ${Number(s.total_ars).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </td>

                        {/* Equiv. USD */}
                        <td className={`p-4 text-right font-mono text-xs font-bold ${
                          isVoided 
                            ? 'line-through text-zinc-500 opacity-50' 
                            : 'text-indigo-400'
                        }`}>
                          u$s {Number(s.total_usd_equivalent || 0).toFixed(2)}
                        </td>

                        {/* Acciones */}
                        <td className="p-4 pr-6 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenPrintModal(s)}
                              className="h-8 text-xs cursor-pointer border-[#1B362A] bg-[#13261E] font-bold text-zinc-300 hover:bg-zinc-800"
                            >
                              <Printer className="mr-1.5 h-3.5 w-3.5 text-[#D0A96B]" /> Reimprimir
                            </Button>

                            {!isVoided && (
                              s.has_returns ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                  <RotateCcw className="h-3 w-3" /> Devolución Procesada
                                </span>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenReturnModal(s)}
                                  className="h-8 text-xs cursor-pointer border-[#D0A96B]/40 text-[#E5C158] bg-[#D0A96B]/10 hover:bg-[#D0A96B]/20 font-bold"
                                  title="Procesar devolución o cambio"
                                >
                                  <RotateCcw className="mr-1.5 h-3.5 w-3.5 text-[#D0A96B]" /> Devolución
                                </Button>
                              )
                            )}

                            {role === 'admin' && !isVoided && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenVoidModal(s)}
                                className="h-8 text-xs cursor-pointer border-rose-900/40 text-rose-400 bg-rose-950/20 hover:bg-rose-900/30 font-bold"
                                title="Anular transacción y devolver stock"
                              >
                                <Ban className="mr-1.5 h-3.5 w-3.5" /> Anular
                              </Button>
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

      </main>

      {/* MODAL DE REIMPRESIÓN DE TICKET */}
      {isPrintModalOpen && selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#08130E] border border-[#1B362A] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            
            <CardHeader className="border-b border-[#1B362A] pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold text-white font-serif flex items-center gap-2">
                  <Printer className="h-5 w-5 text-[#D0A96B]" />
                  Reimprimir Ticket de Venta
                </CardTitle>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <CardDescription className="mt-1 text-xs text-zinc-400">
                Previsualización optimizada para papel térmico de 80mm.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 max-h-[60vh] overflow-y-auto bg-[#13261E]/50">
              {/* COMPONENTE DE TICKET RENDERIZADO */}
              <ReceiptTicket
                saleId={selectedSale.id}
                createdAt={selectedSale.created_at}
                clientName={selectedSale.clients?.name || 'Consumidor Final'}
                items={(selectedSale.sale_items || []).map((item: any) => {
                  const pArs = Number(item.price_ars_at_moment || item.price_ars || 0);
                  return {
                    name: item.products?.name || 'Producto Perfumería',
                    brand: item.products?.brand,
                    quantity: item.quantity,
                    priceArs: pArs,
                    totalArs: pArs * Number(item.quantity)
                  };
                })}
                subtotalArs={Number(selectedSale.total_ars) - Number(selectedSale.payment_methods?.surcharge_applied_ars || 0)}
                surchargeArs={Number(selectedSale.payment_methods?.surcharge_applied_ars || 0)}
                totalArs={Number(selectedSale.total_ars)}
                totalUsd={Number(selectedSale.total_usd_equivalent || 0)}
                exchangeRate={Number(selectedSale.exchange_rate_used || 1000)}
                paymentMethods={selectedSale.payment_methods}
              />
            </CardContent>

            <CardFooter className="border-t border-[#1B362A] pt-4 flex justify-end gap-3 bg-[#13261E]/40 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPrintModalOpen(false)}
                className="border-[#1B362A] bg-[#13261E] text-zinc-300 hover:bg-zinc-800"
              >
                Cerrar
              </Button>
              <Button
                type="button"
                onClick={handlePrint}
                className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold shadow-md shadow-[#D0A96B]/20 text-white cursor-pointer font-bold shadow-md shadow-violet-600/20"
              >
                <Printer className="mr-2 h-4 w-4" /> Disparar Impresión
              </Button>
            </CardFooter>

          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN CRÍTICA DE ANULACIÓN (ALERT DIALOG) */}
      {isVoidModalOpen && saleToVoid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#08130E] border border-rose-900/50 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            
            <CardHeader className="border-b border-rose-900/30 bg-rose-950/20 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold text-rose-400 font-serif flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-rose-500" />
                  ¿Anular Transacción de Venta?
                </CardTitle>
                <button
                  type="button"
                  onClick={() => setIsVoidModalOpen(false)}
                  disabled={isVoiding}
                  className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 p-6">
              
              {voidError && (
                <div className="flex gap-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="font-medium">{voidError}</span>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-[#13261E] border border-[#1B362A] space-y-1 text-xs font-mono">
                <div className="flex justify-between text-zinc-400">
                  <span>Ticket a Anular:</span>
                  <span className="font-bold text-white">#TICK-{saleToVoid.id.split('-')[0].toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Cliente:</span>
                  <span className="text-zinc-200">{saleToVoid.clients?.name || 'Consumidor Final'}</span>
                </div>
                <div className="flex justify-between text-rose-400 font-bold border-t border-[#1B362A] pt-1 mt-1">
                  <span>Monto Total Venta:</span>
                  <span>${Number(saleToVoid.total_ars).toLocaleString('es-AR')} ARS</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 leading-relaxed space-y-1.5">
                <p className="font-bold flex items-center gap-1.5 text-rose-400">
                  <AlertCircle className="h-4 w-4" /> Advertencia de Seguridad
                </p>
                <p className="text-[11px] opacity-90">
                  Esta acción devolverá automáticamente las botellas selladas y mililitros de decants al inventario activo, cancelará cualquier saldo en cuentas corrientes asociadas y marcará la transacción como <strong>ANULADA</strong> en el sistema. Es irreversible.
                </p>
              </div>

            </CardContent>

            <CardFooter className="border-t border-[#1B362A] pt-4 flex justify-end gap-3 bg-[#13261E]/40 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsVoidModalOpen(false)}
                disabled={isVoiding}
                className="border-[#1B362A] bg-[#13261E] text-zinc-300 hover:bg-zinc-800"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleConfirmVoid}
                disabled={isVoiding}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 cursor-pointer"
              >
                {isVoiding ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Anulando Venta...
                  </>
                ) : (
                  <>
                    <Ban className="mr-1.5 h-4 w-4" /> Sí, Anular Transacción
                  </>
                )}
              </Button>
            </CardFooter>

          </div>
        </div>
      )}

      {/* MODAL DEVOLUCIÓN DE VENTA */}
      <ReturnModal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        onSuccess={fetchSales}
        sale={selectedReturnSale}
        role={role}
      />

    </div>
  );
}
