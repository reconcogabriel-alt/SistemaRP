const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/costos.db');

let db = null;

async function getDb() {
  if (db) return db;
  
  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new SQL.Database();
    initializeSchema();
    saveDb();
  }
  
  // ── Migrations: siempre corren, son idempotentes ──
  runMigrations();
  
  return db;
}

// ── Helpers de introspección de esquema (usados por la migración de abajo) ──
function columnExists(table, col) {
  try {
    const info = db.exec(`PRAGMA table_info(${table})`);
    if (!info.length) return false;
    return info[0].values.some(r => r[1] === col);
  } catch (e) { return false; }
}

// r[3] = notnull (1 si la columna tiene restricción NOT NULL, 0 si es nullable)
function columnIsNotNull(table, col) {
  try {
    const info = db.exec(`PRAGMA table_info(${table})`);
    if (!info.length) return false;
    const row = info[0].values.find(r => r[1] === col);
    return !!row && row[3] === 1;
  } catch (e) { return false; }
}

// ── Migración: "proyectos" -> "presupuestos" en instalaciones existentes ──
// Hace tiempo, varias tablas (presupuestos, ordenes_compra, bitacora_entradas,
// documentos, requisiciones, tareo_diario, tareo_cuadrillas, bodega_movimientos,
// cuentas_pagar, planillas) tenían una columna heredada id_proyecto/proyecto_id
// que apuntaba a la entidad "proyectos", ya eliminada del modelo de datos
// (presupuestos absorbió ese rol). El código de rutas ya fue actualizado para
// usar id_presupuesto en todas ellas, pero instalaciones existentes (creadas
// antes de ese cambio) seguían con el esquema viejo, causando errores
// "NOT NULL constraint failed" o "no such column" al crear registros nuevos.
// Esta migración recrea esas tablas con el esquema correcto, preservando los
// datos existentes. Es idempotente: si una tabla ya está en el formato nuevo,
// no hace nada.
function migrarIdProyectoAIdPresupuesto() {
  const tablasAfectadas = ['presupuestos','ordenes_compra','bitacora_entradas','documentos',
    'requisiciones','tareo_diario','tareo_cuadrillas','bodega_movimientos','cuentas_pagar','planillas'];

  const necesita = {
    presupuestos:        columnIsNotNull('presupuestos','id_proyecto'),
    ordenes_compra:      columnExists('ordenes_compra','id_proyecto') && !columnExists('ordenes_compra','id_presupuesto'),
    bitacora_entradas:   columnExists('bitacora_entradas','proyecto_id'),
    documentos:          columnExists('documentos','id_proyecto'),
    requisiciones:       columnExists('requisiciones','id_proyecto') && !columnExists('requisiciones','id_presupuesto'),
    tareo_diario:        columnExists('tareo_diario','id_proyecto') && !columnExists('tareo_diario','id_presupuesto'),
    tareo_cuadrillas:    columnExists('tareo_cuadrillas','id_proyecto') && !columnExists('tareo_cuadrillas','id_presupuesto'),
    bodega_movimientos:  columnExists('bodega_movimientos','id_proyecto') && !columnExists('bodega_movimientos','id_presupuesto'),
    cuentas_pagar:       columnExists('cuentas_pagar','id_proyecto') && !columnExists('cuentas_pagar','id_presupuesto'),
    planillas:           columnExists('planillas','id_proyecto') && !columnExists('planillas','id_presupuesto'),
  };

  if (!Object.values(necesita).some(Boolean)) return; // nada que migrar

  console.log('🔧 Migrando esquema heredado id_proyecto -> id_presupuesto:',
    Object.entries(necesita).filter(([,v]) => v).map(([k]) => k).join(', '));

  try {
    // Evita que SQLite reescriba automáticamente las referencias FK de otras
    // tablas (capitulos, presupuesto_partidas, oc_items, cotizaciones, pagos,
    // trabajadores, requisicion_items, modulos) cuando renombramos las tablas
    // afectadas más abajo.
    db.run('PRAGMA legacy_alter_table = ON;');

    // FASE 1: renombrar tablas viejas
    for (const t of tablasAfectadas) {
      if (necesita[t]) db.run(`ALTER TABLE ${t} RENAME TO ${t}_mig_old`);
    }

    // FASE 2: crear tablas nuevas con esquema correcto
    if (necesita.presupuestos) db.run(`CREATE TABLE presupuestos (
      id_presupuesto INTEGER PRIMARY KEY AUTOINCREMENT,
      id_proyecto INTEGER,
      nombre TEXT,
      costos_directos REAL DEFAULT 0,
      porcentaje_indirectos REAL DEFAULT 0,
      porcentaje_utilidad REAL DEFAULT 0,
      porcentaje_imprevistos REAL DEFAULT 0,
      costos_indirectos REAL DEFAULT 0,
      utilidad REAL DEFAULT 0,
      imprevistos REAL DEFAULT 0,
      total_general REAL DEFAULT 0,
      fecha_creacion TEXT DEFAULT (datetime('now')),
      id_centro_costo INTEGER DEFAULT NULL,
      id_catalogo INTEGER DEFAULT NULL,
      descripcion TEXT,
      ubicacion TEXT,
      cliente TEXT,
      moneda TEXT DEFAULT 'HNL',
      fecha_inicio TEXT,
      fecha_fin TEXT,
      estado TEXT DEFAULT 'activo',
      creado_por INTEGER
    )`);

    if (necesita.ordenes_compra) db.run(`CREATE TABLE ordenes_compra (
      id_oc         INTEGER PRIMARY KEY AUTOINCREMENT,
      numero        TEXT NOT NULL UNIQUE,
      id_presupuesto INTEGER NOT NULL,
      id_prov       INTEGER NOT NULL,
      id_req        INTEGER,
      fecha_oc      TEXT DEFAULT (date('now')),
      fecha_entrega TEXT,
      estado        TEXT DEFAULT 'borrador'
                    CHECK(estado IN ('borrador','pendiente','aprobada','recibida_parcial','recibida_total','anulada')),
      condicion_pago TEXT DEFAULT 'contado',
      subtotal      REAL DEFAULT 0,
      impuesto      REAL DEFAULT 0,
      total         REAL DEFAULT 0,
      aprobado_por  TEXT,
      fecha_aprobacion TEXT,
      notas         TEXT,
      fecha_creacion TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (id_presupuesto) REFERENCES presupuestos(id_presupuesto),
      FOREIGN KEY (id_prov)     REFERENCES proveedores(id_prov),
      FOREIGN KEY (id_req)      REFERENCES requisiciones(id_req)
    )`);

    if (necesita.bitacora_entradas) db.run(`CREATE TABLE bitacora_entradas (
      id                      INTEGER PRIMARY KEY AUTOINCREMENT,
      id_presupuesto          INTEGER NOT NULL,
      numero_entrada          INTEGER NOT NULL,
      fecha                   TEXT NOT NULL,
      hora_inicio             TEXT,
      hora_fin                TEXT,
      personal_profesional    INTEGER DEFAULT 0,
      personal_tecnico        INTEGER DEFAULT 0,
      personal_operativo      INTEGER DEFAULT 0,
      condicion_clima         TEXT,
      avance_fisico           REAL DEFAULT 0,
      actividades_ejecutadas  TEXT NOT NULL,
      materiales_utilizados   TEXT,
      equipos_utilizados      TEXT,
      subcontratistas         TEXT,
      incidentes              TEXT,
      observaciones_calidad   TEXT,
      observaciones_seguridad TEXT,
      visitas                 TEXT,
      instrucciones_recibidas TEXT,
      oc_referencias          TEXT,
      fotos_referencias       TEXT,
      elaborado_por           TEXT,
      firma_residente         TEXT,
      firma_supervisor        TEXT,
      creado_en               TEXT DEFAULT (datetime('now')),
      modificado_en           TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (id_presupuesto) REFERENCES presupuestos(id_presupuesto)
    )`);

    if (necesita.documentos) db.run(`CREATE TABLE documentos (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      id_presupuesto    INTEGER NOT NULL,
      categoria_id      INTEGER NOT NULL,
      titulo            TEXT NOT NULL,
      descripcion       TEXT,
      numero_doc        TEXT,
      version           TEXT DEFAULT '1.0',
      estado            TEXT DEFAULT 'vigente',
      fecha_documento   TEXT,
      fecha_vencimiento TEXT,
      monto_asociado    REAL,
      moneda            TEXT DEFAULT 'HNL',
      archivo_nombre    TEXT,
      archivo_url       TEXT,
      archivo_tipo      TEXT,
      elaborado_por     TEXT,
      revisado_por      TEXT,
      aprobado_por      TEXT,
      fecha_aprobacion  TEXT,
      oc_numero         TEXT,
      oc_impacto_costo  REAL,
      oc_impacto_plazo  INTEGER,
      notas             TEXT,
      creado_en         TEXT DEFAULT (datetime('now')),
      modificado_en     TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (id_presupuesto) REFERENCES presupuestos(id_presupuesto)
    )`);

    if (necesita.requisiciones) db.run(`CREATE TABLE requisiciones (
      id_req       INTEGER PRIMARY KEY AUTOINCREMENT,
      numero       TEXT NOT NULL,
      id_presupuesto  INTEGER NOT NULL,
      solicitante  TEXT,
      fecha_req    TEXT DEFAULT (date('now')),
      fecha_req_entrega TEXT,
      estado       TEXT DEFAULT 'pendiente'
                   CHECK(estado IN ('pendiente','aprobada','parcial','completa','anulada')),
      notas        TEXT,
      fecha_creacion TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (id_presupuesto) REFERENCES presupuestos(id_presupuesto)
    )`);

    if (necesita.tareo_diario) db.run(`CREATE TABLE tareo_diario (
      id_tareo      INTEGER PRIMARY KEY AUTOINCREMENT,
      id_trab       INTEGER NOT NULL,
      id_presupuesto INTEGER NOT NULL,
      id_actividad  INTEGER,
      fecha         TEXT NOT NULL DEFAULT (date('now')),
      horas_normales REAL DEFAULT 8,
      horas_extra   REAL DEFAULT 0,
      tipo_pago     TEXT DEFAULT 'jornal'
                    CHECK(tipo_pago IN ('jornal','destajo','hora')),
      monto_destajo REAL DEFAULT 0,
      descripcion_trabajo TEXT,
      asistio       INTEGER DEFAULT 1,
      fecha_creacion TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (id_trab)       REFERENCES trabajadores(id_trab),
      FOREIGN KEY (id_presupuesto) REFERENCES presupuestos(id_presupuesto),
      FOREIGN KEY (id_actividad)  REFERENCES actividades(id_actividad)
    )`);

    if (necesita.tareo_cuadrillas) db.run(`CREATE TABLE tareo_cuadrillas (
      id_cuadrilla  INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre        TEXT NOT NULL,
      id_presupuesto INTEGER,
      capataz       TEXT,
      activa        INTEGER DEFAULT 1,
      fecha_creacion TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (id_presupuesto) REFERENCES presupuestos(id_presupuesto)
    )`);

    if (necesita.bodega_movimientos) db.run(`CREATE TABLE bodega_movimientos (
      id_mov       INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo         TEXT NOT NULL CHECK(tipo IN ('entrada','salida','ajuste')),
      id_insumo    INTEGER NOT NULL,
      id_presupuesto  INTEGER,
      id_req       INTEGER,
      cantidad     REAL NOT NULL,
      precio_unitario REAL DEFAULT 0,
      total        REAL DEFAULT 0,
      referencia   TEXT,
      proveedor    TEXT,
      notas        TEXT,
      fecha_mov    TEXT DEFAULT (date('now')),
      fecha_creacion TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (id_insumo) REFERENCES insumos(id_insumo),
      FOREIGN KEY (id_presupuesto) REFERENCES presupuestos(id_presupuesto),
      FOREIGN KEY (id_req) REFERENCES requisiciones(id_req)
    )`);

    if (necesita.cuentas_pagar) db.run(`CREATE TABLE cuentas_pagar (
      id_cp         INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_doc    TEXT NOT NULL,
      tipo_doc      TEXT DEFAULT 'factura'
                    CHECK(tipo_doc IN ('factura','recibo','planilla_sub','estimacion','otro')),
      id_prov       INTEGER,
      id_presupuesto   INTEGER,
      id_oc         INTEGER,
      fecha_doc     TEXT DEFAULT (date('now')),
      fecha_vence   TEXT,
      monto_total   REAL NOT NULL DEFAULT 0,
      monto_pagado  REAL DEFAULT 0,
      saldo         REAL DEFAULT 0,
      estado        TEXT DEFAULT 'pendiente'
                    CHECK(estado IN ('pendiente','pagada_parcial','pagada','anulada')),
      categoria_gasto TEXT DEFAULT 'materiales'
                    CHECK(categoria_gasto IN ('materiales','mano_obra','subcontrato','equipo','administrativo','otro')),
      descripcion   TEXT,
      notas         TEXT,
      fecha_creacion TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (id_prov)     REFERENCES proveedores(id_prov),
      FOREIGN KEY (id_presupuesto) REFERENCES presupuestos(id_presupuesto),
      FOREIGN KEY (id_oc)       REFERENCES ordenes_compra(id_oc)
    )`);

    if (necesita.planillas) db.run(`CREATE TABLE planillas (
      id_planilla   INTEGER PRIMARY KEY AUTOINCREMENT,
      id_presupuesto   INTEGER NOT NULL,
      numero        INTEGER NOT NULL,
      periodo       TEXT NOT NULL,
      fecha_inicio  TEXT NOT NULL,
      fecha_fin     TEXT NOT NULL,
      tipo          TEXT DEFAULT 'semanal' CHECK(tipo IN ('semanal','quincenal','mensual')),
      estado        TEXT DEFAULT 'borrador' CHECK(estado IN ('borrador','aprobada','pagada')),
      total_bruto   REAL DEFAULT 0,
      total_ihss_p  REAL DEFAULT 0,
      total_rap_p   REAL DEFAULT 0,
      total_desc_e  REAL DEFAULT 0,
      total_neto    REAL DEFAULT 0,
      notas         TEXT,
      elaborado_por TEXT,
      fecha_creacion TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (id_presupuesto) REFERENCES presupuestos(id_presupuesto)
    )`);

    // FASE 3: copiar datos de cada tabla vieja a la nueva
    if (necesita.presupuestos) db.run(`INSERT INTO presupuestos SELECT
      id_presupuesto, id_proyecto, nombre, costos_directos, porcentaje_indirectos,
      porcentaje_utilidad, porcentaje_imprevistos, costos_indirectos, utilidad, imprevistos,
      total_general, fecha_creacion, id_centro_costo, id_catalogo, descripcion, ubicacion,
      cliente, moneda, fecha_inicio, fecha_fin, estado, creado_por
      FROM presupuestos_mig_old`);

    if (necesita.ordenes_compra) db.run(`INSERT INTO ordenes_compra SELECT
      id_oc, numero, id_proyecto, id_prov, id_req, fecha_oc, fecha_entrega, estado,
      condicion_pago, subtotal, impuesto, total, aprobado_por, fecha_aprobacion, notas, fecha_creacion
      FROM ordenes_compra_mig_old`);

    if (necesita.bitacora_entradas) db.run(`INSERT INTO bitacora_entradas SELECT
      id, COALESCE(id_presupuesto, proyecto_id), numero_entrada, fecha, hora_inicio, hora_fin,
      personal_profesional, personal_tecnico, personal_operativo, condicion_clima, avance_fisico,
      actividades_ejecutadas, materiales_utilizados, equipos_utilizados, subcontratistas, incidentes,
      observaciones_calidad, observaciones_seguridad, visitas, instrucciones_recibidas, oc_referencias,
      fotos_referencias, elaborado_por, firma_residente, firma_supervisor, creado_en, modificado_en
      FROM bitacora_entradas_mig_old`);

    if (necesita.documentos) db.run(`INSERT INTO documentos SELECT
      id, COALESCE(id_presupuesto, id_proyecto), categoria_id, titulo, descripcion, numero_doc,
      version, estado, fecha_documento, fecha_vencimiento, monto_asociado, moneda, archivo_nombre,
      archivo_url, archivo_tipo, elaborado_por, revisado_por, aprobado_por, fecha_aprobacion,
      oc_numero, oc_impacto_costo, oc_impacto_plazo, notas, creado_en, modificado_en
      FROM documentos_mig_old`);

    if (necesita.requisiciones) db.run(`INSERT INTO requisiciones SELECT
      id_req, numero, id_proyecto, solicitante, fecha_req, fecha_req_entrega, estado, notas, fecha_creacion
      FROM requisiciones_mig_old`);

    if (necesita.tareo_diario) db.run(`INSERT INTO tareo_diario SELECT
      id_tareo, id_trab, id_proyecto, id_actividad, fecha, horas_normales, horas_extra,
      tipo_pago, monto_destajo, descripcion_trabajo, asistio, fecha_creacion
      FROM tareo_diario_mig_old`);

    if (necesita.tareo_cuadrillas) db.run(`INSERT INTO tareo_cuadrillas SELECT
      id_cuadrilla, nombre, id_proyecto, capataz, activa, fecha_creacion
      FROM tareo_cuadrillas_mig_old`);

    if (necesita.bodega_movimientos) db.run(`INSERT INTO bodega_movimientos SELECT
      id_mov, tipo, id_insumo, id_proyecto, id_req, cantidad, precio_unitario, total,
      referencia, proveedor, notas, fecha_mov, fecha_creacion
      FROM bodega_movimientos_mig_old`);

    if (necesita.cuentas_pagar) db.run(`INSERT INTO cuentas_pagar SELECT
      id_cp, numero_doc, tipo_doc, id_prov, id_proyecto, id_oc, fecha_doc, fecha_vence,
      monto_total, monto_pagado, saldo, estado, categoria_gasto, descripcion, notas, fecha_creacion
      FROM cuentas_pagar_mig_old`);

    if (necesita.planillas) db.run(`INSERT INTO planillas SELECT
      o.id_planilla,
      (SELECT p.id_presupuesto FROM presupuestos p
         JOIN proyectos pr2 ON pr2.id_proyecto = o.id_proyecto
         WHERE p.id_proyecto = o.id_proyecto AND p.nombre = pr2.nombre
         LIMIT 1),
      o.numero, o.periodo, o.fecha_inicio, o.fecha_fin, o.tipo, o.estado,
      o.total_bruto, o.total_ihss_p, o.total_rap_p, o.total_desc_e, o.total_neto,
      o.notas, o.elaborado_por, o.fecha_creacion
      FROM planillas_mig_old o`);

    // FASE 4: eliminar tablas viejas
    for (const t of tablasAfectadas) {
      if (necesita[t]) db.run(`DROP TABLE ${t}_mig_old`);
    }

    db.run('PRAGMA legacy_alter_table = OFF;');
    console.log('✅ Migración id_proyecto -> id_presupuesto completada correctamente');
  } catch (e) {
    console.error('❌ Error en migración id_proyecto -> id_presupuesto:', e.message);
    throw e;
  }
}

