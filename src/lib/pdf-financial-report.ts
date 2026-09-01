import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FinancialReportData } from '@/app/actions/analytics';
import { RetailKPIsData } from '@/app/actions/reports';
import { MonthlyProjectionData } from '@/app/actions/goals';
import { InventoryValuationMetrics } from '@/app/actions/inventoryAnalytics';

export interface GeneratePdfParams {
  report: FinancialReportData;
  retailData?: RetailKPIsData | null;
  goalsData?: MonthlyProjectionData | null;
  inventoryData?: InventoryValuationMetrics | null;
  periodLabel: string;
  storeName?: string;
}

const formatARS = (val: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val || 0);

/**
 * Generador empresarial de Reporte Financiero en PDF nativo vectorial.
 * Utiliza jspdf-autotable para un renderizado nítido, paginación automática y sin cortes de página.
 */
export function generateFinancialReportPDF({
  report,
  retailData,
  goalsData,
  inventoryData,
  periodLabel,
  storeName = 'ELOHIM IMPORT ERP'
}: GeneratePdfParams): jsPDF {
  const doc = new jsPDF('p', 'pt', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  // Colores de la marca Elohim
  const brandDark: [number, number, number] = [8, 19, 14];       // #08130E
  const brandGreen: [number, number, number] = [19, 38, 30];     // #13261E
  const brandGold: [number, number, number] = [208, 169, 107];   // #D0A96B
  const brandTextDark: [number, number, number] = [30, 41, 59];  // Slate 800
  const brandMuted: [number, number, number] = [100, 116, 139];  // Slate 500

  // 1. ENCABEZADO CORPORATIVO
  doc.setFillColor(...brandDark);
  doc.rect(0, 0, pageWidth, 60, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...brandGold);
  doc.text(storeName.toUpperCase(), 40, 32);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(220, 230, 225);
  doc.text(`ESTADO DE RESULTADOS & REPORTE FINANCIERO OFICIAL`, 40, 47);

  doc.setFontSize(8);
  doc.setTextColor(180, 195, 190);
  doc.text(`Período: ${periodLabel} | Generado: ${new Date().toLocaleDateString('es-AR')}`, pageWidth - 40, 47, { align: 'right' });

  // Opciones base para autoTable
  const baseTableOptions = {
    theme: 'grid' as const,
    headStyles: {
      fillColor: brandGreen,
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: 'bold' as const,
      fontSize: 9,
      halign: 'left' as const,
    },
    bodyStyles: {
      textColor: brandTextDark,
      fontSize: 8.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] as [number, number, number],
    },
    margin: { left: 40, right: 40 },
    styles: {
      cellPadding: 5.5,
      lineColor: [226, 232, 240] as [number, number, number],
      lineWidth: 0.5,
    },
  };

  // --- SECCIÓN 1: RESUMEN EJECUTIVO (KPI CARDS EN TABLA) ---
  const kpiBody = [
    [
      'Ingresos Brutos',
      formatARS(report.grossRevenue),
      'Costo Mercadería (COGS)',
      formatARS(-report.cogs),
    ],
    [
      'Margen Bruto (%)',
      `${report.grossMarginPercent}%`,
      'Comisiones Pasarelas',
      formatARS(-report.gatewayFeeArs),
    ],
    [
      'Gastos Operativos (OPEX)',
      formatARS(-report.opex),
      'Reintegros / Devoluciones',
      formatARS(-report.totalRefundsArs),
    ],
    [
      'GANANCIA NETA FINAL',
      `${formatARS(report.netProfit)} (${report.profitMarginPercent}% Margen)`,
      'Dinero en Calle (CxC)',
      formatARS(report.totalAmountDueArs),
    ],
  ];

  autoTable(doc, {
    ...baseTableOptions,
    startY: 75,
    head: [['Indicador Clave', 'Valor (ARS)', 'Indicador Clave', 'Valor (ARS)']],
    body: kpiBody,
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 140 },
      1: { halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] },
      2: { fontStyle: 'bold', cellWidth: 140 },
      3: { halign: 'right', fontStyle: 'bold' },
    },
  });

  let nextY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 18 : 200;

  // --- SECCIÓN 2: ESTADO DE RESULTADOS FORMAL ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...brandDark);
  doc.text('1. Estado de Resultados Detallado', 40, nextY);

  const estadoResultadosBody = [
    ['(+) Facturación Bruta por Ventas', formatARS(report.grossRevenue), '100.0%'],
    ['(-) Costo de Mercadería Vendida (COGS Real)', formatARS(-report.cogs), `${report.grossRevenue > 0 ? ((report.cogs / report.grossRevenue) * 100).toFixed(1) : 0}%`],
    ['(=) UTILIDAD BRUTA', formatARS(report.grossMargin), `${report.grossMarginPercent}%`],
    ['(-) Gastos Operativos del Período (OPEX)', formatARS(-report.opex), `${report.grossRevenue > 0 ? ((report.opex / report.grossRevenue) * 100).toFixed(1) : 0}%`],
    ['(-) Costos Bancarios y Comisiones de Pasarela', formatARS(-report.gatewayFeeArs), `${report.grossRevenue > 0 ? ((report.gatewayFeeArs / report.grossRevenue) * 100).toFixed(1) : 0}%`],
    ['(-) Devoluciones e Incompletitudes', formatARS(-report.totalRefundsArs), `${report.grossRevenue > 0 ? ((report.totalRefundsArs / report.grossRevenue) * 100).toFixed(1) : 0}%`],
    ['(=) RESULTADO NETO DEL EJERCICIO', formatARS(report.netProfit), `${report.profitMarginPercent}%`],
  ];

  autoTable(doc, {
    ...baseTableOptions,
    startY: nextY + 6,
    head: [['Concepto Contable', 'Monto (ARS)', '% s/ Ventas']],
    body: estadoResultadosBody,
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right', fontStyle: 'bold' },
      2: { halign: 'right', textColor: brandMuted },
    },
  });

  nextY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 18 : nextY + 140;

  // --- SECCIÓN 3: DESGLOSE DE GASTOS OPERATIVOS (OPEX) ---
  if (report.categoryBreakdown && report.categoryBreakdown.length > 0) {
    if (nextY > 680) {
      doc.addPage();
      nextY = 40;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...brandDark);
    doc.text('2. Desglose de Gastos Operativos (OPEX)', 40, nextY);

    const opexBody = report.categoryBreakdown.map((cat) => [
      cat.name,
      formatARS(cat.value),
      `${report.opex > 0 ? ((cat.value / report.opex) * 100).toFixed(1) : 0}%`,
    ]);

    autoTable(doc, {
      ...baseTableOptions,
      startY: nextY + 6,
      head: [['Categoría de Gasto', 'Monto Invertido (ARS)', 'Participación %']],
      body: opexBody,
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
      },
    });

    nextY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 18 : nextY + 100;
  }

  // --- SECCIÓN 4: MONITOREO DE METAS MENSUALES ---
  if (goalsData) {
    if (nextY > 680) {
      doc.addPage();
      nextY = 40;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...brandDark);
    doc.text(`3. Monitoreo de Metas (${goalsData.monthName})`, 40, nextY);

    const metasBody = [
      [
        'Facturación / Ingresos Brutos',
        formatARS(goalsData.currentRevenueArs),
        formatARS(goalsData.revenueGoalArs),
        `${goalsData.revenueProgressPercent}%`,
        goalsData.isClosed ? 'Cerrado' : `${goalsData.runRatePercent}% (Run Rate)`,
      ],
      [
        'Ganancia Neta Estimada',
        formatARS(goalsData.currentNetProfitArs),
        formatARS(goalsData.netProfitGoalArs),
        `${goalsData.profitProgressPercent}%`,
        goalsData.isClosed ? 'Cerrado' : 'En Curso',
      ],
    ];

    autoTable(doc, {
      ...baseTableOptions,
      startY: nextY + 6,
      head: [['Indicador de Meta', 'Logrado (ARS)', 'Objetivo (ARS)', 'Avance %', 'Estado']],
      body: metasBody,
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'center', fontStyle: 'bold' },
        4: { halign: 'center' },
      },
    });

    nextY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 18 : nextY + 80;
  }

  // --- SECCIÓN 5: TOP BEST SELLERS Y KPIS RETAIL ---
  if (retailData && retailData.topBestSellers && retailData.topBestSellers.length > 0) {
    if (nextY > 680) {
      doc.addPage();
      nextY = 40;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...brandDark);
    doc.text(`4. Ranking de Fragancias Más Vendidas (AOV: ${formatARS(retailData.averageOrderValueArs)})`, 40, nextY);

    const topSellersBody = retailData.topBestSellers.map((item, idx) => [
      `#${idx + 1}`,
      `${item.name} (${item.brand})`,
      item.sku,
      `${item.units_sold} ud`,
      formatARS(item.total_revenue_ars),
    ]);

    autoTable(doc, {
      ...baseTableOptions,
      startY: nextY + 6,
      head: [['#', 'Producto / Fragancia', 'SKU', 'Cantidad', 'Facturado']],
      body: topSellersBody,
      columnStyles: {
        0: { halign: 'center', cellWidth: 25 },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold' },
      },
    });
  }

  // --- PIE DE PÁGINA CORPORATIVO EN TODAS LAS PÁGINAS ---
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...brandMuted);
    doc.text(
      `Elohim Import ERP • Sistema de Gestión Comercial y Analítica Financiera — Página ${i} de ${totalPages}`,
      40,
      822
    );
    doc.text(`Confidencial - Exclusivo para Administración`, pageWidth - 40, 822, { align: 'right' });
  }

  return doc;
}

