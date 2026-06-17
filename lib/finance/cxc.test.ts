import { describe, it, expect } from "vitest";
import {
  puedeTransicionar,
  transicionesDisponibles,
  ESTADOS_MANUALES,
  calcularSaldo,
  totalAbonado,
  diasParaVencer,
  estadoAging,
  resumenCxc,
  etiquetaEstado,
  type EstadoCxc,
} from "./cxc";

const hoy = "2026-06-17";

// ── puedeTransicionar ─────────────────────────────────────────────

describe("puedeTransicionar", () => {
  it("Generada → OC Recibida es válida", () =>
    expect(puedeTransicionar("Generada", "OC Recibida")).toBe(true));

  it("OC Recibida → Facturada es válida", () =>
    expect(puedeTransicionar("OC Recibida", "Facturada")).toBe(true));

  it("Facturada puede ir a Programada Pago, En Recuperacion o Incobrable", () => {
    expect(puedeTransicionar("Facturada", "Programada Pago")).toBe(true);
    expect(puedeTransicionar("Facturada", "En Recuperacion")).toBe(true);
    expect(puedeTransicionar("Facturada", "Incobrable")).toBe(true);
  });

  it("En Recuperacion → Programada Pago / Incobrable", () => {
    expect(puedeTransicionar("En Recuperacion", "Programada Pago")).toBe(true);
    expect(puedeTransicionar("En Recuperacion", "Incobrable")).toBe(true);
  });

  it("NO permite saltar Generada → Facturada", () =>
    expect(puedeTransicionar("Generada", "Facturada")).toBe(false));

  it("NO permite → Pagada manualmente (solo vía cobro)", () =>
    expect(puedeTransicionar("Programada Pago", "Pagada")).toBe(false));

  it("NO permite retroceder a Generada", () =>
    expect(puedeTransicionar("OC Recibida", "Generada")).toBe(false));

  it("Pagada es terminal (ninguna transición)", () =>
    expect(transicionesDisponibles("Pagada")).toEqual([]));

  it("Incobrable es terminal (ninguna transición)", () =>
    expect(transicionesDisponibles("Incobrable")).toEqual([]));
});

// ── ESTADOS_MANUALES ──────────────────────────────────────────────

describe("ESTADOS_MANUALES", () => {
  it("no incluye Pagada (solo vía cobro)", () =>
    expect(ESTADOS_MANUALES).not.toContain("Pagada"));

  it("no incluye Generada (estado inicial del sistema)", () =>
    expect(ESTADOS_MANUALES).not.toContain("Generada"));

  it("incluye los 5 destinos manuales válidos", () => {
    expect(ESTADOS_MANUALES).toContain("OC Recibida");
    expect(ESTADOS_MANUALES).toContain("Facturada");
    expect(ESTADOS_MANUALES).toContain("Programada Pago");
    expect(ESTADOS_MANUALES).toContain("En Recuperacion");
    expect(ESTADOS_MANUALES).toContain("Incobrable");
  });
});

// ── etiquetaEstado ────────────────────────────────────────────────

describe("etiquetaEstado", () => {
  it("muestra 'En Recuperacion' con tilde visual", () =>
    expect(etiquetaEstado("En Recuperacion")).toBe("En Recuperación"));

  it("deja los demás estados igual", () =>
    expect(etiquetaEstado("Facturada")).toBe("Facturada"));

  it("Pagada sin cambio", () =>
    expect(etiquetaEstado("Pagada")).toBe("Pagada"));
});

// ── calcularSaldo ─────────────────────────────────────────────────

describe("calcularSaldo", () => {
  it("sin pagos = monto completo", () =>
    expect(calcularSaldo(200000, [])).toBe(200000));

  it("con abonos parciales resta correctamente", () =>
    expect(calcularSaldo(200000, [{ monto_centavos: 50000 }, { monto_centavos: 30000 }])).toBe(120000));

  it("nunca devuelve negativo (anti-sobrecobro en capa TS)", () =>
    expect(calcularSaldo(100000, [{ monto_centavos: 150000 }])).toBe(0));
});

// ── totalAbonado ──────────────────────────────────────────────────

