/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";
// app/(app)/cxc/actions.ts — Server Actions de Cuentas por Cobrar
// Espeja app/(app)/cxp/actions.ts adaptando para cobranza.
// Defensa en profundidad: valida Zod en servidor + verifica puedeTransicionar
// antes de llamar al RPC (que también valida en SQL).

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/db/server";
import {
  registrarCobroSchema,
  cambiarEstadoCxcSchema,
  actualizarEvidenciaSchema,
} from "@/lib/validation/cxc";
import { puedeTransicionar, type EstadoCxc } from "@/lib/finance/cxc";

type ActionOk  = { ok: true;  data?: unknown };
type ActionErr = { ok: false; error: string };
export type ActionResult = ActionOk | ActionErr;

// ── Registrar cobro ───────────────────────────────────────────────

export async function registrarCobroCxcAction(input: unknown): Promise<ActionResult> {
  const parsed = registrarCobroSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data, error } = await (supabase as any).rpc("registrar_pago_cxc", {
    p_cxc_id:         parsed.data.cxc_id,
    p_fecha:          parsed.data.fecha,
    p_cuenta_id:      parsed.data.cuenta_id,
    p_monto_centavos: parsed.data.monto_centavos,
    p_notas:          parsed.data.notas ?? null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/cxc");
  return { ok: true, data };
}

// ── Cambiar estado (transiciones manuales) ────────────────────────

export async function cambiarEstadoCxcAction(input: {
  cxc_id:        string;
  nuevo_estado:  string;
  estado_actual: string;
}): Promise<ActionResult> {
  // Validar schema (excluye 'Pagada' y 'Generada')
  const parsed = cambiarEstadoCxcSchema.safeParse({
    cxc_id:       input.cxc_id,
    nuevo_estado: input.nuevo_estado,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  // Verificar máquina de estados en TS (defensa en profundidad; el SQL también valida)
  if (!puedeTransicionar(input.estado_actual as EstadoCxc, parsed.data.nuevo_estado as EstadoCxc)) {
    return { ok: false, error: "Transición de estado no permitida" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data, error } = await (supabase as any).rpc("cambiar_estado_cxc", {
    p_cxc_id:       parsed.data.cxc_id,
    p_nuevo_estado: parsed.data.nuevo_estado,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/cxc");
  return { ok: true, data };
}

// ── Actualizar evidencia ──────────────────────────────────────────

export async function actualizarEvidenciaCxcAction(input: unknown): Promise<ActionResult> {
  const parsed = actualizarEvidenciaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data, error } = await (supabase as any).rpc("actualizar_evidencia_cxc", {
    p_cxc_id:      parsed.data.cxc_id,
    p_num_oc:      parsed.data.num_oc      ?? null,
    p_num_factura: parsed.data.num_factura ?? null,
    p_notas:       parsed.data.notas       ?? null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/cxc");
  return { ok: true, data };
}
