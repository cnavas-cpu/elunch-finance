/**
 * Tests para lib/finance/flujo.ts — Flujo de Caja (Sprint 7)
 * TDD: tests escritos ANTES de la implementación.
 * Dinero siempre en centavos enteros.
 */
import { describe, it, expect } from "vitest";
import {
  calcularFlujoReal,
  calcularFlujoDevengado,
  calcularFlujoPeriodo,
  serieFlujo,
  evaluarSemaforo,
  proyeccionLiquidez,
  type MovimientoFlujo,
  type PagoFlujo,
  type CxItem,
} from "./flujo";

// ── Fixtures ────────────────────────────────────────────────────────
/** Venta cobrada en efectivo */
const ventaCash = (monto: number, fecha = "2026-06-01"): MovimientoFlujo => ({
  fecha,
  tipo: "venta",
  monto_centavos: monto,
  afecta_cash: true,
});
/** Venta a crédito (genera CXC; NO cash directo) */
const ventaCredito = (monto: number, fecha = "2026-06-01"): MovimientoFlujo => ({
  fecha,
  tipo: "venta",
  monto_centavos: monto,
  afecta_cash: false,
});
/** Venta con forma de pago sin clasificar (afecta_cash null) */
const ventaSinClasificar = (monto: number, fecha = "2026-06-01"): MovimientoFlujo => ({
  fecha,
  tipo: "venta",
  monto_centavos: monto,
  afecta_cash: null,
});
/** Salida pagada en cash */
const salidaCash = (monto: number, fecha = "2026-06-01"): MovimientoFlujo => ({
  fecha,
  tipo: "salida",
  monto_centavos: monto,
  afecta_cash: true,
});
/** Salida a crédito (genera CXP; NO cash directo) */
const salidaCredito = (monto: number, fecha = "2026-06-01"): MovimientoFlujo => ({
  fecha,
  tipo: "salida",
  monto_centavos: monto,
  afecta_cash: false,
});
/** Cobro de CXC (entrada real de cash) */
const cobroCxc = (monto: number, fecha = "2026-06-10"): PagoFlujo => ({
  fecha,
  monto_centavos: monto,
  es_cobro: true,
});
/** Pago de CXP (salida real de cash) */
const pagoCxp = (monto: number, fecha = "2026-06-10"): PagoFlujo => ({
  fecha,
  monto_centavos: monto,
  es_cobro: false,
});

