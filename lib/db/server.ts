/**
 * Cliente Supabase para uso EXCLUSIVO en el servidor.
 * (Server Components, Server Actions, Route Handlers, middleware)
 *
 * IMPORTANTE: Este archivo importa 'server-only' — si se importa
 * en un componente cliente, el build falla de inmediato.
 * La service-role key NUNCA se usa aquí; el cliente de servidor
 * usa la anon key + la sesión del usuario (RLS se encarga del resto).
 */
import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll puede fallar en Server Components (solo lectura).
            // El middleware gestiona la renovación de la sesión.
          }
        },
      },
    }
  );
}

/**
 * Cliente con service-role key — acceso administrativo sin RLS.
 * SOLO para operaciones internas de servidor que requieren acceso
 * total (ej. crear usuarios, seeds, jobs automáticos).
 * NUNCA exportar funciones que usen esto hacia el cliente.
 */
export function createSupabaseAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY no configurada. " +
        "Esta clave SOLO debe existir en el servidor (.env.local, Vercel env)."
    );
  }

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  );
}
