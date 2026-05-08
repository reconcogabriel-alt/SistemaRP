const express = require('express');
const router  = express.Router();
const { getDb, saveDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

// Asegurar que las tablas existen (para BDs ya inicializadas)
async function ensureTables() {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS centros_costo (
    id_centro INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL, descripcion TEXT, zona TEXT,
    activo INTEGER DEFAULT 1, fecha_creacion TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS centro_costo_precios (
    id_precio INTEGER PRIMARY KEY AUTOINCREMENT,
    id_centro INTEGER NOT NULL, id_insumo INTEGER NOT NULL,
    precio_unitario REAL NOT NULL,
    fecha_actualizacion TEXT DEFAULT (datetime('now')),
    UNIQUE(id_centro, id_insumo)
  )`);
  try { db.run('ALTER TABLE presupuestos ADD COLUMN id_centro_costo INTEGER DEFAULT NULL'); } catch(e) {}
  saveDb();
}
ensureTables().catch(()=>{});

// ── GET todos los centros ─────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const r = db.exec(`
      SELECT c.id_centro, c.nombre, c.descripcion, c.zona, c.activo, c.fecha_creacion,
             COUNT(p.id_precio) as total_precios
      FROM centros_costo c
      LEFT JOIN centro_costo_precios p ON c.id_centro = p.id_centro
      GROUP BY c.id_centro ORDER BY c.nombre`);
    const centros = r.length && r[0].values.length
      ? r[0].values.map(v => ({
          id_centro:v[0], nombre:v[1], descripcion:v[2], zona:v[3],
          activo:v[4], fecha_creacion:v[5], total_precios:v[6]
        }))
      : [];
    res.json(centros);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET un centro con sus precios ────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const cr = db.exec(`SELECT id_centro,nombre,descripcion,zona,activo FROM centros_costo WHERE id_centro=?`, [req.params.id]);
    if (!cr.length || !cr[0].values.length) return res.status(404).json({ error: 'No encontrado' });
    const [id_centro,nombre,descripcion,zona,activo] = cr[0].values[0];

    const pr = db.exec(`
      SELECT cp.id_precio, cp.id_insumo, i.codigo, i.descripcion as insumo_desc,
             i.unidad, cat.nombre as categoria, i.precio_unitario as precio_base,
             cp.precio_unitario as precio_centro, cp.fecha_actualizacion
      FROM centro_costo_precios cp
      JOIN insumos i ON cp.id_insumo = i.id_insumo
      JOIN categorias_insumo cat ON i.id_categoria = cat.id_categoria
      WHERE cp.id_centro = ?
      ORDER BY cat.id_categoria, i.descripcion`, [req.params.id]);
    const precios = pr.length && pr[0].values.length
      ? pr[0].values.map(v => ({
          id_precio:v[0], id_insumo:v[1], codigo:v[2], insumo_desc:v[3],
          unidad:v[4], categoria:v[5], precio_base:v[6],
          precio_centro:v[7], fecha_actualizacion:v[8]
        }))
      : [];
    res.json({ id_centro, nombre, descripcion, zona, activo, precios });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST crear centro ─────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const { nombre, descripcion='', zona='' } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
    const db = await getDb();
    db.run(`INSERT INTO centros_costo (nombre, descripcion, zona) VALUES (?,?,?)`,
      [nombre.trim(), descripcion, zona]);
    const r = db.exec(`SELECT last_insert_rowid()`);
    saveDb();
    res.json({ ok: true, id: r[0].values[0][0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PUT editar centro ─────────────────────────────────────────
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { nombre, descripcion='', zona='', activo=1 } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
    const db = await getDb();
    db.run(`UPDATE centros_costo SET nombre=?,descripcion=?,zona=?,activo=? WHERE id_centro=?`,
      [nombre.trim(), descripcion, zona, activo, req.params.id]);
    saveDb();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE centro (solo si no está en uso) ────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const uso = db.exec(`SELECT COUNT(*) FROM presupuestos WHERE id_centro_costo=?`, [req.params.id]);
    if (uso[0].values[0][0] > 0)
      return res.status(400).json({ error: 'Este centro está asignado a presupuestos y no puede eliminarse' });
    db.run(`DELETE FROM centro_costo_precios WHERE id_centro=?`, [req.params.id]);
    db.run(`DELETE FROM centros_costo WHERE id_centro=?`, [req.params.id]);
    saveDb();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST upsert precio de un insumo en un centro ─────────────
router.post('/:id/precios', requireAuth, async (req, res) => {
  try {
    const { id_insumo, precio_unitario } = req.body;
    if (!id_insumo || precio_unitario === undefined)
      return res.status(400).json({ error: 'id_insumo y precio_unitario requeridos' });
    const db = await getDb();
    db.run(`INSERT INTO centro_costo_precios (id_centro, id_insumo, precio_unitario, fecha_actualizacion)
            VALUES (?,?,?,datetime('now'))
            ON CONFLICT(id_centro, id_insumo)
            DO UPDATE SET precio_unitario=excluded.precio_unitario,
                          fecha_actualizacion=excluded.fecha_actualizacion`,
      [req.params.id, id_insumo, parseFloat(precio_unitario)]);
    saveDb();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE precio individual de un centro ────────────────────
router.delete('/:id/precios/:idPrecio', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    db.run(`DELETE FROM centro_costo_precios WHERE id_precio=? AND id_centro=?`,
      [req.params.idPrecio, req.params.id]);
    saveDb();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET todos los insumos con precio base + precio del centro (para edición masiva) ──
router.get('/:id/insumos-completo', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const r = db.exec(`
      SELECT i.id_insumo, i.codigo, i.descripcion, i.unidad,
             cat.nombre as categoria, cat.id_categoria,
             i.precio_unitario as precio_base,
             cp.precio_unitario as precio_centro,
             cp.id_precio
      FROM insumos i
      JOIN categorias_insumo cat ON i.id_categoria = cat.id_categoria
      LEFT JOIN centro_costo_precios cp ON cp.id_insumo = i.id_insumo AND cp.id_centro = ?
      WHERE i.activo = 1
      ORDER BY cat.id_categoria, i.descripcion`, [req.params.id]);
    const insumos = r.length && r[0].values.length
      ? r[0].values.map(v => ({
          id_insumo:v[0], codigo:v[1], descripcion:v[2], unidad:v[3],
          categoria:v[4], id_categoria:v[5],
          precio_base:v[6], precio_centro:v[7], id_precio:v[8]
        }))
      : [];
    res.json(insumos);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST guardar múltiples precios a la vez (guardado masivo) ─
router.post('/:id/precios-masivo', requireAuth, async (req, res) => {
  try {
    const { precios } = req.body; // [{id_insumo, precio_unitario}]
    if (!Array.isArray(precios)) return res.status(400).json({ error: 'precios debe ser array' });
    const db = await getDb();
    let actualizados = 0;
    for (const p of precios) {
      if (!p.id_insumo || p.precio_unitario === undefined || p.precio_unitario === null) continue;
      const precio = parseFloat(p.precio_unitario);
      if (isNaN(precio) || precio < 0) continue;
      if (precio === 0) {
        // Si mandan 0, eliminamos el precio del centro (usa precio base)
        db.run(`DELETE FROM centro_costo_precios WHERE id_centro=? AND id_insumo=?`,
          [req.params.id, p.id_insumo]);
      } else {
        db.run(`INSERT INTO centro_costo_precios (id_centro, id_insumo, precio_unitario, fecha_actualizacion)
                VALUES (?,?,?,datetime('now'))
                ON CONFLICT(id_centro, id_insumo)
                DO UPDATE SET precio_unitario=excluded.precio_unitario, fecha_actualizacion=excluded.fecha_actualizacion`,
          [req.params.id, p.id_insumo, precio]);
      }
      actualizados++;
    }
    saveDb();
    res.json({ ok: true, actualizados });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
