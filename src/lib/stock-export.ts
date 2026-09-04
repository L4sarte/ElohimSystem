import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Product, UserRole } from '@/types';
import { SystemSettingsData, DEFAULT_SYSTEM_SETTINGS } from '@/lib/settings-validation';

export interface ExportStockParams {
  products: Product[];
  role?: UserRole;
  settings?: SystemSettingsData;
  exchangeRate?: number;
  filterLabel?: string;
}

const formatARS = (val: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val || 0);

const formatNumber = (val: number) =>
  new Intl.NumberFormat('es-AR').format(val || 0);

/**
 * Normaliza el tipo de producto para etiquetas legibles en español.
 */
function getProductTypeLabel(type: Product['type']): string {
  switch (type) {
    case 'bottle':
      return 'Perfume Sellado';
    case 'decant_liquid':
      return 'Decant a Granel';
    case 'supply':
      return 'Insumo Packaging';
    default:
      return 'Producto';
  }
}

/**
 * Determina el estado de inventario del producto según stock y alerta mínima.
 */
function getStockStatus(stock: number, minStock: number): { label: 'En Stock' | 'Stock Bajo' | 'Agotado'; code: 'ok' | 'low' | 'out' } {
  if (stock <= 0) {
    return { label: 'Agotado', code: 'out' };
  }
  if (stock <= minStock) {
    return { label: 'Stock Bajo', code: 'low' };
  }
  return { label: 'En Stock', code: 'ok' };
}

/**
 * Exportador de inventario a formato CSV compatible con Microsoft Excel y Google Sheets.
 * Incluye cabecera UTF-8 BOM (\uFEFF) para visualización íntegra de acentos y caracteres especiales.
 */
