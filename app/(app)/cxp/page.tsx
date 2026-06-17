import type { Metadata } from "next";
import { getCuentasPorPagar, getCuentasBancarias } from "@/lib/db/cxp";
import { CxpClient } from "./cxp-client";

export const metadata: Metadata = {
  title: "Cuentas por Pagar — eLunch Finanzas",
};

export default async function CxpPage() {
  const hoy = new Date().toISOString().slice(0, 10);
  const [cxps, cuentas] = await Promise.all([
    getCuentasPorPagar(),
    getCuentasBancarias(),
  ]);

  return <CxpClient hoy={hoy} cxpsIniciales={cxps} cuentas={cuentas} />;
}
