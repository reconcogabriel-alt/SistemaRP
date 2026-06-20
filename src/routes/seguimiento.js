/**
 * seguimiento.js — Cronograma y Seguimiento Físico-Financiero
 * API: sql.js (WebAssembly) — usa db.exec() y db.run(), NO callbacks
 */

const express = require('express');
const router  = express.Router();
const { getDb, saveDb } = require('../db/database');
const { requireAuth }   = require('../middleware/auth');

// ── HELPERS sql.js ────────────────────────────────────────────
function sqlAll(db, sql, params = []) {
  try {
    const res = db.exec(sql, params);
    if (!res.length) return [];
    const { columns, values } = res[0];
    return values.map(row => {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
  } catch(e) { throw new Error(e.message || String(e)); }
}

function sqlGet(db, sql, params = []) {
  const rows = sqlAll(db, sql, params);
  return rows[0] || null;
}

function sqlRun(db, sql, params = []) {
  try {
    db.run(sql, params);
    const r = db.exec('SELECT last_insert_rowid()');
    return r.length ? r[0].values[0][0] : null;
  } catch(e) { throw new Error(e.message || String(e)); }
}

// Las tablas se crean en runMigrations() de database.js al arrancar el servidor.

// ── CRONOGRAMAS ───────────────────────────────────────────────

// GET /api/seguimiento/cronogramas
router.get('/cronogramas', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const { id_presupuesto } = req.query;
    let sql = `
      SELECT c.id_cronograma, c.nombre, c.fecha_inicio, c.duracion_semanas,
             c.estado, c.observaciones, c.fecha_creacion,
             p.nombre AS presupuesto_nombre,
             p.total_general AS monto_total
      FROM cronogramas c
      JOIN presupuestos p  ON c.id_presupuesto = p.id_presupuesto
    `;
    const params = [];
    if (id_presupuesto) { sql += ' WHERE c.id_presupuesto = ?'; params.push(parseInt(id_presupuesto)); }
    sql += ' ORDER BY c.fecha_creacion DESC';
    res.json(sqlAll(db, sql, params));
  } catch(e) { res.status(500).json({error: e.message}); }
});

// POST /api/seguimiento/cronogramas
router.post('/cronogramas', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const { id_presupuesto, nombre, fecha_inicio, duracion_semanas, observaciones } = req.body;
    if (!id_presupuesto || !nombre || !fecha_inicio || !duracion_semanas)
      return res.status(400).json({error: 'Campos requeridos: id_presupuesto, nombre, fecha_inicio, duracion_semanas'});
    const id = sqlRun(db,
      `INSERT INTO cronogramas(id_presupuesto,nombre,fecha_inicio,duracion_semanas,observaciones)
       VALUES(?,?,?,?,?)`,
      [id_presupuesto, nombre, fecha_inicio, duracion_semanas, observaciones||null]);
    saveDb();
    res.json({id_cronograma: id, message: 'Cronograma creado'});
  } catch(e) { res.status(500).json({error: e.message}); }
});

// PUT /api/seguimiento/cronogramas/:id
router.put('/cronogramas/:id', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const { nombre, fecha_inicio, duracion_semanas, estado, observaciones } = req.body;
    db.run(`UPDATE cronogramas SET nombre=?,fecha_inicio=?,duracion_semanas=?,estado=?,observaciones=?
            WHERE id_cronograma=?`,
      [nombre, fecha_inicio, duracion_semanas, estado, observaciones, parseInt(req.params.id)]);
    saveDb();
    res.json({message: 'Actualizado'});
  } catch(e) { res.status(500).json({error: e.message}); }
});

// DELETE /api/seguimiento/cronogramas/:id
router.delete('/cronogramas/:id', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const id = parseInt(req.params.id);
    // Obtener períodos para borrar sus avances
    const periodos = sqlAll(db, 'SELECT id_periodo FROM seguimiento_periodos WHERE id_cronograma=?', [id]);
    periodos.forEach(p => {
      db.run('DELETE FROM seguimiento_avances WHERE id_periodo=?', [p.id_periodo]);
    });
    db.run('DELETE FROM seguimiento_periodos WHERE id_cronograma=?', [id]);
    db.run('DELETE FROM cronograma_tareas WHERE id_cronograma=?', [id]);
    db.run('DELETE FROM cronogramas WHERE id_cronograma=?', [id]);
    saveDb();
    res.json({message: 'Eliminado'});
  } catch(e) { res.status(500).json({error: e.message}); }
});

// ── TAREAS ────────────────────────────────────────────────────

