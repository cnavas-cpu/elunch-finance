import { z } from "zod";

/**
 * Esquema de validación para el formulario de login.
 * Valida tanto en el cliente (UX) como en el servidor (seguridad).
 * Los mensajes de error van en español para el CEO.
 */
export const LoginSchema = z.object({
  email: z
    .string()
    .min(1, { message: "El correo es obligatorio." })
    .email({ message: "Ingresa un correo electrónico válido." })
    .toLowerCase()
    .trim(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
