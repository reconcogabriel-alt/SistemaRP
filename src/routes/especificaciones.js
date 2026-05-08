const express = require('express');
const router  = express.Router();
const { getDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

// ── GET buscar especificaciones ────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const { q, limit = 50, offset = 0 } = req.query;
    let sql, params;

    if (q && q.trim()) {
      const busqueda = `%${q.trim()}%`;
      sql = `SELECT id_especificacion, codigo, nombre, unidad, descripcion, consideraciones, criterios_pago
             FROM especificaciones_fhis
             WHERE codigo LIKE ? OR nombre LIKE ? OR descripcion LIKE ?
             ORDER BY codigo
             LIMIT ? OFFSET ?`;
      params = [busqueda, busqueda, busqueda, parseInt(limit), parseInt(offset)];
    } else {
      sql = `SELECT id_especificacion, codigo, nombre, unidad, descripcion, consideraciones, criterios_pago
             FROM especificaciones_fhis ORDER BY codigo LIMIT ? OFFSET ?`;
      params = [parseInt(limit), parseInt(offset)];
    }

    const r = db.exec(sql, params);
    const total_r = db.exec(
      q ? `SELECT COUNT(*) FROM especificaciones_fhis WHERE codigo LIKE ? OR nombre LIKE ? OR descripcion LIKE ?`
        : `SELECT COUNT(*) FROM especificaciones_fhis`,
      q ? [`%${q}%`, `%${q}%`, `%${q}%`] : []
    );

    const rows = r.length ? r[0].values.map(v => ({
      id_especificacion: v[0], codigo: v[1], nombre: v[2], unidad: v[3],
      descripcion: v[4], consideraciones: v[5], criterios_pago: v[6]
    })) : [];

    const total = total_r.length ? total_r[0].values[0][0] : 0;
    res.json({ total, rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET ficha por código ───────────────────────────────────
router.get('/:codigo', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const r = db.exec(
      `SELECT * FROM especificaciones_fhis WHERE codigo = ?`,
      [req.params.codigo]
    );
    if (!r.length || !r[0].values.length)
      return res.status(404).json({ error: 'Especificación no encontrada' });
    const [v] = r[0].values;
    res.json({
      id_especificacion: v[0], codigo: v[1], nombre: v[2], unidad: v[3],
      descripcion: v[4], consideraciones: v[5], criterios_pago: v[6], fecha_carga: v[7]
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
