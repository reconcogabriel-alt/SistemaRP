/**
 * importar_licitacion.js — Importación rápida de actividades desde licitación
 * Parsea lista pegada o subida, compara con BD y permite agregar al presupuesto
 */
const express = require('express');
const router  = express.Router();
const { getDb, saveDb } = require('../db/database');
const { requireAuth }   = require('../middleware/auth');

// ── HELPERS ───────────────────────────────────────────────────
function sqlAll(db, sql, p=[]) {
  try {
    const r = db.exec(sql, p);
    if (!r.length) return [];
    return r[0].values.map(row => {
      const o = {}; r[0].columns.forEach((c,i) => o[c]=row[i]); return o;
    });
  } catch(e) { throw new Error(e.message||String(e)); }
}
function sqlGet(db, sql, p=[]) { return sqlAll(db,sql,p)[0]||null; }
function sqlRun(db, sql, p=[]) {
  db.run(sql, p);
  const r = db.exec('SELECT last_insert_rowid()');
  return r.length ? r[0].values[0][0] : null;
}

// ── POST /api/licitacion/analizar ─────────────────────────────
// Recibe array de items parseados: [{módulo?, descripcion, unidad?, codigo?, cantidad?}]
// Devuelve cada item con: encontrado, id_actividad?, costo_total?, similares[]
router.post('/analizar', requireAuth, async (req, res) => {
  try {
    const db    = await getDb();
    const items = req.body.items; // [{tipo:'modulo'|'actividad', descripcion, unidad, codigo, cantidad}]
    if (!Array.isArray(items) || !items.length)
      return res.status(400).json({error:'Se requiere array items'});

    // Cargar todas las actividades en memoria para comparación eficiente
    const todasActs = sqlAll(db,
      'SELECT id_actividad, codigo, descripcion, unidad, costo_total FROM actividades ORDER BY codigo');

    const resultado = items.map(item => {
      if (item.tipo === 'modulo') return {...item, tipo:'modulo'};

      const desc    = (item.descripcion||'').trim().toUpperCase();
      const cod     = (item.codigo||'').trim().toUpperCase();
      const unidad  = (item.unidad||'').trim().toUpperCase();

      // 1. Coincidencia exacta por código
      let encontrada = cod ? todasActs.find(a => a.codigo.toUpperCase() === cod) : null;

      // 2. Coincidencia exacta por descripción
      if (!encontrada && desc)
        encontrada = todasActs.find(a => a.descripcion.toUpperCase() === desc);

      // 3. Similares por palabras clave (top 3)
      let similares = [];
      if (!encontrada && desc.length > 4) {
        const palabras = desc.split(/\s+/).filter(p => p.length > 3);
        const scored = todasActs.map(a => {
          const ad = a.descripcion.toUpperCase();
          const hits = palabras.filter(p => ad.includes(p)).length;
          return {...a, score: hits};
        }).filter(a => a.score > 0)
          .sort((a,b) => b.score - a.score)
          .slice(0, 3);
        similares = scored.map(a => ({
          id_actividad: a.id_actividad,
          codigo:       a.codigo,
          descripcion:  a.descripcion,
          unidad:       a.unidad,
          costo_total:  a.costo_total,
          score:        a.score,
        }));
      }

      return {
        ...item,
        tipo:          'actividad',
        encontrada:    !!encontrada,
        id_actividad:  encontrada?.id_actividad || null,
        codigo_bd:     encontrada?.codigo        || null,
        descripcion_bd:encontrada?.descripcion   || null,
        unidad_bd:     encontrada?.unidad        || null,
        costo_total:   encontrada?.costo_total   || 0,
        similares,
      };
    });

    const total     = resultado.filter(r=>r.tipo==='actividad').length;
    const halladas  = resultado.filter(r=>r.tipo==='actividad' && r.encontrada).length;
    const faltantes = total - halladas;

    res.json({items: resultado, stats: {total, halladas, faltantes}});
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ── POST /api/licitacion/importar ─────────────────────────────
// Recibe presupuesto destino + items confirmados → crea módulos y actividades
router.post('/importar', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const { id_presupuesto, items } = req.body;
    if (!id_presupuesto) return res.status(400).json({error:'id_presupuesto requerido'});

    const pres = sqlGet(db, 'SELECT * FROM presupuestos WHERE id_presupuesto=?', [id_presupuesto]);
    if (!pres) return res.status(404).json({error:'Presupuesto no encontrado'});

    // Obtener orden_visual máximo actual
    const maxOrden = sqlGet(db,
      'SELECT MAX(orden_visual) as mo FROM modulos WHERE id_presupuesto=?', [id_presupuesto]);
    let ordenCap = (maxOrden?.mo || 0) + 1;

    let capActual   = null;
    let agregadas   = 0;
    let omitidas    = 0;

    for (const item of items) {
      if (item.tipo === 'modulo') {
        // Crear módulo
        capActual = sqlRun(db,
          'INSERT INTO modulos(id_presupuesto, nombre, orden_visual) VALUES(?,?,?)',
          [id_presupuesto, item.descripcion, ordenCap++]);
        continue;
      }

      // Solo agregar si tiene id_actividad confirmado
      if (!item.id_actividad || !item.incluir) { omitidas++; continue; }

      const act = sqlGet(db,
        'SELECT costo_total FROM actividades WHERE id_actividad=?', [item.id_actividad]);
      if (!act) { omitidas++; continue; }

      const cantidad      = parseFloat(item.cantidad) || 1;
      const precio_unitario = act.costo_total || 0;
      const subtotal      = cantidad * precio_unitario;

      sqlRun(db, `INSERT INTO presupuesto_partidas
        (id_presupuesto, id_modulo, id_actividad, cantidad, precio_unitario, subtotal)
        VALUES(?,?,?,?,?,?)`,
        [id_presupuesto, capActual || null, item.id_actividad,
         cantidad, precio_unitario, subtotal]);
      agregadas++;
    }

    // Recalcular costos directos del presupuesto
    const totRes = sqlGet(db,
      'SELECT SUM(subtotal) as tot FROM presupuesto_partidas WHERE id_presupuesto=?',
      [id_presupuesto]);
    const cd = totRes?.tot || 0;
    const pct_i = pres.porcentaje_indirectos/100;
    const pct_u = pres.porcentaje_utilidad/100;
    const pct_imp = pres.porcentaje_imprevistos/100;
    const ci  = cd * pct_i;
    const ut  = cd * pct_u;
    const imp = cd * pct_imp;
    db.run(`UPDATE presupuestos SET costos_directos=?,costos_indirectos=?,utilidad=?,imprevistos=?,
            total_general=? WHERE id_presupuesto=?`,
      [cd, ci, ut, imp, cd+ci+ut+imp, id_presupuesto]);

    saveDb();
    res.json({message:`${agregadas} actividades agregadas, ${omitidas} omitidas`, agregadas, omitidas});
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ── GET /api/licitacion/presupuestos ──────────────────────────
router.get('/presupuestos', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    res.json(sqlAll(db, `
      SELECT p.id_presupuesto, p.nombre
      FROM presupuestos p
      ORDER BY p.fecha_creacion DESC`));
  } catch(e) { res.status(500).json({error:e.message}); }
});

module.exports = router;
