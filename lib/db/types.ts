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

// ── Tipos de catálogos ───────────────────────────────────────

export interface FuenteIngreso {
  id: string;
  nombre: string;
  descripcion: string | null;
  ejemplos: string | null;
  created_at: string;
}

export interface ClienteCorporativo {
  id: string;
  nombre: string;
  alias: string | null;
  relacion: string | null;
  estado: "activo" | "inactivo" | "programado";
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface UnidadNegocio {
  id: string;
  nombre: string;
  fuente_ingreso_id: string | null;
  cliente_corp_id: string | null;
  ubicacion: string | null;
  estado: "activa" | "inactiva" | "programada";
  fecha_inicio: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface TipoCosto {
  id: string;
  tag: string;
  grupo: string | null;
  descripcion: string | null;
  created_at: string;
}

export interface Proveedor {
  id: string;
  nombre: string;
  tag_tipo: string | null;
  dias_credito: number;
  contacto: string | null;
  estado: "activo" | "inactivo";
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoriaGasto {
  id: string;
  nombre: string;
  naturaleza: string | null;
  descripcion: string | null;
  created_at: string;
}

export interface FormaPago {
  id: string;
  nombre: string;
  tipo: string | null;
  afecta_cash: boolean | null;
  genera_cxc_cxp: boolean;
  notas: string | null;
  created_at: string;
}

export interface CuentaBancaria {
  id: string;
  nombre: string;
  tipo: "efectivo" | "banco" | "tarjeta_credito" | "otro";
  moneda: string;
  estado: "activa" | "inactiva";
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface TipoAsignacion {
  id: string;
  nombre: string;
  definicion: string | null;
  ejemplos: string | null;
  created_at: string;
}

export interface EstadoCxc {
  id: string;
  estado: string;
  orden: number;
  descripcion: string | null;
  created_at: string;
}

export interface EstadoCxp {
  id: string;
  estado: string;
  orden: number;
  descripcion: string | null;
  created_at: string;
}

// ── Tipo Database (requerido por el cliente Supabase) ────────
// Relationships: [] en todas las tablas — requerido por GenericTable de postgrest-js.
// Se expande con cada sprint.
export interface Database {
  public: {
    Tables: {
      usuarios: {
        Row: Usuario;
        Insert: Omit<Usuario, "created_at" | "updated_at">;
        Update: Partial<Omit<Usuario, "id" | "created_at">>;
        Relationships: [];
      };
      fuentes_ingreso: {
        Row: FuenteIngreso;
        Insert: Omit<FuenteIngreso, "created_at">;
        Update: Partial<Omit<FuenteIngreso, "id">>;
        Relationships: [];
      };
      clientes_corporativos: {
        Row: ClienteCorporativo;
        Insert: {
          id: string;
          nombre: string;
          alias?: string | null;
          relacion?: string | null;
          estado?: "activo" | "inactivo" | "programado";
          notas?: string | null;
        };
        Update: {
          nombre?: string;
          alias?: string | null;
          relacion?: string | null;
          estado?: "activo" | "inactivo" | "programado";
          notas?: string | null;
        };
        Relationships: [];
      };
      unidades_negocio: {
        Row: UnidadNegocio;
        Insert: {
          id: string;
          nombre: string;
          fuente_ingreso_id?: string | null;
          cliente_corp_id?: string | null;
          ubicacion?: string | null;
          estado?: "activa" | "inactiva" | "programada";
          fecha_inicio?: string | null;
          notas?: string | null;
        };
        Update: {
          nombre?: string;
          fuente_ingreso_id?: string | null;
          cliente_corp_id?: string | null;
          ubicacion?: string | null;
          estado?: "activa" | "inactiva" | "programada";
          fecha_inicio?: string | null;
          notas?: string | null;
        };
        Relationships: [];
      };
      tipos_costo: {
        Row: TipoCosto;
        Insert: Omit<TipoCosto, "created_at">;
        Update: Partial<Omit<TipoCosto, "id">>;
        Relationships: [];
      };
      proveedores: {
        Row: Proveedor;
        Insert: {
          id: string;
          nombre: string;
          tag_tipo?: string | null;
          dias_credito?: number;
          contacto?: string | null;
          estado?: "activo" | "inactivo";
          notas?: string | null;
        };
        Update: {
          nombre?: string;
          tag_tipo?: string | null;
          dias_credito?: number;
          contacto?: string | null;
          estado?: "activo" | "inactivo";
          notas?: string | null;
        };
        Relationships: [];
      };
      categorias_gasto: {
        Row: CategoriaGasto;
        Insert: Omit<CategoriaGasto, "created_at">;
        Update: Partial<Omit<CategoriaGasto, "id">>;
        Relationships: [];
      };
      formas_pago: {
        Row: FormaPago;
        Insert: Omit<FormaPago, "created_at">;
        Update: Partial<Omit<FormaPago, "id">>;
        Relationships: [];
      };
      cuentas_bancarias: {
        Row: CuentaBancaria;
        Insert: {
          id: string;
          nombre: string;
          tipo?: "efectivo" | "banco" | "tarjeta_credito" | "otro";
          moneda?: string;
          estado?: "activa" | "inactiva";
          notas?: string | null;
        };
        Update: {
          nombre?: string;
          tipo?: "efectivo" | "banco" | "tarjeta_credito" | "otro";
          moneda?: string;
          estado?: "activa" | "inactiva";
          notas?: string | null;
        };
        Relationships: [];
      };
      tipos_asignacion: {
        Row: TipoAsignacion;
        Insert: Omit<TipoAsignacion, "created_at">;
        Update: Partial<Omit<TipoAsignacion, "id">>;
        Relationships: [];
      };
      estados_cxc: {
        Row: EstadoCxc;
        Insert: Omit<EstadoCxc, "created_at">;
        Update: Partial<Omit<EstadoCxc, "id">>;
        Relationships: [];
      };
      estados_cxp: {
        Row: EstadoCxp;
        Insert: Omit<EstadoCxp, "created_at">;
        Update: Partial<Omit<EstadoCxp, "id">>;
        Relationships: [];
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
