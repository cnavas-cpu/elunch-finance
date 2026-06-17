import { describe, it, expect } from "vitest";
import { calcularResumenDia, formatUSD, parseCentavos } from "./cierre";

const CASH      = { afecta_cash: true,  genera_cxc_cxp: false };
const CXC       = { afecta_cash: false, genera_cxc_cxp: true  };
const CXP       = { afecta_cash: false, genera_cxc_cxp: true  };
const TARJ_BAC  = { afecta_cash: false, genera_cxc_cxp: false };
const CHEQUE    = { afecta_cash: null,  genera_cxc_cxp: false };

describe("calcularResumenDia", () => {
  it("día vacío devuelve ceros", () => {
    const r = calcularResumenDia([], []);
    expect(r.totalVentasCash).toBe(0);
    expect(r.totalVentasCredito).toBe(0);
    expect(r.totalSalidasCash).toBe(0);
    expect(r.totalSalidasCredito).toBe(0);
    expect(r.cashNeto).toBe(0);
    expect(r.diff).toBe(0);
    expect(r.saldosPorCuenta).toEqual({});
  });

  it("ventas solo en cash suman correctamente", () => {
    const ventas = [
      { monto_centavos: 10000, forma_pago: CASH, cuenta_id: "CB-01" },
      { monto_centavos:  5000, forma_pago: CASH, cuenta_id: "CB-01" },
    ];
    const r = calcularResumenDia(ventas, []);
    expect(r.totalVentasCash).toBe(15000);
    expect(r.totalVentasCredito).toBe(0);
    expect(r.diff).toBe(15000);
  });

  it("DIFF = Cash + CXC − CXP (CLAUDE.md §6.2)", () => {
    const ventas = [
      { monto_centavos: 10000, forma_pago: CASH, cuenta_id: "CB-01" },
      { monto_centavos: 20000, forma_pago: CXC,  cuenta_id: null     },
    ];
    const salidas = [
      { monto_centavos:  5000, forma_pago: CASH, cuenta_id: "CB-01" },
      { monto_centavos:  8000, forma_pago: CXP,  cuenta_id: null     },
    ];
    const r = calcularResumenDia(ventas, salidas);
    expect(r.cashNeto).toBe(5000);          // 10000 − 5000
    expect(r.totalVentasCredito).toBe(20000);
    expect(r.totalSalidasCredito).toBe(8000);
    expect(r.diff).toBe(17000);             // 5000 + 20000 − 8000
  });

  it("saldosPorCuenta acumula solo movimientos de cash", () => {
    const ventas = [
      { monto_centavos: 10000, forma_pago: CASH, cuenta_id: "CB-01" },
      { monto_centavos:  5000, forma_pago: CASH, cuenta_id: "CB-02" },
      { monto_centavos: 20000, forma_pago: CXC,  cuenta_id: null     },
    ];
    const salidas = [
      { monto_centavos: 3000, forma_pago: CASH, cuenta_id: "CB-01" },
    ];
    const r = calcularResumenDia(ventas, salidas);
    expect(r.saldosPorCuenta["CB-01"]).toBe(7000); // +10000 − 3000
    expect(r.saldosPorCuenta["CB-02"]).toBe(5000); // +5000
    expect("null" in r.saldosPorCuenta).toBe(false);
  });

  it("CXC sin cuenta no aparece en saldosPorCuenta", () => {
    const ventas = [{ monto_centavos: 20000, forma_pago: CXC, cuenta_id: null }];
    const r = calcularResumenDia(ventas, []);
    expect(Object.keys(r.saldosPorCuenta)).toHaveLength(0);
  });

  it("cheque con afecta_cash=null no altera saldosPorCuenta", () => {
    const ventas = [{ monto_centavos: 5000, forma_pago: CHEQUE, cuenta_id: "CB-07" }];
    const r = calcularResumenDia(ventas, []);
    expect(Object.keys(r.saldosPorCuenta)).toHaveLength(0);
  });

  it("tarjeta BAC (egreso sin cash) no altera saldosPorCuenta", () => {
    const salidas = [{ monto_centavos: 3000, forma_pago: TARJ_BAC, cuenta_id: "CB-06" }];
    const r = calcularResumenDia([], salidas);
    expect(Object.keys(r.saldosPorCuenta)).toHaveLength(0);
    expect(r.totalSalidasCash).toBe(0);
    expect(r.totalSalidasCredito).toBe(0);
    expect(r.diff).toBe(0);
  });
});

describe("formatUSD", () => {
  it("cero → $0.00", () => expect(formatUSD(0)).toBe("$0.00"));
  it("100 centavos → $1.00", () => expect(formatUSD(100)).toBe("$1.00"));
  it("123456 centavos → $1,234.56", () => expect(formatUSD(123456)).toBe("$1,234.56"));
  it("negativo → -$5.00", () => expect(formatUSD(-500)).toBe("-$5.00"));
});

describe("parseCentavos", () => {
  it("'25.50' → 2550", () => expect(parseCentavos("25.50")).toBe(2550));
  it("'100' → 10000", () => expect(parseCentavos("100")).toBe(10000));
  it("'0' → 0", () => expect(parseCentavos("0")).toBe(0));
  it("string vacío → 0", () => expect(parseCentavos("")).toBe(0));
  it("texto inválido → 0", () => expect(parseCentavos("abc")).toBe(0));
  it("coma de miles '1,500.00' → 150000", () => expect(parseCentavos("1,500.00")).toBe(150000));
});
