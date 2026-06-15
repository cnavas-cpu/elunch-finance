"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/db/server";
import { z } from "zod";

// Helper: mutaciones typadas. Los datos vienen pre-validados por Zod.
// Los tipos exactos de Supabase se regenerarán con `supabase gen types` tras la migración.
async function dbInsert(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  table: string,
  data: Record<string, unknown>
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from(table).insert(data);
}

async function dbUpdate(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  table: string,
  data: Record<string, unknown>,
  idField: string,
  idValue: string
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from(table).update(data).eq(idField, idValue);
}

// ── Schemas de validación ─────────────────────────────────

const ProveedorSchema = z.object({
  id: z.string().min(1).max(10).trim(),
  nombre: z.string().min(1, "El nombre es obligatorio.").max(100).trim(),
  tag_tipo: z.string().nullable().optional(),
  dias_credito: z.coerce.number().int().min(0).max(365),
  estado: z.enum(["activo", "inactivo"]),
  notas: z.string().max(500).nullable().optional(),
  contacto: z.string().max(200).nullable().optional(),
});

const ClienteSchema = z.object({
  id: z.string().min(1).max(10).trim(),
  nombre: z.string().min(1, "El nombre es obligatorio.").max(100).trim(),
  alias: z.string().max(50).nullable().optional(),
  relacion: z.string().max(200).nullable().optional(),
  estado: z.enum(["activo", "inactivo", "programado"]),
  notas: z.string().max(500).nullable().optional(),
});

const UnidadSchema = z.object({
  id: z.string().min(1).max(10).trim(),
  nombre: z.string().min(1, "El nombre es obligatorio.").max(100).trim(),
  fuente_ingreso_id: z.string().nullable().optional(),
  cliente_corp_id: z.string().nullable().optional(),
  ubicacion: z.string().max(100).nullable().optional(),
  estado: z.enum(["activa", "inactiva", "programada"]),
  fecha_inicio: z.string().nullable().optional(),
  notas: z.string().max(500).nullable().optional(),
});

const CuentaSchema = z.object({
  id: z.string().min(1).max(10).trim(),
  nombre: z.string().min(1, "El nombre es obligatorio.").max(100).trim(),
  tipo: z.enum(["efectivo", "banco", "tarjeta_credito", "otro"]),
  moneda: z.string().length(3).default("USD"),
  estado: z.enum(["activa", "inactiva"]),
  notas: z.string().max(500).nullable().optional(),
});

// ── Helper: leer FormData a objeto plano ─────────────────

function fd(formData: FormData) {
  const raw: Record<string, string | null> = {};
  for (const [key, val] of formData.entries()) {
    raw[key] = typeof val === "string" && val.trim() === "" ? null : (val as string);
  }
  return raw;
}

// ── Proveedores ──────────────────────────────────────────

export type ProveedorState = { error?: string; ok?: boolean } | null;

export async function upsertProveedor(
  _prev: ProveedorState,
  formData: FormData
): Promise<ProveedorState> {
  const raw = fd(formData);
  const result = ProveedorSchema.safeParse({
    ...raw,
    dias_credito: raw.dias_credito ?? 0,
    estado: raw.estado ?? "activo",
  });
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const supabase = await createSupabaseServerClient();
  const isNew = formData.get("_accion") === "nuevo";
  const d = result.data;
  const row = {
    id: d.id,
    nombre: d.nombre,
    tag_tipo: d.tag_tipo ?? null,
    dias_credito: d.dias_credito,
    contacto: d.contacto ?? null,
    estado: d.estado,
    notas: d.notas ?? null,
  };
  const { error } = isNew
    ? await dbInsert(supabase, "proveedores", row)
    : await dbUpdate(supabase, "proveedores", row, "id", row.id);
  if (error) return { error: "No se pudo guardar el proveedor. " + error.message };
  revalidatePath("/catalogos/proveedores");
  return { ok: true };
}