export function exportStockToCsv({
  products,
  role = 'admin',
  settings = DEFAULT_SYSTEM_SETTINGS,
  exchangeRate = 1200,
  filterLabel = 'Inventario Consolidado',
}: ExportStockParams): void {
  const isAdmin = role === 'admin';
  const companyName = settings.trade_name || settings.company_name || 'Elohim Import';
  const now = new Date();
  const dateStamp = now.toISOString().split('T')[0];
  const timeStamp = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  // Totales de control
  let totalCostValuation = 0;
  let totalSaleValuation = 0;
  let totalBottleUnits = 0;
  let totalLiquidMl = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  const rows: string[][] = [
    [`REPORTE OFICIAL DE STOCK E INVENTARIO - ${companyName.toUpperCase()}`],
    [`Fecha de Emision: ${dateStamp} ${timeStamp}`],
    [`Cotizacion USD Referencial: 1 USD = $${exchangeRate.toLocaleString('es-AR')} ARS`],
    [`Alcance / Filtro: ${filterLabel}`],
    [''],
    [
      'SKU / Codigo',
      'Producto / Fragancia',
      'Marca / Diseñador',
      'Tipo',
      'Familia Olfativa',
      'Stock Actual',
      'Unidad',
      'Stock Minimo Alerta',
      'Costo Unitario (ARS)',
      'Valuacion Total Costo (ARS)',
      'Precio Venta Unitario (ARS)',
      'Valuacion Total Venta (ARS)',
      'Precio Venta (USD)',
      'Estado Stock',
      'Conteo Fisico (Control Deposito)',
    ],
  ];

  products.forEach((p) => {
    const stock = Number(p.stock_quantity || 0);
    const minAlert = Number(p.min_stock_alert ?? 5);
    const costUnit = isAdmin ? Number(p.base_cost_ars || 0) : 0;
    const priceUnit = Number(p.base_price_ars || 0);
    const presentationMl = Number(p.volume_ml) || 5;
    const revenuePerMl = p.type === 'decant_liquid' ? (presentationMl > 0 ? priceUnit / presentationMl : priceUnit) : priceUnit;
    const valCost = stock * costUnit;
    const valSale = stock * revenuePerMl;
    const priceUsd = exchangeRate > 0 ? Number((priceUnit / exchangeRate).toFixed(2)) : 0;
    const status = getStockStatus(stock, minAlert);

    if (p.type === 'decant_liquid') {
      totalLiquidMl += stock;
    } else {
      totalBottleUnits += stock;
    }

    if (status.code === 'out') outOfStockCount++;
    if (status.code === 'low') lowStockCount++;

    if (isAdmin) {
      totalCostValuation += valCost;
    }
    totalSaleValuation += valSale;

    rows.push([
      `"${(p.sku || '').replace(/"/g, '""')}"`,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${(p.brand || '').replace(/"/g, '""')}"`,
      `"${getProductTypeLabel(p.type)}"`,
      `"${(p.olfactory_family || '-').replace(/"/g, '""')}"`,
      String(stock),
      p.type === 'decant_liquid' ? 'ml' : 'uds',
      String(minAlert),
      isAdmin ? (p.type === 'decant_liquid' ? `"${costUnit.toFixed(2)}/ml"` : costUnit.toFixed(2)) : '"[Confidencial]"',
      isAdmin ? valCost.toFixed(2) : '"[Confidencial]"',
      p.type === 'decant_liquid' ? `"${priceUnit.toFixed(2)} (${presentationMl}ml)"` : priceUnit.toFixed(2),
      valSale.toFixed(2),
      priceUsd.toFixed(2),
      `"${status.label}"`,
      '""', // Columna vacía para conteo físico en auditoría de depósito
    ]);
  });

  // Fila de resumen y totales
  rows.push(['']);
  rows.push([
    '"TOTALES CONSOLIDADOS"',
    `"Total SKUs: ${products.length}"`,
    '""',
    '""',
    '""',
    `"${totalBottleUnits} uds | ${totalLiquidMl} ml"`,
    '""',
    '""',
    '""',
    isAdmin ? totalCostValuation.toFixed(2) : '"[Confidencial]"',
    '""',
    totalSaleValuation.toFixed(2),
    '""',
    `"Agotados: ${outOfStockCount} | Bajos: ${lowStockCount}"`,
    '""',
  ]);

  const csvContent = '\uFEFF' + rows.map((r) => r.join(';')).join('\r\n');
  const cleanName = companyName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Inventario_${cleanName}_${dateStamp}.csv`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generador de Reporte Oficial de Stock e Inventario en PDF nativo vectorial (Apaisado A4).
 * Incluye KPIs ejecutivos, diseño corporativo oficial, desglose de existencias y paginación continua.
 */
export function exportStockToPdf({
  products,
  role = 'admin',
  settings = DEFAULT_SYSTEM_SETTINGS,
  exchangeRate = 1200,
  filterLabel = 'Inventario Consolidado',
}: ExportStockParams): jsPDF {
  const isAdmin = role === 'admin';
  const companyName = settings.trade_name || settings.company_name || 'Elohim Import';
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-AR');
  const timeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  // Formato Horizontal (Landscape) para permitir visualización clara de 10 columnas
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // ~841.89 pt
  const pageHeight = doc.internal.pageSize.getHeight(); // ~595.28 pt

  // Paleta de Colores Elohim Boutique
  const brandDark: [number, number, number] = [8, 19, 14];       // #08130E
  const brandGreen: [number, number, number] = [19, 38, 30];     // #13261E
  const brandGold: [number, number, number] = [208, 169, 107];   // #D0A96B
  const brandTextDark: [number, number, number] = [30, 41, 59];  // Slate 800
  const brandMuted: [number, number, number] = [100, 116, 139];  // Slate 500

  // 1. ENCABEZADO CORPORATIVO
  doc.setFillColor(...brandDark);
  doc.rect(0, 0, pageWidth, 64, 'F');

  // Línea dorada decorativa inferior
  doc.setFillColor(...brandGold);
  doc.rect(0, 62, pageWidth, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...brandGold);
  doc.text(companyName.toUpperCase(), 40, 28);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(220, 230, 225);
  doc.text(`CONTROL OFICIAL DE INVENTARIO, STOCK FÍSICO Y VALUACIÓN DE EXISTENCIAS`, 40, 44);

  doc.setFontSize(7.5);
  doc.setTextColor(180, 195, 190);
  doc.text(`Emisión: ${dateStr} ${timeStr} | T.C. Referencia: 1 USD = $${exchangeRate.toLocaleString('es-AR')} ARS`, pageWidth - 40, 28, { align: 'right' });
  doc.text(`Filtro Activo: ${filterLabel} | CUIT: ${settings.cuit_tax_id || '20-46591337-2'}`, pageWidth - 40, 44, { align: 'right' });

  // 2. CÁLCULO DE KPIS CONSOLIDADOS
  let totalCostValuation = 0;
  let totalSaleValuation = 0;
  let totalBottleUnits = 0;
  let totalLiquidMl = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  products.forEach((p) => {
    const stock = Number(p.stock_quantity || 0);
    const minAlert = Number(p.min_stock_alert ?? 5);
    const costUnit = isAdmin ? Number(p.base_cost_ars || 0) : 0;
    const priceUnit = Number(p.base_price_ars || 0);
    const presentationMl = Number(p.volume_ml) || 5;
    const revenuePerMl = p.type === 'decant_liquid' ? (presentationMl > 0 ? priceUnit / presentationMl : priceUnit) : priceUnit;
    const valCost = stock * costUnit;
    const valSale = stock * revenuePerMl;
    const status = getStockStatus(stock, minAlert);

    if (p.type === 'decant_liquid') {
      totalLiquidMl += stock;
    } else {
      totalBottleUnits += stock;
    }

    if (status.code === 'out') outOfStockCount++;
    if (status.code === 'low') lowStockCount++;

    if (isAdmin) {
      totalCostValuation += valCost;
    }
    totalSaleValuation += valSale;
  });

  // 3. TARJETAS DE KPIS SINTÉTICOS (HEADER CARDS)
  const kpiData = [
    [
      'Total SKUs Activos',
      `${products.length} productos`,
      'Existencias en Depósito',
      `${totalBottleUnits} uds (${totalLiquidMl} ml)`,
      'Valuación Total a Costo',
      isAdmin ? formatARS(totalCostValuation) : '[Confidencial]',
      'Valuación a Precio Venta',
      formatARS(totalSaleValuation),
    ],
  ];

  autoTable(doc, {
    theme: 'grid',
    startY: 76,
    margin: { left: 40, right: 40 },
    head: [
      [
        'Total SKUs',
        'Valor',
        'Existencias',
        'Detalle',
        'Valuación Costo',
        'Monto',
        'Valuación Venta',
        'Monto',
      ],
    ],
    body: [
      [
        'Total SKUs:',
        `${products.length} ítems`,
        'Stock Físico:',
        `${totalBottleUnits} uds / ${totalLiquidMl} ml`,
        'Total Costo (Reposición):',
        isAdmin ? formatARS(totalCostValuation) : '[Confidencial]',
        'Potencial Bruto Venta:',
        formatARS(totalSaleValuation),
      ],
      [
        'Agotados:',
        `${outOfStockCount} sin stock`,
        'Stock Bajo Alerta:',
        `${lowStockCount} ítems`,
        'Margen Potencial ($):',
        isAdmin ? formatARS(totalSaleValuation - totalCostValuation) : '[Confidencial]',
        'Margen Potencial (%):',
        isAdmin && totalSaleValuation > 0
          ? `${(((totalSaleValuation - totalCostValuation) / totalSaleValuation) * 100).toFixed(1)}%`
          : '[Confidencial]',
      ],
    ],
    headStyles: {
      fillColor: brandGreen,
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: brandTextDark,
      cellPadding: 4,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 70 },
      1: { halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42] },
      2: { fontStyle: 'bold', cellWidth: 80 },
      3: { halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42] },
      4: { fontStyle: 'bold', cellWidth: 100 },
      5: { halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105] },
      6: { fontStyle: 'bold', cellWidth: 95 },
      7: { halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] },
    },
    styles: {
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
    },
  });

  // 4. TABLA DETALLADA DE PRODUCTOS E INVENTARIO
  const tableRows = products.map((p, idx) => {
    const stock = Number(p.stock_quantity || 0);
    const minAlert = Number(p.min_stock_alert ?? 5);
    const costUnit = isAdmin ? Number(p.base_cost_ars || 0) : 0;
    const priceUnit = Number(p.base_price_ars || 0);
    const presentationMl = Number(p.volume_ml) || 5;
    const valCost = stock * costUnit;
    const status = getStockStatus(stock, minAlert);

    return [
      String(idx + 1),
      p.sku || '-',
      p.name || 'Sin nombre',
      p.brand || 'Elohim',
      getProductTypeLabel(p.type),
      `${stock} ${p.type === 'decant_liquid' ? 'ml' : 'ud'}`,
      isAdmin ? (p.type === 'decant_liquid' ? `${formatARS(costUnit)}/ml` : formatARS(costUnit)) : '-',
      isAdmin ? formatARS(valCost) : '-',
      p.type === 'decant_liquid' ? `${formatARS(priceUnit)} (${presentationMl}ml)` : formatARS(priceUnit),
      status.label,
    ];
  });

  const nextY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 14 : 140;

  autoTable(doc, {
    theme: 'grid',
    startY: nextY,
    margin: { left: 40, right: 40 },
    head: [
      [
        '#',
        'SKU',
        'Producto / Fragancia',
        'Marca',
        'Tipo',
        'Stock',
        'Costo Unit.',
        'Val. Costo',
        'Precio Venta',
        'Estado',
      ],
    ],
    body: tableRows,
    foot: [
      [
        '',
        '',
        `TOTALES (${products.length} SKUs)`,
        '',
        '',
        `${totalBottleUnits} uds / ${totalLiquidMl} ml`,
        '',
        isAdmin ? formatARS(totalCostValuation) : '-',
        formatARS(totalSaleValuation),
        `${outOfStockCount} Agotados`,
      ],
    ],
    headStyles: {
      fillColor: brandGreen,
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'left',
    },
    footStyles: {
      fillColor: brandGreen,
      textColor: brandGold,
      fontSize: 7.5,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7,
      textColor: brandTextDark,
      cellPadding: 3.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 20 },
      1: { fontStyle: 'bold', cellWidth: 70 },
      2: { cellWidth: 170 },
      3: { cellWidth: 90 },
      4: { cellWidth: 80 },
      5: { halign: 'right', fontStyle: 'bold', cellWidth: 60 },
      6: { halign: 'right', cellWidth: 65 },
      7: { halign: 'right', fontStyle: 'bold', cellWidth: 75 },
      8: { halign: 'right', fontStyle: 'bold', cellWidth: 70 },
      9: { halign: 'center', fontStyle: 'bold', cellWidth: 62 },
    },
    styles: {
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const rawRow = Array.isArray(data.row.raw) ? data.row.raw : Object.values(data.row.raw || {});
        const statusText = String(rawRow[9] || '');

        if (statusText === 'Agotado') {
          data.cell.styles.fillColor = [255, 241, 242]; // Rose-50
          data.cell.styles.textColor = [190, 18, 60];   // Rose-700
          data.cell.styles.fontStyle = 'bold';
        } else if (statusText === 'Stock Bajo') {
          data.cell.styles.fillColor = [254, 243, 199]; // Amber-100
          data.cell.styles.textColor = [180, 83, 9];    // Amber-700
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // 5. PIE DE PÁGINA CORPORATIVO EN TODAS LAS HOJAS
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...brandMuted);
    doc.text(
      `${companyName} ERP • Sistema de Gestión Comercial y Control de Stock — Página ${i} de ${totalPages}`,
      40,
      pageHeight - 18
    );
    doc.text(`Documento Oficial de Auditoría Interna • Confidencial`, pageWidth - 40, pageHeight - 18, { align: 'right' });
  }

  // Guardar archivo directamente en el navegador
  const cleanName = companyName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Inventario_${cleanName}_${now.toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);

  return doc;
}
