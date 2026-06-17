import type { Metadata } from "next";
import { getCatalogosCierre, getTransaccionesDia } from "@/lib/db/cierre";
import { CierreClient } from "./cierre-client";

export const metadata: Metadata = {
  title: "Cierre Diario — eLunch Finanzas",
};

export default async function CierrePage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const { fecha: fechaParam } = await searchParams;
  const hoy = new Date().toISOString().slice(0, 10);
  const fecha = fechaParam ?? hoy;

  const [catalogos, transacciones] = await Promise.all([
    getCatalogosCierre(),
    getTransaccionesDia(fecha),
  ]);

  const ventas  = transacciones.filter(t => t.tipo === "venta");
  const salidas = transacciones.filter(t => t.tipo === "salida");

  return (
    <CierreClient
      key={fecha}
      fecha={fecha}
      fechaHoy={hoy}
      catalogos={catalogos}
      ventasIniciales={ventas}
      salidasIniciales={salidas}
    />
  );
}
