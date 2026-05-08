const express = require('express');
const router  = express.Router();
const { getDb, saveDb } = require('../db/database');
const { requireAuth }   = require('../middleware/auth');

// IMPORTANTE: rutas específicas ANTES de rutas con parámetros /:id

// GET todos los insumos
router.get('/', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const result = db.exec(`
      SELECT i.id_insumo, i.codigo, i.descripcion, i.unidad,
             i.id_categoria, i.precio_unitario, i.fecha_actualizacion, i.activo,
             c.nombre as categoria
      FROM insumos i
      JOIN categorias_insumo c ON i.id_categoria = c.id_categoria
      WHERE i.activo = 1
      ORDER BY i.id_categoria, i.descripcion
    `);
    const rows = result.length ? result[0].values.map(r => ({
      id_insumo: r[0], codigo: r[1], descripcion: r[2], unidad: r[3],
      id_categoria: r[4], precio_unitario: r[5], fecha_actualizacion: r[6],
      activo: r[7], categoria: r[8]
    })) : [];
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET categorias  ← específica, antes de /:id
router.get('/categorias', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const result = db.exec(`SELECT id_categoria, nombre FROM categorias_insumo ORDER BY nombre`);
    const rows = result.length ? result[0].values.map(r => ({ id_categoria: r[0], nombre: r[1] })) : [];
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET insumos sin precio  ← específica, ANTES de /:id/historial
router.get('/sin-precio', requireAuth, async (req, res) => {
  try {
    const db = await getDb();

    const resumen = db.exec(`
      SELECT c.nombre, c.id_categoria,
        COUNT(*) as total,
        SUM(CASE WHEN i.precio_unitario=0 OR i.precio_unitario IS NULL THEN 1 ELSE 0 END) as sin_precio
      FROM insumos i
      JOIN categorias_insumo c ON i.id_categoria=c.id_categoria
      WHERE i.activo=1
      GROUP BY c.id_categoria ORDER BY sin_precio DESC`);
    const categorias = resumen.length ? resumen[0].values.map(r=>({
      nombre:r[0], id_categoria:r[1], total:r[2], sin_precio:r[3]
    })) : [];

    const usados = db.exec(`
      SELECT i.id_insumo, i.codigo, i.descripcion, i.unidad, c.nombre as categoria,
             COUNT(DISTINCT ai.id_actividad) as num_actividades
      FROM insumos i
      JOIN categorias_insumo c ON i.id_categoria=c.id_categoria
      JOIN actividad_insumos ai ON ai.id_insumo=i.id_insumo
      WHERE i.activo=1 AND (i.precio_unitario=0 OR i.precio_unitario IS NULL)
      GROUP BY i.id_insumo
      ORDER BY num_actividades DESC, c.id_categoria, i.descripcion
      LIMIT 300`);
    const insumos_usados = usados.length ? usados[0].values.map(r=>({
      id_insumo:r[0], codigo:r[1], descripcion:r[2], unidad:r[3], categoria:r[4], num_actividades:r[5]
    })) : [];

    const noUsados = db.exec(`
      SELECT i.id_insumo, i.codigo, i.descripcion, i.unidad, c.nombre as categoria
      FROM insumos i
      JOIN categorias_insumo c ON i.id_categoria=c.id_categoria
      LEFT JOIN actividad_insumos ai ON ai.id_insumo=i.id_insumo
      WHERE i.activo=1 AND (i.precio_unitario=0 OR i.precio_unitario IS NULL)
        AND ai.id_insumo IS NULL
      ORDER BY c.id_categoria, i.descripcion LIMIT 100`);
    const insumos_no_usados = noUsados.length ? noUsados[0].values.map(r=>({
      id_insumo:r[0], codigo:r[1], descripcion:r[2], unidad:r[3], categoria:r[4]
    })) : [];

    const tots = db.exec(`
      SELECT COUNT(*),
        SUM(CASE WHEN precio_unitario=0 OR precio_unitario IS NULL THEN 1 ELSE 0 END)
      FROM insumos WHERE activo=1`);
    const [total_insumos, total_sin_precio] = tots.length ? tots[0].values[0] : [0,0];

    res.json({ categorias, insumos_usados, insumos_no_usados, total_insumos, total_sin_precio });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST crear insumo
router.post('/', requireAuth, async (req, res) => {
  try {
    const { codigo, descripcion, unidad, id_categoria, precio_unitario } = req.body;
    const db = await getDb();
    db.run(`INSERT INTO insumos (codigo, descripcion, unidad, id_categoria, precio_unitario, fecha_actualizacion)
      VALUES (?, ?, ?, ?, ?, date('now'))`,
      [codigo || null, descripcion, unidad, id_categoria, precio_unitario || 0]);
    const result = db.exec(`SELECT last_insert_rowid()`);
    const id = result[0].values[0][0];
    saveDb();
    res.json({ ok: true, id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT actualizar insumo  ← /:id viene DESPUÉS de rutas específicas
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { descripcion, unidad, id_categoria, precio_unitario, codigo } = req.body;
    const db = await getDb();
    const old = db.exec(`SELECT precio_unitario FROM insumos WHERE id_insumo=?`, [req.params.id]);
    if (old.length && old[0].values.length) {
      const oldPrice = old[0].values[0][0];
      if (oldPrice != precio_unitario) {
        db.run(`INSERT INTO historial_precios (id_insumo, precio_anterior, precio_nuevo) VALUES (?,?,?)`,
          [req.params.id, oldPrice, precio_unitario]);
      }
    }
    db.run(`UPDATE insumos SET codigo=?, descripcion=?, unidad=?, id_categoria=?,
              precio_unitario=?, fecha_actualizacion=date('now') WHERE id_insumo=?`,
      [codigo, descripcion, unidad, id_categoria, precio_unitario, req.params.id]);
    saveDb();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE (soft)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    db.run(`UPDATE insumos SET activo=0 WHERE id_insumo=?`, [req.params.id]);
    saveDb();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET historial de precios  ← /:id/historial
router.get('/:id/historial', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const result = db.exec(
      `SELECT id_historial, id_insumo, precio_anterior, precio_nuevo, fecha_cambio
       FROM historial_precios WHERE id_insumo=? ORDER BY fecha_cambio DESC LIMIT 20`,
      [req.params.id]);
    const rows = result.length ? result[0].values.map(r => ({
      id_historial:r[0], id_insumo:r[1], precio_anterior:r[2], precio_nuevo:r[3], fecha_cambio:r[4]
    })) : [];
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
