"use client";

import { useActionState } from "react";
import { sendMagicLink } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";

type FormState = { error?: string; success?: boolean } | null;

/**
 * Formulario de login por magic link.
 *
 * Checklist login-flow P0:
 * ✅ Label visible sobre el input (nunca solo placeholder)
 * ✅ Touch target mínimo 44px (h-11 = 44px)
 * ✅ Error state con texto rojo bajo el campo
 * ✅ Botón CTA con hover/active/disabled states
 *
 * Checklist P1:
 * ✅ Spinner de carga durante el submit
 * ✅ Focus state con anillo coral (--ring = brand-coral)
 */
export default function LoginForm() {
  const [state, action, isPending] = useActionState<FormState, FormData>(
    sendMagicLink,
    null
  );

  // Estado de éxito: mostrar pantalla de confirmación
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
          Te enviamos un enlace de acceso. Haz clic en él para entrar al
          sistema.
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
      {/* ── Campo de correo electrónico ── */}
      <div className="space-y-2">
        {/* Label visible — checklist P0 ✅ */}
        <Label
          htmlFor="email"
          className="text-sm font-medium text-brand-cocoa"
        >
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
          aria-describedby={state?.error ? "email-error" : undefined}
          className={[
            "h-11 text-base bg-surface border-border",
            "focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-0",
            "placeholder:text-text-muted",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            state?.error ? "border-status-danger" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />

        {/* Error state bajo el campo — checklist P0 ✅ */}
        {state?.error && (
          <p
            id="email-error"
            role="alert"
            className="text-xs text-status-danger"
          >
            {state.error}
          </p>
        )}
      </div>

      {/* ── Botón CTA ── */}
      <Button
        type="submit"
        disabled={isPending}
        className={[
          "w-full h-11 text-sm font-semibold",
          "bg-brand-coral text-white",
          "hover:bg-brand-coral/90 active:bg-brand-coral/80",
          "focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-2",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          "transition-all duration-150",
          "rounded-lg",
        ].join(" ")}
        aria-busy={isPending}
      >
        {isPending ? (
          /* Spinner de carga — checklist P1 ✅ */
          <span className="flex items-center gap-2">
            <SpinnerIcon />
            Enviando enlace...
          </span>
        ) : (
          "Enviar enlace de acceso"
        )}
      </Button>
    </form>
  );
}

/** Ícono de spinner animado para el estado de carga */
function SpinnerIcon() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
