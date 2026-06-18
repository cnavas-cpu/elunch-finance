/**
 * Lógica pura del Estado de Resultados (P&L) y Margen de Contribución.
 * Implementa el modelo CLAUDE.md §6.3 — cascada SIN prorrateo de costos pool.
 *
 * Cascada:
 *   Por cada unidad: Ingresos − COGS directos = Margen de Contribución
 *   Σ Márgenes = Aporte total al pool
 *   (−) Costos comunes pool
 *   (−) Gastos operativos (gasto_operativo)
 *   (−) Gastos no operativos (no_operativo)
 *   = Utilidad Neta Real
 *
 * REGLA CRÍTICA: los costos pool NUNCA se prorratean a las unidades.
 * Todas las funciones son puras (sin I/O). Dinero siempre en centavos enteros.
 */
import { fechaABucket, bucketsDeSerie } from "./periodo";
import type { RangoFecha, Granularidad } from "./periodo";

// ── Tipos exportados ─────────────────────────────────────────

export type Naturaleza =
  | "Operativo"
  | "Fijo"
  | "Variable"
  | "Otros"
  | "Financiero"
  | "Activo"
  | "Costo Directo Unidad";

export type PnlBucket = "gasto_operativo" | "no_operativo";

/**
 * Mapa naturaleza → bucket. ÚNICO punto de control (decisión CEO #2).
 * Para excluir categorías no operativas (Foton/Préstamos/Casa):
 *   cambiar su valor de "gasto_operativo" a "no_operativo".
 */
export const NATURALEZA_BUCKET: Record<Naturaleza, PnlBucket> = {
  Operativo: "gasto_operativo",
  Fijo: "gasto_operativo",
  Variable: "gasto_operativo",
  Otros: "gasto_operativo",
  Financiero: "gasto_operativo",
  Activo: "gasto_operativo",
  "Costo Directo Unidad": "gasto_operativo",
};

/** Transacción aplanada lista para el cálculo P&L */
export interface TransaccionPnl {
  tipo: "venta" | "salida";
  monto_centavos: number;
  unidad_id: string | null;
  /** null se trata como 'pool' */
  asignacion: "pool" | "directa" | null;
  /** presente → COGS (mercadería) — prioridad sobre categoria_gasto */
  tipo_costo_id: string | null;
  /** presente → gasto operativo */
  categoria_gasto_id: string | null;
  categoria_naturaleza: Naturaleza | null;
}

/** Transacción con fecha para la serie del gráfico */
export interface TransaccionPnlConFecha extends TransaccionPnl {
  fecha: string; // "YYYY-MM-DD"
}

export interface UnidadRef {
  id: string;
  nombre: string;
}

export interface MargenUnidad {
  unidad_id: string;
  nombre: string;
  ingresos_centavos: number;
  costos_directos_centavos: number;
  margen_centavos: number;
  /** null si ingresos = 0 (no divide entre cero) */
  margen_pct: number | null;
}

export interface EstadoResultados {
  ingresos_totales_centavos: number;
  /** Ventas sin unidad_id asignada */
  ingresos_sin_unidad_centavos: number;
  cogs_total_centavos: number;
  /** null si ingresos = 0 */
  cogs_pct: number | null;

  margenes_por_unidad: MargenUnidad[];
  /** Σ márgenes de todas las unidades */
  suma_margenes_centavos: number;

  costos_comunes_pool_centavos: number;
  gastos_operativos_centavos: number;
  gastos_no_operativos_centavos: number;
  gastos_por_naturaleza: {
    naturaleza: Naturaleza | "Sin naturaleza";
    bucket: PnlBucket;
    monto_centavos: number;
  }[];
  /** Salidas sin tipo_costo ni categoria_gasto — no se pierden, se alertan */
  gasto_sin_clasificar_centavos: number;

  utilidad_neta_centavos: number;
  /** null si ingresos = 0 */
  margen_neto_pct: number | null;
}

// ── Entrada del punto para la serie del gráfico ─────────────

export interface PuntoSerie {
  bucket: string;
  ingresos: number;
  cogs: number;
  gastos: number;
  utilidad: number;
}

