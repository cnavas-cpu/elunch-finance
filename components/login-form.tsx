"use client";

import { useActionState, useState } from "react";
import { login } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";

type FormState = { error?: string; success?: boolean } | null;

export default function LoginForm() {
  const [state, action, isPending] = useActionState<FormState, FormData>(
    login,
    null
  );
  const [showPassword, setShowPassword] = useState(false);

  if (state?.success) {
    return (
      <div className="text-center py-2">
        <div className="flex justify-center mb-4">
          <Image
            src="/brand/eLunch-mascota-pollo.png"
            alt="Mascota eLunch"
            width={80}
            height={80}
            className="object-contain"
          />
        </div>
        <h2 className="font-display text-xl text-brand-forest mb-2">
          ¡Revisa tu correo!
        </h2>
        <p className="text-sm text-text-muted leading-relaxed">
          Te enviamos un enlace de acceso. Haz clic en él para entrar al sistema.
        </p>
        <p className="text-xs text-text-muted mt-3">
          ¿No llegó? Revisa la carpeta de spam o{" "}
          <button
            type="button"
            className="text-brand-coral underline underline-offset-2 hover:opacity-80 transition-opacity"
            onClick={() => window.location.reload()}
          >
            intenta de nuevo
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium text-brand-cocoa">
          Correo electrónico
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="tu@correo.com"
          disabled={isPending}
          aria-invalid={!!state?.error}
          className={[
            "h-11 text-base bg-surface border-border",
            "focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-0",
            "placeholder:text-text-muted disabled:opacity-60 disabled:cursor-not-allowed",
            state?.error ? "border-status-danger" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      </div>

      {/* Contraseña (opcional) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-sm font-medium text-brand-cocoa">
            Contraseña
          </Label>
          <span className="text-xs text-text-muted">opcional</span>
        </div>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Déjala vacía para enlace por correo"
            disabled={isPending}
            className={[
              "h-11 text-base bg-surface border-border pr-11",
              "focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-0",
              "placeholder:text-text-muted disabled:opacity-60 disabled:cursor-not-allowed",
            ].join(" ")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-brand-cocoa transition-colors"
            tabIndex={-1}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </div>

      {/* Error */}
      {state?.error && (
        <p role="alert" className="text-xs text-status-danger -mt-2">
          {state.error}
        </p>
      )}

      {/* CTA */}
      <Button
        type="submit"
        disabled={isPending}
        className={[
          "w-full h-11 text-sm font-semibold",
          "bg-brand-coral text-white",
          "hover:bg-brand-coral/90 active:bg-brand-coral/80",
          "focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-2",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          "transition-all duration-150 rounded-lg",
        ].join(" ")}
        aria-busy={isPending}
      >
        {isPending ? (
          <span className="flex items-center gap-2">
            <SpinnerIcon />
            Ingresando...
          </span>
        ) : (
          "Entrar"
        )}
      </Button>

      <p className="text-center text-xs text-text-muted">
        Sin contraseña → te enviamos un enlace al correo
      </p>
    </form>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
