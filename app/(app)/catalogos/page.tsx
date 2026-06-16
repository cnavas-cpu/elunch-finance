import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Catálogos — eLunch Finanzas",
};

const CATALOGOS = [
  {
    href: "/catalogos/proveedores",
    titulo: "Proveedores",
    descripcion: "45 proveedores con tag de tipo y días de crédito.",
    badge: "45",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-6 h-6" aria-hidden="true">
        <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/catalogos/unidades",
    titulo: "Unidades de Negocio",
    descripcion: "Cafeterías, licitaciones, eventos y catering (10 unidades).",
    badge: "10",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-6 h-6" aria-hidden="true">
        <rect x="3" y="3" width="8" height="8" rx="1.5" />
        <rect x="13" y="3" width="8" height="8" rx="1.5" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" />
        <rect x="13" y="13" width="8" height="8" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/catalogos/clientes",
    titulo: "Clientes Corporativos",
    descripcion: "Empresas: TP, Insigne, BAC, Atento, Plycem, Centro Judicial (7).",
    badge: "7",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-6 h-6" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: "/catalogos/cuentas",
    titulo: "Cuentas Bancarias",
    descripcion: "Caja, BAC, Banco Azul, Cuscatlán, Agrícola y tarjeta (7).",
    badge: "7",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-6 h-6" aria-hidden="true">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </svg>
    ),
  },
  {
    href: "/catalogos/tipos-costo",
    titulo: "Tipos de Costo",
    descripcion: "Tags de clasificación: pollo, carnes, desechables, etc. (22).",
    badge: "22",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-6 h-6" aria-hidden="true">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/catalogos/categorias-gasto",
    titulo: "Categorías de Gasto",
    descripcion: "Gasolina, alquileres, salarios, impuestos y más (24).",
    badge: "24",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-6 h-6" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4l3 3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/catalogos/formas-pago",
    titulo: "Formas de Pago",
    descripcion: "Cash, tarjeta, transferencia, crédito CXC y CXP (8).",
    badge: "8",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-6 h-6" aria-hidden="true">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
  },
];

export default function CatalogosPage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-7">
        <h2 className="font-display text-2xl text-brand-forest mb-1">Catálogos</h2>
        <p className="text-text-muted text-sm">
          Datos maestros del sistema. Cámbialos aquí y se actualizan en todo lo demás.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CATALOGOS.map((cat) => (
          <Link
            key={cat.href}
            href={cat.href}
            className={[
              "group flex flex-col gap-3 p-5 rounded-xl border border-border bg-surface",
              "hover:border-brand-coral/50 hover:shadow-sm",
              "transition-all duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral",
            ].join(" ")}
          >
            <div className="flex items-start justify-between">
              <span className="text-brand-coral/80 group-hover:text-brand-coral transition-colors">
                {cat.icon}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-forest/8 text-brand-forest">
                {cat.badge}
              </span>
            </div>
            <div>
              <h3 className="font-semibold text-brand-cocoa text-sm mb-1 group-hover:text-brand-coral transition-colors">
                {cat.titulo}
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">{cat.descripcion}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
