import { z } from "zod";

const fechaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (usar formato YYYY-MM-DD)");

const montoSchema = z
  .number()
  .int("El monto debe ser un número entero de centavos")
  .positive("El monto debe ser mayor que $0.00");

const uuidSchema = z
  .string()
  .uuid("ID inválido");

/** Validación de un abono parcial o total a una CXP. */
export const registrarPagoSchema = z.object({
  cxp_id:         uuidSchema,
  fecha:          fechaSchema,
  cuenta_id:      z.string().min(1, "Selecciona una cuenta bancaria"),
  monto_centavos: montoSchema,
  notas:          z.string().max(300).nullable().optional(),
});

/** Validación de un cambio de estado manual (excluye Pagada y Vencida). */
export const cambiarEstadoSchema = z.object({
  cxp_id:       uuidSchema,
  nuevo_estado: z.enum(["Pendiente", "Programada", "En disputa"]),
});

export type RegistrarPagoInput = z.infer<typeof registrarPagoSchema>;
export type CambiarEstadoInput = z.infer<typeof cambiarEstadoSchema>;