// GET /api/seguimiento/cronogramas/:id/tareas
router.get('/cronogramas/:id/tareas', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const tareas = sqlAll(db, `
      SELECT t.id_tarea, t.id_cronograma, t.id_partida, t.id_modulo,
             t.descripcion, t.tipo, t.semana_inicio, t.duracion_semanas,
             t.peso_ponderado, t.orden_visual,
             a.descripcion AS actividad_desc, a.unidad,
             pp.cantidad AS cantidad_presupuestada, pp.subtotal AS monto_presupuestado
      FROM cronograma_tareas t
      LEFT JOIN presupuesto_partidas pp ON t.id_partida = pp.id_partida
      LEFT JOIN actividades a ON pp.id_actividad = a.id_actividad
      WHERE t.id_cronograma = ?
      ORDER BY t.orden_visual
    `, [parseInt(req.params.id)]);
    res.json(tareas);
  } catch(e) { res.status(500).json({error: e.message}); }
});

// POST /api/seguimiento/cronogramas/:id/tareas/importar-presupuesto
router.post('/cronogramas/:id/tareas/importar-presupuesto', requireAuth, async (req, res) => {
  try {
    const db  = await getDb();
    const id  = parseInt(req.params.id);
    const cron = sqlGet(db, 'SELECT * FROM cronogramas WHERE id_cronograma=?', [id]);
    if (!cron) return res.status(404).json({error: 'Cronograma no encontrado'});

    const módulos = sqlAll(db,
      'SELECT * FROM modulos WHERE id_presupuesto=? ORDER BY orden_visual',
      [cron.id_presupuesto]);
    const actividades  = sqlAll(db, `
      SELECT pp.id_partida, pp.id_modulo, pp.cantidad, pp.subtotal,
             a.descripcion, a.unidad
      FROM presupuesto_partidas pp
      JOIN actividades a ON pp.id_actividad = a.id_actividad
      WHERE pp.id_presupuesto=?
      ORDER BY pp.id_modulo, pp.id_partida
    `, [cron.id_presupuesto]);

    const pres = sqlGet(db, 'SELECT total_general FROM presupuestos WHERE id_presupuesto=?', [cron.id_presupuesto]);
    const montoTotal = pres?.total_general || 1;

    // Eliminar tareas anteriores
    db.run('DELETE FROM cronograma_tareas WHERE id_cronograma=?', [id]);

    // Distribución proporcional al peso económico de cada módulo
    // Módulo con mayor monto → más semanas; inicio secuencial
    const N = cron.duracion_semanas;
    let orden = 1;
    let semActual = 1;

    for (const cap of módulos) {
      const pCap     = actividades.filter(p => p.id_modulo === cap.id_modulo);
      const montoCap = pCap.reduce((s, p) => s + (p.subtotal || 0), 0);
      const pesoCap  = montoTotal > 0 ? montoCap / montoTotal : 1 / Math.max(módulos.length, 1);

      // Duración del módulo proporcional a su peso económico, mínimo 1
      const durCap     = Math.max(1, Math.round(pesoCap * N));
      const finCap     = Math.min(semActual + durCap - 1, N);
      const durCapReal = finCap - semActual + 1;

      db.run(`INSERT INTO cronograma_tareas
              (id_cronograma,id_modulo,descripcion,tipo,semana_inicio,duracion_semanas,peso_ponderado,orden_visual)
              VALUES(?,?,?,?,?,?,?,?)`,
        [id, cap.id_modulo, cap.nombre, 'modulo', semActual, durCapReal,
         pesoCap * 100, orden]);
      orden++;

      // Actividades dentro del módulo: proporcional a su peso relativo dentro del módulo
      let semActividad = semActual;
      for (const p of pCap) {
        const pesoP    = montoCap > 0 ? (p.subtotal || 0) / montoCap : 1 / Math.max(pCap.length, 1);
        const durP     = Math.max(1, Math.round(pesoP * durCapReal));
        const finP     = Math.min(semActividad + durP - 1, semActual + durCapReal - 1);
        const durPReal = finP - semActividad + 1;
        db.run(`INSERT INTO cronograma_tareas
                (id_cronograma,id_partida,id_modulo,descripcion,tipo,semana_inicio,duracion_semanas,peso_ponderado,orden_visual)
                VALUES(?,?,?,?,?,?,?,?,?)`,
          [id, p.id_partida, p.id_modulo, p.descripcion, 'actividad',
           semActividad, durPReal,
           montoTotal > 0 ? ((p.subtotal||0) / montoTotal * 100) : 0, orden]);
        orden++;
        semActividad = Math.min(semActividad + durPReal, semActual + durCapReal - 1);
      }

      semActual += durCapReal;
      if (semActual > N) semActual = N;
    }
    saveDb();
    res.json({message: `${orden - 1} tareas importadas`, total: orden - 1});
  } catch(e) { res.status(500).json({error: e.message}); }
});

