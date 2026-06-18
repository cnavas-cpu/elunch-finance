/**
 * Tests para lib/finance/pnl.ts — Estado de Resultados + Margen de Contribución.
 * Modelo CLAUDE.md §6.3: Ingresos → (–) Costos directos por unidad = Margen
 * Σ Márgenes → (–) Costos comunes pool → (–) Gastos operativos = Utilidad Neta.
 * PROHIBIDO prorratear costos pool a las unidades.
 */
import { describe, it, expect } from "vitest";
import {
  calcularPnl,
  serieDePnl,
  NATURALEZA_BUCKET,
  type TransaccionPnl,
  type UnidadRef,
  type EstadoResultados,
  type Naturaleza,
} from "./pnl";
import type { RangoFecha } from "./periodo";

// ── Fixtures compartidos ────────────────────────────────────

const UNIDADES: UnidadRef[] = [
  { id: "UN-A", nombre: "Cafetería A" },
  { id: "UN-B", nombre: "Cafetería B" },
];

/** Venta básica para una unidad */
function venta(unidad_id: string, monto: number): TransaccionPnl {
  return {
    tipo: "venta",
    monto_centavos: monto,
    unidad_id,
    asignacion: "pool",
    tipo_costo_id: null,
    categoria_gasto_id: null,
    categoria_naturaleza: null,
  };
}

/** Salida COGS directa a una unidad */
function cogsDirecto(unidad_id: string, monto: number): TransaccionPnl {
  return {
    tipo: "salida",
    monto_centavos: monto,
    unidad_id,
    asignacion: "directa",
    tipo_costo_id: "TC-01",
    categoria_gasto_id: null,
    categoria_naturaleza: null,
  };
}

/** Salida COGS pool (no se asigna a ninguna unidad) */
function cogsPool(monto: number): TransaccionPnl {
  return {
    tipo: "salida",
    monto_centavos: monto,
    unidad_id: null,
    asignacion: "pool",
    tipo_costo_id: "TC-01",
    categoria_gasto_id: null,
    categoria_naturaleza: null,
  };
}

/** Salida de gasto operativo */
function gasto(
  monto: number,
  naturaleza: Naturaleza | null = "Operativo"
): TransaccionPnl {
  return {
    tipo: "salida",
    monto_centavos: monto,
    unidad_id: null,
    asignacion: "pool",
    tipo_costo_id: null,
    categoria_gasto_id: "GA-01",
    categoria_naturaleza: naturaleza,
  };
}

// ── Caso 1: mes vacío ───────────────────────────────────────

describe("calcularPnl — caso 1: mes vacío", () => {
  it("devuelve ceros y pct null cuando no hay transacciones", () => {
    const resultado = calcularPnl([], UNIDADES);
    expect(resultado.ingresos_totales_centavos).toBe(0);
    expect(resultado.cogs_total_centavos).toBe(0);
    expect(resultado.cogs_pct).toBeNull();
    expect(resultado.suma_margenes_centavos).toBe(0);
    expect(resultado.costos_comunes_pool_centavos).toBe(0);
    expect(resultado.gastos_operativos_centavos).toBe(0);
    expect(resultado.utilidad_neta_centavos).toBe(0);
    expect(resultado.margen_neto_pct).toBeNull();
    expect(resultado.margenes_por_unidad).toHaveLength(2); // UN-A y UN-B inicializadas en 0
    resultado.margenes_por_unidad.forEach((m) => {
      expect(m.ingresos_centavos).toBe(0);
      expect(m.costos_directos_centavos).toBe(0);
      expect(m.margen_centavos).toBe(0);
      expect(m.margen_pct).toBeNull();
    });
  });
});

// ── Caso 2: solo ventas ─────────────────────────────────────

describe("calcularPnl — caso 2: solo ventas sin costos", () => {
  it("ingresos = suma de ventas, utilidad = ingresos, COGS=0", () => {
    const txs: TransaccionPnl[] = [
      venta("UN-A", 10_000), // $100
      venta("UN-B", 5_000),  // $50
    ];
    const r = calcularPnl(txs, UNIDADES);
    expect(r.ingresos_totales_centavos).toBe(15_000);
    expect(r.cogs_total_centavos).toBe(0);
    expect(r.cogs_pct).toBe(0);
    expect(r.gastos_operativos_centavos).toBe(0);
    // Utilidad = suma de márgenes − pool − gastos = 15000 − 0 − 0 = 15000
    expect(r.utilidad_neta_centavos).toBe(15_000);
  });
});

