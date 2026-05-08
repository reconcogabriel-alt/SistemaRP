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

function runMigrations() {
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

    CREATE TABLE IF NOT EXISTS proyectos (
      id_proyecto INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      ubicacion TEXT,
      cliente TEXT,
      moneda TEXT DEFAULT 'HNL',
      fecha_inicio TEXT,
      fecha_fin TEXT,
      estado TEXT DEFAULT 'activo' CHECK(estado IN ('activo','finalizado','archivado')),
      creado_por INTEGER,
      FOREIGN KEY (creado_por) REFERENCES usuarios(id_usuario)
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

    CREATE TABLE IF NOT EXISTS presupuestos (
      id_presupuesto INTEGER PRIMARY KEY AUTOINCREMENT,
      id_proyecto INTEGER NOT NULL,
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
      FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto),
      FOREIGN KEY (id_centro_costo) REFERENCES centros_costo(id_centro)
    );

    CREATE TABLE IF NOT EXISTS capitulos (
      id_capitulo INTEGER PRIMARY KEY AUTOINCREMENT,
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
      id_capitulo INTEGER,
      id_actividad INTEGER NOT NULL,
      cantidad REAL NOT NULL,
      precio_unitario REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (id_presupuesto) REFERENCES presupuestos(id_presupuesto),
      FOREIGN KEY (id_capitulo) REFERENCES capitulos(id_capitulo),
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
