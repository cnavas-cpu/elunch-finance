import type { Metadata } from "next";
import { getProveedores, getTiposCosto } from "@/lib/db/catalogos";
import ProveedoresClient from "./proveedores-client";

export const metadata: Metadata = {
  title: "Proveedores — eLunch Finanzas",
};

export default async function ProveedoresPage() {
  const [proveedores, tiposCosto] = await Promise.all([
    getProveedores(),
    getTiposCosto(),
  ]);

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
          <a href="/catalogos" className="hover:text-brand-coral transition-colors">
            Catálogos
          </a>
          <span>/</span>
          <span>Proveedores</span>
        </div>
        <h2 className="font-display text-2xl text-brand-forest">Proveedores</h2>
      </div>
      <ProveedoresClient
        proveedores={proveedores}
        tagOptions={tiposCosto.map((t) => t.tag)}
      />
    </div>
  );
}
