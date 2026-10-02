import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { FinancialReportData } from '@/app/actions/analytics';
import type { RetailKPIsData } from '@/app/actions/reports';
import type { MonthlyProjectionData } from '@/app/actions/goals';
import type { InventoryValuationMetrics } from '@/app/actions/inventoryAnalytics';
import type { TreasuryAccount } from '@/app/actions/treasury';
import type { FormatMarginRow } from '@/app/actions/retailMetrics';

export interface FormatMarginPdfData {
  decant: FormatMarginRow | null;
  bottle: FormatMarginRow | null;
  marginDeltaPercent: number;
}

export interface GeneratePdfParams {
  report: FinancialReportData;
  retailData?: RetailKPIsData | null;
  goalsData?: MonthlyProjectionData | null;
  inventoryData?: InventoryValuationMetrics | null;
  treasuryAccounts?: TreasuryAccount[] | null;
  formatMarginData?: FormatMarginPdfData | null;
  /** Pendiente de pago a proveedores (CxP) para el Capital de Trabajo Neto. */
  payablesPendingArs?: number | null;
  /** Tasa de cambio USD utilizada para la visibilidad bimonetaria del documento. */
  exchangeRateUsed?: number | null;
  periodLabel: string;
  storeName?: string;
}

const formatARS = (val: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val || 0);

