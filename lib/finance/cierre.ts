/**
 * Lógica financiera del Cierre Diario.
 * Todas las funciones son puras (sin I/O) y cubiertas por tests.
 * Dinero siempre en centavos (integer) — NUNCA float.
 */

export interface FormaPagoMeta {
  afecta_cash: boolean | null;
  genera_cxc_cxp: boolean;
}

export interface TransaccionParaResumen {
  monto_centavos: number;
  forma_pago: FormaPagoMeta;
  cuenta_id: string | null;
}

export interface ResumenDia {
  totalVentasCash: number;      // ventas con afecta_cash=true
  totalVentasCredito: number;   // ventas con genera_cxc_cxp=true
  totalSalidasCash: number;     // salidas con afecta_cash=true
  totalSalidasCredito: number;  // salidas con genera_cxc_cxp=true
  cashNeto: number;             // totalVentasCash - totalSalidasCash
  diff: number;                 // DIFF = Cash + CXC − CXP (CLAUDE.md §6.2)
  saldosPorCuenta: Record<string, number>; // cuenta_id → movimiento neto del día
}

export function calcularResumenDia(
  ventas: TransaccionParaResumen[],
  salidas: TransaccionParaResumen[]
): ResumenDia {
  const totalVentasCash = ventas
    .filter(v => v.forma_pago.afecta_cash === true)
    .reduce((sum, v) => sum + v.monto_centavos, 0);

  const totalVentasCredito = ventas
    .filter(v => v.forma_pago.genera_cxc_cxp === true)
    .reduce((sum, v) => sum + v.monto_centavos, 0);

  const totalSalidasCash = salidas
    .filter(s => s.forma_pago.afecta_cash === true)
    .reduce((sum, s) => sum + s.monto_centavos, 0);

  const totalSalidasCredito = salidas
    .filter(s => s.forma_pago.genera_cxc_cxp === true)
    .reduce((sum, s) => sum + s.monto_centavos, 0);

  const cashNeto = totalVentasCash - totalSalidasCash;
  // DIFF = Cash Neto + CXC pendiente − CXP pendiente
  const diff = cashNeto + totalVentasCredito - totalSalidasCredito;

  // Saldo neto por cuenta (solo movimientos que afectan cash)
  const saldosPorCuenta: Record<string, number> = {};
  ventas.forEach(v => {
    if (v.cuenta_id && v.forma_pago.afecta_cash === true) {
      saldosPorCuenta[v.cuenta_id] = (saldosPorCuenta[v.cuenta_id] ?? 0) + v.monto_centavos;
    }
  });
  salidas.forEach(s => {
    if (s.cuenta_id && s.forma_pago.afecta_cash === true) {
      saldosPorCuenta[s.cuenta_id] = (saldosPorCuenta[s.cuenta_id] ?? 0) - s.monto_centavos;
    }
  });

  return {
    totalVentasCash,
    totalVentasCredito,
    totalSalidasCash,
    totalSalidasCredito,
    cashNeto,
    diff,
    saldosPorCuenta,
  };
}

/** Formatea centavos a string USD. Solo para presentación, nunca para cálculos. */
export function formatUSD(centavos: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(centavos / 100);
}

/** Convierte un string de monto (e.g. "25.50") a centavos enteros. */
export function parseCentavos(input: string): number {
  const n = parseFloat(input.replace(/,/g, "").trim());
  if (isNaN(n) || n <= 0) return 0;
  return Math.round(n * 100);
}
