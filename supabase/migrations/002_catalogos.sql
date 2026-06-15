-- ============================================================
-- MIGRACIÓN 002 — Catálogos de eLunch Finanzas
-- Tablas de referencia: fuentes de ingreso, clientes, unidades
-- de negocio, proveedores, tipos de costo, categorías de gasto,
-- formas de pago, cuentas bancarias, tipos de asignación y
-- estados de CXC/CXP.
-- RLS habilitada. Usuarios autenticados pueden leer todo.
-- Solo usuarios con rol CEO o admin pueden mutar.
-- ============================================================

-- ── Fuentes de ingreso ──────────────────────────────────────
CREATE TABLE fuentes_ingreso (
  id          VARCHAR(10) PRIMARY KEY,
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  ejemplos    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE fuentes_ingreso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura autenticada" ON fuentes_ingreso FOR SELECT TO authenticated USING (true);
CREATE POLICY "mutacion ceo admin"  ON fuentes_ingreso FOR ALL    TO authenticated
  USING      ((SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('ceo','admin'))
  WITH CHECK ((SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('ceo','admin'));

INSERT INTO fuentes_ingreso (id, nombre, descripcion, ejemplos) VALUES
  ('FI-01','Cafeterías','Venta directa en cafeterías físicas','Insigne, TP Meraki, TP Century, BAC, Atento, Plycem'),
  ('FI-02','Licitaciones','Contratos formales (perennes o por convocatoria)','Centro Judicial, Catering por licitación'),
  ('FI-03','Eventos Especiales','Venta empresarial de plato. Eventos puntuales por cliente.','Antes: LOGISTIC, LISTAS TP, EVENTOS 1/2/3'),
  ('FI-04','Catering','Catering normal, no por licitación','Servicios de catering a clientes finales');

-- ── Clientes corporativos ───────────────────────────────────
CREATE TABLE clientes_corporativos (
  id         VARCHAR(10) PRIMARY KEY,
  nombre     TEXT NOT NULL,
  alias      TEXT,
  relacion   TEXT,
  estado     TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','inactivo','programado')),
  notas      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clientes_corporativos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura autenticada" ON clientes_corporativos FOR SELECT TO authenticated USING (true);
CREATE POLICY "mutacion ceo admin"  ON clientes_corporativos FOR ALL    TO authenticated
  USING      ((SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('ceo','admin'))
  WITH CHECK ((SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('ceo','admin'));

CREATE TRIGGER set_clientes_corporativos_updated_at
  BEFORE UPDATE ON clientes_corporativos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO clientes_corporativos (id, nombre, alias, relacion, estado, notas) VALUES
  ('CL-001','Teleperformance','TP','Cafeterías Meraki y Century','activo',NULL),
  ('CL-002','Insigne','Insigne','Cafetería Insigne','activo',NULL),
  ('CL-003','BAC','BAC','Cafetería BAC','activo',NULL),
  ('CL-004','Atento','Atento','Cafetería Atento (jun-2026)','programado',NULL),
  ('CL-005','Plycem','Plycem','Cafetería Plycem','activo',NULL),
  ('CL-006','Centro Judicial','CJ','Licitación perenne','activo','Pago por OC. Validar días de crédito acordados.'),
  ('CL-007','Cliente Eventos N','—','Eventos puntuales','activo','Placeholder. Crear un cliente real por cada empresa recurrente.');

-- ── Unidades de negocio ─────────────────────────────────────
CREATE TABLE unidades_negocio (
  id                VARCHAR(10) PRIMARY KEY,
  nombre            TEXT NOT NULL,
  fuente_ingreso_id VARCHAR(10) REFERENCES fuentes_ingreso(id),
  cliente_corp_id   VARCHAR(10) REFERENCES clientes_corporativos(id),
  ubicacion         TEXT,
  estado            TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','inactiva','programada')),
  fecha_inicio      DATE,
  notas             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE unidades_negocio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura autenticada" ON unidades_negocio FOR SELECT TO authenticated USING (true);
CREATE POLICY "mutacion ceo admin"  ON unidades_negocio FOR ALL    TO authenticated
  USING      ((SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('ceo','admin'))
  WITH CHECK ((SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('ceo','admin'));

CREATE TRIGGER set_unidades_negocio_updated_at
  BEFORE UPDATE ON unidades_negocio
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO unidades_negocio (id, nombre, fuente_ingreso_id, cliente_corp_id, ubicacion, estado, fecha_inicio, notas) VALUES
  ('UN-001','Cafetería Insigne',   'FI-01','CL-002','Insigne',  'activa',  '2025-01-01', NULL),
  ('UN-002','Cafetería TP Meraki', 'FI-01','CL-001','TP Meraki','activa',  '2025-01-01', NULL),
  ('UN-003','Cafetería TP Century','FI-01','CL-001','TP Century','activa', '2025-01-01', NULL),
  ('UN-004','Cafetería BAC',       'FI-01','CL-003','BAC',      'activa',  '2025-01-01', 'Cuidado: BAC también es banco; no confundir.'),
  ('UN-005','Cafetería Plycem',    'FI-01','CL-005','Plycem',   'activa',  '2025-01-01', NULL),
  ('UN-006','Cafetería Atento',    'FI-01','CL-004','Atento',   'programada','2026-06-01','Arranca el 1 de junio 2026.'),
  ('UN-007','Centro Judicial',     'FI-02','CL-006','—',        'activa',  '2025-01-01', 'Licitación perenne. Tiene costos directos (platos a terceros).'),
  ('UN-008','Eventos Especiales',  'FI-03','CL-007','—',        'activa',  NULL,         'Reemplaza LOGISTIC y LISTAS TP. Campo libre por evento.'),
  ('UN-009','Catering',            'FI-04','CL-007','—',        'activa',  NULL,         'Catering no-licitación.'),
  ('UN-010','Licitación X (placeholder)','FI-02',NULL,'—',      'inactiva',NULL,         'Plantilla para nuevas licitaciones con P&L propio.');

-- ── Tipos de costo (tags) ───────────────────────────────────
CREATE TABLE tipos_costo (
  id          VARCHAR(10) PRIMARY KEY,
  tag         TEXT NOT NULL UNIQUE,
  grupo       TEXT,
  descripcion TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tipos_costo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura autenticada" ON tipos_costo FOR SELECT TO authenticated USING (true);
CREATE POLICY "mutacion ceo admin"  ON tipos_costo FOR ALL    TO authenticated
  USING      ((SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('ceo','admin'))
  WITH CHECK ((SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('ceo','admin'));

INSERT INTO tipos_costo (id, tag, grupo, descripcion) VALUES
  ('TC-01','Pollo',               'Proteína',         'Costo variable directo de producción'),
  ('TC-02','Carnes',              'Proteína',         'Res, cerdo, embutidos'),
  ('TC-03','Embutidos / Lácteos', 'Proteína / Lácteos','Sigma'),
  ('TC-04','Lácteos',             'Lácteos',          'Quesos, crema, leche'),
  ('TC-05','Café',                'Bebidas',          NULL),
  ('TC-06','Bebidas',             'Bebidas',          'Refrescos, horchata, agua'),
  ('TC-07','Panadería',           'Insumo',           'Pan francés, dulce, árabe, sinaí'),
  ('TC-08','Tortillas',           'Insumo',           NULL),
  ('TC-09','Abarrotes',           'Insumo',           'Huevos, azúcar, aceite, etc.'),
  ('TC-10','Abarrotes (mayoreo)', 'Insumo',           'Pricemart, Sam''s, etc.'),
  ('TC-11','Abarrotes / Condimentos','Insumo',        'Comersal, mayonesa, consomé'),
  ('TC-12','Frutas y verduras',   'Insumo',           NULL),
  ('TC-13','Granos / Harinas',    'Insumo',           'Los Molinos'),
  ('TC-14','Desechables',         'Empaque',          'Bandejas, vasos, servilletas'),
  ('TC-15','Hielo',               'Insumo',           NULL),
  ('TC-16','Snacks',              'Reventa',          'Sabrita, Diana'),
  ('TC-17','Comida lista',        'Reventa',          'Tamales, otros'),
  ('TC-18','Limpieza',            'Insumo Operativo', 'Productos de limpieza, Gaman'),
  ('TC-19','Servicios / Gas',     'Servicio',         'Gas propano'),
  ('TC-20','Agua / Bebidas',      'Bebidas',          'Agua embotellada'),
  ('TC-21','Varios',              'Otros',            'Sin clasificar'),
  ('TC-22','Otros / Personal',    'Cuenta interna',   NULL);

-- ── Proveedores ─────────────────────────────────────────────
CREATE TABLE proveedores (
  id           VARCHAR(10) PRIMARY KEY,
  nombre       TEXT NOT NULL,
  tag_tipo     TEXT REFERENCES tipos_costo(tag) ON UPDATE CASCADE,
  dias_credito INTEGER NOT NULL DEFAULT 0,
  contacto     TEXT,
  estado       TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','inactivo')),
  notas        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura autenticada" ON proveedores FOR SELECT TO authenticated USING (true);
CREATE POLICY "mutacion ceo admin"  ON proveedores FOR ALL    TO authenticated
  USING      ((SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('ceo','admin'))
  WITH CHECK ((SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('ceo','admin'));

CREATE TRIGGER set_proveedores_updated_at
  BEFORE UPDATE ON proveedores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO proveedores (id, nombre, tag_tipo, dias_credito, estado, notas) VALUES
  ('PR-001','Sigma',               'Embutidos / Lácteos',   30,'activo','Jamón, chorizo, longaniza, queso americano'),
  ('PR-002','Río Blanco',          'Lácteos',               30,'activo','Queso, crema, queso con chile'),
  ('PR-003','Lácteos Don Aníbal',  'Lácteos',               15,'activo','Quesillo super, quesillo hila, arroz'),
  ('PR-004','El Novillo',          'Carnes',                15,'activo','Choquezuela, costilla, carne molida'),
  ('PR-005','Desechables',         'Desechables',           15,'activo','Papel film, gabachas, bandejas, vasos'),
  ('PR-006','As de Oro',           'Bebidas',               15,'activo','Frijol, horchata, cebada'),
  ('PR-007','Comersal',            'Abarrotes / Condimentos',30,'activo','Mayonesa, jalisco, consomé pollo'),
  ('PR-008','Ve Café',             'Café',                  30,'activo','Café molido, café en grano'),
  ('PR-009','Excel Protein Group', 'Carnes',                15,'activo',NULL),
  ('PR-010','Gaman',               'Limpieza',              15,'activo','Productos de limpieza'),
  ('PR-011','Pricemart',           'Abarrotes (mayoreo)',    0,'activo','Compras al contado / tarjeta BAC'),
  ('PR-012','Sarita',              'Lácteos',               15,'activo',NULL),
  ('PR-013','Sabrita',             'Snacks',                15,'activo',NULL),
  ('PR-014','Diana',               'Snacks',                15,'activo',NULL),
  ('PR-015','Lactolac',            'Lácteos',               15,'activo',NULL),
  ('PR-016','Queso Fresco (variable)','Lácteos',             0,'activo','Compra en mercado / informal'),
  ('PR-017','Huevos (variable)',   'Abarrotes',              0,'activo','Compra en mercado / informal'),
  ('PR-018','Tortillas (variable)','Tortillas',              0,'activo','Proveedor de tortillas (varía)'),
  ('PR-019','Pollo (variable)',    'Pollo',                  0,'activo','Definir proveedor formal'),
  ('PR-020','Carnes (variable)',   'Carnes',                 0,'activo','Backup a El Novillo / Excel Protein'),
  ('PR-021','Pan Francés (variable)','Panadería',            0,'activo',NULL),
  ('PR-022','Pan Dulce (variable)','Panadería',              0,'activo',NULL),
  ('PR-023','Pan Árabe',           'Panadería',              0,'activo',NULL),
  ('PR-024','Pan Sinaí',           'Panadería',              0,'activo',NULL),
  ('PR-025','Pan Aladino',         'Panadería',              0,'inactivo','Validar si sigue activo'),
  ('PR-026','Bakery Depot',        'Panadería',              0,'activo',NULL),
  ('PR-027','Super (variable)',    'Abarrotes',              0,'activo','Compras puntuales en supermercado'),
  ('PR-028','Mercado (variable)',  'Abarrotes',              0,'activo','Compras en mercado local'),
  ('PR-029','Los Molinos',         'Granos / Harinas',       0,'activo',NULL),
  ('PR-030','Hielo MC',            'Hielo',                  0,'activo',NULL),
  ('PR-031','Tostadas',            'Tortillas',               0,'activo',NULL),
  ('PR-032','Leche Salud',         'Lácteos',                0,'activo',NULL),
  ('PR-033','Tienda (varios)',     'Varios',                 0,'activo','Compras misceláneas en tiendas de barrio'),
  ('PR-034','Bebida (variable)',   'Bebidas',                0,'activo',NULL),
  ('PR-035','Mafer',               'Varios',                 0,'activo','Validar categoría'),
  ('PR-036','Grupo Steiner',       'Varios',                 0,'inactivo','Validar si sigue activo'),
  ('PR-037','Viva Café',           'Café',                   0,'inactivo','Validar si sigue activo'),
  ('PR-038','Azúcar (variable)',   'Abarrotes',              0,'activo',NULL),
  ('PR-039','Tamales (variable)',  'Comida lista',           0,'activo',NULL),
  ('PR-040','Nescafé',             'Café',                   0,'activo',NULL),
  ('PR-041','Agua Jai Plus',       'Agua / Bebidas',         0,'activo',NULL),
  ('PR-042','Gas Propano',         'Servicios / Gas',        0,'activo',NULL),
  ('PR-043','Ludina Flores',       'Varios',                 0,'activo',NULL),
  ('PR-044','Navas',               'Otros / Personal',       0,'activo','Cuenta interna'),
  ('PR-045','Carlos Navas',        'Otros / Personal',       0,'activo','Cuenta interna');

-- ── Categorías de gasto operativo ───────────────────────────
CREATE TABLE categorias_gasto (
  id          VARCHAR(10) PRIMARY KEY,
  nombre      TEXT NOT NULL,
  naturaleza  TEXT,
  descripcion TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE categorias_gasto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura autenticada" ON categorias_gasto FOR SELECT TO authenticated USING (true);
CREATE POLICY "mutacion ceo admin"  ON categorias_gasto FOR ALL    TO authenticated
  USING      ((SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('ceo','admin'))
  WITH CHECK ((SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('ceo','admin'));

INSERT INTO categorias_gasto (id, nombre, naturaleza, descripcion) VALUES
  ('GA-01','Gasolina',              'Operativo',           'Combustible motoristas y vehículos'),
  ('GA-02','Gastos Cafeterías',     'Operativo',           'Gastos varios atribuibles a una cafetería'),
  ('GA-03','Tienda Morena',         'Operativo',           'Validar concepto exacto'),
  ('GA-04','Alquileres',            'Fijo',                'Alquileres de locales'),
  ('GA-05','Salarios',              'Fijo',                'Planilla'),
  ('GA-06','Prestaciones de Ley',   'Fijo',                'ISSS, AFP, vacaciones, aguinaldo'),
  ('GA-07','Contador',              'Fijo',                'Honorarios contador externo'),
  ('GA-08','Pago Casa',             'Otros',               'Gasto personal a separar de la empresa (revisar)'),
  ('GA-09','Luz, Agua, Tel, Renta', 'Fijo',                'Servicios básicos'),
  ('GA-10','Desengrasantes',        'Operativo',           'Productos para limpieza profunda'),
  ('GA-11','Alquiler Eventos',      'Variable',            'Mobiliario y equipo para eventos puntuales'),
  ('GA-12','Manto',                 'Operativo',           'Mantenimiento de equipo / instalaciones'),
  ('GA-13','Gaman / P. Limpieza',   'Operativo',           'Productos de limpieza recurrentes'),
  ('GA-14','Impuestos',             'Fijo',                'IVA, ISR, alcaldía'),
  ('GA-15','Ferreterías',           'Operativo',           'Compras menores de ferretería'),
  ('GA-16','Fumigación / Trampa Grasa','Operativo',        'Servicio de fumigación y mantenimiento sanitario'),
  ('GA-17','Foton',                 'Activo',              'Vehículo Foton (revisar si es gasto o activo)'),
  ('GA-18','Motoristas',            'Operativo',           'Pago a motoristas (distinto a salarios formales)'),
  ('GA-19','Marketing',             'Variable',            'Publicidad, branding, redes'),
  ('GA-20','Centro Judicial (gasto)','Costo Directo Unidad','Compras específicas para Centro Judicial. ASIGNAR DIRECTO a UN-007.'),
  ('GA-21','Otros',                 'Otros',               'Gastos no clasificados'),
  ('GA-22','Préstamos',             'Financiero',          'Pago de cuotas de préstamos'),
  ('GA-23','Gastos Eventos',        'Variable',            'Gastos atribuibles a eventos especiales'),
  ('GA-24','Papelería',             'Operativo',           'Insumos de oficina');

-- ── Formas de pago ──────────────────────────────────────────
CREATE TABLE formas_pago (
  id              VARCHAR(10) PRIMARY KEY,
  nombre          TEXT NOT NULL,
  tipo            TEXT,
  afecta_cash     BOOLEAN,
  genera_cxc_cxp  BOOLEAN NOT NULL DEFAULT false,
  notas           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE formas_pago ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura autenticada" ON formas_pago FOR SELECT TO authenticated USING (true);
CREATE POLICY "mutacion ceo admin"  ON formas_pago FOR ALL    TO authenticated
  USING      ((SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('ceo','admin'))
  WITH CHECK ((SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('ceo','admin'));

INSERT INTO formas_pago (id, nombre, tipo, afecta_cash, genera_cxc_cxp, notas) VALUES
  ('FP-01','Cash',                  'Ingreso/Egreso', true,  false,'Efectivo. Entra directo a Caja Central.'),
  ('FP-02','Tarjeta (POS)',         'Ingreso',        true,  false,'Tarjeta de crédito/débito de cliente final.'),
  ('FP-03','Transferencia',         'Ingreso/Egreso', true,  false,'Transferencia bancaria.'),
  ('FP-04','Subsidio / Kash',       'Ingreso',        true,  true, 'Validar mecánica de cobro.'),
  ('FP-05','Crédito (CXC)',         'Ingreso',        false, true, 'Venta a crédito. Genera CXC. NO suma a cash.'),
  ('FP-06','Tarjeta BAC',           'Egreso',         false, false,'Tarjeta de crédito empresarial. Genera deuda con BAC.'),
  ('FP-07','Cheque',                'Ingreso/Egreso', null,  false,'Cheque emitido o recibido. Confirmar si cobrado.'),
  ('FP-08','Crédito Proveedor (CXP)','Egreso',        false, true, 'Compra a crédito. Genera CXP.');

-- ── Cuentas bancarias ───────────────────────────────────────
CREATE TABLE cuentas_bancarias (
  id         VARCHAR(10) PRIMARY KEY,
  nombre     TEXT NOT NULL,
  tipo       TEXT NOT NULL CHECK (tipo IN ('efectivo','banco','tarjeta_credito','otro')),
  moneda     TEXT NOT NULL DEFAULT 'USD',
  estado     TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','inactiva')),
  notas      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cuentas_bancarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura autenticada" ON cuentas_bancarias FOR SELECT TO authenticated USING (true);
CREATE POLICY "mutacion ceo admin"  ON cuentas_bancarias FOR ALL    TO authenticated
  USING      ((SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('ceo','admin'))
  WITH CHECK ((SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('ceo','admin'));

CREATE TRIGGER set_cuentas_bancarias_updated_at
  BEFORE UPDATE ON cuentas_bancarias
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO cuentas_bancarias (id, nombre, tipo, moneda, notas) VALUES
  ('CB-01','Caja Central',         'efectivo',       'USD','Caja diaria del negocio'),
  ('CB-02','BAC (cuenta corriente)','banco',          'USD','Cuenta principal'),
  ('CB-03','Banco Azul',           'banco',           'USD','Cuenta secundaria'),
  ('CB-04','Banco Cuscatlán',      'banco',           'USD','Cuenta secundaria'),
  ('CB-05','Cuenta Agrícola',      'banco',           'USD','Cuenta de inversión / saldo guardado'),
  ('CB-06','Tarjeta BAC',          'tarjeta_credito', 'USD','Tarjeta empresarial. Saldo negativo = deuda.'),
  ('CB-07','Cheques en tránsito',  'otro',            'USD','Cheques emitidos pendientes de cobro');

-- ── Tipos de asignación ─────────────────────────────────────
CREATE TABLE tipos_asignacion (
  id         VARCHAR(10) PRIMARY KEY,
  nombre     TEXT NOT NULL,
  definicion TEXT,
  ejemplos   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tipos_asignacion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura autenticada" ON tipos_asignacion FOR SELECT TO authenticated USING (true);

INSERT INTO tipos_asignacion (id, nombre, definicion, ejemplos) VALUES
  ('AS-01','Pool Común','Costo o gasto compartido entre varias unidades. No se asigna a ninguna en particular.','Compra de pollo para todas las cafeterías; sueldo del contador; gasolina del motorista.'),
  ('AS-02','Directa a Unidad','Costo o gasto identificable 100% con una unidad de negocio.','Platos comprados a terceros para revender en Centro Judicial; alquiler exclusivo de un local.');

-- ── Estados CXC ─────────────────────────────────────────────
CREATE TABLE estados_cxc (
  id          VARCHAR(10) PRIMARY KEY,
  estado      TEXT NOT NULL,
  orden       INTEGER NOT NULL,
  descripcion TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE estados_cxc ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura autenticada" ON estados_cxc FOR SELECT TO authenticated USING (true);

INSERT INTO estados_cxc (id, estado, orden, descripcion) VALUES
  ('EC-01','Generada',        1,'Venta registrada como crédito. Aún no hay OC ni factura.'),
  ('EC-02','OC Recibida',     2,'Cliente envió orden de compra formal.'),
  ('EC-03','Facturada',       3,'Factura emitida. Esperando programación de pago.'),
  ('EC-04','Programada Pago', 4,'Cliente confirmó fecha de pago. Aparece en flujo de caja proyectado.'),
  ('EC-05','Pagada',          5,'Cobrada. Cierra la CXC y entra a cash.'),
  ('EC-06','En Recuperación', 6,'Vencida sin pago. Gestión activa de cobro.'),
  ('EC-07','Incobrable',      7,'Decisión de cancelar. Se castiga del libro.');

-- ── Estados CXP ─────────────────────────────────────────────
CREATE TABLE estados_cxp (
  id          VARCHAR(10) PRIMARY KEY,
  estado      TEXT NOT NULL,
  orden       INTEGER NOT NULL,
  descripcion TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE estados_cxp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura autenticada" ON estados_cxp FOR SELECT TO authenticated USING (true);

INSERT INTO estados_cxp (id, estado, orden, descripcion) VALUES
  ('EP-01','Pendiente',   1,'Compra registrada a crédito. Vencimiento futuro.'),
  ('EP-02','Programada',  2,'Pago agendado para una fecha específica.'),
  ('EP-03','Pagada',      3,'Liquidada. Sale el dinero de la cuenta correspondiente.'),
  ('EP-04','Vencida',     4,'Pasó la fecha de vencimiento sin pago. Alerta automática.'),
  ('EP-05','En disputa',  5,'Diferencia con el proveedor. Pago en pausa.');

-- ── Índices útiles ──────────────────────────────────────────
CREATE INDEX idx_proveedores_estado    ON proveedores(estado);
CREATE INDEX idx_proveedores_tag       ON proveedores(tag_tipo);
CREATE INDEX idx_unidades_estado       ON unidades_negocio(estado);
CREATE INDEX idx_clientes_estado       ON clientes_corporativos(estado);
CREATE INDEX idx_cuentas_estado        ON cuentas_bancarias(estado);