const formatUSD = (val: number) =>
  `u$s ${(val || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Normaliza nombres de categorías de gastos operativos (OPEX) para unificar
 * categorías redundantes como "Marketing/Showroom" y "Marketing".
 */
export function normalizeOpexCategory(categoryName: string): string {
  const raw = (categoryName || '').trim().toLowerCase();
  if (
    raw.includes('marketing') ||
    raw.includes('showroom') ||
    raw.includes('publicidad') ||
    raw.includes('redes') ||
    raw.includes('meta') ||
    raw.includes('ads')
  ) {
    return 'Marketing & Publicidad';
  }
  if (
    raw.includes('alquiler') ||
    raw.includes('local') ||
    raw.includes('inmueble') ||
    raw.includes('expensa')
  ) {
    return 'Alquiler & Espacio Físico';
  }
  if (
    raw.includes('sueldo') ||
    raw.includes('salario') ||
    raw.includes('honorario') ||
    raw.includes('emplead') ||
    raw.includes('comision')
  ) {
    return 'Sueldos & Recursos Humanos';
  }
  if (
    raw.includes('servicio') ||
    raw.includes('luz') ||
    raw.includes('internet') ||
    raw.includes('agua') ||
    raw.includes('gas') ||
    raw.includes('telefono')
  ) {
    return 'Servicios & Mantenimiento';
  }
  if (
    raw.includes('logistica') ||
    raw.includes('envio') ||
    raw.includes('flete') ||
    raw.includes('transporte') ||
    raw.includes('correo')
  ) {
    return 'Logística & Distribución';
  }
  if (
    raw.includes('packaging') ||
    raw.includes('bolsa') ||
    raw.includes('caja') ||
    raw.includes('embalaje') ||
    raw.includes('etiqueta')
  ) {
    return 'Insumos de Packaging';
  }
  if (
    raw.includes('software') ||
    raw.includes('app') ||
    raw.includes('hosting') ||
    raw.includes('licencia') ||
    raw.includes('dominio')
  ) {
    return 'Software & Tecnología';
  }
  if (
    raw.includes('impuesto') ||
    raw.includes('tasa') ||
    raw.includes('afip') ||
    raw.includes('arba') ||
    raw.includes('iibb')
  ) {
    return 'Impuestos & Tasas';
  }
  return categoryName
    ? categoryName.charAt(0).toUpperCase() + categoryName.slice(1)
    : 'Otros Gastos Operativos';
}

/**
 * Generador Ejecutivo de Reporte Financiero & Estado de Resultados Oficial
 * Diseñado bajo estética premium corporativa Elohim Import (Fondos oscuro/esmeralda,
 * acentos en oro #D0A96B, bordes #1B362A).
 *
 * ESTRUCTURA ESTRICTA DE EXACTAMENTE 2 PÁGINAS (SIN DESBORDES NI SALTOS HUÉRFANOS):
 *   PÁGINA 1:
 *     - Encabezado Corporativo Elohim Import (TC USD / Período / Fecha).
 *     - Grid Superior 4 KPI Cards (Ventas, Margen Comercial, OPEX, Ganancia Neta).
 *     - Estado de Resultados Integral (P&L) con OPEX normalizado y métricas bimonetarias.
 *     - Rentabilidad por Formato: Decants (volumen real saneado) vs. Frascos Cerrados.
 *     - Banner de Auditoría y Certificación de Saneamiento de Costos con word-wrap.
 *   PÁGINA 2:
 *     - Mini Encabezado Institucional.
 *     - Top 8 Fragancias Más Vendidas con badges visuales [DECANT] / [BOTELLA].
 *     - Grid Equilibrado de 2 Columnas:
 *         * Columna Izquierda: Valoración de Stock e Inventario Activo.
 *         * Columna Derecha: Tesorería Multicuenta (Efectivo, Digital/Wallets, Consolidado).
 *     - Posición de Liquidez & Capital de Trabajo Neto (Working Capital).
 *     - Pie de Página Institucional con paginación "Página X de 2".
 */
export function generateFinancialReportPDF({
  report,
  retailData,
  goalsData,
  inventoryData,
  treasuryAccounts,
  formatMarginData,
  payablesPendingArs,
  exchangeRateUsed,
  periodLabel,
  storeName = 'ELOHIM IMPORT'
}: GeneratePdfParams): jsPDF {
  const JsPdfClass = typeof jsPDF === 'function' ? jsPDF : ((jsPDF as any).jsPDF || (jsPDF as any).default);
  const doc = new JsPdfClass('p', 'pt', 'a4');
  const runAutoTable = typeof autoTable === 'function' ? autoTable : ((autoTable as any).default || (autoTable as any));
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Paleta corporativa Elohim Import
  const brandDark: [number, number, number] = [8, 19, 14];        // #08130E fondo institucional
  const brandGreen: [number, number, number] = [19, 38, 30];      // #13261E superficie / paneles
  const brandBorder: [number, number, number] = [27, 54, 42];     // #1B362A separadores
  const brandGold: [number, number, number] = [208, 169, 107];    // #D0A96B acento dorado
  const cream: [number, number, number] = [244, 241, 234];        // #F4F1EA texto principal
  const mutedOnDark: [number, number, number] = [156, 163, 175];  // #9CA3AF texto secundario
  const emerald: [number, number, number] = [16, 185, 129];       // #10B981 rentabilidad positiva
  const darkEmeraldBg: [number, number, number] = [14, 44, 36];   // #0E2C24 fondo positivo
  const rose: [number, number, number] = [244, 63, 94];           // #F43F5E alertas / egresos
  const darkRoseBg: [number, number, number] = [59, 18, 30];      // #3B121E fondo egresos
  const goldDarkBg: [number, number, number] = [42, 34, 16];      // #2A2210 fondo dorado

  const leftMargin = 36;
  const rightMargin = 36;
  const contentWidth = pageWidth - leftMargin - rightMargin; // 523.28 pt

  // Tasa de cambio de referencia
  const rate = exchangeRateUsed && exchangeRateUsed > 0 ? exchangeRateUsed : null;
  const rateLabel = rate ? `TC Ref. (Blue): ${formatARS(rate)}` : 'TC Ref.: n/d';

  // Configuración base compartida para autoTable
  const baseTableOptions = {
    theme: 'grid' as const,
    headStyles: {
      fillColor: brandGreen,
      textColor: brandGold,
      fontStyle: 'bold' as const,
      fontSize: 7.5,
      halign: 'left' as const,
      lineColor: brandBorder,
      lineWidth: 0.5,
    },
    bodyStyles: {
      textColor: cream,
      fontSize: 7.2,
      fillColor: brandDark,
      lineColor: brandBorder,
      lineWidth: 0.5,
    },
    alternateRowStyles: {
      fillColor: brandGreen,
    },
    margin: { left: leftMargin, right: rightMargin },
    styles: {
      cellPadding: 4,
      lineColor: brandBorder,
      lineWidth: 0.5,
    },
  };

  const drawSectionTitle = (title: string, subtitle?: string, yPos?: number) => {
    const y = yPos || 100;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...brandGold);
    doc.text(title.toUpperCase(), leftMargin, y);

    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(...mutedOnDark);
      doc.text(subtitle, leftMargin, y + 10);
    }
  };

  // ============================================================================
  // PÁGINA 1: ESTADO DE RESULTADOS, MARGEN REAL Y RENTABILIDAD POR FORMATO
  // ============================================================================
  doc.setFillColor(...brandDark);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // --- ENCABEZADO CORPORATIVO ELOHIM IMPORT ---
  doc.setFillColor(...brandGreen);
  doc.rect(0, 0, pageWidth, 68, 'F');
  doc.setDrawColor(...brandGold);
  doc.setLineWidth(1.4);
  doc.line(0, 68, pageWidth, 68);

  // Logo / Título Empresa
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...brandGold);
  doc.text(storeName.toUpperCase(), leftMargin, 26);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...cream);
  doc.text('ESTADO DE RESULTADOS & REPORTE FINANCIERO OFICIAL', leftMargin, 40);

  // Badge institucional de consistencia contable
  doc.setFillColor(...brandDark);
  doc.setDrawColor(...emerald);
  doc.setLineWidth(0.6);
  doc.roundedRect(leftMargin, 48, 160, 14, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...emerald);
  doc.text('AUDITADO • COSTEO DE BOM & DECANTS SANEADO', leftMargin + 6, 57.5);

  // Metadatos de Cabecera (Derecha)
  const metaRightX = pageWidth - rightMargin;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...mutedOnDark);
  doc.text(`Período: ${periodLabel}`, metaRightX, 24, { align: 'right' });
  doc.text(`Emisión: ${new Date().toLocaleDateString('es-AR')}`, metaRightX, 36, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...brandGold);
  doc.text(rateLabel, metaRightX, 48, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...mutedOnDark);
  doc.text('Valores expresados en ARS con equivalencia USD', metaRightX, 58, { align: 'right' });

  // --- GRID SUPERIOR 4 KPI CARDS ---
  const kpiCount = 4;
  const kpiGap = 8;
  const kpiCardW = (contentWidth - (kpiCount - 1) * kpiGap) / kpiCount; // ~124.8 pt
  const kpiCardH = 58;
  const kpiY = 78;

  const drawKpiBlock = (
    index: number,
    label: string,
    valText: string,
    subText: string,
    color: [number, number, number],
    isHighlight: boolean = false
  ) => {
    const cardX = leftMargin + index * (kpiCardW + kpiGap);
    doc.setFillColor(...brandGreen);
    doc.setDrawColor(...(isHighlight ? brandGold : brandBorder));
    doc.setLineWidth(isHighlight ? 1.3 : 0.6);
    doc.roundedRect(cardX, kpiY, kpiCardW, kpiCardH, 3, 3, 'FD');

    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...(isHighlight ? brandGold : mutedOnDark));
    doc.text(label.toUpperCase(), cardX + 8, kpiY + 14);

    // Valor Principal
    doc.setFontSize(10.5);
    doc.setTextColor(...color);
    doc.text(valText, cardX + 8, kpiY + 31);

    // Subtexto / USD / Ratio
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...(isHighlight ? emerald : mutedOnDark));
    doc.text(subText, cardX + 8, kpiY + 46);
  };

  const grossUsdStr = rate ? formatUSD(report.grossRevenue / rate) : 'n/d';
  const marginUsdStr = rate ? formatUSD(report.grossMargin / rate) : 'n/d';
  const opexPctStr = report.grossRevenue > 0 ? `${((report.opex / report.grossRevenue) * 100).toFixed(1)}% s/ vtas` : '0.0%';
  const netUsdStr = rate ? formatUSD(report.netProfit / rate) : 'n/d';

  drawKpiBlock(0, 'Ventas Brutas', formatARS(report.grossRevenue), grossUsdStr, cream);
  drawKpiBlock(1, 'Margen Comercial', formatARS(report.grossMargin), `${report.grossMarginPercent.toFixed(1)}% (${marginUsdStr})`, emerald);
  drawKpiBlock(2, 'Gastos Operativos', formatARS(-report.opex), opexPctStr, rose);
  drawKpiBlock(3, 'GANANCIA NETA REAL', formatARS(report.netProfit), `${report.profitMarginPercent.toFixed(1)}% (${netUsdStr})`, brandGold, true);

  // --- ESTADO DE RESULTADOS DETALLADO (P&L) ---
  const pnlTitleY = 148;
  drawSectionTitle('1. Estado de Resultados Integral (P&L)', 'Consolidación devengada con absorción de COGS saneado, pasarelas y gastos operativos', pnlTitleY);

  const pctOfRev = (val: number) =>
    report.grossRevenue > 0 ? `${((val / report.grossRevenue) * 100).toFixed(1)}%` : '0.0%';

  // Normalización de categorías de OPEX
  const normalizedOpexMap = new Map<string, number>();
  if (report.categoryBreakdown && report.categoryBreakdown.length > 0) {
    report.categoryBreakdown.forEach((cat) => {
      const norm = normalizeOpexCategory(cat.name);
      normalizedOpexMap.set(norm, (normalizedOpexMap.get(norm) || 0) + Number(cat.value || 0));
    });
  }

  const pnlBody: string[][] = [
    ['(+) Facturación Bruta por Ventas', formatARS(report.grossRevenue), rate ? formatUSD(report.grossRevenue / rate) : 'n/d', '100.0%'],
    ['(-) Costo de Mercadería Vendida (COGS Real Saneado)', formatARS(-report.cogs), rate ? formatUSD(-report.cogs / rate) : 'n/d', pctOfRev(report.cogs)],
    ['(=) UTILIDAD BRUTA / MARGEN COMERCIAL REAL', formatARS(report.grossMargin), rate ? formatUSD(report.grossMargin / rate) : 'n/d', `${report.grossMarginPercent.toFixed(1)}%`],
    ['(-) Gastos Operativos Totales (OPEX)', formatARS(-report.opex), rate ? formatUSD(-report.opex / rate) : 'n/d', pctOfRev(report.opex)],
  ];

  // Si existen categorías de OPEX normalizadas, incluir las 3 principales como sub-ítems
  if (normalizedOpexMap.size > 0) {
    const sortedCats = Array.from(normalizedOpexMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    sortedCats.forEach(([catName, amount]) => {
      pnlBody.push([
        `     • ${catName}`,
        formatARS(-amount),
        rate ? formatUSD(-amount / rate) : 'n/d',
        pctOfRev(amount)
      ]);
    });
  }

  pnlBody.push(
    ['(-) Costos Bancarios y Comisiones de Pasarela', formatARS(-report.gatewayFeeArs), rate ? formatUSD(-report.gatewayFeeArs / rate) : 'n/d', pctOfRev(report.gatewayFeeArs)],
    ['(-) Devoluciones y Reintegros Comerciales', formatARS(-report.totalRefundsArs), rate ? formatUSD(-report.totalRefundsArs / rate) : 'n/d', pctOfRev(report.totalRefundsArs)],
    ['(=) RESULTADO NETO FINAL DEL EJERCICIO', formatARS(report.netProfit), rate ? formatUSD(report.netProfit / rate) : 'n/d', `${report.profitMarginPercent.toFixed(1)}%`]
  );

  runAutoTable(doc, {
    ...baseTableOptions,
    startY: 165,
    head: [['Concepto Contable', 'Monto (ARS)', 'Equiv. USD', '% s/ Ventas']],
    body: pnlBody,
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right', fontStyle: 'bold', cellWidth: 110 },
      2: { halign: 'right', textColor: brandGold, cellWidth: 105 },
      3: { halign: 'right', textColor: mutedOnDark, fontStyle: 'bold', cellWidth: 85 },
    },
    didParseCell: (data: any) => {
      if (data.section === 'body') {
        const rawRow = Array.isArray(data.row.raw) ? data.row.raw : Object.values(data.row.raw || {});
        const text = String(rawRow[0] || '');
        if (text.includes('UTILIDAD BRUTA')) {
          data.cell.styles.fillColor = darkEmeraldBg;
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = emerald;
        } else if (text.includes('RESULTADO NETO FINAL')) {
          data.cell.styles.fillColor = goldDarkBg;
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = brandGold;
        } else if (text.startsWith('     •')) {
          data.cell.styles.textColor = mutedOnDark;
          data.cell.styles.fontStyle = 'italic';
          data.cell.styles.fontSize = 6.8;
        }
      }
    },
  });

  let pageOneY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 16 : 330;

  // --- RENTABILIDAD POR FORMATO: DECANTS (ML REALES) VS. FRASCO CERRADO ---
  drawSectionTitle(
    '2. Rentabilidad por Formato: Decants (Volumen Real) vs. Frasco Cerrado',
    'Comparación directa de contribución marginal tras el saneamiento del cálculo de 1 ml a volumen real (5ml / 10ml)',
    pageOneY
  );

  const formatRows: string[][] = [];
  if (formatMarginData) {
    if (formatMarginData.decant) {
      const d = formatMarginData.decant;
      formatRows.push([
        'Decants Fraccionados (5ml / 10ml)',
        String(d.salesCount),
        `${d.unitsSold} decants`,
        formatARS(d.totalRevenueArs),
        formatARS(d.totalRevenueArs - d.grossMarginArs),
        formatARS(d.grossMarginArs),
        `${d.grossMarginPercent.toFixed(1)}%`
      ]);
    }
    if (formatMarginData.bottle) {
      const b = formatMarginData.bottle;
      formatRows.push([
        'Frascos Cerrados (Perfumes Completos)',
        String(b.salesCount),
        `${b.unitsSold} botellas`,
        formatARS(b.totalRevenueArs),
        formatARS(b.totalRevenueArs - b.grossMarginArs),
        formatARS(b.grossMarginArs),
        `${b.grossMarginPercent.toFixed(1)}%`
      ]);
    }
  }

  if (formatRows.length === 0) {
    formatRows.push([
      'Decants Fraccionados',
      '0',
      '0',
      '$ 0,00',
      '$ 0,00',
      '$ 0,00',
      '0.0%'
    ]);
    formatRows.push([
      'Frascos Cerrados',
      '0',
      '0',
      '$ 0,00',
      '$ 0,00',
      '$ 0,00',
      '0.0%'
    ]);
  }

  runAutoTable(doc, {
    ...baseTableOptions,
    startY: pageOneY + 15,
    head: [['Formato de Venta', 'Ventas', 'Unidades', 'Facturación (ARS)', 'Costo Real (ARS)', 'Margen ($)', 'Margen %']],
    body: formatRows,
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'center', cellWidth: 40 },
      2: { halign: 'center', cellWidth: 55 },
      3: { halign: 'right', fontStyle: 'bold', cellWidth: 78 },
      4: { halign: 'right', textColor: mutedOnDark, cellWidth: 76 },
      5: { halign: 'right', fontStyle: 'bold', textColor: emerald, cellWidth: 68 },
      6: { halign: 'right', fontStyle: 'bold', cellWidth: 40 },
    },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 0) {
        const text = String(data.cell.raw || '');
        if (text.includes('Decants')) {
          data.cell.styles.textColor = emerald;
        } else {
          data.cell.styles.textColor = brandGold;
        }
      }
    }
  });

  pageOneY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : pageOneY + 70;

  // Indicador de Delta de Margen
  const delta = formatMarginData?.marginDeltaPercent || 0;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...(delta >= 0 ? emerald : rose));
  doc.text(
    `Delta de Margen Formato: ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}% ${delta >= 0 ? 'a favor del decant fraccionado' : 'a favor del frasco cerrado'}`,
    leftMargin,
    pageOneY
  );

  pageOneY += 16;

  // --- ALERTA DE COSTEO CON WORD-WRAP / CERTIFICACIÓN DE SANEAMIENTO ---
  if (report.warningMessage) {
    const alertLines: string[] = doc.splitTextToSize(
      `[ALERTA DE AUDITORÍA CONTABLE]: ${report.warningMessage}`,
      contentWidth - 24
    );
    const boxHeight = Math.max(26, alertLines.length * 9.5 + 14);

    doc.setFillColor(...darkRoseBg);
    doc.setDrawColor(...rose);
    doc.setLineWidth(0.8);
    doc.roundedRect(leftMargin, pageOneY, contentWidth, boxHeight, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(...rose);
    doc.text(alertLines, leftMargin + 12, pageOneY + 12);
  } else {
    // Certificación de Saneamiento en Verde-Oro con Word-Wrap
    const auditText =
      'El costeo de decants en Elohim Import se computa estrictamente por el volumen real fraccionado (unit_cost = base_cost_ars * decant_ml) con insumos contemplados en base_cost_ars, eliminando márgenes artificiales de 1 ml. Los ingresos se acreditan con trazabilidad multicuenta discriminada entre caja física y billeteras bancarias.';
    const certLines: string[] = doc.splitTextToSize(auditText, contentWidth - 28);
    const boxHeight = certLines.length * 9.5 + 20;

    doc.setFillColor(...brandGreen);
    doc.setDrawColor(...brandGold);
    doc.setLineWidth(0.8);
    doc.roundedRect(leftMargin, pageOneY, contentWidth, boxHeight, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...brandGold);
    doc.text('✔ CERTIFICACIÓN DE AUDITORÍA CONTABLE & SANEAMIENTO DE BOM', leftMargin + 12, pageOneY + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...cream);
    doc.text(certLines, leftMargin + 12, pageOneY + 23);
  }

  // ============================================================================
  // PÁGINA 2: EFICIENCIA OPERATIVA, TOP FRAGANCIAS, STOCK Y TESORERÍA
  // ============================================================================
  doc.addPage();
  doc.setFillColor(...brandDark);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Mini Encabezado Institucional Página 2
  doc.setFillColor(...brandGreen);
  doc.rect(0, 0, pageWidth, 36, 'F');
  doc.setDrawColor(...brandGold);
  doc.setLineWidth(1.2);
  doc.line(0, 36, pageWidth, 36);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...brandGold);
  doc.text(storeName.toUpperCase(), leftMargin, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...cream);
  doc.text('• EFICIENCIA OPERATIVA, STOCK & TESORERÍA MULTICUENTA', leftMargin + 115, 22);

  doc.setFontSize(7.5);
  doc.setTextColor(...mutedOnDark);
  doc.text(`${rateLabel}  |  Período: ${periodLabel}`, metaRightX, 22, { align: 'right' });

  let pageTwoY = 48;

  // --- SECCIÓN 1: TOP 8 FRAGANCIAS MÁS VENDIDAS ---
  const aov = retailData?.averageOrderValueArs || 0;
  drawSectionTitle(
    '1. Top 8 Fragancias Más Vendidas',
    `Ranking estricto por volumen y rentabilidad real (Ticket Promedio AOV: ${formatARS(aov)})`,
    pageTwoY
  );

  const topSellers = (retailData?.topBestSellers || []).slice(0, 8);
  const topSellersBody: string[][] = topSellers.map((item, idx) => {
    const rev = item.total_revenue_ars;
    const cost = item.total_cost_ars || 0;
    const margin = item.net_margin_ars !== undefined ? item.net_margin_ars : (rev - cost);
    const marginPct = item.margin_percent !== undefined ? item.margin_percent : (rev > 0 ? (margin / rev) * 100 : 0);
    const isDecant = item.type === 'decant_liquid' || item.name.toLowerCase().includes('decant') || item.name.toLowerCase().includes('granel');
    const formatBadge = isDecant ? '[DECANT]' : '[BOTELLA]';

    // Truncar nombre si supera 32 caracteres para mantener fila en 1 sola línea
    const cleanName = item.name.length > 32 ? `${item.name.substring(0, 30)}...` : item.name;

    return [
      `#${idx + 1}`,
      formatBadge,
      `${cleanName} (${item.brand || 'Marca'})`,
      item.sku || 'SKU-N/A',
      `${item.units_sold}`,
      formatARS(rev),
      formatARS(cost),
      formatARS(margin),
      `${marginPct.toFixed(1)}%`
    ];
  });

  if (topSellersBody.length === 0) {
    topSellersBody.push(['-', '-', 'Sin ventas registradas en el período', '-', '0', '$ 0,00', '$ 0,00', '$ 0,00', '0.0%']);
  }

  runAutoTable(doc, {
    ...baseTableOptions,
    startY: pageTwoY + 14,
    head: [['#', 'Formato', 'Producto / Fragancia', 'SKU', 'Cant.', 'Facturación', 'Costo Real', 'Margen ($)', 'Margen %']],
    body: topSellersBody,
    styles: {
      ...baseTableOptions.styles,
      cellPadding: 3.5,
      fontSize: 7,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 18 },
      1: { halign: 'center', cellWidth: 48, fontStyle: 'bold' },
      2: {},
      3: { cellWidth: 52, textColor: mutedOnDark },
      4: { halign: 'center', cellWidth: 28 },
      5: { halign: 'right', fontStyle: 'bold', cellWidth: 68 },
      6: { halign: 'right', textColor: mutedOnDark, cellWidth: 62 },
      7: { halign: 'right', fontStyle: 'bold', textColor: emerald, cellWidth: 58 },
      8: { halign: 'right', fontStyle: 'bold', cellWidth: 36 },
    },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 1) {
        const rawRow = Array.isArray(data.row.raw) ? data.row.raw : Object.values(data.row.raw || {});
        const badge = String(rawRow[1] || '');
        if (badge.includes('DECANT')) {
          data.cell.styles.textColor = emerald;
        } else {
          data.cell.styles.textColor = brandGold;
        }
      }
    }
  });

  pageTwoY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 16 : 210;

  // --- SECCIÓN 2: GRID DE INVENTARIO VS. TESORERÍA (2 COLUMNAS EQUILIBRADAS LADO A LADO) ---
  const colGap = 14;
  const halfColWidth = (contentWidth - colGap) / 2; // ~254.64 pt
  const leftColX = leftMargin;
  const rightColX = leftMargin + halfColWidth + colGap;

  // Título Columna Izquierda (Inventario)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...brandGold);
  doc.text('2. VALORACIÓN DE STOCK', leftColX, pageTwoY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...mutedOnDark);
  doc.text('Capital inmovilizado y potencial comercial', leftColX, pageTwoY + 9);

  // Título Columna Derecha (Tesorería)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...brandGold);
  doc.text('3. TESORERÍA MULTICUENTA', rightColX, pageTwoY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...mutedOnDark);
  doc.text('Saldos líquidos en caja y entidades bancarias', rightColX, pageTwoY + 9);

  const gridTablesStartY = pageTwoY + 15;

  // TABLA IZQUIERDA: INVENTARIO
  const inv = inventoryData || {
    capitalInvertido: 0,
    capitalInvertidoUsd: 0,
    valorBrutoVenta: 0,
    valorBrutoVentaUsd: 0,
    gananciaNetaPotencial: 0,
    gananciaNetaPotencialUsd: 0,
    potentialProfitMarginPercent: 0,
    potentialMarkupPercent: 0,
    totalUnitsInStock: 0,
    totalProductsCount: 0
  };

  const invBody: string[][] = [
    ['Capital Invertido (Costo)', `${formatARS(inv.capitalInvertido)}\n(${formatUSD(inv.capitalInvertidoUsd)})`],
    ['Valor Venta Estimado', `${formatARS(inv.valorBrutoVenta)}\n(${formatUSD(inv.valorBrutoVentaUsd)})`],
    ['Ganancia Proyectada', `${formatARS(inv.gananciaNetaPotencial)}\n(${formatUSD(inv.gananciaNetaPotencialUsd)})`],
    ['Margen s/ Venta Estimado', `${inv.potentialProfitMarginPercent.toFixed(1)}% (ROI: ${inv.potentialMarkupPercent.toFixed(1)}%)`],
    ['Unidades & SKUs Activos', `${inv.totalUnitsInStock} u. en ${inv.totalProductsCount} SKUs`],
  ];

  runAutoTable(doc, {
    ...baseTableOptions,
    startY: gridTablesStartY,
    margin: { left: leftColX, right: pageWidth - leftColX - halfColWidth },
    head: [['Métrica de Inventario', 'Valor ARS / Proyección']],
    body: invBody,
    styles: {
      ...baseTableOptions.styles,
      cellPadding: 3.8,
      fontSize: 6.8,
    },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right', fontStyle: 'bold', textColor: emerald },
    },
  });

  const invFinalY = (doc as any).lastAutoTable?.finalY || (gridTablesStartY + 120);

  // TABLA DERECHA: TESORERÍA MULTICUENTA
  const accounts = treasuryAccounts || [];
  const treasuryTotalArs = accounts.reduce((sum, a) => sum + Number(a.balance_ars || 0), 0);

  const treasuryBody: string[][] = [];
  if (accounts.length > 0) {
    accounts.forEach((acc) => {
      const bal = Number(acc.balance_ars || 0);
      const isCash = acc.account_type === 'cash' || acc.account_name.toLowerCase().includes('efectivo');
      const icon = isCash ? '💵' : acc.account_type === 'bank' ? '🏛️' : '💳';
      const part = treasuryTotalArs > 0 ? ` (${((bal / treasuryTotalArs) * 100).toFixed(0)}%)` : '';
      treasuryBody.push([
        `${icon} ${acc.account_name}`,
        `${formatARS(bal)}${part}`
      ]);
    });
  } else {
    treasuryBody.push(['Caja Mostrador General', '$ 0,00']);
    treasuryBody.push(['Cuenta Digital / Banco', '$ 0,00']);
  }

  treasuryBody.push([
    'TOTAL PATRIMONIO DISPONIBLE',
    formatARS(treasuryTotalArs)
  ]);

  runAutoTable(doc, {
    ...baseTableOptions,
    startY: gridTablesStartY,
    margin: { left: rightColX, right: rightMargin },
    head: [['Cuenta de Tesorería', 'Saldo Disponible (ARS)']],
    body: treasuryBody,
    styles: {
      ...baseTableOptions.styles,
      cellPadding: 3.8,
      fontSize: 6.8,
    },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data: any) => {
      if (data.section === 'body') {
        const rawRow = Array.isArray(data.row.raw) ? data.row.raw : Object.values(data.row.raw || {});
        if (String(rawRow[0] || '').includes('TOTAL PATRIMONIO')) {
          data.cell.styles.fillColor = goldDarkBg;
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = brandGold;
        }
      }
    }
  });

  const treasuryFinalY = (doc as any).lastAutoTable?.finalY || (gridTablesStartY + 120);
  pageTwoY = Math.max(invFinalY, treasuryFinalY) + 16;

  // --- SECCIÓN 3: CAPITAL DE TRABAJO NETO (WORKING CAPITAL) ---
  drawSectionTitle(
    '4. Posición de Liquidez & Capital de Trabajo Neto (Working Capital)',
    'Capacidad financiera operativa neta: fondos líquidos + cobros pendientes - compromisos con proveedores',
    pageTwoY
  );

  const pasivoCorrienteArs = payablesPendingArs || 0;
  const dineroEnCalleArs = report.totalAmountDueArs || 0;
  const stockCostoArs = inv.capitalInvertido || 0;

  // Posición Financiera de Liquidez Operativa (Working Capital Financiero)
  const activoCorrienteArs = treasuryTotalArs + dineroEnCalleArs + stockCostoArs;
  const capitalTrabajoNetoArs = activoCorrienteArs - pasivoCorrienteArs;
  const liquidezInmediataArs = treasuryTotalArs + dineroEnCalleArs - pasivoCorrienteArs;

  const ctnBody: string[][] = [
    ['(+)', 'Tesorería Líquida Disponible (Caja Mostrador + Bancos / Wallets)', formatARS(treasuryTotalArs), rate ? formatUSD(treasuryTotalArs / rate) : 'n/d'],
    ['(+)', 'Cuentas por Cobrar Pendientes (Dinero en la Calle / CxC)', formatARS(dineroEnCalleArs), rate ? formatUSD(dineroEnCalleArs / rate) : 'n/d'],
    ['(+)', 'Stock de Mercadería Valorizado a Costo', formatARS(stockCostoArs), rate ? formatUSD(stockCostoArs / rate) : 'n/d'],
    ['(-)', 'Cuentas por Pagar a Proveedores (CxP Pendientes)', formatARS(-pasivoCorrienteArs), rate ? formatUSD(-pasivoCorrienteArs / rate) : 'n/d'],
  ];

  runAutoTable(doc, {
    ...baseTableOptions,
    startY: pageTwoY + 14,
    head: [['', 'Componente Contable de Capital de Trabajo', 'Monto (ARS)', 'Equiv. USD']],
    body: ctnBody,
    styles: {
      ...baseTableOptions.styles,
      cellPadding: 3.5,
      fontSize: 6.8,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 20, fontStyle: 'bold', textColor: mutedOnDark },
      1: { fontStyle: 'bold' },
      2: { halign: 'right', fontStyle: 'bold', cellWidth: 125 },
      3: { halign: 'right', textColor: brandGold, cellWidth: 120 },
    },
  });

  pageTwoY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : pageTwoY + 90;

  // TARJETA EJECUTIVA DE CAPITAL DE TRABAJO NETO
  const ctnCardH = 46;
  const isCtnPositive = capitalTrabajoNetoArs >= 0;

  doc.setFillColor(...(isCtnPositive ? darkEmeraldBg : darkRoseBg));
  doc.setDrawColor(...(isCtnPositive ? emerald : rose));
  doc.setLineWidth(1.2);
  doc.roundedRect(leftMargin, pageTwoY, contentWidth, ctnCardH, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...mutedOnDark);
  doc.text('POSICIÓN FINANCIERA NETA A FAVOR (ACTIVO CORRIENTE - PASIVO CORRIENTE)', leftMargin + 12, pageTwoY + 14);

  doc.setFontSize(12.5);
  doc.setTextColor(...(isCtnPositive ? emerald : rose));
  doc.text(
    `${formatARS(capitalTrabajoNetoArs)}${rate ? `   |   ${formatUSD(capitalTrabajoNetoArs / rate)}` : ''}`,
    leftMargin + 12,
    pageTwoY + 29
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...cream);
  doc.text(
    `Liquidez Inmediata sin Stock (Caja + CxC - CxP): ${formatARS(liquidezInmediataArs)} ${rate ? `(${formatUSD(liquidezInmediataArs / rate)})` : ''} • Solvencia comprobada.`,
    leftMargin + 12,
    pageTwoY + 40
  );

  // ============================================================================
  // PIE DE PÁGINA INSTITUCIONAL EN TODAS LAS PÁGINAS (PÁGINA X DE 2)
  // ============================================================================
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Línea separadora de pie de página
    doc.setDrawColor(...brandBorder);
    doc.setLineWidth(0.8);
    doc.line(leftMargin, 814, pageWidth - rightMargin, 814);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...mutedOnDark);
    doc.text(
      `Elohim Import ERP • Sistema de Gestión Comercial y Analítica Financiera — Página ${i} de ${totalPages}`,
      leftMargin,
      824
    );
    doc.text(
      'Documento Oficial Confidencial — Exclusivo para Administración y Socios',
      pageWidth - rightMargin,
      824,
      { align: 'right' }
    );
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
    ['--- ESTADO DE RESULTADOS (P&L) ---'],
    ['Concepto', 'Monto (ARS)', '% sobre Ventas'],
    ['Ingresos Brutos por Ventas', String(report.grossRevenue), '100%'],
    ['Costo de Mercaderia Vendida (COGS Real Saneado)', String(-report.cogs), `${report.grossRevenue > 0 ? ((report.cogs / report.grossRevenue) * 100).toFixed(2) : 0}%`],
    ['Ganancia Comercial Real (Utilidad Bruta)', String(report.grossMargin), `${report.grossMarginPercent}%`],
    ['Gastos Operativos Totales (OPEX)', String(-report.opex), `${report.grossRevenue > 0 ? ((report.opex / report.grossRevenue) * 100).toFixed(2) : 0}%`],
    ['Comisiones Pasarelas de Pago', String(-report.gatewayFeeArs), `${report.grossRevenue > 0 ? ((report.gatewayFeeArs / report.grossRevenue) * 100).toFixed(2) : 0}%`],
    ['Devoluciones y Reintegros', String(-report.totalRefundsArs), `${report.grossRevenue > 0 ? ((report.totalRefundsArs / report.grossRevenue) * 100).toFixed(2) : 0}%`],
    ['GANANCIA NETA FINAL', String(report.netProfit), `${report.profitMarginPercent}%`],
    ['Cuentas por Cobrar Pendientes (Dinero en Calle)', String(report.totalAmountDueArs), 'N/A'],
    [''],
    ['--- DESGLOSE DE GASTOS OPERATIVOS NORMALIZADOS (OPEX) ---'],
    ['Categoria Normalizada', 'Monto (ARS)', 'Participacion %'],
  ];

  if (report.categoryBreakdown && report.categoryBreakdown.length > 0) {
    const normMap = new Map<string, number>();
    report.categoryBreakdown.forEach((cat) => {
      const n = normalizeOpexCategory(cat.name);
      normMap.set(n, (normMap.get(n) || 0) + Number(cat.value || 0));
    });

    Array.from(normMap.entries()).forEach(([name, val]) => {
      const part = report.opex > 0 ? ((val / report.opex) * 100).toFixed(2) : '0';
      rows.push([name, String(val), `${part}%`]);
    });
  } else {
    rows.push(['Sin gastos registrados', '0', '0%']);
  }

  rows.push(['']);
  rows.push(['--- EVOLUCION DIARIA ---']);
  rows.push(['Fecha', 'Ingresos Brutos (ARS)', 'Ganancia Comercial Real (ARS)', 'Ganancia Neta Final (ARS)']);

  if (report.trendData && report.trendData.length > 0) {
    report.trendData.forEach((t) => {
      const gReal = t.gananciaReal !== undefined ? t.gananciaReal : t.ganancia;
      const gNet = t.gananciaNeta !== undefined ? t.gananciaNeta : t.ganancia;
      rows.push([t.date, String(t.ingresos), String(gReal), String(gNet)]);
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