// PUT /api/seguimiento/tareas/batch/update
router.put('/tareas/batch/update', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const { tareas } = req.body;
    for (const t of tareas) {
      db.run(`UPDATE cronograma_tareas
              SET semana_inicio=?, duracion_semanas=?, peso_ponderado=?
              WHERE id_tarea=?`,
        [t.semana_inicio, t.duracion_semanas, t.peso_ponderado || 0, t.id_tarea]);
    }
    saveDb();
    res.json({message: 'Tareas actualizadas'});
  } catch(e) { res.status(500).json({error: e.message}); }
});

// ── PERÍODOS ──────────────────────────────────────────────────

// GET /api/seguimiento/cronogramas/:id/periodos
router.get('/cronogramas/:id/periodos', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    res.json(sqlAll(db,
      'SELECT * FROM seguimiento_periodos WHERE id_cronograma=? ORDER BY numero_periodo',
      [parseInt(req.params.id)]));
  } catch(e) { res.status(500).json({error: e.message}); }
});

// POST /api/seguimiento/cronogramas/:id/periodos
router.post('/cronogramas/:id/periodos', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const { numero_periodo, fecha_corte, descripcion } = req.body;
    const id = sqlRun(db,
      `INSERT INTO seguimiento_periodos(id_cronograma,numero_periodo,fecha_corte,descripcion)
       VALUES(?,?,?,?)`,
      [parseInt(req.params.id), numero_periodo, fecha_corte, descripcion || `Período ${numero_periodo}`]);
    saveDb();
    res.json({id_periodo: id, message: 'Período creado'});
  } catch(e) { res.status(500).json({error: e.message}); }
});

// PUT /api/seguimiento/periodos/:id/cerrar
router.put('/periodos/:id/cerrar', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    db.run('UPDATE seguimiento_periodos SET cerrado=1 WHERE id_periodo=?', [parseInt(req.params.id)]);
    saveDb();
    res.json({message: 'Período cerrado'});
  } catch(e) { res.status(500).json({error: e.message}); }
});

// ── AVANCES ───────────────────────────────────────────────────

// GET /api/seguimiento/periodos/:id/avances
router.get('/periodos/:id/avances', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    res.json(sqlAll(db, `
      SELECT sa.id_avance, sa.id_periodo, sa.id_tarea,
             sa.avance_fisico_pct, sa.cantidad_ejecutada, sa.monto_ejecutado, sa.observacion,
             ct.descripcion AS tarea_desc, ct.tipo, ct.peso_ponderado,
             ct.semana_inicio, ct.duracion_semanas,
             pp.cantidad AS cantidad_pres, pp.subtotal AS monto_pres, a.unidad
      FROM seguimiento_avances sa
      JOIN cronograma_tareas ct ON sa.id_tarea = ct.id_tarea
      LEFT JOIN presupuesto_partidas pp ON ct.id_partida = pp.id_partida
      LEFT JOIN actividades a ON pp.id_actividad = a.id_actividad
      WHERE sa.id_periodo = ?
      ORDER BY ct.orden_visual
    `, [parseInt(req.params.id)]));
  } catch(e) { res.status(500).json({error: e.message}); }
});

// POST /api/seguimiento/periodos/:id/avances  (upsert batch)
router.post('/periodos/:id/avances', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const idPeriodo = parseInt(req.params.id);
    const { avances } = req.body;
    for (const av of avances) {
      // sql.js no soporta ON CONFLICT DO UPDATE directamente en todas las versiones
      // Hacemos DELETE + INSERT
      db.run('DELETE FROM seguimiento_avances WHERE id_periodo=? AND id_tarea=?',
        [idPeriodo, av.id_tarea]);
      db.run(`INSERT INTO seguimiento_avances
              (id_periodo,id_tarea,avance_fisico_pct,cantidad_ejecutada,monto_ejecutado,observacion)
              VALUES(?,?,?,?,?,?)`,
        [idPeriodo, av.id_tarea, av.avance_fisico_pct || 0,
         av.cantidad_ejecutada || 0, av.monto_ejecutado || 0, av.observacion || null]);
    }
    saveDb();
    res.json({message: 'Avances guardados'});
  } catch(e) { res.status(500).json({error: e.message}); }
});

