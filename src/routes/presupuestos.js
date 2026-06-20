const express = require('express');
const router  = express.Router();
const { getDb, saveDb } = require('../db/database');
const { requireAuth }   = require('../middleware/auth');

const n = v => (v === undefined || v === '' ? null : v);

// ── GET todos los presupuestos (para selector de bitácora, valuaciones, etc.) ──
router.get('/', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const result = db.exec(
      `SELECT id_presupuesto, nombre, total_general, cliente, ubicacion, estado
       FROM presupuestos
       WHERE estado != 'archivado'
       ORDER BY id_presupuesto DESC`);
    const rows = result.length ? result[0].values.map(r => ({
      id_presupuesto: r[0], nombre: r[1], total_general: r[2],
      cliente: r[3], ubicacion: r[4], estado: r[5]
    })) : [];
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET detalle de un presupuesto ─────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const presResult = db.exec(`
      SELECT p.id_presupuesto, p.nombre, p.descripcion, p.ubicacion, p.cliente, p.moneda,
             p.fecha_inicio, p.fecha_fin, p.estado, p.id_catalogo,
             p.costos_directos, p.porcentaje_indirectos, p.porcentaje_utilidad,
             p.porcentaje_imprevistos, p.costos_indirectos, p.utilidad,
             p.imprevistos, p.total_general, p.fecha_creacion,
             p.id_centro_costo, cc.nombre as centro_nombre
      FROM presupuestos p
      LEFT JOIN centros_costo cc ON p.id_centro_costo = cc.id_centro
      WHERE p.id_presupuesto = ?`, [req.params.id]);
    if (!presResult.length || !presResult[0].values.length)
      return res.status(404).json({ error: 'No encontrado' });
    const r = presResult[0].values[0];
    const presupuesto = {
      id_presupuesto:r[0], nombre:r[1], descripcion:r[2], ubicacion:r[3], cliente:r[4], moneda:r[5],
      fecha_inicio:r[6], fecha_fin:r[7], estado:r[8], id_catalogo:r[9],
      costos_directos:r[10], porcentaje_indirectos:r[11], porcentaje_utilidad:r[12],
      porcentaje_imprevistos:r[13], costos_indirectos:r[14], utilidad:r[15],
      imprevistos:r[16], total_general:r[17], fecha_creacion:r[18],
      id_centro_costo:r[19], centro_nombre:r[20]
    };

    const capResult = db.exec(
      `SELECT id_modulo, id_presupuesto, nombre, orden_visual
       FROM modulos WHERE id_presupuesto=? ORDER BY orden_visual, id_modulo`,
      [req.params.id]);
    const módulos = capResult.length ? capResult[0].values.map(r => ({
      id_modulo:r[0], id_presupuesto:r[1], nombre:r[2], orden_visual:r[3]
    })) : [];

    const partResult = db.exec(`
      SELECT pp.id_partida, pp.id_presupuesto, pp.id_modulo, pp.id_actividad,
             pp.cantidad, pp.precio_unitario, pp.subtotal,
             a.descripcion as actividad_desc, a.codigo as actividad_codigo, a.unidad as actividad_unidad
      FROM presupuesto_partidas pp
      JOIN actividades a ON pp.id_actividad = a.id_actividad
      WHERE pp.id_presupuesto = ?
      ORDER BY pp.id_modulo, pp.id_partida`, [req.params.id]);
    const actividades = partResult.length ? partResult[0].values.map(r => ({
      id_partida:r[0], id_presupuesto:r[1], id_modulo:r[2], id_actividad:r[3],
      cantidad:r[4], precio_unitario:r[5], subtotal:r[6],
      actividad_desc:r[7], actividad_codigo:r[8], actividad_unidad:r[9]
    })) : [];

    res.json({ presupuesto, modulos: módulos, actividades });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST crear presupuesto ────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    // Leer defaults del sistema para porcentajes no enviados por el cliente
    const getCfg = (clave) => {
      const r = db.exec('SELECT valor FROM configuracion_sistema WHERE clave=?', [clave]);
      return (r.length && r[0].values.length) ? parseFloat(r[0].values[0][0]) || 0 : 0;
    };
    const defInd = getCfg('default_indirectos');
    const defUtil = getCfg('default_utilidad');
    const defImp = getCfg('default_imprevistos');

    const {
      nombre,
      descripcion = null,
      ubicacion = null,
      cliente = null,
      moneda = 'HNL',
      fecha_inicio = null,
      fecha_fin = null,
      porcentaje_indirectos  = defInd,
      porcentaje_utilidad    = defUtil,
      porcentaje_imprevistos = defImp,
      id_centro_costo        = null
    } = req.body;

    db.run(`INSERT INTO presupuestos
      (nombre, descripcion, ubicacion, cliente, moneda, fecha_inicio, fecha_fin, creado_por,
       porcentaje_indirectos, porcentaje_utilidad, porcentaje_imprevistos, id_centro_costo)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [nombre||'Presupuesto', n(descripcion), n(ubicacion), n(cliente), moneda, n(fecha_inicio), n(fecha_fin),
       req.session.userId, porcentaje_indirectos, porcentaje_utilidad, porcentaje_imprevistos, id_centro_costo||null]);
    const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    saveDb();
    res.json({ ok: true, id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PUT actualizar datos generales del presupuesto ────────
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { nombre, descripcion, ubicacion, cliente, moneda, fecha_inicio, fecha_fin, estado } = req.body;
    const db = await getDb();
    db.run(`UPDATE presupuestos SET nombre=?, descripcion=?, ubicacion=?, cliente=?, moneda=?,
            fecha_inicio=?, fecha_fin=?, estado=? WHERE id_presupuesto=?`,
      [nombre, n(descripcion), n(ubicacion), n(cliente), moneda||'HNL', n(fecha_inicio), n(fecha_fin),
       estado||'activo', req.params.id]);
    saveDb();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE presupuesto completo ───────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    db.run('DELETE FROM presupuesto_partidas WHERE id_presupuesto=?', [req.params.id]);
    db.run('DELETE FROM modulos WHERE id_presupuesto=?', [req.params.id]);
    db.run('DELETE FROM presupuestos WHERE id_presupuesto=?', [req.params.id]);
    saveDb();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST crear módulo ───────────────────────────────────
router.post('/:id/modulos', requireAuth, async (req, res) => {
  try {
    const { nombre, orden_visual=1 } = req.body;
    const db = await getDb();
    db.run(`INSERT INTO modulos (id_presupuesto, nombre, orden_visual) VALUES (?,?,?)`,
      [req.params.id, nombre, orden_visual]);
    const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    saveDb();
    res.json({ ok: true, id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE módulo ───────────────────────────────────────
router.delete('/:id/modulos/:capId', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const chk = db.exec('SELECT COUNT(*) FROM presupuesto_partidas WHERE id_modulo=?', [req.params.capId]);
    const cnt = chk.length ? chk[0].values[0][0] : 0;
    if (cnt > 0) return res.status(400).json({ error: `El módulo tiene ${cnt} actividad(s). Elimínalas primero.` });
    db.run('DELETE FROM modulos WHERE id_modulo=? AND id_presupuesto=?', [req.params.capId, req.params.id]);
    saveDb();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST agregar actividad ──────────────────────────────────
router.post('/:id/actividades', requireAuth, async (req, res) => {
  try {
    const { id_actividad, id_modulo, cantidad } = req.body;
    const db = await getDb();
    const actR = db.exec('SELECT costo_total FROM actividades WHERE id_actividad=?', [id_actividad]);
    if (!actR.length || !actR[0].values.length) return res.status(404).json({ error: 'Actividad no encontrada' });
    const precio_unitario = actR[0].values[0][0] || 0;
    const subtotal = (cantidad || 1) * precio_unitario;
    db.run(`INSERT INTO presupuesto_partidas (id_presupuesto, id_modulo, id_actividad, cantidad, precio_unitario, subtotal)
            VALUES (?,?,?,?,?,?)`,
      [req.params.id, n(id_modulo), id_actividad, cantidad||1, precio_unitario, subtotal]);
    recalcPresupuesto(db, req.params.id);
    saveDb();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE actividad ────────────────────────────────────────
router.delete('/:id/actividades/:partId', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    db.run('DELETE FROM presupuesto_partidas WHERE id_partida=?', [req.params.partId]);
    recalcPresupuesto(db, req.params.id);
    saveDb();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PUT cantidad de actividad ───────────────────────────────
router.put('/:id/actividades/:partId', requireAuth, async (req, res) => {
  try {
    const cantidad = parseFloat(req.body.cantidad);
    if (isNaN(cantidad) || cantidad < 0) return res.status(400).json({ error: 'Cantidad inválida' });
    const db = await getDb();
    const r = db.exec('SELECT precio_unitario FROM presupuesto_partidas WHERE id_partida=?', [req.params.partId]);
    if (!r.length || !r[0].values.length) return res.status(404).json({ error: 'Actividad no encontrada' });
    const precio_unitario = r[0].values[0][0];
    const subtotal = cantidad * precio_unitario;
    db.run('UPDATE presupuesto_partidas SET cantidad=?, subtotal=? WHERE id_partida=?',
      [cantidad, subtotal, req.params.partId]);
    recalcPresupuesto(db, req.params.id);
    saveDb();
    // Devolver los nuevos totales del presupuesto
    const pres = db.exec(`SELECT costos_directos, costos_indirectos, utilidad, imprevistos, total_general
      FROM presupuestos WHERE id_presupuesto=?`, [req.params.id]);
    const v = pres[0].values[0];
    res.json({ ok: true, subtotal,
      totales: { costos_directos:v[0], costos_indirectos:v[1], utilidad:v[2], imprevistos:v[3], total_general:v[4] }
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PUT porcentajes ───────────────────────────────────────
router.put('/:id/porcentajes', requireAuth, async (req, res) => {
  try {
    const { porcentaje_indirectos, porcentaje_utilidad, porcentaje_imprevistos } = req.body;
    const db = await getDb();
    db.run(`UPDATE presupuestos SET porcentaje_indirectos=?, porcentaje_utilidad=?, porcentaje_imprevistos=?
            WHERE id_presupuesto=?`,
      [porcentaje_indirectos, porcentaje_utilidad, porcentaje_imprevistos, req.params.id]);
    recalcPresupuesto(db, req.params.id);
    saveDb();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST recalcular presupuesto (usa precios del centro de costo si está asignado) ──
router.post('/:id/recalcular', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    // Obtener el centro asignado al presupuesto
    const centroR = db.exec('SELECT id_centro_costo FROM presupuestos WHERE id_presupuesto=?', [req.params.id]);
    const id_centro = centroR.length && centroR[0].values.length ? centroR[0].values[0][0] : null;

    // Obtener actividades con precio base de actividad
    const parts = db.exec(`
      SELECT pp.id_partida, pp.cantidad, pp.id_actividad,
             a.costo_total as precio_base
      FROM presupuesto_partidas pp
      JOIN actividades a ON pp.id_actividad = a.id_actividad
      WHERE pp.id_presupuesto = ?`, [req.params.id]);

    if (parts.length && parts[0].values.length) {
      for (const [id_partida, cant, id_actividad, precio_base] of parts[0].values) {
        let precio_final = precio_base || 0;

        // Si hay centro asignado, recalcular el costo_total de la actividad con precios del centro
        if (id_centro) {
          // Obtener todos los insumos de esta actividad con precio del centro (o precio base si no existe)
          const insR = db.exec(`
            SELECT ai.cantidad as qty_insumo, ai.rendimiento, ai.desperdicio,
                   COALESCE(cp.precio_unitario, i.precio_unitario) as precio_efectivo
            FROM actividad_insumos ai
            JOIN insumos i ON ai.id_insumo = i.id_insumo
            LEFT JOIN centro_costo_precios cp ON cp.id_insumo = i.id_insumo AND cp.id_centro = ?
            WHERE ai.id_actividad = ?`, [id_centro, id_actividad]);
          if (insR.length && insR[0].values.length) {
            precio_final = insR[0].values.reduce((sum, [qty, rend, desp, precio]) => {
              const factor = (qty / (rend || 1)) * (1 + (desp || 0) / 100);
              return sum + factor * (precio || 0);
            }, 0);
          }
        }

        db.run('UPDATE presupuesto_partidas SET precio_unitario=?, subtotal=? WHERE id_partida=?',
          [precio_final, cant * precio_final, id_partida]);
      }
    }
    recalcPresupuesto(db, req.params.id);
    saveDb();
    const r = db.exec(`SELECT costos_directos,costos_indirectos,utilidad,imprevistos,total_general
      FROM presupuestos WHERE id_presupuesto=?`, [req.params.id]);
    const v = r[0].values[0];
    res.json({ ok:true, id_centro, costos_directos:v[0], costos_indirectos:v[1], utilidad:v[2], imprevistos:v[3], total_general:v[4] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PUT asignar / cambiar centro de costo ────────────────────
router.put('/:id/centro', requireAuth, async (req, res) => {
  try {
    const { id_centro_costo } = req.body;
    const db = await getDb();
    db.run('UPDATE presupuestos SET id_centro_costo=? WHERE id_presupuesto=?',
      [id_centro_costo || null, req.params.id]);
    saveDb();
    // Devolver nombre del centro asignado
    let centro_nombre = null;
    if (id_centro_costo) {
      const r = db.exec('SELECT nombre FROM centros_costo WHERE id_centro=?', [id_centro_costo]);
      if (r.length && r[0].values.length) centro_nombre = r[0].values[0][0];
    }
    res.json({ ok: true, id_centro_costo: id_centro_costo || null, centro_nombre });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET insumos en L 0 de un presupuesto ─────────────────────
router.get('/:id/insumos-cero', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const centroR = db.exec('SELECT id_centro_costo FROM presupuestos WHERE id_presupuesto=?', [req.params.id]);
    const id_centro = centroR.length && centroR[0].values.length ? centroR[0].values[0][0] : null;

    // NIVEL 1: Actividades con precio_unitario = 0 (actividades sin costo calculado)
    const rActividades = db.exec(`
      SELECT pp.id_partida, a.codigo, a.descripcion, a.unidad, pp.cantidad,
             pp.precio_unitario, pp.subtotal
      FROM presupuesto_partidas pp
      JOIN actividades a ON pp.id_actividad = a.id_actividad
      WHERE pp.id_presupuesto = ?
        AND (pp.precio_unitario = 0 OR pp.precio_unitario IS NULL)
      ORDER BY a.codigo`, [req.params.id]);

    const actividads_cero = rActividades.length && rActividades[0].values.length
      ? rActividades[0].values.map(v => ({
          tipo: 'actividad',
          id_partida: v[0], codigo: v[1], descripcion: v[2],
          unidad: v[3], cantidad: v[4], precio_unitario: v[5]
        }))
      : [];

    // NIVEL 2: Insumos con precio 0 dentro de actividades (si tienen desglose)
    const rInsumos = db.exec(`
      SELECT DISTINCT i.codigo, i.descripcion, i.unidad, c.nombre as categoria,
             SUM(ai.cantidad * pp.cantidad) as cantidad_total,
             i.precio_unitario as precio_base,
             cp.precio_unitario as precio_centro
      FROM presupuesto_partidas pp
      JOIN actividad_insumos ai ON pp.id_actividad = ai.id_actividad
      JOIN insumos i ON ai.id_insumo = i.id_insumo
      JOIN categorias_insumo c ON i.id_categoria = c.id_categoria
      LEFT JOIN centro_costo_precios cp ON cp.id_insumo = i.id_insumo AND cp.id_centro = ?
      WHERE pp.id_presupuesto = ?
        AND COALESCE(cp.precio_unitario, i.precio_unitario, 0) = 0
      GROUP BY i.id_insumo ORDER BY c.id_categoria, i.descripcion`,
      [id_centro || -1, req.params.id]);

    const insumos_cero = rInsumos.length && rInsumos[0].values.length
      ? rInsumos[0].values.map(v => ({
          tipo: 'insumo',
          codigo: v[0], descripcion: v[1], unidad: v[2],
          categoria: v[3], cantidad_total: v[4],
          precio_base: v[5], precio_centro: v[6]
        }))
      : [];

    // Combinar: si hay actividades en cero, mostrarlas; si tienen insumos, mostrar esos también
    const total = actividads_cero.length + insumos_cero.length;
    res.json({
      total,
      actividads_cero,
      insumos_cero,
      // Para compatibilidad con frontend anterior
      insumos: insumos_cero,
      id_centro
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET insumos detallados para cotización de un presupuesto ─
router.get('/:id/cotizacion-insumos', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const centroR = db.exec('SELECT id_centro_costo FROM presupuestos WHERE id_presupuesto=?', [req.params.id]);
    const id_centro = centroR.length && centroR[0].values.length ? centroR[0].values[0][0] : null;

    // Actividades con precio 0 que tienen insumos cargados → listar esos insumos
    const rConInsumos = db.exec(`
      SELECT a.codigo as act_codigo, a.descripcion as act_desc, a.unidad as act_unidad,
             pp.cantidad as cant_partida,
             i.codigo as ins_codigo, i.descripcion as ins_desc, i.unidad as ins_unidad,
             cat.nombre as categoria,
             ai.cantidad as qty_insumo, ai.rendimiento, ai.desperdicio,
             (ai.cantidad / COALESCE(NULLIF(ai.rendimiento,0),1)) * (1 + COALESCE(ai.desperdicio,0)/100.0)
               * pp.cantidad as cantidad_total,
             COALESCE(cp.precio_unitario, i.precio_unitario, 0) as precio_efectivo,
             i.precio_unitario as precio_base,
             cp.precio_unitario as precio_centro
      FROM presupuesto_partidas pp
      JOIN actividades a ON pp.id_actividad = a.id_actividad
      JOIN actividad_insumos ai ON ai.id_actividad = a.id_actividad
      JOIN insumos i ON ai.id_insumo = i.id_insumo
      JOIN categorias_insumo cat ON i.id_categoria = cat.id_categoria
      LEFT JOIN centro_costo_precios cp ON cp.id_insumo = i.id_insumo AND cp.id_centro = ?
      WHERE pp.id_presupuesto = ?
        AND (pp.precio_unitario = 0 OR pp.precio_unitario IS NULL)
      ORDER BY a.codigo, cat.id_categoria, i.descripcion`,
      [id_centro || -1, req.params.id]);

    // Actividades con precio 0 SIN insumos cargados → mostrar la actividad directamente
    const rSinInsumos = db.exec(`
      SELECT a.codigo, a.descripcion, a.unidad, pp.cantidad, pp.id_partida
      FROM presupuesto_partidas pp
      JOIN actividades a ON pp.id_actividad = a.id_actividad
      WHERE pp.id_presupuesto = ?
        AND (pp.precio_unitario = 0 OR pp.precio_unitario IS NULL)
        AND NOT EXISTS (
          SELECT 1 FROM actividad_insumos ai WHERE ai.id_actividad = a.id_actividad
        )
      ORDER BY a.codigo`, [req.params.id]);

    // Insumos con precio 0 en actividades que SÍ tienen precio (insumos mal cotizados)
    const rInsumosCero = db.exec(`
      SELECT DISTINCT i.codigo, i.descripcion, i.unidad, cat.nombre as categoria,
             SUM(ai.cantidad * pp.cantidad) as cantidad_total
      FROM presupuesto_partidas pp
      JOIN actividad_insumos ai ON pp.id_actividad = ai.id_actividad
      JOIN insumos i ON ai.id_insumo = i.id_insumo
      JOIN categorias_insumo cat ON i.id_categoria = cat.id_categoria
      LEFT JOIN centro_costo_precios cp ON cp.id_insumo = i.id_insumo AND cp.id_centro = ?
      WHERE pp.id_presupuesto = ?
        AND COALESCE(cp.precio_unitario, i.precio_unitario, 0) = 0
      GROUP BY i.id_insumo ORDER BY cat.id_categoria, i.descripcion`,
      [id_centro || -1, req.params.id]);

    const por_actividad = {};
    if (rConInsumos.length && rConInsumos[0].values.length) {
      for (const v of rConInsumos[0].values) {
        const key = v[0]; // act_codigo
        if (!por_actividad[key]) {
          por_actividad[key] = { codigo:v[0], descripcion:v[1], unidad:v[2], cantidad:v[3], insumos:[] };
        }
        if (v[12] === 0) { // precio_efectivo = 0
          por_actividad[key].insumos.push({
            codigo:v[4], descripcion:v[5], unidad:v[6], categoria:v[7],
            cantidad_total:v[11], precio_base:v[13], precio_centro:v[14]
          });
        }
      }
    }

    const sin_insumos = rSinInsumos.length && rSinInsumos[0].values.length
      ? rSinInsumos[0].values.map(v => ({ codigo:v[0], descripcion:v[1], unidad:v[2], cantidad:v[3] }))
      : [];

    const insumos_sueltos = rInsumosCero.length && rInsumosCero[0].values.length
      ? rInsumosCero[0].values.map(v => ({ codigo:v[0], descripcion:v[1], unidad:v[2], categoria:v[3], cantidad_total:v[4] }))
      : [];

    res.json({ por_actividad, sin_insumos, insumos_sueltos, id_centro });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── helper: recalcular totales ────────────────────────────────
function recalcPresupuesto(db, id) {
  const r   = db.exec('SELECT COALESCE(SUM(subtotal),0) FROM presupuesto_partidas WHERE id_presupuesto=?', [id]);
  const cd  = r[0].values[0][0];
  const pct = db.exec('SELECT porcentaje_indirectos, porcentaje_utilidad, porcentaje_imprevistos FROM presupuestos WHERE id_presupuesto=?', [id]);
  if (!pct.length || !pct[0].values.length) return;
  const [pi, pu, pim] = pct[0].values[0];
  const ind  = cd * (pi  / 100);
  const util = cd * (pu  / 100);
  const impr = cd * (pim / 100);
  db.run(`UPDATE presupuestos SET costos_directos=?, costos_indirectos=?, utilidad=?, imprevistos=?, total_general=?
          WHERE id_presupuesto=?`, [cd, ind, util, impr, cd+ind+util+impr, id]);
}

module.exports = router;
