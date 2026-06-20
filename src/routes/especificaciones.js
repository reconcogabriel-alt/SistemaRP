const express = require('express');
const router  = express.Router();
const { getDb, saveDb } = require('../db/database');
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

// ── POST crear nueva especificación ───────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const { codigo, nombre, unidad, descripcion, consideraciones, criterios_pago } = req.body;
    if (!codigo || !nombre || !unidad)
      return res.status(400).json({ error: 'Código, nombre y unidad son obligatorios' });

    const db = await getDb();

    // Verificar que exista la actividad con ese código
    const act = db.exec(`SELECT codigo FROM actividades WHERE codigo = ?`, [codigo]);
    if (!act.length || !act[0].values.length)
      return res.status(400).json({ error: `No existe una actividad con código "${codigo}". Cree primero la actividad en el módulo Actividades / CU.` });

    // Verificar que no exista ya la especificación
    const exist = db.exec(`SELECT id_especificacion FROM especificaciones_fhis WHERE codigo = ?`, [codigo]);
    if (exist.length && exist[0].values.length)
      return res.status(409).json({ error: 'Ya existe una especificación técnica para ese código.' });

    db.run(
      `INSERT INTO especificaciones_fhis (codigo, nombre, unidad, descripcion, consideraciones, criterios_pago)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [codigo, nombre, unidad, descripcion || '', consideraciones || '', criterios_pago || '']
    );
    const r2 = db.exec(`SELECT last_insert_rowid()`);
    saveDb();
    res.json({ ok: true, id: r2[0].values[0][0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PUT actualizar especificación ─────────────────────────
router.put('/:codigo', requireAuth, async (req, res) => {
  try {
    const { nombre, unidad, descripcion, consideraciones, criterios_pago } = req.body;
    if (!nombre || !unidad)
      return res.status(400).json({ error: 'Nombre y unidad son obligatorios' });

    const db = await getDb();
    const exist = db.exec(`SELECT id_especificacion FROM especificaciones_fhis WHERE codigo = ?`, [req.params.codigo]);
    if (!exist.length || !exist[0].values.length)
      return res.status(404).json({ error: 'Especificación no encontrada' });

    db.run(
      `UPDATE especificaciones_fhis
       SET nombre=?, unidad=?, descripcion=?, consideraciones=?, criterios_pago=?
       WHERE codigo=?`,
      [nombre, unidad, descripcion || '', consideraciones || '', criterios_pago || '', req.params.codigo]
    );
    saveDb();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
