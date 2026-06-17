import type { Metadata } from "next";
import { getCuentasPorCobrar } from "@/lib/db/cxc";
import { getCuentasBancarias } from "@/lib/db/catalogos";
import { CxcClient } from "./cxc-client";

export const metadata: Metadata = {
  title: "Cuentas por Cobrar — eLunch Finanzas",
};

export default async function CxcPage() {
  const hoy = new Date().toISOString().slice(0, 10);
  const [cxcs, cuentas] = await Promise.all([
    getCuentasPorCobrar(),
    getCuentasBancarias(),
  ]);
  return <CxcClient hoy={hoy} cxcsIniciales={cxcs} cuentas={cuentas} />;
}