// ── RESUMEN / CURVA S ─────────────────────────────────────────

// GET /api/seguimiento/cronogramas/:id/resumen
router.get('/cronogramas/:id/resumen', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const id = parseInt(req.params.id);
    const cron = sqlGet(db, `
      SELECT c.id_cronograma, c.nombre, c.fecha_inicio, c.duracion_semanas, c.estado,
             p.total_general AS monto_total, p.nombre AS presupuesto_nombre
      FROM cronogramas c
      JOIN presupuestos p  ON c.id_presupuesto = p.id_presupuesto
      WHERE c.id_cronograma = ?`, [id]);
    if (!cron) return res.status(404).json({error: 'Cronograma no encontrado'});

    const tareas   = sqlAll(db, 'SELECT * FROM cronograma_tareas WHERE id_cronograma=? ORDER BY orden_visual', [id]);
    const periodos = sqlAll(db, 'SELECT * FROM seguimiento_periodos WHERE id_cronograma=? ORDER BY numero_periodo', [id]);

    // Avances acumulados por tarea (máx % físico, suma de montos)
    const avAcum = {};
    for (const per of periodos) {
      const avs = sqlAll(db, 'SELECT * FROM seguimiento_avances WHERE id_periodo=?', [per.id_periodo]);
      for (const av of avs) {
        if (!avAcum[av.id_tarea]) avAcum[av.id_tarea] = {fisico: 0, monto: 0};
        avAcum[av.id_tarea].fisico = Math.max(avAcum[av.id_tarea].fisico, av.avance_fisico_pct || 0);
        avAcum[av.id_tarea].monto += (av.monto_ejecutado || 0);
      }
    }

    // Curva S planificada
    const totalSemanas = cron.duracion_semanas;
    const curvaS = [];
    let acumPlan = 0;
    for (let s = 1; s <= totalSemanas; s++) {
      const activas = tareas.filter(t =>
        t.tipo !== 'modulo' &&
        t.semana_inicio <= s &&
        (t.semana_inicio + t.duracion_semanas - 1) >= s
      );
      const aporte = activas.reduce((sum, t) =>
        sum + ((t.peso_ponderado || 0) / (t.duracion_semanas || 1)), 0);
      acumPlan += aporte;
      curvaS.push({semana: s, planificado: Math.min(100, acumPlan)});
    }

    // KPIs globales
    const tareasActividad = tareas.filter(t => t.tipo === 'actividad');
    let avFisGlobal = 0, montoEjec = 0;
    for (const t of tareasActividad) {
      const av = avAcum[t.id_tarea];
      if (av) {
        avFisGlobal += (av.fisico * (t.peso_ponderado || 0) / 100);
        montoEjec   += av.monto;
      }
    }
    const avFinGlobal = cron.monto_total > 0 ? (montoEjec / cron.monto_total * 100) : 0;

    // Enriquecer tareas con datos del presupuesto
    const tareasEnriq = tareas.map(t => {
      const pp = t.id_partida ? sqlGet(db,
        `SELECT pp.cantidad, pp.subtotal, a.unidad
         FROM presupuesto_partidas pp JOIN actividades a ON pp.id_actividad=a.id_actividad
         WHERE pp.id_partida=?`, [t.id_partida]) : null;
      return {
        ...t,
        cantidad_presupuestada: pp?.cantidad || 0,
        monto_presupuestado:    pp?.subtotal || 0,
        unidad:                 pp?.unidad   || '',
      };
    });

    res.json({
      cronograma: cron,
      tareas: tareasEnriq,
      periodos,
      avancesAcumulados: avAcum,
      curvaS,
      kpis: {
        avanceFisico:      Math.min(100, avFisGlobal),
        avanceFinanciero:  Math.min(100, avFinGlobal),
        montoEjecutado:    montoEjec,
        montoTotal:        cron.monto_total || 0,
        desviacion:        avFisGlobal - avFinGlobal,
        totalSemanas,
        periodosCerrados:  periodos.filter(p => p.cerrado).length,
      }
    });
  } catch(e) { res.status(500).json({error: e.message}); }
});

// GET /api/seguimiento/presupuestos
router.get('/presupuestos', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    res.json(sqlAll(db, `
      SELECT p.id_presupuesto, p.nombre, p.total_general
      FROM presupuestos p
      ORDER BY p.fecha_creacion DESC`));
  } catch(e) { res.status(500).json({error: e.message}); }
});

module.exports = router;
