// src/routes/documentacion.js
const express = require('express');
const router  = express.Router();
const { getDb, saveDb } = require('../db/database');
const { requireAuth }   = require('../middleware/auth');

const n = v => (v === undefined || v === '' ? null : v);

function rows(db, sql, params = []) {
  const r = db.exec(sql, params);
  if (!r.length) return [];
  return r[0].values.map(v => {
    const o = {};
    r[0].columns.forEach((c, i) => { o[c] = v[i]; });
    return o;
  });
}
function row1(db, sql, params = []) {
  const r = rows(db, sql, params);
  return r.length ? r[0] : null;
}

// ── CATEGORÍAS ────────────────────────────────────────────────
router.get('/categorias', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    res.json(rows(db, `SELECT * FROM doc_categorias WHERE activo=1 ORDER BY nombre`));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── DOCUMENTOS ────────────────────────────────────────────────
router.get('/presupuesto/:pid', requireAuth, async (req, res) => {
  try {
    const db  = await getDb();
    const pid = parseInt(req.params.pid);
    const { categoria, estado, q } = req.query;
    let where = 'WHERE d.id_presupuesto=?';
    const p   = [pid];
    if (categoria) { where += ' AND d.categoria_id=?'; p.push(parseInt(categoria)); }
    if (estado)    { where += ' AND d.estado=?';       p.push(estado); }
    if (q) {
      where += ' AND (d.titulo LIKE ? OR d.numero_doc LIKE ? OR d.descripcion LIKE ?)';
      p.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    res.json(rows(db, `
      SELECT d.*, c.nombre AS categoria_nombre, c.icono AS categoria_icono, c.color AS categoria_color
      FROM documentos d JOIN doc_categorias c ON c.id=d.categoria_id
      ${where} ORDER BY d.categoria_id, d.fecha_documento DESC, d.id DESC`, p));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/resumen/:pid', requireAuth, async (req, res) => {
  try {
    const db  = await getDb();
    const pid = parseInt(req.params.pid);
    res.json(rows(db, `
      SELECT c.id, c.nombre, c.icono, c.color,
             COUNT(d.id) AS total,
             COUNT(CASE WHEN d.estado='vigente' THEN 1 END)  AS vigentes,
             COUNT(CASE WHEN d.estado='borrador' THEN 1 END) AS borradores,
             COALESCE(SUM(CASE WHEN d.monto_asociado IS NOT NULL THEN d.monto_asociado ELSE 0 END),0) AS monto_total
      FROM doc_categorias c
      LEFT JOIN documentos d ON d.categoria_id=c.id AND d.id_presupuesto=?
      WHERE c.activo=1 GROUP BY c.id ORDER BY c.nombre`, [pid]));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/ocs/:pid', requireAuth, async (req, res) => {
  try {
    const db   = await getDb();
    const pid  = parseInt(req.params.pid);
    const list = rows(db, `SELECT * FROM documentos WHERE id_presupuesto=? AND categoria_id=3 ORDER BY numero_doc ASC`, [pid]);
    res.json({
      ordenes: list,
      totales: {
        cantidad:      list.length,
        impacto_costo: list.reduce((s, r) => s + (r.oc_impacto_costo || 0), 0),
        impacto_plazo: list.reduce((s, r) => s + (r.oc_impacto_plazo || 0), 0),
      }
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const r  = row1(db, `SELECT d.*, c.nombre AS categoria_nombre, c.icono AS categoria_icono
      FROM documentos d JOIN doc_categorias c ON c.id=d.categoria_id WHERE d.id=?`,
      [parseInt(req.params.id)]);
    if (!r) return res.status(404).json({ error: 'No encontrado' });
    res.json(r);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { id_presupuesto, categoria_id, titulo, descripcion, numero_doc, version, estado,
      fecha_documento, fecha_vencimiento, monto_asociado, moneda,
      archivo_nombre, archivo_url, archivo_tipo,
      elaborado_por, revisado_por, aprobado_por, fecha_aprobacion,
      oc_numero, oc_impacto_costo, oc_impacto_plazo, notas } = req.body;
    if (!id_presupuesto || !categoria_id || !titulo)
      return res.status(400).json({ error: 'id_presupuesto, categoria_id y titulo son requeridos' });
    const db = await getDb();
    db.run(`INSERT INTO documentos
      (id_presupuesto,categoria_id,titulo,descripcion,numero_doc,version,estado,
       fecha_documento,fecha_vencimiento,monto_asociado,moneda,
       archivo_nombre,archivo_url,archivo_tipo,
       elaborado_por,revisado_por,aprobado_por,fecha_aprobacion,
       oc_numero,oc_impacto_costo,oc_impacto_plazo,notas)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [parseInt(id_presupuesto), parseInt(categoria_id), titulo, n(descripcion), n(numero_doc),
       version||'1.0', estado||'vigente',
       n(fecha_documento), n(fecha_vencimiento),
       monto_asociado ? parseFloat(monto_asociado) : null, moneda||'HNL',
       n(archivo_nombre), n(archivo_url), n(archivo_tipo),
       n(elaborado_por), n(revisado_por), n(aprobado_por), n(fecha_aprobacion),
       n(oc_numero),
       oc_impacto_costo ? parseFloat(oc_impacto_costo) : null,
       oc_impacto_plazo ? parseInt(oc_impacto_plazo)   : null,
       n(notas)]);
    const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    saveDb();
    res.json({ ok: true, id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { titulo, descripcion, numero_doc, version, estado,
      fecha_documento, fecha_vencimiento, monto_asociado, moneda,
      archivo_nombre, archivo_url, archivo_tipo,
      elaborado_por, revisado_por, aprobado_por, fecha_aprobacion,
      oc_numero, oc_impacto_costo, oc_impacto_plazo, notas } = req.body;
    const db = await getDb();
    db.run(`UPDATE documentos SET
      titulo=?,descripcion=?,numero_doc=?,version=?,estado=?,
      fecha_documento=?,fecha_vencimiento=?,monto_asociado=?,moneda=?,
      archivo_nombre=?,archivo_url=?,archivo_tipo=?,
      elaborado_por=?,revisado_por=?,aprobado_por=?,fecha_aprobacion=?,
      oc_numero=?,oc_impacto_costo=?,oc_impacto_plazo=?,notas=?,
      modificado_en=datetime('now')
      WHERE id=?`,
      [titulo, n(descripcion), n(numero_doc), version, estado,
       n(fecha_documento), n(fecha_vencimiento),
       monto_asociado ? parseFloat(monto_asociado) : null, moneda||'HNL',
       n(archivo_nombre), n(archivo_url), n(archivo_tipo),
       n(elaborado_por), n(revisado_por), n(aprobado_por), n(fecha_aprobacion),
       n(oc_numero),
       oc_impacto_costo ? parseFloat(oc_impacto_costo) : null,
       oc_impacto_plazo ? parseInt(oc_impacto_plazo)   : null,
       n(notas), parseInt(req.params.id)]);
    saveDb();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    db.run('DELETE FROM documentos WHERE id=?', [parseInt(req.params.id)]);
    saveDb();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
