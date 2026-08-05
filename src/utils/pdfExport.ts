import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Sanitiza el documento clonado por html2canvas para remover o reemplazar
 * funciones de color CSS modernas como lab() u oklch() no soportadas por html2canvas.
 */
export function sanitizeClonedDocument(clonedDoc: Document, element: HTMLElement) {
  // 1. Reemplazar funciones lab() u oklch() en bloques <style>
  try {
    const styleElements = clonedDoc.querySelectorAll('style');
    styleElements.forEach((styleEl) => {
      if (styleEl.textContent && (styleEl.textContent.includes('lab(') || styleEl.textContent.includes('oklch('))) {
        styleEl.textContent = styleEl.textContent
          .replace(/oklch\([^)]+\)/gi, '#18181b')
          .replace(/lab\([^)]+\)/gi, '#18181b');
      }
    });
  } catch (e) {
    console.warn('Advertencia al sanitizar etiquetas <style>:', e);
  }

  // 2. Procesar hojas de estilo registradas
  try {
    Array.from(clonedDoc.styleSheets).forEach((sheet) => {
      try {
        const rules = Array.from(sheet.cssRules || []);
        rules.forEach((rule) => {
          if (rule.cssText && (rule.cssText.includes('lab(') || rule.cssText.includes('oklch('))) {
            // Se limpian referencias a lab/oklch directamente del cssText mediante override inline
          }
        });
      } catch (e) {
        // Ignorar hojas de estilo con restricciones CORS
      }
    });
  } catch (e) {
    console.warn('Advertencia al sanitizar cssRules:', e);
  }

  // 3. Inspeccionar y reemplazar estilos inline y computed problemáticos en el contenedor clonado
  const processElement = (el: HTMLElement) => {
    try {
      const styleAttr = el.getAttribute('style');
      if (styleAttr && (styleAttr.includes('lab(') || styleAttr.includes('oklch('))) {
        const cleanStyle = styleAttr
          .replace(/oklch\([^)]+\)/gi, '#10b981')
          .replace(/lab\([^)]+\)/gi, '#10b981');
        el.setAttribute('style', cleanStyle);
      }

      if (window.getComputedStyle) {
        const computed = window.getComputedStyle(el);
        const props = ['color', 'backgroundColor', 'borderColor', 'outlineColor', 'fill', 'stroke'];
        props.forEach((prop) => {
          const val = computed.getPropertyValue(prop);
          if (val && (val.includes('lab(') || val.includes('oklch('))) {
            const isBg = prop.includes('background');
            el.style.setProperty(prop, isBg ? '#08130E' : '#FFFFFF', 'important');
          }
        });
      }
    } catch (e) {
      // Ignorar errores individuales en nodos específicos
    }
  };

  processElement(element);
  const allChildren = element.querySelectorAll<HTMLElement>('*');
  allChildren.forEach(processElement);
}

/**
 * Función reutilizable para exportar cualquier contenedor HTML a PDF con resguardo de colores lab/oklch.
 */
export async function exportElementToPDF(
  elementId: string,
  fileName: string,
  title: string = 'Elohim Import ERP - Reporte Oficial',
  subtitle: string = ''
) {
  const input = document.getElementById(elementId);
  if (!input) {
    throw new Error(`No se encontró el elemento HTML con ID "${elementId}".`);
  }

  const canvas = await html2canvas(input, {
    scale: 2,
    backgroundColor: '#08130E',
    useCORS: true,
    logging: false,
    windowWidth: input.scrollWidth,
    windowHeight: input.scrollHeight,
    onclone: (clonedDoc, clonedElement) => {
      sanitizeClonedDocument(clonedDoc, clonedElement);
    },
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const imgWidth = 190;
  const pageHeight = 295;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 20;

  pdf.setFillColor(8, 19, 14);
  pdf.rect(0, 0, 210, 297, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(14);
  pdf.text(title, 10, 10);

  pdf.setFontSize(8);
  pdf.setTextColor(208, 169, 107);
  pdf.text(`Fecha: ${new Date().toLocaleDateString('es-AR')} ${subtitle ? `| ${subtitle}` : ''}`, 10, 15);

  pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
  heightLeft -= (pageHeight - 20);

  while (heightLeft >= 0) {
    position = heightLeft - imgHeight + 10;
    pdf.addPage();
    pdf.setFillColor(8, 19, 14);
    pdf.rect(0, 0, 210, 297, 'F');
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(fileName);
}