describe("totalAbonado", () => {
  it("lista vacía = 0", () => expect(totalAbonado([])).toBe(0));

  it("suma los montos de todos los pagos", () =>
    expect(totalAbonado([{ monto_centavos: 100 }, { monto_centavos: 250 }])).toBe(350));
});

// ── diasParaVencer ────────────────────────────────────────────────

describe("diasParaVencer", () => {
  it("fecha null = Infinity (sin fecha esperada)", () =>
    expect(diasParaVencer(null, hoy)).toBe(Infinity));

  it("misma fecha = 0", () =>
    expect(diasParaVencer("2026-06-17", hoy)).toBe(0));

  it("fecha futura positiva", () =>
    expect(diasParaVencer("2026-06-20", hoy)).toBe(3));

  it("fecha pasada negativa", () =>
    expect(diasParaVencer("2026-06-10", hoy)).toBe(-7));
});

// ── estadoAging ───────────────────────────────────────────────────

describe("estadoAging", () => {
  it("Pagada siempre es al_dia (no aplica aging)", () =>
    expect(estadoAging("2026-01-01", "Pagada", hoy)).toBe("al_dia"));

  it("Incobrable siempre es al_dia (no aplica aging)", () =>
    expect(estadoAging("2026-01-01", "Incobrable", hoy)).toBe("al_dia"));

  it("sin fecha esperada = al_dia", () =>
    expect(estadoAging(null, "Facturada", hoy)).toBe("al_dia"));

  it("fecha pasada = vencida", () =>
    expect(estadoAging("2026-06-10", "Facturada", hoy)).toBe("vencida"));

  it("fecha ≤3 días = por_vencer", () =>
    expect(estadoAging("2026-06-19", "Facturada", hoy)).toBe("por_vencer"));

  it("fecha exactamente hoy = por_vencer (0 días)", () =>
    expect(estadoAging("2026-06-17", "Facturada", hoy)).toBe("por_vencer"));

  it("fecha >3 días = al_dia", () =>
    expect(estadoAging("2026-06-30", "Facturada", hoy)).toBe("al_dia"));
});

// ── resumenCxc ────────────────────────────────────────────────────

describe("resumenCxc", () => {
  const base = (
    e: EstadoCxc,
    fecha: string | null,
    monto: number,
    pagos: { monto_centavos: number }[] = []
  ) => ({ monto_centavos: monto, fecha_esperada: fecha, estado: e, pagos });

  it("lista vacía = todos ceros", () => {
    const r = resumenCxc([], hoy);
    expect(r.totalPorCobrar).toBe(0);
    expect(r.totalVencido).toBe(0);
    expect(r.totalPorVencer).toBe(0);
    expect(r.countVencidas).toBe(0);
    expect(r.countPorVencer).toBe(0);
  });

  it("ignora Pagada e Incobrable en los totales de saldo", () => {
    const r = resumenCxc([
      base("Pagada", "2026-06-10", 100000),
      base("Incobrable", "2026-06-10", 100000),
    ], hoy);
    expect(r.totalPorCobrar).toBe(0);
    expect(r.totalVencido).toBe(0);
  });

  it("suma vencido y por vencer con saldo neto (descontando abonos)", () => {
    const r = resumenCxc([
      // vencida, saldo 150 000 (abonado 50 000)
      base("Facturada", "2026-06-10", 200000, [{ monto_centavos: 50000 }]),
      // por vencer (2 días)
      base("Facturada", "2026-06-19", 100000),
      // al día (julio)
      base("Generada", "2026-07-30", 80000),
    ], hoy);
    expect(r.totalVencido).toBe(150000);
    expect(r.totalPorVencer).toBe(100000);
    expect(r.totalPorCobrar).toBe(330000);
    expect(r.countVencidas).toBe(1);
    expect(r.countPorVencer).toBe(1);
  });

  it("cuenta correctamente por estado", () => {
    const r = resumenCxc([
      base("Generada", null, 1000),
      base("Generada", null, 1000),
      base("Pagada", null, 500),
    ], hoy);
    expect(r.countPorEstado["Generada"]).toBe(2);
    expect(r.countPorEstado["Pagada"]).toBe(1);
  });
});
