/**
 * Tipos de la base de datos eLunch Finanzas.
 * Generados manualmente por ahora; en el futuro se puede auto-generar
 * con: npx supabase gen types typescript --project-id <id>
 *
 * Nombres de tablas y campos en snake_case español (per CLAUDE.md §5).
 */

export type RolUsuario =
  | "ceo"
  | "admin"
  | "contador"
  | "gerente_unidad"
  | "solo_lectura";

export type EstadoUsuario = "activo" | "inactivo";

export interface Usuario {
  id: string; // UUID — referencia a auth.users
  email: string;
  nombre: string;
  rol: RolUsuario;
  estado: EstadoUsuario;
  created_at: string;
  updated_at: string;
}

// Tipo Database requerido por el cliente Supabase genérico.
// Se irá expandiendo con cada sprint.
export interface Database {
  public: {
    Tables: {
      usuarios: {
        Row: Usuario;
        Insert: Omit<Usuario, "created_at" | "updated_at">;
        Update: Partial<Omit<Usuario, "id" | "created_at">>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      rol_usuario: RolUsuario;
      estado_usuario: EstadoUsuario;
    };
  };
}
