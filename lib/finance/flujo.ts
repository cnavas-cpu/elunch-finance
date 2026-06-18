/**
 * Lógica pura del Flujo de Caja (Sprint 7).
 * Funciones sin I/O: flujo real, flujo devengado, serie temporal y proyección de liquidez.
 * Dinero siempre en centavos (integer) — NUNCA float.
 *
 * Definiciones (CLAUDE.md §6.2):
 *   Flujo REAL      = solo lo efectivamente movido en cash/banco
 *                     (ventas afecta_cash=true + cobros de CXC − salidas afecta_cash=true − pagos de CXP)
 *   Flujo DEVENGADO = todas las transacciones por fecha, sin importar forma de pago
 *                     (los pagos/cobros de CXC/CXP NO se suman: son liquidaciones de lo ya devengado)
 *   Diferencia      = devengado.neto − real.neto (el "papel" pendiente de convertirse en cash)
 */
import { parseISO, addDays, format } from "date-fns";
import {
  fechaABucket,
  bucketsDeSerie,
  type Granularidad,
  type RangoFecha,
} from "./periodo";

// ── Tipos de entrada ─────────────────────────────────────────────────

export interface MovimientoFlujo {
  fecha: string;                // YYYY-MM-DD
  tipo: "venta" | "salida";
  monto_centavos: number;
  afecta_cash: boolean | null;  // de forma_pago; null = sin clasificar (no cuenta como cash)
}

export interface PagoFlujo {
  fecha: string;
  monto_centavos: number;
  es_cobro: boolean;            // true = pago sobre CXC (entrada); false = sobre CXP (salida)
}

/**
 * Item de CXC o CXP pendiente para la proyección.
 * Para CXC: fecha = fecha_esperada, confirmado = estado==='Programada Pago'.
 * Para CXP: fecha = fecha_vencimiento, confirmado = estado∈{'Programada','Vencida'}.
 */
export interface CxItem {
  saldo_centavos: number;       // monto − Σ pagos (> 0 = pendiente)
  fecha: string | null;         // fecha esperada/vencimiento; null = sin fecha
  confirmado: boolean;          // certeza alta (estado confirmado)
}

// ── Tipos de salida ──────────────────────────────────────────────────

export interface FlujoNeto {
  entradas_centavos: number;
  salidas_centavos: number;
  neto_centavos: number;        // entradas − salidas
}

export interface FlujoPeriodo {
  real: FlujoNeto;
  devengado: FlujoNeto;
  diferencia_centavos: number;  // devengado.neto − real.neto
}

export interface PuntoFlujo {
  bucket: string;
  realNeto: number;             // neto cash real del bucket
  devengadoNeto: number;        // neto devengado del bucket
}

export type NivelLiquidez = "verde" | "ambar" | "rojo";

export interface TramoProyeccion {
  horizonte: 30 | 60 | 90;
  entradasConfirmadas_centavos: number;
  entradasEstimadas_centavos: number;
  salidasConfirmadas_centavos: number;
  salidasEstimadas_centavos: number;
  /** (entradasConf − salidasConf) hasta el horizonte — escenario conservador */
  acumuladoConfirmado_centavos: number;
  /** ((conf+est) entradas − (conf+est) salidas) hasta el horizonte */
  acumuladoTotal_centavos: number;
  semaforo: NivelLiquidez;
}

export interface ProyeccionLiquidez {
  tramos: TramoProyeccion[];    // [30, 60, 90] acumulativos
  cxcSinFecha_centavos: number;
  cxpSinFecha_centavos: number;
}

// ── Flujo REAL ───────────────────────────────────────────────────────

/**
 * Calcula el flujo de caja REAL del periodo.
 * Entradas = ventas cash + cobros de CXC.
 * Salidas  = salidas cash + pagos de CXP.
 * Las ventas/salidas a crédito (afecta_cash=false) NO se cuentan aquí.
 */
