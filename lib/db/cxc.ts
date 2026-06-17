/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/db/cxc.ts — Capa de datos para Cuentas por Cobrar (Sprint 5)
// Solo se ejecuta en servidor. Espeja lib/db/cxp.ts (join a clientes, no a proveedores).
// Para el selector de cuenta del cobro se reutiliza getCuentasBancarias() de catalogos.ts.
import "server-only";
import { createSupabaseServerClient } from "@/lib/db/server";

// ── Tipos ─────────────────────────────────────────────────────────

export type PagoDisplay = {
  id:              string;
  fecha:           string;
  monto_centavos:  number;
  cuenta_id:       string | null;
  notas:           string | null;
  cuentas_bancarias: { id: string; nombre: string } | null;
};

export type CxcDisplay = {
  id:              string;
  transaccion_id:  string | null;
  cliente_id:      string | null;
  unidad_id:       string | null;
  monto_centavos:  number;
  fecha_emision:   string;
  fecha_esperada:  string | null;
  estado:          string;
  num_oc:          string | null;
  num_factura:     string | null;
  notas:           string | null;
  created_at:      string;
  clientes_corporativos: { id: string; nombre: string } | null;
  unidades_negocio:      { id: string; nombre: string } | null;
  transacciones:         { fecha: string; descripcion: string | null } | null;
  pagos:                 PagoDisplay[];
};

// Alias exportado para uso en page.tsx y cxc-client.tsx
export type CuentaBancariaOpc = {
  id:     string;
  nombre: string;
  tipo:   string;
  moneda: string;
  estado: string;
  notas:  string | null;
};

// ── Queries ───────────────────────────────────────────────────────

/**
 * Devuelve todas las CXC con sus pagos y relaciones.
 * Ordenadas por fecha_esperada ascendente (nulls al final) para que
 * las vencidas/urgentes aparezcan primero.
 */
export async function getCuentasPorCobrar(): Promise<CxcDisplay[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await (supabase as any)
    .from("cuentas_x_cobrar")
    .select(`
      id, transaccion_id, cliente_id, unidad_id, monto_centavos,
      fecha_emision, fecha_esperada, estado, num_oc, num_factura, notas, created_at,
      clientes_corporativos ( id, nombre ),
      unidades_negocio ( id, nombre ),
      transacciones ( fecha, descripcion ),
      pagos (
        id, fecha, monto_centavos, cuenta_id, notas,
        cuentas_bancarias ( id, nombre )
      )
    `)
    .order("fecha_esperada", { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as CxcDisplay[];
}