// ── calcularFlujoReal ────────────────────────────────────────────────
describe("calcularFlujoReal", () => {
  it("vacío devuelve ceros", () => {
    const r = calcularFlujoReal([], []);
    expect(r.entradas_centavos).toBe(0);
    expect(r.salidas_centavos).toBe(0);
    expect(r.neto_centavos).toBe(0);
  });

  it("ventas cash son entradas reales", () => {
    const r = calcularFlujoReal([ventaCash(10000), ventaCash(5000)], []);
    expect(r.entradas_centavos).toBe(15000);
    expect(r.salidas_centavos).toBe(0);
    expect(r.neto_centavos).toBe(15000);
  });

  it("salidas cash son salidas reales", () => {
    const r = calcularFlujoReal([], [salidaCash(3000), salidaCash(2000)]);
    expect(r.entradas_centavos).toBe(0);
    expect(r.salidas_centavos).toBe(5000);
    expect(r.neto_centavos).toBe(-5000);
  });

  it("cobros de CXC son entradas reales", () => {
    const r = calcularFlujoReal([], [cobroCxc(8000)]);
    expect(r.entradas_centavos).toBe(8000);
    expect(r.salidas_centavos).toBe(0);
  });

  it("pagos de CXP son salidas reales", () => {
    const r = calcularFlujoReal([], [pagoCxp(4000)]);
    expect(r.entradas_centavos).toBe(0);
    expect(r.salidas_centavos).toBe(4000);
  });

  it("venta a crédito (afecta_cash=false) NO entra al flujo real — entra solo vía pago cobro", () => {
    const r = calcularFlujoReal([ventaCredito(20000)], []);
    expect(r.entradas_centavos).toBe(0); // cero, no doble conteo
    expect(r.neto_centavos).toBe(0);
  });

  it("salida a crédito (afecta_cash=false) NO sale del flujo real", () => {
    const r = calcularFlujoReal([salidaCredito(10000)], []);
    expect(r.salidas_centavos).toBe(0);
  });

  it("afecta_cash=null no cuenta como cash (FP-07 Cheque sin clasificar)", () => {
    const r = calcularFlujoReal([ventaSinClasificar(5000)], []);
    expect(r.entradas_centavos).toBe(0);
  });

  it("caso mixto: cash directo + cobro CXC − salida cash − pago CXP", () => {
    // Ventas: $100 cash + $200 crédito (no entra al real)
    // Cobros: $150 de CXC
    // Salidas: $40 cash
    // Pagos CXP: $60
    const movs: MovimientoFlujo[] = [ventaCash(10000), ventaCredito(20000)];
    const pagos: PagoFlujo[]      = [cobroCxc(15000), pagoCxp(6000)];
    const salidaMovs: MovimientoFlujo[] = [salidaCash(4000)];
    const r = calcularFlujoReal([...movs, ...salidaMovs], pagos);
    // Entradas: 10000 (cash) + 15000 (cobro) = 25000
    // Salidas:  4000 (cash) + 6000 (pago CXP) = 10000
    expect(r.entradas_centavos).toBe(25000);
    expect(r.salidas_centavos).toBe(10000);
    expect(r.neto_centavos).toBe(15000);
  });
});

// ── calcularFlujoDevengado ───────────────────────────────────────────
describe("calcularFlujoDevengado", () => {
  it("vacío devuelve ceros", () => {
    const r = calcularFlujoDevengado([]);
    expect(r.entradas_centavos).toBe(0);
    expect(r.salidas_centavos).toBe(0);
    expect(r.neto_centavos).toBe(0);
  });

  it("suma TODAS las ventas sin importar forma de pago", () => {
    const r = calcularFlujoDevengado([ventaCash(10000), ventaCredito(20000), ventaSinClasificar(5000)]);
    expect(r.entradas_centavos).toBe(35000); // todas
  });

  it("suma TODAS las salidas sin importar forma de pago", () => {
    const r = calcularFlujoDevengado([salidaCash(4000), salidaCredito(8000)]);
    expect(r.salidas_centavos).toBe(12000);
  });

  it("los pagos (PagoFlujo) se ignoran — son liquidaciones de lo devengado", () => {
    // El devengado no recibe pagos; esta función solo recibe MovimientoFlujo[]
    const r = calcularFlujoDevengado([ventaCash(10000)]);
    expect(r.entradas_centavos).toBe(10000); // solo el devengado
  });

  it("neto = ingresos devengados − salidas devengadas", () => {
    const r = calcularFlujoDevengado([
      ventaCash(15000), ventaCredito(10000), salidaCash(5000), salidaCredito(3000),
    ]);
    // entradas: 25000, salidas: 8000, neto: 17000
    expect(r.entradas_centavos).toBe(25000);
    expect(r.salidas_centavos).toBe(8000);
    expect(r.neto_centavos).toBe(17000);
  });
});