export async function deleteProveedor(id: string): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("proveedores").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar. " + error.message };
  revalidatePath("/catalogos/proveedores");
  return {};
}

// ── Clientes corporativos ────────────────────────────────

export type ClienteState = { error?: string; ok?: boolean } | null;

export async function upsertCliente(
  _prev: ClienteState,
  formData: FormData
): Promise<ClienteState> {
  const raw = fd(formData);
  const result = ClienteSchema.safeParse({ ...raw, estado: raw.estado ?? "activo" });
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const supabase = await createSupabaseServerClient();
  const isNew = formData.get("_accion") === "nuevo";
  const d = result.data;
  const row = {
    id: d.id,
    nombre: d.nombre,
    alias: d.alias ?? null,
    relacion: d.relacion ?? null,
    estado: d.estado,
    notas: d.notas ?? null,
  };
  const { error } = isNew
    ? await dbInsert(supabase, "clientes_corporativos", row)
    : await dbUpdate(supabase, "clientes_corporativos", row, "id", row.id);
  if (error) return { error: "No se pudo guardar el cliente. " + error.message };
  revalidatePath("/catalogos/clientes");
  return { ok: true };
}

export async function deleteCliente(id: string): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("clientes_corporativos").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar. " + error.message };
  revalidatePath("/catalogos/clientes");
  return {};
}

// ── Unidades de negocio ──────────────────────────────────

export type UnidadState = { error?: string; ok?: boolean } | null;

export async function upsertUnidad(
  _prev: UnidadState,
  formData: FormData
): Promise<UnidadState> {
  const raw = fd(formData);
  const result = UnidadSchema.safeParse({ ...raw, estado: raw.estado ?? "activa" });
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const supabase = await createSupabaseServerClient();
  const isNew = formData.get("_accion") === "nuevo";
  const d = result.data;
  const row = {
    id: d.id,
    nombre: d.nombre,
    fuente_ingreso_id: d.fuente_ingreso_id ?? null,
    cliente_corp_id: d.cliente_corp_id ?? null,
    ubicacion: d.ubicacion ?? null,
    estado: d.estado,
    fecha_inicio: d.fecha_inicio ?? null,
    notas: d.notas ?? null,
  };
  const { error } = isNew
    ? await dbInsert(supabase, "unidades_negocio", row)
    : await dbUpdate(supabase, "unidades_negocio", row, "id", row.id);
  if (error) return { error: "No se pudo guardar la unidad. " + error.message };
  revalidatePath("/catalogos/unidades");
  return { ok: true };
}

export async function deleteUnidad(id: string): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("unidades_negocio").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar. " + error.message };
  revalidatePath("/catalogos/unidades");
  return {};
}

// ── Cuentas bancarias ────────────────────────────────────

export type CuentaState = { error?: string; ok?: boolean } | null;

export async function upsertCuenta(
  _prev: CuentaState,
  formData: FormData
): Promise<CuentaState> {
  const raw = fd(formData);
  const result = CuentaSchema.safeParse({ ...raw, estado: raw.estado ?? "activa" });
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const supabase = await createSupabaseServerClient();
  const isNew = formData.get("_accion") === "nuevo";
  const d = result.data;
  const row = {
    id: d.id,
    nombre: d.nombre,
    tipo: d.tipo,
    moneda: d.moneda,
    estado: d.estado,
    notas: d.notas ?? null,
  };
  const { error } = isNew
    ? await dbInsert(supabase, "cuentas_bancarias", row)
    : await dbUpdate(supabase, "cuentas_bancarias", row, "id", row.id);
  if (error) return { error: "No se pudo guardar la cuenta. " + error.message };
  revalidatePath("/catalogos/cuentas");
  return { ok: true };
}

export async function deleteCuenta(id: string): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("cuentas_bancarias").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar. " + error.message };
  revalidatePath("/catalogos/cuentas");
  return {};
}
