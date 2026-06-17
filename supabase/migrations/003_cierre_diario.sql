-- ============================================================
-- MIGRACIÓN 003 — Cierre Diario (Sprint 3)
-- Tablas núcleo: transacciones, cuentas_x_cobrar, cuentas_x_pagar
-- RLS habilitada. Funciones RPC atómicas para crear transacciones
-- con CXC/CXP generadas en la misma transacción de base de datos.
-- ============================================================

-- ── Transacciones (núcleo del cierre diario) ────────────────
CREATE TABLE transacciones (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha               DATE NOT NULL,
  tipo                TEXT NOT NULL CHECK (tipo IN ('venta', 'salida')),
  monto_centavos      BIGINT NOT NULL CHECK (monto_centavos > 0),
  descripcion         TEXT,

  -- Contexto de negocio
  unidad_id           VARCHAR(10) REFERENCES unidades_negocio(id),

  -- Solo para salidas
  categoria_gasto_id  VARCHAR(10) REFERENCES categorias_gasto(id),
  proveedor_id        VARCHAR(10) REFERENCES proveedores(id),
  tipo_costo_id       VARCHAR(10) REFERENCES tipos_costo(id),
  asignacion          TEXT DEFAULT 'pool' CHECK (asignacion IN ('pool', 'directa')),

  -- Pago
  forma_pago_id       VARCHAR(10) NOT NULL REFERENCES formas_pago(id),
  cuenta_id           VARCHAR(10) REFERENCES cuentas_bancarias(id),

  -- Auditoría
  registrado_por      UUID REFERENCES usuarios(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE transacciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura autenticada" ON transacciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "mutacion ceo admin"  ON transacciones FOR ALL    TO authenticated
  USING      ((SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('ceo','admin'))
  WITH CHECK ((SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('ceo','admin'));

CREATE TRIGGER set_transacciones_updated_at
  BEFORE UPDATE ON transacciones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Cuentas por cobrar ──────────────────────────────────────
-- Auto-generadas desde ventas a crédito; gestionadas en Sprint 4.
CREATE TABLE cuentas_x_cobrar (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaccion_id    UUID REFERENCES transacciones(id) ON DELETE CASCADE,
  unidad_id         VARCHAR(10) REFERENCES unidades_negocio(id),
  cliente_id        VARCHAR(10) REFERENCES clientes_corporativos(id),
  monto_centavos    BIGINT NOT NULL CHECK (monto_centavos > 0),
  fecha_emision     DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_esperada    DATE,
  estado            TEXT NOT NULL DEFAULT 'Generada'
                    CHECK (estado IN ('Generada','OC Recibida','Facturada','Programada Pago','Pagada','En Recuperacion','Incobrable')),
  notas             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cuentas_x_cobrar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura autenticada" ON cuentas_x_cobrar FOR SELECT TO authenticated USING (true);
CREATE POLICY "mutacion ceo admin"  ON cuentas_x_cobrar FOR ALL    TO authenticated
  USING      ((SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('ceo','admin'))
  WITH CHECK ((SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('ceo','admin'));

CREATE TRIGGER set_cxc_updated_at
  BEFORE UPDATE ON cuentas_x_cobrar
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Cuentas por pagar ───────────────────────────────────────
-- Auto-generadas desde compras a crédito; gestionadas en Sprint 4.
CREATE TABLE cuentas_x_pagar (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaccion_id    UUID REFERENCES transacciones(id) ON DELETE CASCADE,
  proveedor_id      VARCHAR(10) REFERENCES proveedores(id),
  monto_centavos    BIGINT NOT NULL CHECK (monto_centavos > 0),
  fecha_emision     DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  estado            TEXT NOT NULL DEFAULT 'Pendiente'
                    CHECK (estado IN ('Pendiente','Programada','Pagada','Vencida','En disputa')),
  notas             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cuentas_x_pagar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura autenticada" ON cuentas_x_pagar FOR SELECT TO authenticated USING (true);
CREATE POLICY "mutacion ceo admin"  ON cuentas_x_pagar FOR ALL    TO authenticated
  USING      ((SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('ceo','admin'))
  WITH CHECK ((SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('ceo','admin'));

CREATE TRIGGER set_cxp_updated_at
  BEFORE UPDATE ON cuentas_x_pagar
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- FUNCIONES RPC ATÓMICAS
-- SECURITY DEFINER para garantizar atomicidad (transacción BD).
-- La autorización se verifica manualmente dentro de cada función.
-- ============================================================

-- ── crear_venta ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION crear_venta(
  p_fecha           DATE,
  p_monto_centavos  BIGINT,
  p_unidad_id       VARCHAR(10),
  p_forma_pago_id   VARCHAR(10),
  p_cuenta_id       VARCHAR(10) DEFAULT NULL,
  p_cliente_id      VARCHAR(10) DEFAULT NULL,
  p_descripcion     TEXT        DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx_id         UUID;
  v_genera_cxc    BOOLEAN;
  v_cliente_final VARCHAR(10);
  v_user_rol      TEXT;
BEGIN
  -- Verificar autorización
  SELECT rol INTO v_user_rol FROM usuarios WHERE id = auth.uid();
  IF v_user_rol NOT IN ('ceo', 'admin') THEN
    RAISE EXCEPTION 'Acceso denegado: solo CEO o admin pueden registrar transacciones';
  END IF;

  -- Obtener metadatos de forma de pago
  SELECT genera_cxc_cxp INTO v_genera_cxc
  FROM formas_pago WHERE id = p_forma_pago_id;

  -- Insertar transacción
  INSERT INTO transacciones (fecha, tipo, monto_centavos, unidad_id, forma_pago_id, cuenta_id, descripcion, registrado_por)
  VALUES (p_fecha, 'venta', p_monto_centavos, p_unidad_id, p_forma_pago_id, p_cuenta_id, p_descripcion, auth.uid())
  RETURNING id INTO v_tx_id;

  -- Auto-crear CXC si la forma de pago lo requiere
  IF v_genera_cxc THEN
    IF p_cliente_id IS NOT NULL THEN
      v_cliente_final := p_cliente_id;
    ELSE
      SELECT cliente_corp_id INTO v_cliente_final FROM unidades_negocio WHERE id = p_unidad_id;
    END IF;

    INSERT INTO cuentas_x_cobrar (transaccion_id, unidad_id, cliente_id, monto_centavos, fecha_emision, estado)
    VALUES (v_tx_id, p_unidad_id, v_cliente_final, p_monto_centavos, p_fecha, 'Generada');
  END IF;

  RETURN jsonb_build_object(
    'id',          v_tx_id::text,
    'tipo',        'venta',
    'genera_cxc',  COALESCE(v_genera_cxc, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION crear_venta FROM PUBLIC;
GRANT EXECUTE ON FUNCTION crear_venta TO authenticated;

-- ── crear_salida ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION crear_salida(
  p_fecha               DATE,
  p_monto_centavos      BIGINT,
  p_descripcion         TEXT,
  p_forma_pago_id       VARCHAR(10),
  p_asignacion          TEXT        DEFAULT 'pool',
  p_unidad_id           VARCHAR(10) DEFAULT NULL,
  p_categoria_gasto_id  VARCHAR(10) DEFAULT NULL,
  p_proveedor_id        VARCHAR(10) DEFAULT NULL,
  p_tipo_costo_id       VARCHAR(10) DEFAULT NULL,
  p_cuenta_id           VARCHAR(10) DEFAULT NULL,
  p_fecha_vencimiento   DATE        DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx_id      UUID;
  v_genera_cxp BOOLEAN;
  v_user_rol   TEXT;
BEGIN
  -- Verificar autorización
  SELECT rol INTO v_user_rol FROM usuarios WHERE id = auth.uid();
  IF v_user_rol NOT IN ('ceo', 'admin') THEN
    RAISE EXCEPTION 'Acceso denegado: solo CEO o admin pueden registrar transacciones';
  END IF;

  -- Obtener metadatos de forma de pago
  SELECT genera_cxc_cxp INTO v_genera_cxp
  FROM formas_pago WHERE id = p_forma_pago_id;

  -- Insertar transacción
  INSERT INTO transacciones (
    fecha, tipo, monto_centavos, descripcion,
    forma_pago_id, asignacion, unidad_id,
    categoria_gasto_id, proveedor_id, tipo_costo_id,
    cuenta_id, registrado_por
  )
  VALUES (
    p_fecha, 'salida', p_monto_centavos, p_descripcion,
    p_forma_pago_id, p_asignacion, p_unidad_id,
    p_categoria_gasto_id, p_proveedor_id, p_tipo_costo_id,
    p_cuenta_id, auth.uid()
  )
  RETURNING id INTO v_tx_id;

  -- Auto-crear CXP si la forma de pago lo requiere
  IF v_genera_cxp AND p_proveedor_id IS NOT NULL THEN
    INSERT INTO cuentas_x_pagar (transaccion_id, proveedor_id, monto_centavos, fecha_emision, fecha_vencimiento, estado)
    VALUES (v_tx_id, p_proveedor_id, p_monto_centavos, p_fecha, p_fecha_vencimiento, 'Pendiente');
  END IF;

  RETURN jsonb_build_object(
    'id',          v_tx_id::text,
    'tipo',        'salida',
    'genera_cxp',  COALESCE(v_genera_cxp, false) AND p_proveedor_id IS NOT NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION crear_salida FROM PUBLIC;
GRANT EXECUTE ON FUNCTION crear_salida TO authenticated;

-- ── eliminar_transaccion ──────────────────────────────────────
-- Elimina transacción y sus CXC/CXP asociadas (CASCADE).
CREATE OR REPLACE FUNCTION eliminar_transaccion(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_rol TEXT;
BEGIN
  SELECT rol INTO v_user_rol FROM usuarios WHERE id = auth.uid();
  IF v_user_rol NOT IN ('ceo', 'admin') THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  DELETE FROM transacciones WHERE id = p_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION eliminar_transaccion FROM PUBLIC;
GRANT EXECUTE ON FUNCTION eliminar_transaccion TO authenticated;
