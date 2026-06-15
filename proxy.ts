import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy de autenticación de eLunch Finanzas (Next.js 16 — antes "middleware").
 *
 * Responsabilidades:
 *   1. Renueva los tokens de sesión de Supabase en cada request.
 *   2. Protege TODAS las rutas del grupo (app) — redirige a /login si no hay sesión.
 *   3. Redirige al dashboard si el usuario ya está autenticado e intenta ir a /login.
 *
 * Rutas protegidas: cualquier ruta que NO sea /login ni assets estáticos.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Renovar sesión (crítico: no agregar lógica entre esto y el getUser)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === "/login" || pathname.startsWith("/login");

  // Usuario NO autenticado intenta acceder a ruta protegida → /login
  if (!user && !isLoginPage) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Usuario autenticado intenta acceder a /login → dashboard
  if (user && isLoginPage) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/";
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Ejecutar proxy en todas las rutas EXCEPTO:
     * - _next/static (archivos estáticos del build)
     * - _next/image  (optimización de imágenes)
     * - favicon.ico  (icono del navegador)
     * - brand/*      (assets públicos del logo)
     * - api/auth/*   (callback de autenticación de Supabase)
     */
    "/((?!_next/static|_next/image|favicon.ico|brand/|api/auth/).*)",
  ],
};