// ── calcularFlujoPeriodo ─────────────────────────────────────────────
describe("calcularFlujoPeriodo", () => {
  it("diferencia = devengado.neto − real.neto (el papel no convertido en cash)", () => {
    // Venta $200 crédito (devengado pero no cobrado), cobrado $0
    // Salida $30 cash
    const movs: MovimientoFlujo[] = [ventaCredito(20000), salidaCash(3000)];
    const pagos: PagoFlujo[] = [];
    const r = calcularFlujoPeriodo(movs, pagos);
    // Real: entradas=0, salidas=3000, neto=-3000
    // Devengado: entradas=20000, salidas=3000, neto=17000
    // Diferencia: 17000 − (-3000) = 20000 (el crédito no cobrado)
    expect(r.real.neto_centavos).toBe(-3000);
    expect(r.devengado.neto_centavos).toBe(17000);
    expect(r.diferencia_centavos).toBe(20000);
  });

  it("vacío: todo ceros y diferencia cero", () => {
    const r = calcularFlujoPeriodo([], []);
    expect(r.real.neto_centavos).toBe(0);
    expect(r.devengado.neto_centavos).toBe(0);
    expect(r.diferencia_centavos).toBe(0);
  });

  it("cuando todo es cash, diferencia ≈ 0 (salvo los pagos de CXC/CXP que no son movimientos devengados)", () => {
    // Todo en cash: devengado.neto ≈ real.neto
    const movs: MovimientoFlujo[] = [ventaCash(10000), salidaCash(4000)];
    const pagos: PagoFlujo[] = [];
    const r = calcularFlujoPeriodo(movs, pagos);
    expect(r.diferencia_centavos).toBe(0); // ambos = 6000 - 6000
  });
});

// ── serieFlujo ───────────────────────────────────────────────────────
describe("serieFlujo", () => {
  const rango = { desde: "2026-06-01", hasta: "2026-06-03" };

  it("sin movimientos devuelve todos los buckets en 0", () => {
    const s = serieFlujo([], [], rango, "diario");
    expect(s).toHaveLength(3);
    expect(s[0].bucket).toBe("2026-06-01");
    expect(s[0].realNeto).toBe(0);
    expect(s[0].devengadoNeto).toBe(0);
  });

  it("reparte movimientos en el bucket correcto (diario)", () => {
    const movs: MovimientoFlujo[] = [
      ventaCash(5000, "2026-06-01"),
      salidaCash(2000, "2026-06-02"),
    ];
    const s = serieFlujo(movs, [], rango, "diario");
    const d01 = s.find(b => b.bucket === "2026-06-01")!;
    const d02 = s.find(b => b.bucket === "2026-06-02")!;
    const d03 = s.find(b => b.bucket === "2026-06-03")!;
    expect(d01.realNeto).toBe(5000);
    expect(d01.devengadoNeto).toBe(5000);
    expect(d02.realNeto).toBe(-2000);
    expect(d02.devengadoNeto).toBe(-2000);
    expect(d03.realNeto).toBe(0);
    expect(d03.devengadoNeto).toBe(0);
  });

  it("crédito aparece en devengadoNeto pero NO en realNeto", () => {
    const movs: MovimientoFlujo[] = [ventaCredito(10000, "2026-06-01")];
    const s = serieFlujo(movs, [], rango, "diario");
    const d01 = s.find(b => b.bucket === "2026-06-01")!;
    expect(d01.realNeto).toBe(0);
    expect(d01.devengadoNeto).toBe(10000);
  });

  it("cobro de CXC en la fecha correcta aparece en realNeto", () => {
    const pagos: PagoFlujo[] = [cobroCxc(7000, "2026-06-02")];
    const s = serieFlujo([], pagos, rango, "diario");
    const d02 = s.find(b => b.bucket === "2026-06-02")!;
    expect(d02.realNeto).toBe(7000);
    expect(d02.devengadoNeto).toBe(0); // pagos no son devengados
  });

  it("granularidad mensual agrupa en un solo bucket", () => {
    const rangoMes = { desde: "2026-06-01", hasta: "2026-06-30" };
    const movs: MovimientoFlujo[] = [
      ventaCash(10000, "2026-06-01"),
      ventaCash(20000, "2026-06-15"),
      salidaCash(5000,  "2026-06-30"),
    ];
    const s = serieFlujo(movs, [], rangoMes, "mensual");
    expect(s).toHaveLength(1);
    expect(s[0].realNeto).toBe(25000); // 10000 + 20000 − 5000
    expect(s[0].devengadoNeto).toBe(25000);
  });
});

