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
  const next = searchParams.get("next") ?? "/";

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
      // Redirigir al dashboard (o a la URL que especificó el parámetro "next")
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // En caso de error, redirigir al login con mensaje de error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