/**
 * Exportador de datos financieros a formato CSV compatible con Microsoft Excel y Google Sheets.
 * Incluye UTF-8 BOM (\uFEFF) para visualización correcta de tildes y caracteres en español.
 */
export function exportFinancialReportToCsv({
  report,
  periodLabel,
  storeName = 'Elohim Import'
}: {
  report: FinancialReportData;
  periodLabel: string;
  storeName?: string;
}) {
  const rows: string[][] = [
    [`REPORTE FINANCIERO Y ESTADO DE RESULTADOS - ${storeName.toUpperCase()}`],
    [`Periodo: ${periodLabel}`],
    [`Fecha de Generacion: ${new Date().toLocaleDateString('es-AR')}`],
    [''],
    ['--- ESTADO DE RESULTADOS ---'],
    ['Concepto', 'Monto (ARS)', '% sobre Ventas'],
    ['Ingresos Brutos por Ventas', String(report.grossRevenue), '100%'],
    ['Costo de Mercaderia Vendida (COGS)', String(-report.cogs), `${report.grossRevenue > 0 ? ((report.cogs / report.grossRevenue) * 100).toFixed(2) : 0}%`],
    ['Utilidad Bruta', String(report.grossMargin), `${report.grossMarginPercent}%`],
    ['Gastos Operativos (OPEX)', String(-report.opex), `${report.grossRevenue > 0 ? ((report.opex / report.grossRevenue) * 100).toFixed(2) : 0}%`],
    ['Comisiones Pasarelas de Pago', String(-report.gatewayFeeArs), `${report.grossRevenue > 0 ? ((report.gatewayFeeArs / report.grossRevenue) * 100).toFixed(2) : 0}%`],
    ['Devoluciones y Reintegros', String(-report.totalRefundsArs), `${report.grossRevenue > 0 ? ((report.totalRefundsArs / report.grossRevenue) * 100).toFixed(2) : 0}%`],
    ['GANANCIA NETA FINAL', String(report.netProfit), `${report.profitMarginPercent}%`],
    ['Cuentas por Cobrar Pendientes (CxC)', String(report.totalAmountDueArs), 'N/A'],
    [''],
    ['--- DESGLOSE DE GASTOS OPERATIVOS (OPEX) ---'],
    ['Categoria', 'Monto (ARS)', 'Participacion %'],
  ];

  if (report.categoryBreakdown && report.categoryBreakdown.length > 0) {
    report.categoryBreakdown.forEach((cat) => {
      const part = report.opex > 0 ? ((cat.value / report.opex) * 100).toFixed(2) : '0';
      rows.push([cat.name, String(cat.value), `${part}%`]);
    });
  } else {
    rows.push(['Sin gastos registrados', '0', '0%']);
  }

  rows.push(['']);
  rows.push(['--- EVOLUCION DIARIA ---']);
  rows.push(['Fecha', 'Ingresos Brutos (ARS)', 'Ganancia Neta Estimada (ARS)']);

  if (report.trendData && report.trendData.length > 0) {
    report.trendData.forEach((t) => {
      rows.push([t.date, String(t.ingresos), String(t.ganancia)]);
    });
  }

  // Convertir a CSV separado por punto y coma (estándar hispano de Excel)
  const csvContent = '\uFEFF' + rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Reporte_Financiero_${periodLabel.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