// ── Caso 3: margen por unidad básico ───────────────────────

describe("calcularPnl — caso 3: margen por unidad", () => {
  it("calcula margen y pct por unidad correctamente", () => {
    const txs: TransaccionPnl[] = [
      venta("UN-A", 20_000),
      cogsDirecto("UN-A", 8_000),
    ];
    const r = calcularPnl(txs, UNIDADES);
    const ua = r.margenes_por_unidad.find((m) => m.unidad_id === "UN-A")!;
    expect(ua.ingresos_centavos).toBe(20_000);
    expect(ua.costos_directos_centavos).toBe(8_000);
    expect(ua.margen_centavos).toBe(12_000);
    // margen_pct = 12000 / 20000 = 0.6
    expect(ua.margen_pct).toBeCloseTo(0.6, 5);

    const ub = r.margenes_por_unidad.find((m) => m.unidad_id === "UN-B")!;
    expect(ub.ingresos_centavos).toBe(0);
    expect(ub.margen_pct).toBeNull(); // sin ingresos → null (no NaN/Infinity)
  });
});

// ── Caso 4: COGS pool NO se prorratea (TEST ESTRELLA §6.3) ─

describe("calcularPnl — caso 4: COGS pool NO se prorratea a las unidades", () => {
  it("una compra pool NO reduce el margen de ninguna unidad", () => {
    const txs: TransaccionPnl[] = [
      venta("UN-A", 20_000),
      venta("UN-B", 10_000),
      cogsPool(6_000), // compra común → NO va a UN-A ni UN-B
    ];
    const r = calcularPnl(txs, UNIDADES);

    // Los márgenes por unidad no se ven afectados por el pool
    const ua = r.margenes_por_unidad.find((m) => m.unidad_id === "UN-A")!;
    const ub = r.margenes_por_unidad.find((m) => m.unidad_id === "UN-B")!;
    expect(ua.costos_directos_centavos).toBe(0);
    expect(ub.costos_directos_centavos).toBe(0);
    expect(ua.margen_centavos).toBe(20_000);
    expect(ub.margen_centavos).toBe(10_000);

    // El costo pool aparece solo en el consolidado
    expect(r.costos_comunes_pool_centavos).toBe(6_000);
    expect(r.suma_margenes_centavos).toBe(30_000);
    expect(r.utilidad_neta_centavos).toBe(30_000 - 6_000); // 24_000
  });
});

// ── Caso 5: cascada completa verificada a mano ──────────────

describe("calcularPnl — caso 5: cascada completa", () => {
  it("verifica la cascada exacta de CLAUDE.md §6.3", () => {
    const txs: TransaccionPnl[] = [
      // Ventas
      venta("UN-A", 50_000),  // $500
      venta("UN-B", 30_000),  // $300
      // COGS directos
      cogsDirecto("UN-A", 15_000), // $150 directo a A
      cogsDirecto("UN-B", 9_000),  // $90 directo a B
      // COGS pool
      cogsPool(8_000),             // $80 común
      // Gastos operativos
      gasto(10_000, "Fijo"),       // salarios $100
      gasto(5_000, "Variable"),    // servicios $50
    ];
    const r = calcularPnl(txs, UNIDADES);

    // Ingresos
    expect(r.ingresos_totales_centavos).toBe(80_000);

    // Márgenes por unidad
    const ua = r.margenes_por_unidad.find((m) => m.unidad_id === "UN-A")!;
    const ub = r.margenes_por_unidad.find((m) => m.unidad_id === "UN-B")!;
    expect(ua.margen_centavos).toBe(35_000); // 50000 - 15000
    expect(ub.margen_centavos).toBe(21_000); // 30000 - 9000
    expect(r.suma_margenes_centavos).toBe(56_000);

    // COGS total
    expect(r.cogs_total_centavos).toBe(32_000); // 15000+9000+8000
    expect(r.cogs_pct).toBeCloseTo(0.4, 5); // 32000/80000

    // Costos comunes
    expect(r.costos_comunes_pool_centavos).toBe(8_000);

    // Gastos
    expect(r.gastos_operativos_centavos).toBe(15_000); // 10000+5000

    // Utilidad Neta = suma_margenes − pool − gastos
    // = 56000 − 8000 − 15000 = 33000
    expect(r.utilidad_neta_centavos).toBe(33_000);
    expect(r.margen_neto_pct).toBeCloseTo(33_000 / 80_000, 5);
  });
});

