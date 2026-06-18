"use client";
/**
 * UI de Reportes P&L — Sprint 6.
 * Client Component: selector de mes + granularidad, hero, chart lazy, tablas nativas.
 */
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { formatUSD } from "@/lib/finance/cierre";
import { ChartSkeleton } from "@/components/reportes/pnl-chart";
import { TableShell, EmptyState } from "@/components/catalogo-table-shell";
import type { EstadoResultados, PuntoSerie } from "@/lib/finance/pnl";
import type { Granularidad } from "@/lib/finance/periodo";

// Recharts lazy — ssr:false SOLO en Client Components (AGENTS.md / Next.js docs)
const PnlChart = dynamic(
  () => import("@/components/reportes/pnl-chart"),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

// ── Tipos ────────────────────────────────────────────────────

interface ReportesClientProps {
  mes: string;               // "YYYY-MM"
  mesHoy: string;            // "YYYY-MM" para el default del input
  granularidad: Granularidad;
  estado: EstadoResultados | null;
  serie: PuntoSerie[];
}

const GRANULARIDADES: { value: Granularidad; label: string }[] = [
  { value: "diario",       label: "Diario" },
  { value: "semanal",      label: "Semanal" },
  { value: "mensual",      label: "Mensual" },
  { value: "anio_corrido", label: "Año corrido" },
];

// ── Íconos inline ────────────────────────────────────────────

function IconTrending({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M2 14l5-5 3 3 5-5M15 7h3v3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconBox({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M3 7l7-4 7 4M3 7v6l7 4m0-10v10M17 7v6l-7 4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconReceipt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M5 3h10a1 1 0 011 1v13l-2-1.5L12 17l-2-1.5L8 17l-2-1.5L4 17V4a1 1 0 011-1z" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 8h6M7 11h4" strokeLinecap="round"/>
    </svg>
  );
}
function IconTarget({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="10" cy="10" r="7"/>
      <circle cx="10" cy="10" r="3"/>
      <path d="M10 3v2M10 15v2M3 10h2M15 10h2" strokeLinecap="round"/>
    </svg>
  );
}
function IconWarning({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M10 2L2 17h16L10 2z" strokeLinejoin="round"/>
      <path d="M10 8v4M10 14h.01" strokeLinecap="round"/>
    </svg>
  );
}

// ── Componentes internos ──────────────────────────────────────

function ResumenCard({
  label, valor, sub, colorClass, borderClass, icon,
}: {
  label: string;
  valor: number;
  sub?: string;
  colorClass: string;
  borderClass: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={cn("bg-surface rounded-lg border p-3 sm:p-4", borderClass)}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-text-muted leading-tight">{label}</p>
        <span className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 bg-border/20">
          {icon}
        </span>
      </div>
      <p className={cn("text-lg sm:text-xl tabular-nums font-bold", colorClass)}>
        {formatUSD(valor)}
      </p>
      {sub && <p className="text-[11px] text-text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

/** Fila de la cascada P&L */
function LineaCascada({
  label, valor, indent = false, subtotal = false, total = false, info,
}: {
  label: string;
  valor: number;
  indent?: boolean;
  subtotal?: boolean;
  total?: boolean;
  info?: string;
}) {
  return (
    <tr className={cn(
      "border-b border-border/50",
      total && "border-t-2 border-brand-forest/30 bg-surface-muted",
      subtotal && "bg-surface-muted/50",
    )}>
      <td className={cn(
        "py-2 px-3 text-sm text-text-main",
        indent && "pl-8",
        total && "font-bold",
        subtotal && "font-medium",
      )}>
        {label}
        {info && <span className="ml-1.5 text-[11px] text-text-muted">({info})</span>}
      </td>
      <td className={cn(
        "py-2 px-3 text-sm text-right tabular-nums",
        total && "font-bold text-base",
        valor < 0 ? "text-status-danger" : "text-text-main",
      )}>
        {formatUSD(valor)}
      </td>
    </tr>
  );
}

// ── Componente principal ─────────────────────────────────────

export default function ReportesClient({
  mes, mesHoy, granularidad, estado, serie,
}: ReportesClientProps) {
  const router = useRouter();

  function navegar(nuevoMes: string, nuevaG: Granularidad) {
    router.push(`/reportes?mes=${nuevoMes}&g=${nuevaG}`);
  }

  const hayDatos = estado !== null && estado.ingresos_totales_centavos > 0;
  const utilidad = estado?.utilidad_neta_centavos ?? 0;
  const utilidadPositiva = utilidad >= 0;
  const cogsStr = estado && estado.ingresos_totales_centavos > 0
    ? ` (${Math.round((estado.cogs_total_centavos / estado.ingresos_totales_centavos) * 100)}%)`
    : "";

  return (
    <div className="flex flex-col min-h-0">
      {/* ── Header sticky ── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Selector de mes */}
          <div className="flex items-center gap-2">
            <label htmlFor="mes-selector" className="text-xs text-text-muted font-medium whitespace-nowrap">
              Período
            </label>
            <input
              id="mes-selector"
              type="month"
              value={mes}
              max={mesHoy}
              onChange={(e) => e.target.value && navegar(e.target.value, granularidad)}
              className="text-sm border border-border rounded-lg px-3 py-1.5 bg-surface text-text-main
                         focus:outline-none focus:ring-2 focus:ring-brand-coral/30 focus:border-brand-coral
                         min-h-[36px]"
            />
          </div>

          {/* Pills de granularidad */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {GRANULARIDADES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => navegar(mes, value)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-full transition-colors duration-150 min-h-[32px]",
                  granularidad === value
                    ? "bg-brand-cocoa text-white"
                    : "bg-surface border border-border text-text-muted hover:bg-surface-muted hover:text-text-main",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral/40"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Contenido ── */}
      <div className="px-4 sm:px-6 py-5 space-y-5">

        {/* Alerta sin clasificar */}
        {estado && estado.gasto_sin_clasificar_centavos > 0 && (
          <div className="flex items-start gap-3 p-3 rounded-lg border border-status-warn/40 bg-status-warn-bg text-status-warn text-sm">
            <IconWarning className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              <strong>{formatUSD(estado.gasto_sin_clasificar_centavos)}</strong> en salidas sin
              tipo de costo ni categoría — no se incluyen en el Estado de Resultados.
              Revisa el Cierre Diario para clasificarlas.
            </span>
          </div>
        )}

        {/* Tarjetas hero */}
        {estado && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <ResumenCard
              label="Ingresos del período"
              valor={estado.ingresos_totales_centavos}
              sub={`${estado.margenes_por_unidad.filter(m => m.ingresos_centavos > 0).length} unidad(es) con ventas`}
              colorClass="text-foreground"
              borderClass="border-border"
              icon={<IconTrending className="w-4 h-4 text-text-muted" />}
            />
            <ResumenCard
              label={`Costo de venta${cogsStr}`}
              valor={estado.cogs_total_centavos}
              sub="Mercadería directa + pool"
              colorClass="text-[#7a5100] dark:text-brand-amber"
              borderClass="border-brand-amber/30"
              icon={<IconBox className="w-4 h-4 text-[#7a5100] dark:text-brand-amber" />}
            />
            <ResumenCard
              label="Gastos operativos"
              valor={estado.gastos_operativos_centavos}
              sub="Salarios, alquiler, servicios…"
              colorClass="text-text-main"
              borderClass="border-border"
              icon={<IconReceipt className="w-4 h-4 text-text-muted" />}
            />
            <ResumenCard
              label="Utilidad Neta"
              valor={utilidad}
              sub={estado.margen_neto_pct !== null
                ? `${Math.round(estado.margen_neto_pct * 100)}% de los ingresos`
                : undefined}
              colorClass={utilidadPositiva ? "text-status-ok" : "text-status-danger"}
              borderClass={utilidadPositiva ? "border-status-ok/30" : "border-status-danger/30"}
              icon={<IconTarget className={cn("w-4 h-4", utilidadPositiva ? "text-status-ok" : "text-status-danger")} />}
            />
          </div>
        )}

        {/* Estado vacío */}
        {!hayDatos && (
          <TableShell empty={
            <EmptyState
              mensaje="Sin movimientos en este período. Registra ventas y salidas en el Cierre Diario para ver el P&L."
              accion={
                <a
                  href="/cierre"
                  className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-brand-coral text-[#1c1712] text-sm font-semibold rounded-lg hover:bg-brand-coral/90 active:bg-brand-coral/80 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-2"
                >
                  Ir al Cierre Diario
                </a>
              }
            />
          }>
            <div />
          </TableShell>
        )}

        {/* Gráfico */}
        {hayDatos && serie.length > 0 && (
          <div className="bg-surface rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold text-text-main mb-4">
              Evolución del período
            </h3>
            <PnlChart serie={serie} granularidad={granularidad} />
          </div>
        )}

        {/* Estado de Resultados — cascada */}
        {estado && hayDatos && (
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-surface-muted/40">
              <h3 className="text-sm font-semibold text-text-main">Estado de Resultados</h3>
              <p className="text-[11px] text-text-muted mt-0.5">Devengado — basado en fecha de transacción</p>
            </div>
            <table className="w-full">
              <tbody>
                <LineaCascada
                  label="Ingresos totales"
                  valor={estado.ingresos_totales_centavos}
                  subtotal
                />
                {estado.ingresos_sin_unidad_centavos > 0 && (
                  <LineaCascada
                    label="Ingresos sin unidad asignada"
                    valor={estado.ingresos_sin_unidad_centavos}
                    indent
                    info="no incluidos en márgenes de unidad"
                  />
                )}
                <LineaCascada
                  label="(–) Costos directos por unidad"
                  valor={-estado.margenes_por_unidad.reduce((s, m) => s + m.costos_directos_centavos, 0)}
                  indent
                />
                <LineaCascada
                  label="= Suma de márgenes de contribución"
                  valor={estado.suma_margenes_centavos}
                  subtotal
                />
                <LineaCascada
                  label="(–) Costos comunes (pool)"
                  valor={-estado.costos_comunes_pool_centavos}
                  indent
                  info="no prorrateados"
                />
                <LineaCascada
                  label="(–) Gastos operativos"
                  valor={-estado.gastos_operativos_centavos}
                  indent
                />
                {estado.gastos_no_operativos_centavos > 0 && (
                  <LineaCascada
                    label="(–) Gastos no operativos"
                    valor={-estado.gastos_no_operativos_centavos}
                    indent
                  />
                )}
                <LineaCascada
                  label="= Utilidad Neta"
                  valor={estado.utilidad_neta_centavos}
                  total
                />
              </tbody>
            </table>
          </div>
        )}

        {/* Margen de Contribución por unidad */}
        {estado && hayDatos && (
          <TableShell>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-muted border-b border-border text-xs text-text-muted">
                  <th className="py-2.5 px-3 text-left font-medium">Unidad</th>
                  <th className="py-2.5 px-3 text-right font-medium">Ingresos</th>
                  <th className="py-2.5 px-3 text-right font-medium hidden sm:table-cell">Costos directos</th>
                  <th className="py-2.5 px-3 text-right font-medium">Margen</th>
                  <th className="py-2.5 px-3 text-right font-medium hidden md:table-cell">Margen %</th>
                </tr>
              </thead>
              <tbody>
                {estado.margenes_por_unidad.map((m) => {
                  const pctStr = m.margen_pct !== null
                    ? `${Math.round(m.margen_pct * 100)}%`
                    : "—";
                  const margenColor = m.margen_centavos < 0
                    ? "text-status-danger"
                    : m.ingresos_centavos === 0
                      ? "text-text-muted"
                      : "text-status-ok";
                  return (
                    <tr key={m.unidad_id} className="border-b border-border/50 hover:bg-surface-muted/40">
                      <td className="py-2.5 px-3 font-medium text-text-main">{m.nombre}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-text-main">
                        {m.ingresos_centavos > 0 ? formatUSD(m.ingresos_centavos) : <span className="text-text-muted">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-text-main hidden sm:table-cell">
                        {m.costos_directos_centavos > 0 ? formatUSD(m.costos_directos_centavos) : <span className="text-text-muted">—</span>}
                      </td>
                      <td className={cn("py-2.5 px-3 text-right tabular-nums font-semibold", margenColor)}>
                        {m.ingresos_centavos > 0 ? formatUSD(m.margen_centavos) : <span className="text-text-muted">—</span>}
                      </td>
                      <td className={cn("py-2.5 px-3 text-right tabular-nums hidden md:table-cell", margenColor)}>
                        {pctStr}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {estado.margenes_por_unidad.length > 1 && (
                <tfoot>
                  <tr className="bg-surface-muted border-t-2 border-brand-forest/20 text-sm font-semibold">
                    <td className="py-2.5 px-3 text-text-main">Total</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-text-main">
                      {formatUSD(estado.ingresos_totales_centavos - estado.ingresos_sin_unidad_centavos)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-text-main hidden sm:table-cell">
                      {formatUSD(estado.margenes_por_unidad.reduce((s, m) => s + m.costos_directos_centavos, 0))}
                    </td>
                    <td className={cn("py-2.5 px-3 text-right tabular-nums", estado.suma_margenes_centavos >= 0 ? "text-status-ok" : "text-status-danger")}>
                      {formatUSD(estado.suma_margenes_centavos)}
                    </td>
                    <td className="py-2.5 px-3 hidden md:table-cell" />
                  </tr>
                </tfoot>
              )}
            </table>
          </TableShell>
        )}

        {/* Gastos por naturaleza — detalle */}
        {estado && hayDatos && estado.gastos_por_naturaleza.length > 0 && (
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-surface-muted/40">
              <h3 className="text-sm font-semibold text-text-main">Gastos por naturaleza</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-muted border-b border-border text-xs text-text-muted">
                  <th className="py-2 px-3 text-left font-medium">Naturaleza</th>
                  <th className="py-2 px-3 text-right font-medium">Monto</th>
                </tr>
              </thead>
              <tbody>
                {estado.gastos_por_naturaleza
                  .sort((a, b) => b.monto_centavos - a.monto_centavos)
                  .map(({ naturaleza, monto_centavos }) => (
                    <tr key={naturaleza} className="border-b border-border/50">
                      <td className="py-2 px-3 text-text-main">{naturaleza}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-text-main">
                        {formatUSD(monto_centavos)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
