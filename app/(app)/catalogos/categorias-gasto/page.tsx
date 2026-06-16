import type { Metadata } from "next";
import { getCategoriasGasto } from "@/lib/db/catalogos";
import CategoriasGastoClient from "./categorias-gasto-client";

export const metadata: Metadata = {
  title: "Categorías de Gasto — eLunch Finanzas",
};

export default async function CategoriasGastoPage() {
  const categorias = await getCategoriasGasto();
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
          <a href="/catalogos" className="hover:text-brand-coral transition-colors">Catálogos</a>
          <span>/</span>
          <span>Categorías de Gasto</span>
        </div>
        <h2 className="font-display text-2xl text-brand-forest mb-1">Categorías de Gasto</h2>
        <p className="text-sm text-text-muted">
          {categorias.length} categorías para clasificar los egresos operativos.
        </p>
      </div>
      <CategoriasGastoClient categorias={categorias} />
    </div>
  );
}
