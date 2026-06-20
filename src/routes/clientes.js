const express = require('express');
const router  = express.Router();
const { getDb, saveDb } = require('../db/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Todos los endpoints de clientes son exclusivos del administrador
router.use(requireAuth, requireAdmin);

// ── GET /api/clientes ────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const { q } = req.query;
    let sql = `SELECT id_cliente, nombre, empresa, correo, telefono, direccion, nit, contacto, notas, activo, fecha_creacion
               FROM clientes`;
    const params = [];
    if (q && q.trim()) {
      sql += ` WHERE UPPER(nombre) LIKE UPPER(?) OR UPPER(empresa) LIKE UPPER(?) OR UPPER(correo) LIKE UPPER(?)`;
      const p = `%${q.trim()}%`;
      params.push(p, p, p);
    }
    sql += ` ORDER BY nombre`;
    const r = db.exec(sql, params);
    const rows = r.length ? r[0].values.map(v => ({
      id_cliente: v[0], nombre: v[1], empresa: v[2], correo: v[3],
      telefono: v[4], direccion: v[5], nit: v[6], contacto: v[7],
      notas: v[8], activo: v[9], fecha_creacion: v[10]
    })) : [];
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/clientes/:id ────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const db = await getDb();
    const r = db.exec(`SELECT * FROM clientes WHERE id_cliente = ?`, [req.params.id]);
    if (!r.length || !r[0].values.length) return res.status(404).json({ error: 'Cliente no encontrado' });
    const [v] = r[0].values;
    res.json({ id_cliente:v[0], nombre:v[1], empresa:v[2], correo:v[3], telefono:v[4],
               direccion:v[5], nit:v[6], contacto:v[7], notas:v[8], activo:v[9], fecha_creacion:v[10] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/clientes ───────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { nombre, empresa, correo, telefono, direccion, nit, contacto, notas } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const db = await getDb();
    db.run(
      `INSERT INTO clientes (nombre, empresa, correo, telefono, direccion, nit, contacto, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre.trim(), empresa||'', correo||'', telefono||'', direccion||'', nit||'', contacto||'', notas||'']
    );
    const r = db.exec(`SELECT last_insert_rowid()`);
    saveDb();
    res.json({ ok: true, id: r[0].values[0][0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/clientes/:id ────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { nombre, empresa, correo, telefono, direccion, nit, contacto, notas } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const db = await getDb();
    db.run(
      `UPDATE clientes SET nombre=?, empresa=?, correo=?, telefono=?, direccion=?, nit=?, contacto=?, notas=?
       WHERE id_cliente=?`,
      [nombre.trim(), empresa||'', correo||'', telefono||'', direccion||'', nit||'', contacto||'', notas||'', req.params.id]
    );
    saveDb();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PATCH /api/clientes/:id/activo ───────────────────────
router.patch('/:id/activo', async (req, res) => {
  try {
    const db = await getDb();
    db.run(`UPDATE clientes SET activo=? WHERE id_cliente=?`, [req.body.activo ? 1 : 0, req.params.id]);
    saveDb();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/clientes/:id ─────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const db = await getDb();
    db.run(`DELETE FROM clientes WHERE id_cliente=?`, [req.params.id]);
    saveDb();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