// ── evaluarSemaforo ──────────────────────────────────────────────────
describe("evaluarSemaforo", () => {
  it("rojo si saldo proyectado < 0", () => {
    expect(evaluarSemaforo(-1, 0)).toBe("rojo");
    expect(evaluarSemaforo(-10000, 5000)).toBe("rojo");
  });

  it("ámbar si saldo >= 0 pero < colchón", () => {
    expect(evaluarSemaforo(0, 50000)).toBe("ambar");   // justo en 0, colchón 500
    expect(evaluarSemaforo(49999, 50000)).toBe("ambar");
  });

  it("verde si saldo >= colchón", () => {
    expect(evaluarSemaforo(50000, 50000)).toBe("verde");
    expect(evaluarSemaforo(60000, 50000)).toBe("verde");
  });

  it("verde si saldo=0 y colchón=0", () => {
    expect(evaluarSemaforo(0, 0)).toBe("verde"); // 0 >= 0
  });
});

// ── proyeccionLiquidez ───────────────────────────────────────────────
describe("proyeccionLiquidez", () => {
  // hoy = 2026-06-18 (fecha fija para tests reproducibles)
  const HOY = "2026-06-18";

  // CXC helper
  const cxcItem = (saldo: number, diasDesdeHoy: number | null, confirmado = false): CxItem => ({
    saldo_centavos: saldo,
    fecha: diasDesdeHoy !== null
      ? (() => {
          const d = new Date("2026-06-18T00:00:00");
          d.setDate(d.getDate() + diasDesdeHoy);
          return d.toISOString().slice(0, 10);
        })()
      : null,
    confirmado,
  });
  // CXP helper (misma estructura que CxItem pero es salida)
  const cxpItem = (saldo: number, diasDesdeHoy: number | null, confirmado = false): CxItem => ({
    saldo_centavos: saldo,
    fecha: diasDesdeHoy !== null
      ? (() => {
          const d = new Date("2026-06-18T00:00:00");
          d.setDate(d.getDate() + diasDesdeHoy);
          return d.toISOString().slice(0, 10);
        })()
      : null,
    confirmado,
  });

  it("vacío devuelve todos los tramos en ceros y semáforo verde", () => {
    const p = proyeccionLiquidez([], [], HOY, 0);
    expect(p.tramos).toHaveLength(3);
    expect(p.tramos[0].horizonte).toBe(30);
    expect(p.tramos[1].horizonte).toBe(60);
    expect(p.tramos[2].horizonte).toBe(90);
    for (const t of p.tramos) {
      expect(t.acumuladoTotal_centavos).toBe(0);
      expect(t.semaforo).toBe("verde");
    }
    expect(p.cxcSinFecha_centavos).toBe(0);
    expect(p.cxpSinFecha_centavos).toBe(0);
  });

  it("CXC a 20 días entra en los tres tramos (30, 60 y 90)", () => {
    const p = proyeccionLiquidez([cxcItem(10000, 20)], [], HOY, 0);
    expect(p.tramos[0].entradasEstimadas_centavos).toBe(10000); // tramo 30
    expect(p.tramos[1].entradasEstimadas_centavos).toBe(10000); // tramo 60
    expect(p.tramos[2].entradasEstimadas_centavos).toBe(10000); // tramo 90
  });

  it("CXC a 45 días entra en 60 y 90 pero NO en 30", () => {
    const p = proyeccionLiquidez([cxcItem(8000, 45)], [], HOY, 0);
    expect(p.tramos[0].entradasEstimadas_centavos).toBe(0);    // NO en 30
    expect(p.tramos[1].entradasEstimadas_centavos).toBe(8000); // sí en 60
    expect(p.tramos[2].entradasEstimadas_centavos).toBe(8000); // sí en 90
  });

  it("CXC a 80 días solo entra en el tramo 90", () => {
    const p = proyeccionLiquidez([cxcItem(5000, 80)], [], HOY, 0);
    expect(p.tramos[0].entradasEstimadas_centavos).toBe(0);
    expect(p.tramos[1].entradasEstimadas_centavos).toBe(0);
    expect(p.tramos[2].entradasEstimadas_centavos).toBe(5000);
  });

  it("vencido (fecha < hoy, diasDesdeHoy negativo) entra en los TRES tramos", () => {
    const p = proyeccionLiquidez([cxcItem(12000, -5)], [], HOY, 0);
    expect(p.tramos[0].entradasEstimadas_centavos).toBe(12000);
    expect(p.tramos[1].entradasEstimadas_centavos).toBe(12000);
    expect(p.tramos[2].entradasEstimadas_centavos).toBe(12000);
  });

  it("confirmado=true va a entradasConfirmadas, no a estimadas", () => {
    const p = proyeccionLiquidez([cxcItem(9000, 15, true)], [], HOY, 0);
    expect(p.tramos[0].entradasConfirmadas_centavos).toBe(9000);
    expect(p.tramos[0].entradasEstimadas_centavos).toBe(0);
  });

  it("CXP a 10 días suma a salidas del tramo 30/60/90", () => {
    const p = proyeccionLiquidez([], [cxpItem(6000, 10)], HOY, 0);
    expect(p.tramos[0].salidasEstimadas_centavos).toBe(6000);
    expect(p.tramos[1].salidasEstimadas_centavos).toBe(6000);
    expect(p.tramos[2].salidasEstimadas_centavos).toBe(6000);
  });

  it("sin fecha → va a cxcSinFecha y NO a ningún tramo", () => {
    const p = proyeccionLiquidez([cxcItem(7000, null)], [], HOY, 0);
    expect(p.cxcSinFecha_centavos).toBe(7000);
    for (const t of p.tramos) {
      expect(t.entradasConfirmadas_centavos).toBe(0);
      expect(t.entradasEstimadas_centavos).toBe(0);
    }
  });

  it("cxpSinFecha suma CXP con fecha=null", () => {
    const p = proyeccionLiquidez([], [cxpItem(3000, null)], HOY, 0);
    expect(p.cxpSinFecha_centavos).toBe(3000);
  });

  it("semáforo rojo si acumuladoTotal < 0", () => {
    // CXC $10 a 5 días, CXP $20 a 5 días → acumulado 30d = -10
    const p = proyeccionLiquidez([cxcItem(1000, 5)], [cxpItem(2000, 5)], HOY, 0);
    expect(p.tramos[0].acumuladoTotal_centavos).toBe(-1000);
    expect(p.tramos[0].semaforo).toBe("rojo");
  });

  it("semáforo ámbar si acumulado >= 0 pero < colchón", () => {
    const p = proyeccionLiquidez([cxcItem(5000, 10)], [], HOY, 10000);
    // acumulado 30d = 5000, colchón = 10000 → ámbar
    expect(p.tramos[0].semaforo).toBe("ambar");
  });

  it("semáforo verde si acumulado >= colchón", () => {
    const p = proyeccionLiquidez([cxcItem(15000, 10)], [], HOY, 10000);
    expect(p.tramos[0].semaforo).toBe("verde");
  });

  it("acumuladoConfirmado usa solo items confirmados", () => {
    const p = proyeccionLiquidez(
      [cxcItem(8000, 10, true), cxcItem(5000, 10, false)],
      [],
      HOY,
      0
    );
    expect(p.tramos[0].entradasConfirmadas_centavos).toBe(8000);
    expect(p.tramos[0].entradasEstimadas_centavos).toBe(5000);
    expect(p.tramos[0].acumuladoConfirmado_centavos).toBe(8000); // solo confirmado
    expect(p.tramos[0].acumuladoTotal_centavos).toBe(13000);     // conf + est
  });
});
