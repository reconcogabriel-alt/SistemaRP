const express = require('express');
const router = express.Router();
const { getDb, saveDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

// GET actividades — búsqueda server-side + paginación
// ?q=texto&limit=50&offset=0
router.get('/', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const q      = (req.query.q || '').trim();
    const limit  = Math.min(parseInt(req.query.limit)  || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    let where = ''; let params = [];
    if (q) {
      where = 'WHERE UPPER(descripcion) LIKE UPPER(?) OR UPPER(codigo) LIKE UPPER(?)';
      const pat = '%' + q + '%';
      params = [pat, pat];
    }
    const cntRes = db.exec('SELECT COUNT(*) FROM actividades ' + where, params);
    const total  = cntRes.length ? cntRes[0].values[0][0] : 0;
    const qSafe  = q.replace(/'/g, "''");
    const orderBy = q
      ? "ORDER BY CASE WHEN UPPER(codigo) LIKE UPPER('%" + qSafe + "%') THEN 0 ELSE 1 END, codigo"
      : 'ORDER BY codigo';
    // sql.js no acepta params adicionales despues de los WHERE params — interpolar LIMIT/OFFSET
    const sql = 'SELECT id_actividad, codigo, descripcion, unidad, costo_total FROM actividades ' + where + ' ' + orderBy + ' LIMIT ' + limit + ' OFFSET ' + offset;
    const result = db.exec(sql, params);
    const rows = result.length ? result[0].values.map(r => ({
      id_actividad: r[0], codigo: r[1], descripcion: r[2], unidad: r[3], costo_total: r[4]
    })) : [];
    res.json({ rows, total, limit, offset, hasMore: offset + rows.length < total });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ── GET actividades SIN especificación técnica (selector modal EETT) ──
// ?q=texto  →  busca por código o descripción
router.get('/sin-eett', requireAuth, async (req, res) => {
  try {
    const db  = await getDb();
    const q   = (req.query.q || '').trim();
    const pat = `%${q}%`;
    const sql = q
      ? `SELECT a.id_actividad, a.codigo, a.descripcion, a.unidad
         FROM actividades a
         LEFT JOIN especificaciones_fhis e ON e.codigo = a.codigo
         WHERE e.id_especificacion IS NULL
           AND (UPPER(a.codigo) LIKE UPPER(?) OR UPPER(a.descripcion) LIKE UPPER(?))
         ORDER BY a.codigo LIMIT 40`
      : `SELECT a.id_actividad, a.codigo, a.descripcion, a.unidad
         FROM actividades a
         LEFT JOIN especificaciones_fhis e ON e.codigo = a.codigo
         WHERE e.id_especificacion IS NULL
         ORDER BY a.codigo LIMIT 40`;
    const r = db.exec(sql, q ? [pat, pat] : []);
    const rows = r.length ? r[0].values.map(v => ({
      id_actividad: v[0], codigo: v[1], descripcion: v[2], unidad: v[3]
    })) : [];
    res.json({ rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET actividad detalle con insumos
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const actResult = db.exec(`SELECT * FROM actividades WHERE id_actividad = ?`, [req.params.id]);
    if (!actResult.length) return res.status(404).json({ error: 'No encontrada' });
    const a = actResult[0].values[0];
    const actividad = { id_actividad: a[0], codigo: a[1], descripcion: a[2], unidad: a[3], costo_total: a[4] };
    
    const detResult = db.exec(`
      SELECT ai.*, i.descripcion, i.unidad, i.precio_unitario, c.nombre as categoria
      FROM actividad_insumos ai
      JOIN insumos i ON ai.id_insumo = i.id_insumo
      JOIN categorias_insumo c ON i.id_categoria = c.id_categoria
      WHERE ai.id_actividad = ?
      ORDER BY c.id_categoria, i.descripcion
    `, [req.params.id]);
    
    const detalles = detResult.length ? detResult[0].values.map(r => ({
      id_detalle: r[0], id_actividad: r[1], id_insumo: r[2], cantidad: r[3],
      rendimiento: r[4], desperdicio: r[5], costo_parcial: r[6],
      descripcion: r[7], unidad: r[8], precio_unitario: r[9], categoria: r[10]
    })) : [];
    
    res.json({ actividad, detalles });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create actividad
router.post('/', requireAuth, async (req, res) => {
  try {
    const { codigo, descripcion, unidad } = req.body;
    const db = await getDb();
    db.run(`INSERT INTO actividades (codigo, descripcion, unidad) VALUES (?, ?, ?)`,
      [codigo, descripcion, unidad]);
    const result = db.exec(`SELECT last_insert_rowid()`);
    saveDb();
    res.json({ ok: true, id: result[0].values[0][0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update actividad
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { codigo, descripcion, unidad } = req.body;
    const db = await getDb();
    db.run(`UPDATE actividades SET codigo=?, descripcion=?, unidad=? WHERE id_actividad=?`,
      [codigo, descripcion, unidad, req.params.id]);
    saveDb();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE actividad
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    db.run(`DELETE FROM actividad_insumos WHERE id_actividad = ?`, [req.params.id]);
    db.run(`DELETE FROM actividades WHERE id_actividad = ?`, [req.params.id]);
    saveDb();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST add insumo to actividad
router.post('/:id/insumos', requireAuth, async (req, res) => {
  try {
    const { id_insumo, cantidad, rendimiento = 1, desperdicio = 0 } = req.body;
    const db = await getDb();
    
    // Get price
    const pr = db.exec(`SELECT precio_unitario FROM insumos WHERE id_insumo = ?`, [id_insumo]);
    const precio = pr[0].values[0][0];
    const costo_parcial = (cantidad / rendimiento) * (1 + desperdicio / 100) * precio;
    
    db.run(`INSERT INTO actividad_insumos (id_actividad, id_insumo, cantidad, rendimiento, desperdicio, costo_parcial)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [req.params.id, id_insumo, cantidad, rendimiento, desperdicio, costo_parcial]);
    
    // Recalculate total
    recalcTotal(db, req.params.id);
    saveDb();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update insumo in actividad
router.put('/:id/insumos/:detId', requireAuth, async (req, res) => {
  try {
    const { id_insumo, cantidad, rendimiento = 1, desperdicio = 0 } = req.body;
    const db = await getDb();
    const pr = db.exec(`SELECT precio_unitario FROM insumos WHERE id_insumo = ?`, [id_insumo]);
    const precio = pr[0].values[0][0];
    const costo_parcial = (cantidad / rendimiento) * (1 + desperdicio / 100) * precio;
    
    db.run(`UPDATE actividad_insumos SET id_insumo=?, cantidad=?, rendimiento=?, desperdicio=?, costo_parcial=? WHERE id_detalle=?`,
      [id_insumo, cantidad, rendimiento, desperdicio, costo_parcial, req.params.detId]);
    
    recalcTotal(db, req.params.id);
    saveDb();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE insumo from actividad
router.delete('/:id/insumos/:detId', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    db.run(`DELETE FROM actividad_insumos WHERE id_detalle = ?`, [req.params.detId]);
    recalcTotal(db, req.params.id);
    saveDb();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

function recalcTotal(db, id_actividad) {
  const result = db.exec(`SELECT COALESCE(SUM(costo_parcial),0) FROM actividad_insumos WHERE id_actividad = ?`, [id_actividad]);
  const total = result[0].values[0][0];
  db.run(`UPDATE actividades SET costo_total = ? WHERE id_actividad = ?`, [total, id_actividad]);
}


// POST recalcular TODOS los costos unitarios (llama recalc_actividades)
router.post('/recalcular', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const acts = db.exec('SELECT id_actividad FROM actividades');
    if (!acts.length) return res.json({ ok: true, actualizadas: 0 });
    let n = 0;
    for (const [id] of acts[0].values) {
      const dets = db.exec(`
        SELECT ai.id_detalle, ai.cantidad, ai.rendimiento, ai.desperdicio, i.precio_unitario
        FROM actividad_insumos ai JOIN insumos i ON ai.id_insumo=i.id_insumo
        WHERE ai.id_actividad=?`, [id]);
      if (!dets.length || !dets[0].values.length) continue;
      let total = 0;
      for (const [detId, cant, rend, desp, precio] of dets[0].values) {
        const cp = (cant / (rend||1)) * (1 + (desp||0)/100) * precio;
        db.run('UPDATE actividad_insumos SET costo_parcial=? WHERE id_detalle=?', [cp, detId]);
        total += cp;
      }
      db.run('UPDATE actividades SET costo_total=? WHERE id_actividad=?', [total, id]);
      n++;
    }
    saveDb();
    res.json({ ok: true, actualizadas: n });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST clonar actividad (copia completa con nuevo código)
router.post('/:id/clonar', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const actR = db.exec('SELECT codigo,descripcion,unidad,costo_total FROM actividades WHERE id_actividad=?',[req.params.id]);
    if (!actR.length||!actR[0].values.length) return res.status(404).json({error:'No encontrada'});
    const [cod,desc,unidad,total] = actR[0].values[0];
    const nuevoCod = cod + '-COPIA';
    db.run('INSERT INTO actividades (codigo,descripcion,unidad,costo_total) VALUES (?,?,?,?)',
      [nuevoCod, desc+' (copia)', unidad, total]);
    const newId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    // Copiar insumos
    const dets = db.exec('SELECT id_insumo,cantidad,rendimiento,desperdicio,costo_parcial FROM actividad_insumos WHERE id_actividad=?',[req.params.id]);
    if (dets.length&&dets[0].values.length) {
      for (const [idIns,cant,rend,desp,cp] of dets[0].values) {
        db.run('INSERT INTO actividad_insumos (id_actividad,id_insumo,cantidad,rendimiento,desperdicio,costo_parcial) VALUES (?,?,?,?,?,?)',
          [newId,idIns,cant,rend,desp,cp]);
      }
    }
    saveDb();
    res.json({ok:true,id:newId,codigo:nuevoCod});
  } catch(e){res.status(500).json({error:e.message});}
});

module.exports = router;
