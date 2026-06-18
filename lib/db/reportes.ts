/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createSupabaseServerClient } from "@/lib/db/server";
import type { TransaccionPnl, TransaccionPnlConFecha, Naturaleza } from "@/lib/finance/pnl";

// ── Tipo raw de la base de datos ─────────────────────────────

export type TransaccionPnlRow = {
  fecha: string;
  tipo: "venta" | "salida";
  monto_centavos: number;
  unidad_id: string | null;
  asignacion: "pool" | "directa" | null;
  tipo_costo_id: string | null;
  categoria_gasto_id: string | null;
  categorias_gasto: { id: string; nombre: string; naturaleza: string | null } | null;
};

// ── Adaptador row → TransaccionPnl ───────────────────────────

/**
 * Mapea una fila de Supabase al tipo puro TransaccionPnl.
 * Resuelve la naturaleza desde el join de categorias_gasto.
 */
export function rowToTransaccionPnl(row: TransaccionPnlRow): TransaccionPnl {
  const naturalezaRaw = row.categorias_gasto?.naturaleza ?? null;
  const NATURALEZAS_VALIDAS: Naturaleza[] = [
    "Operativo", "Fijo", "Variable", "Otros",
    "Financiero", "Activo", "Costo Directo Unidad",
  ];
  const categoria_naturaleza: Naturaleza | null =
    naturalezaRaw !== null && (NATURALEZAS_VALIDAS as string[]).includes(naturalezaRaw)
      ? (naturalezaRaw as Naturaleza)
      : null;

  return {
    tipo: row.tipo,
    monto_centavos: row.monto_centavos,
    unidad_id: row.unidad_id,
    asignacion: row.asignacion,
    tipo_costo_id: row.tipo_costo_id,
    categoria_gasto_id: row.categoria_gasto_id,
    categoria_naturaleza,
  };
}

/**
 * Mapea una fila al tipo con fecha (para serieDePnl).
 */
export function rowToTransaccionPnlConFecha(row: TransaccionPnlRow): TransaccionPnlConFecha {
  return { ...rowToTransaccionPnl(row), fecha: row.fecha };
}

// ── Query principal ──────────────────────────────────────────

/**
 * Obtiene todas las transacciones (ventas y salidas) en el rango de fechas dado.
 * Trae tipo_costo_id, categoria_gasto_id y el join de naturaleza.
 * NO trae formas_pago/cuentas/proveedores (P&L devengado no los necesita).
 * @param desde "YYYY-MM-DD" inclusive
 * @param hasta "YYYY-MM-DD" inclusive
 */
export async function getTransaccionesRango(
  desde: string,
  hasta: string
): Promise<TransaccionPnlRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await (supabase as any)
    .from("transacciones")
    .select(`
      fecha,
      tipo,
      monto_centavos,
      unidad_id,
      asignacion,
      tipo_costo_id,
      categoria_gasto_id,
      categorias_gasto(id, nombre, naturaleza)
    `)
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as TransaccionPnlRow[];
}
