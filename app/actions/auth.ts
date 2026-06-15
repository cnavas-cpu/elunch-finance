"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/db/server";
import { LoginSchema } from "@/lib/validation/auth";

/**
 * Server Action: enviar magic link al correo del CEO.
 * Valida el email con Zod en el servidor (nunca confiamos solo en el cliente).
 * Devuelve un objeto de error/éxito para mostrarlo en la UI.
 */
export async function sendMagicLink(
  _prevState: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  // Validación en servidor con Zod
  const result = LoginSchema.safeParse({
    email: formData.get("email"),
  });

  if (!result.success) {
    return {
      error: result.error.issues[0]?.message ?? "Correo inválido.",
    };
  }

  const { email } = result.data;

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
      // Restringir a usuarios existentes (no crea nuevos si no están en la DB)
      shouldCreateUser: false,
    },
  });

  if (error) {
    // Mensaje genérico — no revelar si el email existe o no
    return {
      error:
        "No pudimos enviar el enlace. Verifica que tu correo esté registrado o intenta de nuevo.",
    };
  }

  return { success: true };
}

/**
 * Server Action: cerrar sesión del usuario actual.
 * Elimina la sesión de Supabase y redirige al login.
 */
export async function logout(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