// ── Clasificación interna de cada salida ─────────────────────

type ClasificacionSalida =
  | { tipo: "cogs_directo"; unidad_id: string }
  | { tipo: "cogs_pool" }
  | { tipo: "gasto"; bucket: PnlBucket; naturaleza: Naturaleza | "Sin naturaleza" }
  | { tipo: "sin_clasificar" };

function clasificarSalida(tx: TransaccionPnl): ClasificacionSalida {
  // Prioridad 1: tipo_costo_id presente → COGS
  if (tx.tipo_costo_id !== null) {
    const esDirecta = tx.asignacion === "directa" && tx.unidad_id !== null;
    if (esDirecta) {
      return { tipo: "cogs_directo", unidad_id: tx.unidad_id! };
    }
    return { tipo: "cogs_pool" };
  }

  // Prioridad 2: categoria_gasto_id → gasto
  if (tx.categoria_gasto_id !== null) {
    const bucket: PnlBucket =
      tx.categoria_naturaleza !== null
        ? NATURALEZA_BUCKET[tx.categoria_naturaleza]
        : "gasto_operativo";
    const naturaleza: Naturaleza | "Sin naturaleza" =
      tx.categoria_naturaleza ?? "Sin naturaleza";
    return { tipo: "gasto", bucket, naturaleza };
  }

  // Sin clasificar
  return { tipo: "sin_clasificar" };
}

// ── calcularPnl ──────────────────────────────────────────────

/**
 * Calcula el Estado de Resultados completo para un conjunto de transacciones.
 * @param transacciones Todas las transacciones del período (ventas y salidas).
 * @param unidades Lista de unidades de negocio activas (para inicializar margenes en 0).
 */
