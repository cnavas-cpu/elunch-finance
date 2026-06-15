import type { Metadata } from "next";
import { getUnidadesNegocio, getFuentesIngreso, getClientesCorporativos } from "@/lib/db/catalogos";
import UnidadesClient from "./unidades-client";

export const metadata: Metadata = {
  title: "Unidades de Negocio — eLunch Finanzas",
};

export default async function UnidadesPage() {
  const [unidades, fuentes, clientes] = await Promise.all([
    getUnidadesNegocio(),
    getFuentesIngreso(),
    getClientesCorporativos(),
  ]);
  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
          <a href="/catalogos" className="hover:text-brand-coral transition-colors">Catálogos</a>
          <span>/</span>
          <span>Unidades de Negocio</span>
        </div>
        <h2 className="font-display text-2xl text-brand-forest">Unidades de Negocio</h2>
      </div>
      <UnidadesClient unidades={unidades} fuentes={fuentes} clientes={clientes} />
    </div>
  );
}
