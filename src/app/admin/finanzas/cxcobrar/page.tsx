'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { getPendingSales, registerInstallment, PendingSale } from '@/app/actions/installments';
import { getDebtorsForReport } from '@/app/actions/receivables';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import { ShiftStatusBadge } from '@/components/cash/ShiftStatusBadge';
import { 
  ArrowLeft, Search, Plus, DollarSign, Clock, Mail, Phone, User, 
  X, Check, RefreshCw, AlertCircle, Sparkles, CreditCard, ShieldCheck, 
  TrendingUp, Coins, FileText, CheckCircle, Calendar, History, Download 
} from 'lucide-react';
import Link from 'next/link';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

export default function CxCobrarPage() {
  const { role } = useUserStore();
  const { rate: exchangeRate, refresh: refreshRate } = useExchangeRate();

  const [sales, setSales] = useState<PendingSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');

  // Modal de Registro de Abono
  const [selectedSale, setSelectedSale] = useState<PendingSale | null>(null);
  const [amountPaidInput, setAmountPaidInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo ARS');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchSales = async () => {
    setLoading(true);
    setError(null);
    const res = await getPendingSales(role);
    if (res.success && res.data) {
      setSales(res.data);
    } else {
      setError(res.error || 'Error al cargar ventas pendientes');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSales();
  }, [role]);

  const handleOpenModal = (sale: PendingSale) => {
    setSelectedSale(sale);
    setAmountPaidInput(sale.amount_due_ars.toString());
    setPaymentMethod('Efectivo ARS');
    setNotes('');
    setModalError(null);
  };

  const handleConfirmInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSale) return;

    const valAmount = parseFloat(amountPaidInput);
    if (isNaN(valAmount) || valAmount <= 0) {
      setModalError('Ingresa un monto válido a abonar mayor a $0.');
      return;
    }

    setSubmitting(true);
    setModalError(null);

    const res = await registerInstallment(role, selectedSale.id, valAmount, paymentMethod, notes);
    setSubmitting(false);

    if (res.success) {
      setSelectedSale(null);
      fetchSales();
    } else {
      setModalError(res.error || 'Error al registrar el abono');
    }
  };

  /**
   * Generación de PDF Nativo de Cuentas por Cobrar (Deudores) con jsPDF + jspdf-autotable.
   */
  const downloadDebtorsReport = async () => {
    try {
      setIsGeneratingPdf(true);
      toast.info('Generando reporte PDF nativo de deudores...');

      const res = await getDebtorsForReport(role);
      if (!res.success || !res.data) {
        toast.error(res.error || 'No se pudieron obtener los datos para el reporte.');
        return;
      }

      const debtors = res.data;
      const totalMoneyOnTheStreet = res.totalOutstandingArs || 0;

      // 1. Inicialización de jsPDF A4 (595 x 842 pt)
      const doc = new jsPDF('p', 'pt', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();

      // Formateador monetario estándar argentino
      const formatARS = (valor: number) =>
        new Intl.NumberFormat('es-AR', {
          style: 'currency',
          currency: 'ARS',
          maximumFractionDigits: 0
        }).format(valor || 0);

      // Fondo blanco base
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, 842, 'F');

      // 2. Encabezado Corporativo
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(8, 19, 14); // #08130E
      doc.text('ELOHIM IMPORT - REPORTE DE CUENTAS POR COBRAR', 40, 45);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Fecha de Generación: ${new Date().toLocaleDateString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}  |  Estado: Cuentas Pendientes & Vencidas`,
        40,
        62
      );

      // Línea divisoria dorada
      doc.setDrawColor(208, 169, 107); // #D0A96B
      doc.setLineWidth(1.5);
      doc.line(40, 72, pageWidth - 40, 72);

      // 3. Mapeo de Filas
      const tableRows = debtors.map((d) => [
        d.client_name,
        d.client_phone,
        d.status,
        d.due_date,
        formatARS(d.total_amount_ars),
        formatARS(d.balance_ars)
      ]);

      // 4. Tabla Principal con autoTable y tema 'grid'
      autoTable(doc, {
        startY: 85,
        head: [['Cliente', 'Contacto', 'Estado', 'Vencimiento', 'Monto Original', 'Saldo Deudor (ARS)']],
        body: tableRows,
        theme: 'grid',
        headStyles: {
          fillColor: [8, 19, 14], // #08130E
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'left'
        },
        columnStyles: {
          0: { cellWidth: 120, fontStyle: 'bold' },
          1: { cellWidth: 85 },
          2: { cellWidth: 70, halign: 'center' },
          3: { cellWidth: 75, halign: 'center' },
          4: { cellWidth: 80, halign: 'right' },
          5: { cellWidth: 85, halign: 'right', fontStyle: 'bold' }
        },
        styles: {
          fontSize: 8.5,
          textColor: [30, 41, 59],
          cellPadding: 5
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        didParseCell: function (data) {
          if (data.section === 'body' && data.column.index === 2) {
            if (data.cell.raw === 'VENCIDO') {
              data.cell.styles.textColor = [225, 29, 72]; // Rose-600
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.textColor = [217, 119, 6]; // Amber-600
            }
          }
        }
      });

      // 5. Resumen Financiero al final de la tabla ("Dinero en la Calle")
      const finalY = (doc as any).lastAutoTable?.finalY || 200;

      doc.setFillColor(241, 245, 249);
      doc.roundedRect(40, finalY + 15, pageWidth - 80, 40, 6, 6, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(8, 19, 14);
      doc.text('RESUMEN DE DINERO EN LA CALLE:', 55, finalY + 39);

      doc.setFontSize(12);
      doc.setTextColor(184, 134, 11); // Dorado
      doc.text(
        `Total Saldo Deudor: ${formatARS(totalMoneyOnTheStreet)}`,
        pageWidth - 55,
        finalY + 39,
        { align: 'right' }
      );

      // 6. Pie de página corporativo
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        'Elohim Import ERP • Sistema Bimonetario de Perfumería y Cuentas Corrientes',
        40,
        820
      );

      doc.save(`elohim-reporte-deudores-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Reporte PDF de cuentas por cobrar descargado con éxito.');
    } catch (pdfErr: any) {
      console.error('Error al generar PDF de deudores:', pdfErr);
      toast.error('Error al generar el documento PDF: ' + pdfErr.message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Filtrado de lista
  const filteredSales = sales.filter(item => {
    const clientName = (item.clients?.name || 'Consumidor Final').toLowerCase();
    const phone = (item.clients?.phone || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    return clientName.includes(search) || phone.includes(search) || item.id.includes(search);
  });

  // Métricas KPI
  const totalAmountDueGlobal = sales.reduce((sum, s) => sum + s.amount_due_ars, 0);
  const pendingSalesCount = sales.length;
  const totalCollectedInstallments = sales.reduce((sum, s) => {
    const totalInst = (s.sale_installments || []).reduce((instSum, inst) => instSum + inst.amount_paid_ars, 0);
    return sum + totalInst;
  }, 0);

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
                <CreditCard className="h-4.5 w-4.5" />
              </div>
              <span className="text-sm font-bold tracking-tight text-white uppercase font-serif">
                Cuentas por Cobrar & Deudores
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <ShiftStatusBadge />
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
              Panel de Cuentas por Cobrar (Fiados / Pagos Parciales)
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Administración de ventas con saldo pendiente de pago (`payment_status != &apos;paid&apos;`) y registro de cuotas abonadas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={downloadDebtorsReport}
              disabled={isGeneratingPdf}
              className="border-[#1B362A] bg-[#13261E] text-xs font-semibold text-zinc-300 hover:bg-zinc-800 cursor-pointer shadow-md"
            >
              <Download className={`mr-1.5 h-3.5 w-3.5 text-[#D0A96B] ${isGeneratingPdf ? 'animate-bounce' : ''}`} />
              {isGeneratingPdf ? 'Generando PDF...' : 'Exportar Reporte PDF'}
            </Button>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchSales}
              className="border-[#1B362A] bg-[#13261E] text-xs font-semibold text-zinc-300 hover:bg-zinc-800 cursor-pointer"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5 text-[#D0A96B]" /> Actualizar Deudores
            </Button>
          </div>
        </div>

        {/* GRILLA DE TARJETAS KPI */}
        <div className="grid gap-4 sm:grid-cols-3">
          
          <Card className="border border-[#1B362A] bg-[#13261E] rounded-2xl shadow-xl">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardDescription className="text-[10px] font-extrabold uppercase tracking-widest text-[#D0A96B]">
                  Cuentas por Cobrar (Dinero en la calle)
                </CardDescription>
                <CardTitle className="text-2xl font-black text-amber-400 font-mono mt-1.5 font-serif">
                  ${totalAmountDueGlobal.toLocaleString('es-AR')} ARS
                </CardTitle>
              </div>
              <div className="h-10 w-10 rounded-xl bg-[#D0A96B]/10 border border-[#D0A96B]/30 flex items-center justify-center text-[#D0A96B]">
                <Coins className="h-5 w-5" />
              </div>
            </CardHeader>
          </Card>

          <Card className="border border-[#1B362A] bg-[#13261E] rounded-2xl shadow-xl">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardDescription className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">
                  Ventas con Saldo Pendiente
                </CardDescription>
                <CardTitle className="text-2xl font-bold tracking-tight text-white mt-1.5 font-serif">
                  {pendingSalesCount} transacciones
                </CardTitle>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Clock className="h-5 w-5" />
              </div>
            </CardHeader>
          </Card>

          <Card className="border border-[#1B362A] bg-[#13261E] rounded-2xl shadow-xl">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardDescription className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">
                  Abonos Parciales Recaudados
                </CardDescription>
                <CardTitle className="text-2xl font-bold tracking-tight text-emerald-400 mt-1.5 font-serif">
                  ${totalCollectedInstallments.toLocaleString('es-AR')} ARS
                </CardTitle>
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <TrendingUp className="h-5 w-5" />
              </div>
            </CardHeader>
          </Card>

        </div>

        {/* BARRA DE BÚSQUEDA */}
        <div className="bg-[#13261E] p-4 rounded-2xl border border-[#1B362A] shadow-xl">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Buscar por cliente, teléfono o ticket..."
              className="pl-9 bg-[#08130E] border-[#1B362A] text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* DATA TABLE DE VENTAS CON SALDO PENDIENTE */}
        <Card className="border border-[#1B362A] bg-[#13261E] rounded-2xl shadow-xl overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-[#D0A96B]" />
                <span className="text-sm font-medium text-zinc-400">Cargando ventas con saldo pendiente...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 text-rose-400 gap-2">
                <AlertCircle className="h-10 w-10" />
                <p className="text-sm font-semibold">{error}</p>
                <Button variant="outline" onClick={fetchSales} className="mt-2 border-[#1B362A]">Reintentar</Button>
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                <CheckCircle className="h-10 w-10 text-emerald-500/40" />
                <h3 className="font-bold text-white font-serif">Sin Cuentas por Cobrar Pendientes</h3>
                <p className="text-xs text-zinc-400 max-w-sm">No hay deudas ni ventas con saldo pendiente en este momento.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1B362A] bg-[#08130E]/60 text-xs font-bold uppercase tracking-wider text-zinc-400 font-serif">
                    <th className="p-4 pl-6">Cliente</th>
                    <th className="p-4">Fecha / Ticket</th>
                    <th className="p-4 text-center">Total Venta</th>
                    <th className="p-4 text-center">Abonado a la Fecha</th>
                    <th className="p-4 text-center text-[#D0A96B]">Saldo Pendiente</th>
                    <th className="p-4 text-center">Estado</th>
                    <th className="p-4 pr-6 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1B362A]/60 text-xs">
                  {filteredSales.map((item) => {
                    const clientName = item.clients?.name || 'Consumidor Final';
                    const paidSoFar = item.total_ars - item.amount_due_ars;
                    const ticketNum = item.id.split('-')[0].toUpperCase();

                    return (
                      <tr key={item.id} className="hover:bg-[#08130E]/40 transition-colors">
                        
                        {/* Cliente */}
                        <td className="p-4 pl-6 font-bold text-white font-serif">
                          <div>{clientName}</div>
                          {item.clients?.phone && (
                            <div className="text-[10px] text-zinc-400 font-mono flex items-center gap-1 font-sans mt-0.5">
                              <Phone className="h-3 w-3 text-zinc-500" /> {item.clients.phone}
                            </div>
                          )}
                        </td>

                        {/* Fecha y Ticket */}
                        <td className="p-4 font-mono text-zinc-400">
                          <div>{new Date(item.created_at).toLocaleDateString('es-AR')}</div>
                          <div className="text-[9px] text-[#D0A96B] font-bold">#{ticketNum}</div>
                        </td>

                        {/* Total Venta */}
                        <td className="p-4 text-center font-mono font-bold text-zinc-300">
                          ${item.total_ars.toLocaleString('es-AR')} ARS
                        </td>

                        {/* Abonado a la fecha */}
                        <td className="p-4 text-center font-mono font-bold text-emerald-400">
                          ${paidSoFar.toLocaleString('es-AR')} ARS
                        </td>

                        {/* Saldo Pendiente */}
                        <td className="p-4 text-center font-mono font-black text-amber-400 text-sm">
                          ${item.amount_due_ars.toLocaleString('es-AR')} ARS
                        </td>

                        {/* Estado Badge */}
                        <td className="p-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <Clock className="h-3 w-3" /> Pago Parcial
                          </span>
                        </td>

                        {/* Acción Registrar Abono */}
                        <td className="p-4 pr-6 text-right">
                          <Button
                            size="sm"
                            onClick={() => handleOpenModal(item)}
                            className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold text-xs shadow-md shadow-[#D0A96B]/20 cursor-pointer"
                          >
                            <DollarSign className="mr-1 h-3.5 w-3.5" /> Registrar Abono
                          </Button>
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

      {/* MODAL REGISTRAR ABONO */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#13261E] border border-[#1B362A] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <form onSubmit={handleConfirmInstallment}>
              
              <CardHeader className="border-b border-[#1B362A] pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold text-white font-serif flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-[#D0A96B]" />
                    Registrar Abono a Venta
                  </CardTitle>
                  <button
                    type="button"
                    onClick={() => setSelectedSale(null)}
                    className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <CardDescription className="text-xs text-zinc-400 mt-1">
                  Cliente: <strong className="text-white">{selectedSale.clients?.name || 'Consumidor Final'}</strong> (Ticket #{selectedSale.id.split('-')[0].toUpperCase()})
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 p-6 max-h-[70vh] overflow-y-auto">
                
                {modalError && (
                  <div className="flex gap-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-400">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span className="font-medium">{modalError}</span>
                  </div>
                )}

                {/* Resumen del Saldo Deudor */}
                <div className="p-3.5 rounded-xl bg-[#08130E] border border-[#1B362A] space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between text-zinc-400">
                    <span>Total Venta Original:</span>
                    <span>${selectedSale.total_ars.toLocaleString('es-AR')} ARS</span>
                  </div>
                  <div className="flex justify-between text-emerald-400">
                    <span>Abonado a la Fecha:</span>
                    <span>${(selectedSale.total_ars - selectedSale.amount_due_ars).toLocaleString('es-AR')} ARS</span>
                  </div>
                  <div className="border-t border-[#1B362A] pt-1.5 flex justify-between font-bold text-amber-400 text-sm">
                    <span>Saldo Restante Pendiente:</span>
                    <span>${selectedSale.amount_due_ars.toLocaleString('es-AR')} ARS</span>
                  </div>
                </div>

                {/* Input Monto del Abono Hoy */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#D0A96B]">
                    Monto que Paga Hoy (ARS) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-zinc-500">$</span>
                    <Input
                      required
                      type="number"
                      placeholder="Monto a ingresar hoy..."
                      value={amountPaidInput}
                      onChange={(e) => setAmountPaidInput(e.target.value)}
                      disabled={submitting}
                      className="pl-7 bg-[#08130E] border-[#1B362A] text-white font-mono font-bold text-sm disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Selección de Método de Pago */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Medio de Pago Recibido
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    disabled={submitting}
                    className="flex h-9 w-full rounded-lg border border-[#1B362A] bg-[#08130E] px-3 py-1 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-[#D0A96B] disabled:opacity-50"
                  >
                    <option value="Efectivo ARS">💵 Efectivo ARS</option>
                    <option value="Transferencia / Alias">🏛️ Transferencia / Alias</option>
                    <option value="MercadoPago">💳 MercadoPago</option>
                    <option value="Tarjeta de Crédito / Débito">💳 Tarjeta de Crédito / Débito</option>
                    <option value="Dólares Billete">💵 Dólares Billete</option>
                  </select>
                </div>

                {/* Histórico de Abonos Anteriores en esta Venta */}
                {selectedSale.sale_installments && selectedSale.sale_installments.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-[#1B362A]">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 flex items-center gap-1">
                      <History className="h-3.5 w-3.5 text-[#D0A96B]" /> Historial de Abonos Recibidos
                    </label>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {selectedSale.sale_installments.map((inst) => (
                        <div key={inst.id} className="flex justify-between items-center text-[11px] p-2 rounded-lg bg-[#08130E] border border-[#1B362A]/60 font-mono">
                          <div>
                            <span className="text-white font-bold">${inst.amount_paid_ars.toLocaleString('es-AR')} ARS</span>
                            <span className="text-zinc-500 text-[10px] ml-1.5">({inst.payment_method})</span>
                          </div>
                          <span className="text-zinc-500 text-[10px]">
                            {new Date(inst.created_at).toLocaleDateString('es-AR')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Banner de Ingreso Automático a Caja */}
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 leading-normal">
                  ✔ <strong>Ingreso Automático a Caja:</strong> Este abono registrará automáticamente una entrada de efectivo/digital en la caja física activa.
                </div>

              </CardContent>

              <CardFooter className="border-t border-[#1B362A] pt-4 flex justify-end gap-3 bg-[#08130E]/60 px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedSale(null)}
                  disabled={submitting}
                  className="border-[#1B362A] bg-[#13261E] text-zinc-300 hover:bg-zinc-800"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold text-xs shadow-md shadow-[#D0A96B]/20 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Procesando Abono...
                    </>
                  ) : (
                    'Confirmar Abono e Ingresar a Caja'
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
