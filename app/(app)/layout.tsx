import Image from "next/image";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/db/server";
import LogoutButton from "@/components/logout-button";
import { SidebarNav } from "@/components/sidebar-nav";
import { AppHeader } from "@/components/app-header";
import { Toaster } from "@/components/ui/sonner";

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
        <SidebarNav />

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
        <AppHeader />

        {/* Área de contenido */}
        <div className="flex-1 p-6">
          {children}
        </div>
      </main>

      <Toaster position="bottom-right" richColors />
    </div>
  );
}

