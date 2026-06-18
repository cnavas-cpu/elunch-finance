import type { Metadata } from "next";
import { format } from "date-fns";
import { getCuentasPorCobrar } from "@/lib/db/cxc";
import { getCuentasPorPagar } from "@/lib/db/cxp";
import { getFlujoRango, rowToMovimientoFlujo, rowToPagoFlujo } from "@/lib/db/flujo";
import {
  calcularFlujoPeriodo,
  serieFlujo,
  proyeccionLiquidez,
  type CxItem,
} from "@/lib/finance/flujo";
import { calcularSaldo as calcularSaldoCxc } from "@/lib/finance/cxc";
import { calcularSaldo as calcularSaldoCxp } from "@/lib/finance/cxp";
import { rangoMensual, rangoAnioCorrido, type Granularidad } from "@/lib/finance/periodo";
import FlujoClient from "./flujo-client";

export const metadata: Metadata = {
  title: "Flujo de Caja — eLunch Finanzas",
};

/** Valida y parsea el horizonte en días (30, 60 o 90). */
function parsearHorizonte(raw: string | undefined): 30 | 60 | 90 {
  const n = parseInt(raw ?? "30", 10);
  if (n === 60 || n === 90) return n;
  return 30;
}

/** Valida y parsea el colchón mínimo en centavos. */
function parsearColchon(raw: string | undefined): number {
  const n = parseFloat(raw ?? "0");
  if (isNaN(n) || n < 0) return 0;
  return Math.round(n * 100); // el input llega en USD, guardamos en centavos
}

/** Calcula el rango de fechas para las queries (igual que en reportes/page.tsx). */
function calcularRango(mes: string, g: Granularidad) {
  if (g === "anio_corrido") {
    const año = mes.split("-")[0];
    const { desde } = rangoAnioCorrido(`${año}-01-01`);
    const { hasta } = rangoMensual(mes);
    return { desde, hasta };
  }
  return rangoMensual(mes);
}

// Estados terminales que excluimos de la proyección
const ESTADOS_TERMINAL_CXC = new Set(["Pagada", "Incobrable"]);
const ESTADOS_TERMINAL_CXP = new Set(["Pagada"]);

export default async function FlujoPage({
  searchParams,
}: {
  // searchParams es una Promise en Next.js 15+ (AGENTS.md — breaking change)
  searchParams: Promise<{ mes?: string; g?: string; h?: string; colchon?: string }>;
}) {
  const params = await searchParams;

  // Fecha de hoy como string
  const hoy = format(new Date(), "yyyy-MM-dd");
  const mesHoy = hoy.slice(0, 7); // "YYYY-MM"
  const mes = params.mes ?? mesHoy;

  // Granularidad
  const GRANULARIDADES_VALIDAS: Granularidad[] = ["diario", "semanal", "mensual", "anio_corrido"];
  const granularidad: Granularidad =
    (GRANULARIDADES_VALIDAS as string[]).includes(params.g ?? "")
      ? (params.g as Granularidad)
      : "mensual";

  // Horizonte de proyección y colchón
  const horizonte = parsearHorizonte(params.h);
  const colchon   = parsearColchon(params.colchon);

  // Rango histórico
  const { desde, hasta } = calcularRango(mes, granularidad);

  // Fetch en paralelo: transacciones/pagos del rango + CXC + CXP
  const [{ transacciones: txRows, pagos: pagoRows }, cxcRows, cxpRows] = await Promise.all([
    getFlujoRango(desde, hasta),
    getCuentasPorCobrar(),
    getCuentasPorPagar(),
  ]);

  // Mapear rows a tipos puros
  const movs  = txRows.map(rowToMovimientoFlujo);
  const pagos = pagoRows.map(rowToPagoFlujo);

  // Construir CxItem[] para la proyección — solo pendientes con saldo > 0
  const cxcItems: CxItem[] = cxcRows
    .filter(c => !ESTADOS_TERMINAL_CXC.has(c.estado))
    .map(c => {
      const saldo = calcularSaldoCxc(c.monto_centavos, c.pagos);
      return {
        saldo_centavos: saldo,
        fecha: c.fecha_esperada,
        confirmado: c.estado === "Programada Pago",
      };
    })
    .filter(c => c.saldo_centavos > 0);

  const cxpItems: CxItem[] = cxpRows
    .filter(c => !ESTADOS_TERMINAL_CXP.has(c.estado))
    .map(c => {
      const saldo = calcularSaldoCxp(c.monto_centavos, c.pagos);
      return {
        saldo_centavos: saldo,
        fecha: c.fecha_vencimiento,
        confirmado: c.estado === "Programada" || c.estado === "Vencida",
      };
    })
    .filter(c => c.saldo_centavos > 0);

  // Calcular EN EL SERVIDOR — la pantalla nunca hace aritmética financiera
  const flujo     = calcularFlujoPeriodo(movs, pagos);
  const serie     = serieFlujo(movs, pagos, { desde, hasta }, granularidad);
  const proyeccion = proyeccionLiquidez(cxcItems, cxpItems, hoy, colchon);

  return (
    <FlujoClient
      key={`${mes}-${granularidad}-${horizonte}-${colchon}`}
      mes={mes}
      mesHoy={mesHoy}
      granularidad={granularidad}
      horizonte={horizonte}
      colchon={colchon}
      flujo={flujo}
      serie={serie}
      proyeccion={proyeccion}
    />
  );
}
