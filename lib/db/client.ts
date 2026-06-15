"use client";

/**
 * Cliente Supabase para componentes del lado del cliente.
 * Usa SOLO la anon key pública — la seguridad real la maneja RLS en Supabase.
 * NUNCA importar la service-role key en este archivo.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
