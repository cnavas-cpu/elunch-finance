import "server-only";
import { createSupabaseServerClient } from "@/lib/db/server";

// ── Tipos ────────────────────────────────────────────────────

export type Proveedor = {
  id: string;
  nombre: string;
  tag_tipo: string | null;
  dias_credito: number;
  estado: "activo" | "inactivo";
  notas: string | null;
  contacto: string | null;
};

export type UnidadNegocio = {
  id: string;
  nombre: string;
  fuente_ingreso_id: string | null;
  cliente_corp_id: string | null;
  ubicacion: string | null;
  estado: "activa" | "inactiva" | "programada";
  fecha_inicio: string | null;
  notas: string | null;
};

export type ClienteCorporativo = {
  id: string;
  nombre: string;
  alias: string | null;
  relacion: string | null;
  estado: "activo" | "inactivo" | "programado";
  notas: string | null;
  dias_credito: number;  // Sprint 5: días de crédito por cliente (default 0 = contado)
};

export type CuentaBancaria = {
  id: string;
  nombre: string;
  tipo: "efectivo" | "banco" | "tarjeta_credito" | "otro";
  moneda: string;
  estado: "activa" | "inactiva";
  notas: string | null;
};

export type TipoCosto = {
  id: string;
  tag: string;
  grupo: string | null;
  descripcion: string | null;
};

export type CategoriaGasto = {
  id: string;
  nombre: string;
  naturaleza: string | null;
  descripcion: string | null;
};

export type FormaPago = {
  id: string;
  nombre: string;
  tipo: string | null;
  afecta_cash: boolean | null;
  genera_cxc_cxp: boolean;
  notas: string | null;
};

// ── Queries ─────────────────────────────────────────────────

export async function getProveedores(): Promise<Proveedor[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("proveedores")
    .select("id, nombre, tag_tipo, dias_credito, estado, notas, contacto")
    .order("nombre");
  if (error) throw error;
  return (data ?? []) as Proveedor[];
}

export async function getUnidadesNegocio(): Promise<UnidadNegocio[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("unidades_negocio")
    .select("id, nombre, fuente_ingreso_id, cliente_corp_id, ubicacion, estado, fecha_inicio, notas")
    .order("id");
  if (error) throw error;
  return (data ?? []) as UnidadNegocio[];
}

export async function getClientesCorporativos(): Promise<ClienteCorporativo[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clientes_corporativos")
    .select("id, nombre, alias, relacion, estado, notas, dias_credito")
    .order("nombre");
  if (error) throw error;
  return (data ?? []) as ClienteCorporativo[];
}

export async function getCuentasBancarias(): Promise<CuentaBancaria[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cuentas_bancarias")
    .select("id, nombre, tipo, moneda, estado, notas")
    .order("id");
  if (error) throw error;
  return (data ?? []) as CuentaBancaria[];
}

export async function getTiposCosto(): Promise<TipoCosto[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tipos_costo")
    .select("id, tag, grupo, descripcion")
    .order("id");
  if (error) throw error;
  return (data ?? []) as TipoCosto[];
}

export async function getCategoriasGasto(): Promise<CategoriaGasto[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("categorias_gasto")
    .select("id, nombre, naturaleza, descripcion")
    .order("id");
  if (error) throw error;
  return (data ?? []) as CategoriaGasto[];
}

export type FuenteIngreso = {
  id: string;
  nombre: string;
  descripcion: string | null;
  ejemplos: string | null;
};

export async function getFuentesIngreso(): Promise<FuenteIngreso[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("fuentes_ingreso")
    .select("id, nombre, descripcion, ejemplos")
    .order("id");
  if (error) throw error;
  return (data ?? []) as FuenteIngreso[];
}

export async function getFormasPago(): Promise<FormaPago[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("formas_pago")
    .select("id, nombre, tipo, afecta_cash, genera_cxc_cxp, notas")
    .order("id");
  if (error) throw error;
  return (data ?? []) as FormaPago[];
}
