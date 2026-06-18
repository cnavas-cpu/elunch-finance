/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createSupabaseServerClient } from "@/lib/db/server";
import type { MovimientoFlujo, PagoFlujo } from "@/lib/finance/flujo";

// ── Tipos raw de la base de datos ────────────────────────────────────

export type FlujoTxRow = {
  fecha: string;
  tipo: "venta" | "salida";
  monto_centavos: number;
  formas_pago: { afecta_cash: boolean | null } | null;
};

export type FlujoPagoRow = {
  fecha: string;
  monto_centavos: number;
  cxc_id: string | null;
  cxp_id: string | null;
};

// ── Adaptadores row → tipos puros ────────────────────────────────────

export function rowToMovimientoFlujo(row: FlujoTxRow): MovimientoFlujo {
  return {
    fecha: row.fecha,
    tipo: row.tipo,
    monto_centavos: row.monto_centavos,
    afecta_cash: row.formas_pago?.afecta_cash ?? null,
  };
}

/**
 * Determina si el pago es un cobro (cxc_id != null) o un desembolso (cxp_id != null).
 * La constraint pagos_un_destino garantiza que exactamente uno sea no-null.
 */
export function rowToPagoFlujo(row: FlujoPagoRow): PagoFlujo {
  return {
    fecha: row.fecha,
    monto_centavos: row.monto_centavos,
    es_cobro: row.cxc_id !== null,
  };
}

// ── Query principal ──────────────────────────────────────────────────

/**
 * Obtiene transacciones (con forma_pago) y pagos (con CXC/CXP flag) en el rango dado.
 * Las transacciones traen `formas_pago(afecta_cash)` para separar cash vs crédito.
 * Los pagos traen `cxc_id`/`cxp_id` para determinar si es cobro o desembolso.
 * Ambas queries filtran por rango de fecha (usando índices idx_transacciones_fecha
 * e idx_pagos_fecha para rendimiento).
 *
 * @param desde "YYYY-MM-DD" inclusive
 * @param hasta "YYYY-MM-DD" inclusive
 */
export async function getFlujoRango(
  desde: string,
  hasta: string
): Promise<{ transacciones: FlujoTxRow[]; pagos: FlujoPagoRow[] }> {
  const supabase = await createSupabaseServerClient();

  const [txResult, pagosResult] = await Promise.all([
    (supabase as any)
      .from("transacciones")
      .select(`
        fecha,
        tipo,
        monto_centavos,
        formas_pago(afecta_cash)
      `)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: true }),

    (supabase as any)
      .from("pagos")
      .select(`
        fecha,
        monto_centavos,
        cxc_id,
        cxp_id
      `)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: true }),
  ]);

  if (txResult.error) throw new Error(txResult.error.message);
  if (pagosResult.error) throw new Error(pagosResult.error.message);

  return {
    transacciones: (txResult.data ?? []) as FlujoTxRow[],
    pagos: (pagosResult.data ?? []) as FlujoPagoRow[],
  };
}
