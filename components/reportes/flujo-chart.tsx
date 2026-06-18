"use client";
/**
 * Gráfico de flujo de caja: barra real + línea devengado por periodo.
 * Cliente puro — los imports de recharts viven aquí para el lazy-load
 * desde flujo-client.tsx con next/dynamic { ssr: false }.
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
import type { PuntoFlujo } from "@/lib/finance/flujo";
import type { Granularidad } from "@/lib/finance/periodo";

interface FlujoChartProps {
  serie: PuntoFlujo[];
  granularidad: Granularidad;
}

// Colores de marca
const COLOR_REAL      = "#074230"; // brand-forest (barra, cash real)
const COLOR_DEVENGADO = "#ffaa00"; // brand-amber (línea, devengado)
const COLOR_CERO      = "#e5e7eb"; // borde gris para ReferenceLine

/** Etiqueta del eje X según granularidad (copiado del patrón de pnl-chart) */
function formatBucket(bucket: string, g: Granularidad): string {
  if (g === "diario") {
    const [, mes, dia] = bucket.split("-");
    const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    return `${parseInt(dia)} ${meses[parseInt(mes) - 1]}`;
  }
  if (g === "semanal") {
    const [, mes, dia] = bucket.split("-");
    return `sem ${parseInt(dia)}/${parseInt(mes)}`;
  }
  if (g === "mensual") {
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
    <div className="bg-white border border-border rounded-lg p-3 shadow-md text-xs min-w-[180px]">
      <p className="font-medium text-text-main mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4 mb-1">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className={[
            "font-medium tabular-nums",
            p.value < 0 ? "text-status-danger" : "text-text-main",
          ].join(" ")}>
            {formatUSD(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function FlujoChart({ serie, granularidad }: FlujoChartProps) {
  if (!serie.length) return null;

  const data = serie.map((p) => ({
    bucket:     formatBucket(p.bucket, granularidad),
    "Flujo real":      p.realNeto,
    "Devengado": p.devengadoNeto,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--color-border, #e5e7eb)"
          vertical={false}
        />
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
          width={72}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="square"
          iconSize={10}
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
        />
        {/* Línea en cero siempre visible — el neto puede ser negativo */}
        <ReferenceLine y={0} stroke={COLOR_CERO} strokeWidth={1.5} />
        <Bar
          dataKey="Flujo real"
          fill={COLOR_REAL}
          radius={[3, 3, 0, 0]}
          maxBarSize={40}
        />
        <Line
          type="monotone"
          dataKey="Devengado"
          stroke={COLOR_DEVENGADO}
          strokeWidth={2}
          dot={{ r: 3, fill: COLOR_DEVENGADO }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Skeleton simple mientras carga el chart */
export function ChartSkeleton() {
  return (
    <div className="h-[280px] rounded-xl bg-surface-muted animate-pulse flex items-end gap-2 px-6 pb-8 pt-8">
      {[55, 80, 45, 70, 60, 85, 50].map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm bg-border"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}
