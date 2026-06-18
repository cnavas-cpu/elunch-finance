/**
 * Helpers de rango de fechas para Reportes P&L (Sprint 6).
 * Todas las funciones son puras — sin I/O ni efectos secundarios.
 * I/O en strings YYYY-MM-DD (o YYYY-MM para mensual, YYYY para año).
 * Usa date-fns v4 para manejo correcto de semanas ISO y edge-cases de calendario.
 */
import {
  parseISO,
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfYear,
  addDays,
  addWeeks,
  addMonths,
  isBefore,
  isAfter,
} from "date-fns";

// ── Tipos exportados ─────────────────────────────────────────

export type Granularidad = "diario" | "semanal" | "mensual" | "anio_corrido";

export interface RangoFecha {
  /** Fecha de inicio inclusive, en formato YYYY-MM-DD */
  desde: string;
  /** Fecha de fin inclusive, en formato YYYY-MM-DD */
  hasta: string;
}

// ── Helpers internos ─────────────────────────────────────────

const FMT_DIA = "yyyy-MM-dd";
const FMT_MES = "yyyy-MM";
const FMT_AÑO = "yyyy";

/** Semana ISO: empieza el lunes (weekStartsOn: 1) */
const SEMANA_OPTS = { weekStartsOn: 1 } as const;

// ── Rangos ───────────────────────────────────────────────────

/**
 * Rango completo del mes dado.
 * @param mes "YYYY-MM"
 */
export function rangoMensual(mes: string): RangoFecha {
  const d = parseISO(`${mes}-01`);
  return {
    desde: format(startOfMonth(d), FMT_DIA),
    hasta: format(endOfMonth(d), FMT_DIA),
  };
}

/**
 * Rango de un solo día.
 * @param fecha "YYYY-MM-DD"
 */
export function rangoDiario(fecha: string): RangoFecha {
  return { desde: fecha, hasta: fecha };
}

/**
 * Rango de la semana que contiene la fecha dada (lunes–domingo).
 * @param fecha "YYYY-MM-DD"
 */
export function rangoSemanal(fecha: string): RangoFecha {
  const d = parseISO(fecha);
  return {
    desde: format(startOfWeek(d, SEMANA_OPTS), FMT_DIA),
    hasta: format(endOfWeek(d, SEMANA_OPTS), FMT_DIA),
  };
}

/**
 * Rango desde el 1 de enero del año de la fecha hasta la fecha dada.
 * @param fecha "YYYY-MM-DD"
 */
export function rangoAnioCorrido(fecha: string): RangoFecha {
  const d = parseISO(fecha);
  return {
    desde: format(startOfYear(d), FMT_DIA),
    hasta: fecha,
  };
}

// ── Helpers para la serie del gráfico ────────────────────────

/**
 * Convierte una fecha a la clave de bucket según la granularidad.
 * Diario   → "YYYY-MM-DD"
 * Semanal  → "YYYY-MM-DD" del lunes de la semana
 * Mensual  → "YYYY-MM"
 * AñoCorrido → "YYYY"
 */
export function fechaABucket(fecha: string, g: Granularidad): string {
  const d = parseISO(fecha);
  switch (g) {
    case "diario":
      return format(d, FMT_DIA);
    case "semanal":
      return format(startOfWeek(d, SEMANA_OPTS), FMT_DIA);
    case "mensual":
      return format(d, FMT_MES);
    case "anio_corrido":
      return format(d, FMT_AÑO);
  }
}

/**
 * Genera la lista ordenada de buckets distintos que cubren el rango dado
 * con la granularidad indicada (útil para inicializar la serie del gráfico
 * con zeros aunque no haya transacciones ese día/semana/mes).
 */
export function bucketsDeSerie(rango: RangoFecha, g: Granularidad): string[] {
  const desde = parseISO(rango.desde);
  const hasta = parseISO(rango.hasta);

  if (g === "anio_corrido") {
    // Normalmente es un solo año, pero puede cruzar si el rango lo hace
    const años: string[] = [];
    let cur = parseISO(`${format(startOfYear(desde), FMT_AÑO)}-01-01`);
    while (!isAfter(cur, hasta)) {
      const key = format(cur, FMT_AÑO);
      if (!años.includes(key)) años.push(key);
      cur = addMonths(cur, 12);
    }
    return años;
  }

  if (g === "mensual") {
    const meses: string[] = [];
    let cur = startOfMonth(desde);
    while (!isAfter(cur, hasta)) {
      meses.push(format(cur, FMT_MES));
      cur = addMonths(cur, 1);
    }
    return meses;
  }

  if (g === "semanal") {
    const semanas: string[] = [];
    let cur = startOfWeek(desde, SEMANA_OPTS);
    while (!isAfter(cur, hasta)) {
      semanas.push(format(cur, FMT_DIA));
      cur = addWeeks(cur, 1);
    }
    return semanas;
  }

  // diario
  const dias: string[] = [];
  let cur = desde;
  while (!isAfter(cur, hasta)) {
    dias.push(format(cur, FMT_DIA));
    cur = addDays(cur, 1);
  }
  return dias;
}