function runMigrations() {
  migrarIdProyectoAIdPresupuesto();

  // Centros de costo
  db.run(`CREATE TABLE IF NOT EXISTS centros_costo (
    id_centro INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    zona TEXT,
    activo INTEGER DEFAULT 1,
    fecha_creacion TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS centro_costo_precios (
    id_precio INTEGER PRIMARY KEY AUTOINCREMENT,
    id_centro INTEGER NOT NULL,
    id_insumo INTEGER NOT NULL,
    precio_unitario REAL NOT NULL,
    fecha_actualizacion TEXT DEFAULT (datetime('now')),
    UNIQUE(id_centro, id_insumo)
  )`);
  // Columnas nuevas en tablas existentes
  try { db.run('ALTER TABLE presupuestos ADD COLUMN id_centro_costo INTEGER DEFAULT NULL'); } catch(e) {}
  // Columna activo en usuarios (para activar/desactivar sin eliminar)
  try { db.run("ALTER TABLE usuarios ADD COLUMN activo INTEGER DEFAULT 1"); } catch(e) {}
  try { db.run("UPDATE usuarios SET activo = 1 WHERE activo IS NULL"); } catch(e) {}
  // Tabla de clientes (solo admin)
  db.run(`CREATE TABLE IF NOT EXISTS clientes (
    id_cliente INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    empresa TEXT,
    correo TEXT,
    telefono TEXT,
    direccion TEXT,
    nit TEXT,
    contacto TEXT,
    notas TEXT,
    activo INTEGER DEFAULT 1,
    fecha_creacion TEXT DEFAULT (datetime('now'))
  )`);

  // ── Módulo Cronograma y Seguimiento ──────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS cronogramas (
    id_cronograma    INTEGER PRIMARY KEY AUTOINCREMENT,
    id_presupuesto   INTEGER NOT NULL,
    nombre           TEXT NOT NULL,
    fecha_inicio     TEXT NOT NULL,
    duracion_semanas INTEGER NOT NULL DEFAULT 1,
    estado           TEXT DEFAULT 'planificacion',
    observaciones    TEXT,
    fecha_creacion   TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS cronograma_tareas (
    id_tarea         INTEGER PRIMARY KEY AUTOINCREMENT,
    id_cronograma    INTEGER NOT NULL,
    id_partida       INTEGER,
    id_modulo        INTEGER,
    descripcion      TEXT NOT NULL,
    tipo             TEXT DEFAULT 'actividad',
    semana_inicio    INTEGER NOT NULL DEFAULT 1,
    duracion_semanas INTEGER NOT NULL DEFAULT 1,
    peso_ponderado   REAL DEFAULT 0,
    orden_visual     INTEGER DEFAULT 1
  )`);
  // Instalaciones existentes (creadas antes del cambio "capítulo" -> "módulo")
  // tienen cronograma_tareas con la columna heredada id_capitulo en vez de
  // id_modulo, que es la que usa src/routes/seguimiento.js en todos sus
  // SELECT/INSERT. Sin esto, todo el módulo de Cronograma queda roto con
  // "no such column: id_modulo" / "has no column named id_modulo".
  if (!columnExists('cronograma_tareas', 'id_modulo')) {
    try { db.run('ALTER TABLE cronograma_tareas ADD COLUMN id_modulo INTEGER'); } catch(e) {}
    try { db.run('UPDATE cronograma_tareas SET id_modulo = id_capitulo WHERE id_modulo IS NULL'); } catch(e) {}
  }
  db.run(`CREATE TABLE IF NOT EXISTS seguimiento_periodos (
    id_periodo      INTEGER PRIMARY KEY AUTOINCREMENT,
    id_cronograma   INTEGER NOT NULL,
    numero_periodo  INTEGER NOT NULL,
    fecha_corte     TEXT NOT NULL,
    descripcion     TEXT,
    cerrado         INTEGER DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS seguimiento_avances (
    id_avance          INTEGER PRIMARY KEY AUTOINCREMENT,
    id_periodo         INTEGER NOT NULL,
    id_tarea           INTEGER NOT NULL,
    avance_fisico_pct  REAL DEFAULT 0,
    cantidad_ejecutada REAL DEFAULT 0,
    monto_ejecutado    REAL DEFAULT 0,
    observacion        TEXT,
    UNIQUE(id_periodo, id_tarea)
  )`);

  // ── Módulo Documentación ─────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS doc_categorias (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre  TEXT NOT NULL,
    icono   TEXT,
    color   TEXT,
    activo  INTEGER DEFAULT 1,
    creado_en TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS documentos (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    id_presupuesto    INTEGER NOT NULL,
    categoria_id      INTEGER NOT NULL,
    titulo            TEXT NOT NULL,
    descripcion       TEXT,
    numero_doc        TEXT,
    version           TEXT DEFAULT '1.0',
    estado            TEXT DEFAULT 'vigente',
    fecha_documento   TEXT,
    fecha_vencimiento TEXT,
    monto_asociado    REAL,
    moneda            TEXT DEFAULT 'HNL',
    archivo_nombre    TEXT,
    archivo_url       TEXT,
    archivo_tipo      TEXT,
    elaborado_por     TEXT,
    revisado_por      TEXT,
    aprobado_por      TEXT,
    fecha_aprobacion  TEXT,
    oc_numero         TEXT,
    oc_impacto_costo  REAL,
    oc_impacto_plazo  INTEGER,
    notas             TEXT,
    creado_en         TEXT DEFAULT (datetime('now')),
    modificado_en     TEXT DEFAULT (datetime('now'))
  )`);
  try {
    const chk = db.exec(`SELECT COUNT(*) FROM doc_categorias`);
    if (chk[0].values[0][0] === 0) {
      db.run(`INSERT INTO doc_categorias (nombre,icono,color) VALUES
        ('Planos',           '📐','#025196'),
        ('Contratos',        '📋','#1A7A3C'),
        ('Órdenes de Cambio','🔄','#FDB338'),
        ('Permisos',         '🏛️','#8C9BAD'),
        ('Actas',            '✍️','#5B4FBE'),
        ('Especificaciones', '📑','#C0392B'),
        ('Fotografías',      '📷','#E67E22'),
        ('Presupuestos',     '💰','#17A589'),
        ('Laboratorio',      '🔬','#8E44AD'),
        ('Correspondencia',  '📧','#566573'),
        ('Garantías',        '🛡️','#1A5276'),
        ('Otros',            '📁','#717D7E')`);
    }
  } catch(e) {}

  // ── Módulo Bitácora ──────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS bitacora_entradas (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    id_presupuesto          INTEGER NOT NULL,
    numero_entrada          INTEGER NOT NULL,
    fecha                   TEXT NOT NULL,
    hora_inicio             TEXT,
    hora_fin                TEXT,
    personal_profesional    INTEGER DEFAULT 0,
    personal_tecnico        INTEGER DEFAULT 0,
    personal_operativo      INTEGER DEFAULT 0,
    condicion_clima         TEXT,
    avance_fisico           REAL DEFAULT 0,
    actividades_ejecutadas  TEXT NOT NULL,
    materiales_utilizados   TEXT,
    equipos_utilizados      TEXT,
    subcontratistas         TEXT,
    incidentes              TEXT,
    observaciones_calidad   TEXT,
    observaciones_seguridad TEXT,
    visitas                 TEXT,
    instrucciones_recibidas TEXT,
    oc_referencias          TEXT,
    fotos_referencias       TEXT,
    elaborado_por           TEXT,
    firma_residente         TEXT,
    firma_supervisor        TEXT,
    creado_en               TEXT DEFAULT (datetime('now')),
    modificado_en           TEXT DEFAULT (datetime('now'))
  )`);

  // ── Configuración del sistema (empresa, reportes) ──────────
  db.run(`CREATE TABLE IF NOT EXISTS configuracion_sistema (
    clave TEXT PRIMARY KEY,
    valor TEXT,
    descripcion TEXT,
    fecha_modificacion TEXT DEFAULT (datetime('now'))
  )`);
  // Insertar claves si no existen (sin sobreescribir valores que el usuario ya cambió)
  const defaults = [
    ['empresa_nombre', '', 'Nombre de la empresa que aparece en reportes PDF'],
    ['empresa_subtitulo', '', 'Subtítulo o slogan de la empresa'],
    ['empresa_rtn', '', 'RTN (Registro Tributario Nacional) de la empresa'],
    ['empresa_telefono', '', 'Teléfono de contacto de la empresa'],
    ['empresa_correo', '', 'Correo electrónico de la empresa'],
    ['empresa_direccion', '', 'Dirección o ciudad de la empresa'],
    ['reporte_mostrar_fecha', '0', 'Mostrar fecha de impresión en reportes PDF (1=sí, 0=no)'],
    ['reporte_mostrar_precios_ref', '1', 'Mostrar nota de precios de referencia en fichas'],
    ['default_indirectos', '0', 'Porcentaje de costos indirectos por defecto para nuevos presupuestos'],
    ['default_utilidad', '0', 'Porcentaje de utilidad por defecto para nuevos presupuestos'],
    ['default_imprevistos', '0', 'Porcentaje de imprevistos por defecto para nuevos presupuestos'],
    ['ficha_mostrar_empresa', '1', 'Mostrar datos de empresa en encabezado de fichas de costos (1=si, 0=no)'],
  ];
  for (const [clave, valor, descripcion] of defaults) {
    try {
      db.run(`INSERT OR IGNORE INTO configuracion_sistema (clave, valor, descripcion) VALUES (?,?,?)`,
        [clave, valor, descripcion]);
    } catch(e) {}
  }
  // v2.18 migration: forzar reset de empresa_nombre y fecha si aún tienen el valor hardcodeado antiguo
  try {
    db.run(`UPDATE configuracion_sistema SET valor='' WHERE clave='empresa_nombre' AND valor='Servicios y Construcciones RP'`);
    db.run(`UPDATE configuracion_sistema SET valor='0' WHERE clave='reporte_mostrar_fecha' AND valor='1'`);
  } catch(e) {}

  // v2.19 migration: agregar claves nuevas en instalaciones existentes
  const nuevasClaves219 = [
    ['empresa_rtn',         '', 'RTN (Registro Tributario Nacional) de la empresa'],
    ['empresa_telefono',    '', 'Telefono de contacto de la empresa'],
    ['empresa_correo',      '', 'Correo electronico de la empresa'],
    ['empresa_direccion',   '', 'Direccion o ciudad de la empresa'],
    ['default_indirectos',  '0', 'Porcentaje de costos indirectos por defecto para nuevos presupuestos'],
    ['default_utilidad',    '0', 'Porcentaje de utilidad por defecto para nuevos presupuestos'],
    ['default_imprevistos', '0', 'Porcentaje de imprevistos por defecto para nuevos presupuestos'],
    ['ficha_mostrar_empresa', '1', 'Mostrar datos de empresa en encabezado de fichas de costos (1=si, 0=no)'],
  ];
  for (const [clave, valor, descripcion] of nuevasClaves219) {
    try {
      db.run('INSERT OR IGNORE INTO configuracion_sistema (clave, valor, descripcion) VALUES (?,?,?)',
        [clave, valor, descripcion]);
    } catch(e) {}
  }

  // ── Módulo Actualización de Precios (sesiones) ───────────────
  db.run(`CREATE TABLE IF NOT EXISTS sesiones_actualizacion (
    id_sesion       INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre          TEXT NOT NULL,
    fecha           TEXT DEFAULT (date('now')),
    usuario         TEXT,
    total_insumos   INTEGER DEFAULT 0,
    total_afectados INTEGER DEFAULT 0,
    variacion_prom  REAL DEFAULT 0,
    nota            TEXT,
    creado_en       TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS sesion_detalle (
    id_detalle      INTEGER PRIMARY KEY AUTOINCREMENT,
    id_sesion       INTEGER NOT NULL,
    id_insumo       INTEGER NOT NULL,
    precio_anterior REAL,
    precio_nuevo    REAL,
    variacion_pct   REAL,
    FOREIGN KEY (id_sesion) REFERENCES sesiones_actualizacion(id_sesion),
    FOREIGN KEY (id_insumo) REFERENCES insumos(id_insumo)
  )`);


  // ── Módulo Catálogos de Precios ─────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS catalogos_precios (
    id_catalogo INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre      TEXT NOT NULL,
    descripcion TEXT,
    fecha       TEXT DEFAULT (date('now')),
    creado_en   TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS catalogo_precios_detalle (
    id_detalle  INTEGER PRIMARY KEY AUTOINCREMENT,
    id_catalogo INTEGER NOT NULL,
    id_insumo   INTEGER NOT NULL,
    precio      REAL NOT NULL,
    UNIQUE(id_catalogo, id_insumo)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS catalogo_historial_precios (
    id_hist     INTEGER PRIMARY KEY AUTOINCREMENT,
    id_catalogo INTEGER NOT NULL,
    id_insumo   INTEGER NOT NULL,
    precio_ant  REAL,
    precio_new  REAL,
    fecha       TEXT DEFAULT (datetime('now'))
  )`);
  // Columnas nuevas en presupuestos (instalaciones existentes, ya que ahora
  // presupuestos absorbe lo que antes era la entidad "proyectos")
  try { db.run('ALTER TABLE presupuestos ADD COLUMN id_catalogo INTEGER DEFAULT NULL'); } catch(e) {}
  try { db.run('ALTER TABLE presupuestos ADD COLUMN descripcion TEXT'); } catch(e) {}
  try { db.run('ALTER TABLE presupuestos ADD COLUMN ubicacion TEXT'); } catch(e) {}
  try { db.run('ALTER TABLE presupuestos ADD COLUMN cliente TEXT'); } catch(e) {}
  try { db.run("ALTER TABLE presupuestos ADD COLUMN moneda TEXT DEFAULT 'HNL'"); } catch(e) {}
  try { db.run('ALTER TABLE presupuestos ADD COLUMN fecha_inicio TEXT'); } catch(e) {}
  try { db.run('ALTER TABLE presupuestos ADD COLUMN fecha_fin TEXT'); } catch(e) {}
  try { db.run("ALTER TABLE presupuestos ADD COLUMN estado TEXT DEFAULT 'activo'"); } catch(e) {}
  try { db.run('ALTER TABLE presupuestos ADD COLUMN creado_por INTEGER'); } catch(e) {}

  saveDb();
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function initializeSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      correo TEXT UNIQUE NOT NULL,
      contrasena_hash TEXT NOT NULL,
      rol TEXT DEFAULT 'ingeniero' CHECK(rol IN ('admin','ingeniero','consulta')),
      fecha_creacion TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS presupuestos (
      id_presupuesto INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      ubicacion TEXT,
      cliente TEXT,
      moneda TEXT DEFAULT 'HNL',
      fecha_inicio TEXT,
      fecha_fin TEXT,
      estado TEXT DEFAULT 'activo' CHECK(estado IN ('activo','finalizado','archivado')),
      creado_por INTEGER,
      id_catalogo INTEGER DEFAULT NULL,
      costos_directos REAL DEFAULT 0,
      porcentaje_indirectos REAL DEFAULT 0,
      porcentaje_utilidad REAL DEFAULT 0,
      porcentaje_imprevistos REAL DEFAULT 0,
      costos_indirectos REAL DEFAULT 0,
      utilidad REAL DEFAULT 0,
      imprevistos REAL DEFAULT 0,
      total_general REAL DEFAULT 0,
      fecha_creacion TEXT DEFAULT (datetime('now')),
      id_centro_costo INTEGER DEFAULT NULL,
      FOREIGN KEY (creado_por) REFERENCES usuarios(id_usuario),
      FOREIGN KEY (id_centro_costo) REFERENCES centros_costo(id_centro)
    );

    CREATE TABLE IF NOT EXISTS categorias_insumo (
      id_categoria INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS insumos (
      id_insumo INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE,
      descripcion TEXT NOT NULL,
      unidad TEXT NOT NULL,
      id_categoria INTEGER NOT NULL,
      precio_unitario REAL NOT NULL,
      fecha_actualizacion TEXT,
      activo INTEGER DEFAULT 1,
      FOREIGN KEY (id_categoria) REFERENCES categorias_insumo(id_categoria)
    );

    CREATE TABLE IF NOT EXISTS historial_precios (
      id_historial INTEGER PRIMARY KEY AUTOINCREMENT,
      id_insumo INTEGER NOT NULL,
      precio_anterior REAL,
      precio_nuevo REAL,
      fecha_cambio TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (id_insumo) REFERENCES insumos(id_insumo)
    );

    CREATE TABLE IF NOT EXISTS actividades (
      id_actividad INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE NOT NULL,
      descripcion TEXT NOT NULL,
      unidad TEXT NOT NULL,
      costo_total REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS actividad_insumos (
      id_detalle INTEGER PRIMARY KEY AUTOINCREMENT,
      id_actividad INTEGER NOT NULL,
      id_insumo INTEGER NOT NULL,
      cantidad REAL NOT NULL,
      rendimiento REAL DEFAULT 1,
      desperdicio REAL DEFAULT 0,
      costo_parcial REAL DEFAULT 0,
      FOREIGN KEY (id_actividad) REFERENCES actividades(id_actividad),
      FOREIGN KEY (id_insumo) REFERENCES insumos(id_insumo)
    );

    CREATE TABLE IF NOT EXISTS modulos (
      id_modulo INTEGER PRIMARY KEY AUTOINCREMENT,
      id_presupuesto INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      orden_visual INTEGER DEFAULT 1,
      FOREIGN KEY (id_presupuesto) REFERENCES presupuestos(id_presupuesto)
    );

    CREATE TABLE IF NOT EXISTS especificaciones_fhis (
      id_especificacion INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      unidad TEXT NOT NULL,
      descripcion TEXT,
      consideraciones TEXT,
      criterios_pago TEXT,
      fecha_carga TEXT DEFAULT (date('now'))
    );

    CREATE TABLE IF NOT EXISTS centros_costo (
      id_centro INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      zona TEXT,
      activo INTEGER DEFAULT 1,
      fecha_creacion TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS centro_costo_precios (
      id_precio INTEGER PRIMARY KEY AUTOINCREMENT,
      id_centro INTEGER NOT NULL,
      id_insumo INTEGER NOT NULL,
      precio_unitario REAL NOT NULL,
      fecha_actualizacion TEXT DEFAULT (datetime('now')),
      UNIQUE(id_centro, id_insumo),
      FOREIGN KEY (id_centro) REFERENCES centros_costo(id_centro),
      FOREIGN KEY (id_insumo) REFERENCES insumos(id_insumo)
    );

    CREATE TABLE IF NOT EXISTS presupuesto_partidas (
      id_partida INTEGER PRIMARY KEY AUTOINCREMENT,
      id_presupuesto INTEGER NOT NULL,
      id_modulo INTEGER,
      id_actividad INTEGER NOT NULL,
      cantidad REAL NOT NULL,
      precio_unitario REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (id_presupuesto) REFERENCES presupuestos(id_presupuesto),
      FOREIGN KEY (id_modulo) REFERENCES modulos(id_modulo),
      FOREIGN KEY (id_actividad) REFERENCES actividades(id_actividad)
    );
  `);

  // ── Migrations: columnas nuevas en tablas existentes ──
  try { db.run('ALTER TABLE presupuestos ADD COLUMN id_centro_costo INTEGER DEFAULT NULL'); } catch(e) {}

  // Seed data
  db.run(`INSERT OR IGNORE INTO categorias_insumo (nombre) VALUES
    ('Materiales'),('Mano de Obra'),('Equipo'),('Herramientas'),('Subcontratos');`);

  // Default admin user (password: admin123)
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync('admin123', 10);
  db.run(`INSERT OR IGNORE INTO usuarios (nombre, correo, contrasena_hash, rol) VALUES 
    ('Administrador', 'admin@costos.hn', '${hash}', 'admin');`);

  // Sample insumos
  db.run(`INSERT OR IGNORE INTO insumos (codigo, descripcion, unidad, id_categoria, precio_unitario, fecha_actualizacion) VALUES
    ('MAT-001', 'Cemento Portland Tipo I (42.5 kg)', 'Bolsa', 1, 260.00, date('now')),
    ('MAT-002', 'Arena de río lavada', 'm³', 1, 450.00, date('now')),
    ('MAT-003', 'Piedra triturada 3/4"', 'm³', 1, 550.00, date('now')),
    ('MAT-004', 'Varilla corrugada Ø 3/8"', 'Quintal', 1, 1650.00, date('now')),
    ('MAT-005', 'Varilla corrugada Ø 1/2"', 'Quintal', 1, 1680.00, date('now')),
    ('MAT-006', 'Bloque de concreto 15x20x40', 'Unidad', 1, 28.00, date('now')),
    ('MAT-007', 'Tubo PVC Ø 4" SDR-41', 'ML', 1, 185.00, date('now')),
    ('MAT-008', 'Tubo PVC Ø 6" SDR-26', 'ML', 1, 320.00, date('now')),
    ('MAT-009', 'Alambre de amarre', 'Libra', 1, 18.00, date('now')),
    ('MAT-010', 'Clavos 4"', 'Libra', 1, 22.00, date('now')),
    ('MO-001', 'Oficial albanil', 'Día', 2, 450.00, date('now')),
    ('MO-002', 'Ayudante de albanilería', 'Día', 2, 350.00, date('now')),
    ('MO-003', 'Carpintero', 'Día', 2, 480.00, date('now')),
    ('MO-004', 'Plomero', 'Día', 2, 500.00, date('now')),
    ('MO-005', 'Peón', 'Día', 2, 320.00, date('now')),
    ('EQ-001', 'Mezcladora de concreto (1 saco)', 'Hora', 3, 250.00, date('now')),
    ('EQ-002', 'Compactadora tipo sapo', 'Hora', 3, 350.00, date('now')),
    ('EQ-003', 'Retroexcavadora', 'Hora', 3, 2800.00, date('now')),
    ('EQ-004', 'Camión volquete 6m³', 'Hora', 3, 1800.00, date('now'));`);

  // Sample actividad
  db.run(`INSERT OR IGNORE INTO actividades (codigo, descripcion, unidad) VALUES
    ('ACT-001', 'Concreto simple f''c=210 kg/cm² (1:2:3)', 'm³'),
    ('ACT-002', 'Mampostería de bloque 15x20x40 con mezcla 1:4', 'm²'),
    ('ACT-003', 'Excavación manual en material común h≤2m', 'm³'),
    ('ACT-004', 'Relleno y compactación con material selecto', 'm³'),
    ('ACT-005', 'Suministro e instalación tubo PVC Ø 4"', 'ML');`);
}

module.exports = { getDb, saveDb };
