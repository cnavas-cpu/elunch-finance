import type { Metadata } from "next";
import Image from "next/image";
import LoginForm from "@/components/login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión — eLunch Finanzas",
  description: "Accede al sistema de gestión financiera de eLunch.",
};

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm">
      {/* ── Cabecera con marca ── */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-5">
          <Image
            src="/brand/eLunch-logo-coral.png"
            alt="eLunch Finanzas"
            width={180}
            height={56}
            priority
            className="object-contain"
          />
        </div>

        <h1 className="font-display text-3xl text-brand-forest mb-1">
          Finanzas
        </h1>
        <p className="text-text-muted text-sm">
          Ingresa con tu correo registrado.
        </p>
      </div>

      {/* ── Formulario de login ── */}
      <div className="bg-surface rounded-2xl shadow-sm border border-border p-7">
        <LoginForm />
      </div>

      {/* ── Footer de marca ── */}
      <p className="text-center text-xs text-text-muted mt-6">
        Solo usuarios autorizados de eLunch.
      </p>
    </div>
  );
}