export function calcularPnl(
  transacciones: TransaccionPnl[],
  unidades: UnidadRef[]
): EstadoResultados {
  // Estructuras de acumulación
  const ingresosUnidad = new Map<string, number>();
  const costoDirectoUnidad = new Map<string, number>();

  // Inicializar todas las unidades en 0
  unidades.forEach((u) => {
    ingresosUnidad.set(u.id, 0);
    costoDirectoUnidad.set(u.id, 0);
  });

  let ingresos_totales = 0;
  let ingresos_sin_unidad = 0;
  let cogs_pool = 0;
  let gastos_operativos = 0;
  let gastos_no_operativos = 0;
  let gasto_sin_clasificar = 0;
  const gastos_naturaleza = new Map<
    Naturaleza | "Sin naturaleza",
    { bucket: PnlBucket; monto: number }
  >();

  // Clasificar y acumular en una sola pasada
  for (const tx of transacciones) {
    if (tx.tipo === "venta") {
      ingresos_totales += tx.monto_centavos;
      if (tx.unidad_id === null) {
        ingresos_sin_unidad += tx.monto_centavos;
      } else {
        const prev = ingresosUnidad.get(tx.unidad_id) ?? 0;
        ingresosUnidad.set(tx.unidad_id, prev + tx.monto_centavos);
      }
      continue;
    }

    // Es salida — clasificar
    const cls = clasificarSalida(tx);
    switch (cls.tipo) {
      case "cogs_directo": {
        const prev = costoDirectoUnidad.get(cls.unidad_id) ?? 0;
        costoDirectoUnidad.set(cls.unidad_id, prev + tx.monto_centavos);
        break;
      }
      case "cogs_pool":
        cogs_pool += tx.monto_centavos;
        break;
      case "gasto": {
        if (cls.bucket === "gasto_operativo") {
          gastos_operativos += tx.monto_centavos;
        } else {
          gastos_no_operativos += tx.monto_centavos;
        }
        const nat = cls.naturaleza;
        const prev = gastos_naturaleza.get(nat) ?? { bucket: cls.bucket, monto: 0 };
        gastos_naturaleza.set(nat, { bucket: cls.bucket, monto: prev.monto + tx.monto_centavos });
        break;
      }
      case "sin_clasificar":
        gasto_sin_clasificar += tx.monto_centavos;
        break;
    }
  }

  // Calcular márgenes por unidad
  let cogs_directos_total = 0;
  const margenes_por_unidad: MargenUnidad[] = unidades.map((u) => {
    const ingresos = ingresosUnidad.get(u.id) ?? 0;
    const costos = costoDirectoUnidad.get(u.id) ?? 0;
    cogs_directos_total += costos;
    const margen = ingresos - costos;
    return {
      unidad_id: u.id,
      nombre: u.nombre,
      ingresos_centavos: ingresos,
      costos_directos_centavos: costos,
      margen_centavos: margen,
      margen_pct: ingresos > 0 ? margen / ingresos : null,
    };
  });

  const suma_margenes = margenes_por_unidad.reduce(
    (sum, m) => sum + m.margen_centavos,
    0
  );

  const cogs_total = cogs_directos_total + cogs_pool;

  // Utilidad Neta = Σ márgenes − costos pool − gastos operativos − no operativos
  const utilidad_neta =
    suma_margenes - cogs_pool - gastos_operativos - gastos_no_operativos;

  // Porcentajes: null si denominador = 0
  const cogs_pct =
    ingresos_totales > 0 ? cogs_total / ingresos_totales : ingresos_totales === 0 && cogs_total === 0 ? null : null;
  // Si hay COGS pero no hay ingresos → null. Si ingresos > 0 → ratio.
  const cogs_pct_final = ingresos_totales > 0 ? cogs_total / ingresos_totales : null;
  const margen_neto_pct =
    ingresos_totales > 0 ? utilidad_neta / ingresos_totales : null;

  // gastos_por_naturaleza como array para la UI
  const gastos_por_naturaleza = Array.from(gastos_naturaleza.entries()).map(
    ([naturaleza, { bucket, monto }]) => ({
      naturaleza,
      bucket,
      monto_centavos: monto,
    })
  );

  return {
    ingresos_totales_centavos: ingresos_totales,
    ingresos_sin_unidad_centavos: ingresos_sin_unidad,
    cogs_total_centavos: cogs_total,
    cogs_pct: cogs_pct_final,
    margenes_por_unidad,
    suma_margenes_centavos: suma_margenes,
    costos_comunes_pool_centavos: cogs_pool,
    gastos_operativos_centavos: gastos_operativos,
    gastos_no_operativos_centavos: gastos_no_operativos,
    gastos_por_naturaleza,
    gasto_sin_clasificar_centavos: gasto_sin_clasificar,
    utilidad_neta_centavos: utilidad_neta,
    margen_neto_pct,
  };
}

// ── serieDePnl ───────────────────────────────────────────────

/**
 * Genera la serie temporal para el gráfico en una sola pasada.
 * Todos los buckets del rango aparecen aunque no haya transacciones (valor 0).
 */
export function serieDePnl(
  transacciones: TransaccionPnlConFecha[],
  rango: RangoFecha,
  g: Granularidad
): PuntoSerie[] {
  // Inicializar todos los buckets del rango en 0
  const buckets = bucketsDeSerie(rango, g);
  const mapa = new Map<string, PuntoSerie>(
    buckets.map((b) => [
      b,
      { bucket: b, ingresos: 0, cogs: 0, gastos: 0, utilidad: 0 },
    ])
  );

  for (const tx of transacciones) {
    const bucket = fechaABucket(tx.fecha, g);
    const punto = mapa.get(bucket);
    if (!punto) continue; // fuera del rango

    if (tx.tipo === "venta") {
      punto.ingresos += tx.monto_centavos;
    } else {
      const cls = clasificarSalida(tx);
      if (cls.tipo === "cogs_directo" || cls.tipo === "cogs_pool") {
        punto.cogs += tx.monto_centavos;
      } else if (cls.tipo === "gasto") {
        punto.gastos += tx.monto_centavos;
      }
      // sin_clasificar no cuenta en el gráfico (pero sí en la tabla)
    }
  }

  // Calcular utilidad por bucket = ingresos − cogs − gastos
  for (const punto of mapa.values()) {
    punto.utilidad = punto.ingresos - punto.cogs - punto.gastos;
  }

  return buckets.map((b) => mapa.get(b)!);
}
