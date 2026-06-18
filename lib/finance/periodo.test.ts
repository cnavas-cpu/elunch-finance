/**
 * Tests para lib/finance/periodo.ts
 * Helpers de rango de fechas para Reportes P&L.
 */
import { describe, it, expect } from "vitest";
import {
  rangoMensual,
  rangoDiario,
  rangoSemanal,
  rangoAnioCorrido,
  fechaABucket,
  bucketsDeSerie,
  type RangoFecha,
  type Granularidad,
} from "./periodo";

// ── rangoMensual ────────────────────────────────────────────

describe("rangoMensual", () => {
  it("devuelve primer y último día del mes", () => {
    expect(rangoMensual("2026-06")).toEqual<RangoFecha>({
      desde: "2026-06-01",
      hasta: "2026-06-30",
    });
  });

  it("maneja febrero no bisiesto", () => {
    expect(rangoMensual("2025-02")).toEqual<RangoFecha>({
      desde: "2025-02-01",
      hasta: "2025-02-28",
    });
  });

  it("maneja febrero bisiesto", () => {
    expect(rangoMensual("2024-02")).toEqual<RangoFecha>({
      desde: "2024-02-01",
      hasta: "2024-02-29",
    });
  });

  it("maneja diciembre (31 días)", () => {
    expect(rangoMensual("2026-12")).toEqual<RangoFecha>({
      desde: "2026-12-01",
      hasta: "2026-12-31",
    });
  });

  it("maneja enero", () => {
    expect(rangoMensual("2026-01")).toEqual<RangoFecha>({
      desde: "2026-01-01",
      hasta: "2026-01-31",
    });
  });
});

// ── rangoDiario ─────────────────────────────────────────────

describe("rangoDiario", () => {
  it("desde y hasta son iguales", () => {
    const r = rangoDiario("2026-06-15");
    expect(r.desde).toBe("2026-06-15");
    expect(r.hasta).toBe("2026-06-15");
  });

  it("devuelve un RangoFecha con desde === hasta", () => {
    const r = rangoDiario("2026-01-01");
    expect(r.desde).toBe(r.hasta);
  });
});

// ── rangoSemanal ────────────────────────────────────────────

describe("rangoSemanal", () => {
  it("semana de lunes a domingo (semana que NO cruza mes)", () => {
    // 2026-06-15 es lunes
    const r = rangoSemanal("2026-06-15");
    expect(r.desde).toBe("2026-06-15");
    expect(r.hasta).toBe("2026-06-21");
  });

  it("semana que cruza fin de mes (miércoles en medio)", () => {
    // 2026-06-29 es lunes, semana termina el 2026-07-05
    const r = rangoSemanal("2026-07-01"); // miércoles de esa semana
    expect(r.desde).toBe("2026-06-29");
    expect(r.hasta).toBe("2026-07-05");
  });

  it("el domingo cae en la misma semana (fin de semana)", () => {
    // 2026-06-21 es domingo
    const r = rangoSemanal("2026-06-21");
    expect(r.desde).toBe("2026-06-15");
    expect(r.hasta).toBe("2026-06-21");
  });

  it("lunes da la misma semana que su siguiente miércoles", () => {
    const rLunes = rangoSemanal("2026-06-15");
    const rMiercoles = rangoSemanal("2026-06-17");
    expect(rLunes).toEqual(rMiercoles);
  });
});

// ── rangoAnioCorrido ────────────────────────────────────────

describe("rangoAnioCorrido", () => {
  it("va desde el 1 de enero hasta la fecha dada (mid-year)", () => {
    expect(rangoAnioCorrido("2026-06-15")).toEqual<RangoFecha>({
      desde: "2026-01-01",
      hasta: "2026-06-15",
    });
  });

  it("el 1 de enero resulta en rango de un solo día", () => {
    expect(rangoAnioCorrido("2026-01-01")).toEqual<RangoFecha>({
      desde: "2026-01-01",
      hasta: "2026-01-01",
    });
  });

  it("el 31 de diciembre cubre todo el año", () => {
    expect(rangoAnioCorrido("2026-12-31")).toEqual<RangoFecha>({
      desde: "2026-01-01",
      hasta: "2026-12-31",
    });
  });
});

// ── fechaABucket ────────────────────────────────────────────

describe("fechaABucket", () => {
  it("diario: devuelve la fecha tal cual (YYYY-MM-DD)", () => {
    expect(fechaABucket("2026-06-15", "diario")).toBe("2026-06-15");
  });

  it("mensual: devuelve YYYY-MM", () => {
    expect(fechaABucket("2026-06-15", "mensual")).toBe("2026-06");
    expect(fechaABucket("2026-06-01", "mensual")).toBe("2026-06");
  });

  it("semanal: devuelve el lunes de la semana en YYYY-MM-DD", () => {
    // 2026-06-17 (miércoles) → lunes 2026-06-15
    expect(fechaABucket("2026-06-17", "semanal")).toBe("2026-06-15");
    // 2026-06-21 (domingo) → lunes 2026-06-15
    expect(fechaABucket("2026-06-21", "semanal")).toBe("2026-06-15");
  });

  it("anio_corrido: devuelve el año YYYY", () => {
    expect(fechaABucket("2026-06-15", "anio_corrido")).toBe("2026");
  });
});

// ── bucketsDeSerie ──────────────────────────────────────────

describe("bucketsDeSerie", () => {
  it("diario: genera todos los días del rango inclusive", () => {
    const r: RangoFecha = { desde: "2026-06-01", hasta: "2026-06-03" };
    const buckets = bucketsDeSerie(r, "diario");
    expect(buckets).toEqual(["2026-06-01", "2026-06-02", "2026-06-03"]);
  });

  it("mensual: genera todos los meses del rango", () => {
    const r: RangoFecha = { desde: "2026-01-01", hasta: "2026-03-31" };
    const buckets = bucketsDeSerie(r, "mensual");
    expect(buckets).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("semanal: genera los lunes de las semanas que cubren el rango", () => {
    // 2026-06-15 (lunes) al 2026-06-21 (domingo) → una sola semana
    const r: RangoFecha = { desde: "2026-06-15", hasta: "2026-06-21" };
    const buckets = bucketsDeSerie(r, "semanal");
    expect(buckets).toEqual(["2026-06-15"]);
  });

  it("semanal: dos semanas cuando el rango cruza lunes", () => {
    // 2026-06-13 (sáb) al 2026-06-22 (lun) → semanas 2026-06-08 y 2026-06-15 y 2026-06-22
    const r: RangoFecha = { desde: "2026-06-13", hasta: "2026-06-22" };
    const buckets = bucketsDeSerie(r, "semanal");
    // 13 jun → semana del 8; 14 jun → semana del 8; 15-21 → semana del 15; 22 → semana del 22
    expect(buckets.length).toBe(3);
    expect(buckets[0]).toBe("2026-06-08");
    expect(buckets[1]).toBe("2026-06-15");
    expect(buckets[2]).toBe("2026-06-22");
  });

  it("anio_corrido: un solo bucket (el año)", () => {
    const r: RangoFecha = { desde: "2026-01-01", hasta: "2026-06-15" };
    const buckets = bucketsDeSerie(r, "anio_corrido");
    expect(buckets).toEqual(["2026"]);
  });

  it("rango de un solo día con granularidad diario", () => {
    const r: RangoFecha = { desde: "2026-06-15", hasta: "2026-06-15" };
    expect(bucketsDeSerie(r, "diario")).toEqual(["2026-06-15"]);
  });
});