// ── Caso 6: prioridad COGS sobre gasto ─────────────────────

describe("calcularPnl — caso 6: prioridad COGS sobre categoria_gasto", () => {
  it("cuando una salida tiene ambos campos, COGS gana", () => {
    const salida_ambos: TransaccionPnl = {
      tipo: "salida",
      monto_centavos: 5_000,
      unidad_id: "UN-A",
      asignacion: "directa",
      tipo_costo_id: "TC-01",       // COGS presente
      categoria_gasto_id: "GA-01", // Gasto presente también
      categoria_naturaleza: "Operativo",
    };
    const txs: TransaccionPnl[] = [venta("UN-A", 10_000), salida_ambos];
    const r = calcularPnl(txs, UNIDADES);
    const ua = r.margenes_por_unidad.find((m) => m.unidad_id === "UN-A")!;
    // Se clasificó como COGS directa, no como gasto
    expect(ua.costos_directos_centavos).toBe(5_000);
    expect(r.gastos_operativos_centavos).toBe(0);
    expect(r.gasto_sin_clasificar_centavos).toBe(0);
  });
});

// ── Caso 7: venta sin unidad_id ────────────────────────────

describe("calcularPnl — caso 7: venta sin unidad_id", () => {
  it("la venta sin unidad suma a ingresos totales pero no a ninguna unidad", () => {
    const txs: TransaccionPnl[] = [
      { ...venta("UN-A", 10_000) },
      {
        tipo: "venta",
        monto_centavos: 3_000,
        unidad_id: null, // sin unidad
        asignacion: null,
        tipo_costo_id: null,
        categoria_gasto_id: null,
        categoria_naturaleza: null,
      },
    ];
    const r = calcularPnl(txs, UNIDADES);
    expect(r.ingresos_totales_centavos).toBe(13_000);
    expect(r.ingresos_sin_unidad_centavos).toBe(3_000);
    // La suma de márgenes de unidades solo incluye UN-A
    const ua = r.margenes_por_unidad.find((m) => m.unidad_id === "UN-A")!;
    expect(ua.ingresos_centavos).toBe(10_000);
  });
});

// ── Caso 8: salida directa sin unidad_id degrada a pool ─────

describe("calcularPnl — caso 8: salida directa sin unidad_id → pool", () => {
  it("una salida asignacion=directa pero sin unidad_id cuenta como pool", () => {
    const salida_huerfana: TransaccionPnl = {
      tipo: "salida",
      monto_centavos: 4_000,
      unidad_id: null,     // directa pero sin unidad
      asignacion: "directa",
      tipo_costo_id: "TC-01",
      categoria_gasto_id: null,
      categoria_naturaleza: null,
    };
    const txs: TransaccionPnl[] = [venta("UN-A", 20_000), salida_huerfana];
    const r = calcularPnl(txs, UNIDADES);
    // NO reduce el margen de UN-A
    const ua = r.margenes_por_unidad.find((m) => m.unidad_id === "UN-A")!;
    expect(ua.costos_directos_centavos).toBe(0);
    expect(ua.margen_centavos).toBe(20_000);
    // Sí aparece en costo pool
    expect(r.costos_comunes_pool_centavos).toBe(4_000);
  });
});

// ── Caso 9: gasto sin clasificar ──────────────────────────

describe("calcularPnl — caso 9: gasto sin clasificar", () => {
  it("salida sin tipo_costo_id ni categoria_gasto_id va a gasto_sin_clasificar", () => {
    const sinClasificar: TransaccionPnl = {
      tipo: "salida",
      monto_centavos: 2_500,
      unidad_id: null,
      asignacion: "pool",
      tipo_costo_id: null,
      categoria_gasto_id: null, // nada
      categoria_naturaleza: null,
    };
    const txs: TransaccionPnl[] = [sinClasificar];
    const r = calcularPnl(txs, UNIDADES);
    expect(r.gasto_sin_clasificar_centavos).toBe(2_500);
    expect(r.gastos_operativos_centavos).toBe(0);
    expect(r.cogs_total_centavos).toBe(0);
  });
});

// ── Caso 10: categorías no operativas cuentan como gasto hoy ─

