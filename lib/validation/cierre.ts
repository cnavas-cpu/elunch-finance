import { z } from "zod";

const fechaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (usar formato YYYY-MM-DD)");

const montoSchema = z
  .number()
  .int("El monto debe ser un número entero de centavos")
  .positive("El monto debe ser mayor que $0.00");

export const ventaInputSchema = z.object({
  fecha:           fechaSchema,
  unidad_id:       z.string().min(1, "Selecciona una unidad de negocio"),
  monto_centavos:  montoSchema,
  forma_pago_id:   z.string().min(1, "Selecciona una forma de pago"),
  cuenta_id:       z.string().nullable().optional(),
  cliente_id:      z.string().nullable().optional(),
  descripcion:     z.string().max(300).nullable().optional(),
  fecha_esperada:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), // Sprint 5
});

export const salidaInputSchema = z.object({
  fecha:               fechaSchema,
  descripcion:         z.string().min(1, "Ingresa una descripción").max(300),
  monto_centavos:      montoSchema,
  forma_pago_id:       z.string().min(1, "Selecciona una forma de pago"),
  asignacion:          z.enum(["pool", "directa"]).default("pool"),
  unidad_id:           z.string().nullable().optional(),
  categoria_gasto_id:  z.string().nullable().optional(),
  proveedor_id:        z.string().nullable().optional(),
  tipo_costo_id:       z.string().nullable().optional(),
  cuenta_id:           z.string().nullable().optional(),
  fecha_vencimiento:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export type VentaInput  = z.infer<typeof ventaInputSchema>;
export type SalidaInput = z.infer<typeof salidaInputSchema>;
