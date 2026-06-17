import { describe, it, expect } from "vitest";
import {
  puedeTransicionar,
  transicionesDisponibles,
  calcularSaldo,
  totalAbonado,
  diasParaVencer,
  estadoAging,
  resumenCxp,
  type EstadoCxp,
  type CxpParaResumen,
} from "./cxp";

// ── Máquina de estados ────────────────────────────────────────

describe("puedeTransicionar", () => {
  it("Pendiente → Programada", () => {
    expect(puedeTransicionar("Pendiente", "Programada")).toBe(true);
  });
  it("Pendiente → En disputa", () => {
    expect(puedeTransicionar("Pendiente", "En disputa")).toBe(true);
  });
  it("Programada → Pendiente", () => {
    expect(puedeTransicionar("Programada", "Pendiente")).toBe(true);
  });
  it("Programada → En disputa", () => {
    expect(puedeTransicionar("Programada", "En disputa")).toBe(true);
  });
  it("En disputa → Pendiente", () => {
    expect(puedeTransicionar("En disputa", "Pendiente")).toBe(true);
  });
  it("En disputa → Programada", () => {
    expect(puedeTransicionar("En disputa", "Programada")).toBe(true);
  });
  it("Vencida → Pendiente (para gestionar desde vencido)", () => {
    expect(puedeTransicionar("Vencida", "Pendiente")).toBe(true);
  });
  // Transiciones prohibidas
  it("NO permite Pendiente → Pagada (solo via pago)", () => {
    expect(puedeTransicionar("Pendiente", "Pagada")).toBe(false);
  });
  it("NO permite Pendiente → Vencida (es derivada)", () => {
    expect(puedeTransicionar("Pendiente", "Vencida")).toBe(false);
  });
  it("NO permite Pagada → Pendiente", () => {
    expect(puedeTransicionar("Pagada", "Pendiente")).toBe(false);
  });
  it("NO permite Pagada → nada", () => {
    expect(puedeTransicionar("Pagada", "Programada")).toBe(false);
    expect(puedeTransicionar("Pagada", "En disputa")).toBe(false);
  });
});

describe("transicionesDisponibles", () => {
  it("Pendiente devuelve 2 opciones", () => {
    expect(transicionesDisponibles("Pendiente")).toEqual(["Programada", "En disputa"]);
  });
  it("Pagada no tiene opciones", () => {
    expect(transicionesDisponibles("Pagada")).toEqual([]);
  });
  it("En disputa puede volver a Pendiente o Programada", () => {
    const opts = transicionesDisponibles("En disputa");
    expect(opts).toContain("Pendiente");
    expect(opts).toContain("Programada");
  });
});

// ── Saldo y abonos ────────────────────────────────────────────

describe("calcularSaldo", () => {
  it("sin pagos devuelve el monto completo", () => {
    expect(calcularSaldo(200000, [])).toBe(200000);
  });
  it("un abono parcial reduce el saldo", () => {
    expect(calcularSaldo(200000, [{ monto_centavos: 50000 }])).toBe(150000);
  });
  it("varios abonos se suman", () => {
    expect(calcularSaldo(200000, [
      { monto_centavos: 50000 },
      { monto_centavos: 50000 },
    ])).toBe(100000);
  });
  it("abono que cierra deja saldo 0", () => {
    expect(calcularSaldo(200000, [{ monto_centavos: 200000 }])).toBe(0);
  });
  it("nunca devuelve saldo negativo", () => {
    expect(calcularSaldo(100000, [{ monto_centavos: 150000 }])).toBe(0);
  });
});

describe("totalAbonado", () => {
  it("sin pagos es 0", () => {
    expect(totalAbonado([])).toBe(0);
  });
  it("suma varios pagos", () => {
    expect(totalAbonado([
      { monto_centavos: 30000 },
      { monto_centavos: 70000 },
    ])).toBe(100000);
  });
});

// ── Aging / vencimiento ───────────────────────────────────────

describe("diasParaVencer", () => {
  const hoy = "2026-06-17";
  it("vence en el futuro devuelve positivo", () => {
    expect(diasParaVencer("2026-06-20", hoy)).toBe(3);
  });
  it("vence hoy devuelve 0", () => {
    expect(diasParaVencer("2026-06-17", hoy)).toBe(0);
  });
  it("vencida ayer devuelve -1", () => {
    expect(diasParaVencer("2026-06-16", hoy)).toBe(-1);
  });
  it("vencida hace 7 días devuelve -7", () => {
    expect(diasParaVencer("2026-06-10", hoy)).toBe(-7);
  });
  it("sin fecha devuelve Infinity", () => {
    expect(diasParaVencer(null, hoy)).toBe(Infinity);
  });
});

