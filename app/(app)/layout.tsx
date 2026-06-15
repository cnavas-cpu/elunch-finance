import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/db/server";
import LogoutButton from "@/components/logout-button";

/**
 * Layout del área protegida — todos los módulos operativos.
 * Sidebar: verde bosque con isotipo crema.
 * Verifica la sesión del usuario aquí como segunda capa de seguridad
 * (el middleware ya redirige, esto es un check defensivo).
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Obtener datos del usuario desde la tabla pública
  const { data: usuarioData } = await supabase
    .from("usuarios")
    .select("nombre, rol")
    .eq("id", user.id)
    .single();

  // Extraemos con tipos explícitos para evitar inferencia como 'never'
  const usuario = usuarioData as { nombre: string; rol: string } | null;

  return (
    <div className="min-h-screen flex bg-brand-cream">
      {/* ════════════════════════════════════════
          SIDEBAR — verde bosque con identidad eLunch
          ════════════════════════════════════════ */}
      <aside className="w-60 min-h-screen flex flex-col bg-brand-forest shrink-0">
        {/* Cabecera del sidebar */}
        <div className="px-5 pt-6 pb-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <Image
              src="/brand/eLunch-isotipo-crema.png"
              alt="eLunch"
              width={36}
              height={36}
              className="object-contain"
            />
            <div>
              <span className="font-display text-lg text-brand-cream leading-none block">
                eLunch
              </span>
              <span className="text-xs text-brand-cream/60 leading-none">
                Finanzas
              </span>
            </div>
          </div>
        </div>

        {/* Navegación principal */}
        <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Menú principal">
          <NavLink href="/" icon={<DashboardIcon />}>
            Dashboard
          </NavLink>
          <NavLink href="/cierre" icon={<CierreIcon />}>
            Cierre Diario
          </NavLink>
          <NavLink href="/cxp" icon={<CxpIcon />}>
            Cuentas x Pagar
          </NavLink>
          <NavLink href="/cxc" icon={<CxcIcon />}>
            Cuentas x Cobrar
          </NavLink>
          <NavLink href="/reportes" icon={<ReportesIcon />}>
            Reportes P&amp;L
          </NavLink>
          <NavLink href="/catalogos" icon={<CatalogosIcon />}>
            Catálogos
          </NavLink>
        </nav>

        {/* Footer del sidebar: usuario y logout */}
        <div className="px-4 py-4 border-t border-sidebar-border">
          <div className="mb-3">
            <p className="text-xs text-brand-cream/60 leading-none mb-0.5">
              Sesión activa
            </p>
            <p className="text-sm text-brand-cream font-medium truncate">
              {usuario?.nombre ?? user.email}
            </p>
            {usuario?.rol && (
              <p className="text-xs text-brand-amber uppercase tracking-wide mt-0.5">
                {usuario.rol}
              </p>
            )}
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* ════════════════════════════════════════
          CONTENIDO PRINCIPAL
          ════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Barra superior */}
        <header className="h-14 bg-surface border-b border-border px-6 flex items-center">
          <h1 className="font-display text-lg text-brand-forest">
            eLunch Finanzas
          </h1>
        </header>

        {/* Área de contenido */}
        <div className="flex-1 p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

/* ── Componente de link de navegación ── */
function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-3 px-3 py-2.5 rounded-lg",
        "text-brand-cream/80 text-sm font-medium",
        "hover:bg-white/10 hover:text-brand-cream",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral",
      ].join(" ")}
    >
      <span className="shrink-0 w-4 h-4 text-brand-cream/60">{icon}</span>
      {children}
    </Link>
  );
}

/* ── Íconos del sidebar (SVG minimalistas 16×16) ── */
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
