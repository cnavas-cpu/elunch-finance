// lib/validation/cxc.ts — Schemas Zod para las acciones de CXC
// Espeja lib/validation/cxp.ts adaptando para cobranza.
// NOTA: 'En Recuperacion' sin tilde (valor BD); la tilde es solo etiqueta visual.

import { z } from "zod";

const fechaSchema  = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (usar YYYY-MM-DD)");
const montoSchema  = z.number().int().positive("El monto debe ser mayor a cero");
const uuidSchema   = z.string().uuid("Identificador inválido");

// ── Registrar cobro ───────────────────────────────────────────────

export const registrarCobroSchema = z.object({
  cxc_id:          uuidSchema,
  fecha:           fechaSchema,
  cuenta_id:       z.string().min(1, "Selecciona una cuenta bancaria"),
  monto_centavos:  montoSchema,
  notas:           z.string().max(300).nullable().optional(),
});

// ── Cambiar estado (transiciones manuales) ────────────────────────
// Solo los 5 destinos manuales; 'Pagada' y 'Generada' quedan excluidos.

export const cambiarEstadoCxcSchema = z.object({
  cxc_id:       uuidSchema,
  nuevo_estado: z.enum([
    "OC Recibida",
    "Facturada",
    "Programada Pago",
    "En Recuperacion",
    "Incobrable",
  ]),
});

// ── Actualizar evidencia ──────────────────────────────────────────

export const actualizarEvidenciaSchema = z.object({
  cxc_id:      uuidSchema,
  num_oc:      z.string().max(60).nullable().optional(),
  num_factura: z.string().max(60).nullable().optional(),
  notas:       z.string().max(500).nullable().optional(),
});

// ── Tipos inferidos ───────────────────────────────────────────────

export type RegistrarCobroInput      = z.infer<typeof registrarCobroSchema>;
export type CambiarEstadoCxcInput    = z.infer<typeof cambiarEstadoCxcSchema>;
export type ActualizarEvidenciaInput = z.infer<typeof actualizarEvidenciaSchema>;