describe("estadoAging", () => {
  const hoy = "2026-06-17";

  it("Pagada siempre es al_dia sin importar la fecha", () => {
    expect(estadoAging("2026-06-01", "Pagada", hoy)).toBe("al_dia");
  });
  it("vencida ayer → vencida", () => {
    expect(estadoAging("2026-06-16", "Pendiente", hoy)).toBe("vencida");
  });
  it("vence hoy (dias=0) → por_vencer", () => {
    expect(estadoAging("2026-06-17", "Pendiente", hoy)).toBe("por_vencer");
  });
  it("vence en 3 días → por_vencer", () => {
    expect(estadoAging("2026-06-20", "Pendiente", hoy)).toBe("por_vencer");
  });
  it("vence en 4 días → al_dia", () => {
    expect(estadoAging("2026-06-21", "Pendiente", hoy)).toBe("al_dia");
  });
  it("sin fecha → al_dia", () => {
    expect(estadoAging(null, "Pendiente", hoy)).toBe("al_dia");
  });
  it("estado Vencida con fecha pasada → vencida", () => {
    expect(estadoAging("2026-06-10", "Vencida", hoy)).toBe("vencida");
  });
});

// ── Resumen ───────────────────────────────────────────────────

describe("resumenCxp", () => {
  const hoy = "2026-06-17";

  it("lista vacía devuelve todo en cero", () => {
    const r = resumenCxp([], hoy);
    expect(r.totalPorPagar).toBe(0);
    expect(r.totalVencido).toBe(0);
    expect(r.totalPorVencer).toBe(0);
    expect(r.countVencidas).toBe(0);
    expect(r.countPorVencer).toBe(0);
  });

  it("Pagada no suma a totalPorPagar", () => {
    const cxps: CxpParaResumen[] = [{
      monto_centavos: 100000,
      fecha_vencimiento: "2026-06-10",
      estado: "Pagada",
      pagos: [{ monto_centavos: 100000 }],
    }];
    const r = resumenCxp(cxps, hoy);
    expect(r.totalPorPagar).toBe(0);
    expect(r.totalVencido).toBe(0);
    expect(r.countPorEstado.Pagada).toBe(1);
  });

  it("vencida suma a totalVencido con su saldo", () => {
    const cxps: CxpParaResumen[] = [{
      monto_centavos: 200000,
      fecha_vencimiento: "2026-06-10",
      estado: "Pendiente",
      pagos: [],
    }];
    const r = resumenCxp(cxps, hoy);
    expect(r.totalVencido).toBe(200000);
    expect(r.countVencidas).toBe(1);
    expect(r.totalPorPagar).toBe(200000);
  });

  it("vencida con abono parcial suma solo el saldo restante", () => {
    const cxps: CxpParaResumen[] = [{
      monto_centavos: 200000,
      fecha_vencimiento: "2026-06-10",
      estado: "Pendiente",
      pagos: [{ monto_centavos: 80000 }],
    }];
    const r = resumenCxp(cxps, hoy);
    expect(r.totalVencido).toBe(120000);
  });

  it("por vencer ≤3 días suma a totalPorVencer", () => {
    const cxps: CxpParaResumen[] = [{
      monto_centavos: 150000,
      fecha_vencimiento: "2026-06-19", // 2 días
      estado: "Pendiente",
      pagos: [{ monto_centavos: 50000 }],
    }];
    const r = resumenCxp(cxps, hoy);
    expect(r.totalPorVencer).toBe(100000); // saldo = 150000 - 50000
    expect(r.countPorVencer).toBe(1);
  });

  it("al día no suma a vencido ni por_vencer", () => {
    const cxps: CxpParaResumen[] = [{
      monto_centavos: 200000,
      fecha_vencimiento: "2026-07-01",
      estado: "Pendiente",
      pagos: [],
    }];
    const r = resumenCxp(cxps, hoy);
    expect(r.totalVencido).toBe(0);
    expect(r.totalPorVencer).toBe(0);
    expect(r.totalPorPagar).toBe(200000);
  });

  it("cuenta correctamente varios tipos mixtos", () => {
    const cxps: CxpParaResumen[] = [
      // vencida
      { monto_centavos: 100000, fecha_vencimiento: "2026-06-10", estado: "Pendiente", pagos: [] },
      // por vencer
      { monto_centavos: 50000, fecha_vencimiento: "2026-06-19", estado: "Programada", pagos: [] },
      // al día
      { monto_centavos: 80000, fecha_vencimiento: "2026-07-01", estado: "Pendiente", pagos: [] },
      // pagada (ignorada)
      { monto_centavos: 200000, fecha_vencimiento: null, estado: "Pagada", pagos: [{ monto_centavos: 200000 }] },
    ];
    const r = resumenCxp(cxps, hoy);
    expect(r.totalPorPagar).toBe(100000 + 50000 + 80000);
    expect(r.totalVencido).toBe(100000);
    expect(r.totalPorVencer).toBe(50000);
    expect(r.countVencidas).toBe(1);
    expect(r.countPorVencer).toBe(1);
    expect(r.countPorEstado.Pagada).toBe(1);
    expect(r.countPorEstado.Pendiente).toBe(2);
    expect(r.countPorEstado.Programada).toBe(1);
  });
});
