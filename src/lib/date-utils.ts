/**
 * Utilidades de fecha de la ZONA HORARIA COMERCIAL de negocio:
 * Argentina (America/Argentina/Cordoba, UTC-3 FIJO — sin DST desde 2009).
 *
 * Toda venta se registra con created_at TIMESTAMPTZ (UTC). Los rangos de
 * métricas deben representar días/meses CIVILES de ART convertidos a UTC:
 * la medianoche ART de un día = ese día 03:00 UTC. Así, una venta de las
 * 22:00 ART del último día del mes (01:00 UTC del mes siguiente) se asigna
 * al mes correcto y no al siguiente.
 *
 * Al ser Argentina un offset fijo sin DST, el desplazamiento +3h es exacto
 * y determinista todo el año (sin depender de la base ICU del runtime).
 */

/** Offset fijo de la zona horaria comercial (ART = UTC-3) en milisegundos. */
export const ART_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Identificador IANA de la zona horaria comercial. */
export const BUSINESS_TZ = 'America/Argentina/Cordoba';

/** Instante UTC correspondiente a la medianoche ART de un día civil dado. */
export function artMidnightUtc(year: number, month0: number, day: number): Date {
  return new Date(Date.UTC(year, month0, day, 0, 0, 0, 0) + ART_OFFSET_MS);
}

/** Instante UTC correspondiente al fin del día ART (23:59:59.999). */
export function artDayEndUtc(year: number, month0: number, day: number): Date {
  return new Date(Date.UTC(year, month0, day, 23, 59, 59, 999) + ART_OFFSET_MS);
}

/** "Ahora" trasladado al marco de negocio (leer año/mes/día ART con getUTC*). */
export function businessNow(reference: Date = new Date()): Date {
  return new Date(reference.getTime() + ART_OFFSET_MS);
}

/** Convierte un instante UTC al marco de negocio (getUTC* lee día/mes ART). */
export function toBusinessInstant(instant: Date | string | null | undefined): Date | null {
  if (!instant) return null;
  const d = typeof instant === 'string' ? new Date(instant) : instant;
  if (isNaN(d.getTime())) return null;
  return new Date(d.getTime() + ART_OFFSET_MS);
}

/**
 * Clave de día de negocio 'dd/MM' (misma presentación que la existente,
 * corregida a ART): una venta nocturna del día D ya no cae al día D+1.
 * Valores nulos o inválidos retornan 'Hoy' (contrato previo).
 */
export function businessDayKey(instant: Date | string | null | undefined): string {
  const b = toBusinessInstant(instant);
  if (!b) return 'Hoy';
  const day = String(b.getUTCDate()).padStart(2, '0');
  const month = String(b.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

export interface BusinessDateRange {
  /** Instante UTC de inicio (medianoche ART del primer día). */
  start: Date;
  /** Instante UTC de fin (23:59:59.999 ART del último día). */
  end: Date;
  /** Día civil ART de inicio en 'YYYY-MM-DD' (para columnas DATE sin hora). */
  startDay: string;
  /** Día civil ART de fin en 'YYYY-MM-DD'. */
  endDay: string;
}

/** Último día civil del mes (1-31). */
function lastDayOfMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/** Rango de mes civil ART completo. */
export function businessMonthRange(year: number, month0: number): BusinessDateRange {
  const lastDay = lastDayOfMonth(year, month0);
  const monthNum = String(month0 + 1).padStart(2, '0');
  return {
    start: artMidnightUtc(year, month0, 1),
    end: artDayEndUtc(year, month0, lastDay),
    startDay: `${year}-${monthNum}-01`,
    endDay: `${year}-${monthNum}-${String(lastDay).padStart(2, '0')}`,
  };
}

/** Parsea 'YYYY-MM-DD' a [year, month, day] numéricos validados; [0,0,0] si es inválido. */
function parseDayString(value: string): [number, number, number] {
  const parts = value.split('-').map(Number);
  const [y, m, d] = parts;
  if (
    parts.length === 3 &&
    Number.isInteger(y) && Number.isInteger(m) && Number.isInteger(d) &&
    m >= 1 && m <= 12 && d >= 1 && d <= 31
  ) {
    return [y, m, d];
  }
  return [0, 0, 0];
}

/** Normaliza 'YYYY-MM-DD' (padea día/mes) para comparaciones con columnas DATE. */
function normalizeDayString(value: string): string {
  const [y, m, d] = parseDayString(value);
  if (y && m && d) return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return value;
}

/**
 * Resuelve el rango de negocio (ART) para los rangos estándar del ERP.
 * Convierte TODO a instantes UTC correctos para filtrar created_at TIMESTAMPTZ.
 * Rangos custom con formato inválido caen al mes en curso con warning
 * (antes generaban Date inválido y una excepción genérica).
 */
export function resolveBusinessRange(
  range: 'current_month' | 'previous_month' | 'last_30_days' | 'current_year' | 'custom',
  customStartDate?: string,
  customEndDate?: string
): BusinessDateRange {
  const nowB = businessNow();
  const year = nowB.getUTCFullYear();
  const month0 = nowB.getUTCMonth();

  if (customStartDate && customEndDate) {
    const [sY, sM, sD] = parseDayString(customStartDate);
    const [eY, eM, eD] = parseDayString(customEndDate);
    if (sY && sM && sD && eY && eM && eD) {
      return {
        start: artMidnightUtc(sY, sM - 1, sD),
        end: artDayEndUtc(eY, eM - 1, eD),
        startDay: normalizeDayString(customStartDate),
        endDay: normalizeDayString(customEndDate),
      };
    }
    console.warn('[DATE_UTILS_WARN] Formato de rango custom inválido, usando el mes en curso:', customStartDate, customEndDate);
  }

  if (range === 'previous_month') {
    return month0 === 0 ? businessMonthRange(year - 1, 11) : businessMonthRange(year, month0 - 1);
  }

  if (range === 'last_30_days') {
    // Ventana rodante de 30 días (offset puro, sin desfase de zona horaria)
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startB = toBusinessInstant(start)!;
    const endB = toBusinessInstant(end)!;
    return {
      start,
      end,
      startDay: `${startB.getUTCFullYear()}-${String(startB.getUTCMonth() + 1).padStart(2, '0')}-${String(startB.getUTCDate()).padStart(2, '0')}`,
      endDay: `${endB.getUTCFullYear()}-${String(endB.getUTCMonth() + 1).padStart(2, '0')}-${String(endB.getUTCDate()).padStart(2, '0')}`,
    };
  }

  if (range === 'current_year') {
    return {
      start: artMidnightUtc(year, 0, 1),
      end: artDayEndUtc(year, 11, 31),
      startDay: `${year}-01-01`,
      endDay: `${year}-12-31`,
    };
  }

  // current_month y fallback por defecto
  return businessMonthRange(year, month0);
}