export function calcularFlujoReal(movs: MovimientoFlujo[], pagos: PagoFlujo[]): FlujoNeto {
  let entradas = 0;
  let salidas  = 0;

  for (const m of movs) {
    if (m.afecta_cash !== true) continue; // null y false excluidos
    if (m.tipo === "venta") {
      entradas += m.monto_centavos;
    } else {
      salidas += m.monto_centavos;
    }
  }

  for (const p of pagos) {
    if (p.es_cobro) {
      entradas += p.monto_centavos; // cobro de CXC = entrada de cash
    } else {
      salidas += p.monto_centavos;  // pago de CXP = salida de cash
    }
  }

  return { entradas_centavos: entradas, salidas_centavos: salidas, neto_centavos: entradas - salidas };
}

// ── Flujo DEVENGADO ──────────────────────────────────────────────────

/**
 * Calcula el flujo DEVENGADO del periodo.
 * Suma TODAS las ventas como entradas y TODAS las salidas como salidas,
 * sin importar la forma de pago. Los pagos (PagoFlujo) no se incluyen
 * — son liquidaciones de operaciones ya devengadas.
 */
export function calcularFlujoDevengado(movs: MovimientoFlujo[]): FlujoNeto {
  let entradas = 0;
  let salidas  = 0;

  for (const m of movs) {
    if (m.tipo === "venta") {
      entradas += m.monto_centavos;
    } else {
      salidas += m.monto_centavos;
    }
  }

  return { entradas_centavos: entradas, salidas_centavos: salidas, neto_centavos: entradas - salidas };
}

// ── Flujo del Periodo (real + devengado) ─────────────────────────────

/** Combina flujo real y devengado; `diferencia = devengado.neto − real.neto`. */
export function calcularFlujoPeriodo(movs: MovimientoFlujo[], pagos: PagoFlujo[]): FlujoPeriodo {
  const real      = calcularFlujoReal(movs, pagos);
  const devengado = calcularFlujoDevengado(movs);
  return { real, devengado, diferencia_centavos: devengado.neto_centavos - real.neto_centavos };
}

// ── Serie temporal ───────────────────────────────────────────────────

/**
 * Genera la serie temporal del flujo por bucket (diario/semanal/mensual/año-corrido).
 * Inicializa TODOS los buckets del rango en 0 (igual que serieDePnl en pnl.ts).
 * realNeto     = neto cash del bucket (movs afecta_cash + pagos).
 * devengadoNeto = neto devengado del bucket (todos los movs).
 */
export function serieFlujo(
  movs: MovimientoFlujo[],
  pagos: PagoFlujo[],
  rango: RangoFecha,
  g: Granularidad
): PuntoFlujo[] {
  const buckets = bucketsDeSerie(rango, g);
  const realMap:      Map<string, number> = new Map(buckets.map(b => [b, 0]));
  const devengadoMap: Map<string, number> = new Map(buckets.map(b => [b, 0]));

  for (const m of movs) {
    const bucket = fechaABucket(m.fecha, g);
    const signo  = m.tipo === "venta" ? 1 : -1;

    // Devengado: todos los movimientos
    devengadoMap.set(bucket, (devengadoMap.get(bucket) ?? 0) + signo * m.monto_centavos);

    // Real: solo los que afectan cash
    if (m.afecta_cash === true) {
      realMap.set(bucket, (realMap.get(bucket) ?? 0) + signo * m.monto_centavos);
    }
  }

  // Pagos: solo afectan el real
  for (const p of pagos) {
    const bucket = fechaABucket(p.fecha, g);
    const signo  = p.es_cobro ? 1 : -1;
    realMap.set(bucket, (realMap.get(bucket) ?? 0) + signo * p.monto_centavos);
  }

  return buckets.map(b => ({
    bucket: b,
    realNeto:      realMap.get(b)      ?? 0,
    devengadoNeto: devengadoMap.get(b) ?? 0,
  }));
}

// ── Semáforo ─────────────────────────────────────────────────────────

/**
 * Evalúa el nivel de liquidez sobre el saldo proyectado acumulado.
 * Rojo  = saldo < 0 (flujo negativo).
 * Ámbar = saldo >= 0 pero < colchón mínimo.
 * Verde = saldo >= colchón.
 * Con colchón = 0: 0 → verde (0 >= 0).
 */
