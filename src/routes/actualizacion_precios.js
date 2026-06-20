const express = require('express');
const router  = express.Router();
const { getDb, saveDb } = require('../db/database');
const { requireAuth }   = require('../middleware/auth');

// ── Migration: tabla de sesiones de actualización ──────────────
async function ensureTables() {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS sesiones_actualizacion (
    id_sesion       INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre          TEXT NOT NULL,
    fecha           TEXT DEFAULT (date('now')),
    usuario         TEXT,
    total_insumos   INTEGER DEFAULT 0,
    total_afectados INTEGER DEFAULT 0,
    variacion_prom  REAL DEFAULT 0,
    nota            TEXT,
    creado_en       TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS sesion_detalle (
    id_detalle      INTEGER PRIMARY KEY AUTOINCREMENT,
    id_sesion       INTEGER NOT NULL,
    id_insumo       INTEGER NOT NULL,
    precio_anterior REAL,
    precio_nuevo    REAL,
    variacion_pct   REAL,
    FOREIGN KEY (id_sesion) REFERENCES sesiones_actualizacion(id_sesion),
    FOREIGN KEY (id_insumo) REFERENCES insumos(id_insumo)
  )`);
  saveDb();
}
ensureTables();

// ── GET  insumos con precios de un centro específico ──────────
router.get('/insumos-centro/:id_centro', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const id_centro = parseInt(req.params.id_centro);

    // Verificar que el centro existe
    const cc = db.exec('SELECT nombre, zona FROM centros_costo WHERE id_centro=?', [id_centro]);
    if (!cc.length || !cc[0].values.length)
      return res.status(404).json({ error: 'Centro de costos no encontrado' });
    const [nombre_centro, zona] = cc[0].values[0];

    // Todos los insumos activos con precio base Y precio del centro (si existe)
    const r = db.exec(`
      SELECT i.id_insumo, i.codigo, i.descripcion, i.unidad,
             i.precio_unitario AS precio_base,
             cp.precio_unitario AS precio_centro,
             cp.fecha_actualizacion AS fecha_centro,
             c.nombre AS categoria, c.id_categoria,
             COUNT(DISTINCT ai.id_actividad) AS num_actividades
      FROM insumos i
      JOIN categorias_insumo c ON i.id_categoria = c.id_categoria
      LEFT JOIN actividad_insumos ai ON ai.id_insumo = i.id_insumo
      LEFT JOIN centro_costo_precios cp ON cp.id_insumo = i.id_insumo AND cp.id_centro = ?
      WHERE i.activo = 1
      GROUP BY i.id_insumo
      ORDER BY c.id_categoria, i.descripcion
    `, [id_centro]);

    const rows = r.length ? r[0].values.map(v => ({
      id_insumo: v[0], codigo: v[1], descripcion: v[2], unidad: v[3],
      precio_base: v[4], precio_centro: v[5], fecha_centro: v[6],
      categoria: v[7], id_categoria: v[8], num_actividades: v[9],
      // precio_unitario = precio del centro si existe, sino precio base
      precio_unitario: v[5] !== null ? v[5] : v[4]
    })) : [];

    res.json({ centro: { id_centro, nombre: nombre_centro, zona }, insumos: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST  aplicar actualización a un centro de costos ─────────
router.post('/aplicar-centro', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const { id_centro, nombre, nota, cambios = [] } = req.body;
    if (!id_centro) return res.status(400).json({ error: 'id_centro requerido' });
    if (!cambios.length) return res.status(400).json({ error: 'Sin cambios a aplicar' });

    // Verificar centro
    const cc = db.exec('SELECT nombre FROM centros_costo WHERE id_centro=?', [id_centro]);
    if (!cc.length || !cc[0].values.length)
      return res.status(404).json({ error: 'Centro de costos no encontrado' });
    const nombre_centro = cc[0].values[0][0];

    // Registrar sesión (con nota del centro)
    const nombreSesion = nombre || `Actualización ${new Date().toLocaleDateString('es-HN')} — ${nombre_centro}`;
    db.run(`INSERT INTO sesiones_actualizacion (nombre, usuario, nota, total_insumos)
            VALUES (?, ?, ?, ?)`,
      [nombreSesion, req.session?.usuario?.nombre || 'sistema',
       nota ? `[Centro: ${nombre_centro}] ${nota}` : `Centro de costos: ${nombre_centro}`,
       cambios.length]);
    const sesR = db.exec('SELECT last_insert_rowid()');
    const id_sesion = sesR[0].values[0][0];

    let afectados = 0;
    let sumPct = 0, countPct = 0;

    for (const c of cambios) {
      const precioNvo = parseFloat(c.precio_nuevo);
      if (isNaN(precioNvo) || precioNvo < 0) continue;

      // Precio anterior en el centro (o precio base si no existía)
      const oldR = db.exec(`
        SELECT COALESCE(cp.precio_unitario, i.precio_unitario) AS precio_ant
        FROM insumos i
        LEFT JOIN centro_costo_precios cp ON cp.id_insumo = i.id_insumo AND cp.id_centro = ?
        WHERE i.id_insumo = ?`, [id_centro, c.id_insumo]);
      if (!oldR.length || !oldR[0].values.length) continue;
      const precioAnt = oldR[0].values[0][0] || 0;

      // Upsert en centro_costo_precios
      const existe = db.exec(
        'SELECT id_precio FROM centro_costo_precios WHERE id_centro=? AND id_insumo=?',
        [id_centro, c.id_insumo]);
      if (existe.length && existe[0].values.length) {
        db.run(`UPDATE centro_costo_precios
                SET precio_unitario=?, fecha_actualizacion=datetime('now')
                WHERE id_centro=? AND id_insumo=?`,
          [precioNvo, id_centro, c.id_insumo]);
      } else {
        db.run(`INSERT INTO centro_costo_precios (id_centro, id_insumo, precio_unitario)
                VALUES (?,?,?)`, [id_centro, c.id_insumo, precioNvo]);
      }

      // Historial (registrado como cambio de centro)
      const pct = precioAnt > 0 ? (precioNvo - precioAnt) / precioAnt * 100 : null;
      db.run(`INSERT INTO sesion_detalle (id_sesion, id_insumo, precio_anterior, precio_nuevo, variacion_pct)
              VALUES (?,?,?,?,?)`, [id_sesion, c.id_insumo, precioAnt, precioNvo, pct]);

      afectados++;
      if (pct !== null) { sumPct += pct; countPct++; }
    }

    // Actualizar resumen de sesión
    const variProm = countPct > 0 ? sumPct / countPct : 0;
    db.run(`UPDATE sesiones_actualizacion SET total_afectados=?, variacion_prom=? WHERE id_sesion=?`,
      [afectados, variProm, id_sesion]);

    saveDb();
    res.json({ ok: true, id_sesion, afectados, variacion_prom: variProm.toFixed(2), nombre_centro });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET  resumen de insumos para la pantalla de actualización ──
router.get('/insumos', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const r = db.exec(`
      SELECT i.id_insumo, i.codigo, i.descripcion, i.unidad,
             i.precio_unitario, i.fecha_actualizacion,
             c.nombre AS categoria, c.id_categoria,
             COUNT(DISTINCT ai.id_actividad) AS num_actividades
      FROM insumos i
      JOIN categorias_insumo c ON i.id_categoria = c.id_categoria
      LEFT JOIN actividad_insumos ai ON ai.id_insumo = i.id_insumo
      WHERE i.activo = 1
      GROUP BY i.id_insumo
      ORDER BY c.id_categoria, i.descripcion
    `);
    const rows = r.length ? r[0].values.map(v => ({
      id_insumo: v[0], codigo: v[1], descripcion: v[2], unidad: v[3],
      precio_unitario: v[4], fecha_actualizacion: v[5],
      categoria: v[6], id_categoria: v[7], num_actividades: v[8]
    })) : [];
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST  previsualizar impacto sin guardar ────────────────────
// Body: { cambios: [{id_insumo, precio_nuevo}], modo: 'individual'|'porcentaje', pct: 5 }
router.post('/preview', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const { cambios = [] } = req.body;           // [{id_insumo, precio_nuevo}]

    // Calcular impacto en actividades y presupuestos
    const impact = [];
    for (const c of cambios) {
      const r = db.exec(`
        SELECT i.descripcion, i.precio_unitario AS precio_actual,
               COUNT(DISTINCT ai.id_actividad)  AS num_act,
               COUNT(DISTINCT pp.id_presupuesto) AS num_pres
        FROM insumos i
        LEFT JOIN actividad_insumos ai ON ai.id_insumo = i.id_insumo
        LEFT JOIN presupuesto_partidas pp ON pp.id_actividad = ai.id_actividad
        WHERE i.id_insumo = ?
        GROUP BY i.id_insumo
      `, [c.id_insumo]);
      if (r.length && r[0].values.length) {
        const [desc, precioAct, numAct, numPres] = r[0].values[0];
        const pct = precioAct > 0
          ? ((c.precio_nuevo - precioAct) / precioAct * 100).toFixed(2)
          : null;
        impact.push({
          id_insumo: c.id_insumo,
          descripcion: desc,
          precio_anterior: precioAct,
          precio_nuevo: c.precio_nuevo,
          variacion_pct: pct !== null ? parseFloat(pct) : null,
          num_actividades: numAct || 0,
          num_presupuestos: numPres || 0
        });
      }
    }
    res.json({ preview: impact });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST  aplicar actualización masiva ────────────────────────
router.post('/aplicar', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const { nombre, nota, cambios = [] } = req.body;
    if (!cambios.length) return res.status(400).json({ error: 'Sin cambios a aplicar' });

    // Registrar sesión
    db.run(`INSERT INTO sesiones_actualizacion (nombre, usuario, nota, total_insumos)
            VALUES (?, ?, ?, ?)`,
      [nombre || `Actualización ${new Date().toLocaleDateString('es-HN')}`,
       req.session?.usuario?.nombre || 'sistema', nota || null, cambios.length]);
    const sesR = db.exec(`SELECT last_insert_rowid()`);
    const id_sesion = sesR[0].values[0][0];

    let afectados = 0;
    let sumPct = 0, countPct = 0;

    for (const c of cambios) {
      const old = db.exec(`SELECT precio_unitario FROM insumos WHERE id_insumo=?`, [c.id_insumo]);
      if (!old.length || !old[0].values.length) continue;
      const precioAnt = old[0].values[0][0];
      const precioNvo = parseFloat(c.precio_nuevo);
      if (isNaN(precioNvo) || precioNvo < 0) continue;

      // Historial estándar
      if (precioAnt !== precioNvo) {
        db.run(`INSERT INTO historial_precios (id_insumo, precio_anterior, precio_nuevo)
                VALUES (?,?,?)`, [c.id_insumo, precioAnt, precioNvo]);
      }

      // Detalle de sesión
      const pct = precioAnt > 0 ? (precioNvo - precioAnt) / precioAnt * 100 : null;
      db.run(`INSERT INTO sesion_detalle (id_sesion, id_insumo, precio_anterior, precio_nuevo, variacion_pct)
              VALUES (?,?,?,?,?)`, [id_sesion, c.id_insumo, precioAnt, precioNvo, pct]);

      // Actualizar insumo
      db.run(`UPDATE insumos SET precio_unitario=?, fecha_actualizacion=date('now')
              WHERE id_insumo=?`, [precioNvo, c.id_insumo]);

      // Recalcular costo_parcial en actividad_insumos
      db.run(`UPDATE actividad_insumos
              SET costo_parcial = (cantidad / COALESCE(NULLIF(rendimiento,0),1)) * (1 + desperdicio/100.0) * ?
              WHERE id_insumo = ?`, [precioNvo, c.id_insumo]);

      // Recalcular costo_total de cada actividad afectada
      const acts = db.exec(`SELECT DISTINCT id_actividad FROM actividad_insumos WHERE id_insumo=?`, [c.id_insumo]);
      if (acts.length) {
        for (const [id_act] of acts[0].values) {
          db.run(`UPDATE actividades SET costo_total = (
                    SELECT COALESCE(SUM(costo_parcial),0) FROM actividad_insumos WHERE id_actividad=?
                  ) WHERE id_actividad=?`, [id_act, id_act]);

          // Recalcular actividades de presupuesto que usan esta actividad
          db.run(`UPDATE presupuesto_partidas
                  SET precio_unitario = (SELECT costo_total FROM actividades WHERE id_actividad=?),
                      subtotal = cantidad * (SELECT costo_total FROM actividades WHERE id_actividad=?)
                  WHERE id_actividad=?`, [id_act, id_act, id_act]);
        }
      }

      afectados++;
      if (pct !== null) { sumPct += pct; countPct++; }
    }

    // Recalcular totales de presupuestos afectados
    const presR = db.exec(`SELECT DISTINCT id_presupuesto FROM presupuesto_partidas`);
    if (presR.length) {
      for (const [id_pres] of presR[0].values) {
        db.run(`UPDATE presupuestos SET costos_directos = (
                  SELECT COALESCE(SUM(subtotal),0) FROM presupuesto_partidas WHERE id_presupuesto=?
                ) WHERE id_presupuesto=?`, [id_pres, id_pres]);
        db.run(`UPDATE presupuestos SET
                  costos_indirectos = costos_directos * porcentaje_indirectos / 100.0,
                  utilidad          = costos_directos * porcentaje_utilidad    / 100.0,
                  imprevistos       = costos_directos * porcentaje_imprevistos / 100.0
                WHERE id_presupuesto=?`, [id_pres]);
        db.run(`UPDATE presupuestos SET total_general =
                  costos_directos + costos_indirectos + utilidad + imprevistos
                WHERE id_presupuesto=?`, [id_pres]);
      }
    }

    // Actualizar resumen de sesión
    const variProm = countPct > 0 ? sumPct / countPct : 0;
    db.run(`UPDATE sesiones_actualizacion SET total_afectados=?, variacion_prom=? WHERE id_sesion=?`,
      [afectados, variProm, id_sesion]);

    saveDb();
    res.json({ ok: true, id_sesion, afectados, variacion_prom: variProm.toFixed(2) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET  historial de sesiones ─────────────────────────────────
router.get('/historial', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const r = db.exec(`
      SELECT id_sesion, nombre, fecha, usuario, total_insumos,
             total_afectados, variacion_prom, nota, creado_en
      FROM sesiones_actualizacion
      ORDER BY creado_en DESC LIMIT 50
    `);
    const rows = r.length ? r[0].values.map(v => ({
      id_sesion: v[0], nombre: v[1], fecha: v[2], usuario: v[3],
      total_insumos: v[4], total_afectados: v[5], variacion_prom: v[6],
      nota: v[7], creado_en: v[8]
    })) : [];
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET  detalle de una sesión ─────────────────────────────────
router.get('/historial/:id', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const sesR = db.exec(`SELECT * FROM sesiones_actualizacion WHERE id_sesion=?`, [req.params.id]);
    if (!sesR.length || !sesR[0].values.length) return res.status(404).json({ error: 'Sesión no encontrada' });
    const s = sesR[0].values[0];
    const sesion = {
      id_sesion: s[0], nombre: s[1], fecha: s[2], usuario: s[3],
      total_insumos: s[4], total_afectados: s[5], variacion_prom: s[6], nota: s[7], creado_en: s[8]
    };

    const detR = db.exec(`
      SELECT sd.id_insumo, i.codigo, i.descripcion, i.unidad, c.nombre AS categoria,
             sd.precio_anterior, sd.precio_nuevo, sd.variacion_pct
      FROM sesion_detalle sd
      JOIN insumos i ON i.id_insumo = sd.id_insumo
      JOIN categorias_insumo c ON c.id_categoria = i.id_categoria
      WHERE sd.id_sesion = ?
      ORDER BY c.id_categoria, i.descripcion
    `, [req.params.id]);
    const detalle = detR.length ? detR[0].values.map(v => ({
      id_insumo: v[0], codigo: v[1], descripcion: v[2], unidad: v[3],
      categoria: v[4], precio_anterior: v[5], precio_nuevo: v[6], variacion_pct: v[7]
    })) : [];

    res.json({ sesion, detalle });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
