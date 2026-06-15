import type { Metadata } from "next";
import { getClientesCorporativos } from "@/lib/db/catalogos";
import ClientesClient from "./clientes-client";

export const metadata: Metadata = {
  title: "Clientes Corporativos — eLunch Finanzas",
};

export default async function ClientesPage() {
  const clientes = await getClientesCorporativos();
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
          <a href="/catalogos" className="hover:text-brand-coral transition-colors">Catálogos</a>
          <span>/</span>
          <span>Clientes Corporativos</span>
        </div>
        <h2 className="font-display text-2xl text-brand-forest">Clientes Corporativos</h2>
      </div>
      <ClientesClient clientes={clientes} />
    </div>
  );
}
