const express = require('express');
const router = express.Router();
const { getDb, saveDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const n = v => (v === undefined || v === '' ? null : v);

router.get('/', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const result = db.exec(`
      SELECT p.id_proyecto, p.nombre, p.descripcion, p.ubicacion,
             p.cliente, p.moneda, p.fecha_inicio, p.fecha_fin,
             p.estado, p.creado_por, p.id_catalogo,
             u.nombre as creado_por_nombre,
             (SELECT COUNT(*) FROM presupuestos pr WHERE pr.id_proyecto = p.id_proyecto) as num_presupuestos,
             c.nombre as catalogo_nombre
      FROM proyectos p
      LEFT JOIN usuarios u ON p.creado_por = u.id_usuario
      LEFT JOIN catalogos_precios c ON p.id_catalogo = c.id_catalogo
      WHERE p.estado != 'archivado'
      ORDER BY p.id_proyecto DESC
    `);
    const rows = result.length ? result[0].values.map(r => ({
      id_proyecto: r[0], nombre: r[1], descripcion: r[2], ubicacion: r[3],
      cliente: r[4], moneda: r[5], fecha_inicio: r[6], fecha_fin: r[7],
      estado: r[8], creado_por: r[9], id_catalogo: r[10],
      creado_por_nombre: r[11], num_presupuestos: r[12], catalogo_nombre: r[13]
    })) : [];
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { nombre, descripcion, ubicacion, cliente, moneda = 'HNL', fecha_inicio, fecha_fin } = req.body;
    const db = await getDb();
    db.run(`INSERT INTO proyectos (nombre, descripcion, ubicacion, cliente, moneda, fecha_inicio, fecha_fin, creado_por)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, n(descripcion), n(ubicacion), n(cliente), moneda, n(fecha_inicio), n(fecha_fin), req.session.userId]);
    const result = db.exec(`SELECT last_insert_rowid()`);
    const id = result[0].values[0][0];
    saveDb();
    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { nombre, descripcion, ubicacion, cliente, moneda, fecha_inicio, fecha_fin, estado } = req.body;
    const db = await getDb();
    db.run(`UPDATE proyectos SET nombre=?, descripcion=?, ubicacion=?, cliente=?, moneda=?, fecha_inicio=?, fecha_fin=?, estado=? WHERE id_proyecto=?`,
      [nombre, n(descripcion), n(ubicacion), n(cliente), moneda, n(fecha_inicio), n(fecha_fin), estado, req.params.id]);
    saveDb();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    db.run(`UPDATE proyectos SET estado = 'archivado' WHERE id_proyecto = ?`, [req.params.id]);
    saveDb();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
