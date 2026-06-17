-- 005_cxc_gestion.sql — Gestión de Cuentas por Cobrar (Sprint 5)
-- Aplica en el SQL Editor de Supabase (copy/paste completo).

-- ── ALTERs ───────────────────────────────────────────────────────

-- Días de crédito por cliente (espeja proveedores.dias_credito)
ALTER TABLE clientes_corporativos
  ADD COLUMN IF NOT EXISTS dias_credito INTEGER NOT NULL DEFAULT 0;

-- Evidencia documental de la CXC (texto en v1; archivos se difieren)
ALTER TABLE cuentas_x_cobrar
  ADD COLUMN IF NOT EXISTS num_oc      TEXT,
  ADD COLUMN IF NOT EXISTS num_factura TEXT;

-- ── Índices de aging y filtros ────────────────────────────────────
-- Recomendados por STACK_Y_SEGURIDAD_QA.md §2 para el aging por rangos.

CREATE INDEX IF NOT EXISTS idx_cxc_estado_fecha_esperada
  ON cuentas_x_cobrar(estado, fecha_esperada);

CREATE INDEX IF NOT EXISTS idx_cxc_cliente_id
  ON cuentas_x_cobrar(cliente_id);

-- ── Redefinición de crear_venta ───────────────────────────────────
-- Agrega p_fecha_esperada DATE DEFAULT NULL.
-- La fecha esperada = explícita o bien emisión + dias_credito del cliente.
-- El resto del cuerpo es idéntico al de 003_cierre_diario.sql.

