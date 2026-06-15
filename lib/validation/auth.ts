import { z } from "zod";

export const LoginSchema = z.object({
  email: z
    .string()
    .min(1, { message: "El correo es obligatorio." })
    .email({ message: "Ingresa un correo electrónico válido." })
    .toLowerCase()
    .trim(),
  password: z.string().optional(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
