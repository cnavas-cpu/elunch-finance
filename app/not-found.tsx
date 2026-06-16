import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Página no encontrada — eLunch Finanzas",
};

/**
 * Página 404 con identidad eLunch.
 * No muestra stack traces ni rutas internas.
 * Mascota de pollo solo en estados especiales — ✅
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-brand-cream flex flex-col items-center justify-center p-6 text-center">
      <div className="mb-6">
        <Image
          src="/brand/eLunch-isotipo-crema.png"
          alt="eLunch"
          width={48}
          height={48}
          className="object-contain opacity-40 mx-auto mb-4"
        />
        <p className="text-8xl font-display text-brand-cocoa/20 leading-none mb-4">
          404
        </p>
        <h1 className="font-display text-2xl text-brand-forest mb-2">
          Esta página no existe
        </h1>
        <p className="text-text-muted text-sm max-w-xs mx-auto">
          La ruta que buscas no está disponible. Puede que el módulo todavía no
          esté construido.
        </p>
      </div>

      <Link
        href="/"
        className={[
          "inline-flex items-center gap-2 px-5 py-2.5 mt-2",
          "bg-brand-coral text-[#1c1712] text-sm font-semibold rounded-lg",
          "hover:bg-brand-coral/90 active:bg-brand-coral/80",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-2",
        ].join(" ")}
      >
        Ir al Dashboard
      </Link>
    </div>
  );
}