describe("calcularPnl — caso 10: categorías no operativas (Foton, Préstamos, Casa)", () => {
  it("NATURALEZA_BUCKET asigna todo a gasto_operativo por defecto", () => {
    expect(NATURALEZA_BUCKET["Activo"]).toBe("gasto_operativo");     // Foton
    expect(NATURALEZA_BUCKET["Financiero"]).toBe("gasto_operativo"); // Préstamos
    expect(NATURALEZA_BUCKET["Otros"]).toBe("gasto_operativo");      // Pago Casa
  });

  it("una salida con naturaleza Activo (Foton) cuenta como gasto operativo", () => {
    const foton: TransaccionPnl = {
      tipo: "salida",
      monto_centavos: 12_000,
      unidad_id: null,
      asignacion: "pool",
      tipo_costo_id: null,
      categoria_gasto_id: "GA-17", // Foton = Activo
      categoria_naturaleza: "Activo",
    };
    const txs: TransaccionPnl[] = [foton];
    const r = calcularPnl(txs, UNIDADES);
    expect(r.gastos_operativos_centavos).toBe(12_000);
    expect(r.gastos_no_operativos_centavos).toBe(0);
  });

  it("una salida con naturaleza Financiero (Préstamo) cuenta como gasto operativo", () => {
    const prestamo: TransaccionPnl = {
      tipo: "salida",
      monto_centavos: 8_000,
      unidad_id: null,
      asignacion: "pool",
      tipo_costo_id: null,
      categoria_gasto_id: "GA-22",
      categoria_naturaleza: "Financiero",
    };
    const txs: TransaccionPnl[] = [prestamo];
    const r = calcularPnl(txs, UNIDADES);
    expect(r.gastos_operativos_centavos).toBe(8_000);
    expect(r.gastos_no_operativos_centavos).toBe(0);
  });
});

// ── Caso 11: pct con ingresos = 0 ──────────────────────────

describe("calcularPnl — caso 11: pct null cuando denominador es 0", () => {
  it("cogs_pct es null (no NaN/Infinity) cuando ingresos = 0", () => {
    const txs: TransaccionPnl[] = [cogsPool(5_000)];
    const r = calcularPnl(txs, UNIDADES);
    expect(r.ingresos_totales_centavos).toBe(0);
    expect(r.cogs_pct).toBeNull();
    expect(r.margen_neto_pct).toBeNull();
  });

  it("margen_pct de unidad es null cuando esa unidad no tiene ingresos", () => {
    const txs: TransaccionPnl[] = [venta("UN-A", 10_000)];
    const r = calcularPnl(txs, UNIDADES);
    const ub = r.margenes_por_unidad.find((m) => m.unidad_id === "UN-B")!;
    expect(ub.ingresos_centavos).toBe(0);
    expect(ub.margen_pct).toBeNull();
  });
});

// ── serieDePnl ──────────────────────────────────────────────

describe("serieDePnl", () => {
  const rango: RangoFecha = { desde: "2026-06-01", hasta: "2026-06-02" };

  it("devuelve una entrada por bucket con los totales correctos", () => {
    const txs: TransaccionPnl[] = [
      { ...venta("UN-A", 10_000), tipo: "venta" }, // se registra con fecha implícita
    ];
    // Para serieDePnl las transacciones deben tener fecha
    const txsConFecha = [
      {
        ...venta("UN-A", 10_000),
        fecha: "2026-06-01",
      },
      {
        ...cogsDirecto("UN-A", 3_000),
        fecha: "2026-06-01",
      },
      {
        ...gasto(2_000),
        fecha: "2026-06-02",
      },
    ];

    const serie = serieDePnl(txsConFecha as Parameters<typeof serieDePnl>[0], rango, "diario");

    expect(serie.length).toBe(2); // dos días
    const d1 = serie.find((s) => s.bucket === "2026-06-01")!;
    expect(d1.ingresos).toBe(10_000);
    expect(d1.cogs).toBe(3_000);
    expect(d1.gastos).toBe(0);
    expect(d1.utilidad).toBe(7_000); // 10000 - 3000

    const d2 = serie.find((s) => s.bucket === "2026-06-02")!;
    expect(d2.ingresos).toBe(0);
    expect(d2.gastos).toBe(2_000);
    expect(d2.utilidad).toBe(-2_000);
  });

  it("todos los buckets del rango aparecen aunque no haya transacciones", () => {
    const serie = serieDePnl([], rango, "diario");
    expect(serie.length).toBe(2);
    serie.forEach((s) => {
      expect(s.ingresos).toBe(0);
      expect(s.cogs).toBe(0);
      expect(s.gastos).toBe(0);
      expect(s.utilidad).toBe(0);
    });
  });
});
