"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Página de error global — Next.js la muestra cuando algo falla en producción.
 * NO muestra stack traces ni detalles técnicos al usuario.
 * Los errores reales se reportan a Sentry (configurar en Sprint 9).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // TODO Sprint 9: reportar a Sentry
    // Sentry.captureException(error);
    console.error("[eLunch Finanzas] Error en producción:", error.digest);
  }, [error]);

  return (
    <div className="min-h-screen bg-brand-cream flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-sm">
        <p className="text-5xl mb-4">⚠️</p>
        <h1 className="font-display text-2xl text-brand-forest mb-2">
          Algo salió mal
        </h1>
        <p className="text-text-muted text-sm mb-6 leading-relaxed">
          Ocurrió un error inesperado. Si el problema persiste, contáctanos.
          {error.digest && (
            <span className="block mt-2 text-xs font-mono text-text-muted">
              Código: {error.digest}
            </span>
          )}
        </p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className={[
              "px-4 py-2 text-sm font-semibold rounded-lg",
              "bg-brand-coral text-white",
              "hover:bg-brand-coral/90 transition-colors",
            ].join(" ")}
          >
            Intentar de nuevo
          </button>
          <Link
            href="/"
            className={[
              "px-4 py-2 text-sm font-semibold rounded-lg",
              "border border-brand-cocoa/20 text-brand-cocoa",
              "hover:bg-brand-cocoa/5 transition-colors",
            ].join(" ")}
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
