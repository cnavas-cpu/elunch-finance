import type { Metadata } from "next";
import { getCuentasBancarias } from "@/lib/db/catalogos";
import CuentasClient from "./cuentas-client";

export const metadata: Metadata = {
  title: "Cuentas Bancarias — eLunch Finanzas",
};

export default async function CuentasPage() {
  const cuentas = await getCuentasBancarias();
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
          <a href="/catalogos" className="hover:text-brand-coral transition-colors">Catálogos</a>
          <span>/</span>
          <span>Cuentas Bancarias</span>
        </div>
        <h2 className="font-display text-2xl text-brand-forest">Cuentas Bancarias</h2>
      </div>
      <CuentasClient cuentas={cuentas} />
    </div>
  );
}
