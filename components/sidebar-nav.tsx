"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/",          label: "Dashboard",       icon: <DashboardIcon /> },
  { href: "/cierre",    label: "Cierre Diario",   icon: <CierreIcon /> },
  { href: "/cxp",       label: "Cuentas x Pagar", icon: <CxpIcon /> },
  { href: "/cxc",       label: "Cuentas x Cobrar",icon: <CxcIcon /> },
  { href: "/reportes",  label: "Reportes P&L",    icon: <ReportesIcon /> },
  { href: "/catalogos", label: "Catálogos",        icon: <CatalogosIcon /> },
];

export function SidebarNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Menú principal">
      {NAV_ITEMS.map(({ href, label, icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className={[
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
              "transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral",
              active
                ? "bg-white/15 text-brand-cream shadow-sm"
                : "text-brand-cream/70 hover:bg-white/10 hover:text-brand-cream",
            ].join(" ")}
            aria-current={active ? "page" : undefined}
          >
            <span
              className={[
                "shrink-0 w-4 h-4 transition-colors",
                active ? "text-brand-coral" : "text-brand-cream/50",
              ].join(" ")}
            >
              {icon}
            </span>
            {label}
            {active && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-coral shrink-0" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  );
}
function CierreIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="2" y="3" width="12" height="11" rx="1.5" />
      <path d="M5 3V1.5M11 3V1.5" strokeLinecap="round" />
      <path d="M2 7h12" />
      <path d="M5 10h2M5 12.5h4" strokeLinecap="round" />
    </svg>
  );
}
function CxpIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M8 1v14M1 8h14" strokeLinecap="round" />
      <circle cx="8" cy="8" r="7" />
    </svg>
  );
}
function CxcIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="8" cy="8" r="7" />
      <path d="M5.5 8.5l2 2 3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ReportesIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="2" y="9" width="2.5" height="5" rx="0.5" />
      <rect x="6.75" y="6" width="2.5" height="8" rx="0.5" />
      <rect x="11.5" y="3" width="2.5" height="11" rx="0.5" />
    </svg>
  );
}
function CatalogosIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="2" y="2" width="12" height="12" rx="1.5" />
      <path d="M2 6h12M6 6v8" />
    </svg>
  );
}
