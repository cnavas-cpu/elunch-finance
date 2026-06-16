import type { Metadata } from "next";
import { getFormasPago } from "@/lib/db/catalogos";
import FormasPagoClient from "./formas-pago-client";

export const metadata: Metadata = {
  title: "Formas de Pago — eLunch Finanzas",
};

export default async function FormasPagoPage() {
  const formas = await getFormasPago();
  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
          <a href="/catalogos" className="hover:text-brand-coral transition-colors">Catálogos</a>
          <span>/</span>
          <span>Formas de Pago</span>
        </div>
        <h2 className="font-display text-2xl text-brand-forest mb-1">Formas de Pago</h2>
        <p className="text-sm text-text-muted">
          Cómo se mueve el dinero. Las columnas &quot;Cash&quot; y &quot;CXC/CXP&quot; determinan el impacto financiero.
        </p>
      </div>
      <FormasPagoClient formas={formas} />
    </div>
  );
}
