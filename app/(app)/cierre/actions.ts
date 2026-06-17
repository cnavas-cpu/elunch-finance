/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createSupabaseServerClient } from "@/lib/db/server";
import { ventaInputSchema, salidaInputSchema } from "@/lib/validation/cierre";
import type { TransaccionDisplay } from "@/lib/db/cierre";

type ActionOk  = { ok: true;  data: TransaccionDisplay };
type ActionErr = { ok: false; error: string };
type ActionResult = ActionOk | ActionErr;

const TX_SELECT = `
  id, fecha, tipo, monto_centavos, descripcion, asignacion,
  unidad_id, forma_pago_id, cuenta_id, created_at,
  unidades_negocio(id, nombre),
  formas_pago(id, nombre, tipo, afecta_cash, genera_cxc_cxp),
  cuentas_bancarias(id, nombre, tipo),
  categorias_gasto(id, nombre),
  proveedores(id, nombre)
`;

async function fetchTx(id: string): Promise<TransaccionDisplay> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await (supabase as any)
    .from("transacciones")
    .select(TX_SELECT)
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data as TransaccionDisplay;
}

// ── Registrar venta ──────────────────────────────────────────
export async function registrarVentaAction(input: {
  fecha:           string;
  unidad_id:       string;
  monto_centavos:  number;
  forma_pago_id:   string;
  cuenta_id?:      string | null;
  cliente_id?:     string | null;
  descripcion?:    string | null;
  fecha_esperada?: string | null;  // Sprint 5
}): Promise<ActionResult> {
  const parsed = ventaInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data: rpc, error: rpcErr } = await (supabase as any).rpc("crear_venta", {
    p_fecha:           parsed.data.fecha,
    p_monto_centavos:  parsed.data.monto_centavos,
    p_unidad_id:       parsed.data.unidad_id,
    p_forma_pago_id:   parsed.data.forma_pago_id,
    p_cuenta_id:       parsed.data.cuenta_id      ?? null,
    p_cliente_id:      parsed.data.cliente_id     ?? null,
    p_descripcion:     parsed.data.descripcion    ?? null,
    p_fecha_esperada:  parsed.data.fecha_esperada ?? null,  // Sprint 5
  });

  if (rpcErr) return { ok: false, error: rpcErr.message };

  try {
    const tx = await fetchTx(rpc.id);
    return { ok: true, data: tx };
  } catch (e: unknown) {
    return { ok: false, error: (e as Error).message };
  }
}

// ── Registrar salida ─────────────────────────────────────────
export async function registrarSalidaAction(input: {
  fecha:              string;
  descripcion:        string;
  monto_centavos:     number;
  forma_pago_id:      string;
  asignacion?:        "pool" | "directa";
  unidad_id?:         string | null;
  categoria_gasto_id?: string | null;
  proveedor_id?:      string | null;
  tipo_costo_id?:     string | null;
  cuenta_id?:         string | null;
  fecha_vencimiento?: string | null;
}): Promise<ActionResult> {
  const parsed = salidaInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data: rpc, error: rpcErr } = await (supabase as any).rpc("crear_salida", {
    p_fecha:              parsed.data.fecha,
    p_monto_centavos:     parsed.data.monto_centavos,
    p_descripcion:        parsed.data.descripcion,
    p_forma_pago_id:      parsed.data.forma_pago_id,
    p_asignacion:         parsed.data.asignacion         ?? "pool",
    p_unidad_id:          parsed.data.unidad_id          ?? null,
    p_categoria_gasto_id: parsed.data.categoria_gasto_id ?? null,
    p_proveedor_id:       parsed.data.proveedor_id       ?? null,
    p_tipo_costo_id:      parsed.data.tipo_costo_id      ?? null,
    p_cuenta_id:          parsed.data.cuenta_id          ?? null,
    p_fecha_vencimiento:  parsed.data.fecha_vencimiento  ?? null,
  });

  if (rpcErr) return { ok: false, error: rpcErr.message };

  try {
    const tx = await fetchTx(rpc.id);
    return { ok: true, data: tx };
  } catch (e: unknown) {
    return { ok: false, error: (e as Error).message };
  }
}

// ── Eliminar transacción ─────────────────────────────────────
export async function eliminarTransaccionAction(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { error } = await (supabase as any).rpc("eliminar_transaccion", { p_id: id });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
