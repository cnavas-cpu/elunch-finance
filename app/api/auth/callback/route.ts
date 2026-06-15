import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

/**
 * Callback de autenticación de Supabase Auth.
 * Supabase redirige aquí después de que el usuario hace clic en el magic link.
 * Intercambia el código de autorización por una sesión de usuario.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Seguridad: validar que `next` sea una ruta relativa segura.
  // Evita open redirect: si fuera "//evil.com" o "/\evil.com" podría redirigir fuera.
  const nextParam = searchParams.get("next") ?? "/";
  const safeNext = /^\/(?![/\\])/.test(nextParam) ? nextParam : "/";

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Redirigir al dashboard (o ruta interna validada)
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  // En caso de error, redirigir al login con mensaje de error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
