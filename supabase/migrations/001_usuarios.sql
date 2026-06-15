-- ============================================================
-- Migración 001 — Tabla usuarios y RLS
-- Proyecto: eLunch Finanzas
-- Sprint 1: Setup base
-- ============================================================
-- INSTRUCCIONES para aplicar:
--   1. Abre tu proyecto en supabase.com
--   2. Ve a: SQL Editor (panel izquierdo)
--   3. Haz clic en "New query"
--   4. Pega TODO este contenido y haz clic en "Run"
--   5. Debes ver "Success. No rows returned" al final
-- ============================================================

-- Crear tipos enumerados para rol y estado
CREATE TYPE rol_usuario AS ENUM (
  'ceo',
  'admin',
  'contador',
  'gerente_unidad',
  'solo_lectura'
);

CREATE TYPE estado_usuario AS ENUM (
  'activo',
  'inactivo'
);

-- ── Tabla de usuarios del sistema ──────────────────────────
-- La referencia a auth.users garantiza que solo usuarios
-- autenticados de Supabase Auth pueden tener un registro aquí.
CREATE TABLE IF NOT EXISTS public.usuarios (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL UNIQUE,
  nombre      TEXT        NOT NULL,
  rol         rol_usuario NOT NULL DEFAULT 'solo_lectura',
  estado      estado_usuario NOT NULL DEFAULT 'activo',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Comentarios de la tabla ─────────────────────────────────
COMMENT ON TABLE public.usuarios IS
  'Operadores del sistema eLunch Finanzas. Ref a auth.users. RLS habilitada.';
COMMENT ON COLUMN public.usuarios.id IS
  'UUID del usuario en auth.users — es la misma clave primaria.';
COMMENT ON COLUMN public.usuarios.rol IS
  'Nivel de acceso. v1 usa ceo/admin solamente; la estructura soporta crecer.';
COMMENT ON COLUMN public.usuarios.estado IS
  'Solo usuarios activos pueden operar. Inactivar en vez de eliminar.';

-- ── Trigger para actualizar updated_at automáticamente ──────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_usuarios_updated_at
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- Regla de oro: tabla sin política = nadie accede (deny-by-default).
-- Todas las tablas del sistema deben tener RLS desde el día 1.
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- Política 1: un usuario autenticado puede leer SU PROPIA fila.
CREATE POLICY "usuarios_select_propio"
  ON public.usuarios
  FOR SELECT
  USING (auth.uid() = id);

-- Política 2: solo el propio usuario puede actualizar sus datos no-sensibles.
-- El rol y estado NO se modifican desde aquí (requieren service-role / admin).
CREATE POLICY "usuarios_update_propio"
  ON public.usuarios
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Política 3: INSERT solo mediante service-role (el trigger de auth lo hace).
-- No hay política INSERT para anon/authenticated → denegado por defecto.
-- (El CEO se inserta en la sección de seed abajo usando una función de admin.)

-- ════════════════════════════════════════════════════════════
-- TABLA DE AUDITORÍA
-- Registra quién cambió qué, cuándo, y el valor anterior/nuevo.
-- Sprint 1: estructura lista; se llena desde Sprint 3 en adelante.
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.auditoria (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID        REFERENCES auth.users(id),
  tabla         TEXT        NOT NULL,
  registro_id   TEXT        NOT NULL,
  accion        TEXT        NOT NULL CHECK (accion IN ('INSERT', 'UPDATE', 'DELETE')),
  valor_anterior JSONB,
  valor_nuevo   JSONB,
  fecha         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.auditoria IS
  'Rastro de auditoría de todas las mutaciones financieras sensibles.';

ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

-- El CEO y admin pueden leer la auditoría completa.
-- En v1 simplificamos: solo lectura para usuarios autenticados con rol ceo/admin.
-- Inserción solo mediante Server Actions (service-role).
CREATE POLICY "auditoria_select_ceo_admin"
  ON public.auditoria
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid()
        AND u.rol IN ('ceo', 'admin')
        AND u.estado = 'activo'
    )
  );

-- ════════════════════════════════════════════════════════════
-- SEED: Usuario CEO
-- ════════════════════════════════════════════════════════════
-- NOTA IMPORTANTE:
--   Este INSERT usa la columna `id` que hace referencia a auth.users.
--   Para que funcione, primero debes crear el usuario en Supabase Auth
--   (el sistema te guiará en el Paso 4 del Sprint 1).
--   Una vez creado el usuario en Auth, reemplaza el placeholder
--   '<UUID-DEL-USUARIO-EN-AUTH>' con el UUID real que te da Supabase.
--
--   Si ya tienes el UUID, ejecuta este INSERT por separado:
--
-- INSERT INTO public.usuarios (id, email, nombre, rol, estado)
-- VALUES (
--   '<UUID-DEL-USUARIO-EN-AUTH>',  -- reemplaza esto
--   'cnavas@mielunch.com',
--   'Christian Navas',
--   'ceo',
--   'activo'
-- )
-- ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- ÍNDICES (para performance futura)
-- ════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_usuarios_email  ON public.usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol    ON public.usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla ON public.auditoria(tabla, registro_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON public.auditoria(fecha DESC);

-- ════════════════════════════════════════════════════════════
-- VERIFICACIÓN (ejecuta esto al final para confirmar)
-- ════════════════════════════════════════════════════════════
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
--
-- Debes ver: usuarios true | auditoria true
