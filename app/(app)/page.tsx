import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { getTransaccionesDia } from "@/lib/db/cierre";
import { getCuentasPorCobrar } from "@/lib/db/cxc";
import { getCuentasPorPagar } from "@/lib/db/cxp";
import {
  calcularResumenDia,
  formatUSD,
  type TransaccionParaResumen,
} from "@/lib/finance/cierre";
import { resumenCxc, type CxcParaResumen, type EstadoCxc } from "@/lib/finance/cxc";
import { resumenCxp, type CxpParaResumen, type EstadoCxp } from "@/lib/finance/cxp";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard — eLunch Finanzas",
};

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function IconCash({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  );
}

function IconTrend({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function IconAlert({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconChevronRight({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// ── Server Component ──────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const hoy = new Date().toISOString().slice(0, 10);

  // Fetch paralelo con resiliencia — nunca bloqueamos el dashboard por un error
  const [txs, cxcItems, cxpItems] = await Promise.all([
    getTransaccionesDia(hoy).catch(() => []),
    getCuentasPorCobrar().catch(() => []),
    getCuentasPorPagar().catch(() => []),
  ]);

  // Separar ventas y salidas
  const ventas = txs.filter((t) => t.tipo === "venta");
  const salidas = txs.filter((t) => t.tipo === "salida");

  // Adaptar TransaccionDisplay → TransaccionParaResumen
  const ventasResumen: TransaccionParaResumen[] = ventas.map((v) => ({
    monto_centavos: v.monto_centavos,
    forma_pago: {
      afecta_cash: v.formas_pago.afecta_cash,
      genera_cxc_cxp: v.formas_pago.genera_cxc_cxp,
    },
    cuenta_id: v.cuenta_id,
  }));
  const salidasResumen: TransaccionParaResumen[] = salidas.map((s) => ({
    monto_centavos: s.monto_centavos,
    forma_pago: {
      afecta_cash: s.formas_pago.afecta_cash,
      genera_cxc_cxp: s.formas_pago.genera_cxc_cxp,
    },
    cuenta_id: s.cuenta_id,
  }));

  // Adaptar CxcDisplay → CxcParaResumen (cast de estado string → EstadoCxc)
  const cxcResumenItems: CxcParaResumen[] = cxcItems.map((c) => ({
    monto_centavos: c.monto_centavos,
    fecha_esperada: c.fecha_esperada,
    estado: c.estado as EstadoCxc,
    pagos: c.pagos.map((p) => ({ monto_centavos: p.monto_centavos })),
  }));

  // Adaptar CxpDisplay → CxpParaResumen (cast de estado string → EstadoCxp)
  const cxpResumenItems: CxpParaResumen[] = cxpItems.map((c) => ({
    monto_centavos: c.monto_centavos,
    fecha_vencimiento: c.fecha_vencimiento,
    estado: c.estado as EstadoCxp,
    pagos: c.pagos.map((p) => ({ monto_centavos: p.monto_centavos })),
  }));

  // Calcular resúmenes financieros
  const resumenDia = calcularResumenDia(ventasResumen, salidasResumen);
  const rCxc = resumenCxc(cxcResumenItems, hoy);
  const rCxp = resumenCxp(cxpResumenItems, hoy);

  // Estado vacío: sin movimientos hoy y sin pendientes
  const sinDatos =
    txs.length === 0 &&
    rCxc.totalPorCobrar === 0 &&
    rCxp.totalPorPagar === 0;

  // Fecha larga formateada en servidor (sin hidratación mismatch)
  const fechaLarga = new Date(hoy + "T12:00:00").toLocaleDateString("es-SV", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6 pb-10">
      {/* ── Encabezado ── */}
      <div>
        <h2 className="font-display text-2xl text-brand-forest">
          Panel de Control
        </h2>
        <p className="text-text-muted text-sm mt-1">
          <time dateTime={hoy}>{fechaLarga}</time>
        </p>
      </div>

      {/* ── KPIs del día ── */}
      <section aria-labelledby="kpi-heading">
        <h3
          id="kpi-heading"
          className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3"
        >
          Resumen del día
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            href="/cierre"
            label="Ventas cash hoy"
            icon={<IconCash className="w-4 h-4" />}
            value={
              resumenDia.totalVentasCash > 0
                ? formatUSD(resumenDia.totalVentasCash)
                : null
            }
            neutral="Sin ventas"
            colorClass="text-status-ok"
            active={resumenDia.totalVentasCash > 0}
          />

          <KpiCard
            href="/cierre"
            label="Cash neto del día"
            icon={<IconTrend className="w-4 h-4" />}
            value={
              resumenDia.cashNeto !== 0
                ? formatUSD(resumenDia.cashNeto)
                : null
            }
            neutral="Sin movimientos"
            colorClass={
              resumenDia.cashNeto >= 0 ? "text-status-ok" : "text-status-danger"
            }
            active={resumenDia.cashNeto !== 0}
          />

          <KpiCard
            href="/cxc"
            label="CXC vencidas"
            icon={<IconAlert className="w-4 h-4" />}
            value={
              rCxc.totalVencido > 0 ? formatUSD(rCxc.totalVencido) : null
            }
            neutral="Todo al día"
            colorClass="text-status-danger"
            active={rCxc.totalVencido > 0}
            sublabel={
              rCxc.countVencidas > 0
                ? `${rCxc.countVencidas} factura${rCxc.countVencidas !== 1 ? "s" : ""}`
                : undefined
            }
          />

          <KpiCard
            href="/cxp"
            label="CXP por vencer"
            icon={<IconClock className="w-4 h-4" />}
            value={
              rCxp.totalPorVencer > 0 ? formatUSD(rCxp.totalPorVencer) : null
            }
            neutral="Sin vencimientos"
            colorClass="text-[#7a5100] dark:text-brand-amber"
            active={rCxp.totalPorVencer > 0}
            sublabel={
              rCxp.countPorVencer > 0
                ? `${rCxp.countPorVencer} obligación${rCxp.countPorVencer !== 1 ? "es" : ""} (≤ 3 días)`
                : undefined
            }
          />
        </div>
      </section>

      {/* ── Estado vacío con mascota ── */}
      {sinDatos ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Image
            src="/brand/eLunch-mascota-pollo.png"
            alt="Mascota eLunch — sin movimientos hoy"
            width={100}
            height={100}
            className="object-contain mb-6"
          />
          <h3 className="font-display text-xl text-brand-forest mb-2">
            ¡Todo limpio por ahora!
          </h3>
          <p className="text-text-muted text-sm max-w-xs leading-relaxed">
            No hay movimientos registrados hoy ni cuentas pendientes. Empieza
            registrando las ventas y salidas del día.
          </p>
          <div className="mt-6">
            <Link
              href="/cierre"
              className={cn(
                "inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px]",
                "bg-brand-coral text-[#1c1712] text-sm font-semibold",
                "rounded-lg hover:bg-brand-coral/90 active:bg-brand-coral/80",
                "transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-2"
              )}
            >
              Ir al Cierre Diario
            </Link>
          </div>
        </div>
      ) : null}

      {/* ── Acceso rápido a módulos ── */}
      <section aria-labelledby="modulos-heading">
        <h3
          id="modulos-heading"
          className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3"
        >
          Módulos
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ModuloCard
            href="/cierre"
            label="Cierre Diario"
            description="Registra ventas y salidas del día."
            accentClass="border-l-brand-coral"
            badge={
              txs.length > 0
                ? { text: `${txs.length} movimiento${txs.length !== 1 ? "s" : ""} hoy`, variant: "neutral" }
                : undefined
            }
          />

          <ModuloCard
            href="/cxp"
            label="Cuentas por Pagar"
            description="Gestiona tus deudas con proveedores."
            accentClass="border-l-brand-forest"
            badge={
              rCxp.totalVencido > 0
                ? { text: `${formatUSD(rCxp.totalVencido)} vencido`, variant: "danger" }
                : rCxp.totalPorVencer > 0
                ? { text: `${rCxp.countPorVencer} por vencer`, variant: "warning" }
                : rCxp.totalPorPagar > 0
                ? { text: formatUSD(rCxp.totalPorPagar) + " pendiente", variant: "neutral" }
                : undefined
            }
          />

          <ModuloCard
            href="/cxc"
            label="Cuentas por Cobrar"
            description="Pipeline de cobranza con aging."
            accentClass="border-l-brand-amber"
            badge={
              rCxc.totalVencido > 0
                ? { text: `${formatUSD(rCxc.totalVencido)} vencido`, variant: "danger" }
                : rCxc.totalPorVencer > 0
                ? { text: `${rCxc.countPorVencer} por vencer`, variant: "warning" }
                : rCxc.totalPorCobrar > 0
                ? { text: formatUSD(rCxc.totalPorCobrar) + " por cobrar", variant: "neutral" }
                : undefined
            }
          />
        </div>
      </section>
    </div>
  );
}

// ── Componente KPI Card ────────────────────────────────────────────────────────

function KpiCard({
  href,
  label,
  icon,
  value,
  neutral,
  colorClass,
  active,
  sublabel,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  value: string | null;
  neutral: string;
  colorClass: string;
  active: boolean;
  sublabel?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block bg-surface rounded-xl border border-border p-4",
        "min-h-[44px] hover:shadow-sm transition-shadow duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-2"
      )}
    >
      <div className="flex items-center gap-1.5 text-text-muted mb-2">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>

      {value !== null ? (
        <p
          className={cn(
            "font-semibold tabular-nums text-lg leading-tight",
            active ? colorClass : "text-text-muted"
          )}
        >
          {value}
        </p>
      ) : (
        <p className="text-text-muted text-sm leading-tight">{neutral}</p>
      )}

      {sublabel && (
        <p className="text-text-muted text-xs mt-1">{sublabel}</p>
      )}
    </Link>
  );
}

// ── Componente Módulo Card ─────────────────────────────────────────────────────

type BadgeVariant = "neutral" | "danger" | "warning";

function ModuloCard({
  href,
  label,
  description,
  accentClass,
  badge,
}: {
  href: string;
  label: string;
  description: string;
  accentClass: string;
  badge?: { text: string; variant: BadgeVariant };
}) {
  const badgeClass: Record<BadgeVariant, string> = {
    neutral: "bg-surface-muted text-text-muted",
    danger:  "bg-status-danger/10 text-status-danger",
    warning: "bg-brand-amber/10 text-[#7a5100] dark:text-brand-amber",
  };

  return (
    <Link
      href={href}
      className={cn(
        "block bg-surface rounded-xl border border-border border-l-4",
        accentClass,
        "p-5 min-h-[44px] hover:shadow-sm transition-shadow duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-2"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="font-semibold text-brand-cocoa text-sm mb-1">{label}</p>
          <p className="text-text-muted text-xs leading-relaxed">{description}</p>
        </div>
        <IconChevronRight className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
      </div>

      {badge && (
        <span
          className={cn(
            "inline-block mt-3 text-xs px-2 py-0.5 rounded-full font-medium",
            badgeClass[badge.variant]
          )}
        >
          {badge.text}
        </span>
      )}
    </Link>
  );
}
