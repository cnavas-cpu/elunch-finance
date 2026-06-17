// ── Tipos ────────────────────────────────────────────────────

export type EstadoCxp =
  | "Pendiente"
  | "Programada"
  | "Pagada"
  | "Vencida"
  | "En disputa";

export type PagoSimple = { monto_centavos: number };

export interface CxpParaResumen {
  monto_centavos:    number;
  fecha_vencimiento: string | null;
  estado:            EstadoCxp;
  pagos:             PagoSimple[];
}

// ── Máquina de estados ───────────────────────────────────────
// 'Pagada' llega SOLO vía registrar_pago_cxp (no manual).
// 'Vencida' es un estado derivado calculado en pantalla;
//  se puede leer desde la DB si el cron ya lo persistió.

const TRANSICIONES: Record<EstadoCxp, EstadoCxp[]> = {
  Pendiente:    ["Programada", "En disputa"],
  Programada:   ["Pendiente",  "En disputa"],
  Vencida:      ["Pendiente",  "En disputa"],
  "En disputa": ["Pendiente",  "Programada"],
  Pagada:       [],
};

/** Estados que el usuario puede elegir manualmente (excluye Pagada y Vencida). */
export const ESTADOS_MANUALES: EstadoCxp[] = ["Pendiente", "Programada", "En disputa"];

/** Devuelve true si la transición actual→nuevo es permitida por la máquina de estados. */
export function puedeTransicionar(actual: EstadoCxp, nuevo: EstadoCxp): boolean {
  return TRANSICIONES[actual]?.includes(nuevo) ?? false;
}

/** Lista de estados a los que se puede transitar desde el estado actual. */
export function transicionesDisponibles(actual: EstadoCxp): EstadoCxp[] {
  return TRANSICIONES[actual] ?? [];
}

// ── Saldo y abonos ────────────────────────────────────────────

/** Saldo pendiente = monto total − suma de abonos. Nunca negativo. */
export function calcularSaldo(
  montoCentavos: number,
  pagos: PagoSimple[]
): number {
  const abonado = pagos.reduce((s, p) => s + p.monto_centavos, 0);
  return Math.max(0, montoCentavos - abonado);
}

/** Suma total de abonos registrados. */
export function totalAbonado(pagos: PagoSimple[]): number {
  return pagos.reduce((s, p) => s + p.monto_centavos, 0);
}

// ── Aging / semáforo de vencimiento ──────────────────────────

export type EstadoAging = "al_dia" | "por_vencer" | "vencida";

/**
 * Días que faltan para el vencimiento (negativo = ya venció).
 * Devuelve Infinity si no hay fecha de vencimiento.
 */
export function diasParaVencer(
  fechaVenc: string | null,
  hoy: string
): number {
  if (!fechaVenc) return Infinity;
  const diff =
    new Date(fechaVenc).getTime() - new Date(hoy).getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Semáforo de aging basado en la fecha de vencimiento y el estado.
 * - "vencida": fecha ya pasó y la CXP no está Pagada.
 * - "por_vencer": vence en ≤ 3 días (incluido hoy).
 * - "al_dia": pagada, sin fecha, o vence en más de 3 días.
 */
export function estadoAging(
  fechaVenc: string | null,
  estadoCxp: EstadoCxp,
  hoy: string
): EstadoAging {
  if (estadoCxp === "Pagada") return "al_dia";
  if (!fechaVenc) return "al_dia";
  const dias = diasParaVencer(fechaVenc, hoy);
  if (dias < 0) return "vencida";
  if (dias <= 3) return "por_vencer";
  return "al_dia";
}

// ── Resumen para tarjetas ─────────────────────────────────────

export interface ResumenCxp {
  totalPorPagar:  number; // saldo vivo de todas las no-Pagadas
  totalVencido:   number; // saldo de las vencidas
  totalPorVencer: number; // saldo de las que vencen en ≤ 3 días
  countPorEstado: Record<EstadoCxp, number>;
  countVencidas:  number;
  countPorVencer: number;
}

export function resumenCxp(cxps: CxpParaResumen[], hoy: string): ResumenCxp {
  const countPorEstado: Record<EstadoCxp, number> = {
    Pendiente: 0, Programada: 0, Pagada: 0, Vencida: 0, "En disputa": 0,
  };
  let totalPorPagar  = 0;
  let totalVencido   = 0;
  let totalPorVencer = 0;
  let countVencidas  = 0;
  let countPorVencer = 0;

  for (const cxp of cxps) {
    countPorEstado[cxp.estado] = (countPorEstado[cxp.estado] ?? 0) + 1;

    if (cxp.estado === "Pagada") continue;

    const saldo = calcularSaldo(cxp.monto_centavos, cxp.pagos);
    const aging = estadoAging(cxp.fecha_vencimiento, cxp.estado, hoy);

    totalPorPagar += saldo;

    if (aging === "vencida") {
      totalVencido += saldo;
      countVencidas += 1;
    } else if (aging === "por_vencer") {
      totalPorVencer += saldo;
      countPorVencer += 1;
    }
  }

  return {
    totalPorPagar,
    totalVencido,
    totalPorVencer,
    countPorEstado,
    countVencidas,
    countPorVencer,
  };
}
