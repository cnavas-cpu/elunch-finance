-- ============================================================
-- MIGRACIÓN 004 — Pagos y gestión CXP (Sprint 4)
-- Tabla pagos + RPCs: registrar_pago_cxp, cambiar_estado_cxp
-- Redefinición de crear_salida con vencimiento automático.
-- ============================================================

-- ── Tabla pagos ──────────────────────────────────────────────
-- Liquida parcial o totalmente una CXC o CXP.
-- Cada fila = un desembolso/cobro real de efectivo.
CREATE TABLE pagos (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cxp_id           UUID        REFERENCES cuentas_x_pagar(id)  ON DELETE CASCADE,
  cxc_id           UUID        REFERENCES cuentas_x_cobrar(id) ON DELETE CASCADE,
  fecha            DATE        NOT NULL,
  cuenta_id        VARCHAR(10) REFERENCES cuentas_bancarias(id),
  monto_centavos   BIGINT      NOT NULL CHECK (monto_centavos > 0),
  notas            TEXT,
  registrado_por   UUID        REFERENCES usuarios(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  -- Exactamente una de las dos FK debe estar llena
  CONSTRAINT pagos_un_destino CHECK (
    (cxp_id IS NOT NULL AND cxc_id IS NULL) OR
    (cxp_id IS NULL     AND cxc_id IS NOT NULL)
  )
);

ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura autenticada" ON pagos FOR SELECT TO authenticated USING (true);
CREATE POLICY "mutacion ceo admin"  ON pagos FOR ALL    TO authenticated
  USING      ((SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('ceo','admin'))
  WITH CHECK ((SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('ceo','admin'));

CREATE INDEX idx_pagos_cxp_id ON pagos(cxp_id);
CREATE INDEX idx_pagos_cxc_id ON pagos(cxc_id);

-- ============================================================
-- RPC: registrar_pago_cxp
-- Abona a una CXP. Si total abonado >= monto, cierra la CXP
-- (estado = 'Pagada'). Prohíbe sobrepagar y pagar ya-pagadas.
-- Escribe en auditoria con cada acción.
-- ============================================================
CREATE OR REPLACE FUNCTION registrar_pago_cxp(
  p_cxp_id          UUID,
  p_fecha           DATE,
  p_cuenta_id       VARCHAR(10),
  p_monto_centavos  BIGINT,
  p_notas           TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_rol      TEXT;
  v_cxp           RECORD;
  v_total_abonado BIGINT;
  v_saldo         BIGINT;
  v_pago_id       UUID;
  v_estado_nuevo  TEXT;
BEGIN
  -- Verificar autorización
  SELECT rol INTO v_user_rol FROM usuarios WHERE id = auth.uid();
  IF v_user_rol NOT IN ('ceo', 'admin') THEN
    RAISE EXCEPTION 'Acceso denegado: solo CEO o admin pueden registrar pagos';
  END IF;

  -- Obtener la CXP con bloqueo para evitar condición de carrera
  SELECT id, monto_centavos, estado
  INTO v_cxp
  FROM cuentas_x_pagar
  WHERE id = p_cxp_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CXP no encontrada';
  END IF;
  IF v_cxp.estado = 'Pagada' THEN
    RAISE EXCEPTION 'Esta cuenta por pagar ya está completamente pagada';
  END IF;

  -- Calcular saldo pendiente
  SELECT COALESCE(SUM(monto_centavos), 0)
  INTO v_total_abonado
  FROM pagos
  WHERE cxp_id = p_cxp_id;

  v_saldo := v_cxp.monto_centavos - v_total_abonado;

  IF p_monto_centavos > v_saldo THEN
    RAISE EXCEPTION 'No puedes pagar más que el saldo pendiente ($ %.2f)',
      v_saldo::numeric / 100;
  END IF;

  -- Insertar el pago
  INSERT INTO pagos (cxp_id, fecha, cuenta_id, monto_centavos, notas, registrado_por)
  VALUES (p_cxp_id, p_fecha, p_cuenta_id, p_monto_centavos, p_notas, auth.uid())
  RETURNING id INTO v_pago_id;

  -- Auditar el pago
  INSERT INTO auditoria (usuario_id, tabla, registro_id, accion, valor_nuevo)
  VALUES (
    auth.uid(), 'pagos', v_pago_id::text, 'INSERT',
    jsonb_build_object(
      'cxp_id',          p_cxp_id,
      'monto_centavos',  p_monto_centavos,
      'fecha',           p_fecha,
      'cuenta_id',       p_cuenta_id
    )
  );

  -- Cerrar la CXP si ya quedó completamente pagada
  v_estado_nuevo := v_cxp.estado;
  IF (v_total_abonado + p_monto_centavos) >= v_cxp.monto_centavos THEN
    UPDATE cuentas_x_pagar
    SET estado = 'Pagada', updated_at = NOW()
    WHERE id = p_cxp_id;

    v_estado_nuevo := 'Pagada';

    -- Auditar el cierre de la CXP
    INSERT INTO auditoria (usuario_id, tabla, registro_id, accion, valor_anterior, valor_nuevo)
    VALUES (
      auth.uid(), 'cuentas_x_pagar', p_cxp_id::text, 'UPDATE',
      jsonb_build_object('estado', v_cxp.estado),
      jsonb_build_object('estado', 'Pagada')
    );
  END IF;

  RETURN jsonb_build_object(
    'cxp_id',         p_cxp_id,
    'pago_id',        v_pago_id,
    'estado',         v_estado_nuevo,
    'saldo_restante', GREATEST(0, v_cxp.monto_centavos - v_total_abonado - p_monto_centavos)
  );
END;
$$;

REVOKE ALL ON FUNCTION registrar_pago_cxp FROM PUBLIC;
GRANT EXECUTE ON FUNCTION registrar_pago_cxp TO authenticated;

-- ============================================================
-- RPC: cambiar_estado_cxp
-- Transiciones manuales permitidas:
--   Pendiente  ↔ Programada
--   (cualquiera no-Pagada) → En disputa
--   En disputa → Pendiente / Programada
-- No puede forzar 'Pagada' (solo via pago) ni 'Vencida' (derivada).
-- ============================================================
CREATE OR REPLACE FUNCTION cambiar_estado_cxp(
  p_cxp_id       UUID,
  p_nuevo_estado  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_rol      TEXT;
  v_estado_actual TEXT;
BEGIN
  -- Verificar autorización
  SELECT rol INTO v_user_rol FROM usuarios WHERE id = auth.uid();
  IF v_user_rol NOT IN ('ceo', 'admin') THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  -- Proteger estados automáticos
  IF p_nuevo_estado IN ('Pagada', 'Vencida') THEN
    RAISE EXCEPTION 'El estado "%" lo asigna el sistema automáticamente', p_nuevo_estado;
  END IF;

  SELECT estado INTO v_estado_actual
  FROM cuentas_x_pagar
  WHERE id = p_cxp_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CXP no encontrada';
  END IF;
  IF v_estado_actual = 'Pagada' THEN
    RAISE EXCEPTION 'No puedes cambiar el estado de una CXP ya pagada';
  END IF;

  -- Validar transición permitida
  IF NOT (
    (v_estado_actual = 'Pendiente'   AND p_nuevo_estado IN ('Programada',  'En disputa')) OR
    (v_estado_actual = 'Programada'  AND p_nuevo_estado IN ('Pendiente',   'En disputa')) OR
    (v_estado_actual = 'En disputa'  AND p_nuevo_estado IN ('Pendiente',   'Programada')) OR
    (v_estado_actual = 'Vencida'     AND p_nuevo_estado IN ('Pendiente',   'En disputa'))
  ) THEN
    RAISE EXCEPTION 'Transición no permitida: % → %', v_estado_actual, p_nuevo_estado;
  END IF;

  UPDATE cuentas_x_pagar
  SET estado = p_nuevo_estado, updated_at = NOW()
  WHERE id = p_cxp_id;

  -- Auditar cambio de estado
  INSERT INTO auditoria (usuario_id, tabla, registro_id, accion, valor_anterior, valor_nuevo)
  VALUES (
    auth.uid(), 'cuentas_x_pagar', p_cxp_id::text, 'UPDATE',
    jsonb_build_object('estado', v_estado_actual),
    jsonb_build_object('estado', p_nuevo_estado)
  );

  RETURN jsonb_build_object(
    'cxp_id', p_cxp_id,
    'estado',  p_nuevo_estado
  );
END;
$$;

REVOKE ALL ON FUNCTION cambiar_estado_cxp FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cambiar_estado_cxp TO authenticated;

-- ============================================================
-- Redefinir crear_salida con vencimiento automático
-- Si no se pasa p_fecha_vencimiento y el proveedor tiene
-- dias_credito > 0, calcula fecha_emision + dias_credito.
-- Compatible con la firma existente (sin cambios en llamadores).
-- ============================================================
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
  v_tx_id            UUID;
  v_genera_cxp       BOOLEAN;
  v_user_rol         TEXT;
  v_dias_credito     INTEGER;
  v_fecha_venc_final DATE;
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
    -- Si no viene fecha explícita, calcular desde dias_credito del proveedor
    IF p_fecha_vencimiento IS NOT NULL THEN
      v_fecha_venc_final := p_fecha_vencimiento;
    ELSE
      SELECT dias_credito INTO v_dias_credito
      FROM proveedores WHERE id = p_proveedor_id;

      IF v_dias_credito IS NOT NULL AND v_dias_credito > 0 THEN
        v_fecha_venc_final := p_fecha + v_dias_credito;
      ELSE
        v_fecha_venc_final := NULL;
      END IF;
    END IF;

    INSERT INTO cuentas_x_pagar (
      transaccion_id, proveedor_id, monto_centavos,
      fecha_emision, fecha_vencimiento, estado
    )
    VALUES (
      v_tx_id, p_proveedor_id, p_monto_centavos,
      p_fecha, v_fecha_venc_final, 'Pendiente'
    );
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
