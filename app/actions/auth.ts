"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/db/server";
import { LoginSchema } from "@/lib/validation/auth";

export async function login(
  _prevState: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const result = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password") || undefined,
  });

  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { email, password } = result.data;
  const supabase = await createSupabaseServerClient();

  // Con contraseña → login directo
  if (password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: "Correo o contraseña incorrectos. Intenta de nuevo." };
    }
    redirect("/");
  }

  // Sin contraseña → magic link al correo
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
      shouldCreateUser: false,
    },
  });

  if (error) {
    return {
      error: "No pudimos enviar el enlace. Verifica que tu correo esté registrado.",
    };
  }

  return { success: true };
}

export async function logout(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
