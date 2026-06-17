/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/db/server";
import { registrarPagoSchema, cambiarEstadoSchema } from "@/lib/validation/cxp";
import { puedeTransicionar, type EstadoCxp } from "@/lib/finance/cxp";

type ActionOk  = { ok: true;  data?: unknown };
type ActionErr = { ok: false; error: string };
export type ActionResult = ActionOk | ActionErr;

// ── Registrar abono a una CXP ─────────────────────────────────
export async function registrarPagoCxpAction(input: {
  cxp_id:         string;
  fecha:          string;
  cuenta_id:      string;
  monto_centavos: number;
  notas?:         string | null;
}): Promise<ActionResult> {
  const parsed = registrarPagoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data, error } = await (supabase as any).rpc("registrar_pago_cxp", {
    p_cxp_id:         parsed.data.cxp_id,
    p_fecha:          parsed.data.fecha,
    p_cuenta_id:      parsed.data.cuenta_id,
    p_monto_centavos: parsed.data.monto_centavos,
    p_notas:          parsed.data.notas ?? null,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/cxp");
  return { ok: true, data };
}

// ── Cambiar estado de una CXP ─────────────────────────────────
export async function cambiarEstadoCxpAction(input: {
  cxp_id:        string;
  nuevo_estado:  string;
  estado_actual: string;
}): Promise<ActionResult> {
  const parsed = cambiarEstadoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  // Defensa en profundidad: validar transición también en servidor
  if (!puedeTransicionar(
    input.estado_actual as EstadoCxp,
    parsed.data.nuevo_estado as EstadoCxp
  )) {
    return {
      ok: false,
      error: `Transición no permitida: ${input.estado_actual} → ${parsed.data.nuevo_estado}`,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data, error } = await (supabase as any).rpc("cambiar_estado_cxp", {
    p_cxp_id:       parsed.data.cxp_id,
    p_nuevo_estado: parsed.data.nuevo_estado,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/cxp");
  return { ok: true, data };
}
