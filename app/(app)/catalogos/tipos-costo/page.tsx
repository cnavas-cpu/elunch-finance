import type { Metadata } from "next";
import { getTiposCosto } from "@/lib/db/catalogos";
import TiposCostoClient from "./tipos-costo-client";

export const metadata: Metadata = {
  title: "Tipos de Costo — eLunch Finanzas",
};

export default async function TiposCostoPage() {
  const tipos = await getTiposCosto();
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
          <a href="/catalogos" className="hover:text-brand-coral transition-colors">Catálogos</a>
          <span>/</span>
          <span>Tipos de Costo</span>
        </div>
        <h2 className="font-display text-2xl text-brand-forest mb-1">Tipos de Costo</h2>
        <p className="text-sm text-text-muted">
          Tags para clasificar proveedores y transacciones. {tipos.length} tipos activos.
        </p>
      </div>
      <TiposCostoClient tipos={tipos} />
    </div>
  );
}