export function evaluarSemaforo(
  saldoProyectado_centavos: number,
  colchon_centavos: number
): NivelLiquidez {
  if (saldoProyectado_centavos < 0)                return "rojo";
  if (saldoProyectado_centavos < colchon_centavos) return "ambar";
  return "verde";
}

// ── Proyección de liquidez ───────────────────────────────────────────

/**
 * Proyecta la liquidez en horizontes de 30, 60 y 90 días desde `hoy`.
 *
 * Cada tramo es ACUMULATIVO (items con fecha <= hoy+h):
 *   - Los ítems vencidos (fecha < hoy) caen en los tres tramos.
 *   - Los ítems a 20 días caen en los tres tramos.
 *   - Los ítems a 45 días caen en 60 y 90, pero no en 30.
 *   - Los ítems a 80 días solo caen en 90.
 *   - Los ítems sin fecha (null) van a cxcSinFecha/cxpSinFecha y NO a ningún tramo.
 *
 * `confirmado=true` → entra a entradasConfirmadas / salidasConfirmadas.
 * `confirmado=false` → entra a entradasEstimadas / salidasEstimadas.
 *
 * acumuladoConfirmado = (entradasConf − salidasConf)
 * acumuladoTotal      = (entradasConf + entradasEst) − (salidasConf + salidasEst)
 */
export function proyeccionLiquidez(
  cxc: CxItem[],
  cxp: CxItem[],
  hoy: string,
  colchon_centavos: number
): ProyeccionLiquidez {
  const HORIZONTES = [30, 60, 90] as const;

  // Pre-calcular fecha límite por horizonte
  const limites: Record<30 | 60 | 90, string> = {
    30: format(addDays(parseISO(hoy), 30), "yyyy-MM-dd"),
    60: format(addDays(parseISO(hoy), 60), "yyyy-MM-dd"),
    90: format(addDays(parseISO(hoy), 90), "yyyy-MM-dd"),
  };

  // Acumuladores por tramo
  const acc = {
    30: { entConf: 0, entEst: 0, salConf: 0, salEst: 0 },
    60: { entConf: 0, entEst: 0, salConf: 0, salEst: 0 },
    90: { entConf: 0, entEst: 0, salConf: 0, salEst: 0 },
  };

  let cxcSinFecha = 0;
  let cxpSinFecha = 0;

  // CXC → entradas proyectadas
  for (const c of cxc) {
    if (c.fecha === null) {
      cxcSinFecha += c.saldo_centavos;
      continue;
    }
    for (const h of HORIZONTES) {
      if (c.fecha <= limites[h]) {
        if (c.confirmado) {
          acc[h].entConf += c.saldo_centavos;
        } else {
          acc[h].entEst += c.saldo_centavos;
        }
      }
    }
  }

  // CXP → salidas proyectadas
  for (const c of cxp) {
    if (c.fecha === null) {
      cxpSinFecha += c.saldo_centavos;
      continue;
    }
    for (const h of HORIZONTES) {
      if (c.fecha <= limites[h]) {
        if (c.confirmado) {
          acc[h].salConf += c.saldo_centavos;
        } else {
          acc[h].salEst += c.saldo_centavos;
        }
      }
    }
  }

  const tramos: TramoProyeccion[] = HORIZONTES.map(h => {
    const { entConf, entEst, salConf, salEst } = acc[h];
    const acumuladoConfirmado = entConf - salConf;
    const acumuladoTotal      = (entConf + entEst) - (salConf + salEst);
    return {
      horizonte: h,
      entradasConfirmadas_centavos: entConf,
      entradasEstimadas_centavos:   entEst,
      salidasConfirmadas_centavos:  salConf,
      salidasEstimadas_centavos:    salEst,
      acumuladoConfirmado_centavos: acumuladoConfirmado,
      acumuladoTotal_centavos:      acumuladoTotal,
      semaforo: evaluarSemaforo(acumuladoTotal, colchon_centavos),
    };
  });

  return {
    tramos,
    cxcSinFecha_centavos: cxcSinFecha,
    cxpSinFecha_centavos: cxpSinFecha,
  };
}
