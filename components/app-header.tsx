"use client";

import { usePathname } from "next/navigation";

type RouteInfo = { title: string; sub?: string };

const ROUTES: Record<string, RouteInfo> = {
  "/":                           { title: "Dashboard",             sub: "Resumen del día y alertas" },
  "/cierre":                     { title: "Cierre Diario",         sub: "Registra ventas y salidas del día" },
  "/cxp":                        { title: "Cuentas por Pagar",     sub: "Deudas con proveedores · Pagos y vencimientos" },
  "/cxc":                        { title: "Cuentas por Cobrar",    sub: "Facturas pendientes de cobro · Pipeline de cobranza" },
  "/reportes":                   { title: "Reportes P&L",          sub: "Estado de resultados por período" },
  "/catalogos":                  { title: "Catálogos",             sub: "Gestiona proveedores, clientes, cuentas y más" },
  "/catalogos/proveedores":      { title: "Proveedores",           sub: "Directorio de proveedores y días de crédito" },
  "/catalogos/unidades":         { title: "Unidades de Negocio",   sub: "Cafeterías, licitaciones, eventos y catering" },
  "/catalogos/clientes":         { title: "Clientes Corporativos", sub: "Empresas a las que se vende a crédito" },
  "/catalogos/cuentas":          { title: "Cuentas Bancarias",     sub: "Caja y cuentas donde entra y sale el efectivo" },
  "/catalogos/tipos-costo":      { title: "Tipos de Costo",        sub: "Tags para clasificar compras (pollo, carne, etc.)" },
  "/catalogos/categorias-gasto": { title: "Categorías de Gasto",   sub: "Agrupaciones para los gastos operativos" },
  "/catalogos/formas-pago":      { title: "Formas de Pago",        sub: "Cash, tarjeta, crédito CXC/CXP y otras" },
};

export function AppHeader() {
  const pathname = usePathname();
  const info = ROUTES[pathname] ?? { title: "eLunch Finanzas" };
  const isInCatalogo = pathname.startsWith("/catalogos/");

  return (
    <header className="h-14 bg-surface border-b border-border px-6 flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        {isInCatalogo && (
          <>
            <span className="text-xs text-text-muted shrink-0">Catálogos</span>
            <span className="text-text-muted/40 text-xs shrink-0">/</span>
          </>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-base text-brand-forest dark:text-foreground leading-tight">
            {info.title}
          </h1>
          {info.sub && (
            <p className="text-[11px] text-text-muted leading-none hidden sm:block truncate max-w-sm">
              {info.sub}
            </p>
          )}
        </div>
      </div>
      <span className="text-xs text-text-muted hidden sm:block shrink-0">
        {new Date().toLocaleDateString("es-SV", { weekday: "short", day: "numeric", month: "short" })}
      </span>
    </header>
  );
}
