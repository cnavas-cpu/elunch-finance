/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createSupabaseServerClient } from "@/lib/db/server";

// ── Tipos para catálogos del cierre ─────────────────────────

export type UnidadOpc = {
  id: string;
  nombre: string;
  estado: string;
  cliente_corp_id: string | null;
};

export type FormaPagoOpc = {
  id: string;
  nombre: string;
  tipo: string | null;
  afecta_cash: boolean | null;
  genera_cxc_cxp: boolean;
};

export type CuentaOpc = { id: string; nombre: string; tipo: string };
export type ClienteOpc = { id: string; nombre: string; alias: string | null };
export type CategoriaOpc = { id: string; nombre: string };
export type ProveedorOpc = {
  id: string;
  nombre: string;
  tag_tipo: string | null;
  dias_credito: number;
};

export interface CatalogosCierre {
  unidades:   UnidadOpc[];
  formasPago: FormaPagoOpc[];
  cuentas:    CuentaOpc[];
  clientes:   ClienteOpc[];
  categorias: CategoriaOpc[];
  proveedores: ProveedorOpc[];
}

// ── Tipo display de transacción (con joins) ──────────────────

export type TransaccionDisplay = {
  id: string;
  fecha: string;
  tipo: "venta" | "salida";
  monto_centavos: number;
  descripcion: string | null;
  asignacion: string | null;
  unidad_id: string | null;
  forma_pago_id: string;
  cuenta_id: string | null;
  created_at: string;
  // Joins
  unidades_negocio: { id: string; nombre: string } | null;
  formas_pago: FormaPagoOpc;
  cuentas_bancarias: { id: string; nombre: string; tipo: string } | null;
  categorias_gasto: { id: string; nombre: string } | null;
  proveedores: { id: string; nombre: string } | null;
};

// ── Queries ──────────────────────────────────────────────────

export async function getCatalogosCierre(): Promise<CatalogosCierre> {
  const supabase = await createSupabaseServerClient();
  const [unidades, formasPago, cuentas, clientes, categorias, proveedores] =
    await Promise.all([
      (supabase as any)
        .from("unidades_negocio")
        .select("id, nombre, estado, cliente_corp_id")
        .neq("estado", "inactiva")
        .order("nombre"),
      (supabase as any)
        .from("formas_pago")
        .select("id, nombre, tipo, afecta_cash, genera_cxc_cxp")
        .order("nombre"),
      (supabase as any)
        .from("cuentas_bancarias")
        .select("id, nombre, tipo")
        .eq("estado", "activa")
        .order("nombre"),
      (supabase as any)
        .from("clientes_corporativos")
        .select("id, nombre, alias")
        .neq("estado", "inactivo")
        .order("nombre"),
      (supabase as any)
        .from("categorias_gasto")
        .select("id, nombre")
        .order("nombre"),
      (supabase as any)
        .from("proveedores")
        .select("id, nombre, tag_tipo, dias_credito")
        .eq("estado", "activo")
        .order("nombre"),
    ]);

  return {
    unidades:    unidades.data    ?? [],
    formasPago:  formasPago.data  ?? [],
    cuentas:     cuentas.data     ?? [],
    clientes:    clientes.data    ?? [],
    categorias:  categorias.data  ?? [],
    proveedores: proveedores.data ?? [],
  };
}

export async function getTransaccionesDia(fecha: string): Promise<TransaccionDisplay[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await (supabase as any)
    .from("transacciones")
    .select(`
      id, fecha, tipo, monto_centavos, descripcion, asignacion,
      unidad_id, forma_pago_id, cuenta_id, created_at,
      unidades_negocio(id, nombre),
      formas_pago(id, nombre, tipo, afecta_cash, genera_cxc_cxp),
      cuentas_bancarias(id, nombre, tipo),
      categorias_gasto(id, nombre),
      proveedores(id, nombre)
    `)
    .eq("fecha", fecha)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}
