"use client";

import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
  "/":                              "Dashboard",
  "/cierre":                        "Cierre Diario",
  "/cxp":                           "Cuentas por Pagar",
  "/cxc":                           "Cuentas por Cobrar",
  "/reportes":                      "Reportes P&L",
  "/catalogos":                     "Catálogos",
  "/catalogos/proveedores":         "Proveedores",
  "/catalogos/unidades":            "Unidades de Negocio",
  "/catalogos/clientes":            "Clientes Corporativos",
  "/catalogos/cuentas":             "Cuentas Bancarias",
  "/catalogos/tipos-costo":         "Tipos de Costo",
  "/catalogos/categorias-gasto":    "Categorías de Gasto",
  "/catalogos/formas-pago":         "Formas de Pago",
};

export function AppHeader() {
  const pathname = usePathname();
  const title = TITLES[pathname] ?? "eLunch Finanzas";
  const isInCatalogo = pathname.startsWith("/catalogos/");

  return (
    <header className="h-14 bg-surface border-b border-border px-6 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {isInCatalogo && (
          <>
            <span className="text-xs text-text-muted">Catálogos</span>
            <span className="text-text-muted/40 text-xs">/</span>
          </>
        )}
        <h1 className="font-display text-base text-brand-forest">{title}</h1>
      </div>
      <span className="text-xs text-text-muted hidden sm:block">
        {new Date().toLocaleDateString("es-SV", { weekday: "short", day: "numeric", month: "short" })}
      </span>
    </header>
  );
}
