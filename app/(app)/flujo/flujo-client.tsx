"use client";
/**
 * UI de Flujo de Caja — Sprint 7.
 * Client Component: selector de mes + granularidad, hero, chart lazy,
 * proyección de liquidez 30/60/90 con semáforo y aviso de sin-fecha.
 */
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { formatUSD } from "@/lib/finance/cierre";
import { ChartSkeleton } from "@/components/reportes/flujo-chart";
import { TableShell, EmptyState } from "@/components/catalogo-table-shell";
import type { FlujoPeriodo, PuntoFlujo, ProyeccionLiquidez, NivelLiquidez, TramoProyeccion } from "@/lib/finance/flujo";
import type { Granularidad } from "@/lib/finance/periodo";

// Recharts lazy — ssr:false SOLO en Client Components (AGENTS.md / Next.js docs)
const FlujoChart = dynamic(
  () => import("@/components/reportes/flujo-chart"),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

// ── Tipos ────────────────────────────────────────────────────────────

interface FlujoClientProps {
  mes: string;
  mesHoy: string;
  granularidad: Granularidad;
  horizonte: 30 | 60 | 90;
  colchon: number;          // en centavos
  flujo: FlujoPeriodo;
  serie: PuntoFlujo[];
  proyeccion: ProyeccionLiquidez;
}

const GRANULARIDADES: { value: Granularidad; label: string }[] = [
  { value: "diario",       label: "Diario" },
  { value: "semanal",      label: "Semanal" },
  { value: "mensual",      label: "Mensual" },
  { value: "anio_corrido", label: "Año corrido" },
];

const HORIZONTES: { value: 30 | 60 | 90; label: string }[] = [
  { value: 30, label: "30 días" },
  { value: 60, label: "60 días" },
  { value: 90, label: "90 días" },
];

// ── Colores semáforo (tokens de sistema, no colores de marca) ─────────

const SEMAFORO_STYLE: Record<NivelLiquidez, { bg: string; text: string; border: string; dot: string }> = {
  verde: {
    bg:     "bg-[#1f7a52]/10",
    text:   "text-[#1f7a52]",
    border: "border-[#1f7a52]/30",
    dot:    "bg-[#1f7a52]",
  },
  ambar: {
    bg:     "bg-[#ffaa00]/10",
    text:   "text-[#7a5100] dark:text-[#ffaa00]",
    border: "border-[#ffaa00]/30",
    dot:    "bg-[#ffaa00]",
  },
  rojo: {
    bg:     "bg-[#e5432a]/10",
    text:   "text-[#ac2d1a]",
    border: "border-[#e5432a]/30",
    dot:    "bg-[#e5432a]",
  },
};

const SEMAFORO_LABEL: Record<NivelLiquidez, string> = {
  verde: "Liquidez saludable",
  ambar: "Atención — cerca del colchón mínimo",
  rojo:  "Crítico — flujo negativo proyectado",
};

// ── Íconos inline ────────────────────────────────────────────────────

function IconCash({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x="2" y="5" width="16" height="10" rx="1.5"/>
      <circle cx="10" cy="10" r="2.5"/>
      <path d="M5 10h.01M15 10h.01" strokeLinecap="round"/>
    </svg>
  );
}
function IconTrend({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M2 14l5-5 3 3 5-5M15 7h3v3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconDiff({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M6 6h8M6 10h5M6 14h3" strokeLinecap="round"/>
      <path d="M14 12l2 2 2-2M16 14v-4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconAlert({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M10 2L2 17h16L10 2z" strokeLinejoin="round"/>
      <path d="M10 8v4M10 14h.01" strokeLinecap="round"/>
    </svg>
  );
}
function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x="2" y="4" width="16" height="14" rx="1.5"/>
      <path d="M2 9h16M6 2v4M14 2v4" strokeLinecap="round"/>
    </svg>
  );
}

// ── Componente ResumenCard ────────────────────────────────────────────

function ResumenCard({
  label, valor, sub, positivo, icon,
}: {
  label: string;
  valor: number;
  sub?: string;
  positivo?: boolean;   // undefined = neutral, true = verde, false = rojo
  icon: React.ReactNode;
}) {
  const colorClass =
    positivo === undefined
      ? "text-text-main"
      : positivo
        ? "text-[#1f7a52]"
        : "text-[#ac2d1a]";

  return (
    <div className="bg-surface rounded-lg border border-border p-3 sm:p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-text-muted leading-tight">{label}</p>
        <span className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 bg-border/20 text-text-muted">
          {icon}
        </span>
      </div>
      <p className={`text-lg sm:text-xl tabular-nums font-bold ${colorClass}`}>
        {formatUSD(valor)}
      </p>
      {sub && <p className="text-[11px] text-text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Componente SemaforoBadge ──────────────────────────────────────────

function SemaforoBadge({ nivel, dias }: { nivel: NivelLiquidez; dias: number }) {
  const s = SEMAFORO_STYLE[nivel];
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${s.bg} ${s.border}`}>
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dot}`} />
      <span className={`text-sm font-semibold ${s.text}`}>
        {SEMAFORO_LABEL[nivel]}
      </span>
      <span className="text-xs text-text-muted">— proyección a {dias} días</span>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────

export default function FlujoClient({
  mes,
  mesHoy,
  granularidad,
  horizonte,
  colchon,
  flujo,
  serie,
  proyeccion,
}: FlujoClientProps) {
  const router = useRouter();

  /** Navega preservando todos los params excepto los que se cambian. */
  function navegar(updates: Record<string, string | number>) {
    const params = new URLSearchParams();
    params.set("mes",     mes);
    params.set("g",       granularidad);
    params.set("h",       String(horizonte));
    // colchón como USD (de centavos a string con 2 decimales)
    params.set("colchon", (colchon / 100).toFixed(2));
    for (const [k, v] of Object.entries(updates)) {
      params.set(k, String(v));
    }
    router.push(`/flujo?${params.toString()}`);
  }

  const hayDatos = serie.some(p => p.realNeto !== 0 || p.devengadoNeto !== 0);
  const tramoActivo = proyeccion.tramos.find(t => t.horizonte === horizonte)!;
  const haySinFecha = proyeccion.cxcSinFecha_centavos > 0 || proyeccion.cxpSinFecha_centavos > 0;

  const netoRealPositivo =
    flujo.real.neto_centavos > 0 ? true
    : flujo.real.neto_centavos < 0 ? false
    : undefined;

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header sticky ─────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
          <div>
            <h1 className="font-display text-lg font-semibold text-text-main leading-none">
              Flujo de Caja
            </h1>
            <p className="text-[11px] text-text-muted mt-0.5">
              Real vs devengado · proyección 30/60/90 días
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Selector de mes */}
            <input
              type="month"
              value={mes}
              max={mesHoy}
              onChange={e => navegar({ mes: e.target.value })}
              className="text-sm border border-border rounded-md px-2.5 py-1.5 bg-surface text-text-main focus:outline-none focus:ring-2 focus:ring-brand-coral"
            />
            {/* Pills de granularidad */}
            <div className="flex gap-1 bg-border/30 rounded-lg p-0.5">
              {GRANULARIDADES.map(g => (
                <button
                  key={g.value}
                  onClick={() => navegar({ g: g.value })}
                  className={[
                    "text-xs px-2.5 py-1 rounded-md font-medium transition-colors",
                    granularidad === g.value
                      ? "bg-brand-cocoa text-brand-cream"
                      : "text-text-muted hover:text-text-main",
                  ].join(" ")}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Contenido principal ────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Hero — tres tarjetas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ResumenCard
            label="Flujo real neto"
            valor={flujo.real.neto_centavos}
            sub={`Entradas ${formatUSD(flujo.real.entradas_centavos)} · Salidas ${formatUSD(flujo.real.salidas_centavos)}`}
            positivo={netoRealPositivo}
            icon={<IconCash className="w-4 h-4" />}
          />
          <ResumenCard
            label="Flujo devengado neto"
            valor={flujo.devengado.neto_centavos}
            sub={`Entradas ${formatUSD(flujo.devengado.entradas_centavos)} · Salidas ${formatUSD(flujo.devengado.salidas_centavos)}`}
            icon={<IconTrend className="w-4 h-4" />}
          />
          <ResumenCard
            label="Diferencia (papel pendiente)"
            valor={flujo.diferencia_centavos}
            sub="Devengado aún no convertido en cash"
            icon={<IconDiff className="w-4 h-4" />}
          />
        </div>

        {/* Gráfico */}
        {hayDatos ? (
          <div className="bg-surface rounded-xl border border-border p-4">
            <p className="text-xs font-medium text-text-muted mb-3 uppercase tracking-wide">
              Flujo real (barras) vs Devengado (línea)
            </p>
            <FlujoChart serie={serie} granularidad={granularidad} />
          </div>
        ) : (
          <EmptyState
            mensaje="Sin movimientos en este período"
            accion="Ir a Cierre Diario"
            onNew={() => router.push("/cierre")}
          />
        )}

        {/* ── Proyección de liquidez ─────────────────────────── */}
        <div className="bg-surface rounded-xl border border-border p-4 sm:p-5 space-y-4">
          {/* Título + controles */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-text-main">
                Proyección de liquidez
              </h2>
              <p className="text-[11px] text-text-muted mt-0.5">
                Basada en CXC pendientes (entradas) y CXP pendientes (salidas)
              </p>
            </div>
            {/* Pills de horizonte */}
            <div className="flex gap-1 bg-border/30 rounded-lg p-0.5 self-start">
              {HORIZONTES.map(h => (
                <button
                  key={h.value}
                  onClick={() => navegar({ h: h.value })}
                  className={[
                    "text-xs px-2.5 py-1 rounded-md font-medium transition-colors",
                    horizonte === h.value
                      ? "bg-brand-cocoa text-brand-cream"
                      : "text-text-muted hover:text-text-main",
                  ].join(" ")}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          {/* Colchón ajustable */}
          <div className="flex items-center gap-3 p-3 bg-border/10 rounded-lg">
            <IconAlert className="w-4 h-4 text-text-muted shrink-0" />
            <label className="text-xs text-text-muted" htmlFor="colchon-input">
              Colchón mínimo de liquidez (USD):
            </label>
            <input
              id="colchon-input"
              type="number"
              min="0"
              step="100"
              defaultValue={(colchon / 100).toFixed(0)}
              onBlur={e => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v >= 0) navegar({ colchon: v });
              }}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  const v = parseFloat((e.target as HTMLInputElement).value);
                  if (!isNaN(v) && v >= 0) navegar({ colchon: v });
                }
              }}
              className="w-28 text-sm border border-border rounded-md px-2.5 py-1 bg-surface text-text-main focus:outline-none focus:ring-2 focus:ring-brand-coral tabular-nums"
            />
            <span className="text-xs text-text-muted">
              Ámbar si el neto proyectado baja de esta cifra
            </span>
          </div>

          {/* Semáforo del tramo activo */}
          <SemaforoBadge nivel={tramoActivo.semaforo} dias={horizonte} />

          {/* Cards del tramo activo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-border/5 rounded-lg p-3">
              <p className="text-[11px] text-text-muted">Entradas confirmadas</p>
              <p className="text-base font-bold text-[#1f7a52] tabular-nums mt-1">
                {formatUSD(tramoActivo.entradasConfirmadas_centavos)}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">CXC Programada Pago</p>
            </div>
            <div className="bg-border/5 rounded-lg p-3">
              <p className="text-[11px] text-text-muted">Entradas estimadas</p>
              <p className="text-base font-bold text-text-main tabular-nums mt-1">
                {formatUSD(tramoActivo.entradasEstimadas_centavos)}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">CXC resto pendientes</p>
            </div>
            <div className="bg-border/5 rounded-lg p-3">
              <p className="text-[11px] text-text-muted">Salidas confirmadas</p>
              <p className="text-base font-bold text-[#ac2d1a] tabular-nums mt-1">
                {formatUSD(tramoActivo.salidasConfirmadas_centavos)}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">CXP Programada/Vencida</p>
            </div>
            <div className="bg-border/5 rounded-lg p-3">
              <p className="text-[11px] text-text-muted">Salidas estimadas</p>
              <p className="text-base font-bold text-text-main tabular-nums mt-1">
                {formatUSD(tramoActivo.salidasEstimadas_centavos)}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">CXP resto pendientes</p>
            </div>
          </div>

          {/* Tabla resumen de los tres tramos */}
          <TableShell>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">
                    Horizonte
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">
                    Entradas
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">
                    Salidas
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">
                    Neto acumulado
                  </th>
                  <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {proyeccion.tramos.map(t => (
                  <TramoRow key={t.horizonte} tramo={t} activo={t.horizonte === horizonte} />
                ))}
              </tbody>
            </table>
          </TableShell>

          {/* Aviso sin fecha */}
          {haySinFecha && (
            <div className="flex items-start gap-3 p-3 bg-[#ffaa00]/10 border border-[#ffaa00]/30 rounded-lg">
              <IconCalendar className="w-4 h-4 text-[#7a5100] dark:text-[#ffaa00] shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-semibold text-[#7a5100] dark:text-[#ffaa00]">
                  Pendientes sin fecha — no entran en la proyección
                </p>
                <div className="text-text-muted space-y-0.5">
                  {proyeccion.cxcSinFecha_centavos > 0 && (
                    <p>
                      CXC sin fecha esperada:{" "}
                      <span className="font-medium tabular-nums">
                        {formatUSD(proyeccion.cxcSinFecha_centavos)}
                      </span>
                      {" — "}
                      <Link href="/cxc" className="underline hover:text-text-main">
                        Ir a CXC
                      </Link>{" "}
                      para agendar una fecha de cobro.
                    </p>
                  )}
                  {proyeccion.cxpSinFecha_centavos > 0 && (
                    <p>
                      CXP sin fecha de vencimiento:{" "}
                      <span className="font-medium tabular-nums">
                        {formatUSD(proyeccion.cxpSinFecha_centavos)}
                      </span>
                      {" — "}
                      <Link href="/cxp" className="underline hover:text-text-main">
                        Ir a CXP
                      </Link>{" "}
                      para registrar la fecha de pago.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Componente TramoRow (fila de la tabla de tramos) ──────────────────

function TramoRow({ tramo, activo }: { tramo: TramoProyeccion; activo: boolean }) {
  const s = SEMAFORO_STYLE[tramo.semaforo];
  const neto = tramo.acumuladoTotal_centavos;
  const entradas = tramo.entradasConfirmadas_centavos + tramo.entradasEstimadas_centavos;
  const salidas  = tramo.salidasConfirmadas_centavos  + tramo.salidasEstimadas_centavos;

  return (
    <tr className={activo ? "bg-border/10" : ""}>
      <td className="py-2.5 px-3 font-medium text-text-main">
        {tramo.horizonte} días
        {activo && (
          <span className="ml-1.5 text-[10px] bg-brand-coral/10 text-brand-coral px-1.5 py-0.5 rounded-full font-medium">
            activo
          </span>
        )}
      </td>
      <td className="py-2.5 px-3 text-right tabular-nums text-[#1f7a52]">
        {formatUSD(entradas)}
      </td>
      <td className="py-2.5 px-3 text-right tabular-nums text-[#ac2d1a]">
        {formatUSD(salidas)}
      </td>
      <td className={`py-2.5 px-3 text-right tabular-nums font-semibold ${
        neto >= 0 ? "text-[#1f7a52]" : "text-[#ac2d1a]"
      }`}>
        {formatUSD(neto)}
      </td>
      <td className="py-2.5 px-3">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
          {tramo.semaforo === "verde" ? "Verde" : tramo.semaforo === "ambar" ? "Ámbar" : "Rojo"}
        </span>
      </td>
    </tr>
  );
}
