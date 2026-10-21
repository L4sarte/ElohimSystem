/**
 * Formateadores de moneda y número pre-instanciados como singletons O(1).
 * Evitan la sobrecarga de instanciar repetidamente Intl.NumberFormat
 * durante el scroll, filtrado y renderizado masivo en el POS.
 */

const arsIntegerFormatter = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 0,
});

const arsDecimalFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatArs(amount: number): string {
  if (!Number.isFinite(amount)) return '$0';
  return `$${arsIntegerFormatter.format(Math.round(amount))}`;
}

export function formatArsDec(amount: number): string {
  if (!Number.isFinite(amount)) return '$0,00 ARS';
  return `$${arsDecimalFormatter.format(amount)} ARS`;
}

export function formatUsd(amount: number): string {
  if (!Number.isFinite(amount)) return 'u$s 0.00';
  return `u$s ${amount.toFixed(2)}`;
}