CREATE OR REPLACE FUNCTION crear_venta(
  p_fecha           DATE,
  p_monto_centavos  BIGINT,
  p_unidad_id       VARCHAR(10),
  p_forma_pago_id   VARCHAR(10),
  p_cuenta_id       VARCHAR(10) DEFAULT NULL,
  p_cliente_id      VARCHAR(10) DEFAULT NULL,
  p_descripcion     TEXT        DEFAULT NULL,
  p_fecha_esperada  DATE        DEFAULT NULL   -- NUEVO en 005
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx_id          UUID;
  v_genera_cxc     BOOLEAN;
  v_cliente_final  VARCHAR(10);
  v_user_rol       TEXT;
  v_fecha_esperada DATE;                       -- NUEVO en 005
BEGIN
  -- Auth: solo ceo o admin
  SELECT rol INTO v_user_rol FROM usuarios WHERE id = auth.uid();
  IF v_user_rol NOT IN ('ceo', 'admin') THEN
    RAISE EXCEPTION 'Acceso denegado: solo CEO o admin pueden registrar transacciones';
  END IF;

  -- ¿Esta forma de pago genera CXC?
  SELECT genera_cxc_cxp INTO v_genera_cxc FROM formas_pago WHERE id = p_forma_pago_id;

  -- Insertar transacción
  INSERT INTO transacciones (
    fecha, tipo, monto_centavos, unidad_id, forma_pago_id,
    cuenta_id, descripcion, registrado_por
  )
  VALUES (
    p_fecha, 'venta', p_monto_centavos, p_unidad_id, p_forma_pago_id,
    p_cuenta_id, p_descripcion, auth.uid()
  )
  RETURNING id INTO v_tx_id;

  -- Crear CXC si aplica
  IF v_genera_cxc THEN
    -- Resolver cliente: explícito → unidad de negocio
    IF p_cliente_id IS NOT NULL THEN
      v_cliente_final := p_cliente_id;
    ELSE
      SELECT cliente_corp_id INTO v_cliente_final
        FROM unidades_negocio WHERE id = p_unidad_id;
    END IF;

    -- Calcular fecha esperada: explícita → emisión + dias_credito del cliente
    IF p_fecha_esperada IS NOT NULL THEN
      v_fecha_esperada := p_fecha_esperada;
    ELSE
      SELECT CASE
               WHEN dias_credito > 0 THEN p_fecha + dias_credito
               ELSE NULL
             END
        INTO v_fecha_esperada
        FROM clientes_corporativos
        WHERE id = v_cliente_final;
    END IF;

    INSERT INTO cuentas_x_cobrar (
      transaccion_id, unidad_id, cliente_id,
      monto_centavos, fecha_emision, fecha_esperada, estado
    )
    VALUES (
      v_tx_id, p_unidad_id, v_cliente_final,
      p_monto_centavos, p_fecha, v_fecha_esperada, 'Generada'
    );
  END IF;

  RETURN jsonb_build_object(
    'id',         v_tx_id::text,
    'tipo',       'venta',
    'genera_cxc', COALESCE(v_genera_cxc, false)
  );
END;
$$;

-- Eliminar la versión anterior de crear_venta (sin p_fecha_esperada) que
-- quedó de la migración 003 y causa ambigüedad en REVOKE/GRANT.
DROP FUNCTION IF EXISTS crear_venta(DATE, BIGINT, VARCHAR(10), VARCHAR(10), VARCHAR(10), VARCHAR(10), TEXT);

REVOKE ALL ON FUNCTION crear_venta(DATE, BIGINT, VARCHAR(10), VARCHAR(10), VARCHAR(10), VARCHAR(10), TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION crear_venta(DATE, BIGINT, VARCHAR(10), VARCHAR(10), VARCHAR(10), VARCHAR(10), TEXT, DATE) TO authenticated;

-- ── RPC registrar_pago_cxc ────────────────────────────────────────
-- Registra un cobro (abono parcial o total) sobre una CXC.
-- Anti-sobrecobro, anti-Incobrable. Auto-marca Pagada si saldo = 0.
-- Escribe en: pagos (INSERT) + cuentas_x_cobrar (UPDATE si Pagada) + auditoria.

CREATE OR REPLACE FUNCTION registrar_pago_cxc(
  p_cxc_id         UUID,
  p_fecha          DATE,
  p_cuenta_id      VARCHAR(10),
  p_monto_centavos BIGINT,
  p_notas          TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_rol     TEXT;
  v_monto        BIGINT;
  v_estado       TEXT;
  v_abonado      BIGINT;
  v_saldo        BIGINT;
  v_pago_id      UUID;
  v_nuevo_estado TEXT;
BEGIN
  SELECT rol INTO v_user_rol FROM usuarios WHERE id = auth.uid();
  IF v_user_rol NOT IN ('ceo', 'admin') THEN
    RAISE EXCEPTION 'Acceso denegado: solo CEO o admin pueden registrar cobros';
  END IF;

  -- Obtener y bloquear la CXC
  SELECT monto_centavos, estado
    INTO v_monto, v_estado
    FROM cuentas_x_cobrar
    WHERE id = p_cxc_id
    FOR UPDATE;
  IF NOT FOUND    THEN RAISE EXCEPTION 'La cuenta por cobrar no existe'; END IF;
  IF v_estado = 'Pagada'     THEN RAISE EXCEPTION 'Esta cuenta ya está cobrada'; END IF;
  IF v_estado = 'Incobrable' THEN RAISE EXCEPTION 'Esta cuenta está marcada como incobrable'; END IF;

  -- Calcular saldo real
  SELECT COALESCE(SUM(monto_centavos), 0) INTO v_abonado FROM pagos WHERE cxc_id = p_cxc_id;
  v_saldo := v_monto - v_abonado;
  IF p_monto_centavos > v_saldo THEN
    RAISE EXCEPTION 'No puedes cobrar más que el saldo pendiente ($%.2f)',
      (v_saldo / 100.0);
  END IF;

  -- Insertar pago (entra a la cuenta bancaria seleccionada)
  INSERT INTO pagos (cxc_id, fecha, cuenta_id, monto_centavos, notas, registrado_por)
  VALUES (p_cxc_id, p_fecha, p_cuenta_id, p_monto_centavos, p_notas, auth.uid())
  RETURNING id INTO v_pago_id;

  INSERT INTO auditoria (usuario_id, tabla, registro_id, accion, valor_nuevo)
  VALUES (
    auth.uid(), 'pagos', v_pago_id::text, 'INSERT',
    jsonb_build_object(
      'cxc_id', p_cxc_id, 'monto_centavos', p_monto_centavos,
      'cuenta_id', p_cuenta_id, 'fecha', p_fecha
    )
  );

  -- ¿Cobro completo? → Pagada
  v_nuevo_estado := v_estado;
  IF (v_abonado + p_monto_centavos) >= v_monto THEN
    UPDATE cuentas_x_cobrar
      SET estado = 'Pagada', updated_at = NOW()
      WHERE id = p_cxc_id;
    v_nuevo_estado := 'Pagada';
    INSERT INTO auditoria (usuario_id, tabla, registro_id, accion, valor_anterior, valor_nuevo)
    VALUES (
      auth.uid(), 'cuentas_x_cobrar', p_cxc_id::text, 'UPDATE',
      jsonb_build_object('estado', v_estado),
      jsonb_build_object('estado', 'Pagada')
    );
  END IF;

  RETURN jsonb_build_object(
    'cxc_id',         p_cxc_id::text,
    'pago_id',        v_pago_id::text,
    'estado',         v_nuevo_estado,
    'saldo_restante', v_monto - v_abonado - p_monto_centavos
  );
END;
$$;

REVOKE ALL ON FUNCTION registrar_pago_cxc(UUID, DATE, VARCHAR(10), BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION registrar_pago_cxc(UUID, DATE, VARCHAR(10), BIGINT, TEXT) TO authenticated;

-- ── RPC cambiar_estado_cxc ────────────────────────────────────────
-- Transiciones manuales de pipeline. Bloquea llegar a 'Pagada' por esta vía.
-- Valida la máquina de estados en SQL (defensa en profundidad; también está en TS).

CREATE OR REPLACE FUNCTION cambiar_estado_cxc(
  p_cxc_id       UUID,
  p_nuevo_estado TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_rol      TEXT;
  v_estado_actual TEXT;
  v_valido        BOOLEAN;
BEGIN
  SELECT rol INTO v_user_rol FROM usuarios WHERE id = auth.uid();
  IF v_user_rol NOT IN ('ceo', 'admin') THEN
    RAISE EXCEPTION 'Acceso denegado: solo CEO o admin pueden cambiar estados';
  END IF;

  -- Pagada solo vía cobro completo
  IF p_nuevo_estado = 'Pagada' THEN
    RAISE EXCEPTION 'El estado "Pagada" solo se alcanza registrando el cobro completo';
  END IF;
  IF p_nuevo_estado NOT IN (
    'OC Recibida','Facturada','Programada Pago','En Recuperacion','Incobrable'
  ) THEN
    RAISE EXCEPTION 'Estado destino inválido: %', p_nuevo_estado;
  END IF;

  SELECT estado INTO v_estado_actual
    FROM cuentas_x_cobrar WHERE id = p_cxc_id FOR UPDATE;
  IF NOT FOUND           THEN RAISE EXCEPTION 'La cuenta por cobrar no existe'; END IF;
  IF v_estado_actual = 'Pagada' THEN
    RAISE EXCEPTION 'Una cuenta cobrada no puede cambiar de estado';
  END IF;

  -- Máquina de estados (BD sin tilde, igual que el CHECK de la tabla)
  v_valido :=
       (v_estado_actual = 'Generada'        AND p_nuevo_estado = 'OC Recibida')
    OR (v_estado_actual = 'OC Recibida'     AND p_nuevo_estado = 'Facturada')
    OR (v_estado_actual = 'Facturada'       AND p_nuevo_estado IN ('Programada Pago','En Recuperacion','Incobrable'))
    OR (v_estado_actual = 'Programada Pago' AND p_nuevo_estado IN ('En Recuperacion','Incobrable'))
    OR (v_estado_actual = 'En Recuperacion' AND p_nuevo_estado IN ('Programada Pago','Incobrable'));

  IF NOT v_valido THEN
    RAISE EXCEPTION 'Transición inválida: % → %', v_estado_actual, p_nuevo_estado;
  END IF;

  UPDATE cuentas_x_cobrar
    SET estado = p_nuevo_estado, updated_at = NOW()
    WHERE id = p_cxc_id;

  INSERT INTO auditoria (usuario_id, tabla, registro_id, accion, valor_anterior, valor_nuevo)
  VALUES (
    auth.uid(), 'cuentas_x_cobrar', p_cxc_id::text, 'UPDATE',
    jsonb_build_object('estado', v_estado_actual),
    jsonb_build_object('estado', p_nuevo_estado)
  );

  RETURN jsonb_build_object('cxc_id', p_cxc_id::text, 'estado', p_nuevo_estado);
END;
$$;

REVOKE ALL ON FUNCTION cambiar_estado_cxc(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cambiar_estado_cxc(UUID, TEXT) TO authenticated;

-- ── RPC actualizar_evidencia_cxc ──────────────────────────────────
-- Edita num_oc, num_factura y notas de una CXC. Auditado.

CREATE OR REPLACE FUNCTION actualizar_evidencia_cxc(
  p_cxc_id      UUID,
  p_num_oc      TEXT DEFAULT NULL,
  p_num_factura TEXT DEFAULT NULL,
  p_notas       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_rol TEXT;
  v_old      RECORD;
BEGIN
  SELECT rol INTO v_user_rol FROM usuarios WHERE id = auth.uid();
  IF v_user_rol NOT IN ('ceo', 'admin') THEN
    RAISE EXCEPTION 'Acceso denegado: solo CEO o admin pueden editar evidencia';
  END IF;

  SELECT num_oc, num_factura, notas
    INTO v_old
    FROM cuentas_x_cobrar WHERE id = p_cxc_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta por cobrar no existe'; END IF;

  UPDATE cuentas_x_cobrar
    SET num_oc       = p_num_oc,
        num_factura  = p_num_factura,
        notas        = p_notas,
        updated_at   = NOW()
    WHERE id = p_cxc_id;

  INSERT INTO auditoria (usuario_id, tabla, registro_id, accion, valor_anterior, valor_nuevo)
  VALUES (
    auth.uid(), 'cuentas_x_cobrar', p_cxc_id::text, 'UPDATE',
    jsonb_build_object('num_oc', v_old.num_oc, 'num_factura', v_old.num_factura, 'notas', v_old.notas),
    jsonb_build_object('num_oc', p_num_oc, 'num_factura', p_num_factura, 'notas', p_notas)
  );

  RETURN jsonb_build_object('cxc_id', p_cxc_id::text);
END;
$$;

REVOKE ALL ON FUNCTION actualizar_evidencia_cxc(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION actualizar_evidencia_cxc(UUID, TEXT, TEXT, TEXT) TO authenticated;
