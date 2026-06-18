import type { Metadata } from "next";
import { getUnidadesNegocio } from "@/lib/db/catalogos";
import { getTransaccionesRango, rowToTransaccionPnl, rowToTransaccionPnlConFecha } from "@/lib/db/reportes";
import { calcularPnl, serieDePnl } from "@/lib/finance/pnl";
import { rangoMensual, rangoAnioCorrido, type Granularidad } from "@/lib/finance/periodo";
import ReportesClient from "./reportes-client";

export const metadata: Metadata = {
  title: "Reportes P&L — eLunch Finanzas",
};

/**
 * Calcula el rango de fechas según la granularidad y el mes seleccionado.
 * Para anio_corrido: desde 1-ene del año del mes hasta el último día del mes.
 */
function calcularRango(mes: string, g: Granularidad) {
  if (g === "anio_corrido") {
    const año = mes.split("-")[0];
    const { desde } = rangoAnioCorrido(`${año}-01-01`);
    // hasta = último día del mes seleccionado
    const { hasta } = rangoMensual(mes);
    return { desde, hasta };
  }
  // Para diario, semanal y mensual: rango del mes completo
  return rangoMensual(mes);
}

export default async function ReportesPage({
  searchParams,
}: {
  // searchParams es una Promise en Next.js 15+ (AGENTS.md — breaking change)
  searchParams: Promise<{ mes?: string; g?: string }>;
}) {
  const params = await searchParams;

  // Mes actual como string "YYYY-MM"
  const hoy = new Date();
  const mesHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  const mes = params.mes ?? mesHoy;

  // Granularidad — validar contra los valores permitidos
  const GRANULARIDADES_VALIDAS: Granularidad[] = ["diario", "semanal", "mensual", "anio_corrido"];
  const granularidad: Granularidad =
    (GRANULARIDADES_VALIDAS as string[]).includes(params.g ?? "")
      ? (params.g as Granularidad)
      : "mensual";

  // Rango de fechas para la query
  const { desde, hasta } = calcularRango(mes, granularidad);

  // Fetch en paralelo
  const [unidades, rows] = await Promise.all([
    getUnidadesNegocio(),
    getTransaccionesRango(desde, hasta),
  ]);

  // Solo unidades activas para el P&L
  const unidadesActivas = unidades
    .filter((u) => u.estado === "activa")
    .map((u) => ({ id: u.id, nombre: u.nombre }));

  // Calcular en el servidor — la pantalla no hace aritmética financiera
  const transacciones = rows.map(rowToTransaccionPnl);
  const transaccionesConFecha = rows.map(rowToTransaccionPnlConFecha);

  const estado = calcularPnl(transacciones, unidadesActivas);
  const serie = serieDePnl(transaccionesConFecha, { desde, hasta }, granularidad);

  return (
    <ReportesClient
      key={`${mes}-${granularidad}`}
      mes={mes}
      mesHoy={mesHoy}
      granularidad={granularidad}
      estado={estado}
      serie={serie}
    />
  );
}
