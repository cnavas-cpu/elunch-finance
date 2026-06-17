// lib/finance/cxc.ts — Lógica pura de Cuentas por Cobrar (Sprint 5)
// Funciones sin I/O: máquina de estados, saldo, aging y resumen.
// Módulo independiente de cxp.ts (mismo patrón, dominios separados).

// ── Tipos ─────────────────────────────────────────────────────────

export type EstadoCxc =
  | "Generada"
  | "OC Recibida"
  | "Facturada"
  | "Programada Pago"
  | "Pagada"
  | "En Recuperacion"   // valor EXACTO de la BD (sin tilde); la tilde es solo visual
  | "Incobrable";

export type EstadoAging = "al_dia" | "por_vencer" | "vencida";
export type PagoSimple   = { monto_centavos: number };

export interface CxcParaResumen {
  monto_centavos: number;
  fecha_esperada: string | null;
  estado:         EstadoCxc;
  pagos:          PagoSimple[];
}

export interface ResumenCxc {
  totalPorCobrar:  number;
  totalVencido:    number;
  totalPorVencer:  number;
  countPorEstado:  Record<EstadoCxc, number>;
  countVencidas:   number;
  countPorVencer:  number;
}

// ── Máquina de estados ────────────────────────────────────────────
// Valores EXACTOS de la BD ('En Recuperacion' sin tilde, igual que el CHECK de la tabla).
// 'Pagada' solo se alcanza a través de registrar_pago_cxc (cobro completo).

const TRANSICIONES: Record<EstadoCxc, EstadoCxc[]> = {
  "Generada":        ["OC Recibida"],
  "OC Recibida":     ["Facturada"],
  "Facturada":       ["Programada Pago", "En Recuperacion", "Incobrable"],
  "Programada Pago": ["En Recuperacion", "Incobrable"],
  "En Recuperacion": ["Programada Pago", "Incobrable"],
  "Pagada":          [],   // terminal — solo vía cobro
  "Incobrable":      [],   // terminal
};

/** Destinos que el usuario puede fijar a mano. Excluye 'Pagada' y 'Generada'. */
export const ESTADOS_MANUALES: EstadoCxc[] = [
  "OC Recibida",
  "Facturada",
  "Programada Pago",
  "En Recuperacion",
  "Incobrable",
];

export function puedeTransicionar(actual: EstadoCxc, nuevo: EstadoCxc): boolean {
  return (TRANSICIONES[actual] ?? []).includes(nuevo);
}

export function transicionesDisponibles(actual: EstadoCxc): EstadoCxc[] {
  return TRANSICIONES[actual] ?? [];
}

// ── Etiqueta visual ───────────────────────────────────────────────
// La BD guarda 'En Recuperacion' sin tilde; en UI se muestra con tilde.

export function etiquetaEstado(e: EstadoCxc): string {
  return e === "En Recuperacion" ? "En Recuperación" : e;
}

// ── Cálculos de saldo ─────────────────────────────────────────────

export function totalAbonado(pagos: PagoSimple[]): number {
  return pagos.reduce((s, p) => s + p.monto_centavos, 0);
}

export function calcularSaldo(montoCentavos: number, pagos: PagoSimple[]): number {
  return Math.max(0, montoCentavos - totalAbonado(pagos));
}

// ── Aging ─────────────────────────────────────────────────────────

/** Días hasta (o desde) la fecha esperada. Positivo = días restantes, negativo = días vencida. */
export function diasParaVencer(fechaEsperada: string | null, hoy: string): number {
  if (!fechaEsperada) return Infinity;
  const ms =
    new Date(fechaEsperada + "T00:00:00").getTime() -
    new Date(hoy         + "T00:00:00").getTime();
  return Math.ceil(ms / 86_400_000);
}

/**
 * Semáforo de aging derivado en pantalla.
 * Pagada e Incobrable siempre devuelven 'al_dia' (aging no aplica).
 * Sin fecha esperada → 'al_dia' (no hay vencimiento configurado).
 */
export function estadoAging(
  fechaEsperada: string | null,
  estado:        EstadoCxc,
  hoy:           string
): EstadoAging {
  if (estado === "Pagada" || estado === "Incobrable") return "al_dia";
  if (!fechaEsperada) return "al_dia";
  const d = diasParaVencer(fechaEsperada, hoy);
  if (d < 0)  return "vencida";
  if (d <= 3) return "por_vencer";
  return "al_dia";
}

// ── Resumen para tarjetas ─────────────────────────────────────────

export function resumenCxc(cxcs: CxcParaResumen[], hoy: string): ResumenCxc {
  const countPorEstado: Record<EstadoCxc, number> = {
    "Generada":        0,
    "OC Recibida":     0,
    "Facturada":       0,
    "Programada Pago": 0,
    "Pagada":          0,
    "En Recuperacion": 0,
    "Incobrable":      0,
  };
  let totalPorCobrar = 0;
  let totalVencido   = 0;
  let totalPorVencer = 0;
  let countVencidas  = 0;
  let countPorVencer = 0;

  for (const c of cxcs) {
    countPorEstado[c.estado] = (countPorEstado[c.estado] ?? 0) + 1;

    // Pagada e Incobrable no contribuyen al saldo pendiente
    if (c.estado === "Pagada" || c.estado === "Incobrable") continue;

    const saldo = calcularSaldo(c.monto_centavos, c.pagos);
    totalPorCobrar += saldo;

    const aging = estadoAging(c.fecha_esperada, c.estado, hoy);
    if (aging === "vencida") {
      totalVencido += saldo;
      countVencidas++;
    } else if (aging === "por_vencer") {
      totalPorVencer += saldo;
      countPorVencer++;
    }
  }

  return {
    totalPorCobrar,
    totalVencido,
    totalPorVencer,
    countPorEstado,
    countVencidas,
    countPorVencer,
  };
}
