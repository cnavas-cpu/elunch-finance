/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createSupabaseServerClient } from "@/lib/db/server";

// ── Tipos ─────────────────────────────────────────────────────

export type PagoDisplay = {
  id:              string;
  fecha:           string;
  monto_centavos:  number;
  cuenta_id:       string | null;
  notas:           string | null;
  cuentas_bancarias: { id: string; nombre: string } | null;
};

export type CxpDisplay = {
  id:                string;
  transaccion_id:    string | null;
  proveedor_id:      string | null;
  monto_centavos:    number;
  fecha_emision:     string;
  fecha_vencimiento: string | null;
  estado:            string;
  notas:             string | null;
  created_at:        string;
  // Joins
  proveedores:      { id: string; nombre: string; dias_credito: number } | null;
  transacciones:    { fecha: string; descripcion: string | null } | null;
  pagos:            PagoDisplay[];
};

export type CuentaBancariaOpc = {
  id:     string;
  nombre: string;
  tipo:   string;
};

// ── Queries ───────────────────────────────────────────────────

/** Devuelve todas las CXP ordenadas por fecha de vencimiento (nulls al final). */
export async function getCuentasPorPagar(): Promise<CxpDisplay[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await (supabase as any)
    .from("cuentas_x_pagar")
    .select(`
      id, transaccion_id, proveedor_id, monto_centavos,
      fecha_emision, fecha_vencimiento, estado, notas, created_at,
      proveedores(id, nombre, dias_credito),
      transacciones(fecha, descripcion),
      pagos(id, fecha, monto_centavos, cuenta_id, notas,
        cuentas_bancarias(id, nombre))
    `)
    .order("fecha_vencimiento", { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as CxpDisplay[];
}

/** Cuentas bancarias activas para el selector de abono. */
export async function getCuentasBancarias(): Promise<CuentaBancariaOpc[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await (supabase as any)
    .from("cuentas_bancarias")
    .select("id, nombre, tipo")
    .eq("estado", "activa")
    .order("nombre");

  if (error) throw new Error(error.message);
  return (data ?? []) as CuentaBancariaOpc[];
}
