"use client";
/**
 * Gráfico de barras + línea de utilidad para el Estado de Resultados.
 * Cliente puro — los imports de recharts viven aquí para el lazy-load
 * desde reportes-client.tsx con next/dynamic { ssr: false }.
 */
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatUSD } from "@/lib/finance/cierre";
import type { PuntoSerie } from "@/lib/finance/pnl";
import type { Granularidad } from "@/lib/finance/periodo";

interface PnlChartProps {
  serie: PuntoSerie[];
  granularidad: Granularidad;
}

// Colores de marca
const COLOR_INGRESOS = "#074230"; // brand-forest
const COLOR_COGS     = "#ffaa00"; // brand-amber
const COLOR_GASTOS   = "#ff673e"; // brand-coral
const COLOR_UTILIDAD = "#1f7a52"; // status-ok verde
const COLOR_PERDIDA  = "#ac2d1a"; // status-danger rojo

/** Etiqueta del eje X según granularidad */
function formatBucket(bucket: string, g: Granularidad): string {
  if (g === "diario") {
    // "2026-06-15" → "15 jun"
    const [, mes, dia] = bucket.split("-");
    const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    return `${parseInt(dia)} ${meses[parseInt(mes) - 1]}`;
  }
  if (g === "semanal") {
    // "2026-06-15" → "sem 15/6"
    const [, mes, dia] = bucket.split("-");
    return `sem ${parseInt(dia)}/${parseInt(mes)}`;
  }
  if (g === "mensual") {
    // "2026-06" → "jun 26"
    const [año, mes] = bucket.split("-");
    const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    return `${meses[parseInt(mes) - 1]} ${año.slice(2)}`;
  }
  // anio_corrido
  return bucket;
}

/** Tooltip personalizado */
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-lg p-3 shadow-md text-xs min-w-[160px]">
      <p className="font-medium text-text-main mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4 mb-1">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium tabular-nums text-text-main">
            {formatUSD(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PnlChart({ serie, granularidad }: PnlChartProps) {
  if (!serie.length) return null;

  const data = serie.map((p) => ({
    bucket: formatBucket(p.bucket, granularidad),
    Ingresos: p.ingresos,
    "Costo venta": p.cogs,
    Gastos: p.gastos,
    Utilidad: p.utilidad,
  }));

  const hayPerdida = serie.some((p) => p.utilidad < 0);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" vertical={false} />
        <XAxis
          dataKey="bucket"
          tick={{ fontSize: 11, fill: "var(--color-text-muted, #6b7280)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => formatUSD(v).replace("$", "$")}
          tick={{ fontSize: 10, fill: "var(--color-text-muted, #6b7280)" }}
          axisLine={false}
          tickLine={false}
          width={70}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="square"
          iconSize={10}
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
        />
        {/* Línea cero si hay pérdida */}
        {hayPerdida && (
          <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1.5} />
        )}
        <Bar dataKey="Ingresos" fill={COLOR_INGRESOS} radius={[3, 3, 0, 0]} maxBarSize={40} />
        <Bar dataKey="Costo venta" fill={COLOR_COGS} radius={[3, 3, 0, 0]} maxBarSize={40} />
        <Bar dataKey="Gastos" fill={COLOR_GASTOS} radius={[3, 3, 0, 0]} maxBarSize={40} />
        <Line
          type="monotone"
          dataKey="Utilidad"
          stroke={hayPerdida ? COLOR_PERDIDA : COLOR_UTILIDAD}
          strokeWidth={2}
          dot={{ r: 3, fill: hayPerdida ? COLOR_PERDIDA : COLOR_UTILIDAD }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Skeleton simple mientras carga el chart (reemplaza el spinner genérico) */
export function ChartSkeleton() {
  return (
    <div className="h-[280px] rounded-xl bg-surface-muted animate-pulse flex items-end gap-2 px-6 pb-8 pt-8">
      {[60, 90, 45, 80, 70, 55, 75].map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm bg-border"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}
