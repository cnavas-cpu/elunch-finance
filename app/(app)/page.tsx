import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Dashboard — eLunch Finanzas",
};

/**
 * Dashboard principal — Sprint 1.
 * Muestra el estado vacío con la mascota eLunch mientras los módulos
 * se construyen en sprints posteriores.
 */
export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* ── Bienvenida ── */}
      <div>
        <h2 className="font-display text-2xl text-brand-forest">
          Bienvenido al panel
        </h2>
        <p className="text-text-muted text-sm mt-1">
          Hoy es{" "}
          <time>
            {new Date().toLocaleDateString("es-SV", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
        </p>
      </div>

      {/* ── Tarjetas de acceso rápido (placeholder Sprint 1) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickCard
          href="/cierre"
          label="Cierre Diario"
          description="Registra ventas y salidas del día."
          status="Próximamente"
          color="coral"
        />
        <QuickCard
          href="/cxp"
          label="Cuentas x Pagar"
          description="Gestiona tus deudas con proveedores."
          status="Próximamente"
          color="forest"
        />
        <QuickCard
          href="/cxc"
          label="Cuentas x Cobrar"
          description="Pipeline de cobranza con aging."
          status="Próximamente"
          color="amber"
        />
      </div>

      {/* ── Estado vacío principal con mascota ── */}
      <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
        <div className="relative mb-6">
          <Image
            src="/brand/eLunch-mascota-pollo.png"
            alt="Mascota eLunch — empezando"
            width={100}
            height={100}
            className="object-contain"
          />
        </div>

        <h3 className="font-display text-xl text-brand-forest mb-2">
          ¡El sistema está listo!
        </h3>
        <p className="text-text-muted text-sm max-w-xs leading-relaxed">
          Aún no hay movimientos registrados. Los módulos de cierre diario,
          CXP, CXC y reportes se activan en los próximos sprints.
        </p>

        <div className="mt-6">
          <Link
            href="/cierre"
            className={[
              "inline-flex items-center gap-2 px-5 py-2.5",
              "bg-brand-coral text-[#1c1712] text-sm font-semibold",
              "rounded-lg hover:bg-brand-coral/90 active:bg-brand-coral/80",
              "transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-2",
            ].join(" ")}
          >
            Ir al Cierre Diario
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ── Tarjeta de acceso rápido ── */
function QuickCard({
  href,
  label,
  description,
  status,
  color,
}: {
  href: string;
  label: string;
  description: string;
  status: string;
  color: "coral" | "forest" | "amber";
}) {
  const accent = {
    coral: "border-l-brand-coral",
    forest: "border-l-brand-forest",
    amber: "border-l-brand-amber",
  }[color];

  return (
    <Link
      href={href}
      className={[
        "block bg-surface rounded-xl border border-border border-l-4",
        accent,
        "p-5 hover:shadow-sm transition-shadow duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral",
      ].join(" ")}
    >
      <p className="font-semibold text-brand-cocoa text-sm mb-1">{label}</p>
      <p className="text-text-muted text-xs leading-relaxed">{description}</p>
      <span className="inline-block mt-3 text-xs px-2 py-0.5 rounded-full bg-surface-muted text-text-muted">
        {status}
      </span>
    </Link>
  );
}
