// src/routes/bitacora.js
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

// ── GET /api/bitacora/presupuesto/:pid ────────────────────────
router.get('/presupuesto/:pid', requireAuth, async (req, res) => {
  try {
    const db  = await getDb();
    const pid = parseInt(req.params.pid);
    const { desde, hasta, q } = req.query;
    let where = 'WHERE id_presupuesto=?';
    const p   = [pid];
    if (desde) { where += ' AND fecha>=?'; p.push(desde); }
    if (hasta) { where += ' AND fecha<=?'; p.push(hasta); }
    if (q) {
      where += ' AND (actividades_ejecutadas LIKE ? OR observaciones_calidad LIKE ? OR incidentes LIKE ?)';
      p.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    res.json(rows(db, `SELECT * FROM bitacora_entradas ${where} ORDER BY fecha DESC, numero_entrada DESC`, p));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/bitacora/resumen/:pid ─────────────────────────
router.get('/resumen/:pid', requireAuth, async (req, res) => {
  try {
    const db  = await getDb();
    const pid = parseInt(req.params.pid);
    const r   = row1(db, `
      SELECT COUNT(*) AS total_entradas,
             COALESCE(SUM(personal_profesional+personal_tecnico+personal_operativo),0) AS total_jornadas_persona,
             COALESCE(MAX(avance_fisico),0) AS avance_actual,
             COUNT(CASE WHEN incidentes IS NOT NULL AND incidentes!='' THEN 1 END) AS entradas_con_incidentes,
             COUNT(CASE WHEN condicion_clima='lluvioso' THEN 1 END) AS dias_lluvia,
             MIN(fecha) AS primer_entrada, MAX(fecha) AS ultima_entrada
      FROM bitacora_entradas WHERE id_presupuesto=?`, [pid]);
    res.json(r || { total_entradas:0, total_jornadas_persona:0, avance_actual:0,
                    entradas_con_incidentes:0, dias_lluvia:0 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/bitacora/pdf/:pid  — impresión de una o varias entradas ──
router.get('/pdf/:pid', requireAuth, async (req, res) => {
  try {
    const db  = await getDb();
    const pid = parseInt(req.params.pid);
    const { desde, hasta, id } = req.query;

    // Datos del presupuesto
    const pres = row1(db, `SELECT nombre, cliente, ubicacion, moneda FROM presupuestos WHERE id_presupuesto=?`, [pid]);
    if (!pres) return res.status(404).json({ error: 'Presupuesto no encontrado' });

    // Leer nombre de empresa desde configuración
    let empresa_nombre = 'Servicios y Construcciones RP';
    try {
      const cfgR = db.exec("SELECT valor FROM configuracion_sistema WHERE clave='empresa_nombre'");
      if (cfgR.length && cfgR[0].values.length && cfgR[0].values[0][0])
        empresa_nombre = cfgR[0].values[0][0];
    } catch(e) {}

    // Filtrar entradas
    let where = 'WHERE id_presupuesto=?';
    const p   = [pid];
    if (id)    { where += ' AND id=?';     p.push(parseInt(id)); }
    if (desde) { where += ' AND fecha>=?'; p.push(desde); }
    if (hasta) { where += ' AND fecha<=?'; p.push(hasta); }
    const entradas = rows(db, `SELECT * FROM bitacora_entradas ${where} ORDER BY fecha ASC, numero_entrada ASC`, p);

    if (!entradas.length) return res.status(404).send('<h3 style="font-family:Arial;padding:40px">Sin entradas para el rango seleccionado</h3>');

    const meses = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const fmtFecha = f => {
      if (!f) return '—';
      const [y, m, d] = f.split('-');
      return `${parseInt(d)} de ${meses[parseInt(m)]} de ${y}`;
    };
    const cIco = { soleado:'☀ Soleado', nublado:'☁ Nublado', parcialmente_nublado:'⛅ Parc. nublado', lluvioso:'🌧 Lluvioso' };
    const esc  = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
    const bloque = (label, val) => val
      ? `<tr><td class="lbl">${label}</td><td class="val">${esc(val)}</td></tr>`
      : '';

    const paginasHTML = entradas.map(e => {
      const totPer = (e.personal_profesional||0) + (e.personal_tecnico||0) + (e.personal_operativo||0);
      const tieneInc = !!(e.incidentes && e.incidentes.trim());
      return `
<div class="pagina">
  <div class="header">
    <div class="header-left">
      <div class="empresa">${empresa_nombre}</div>
      <div class="doc-title">BITÁCORA DE OBRA</div>
      <div class="presupuesto-nombre">${esc(pres.nombre)}</div>
    </div>
    <div class="header-right">
      <table class="meta-table">
        <tr><td>Entrada N°</td><td><strong>${e.numero_entrada}</strong></td></tr>
        <tr><td>Fecha</td><td><strong>${fmtFecha(e.fecha)}</strong></td></tr>
        <tr><td>Hora inicio</td><td>${e.hora_inicio||'—'}</td></tr>
        <tr><td>Hora fin</td><td>${e.hora_fin||'—'}</td></tr>
        <tr><td>Avance físico</td><td><strong>${e.avance_fisico||0}%</strong></td></tr>
        <tr><td>Clima</td><td>${cIco[e.condicion_clima]||'—'}</td></tr>
      </table>
    </div>
  </div>
  ${pres.cliente || pres.ubicacion ? `<div class="sub-header">
    ${pres.cliente ? `<span>Cliente: <strong>${esc(pres.cliente)}</strong></span>` : ''}
    ${pres.ubicacion ? `<span>Ubicación: <strong>${esc(pres.ubicacion)}</strong></span>` : ''}
  </div>` : ''}

  <div class="seccion-titulo">PERSONAL EN OBRA</div>
  <table class="personal-table">
    <thead><tr><th>Categoría</th><th>Cantidad</th></tr></thead>
    <tbody>
      <tr><td>Profesionales (Ing./Supervisores)</td><td class="center"><strong>${e.personal_profesional||0}</strong></td></tr>
      <tr><td>Técnicos (Maestros de obra / Técnicos)</td><td class="center"><strong>${e.personal_tecnico||0}</strong></td></tr>
      <tr><td>Operativos (Obreros / Peones)</td><td class="center"><strong>${e.personal_operativo||0}</strong></td></tr>
      <tr class="total-row"><td><strong>TOTAL PERSONAL</strong></td><td class="center"><strong>${totPer}</strong></td></tr>
    </tbody>
  </table>

  <div class="seccion-titulo">ACTIVIDADES EJECUTADAS</div>
  <div class="campo-texto">${esc(e.actividades_ejecutadas||'')}</div>

  <table class="datos-table">
    <tbody>
      ${bloque('Materiales utilizados', e.materiales_utilizados)}
      ${bloque('Equipos y maquinaria', e.equipos_utilizados)}
      ${bloque('Subcontratistas', e.subcontratistas)}
    </tbody>
  </table>

  <div class="seccion-titulo">CALIDAD, INCIDENTES Y SEGURIDAD</div>
  <table class="datos-table">
    <tbody>
      ${bloque('Observaciones de Calidad', e.observaciones_calidad)}
      ${tieneInc ? `<tr class="incidente-row"><td class="lbl inc-lbl">⚠ INCIDENTE / ACCIDENTE</td><td class="val inc-val">${esc(e.incidentes)}</td></tr>` : ''}
      ${bloque('Observaciones de Seguridad', e.observaciones_seguridad)}
    </tbody>
  </table>

  ${(e.visitas || e.instrucciones_recibidas || e.oc_referencias || e.fotos_referencias) ? `
  <div class="seccion-titulo">INSTRUCCIONES Y REFERENCIAS</div>
  <table class="datos-table">
    <tbody>
      ${bloque('Visitas recibidas', e.visitas)}
      ${bloque('Instrucciones recibidas', e.instrucciones_recibidas)}
      ${bloque('OC activas / referencias', e.oc_referencias)}
      ${bloque('Fotografías de soporte', e.fotos_referencias)}
    </tbody>
  </table>` : ''}

  <div class="firmas">
    <div class="firma-bloque">
      <div class="firma-espacio"></div>
      <div class="firma-linea"></div>
      <div class="firma-nombre">${esc(e.firma_residente || 'Ingeniero Residente')}</div>
      <div class="firma-cargo">Elaboró / Ingeniero Residente</div>
    </div>
    <div class="firma-bloque">
      <div class="firma-espacio"></div>
      <div class="firma-linea"></div>
      <div class="firma-nombre">${esc(e.firma_supervisor || 'Supervisor / Fiscal')}</div>
      <div class="firma-cargo">Revisó / Supervisor del Propietario</div>
    </div>
  </div>

  <div class="footer">
    <span>${empresa_nombre} — Bitácora de Obra</span>
    <span>${esc(pres.nombre)} — Entrada N° ${e.numero_entrada} — ${fmtFecha(e.fecha)}</span>
  </div>
</div>`;
    }).join('\n');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Bitácora — ${esc(pres.nombre)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Calibri',Arial,sans-serif;font-size:11pt;color:#1a1a1a;background:#e8e8e8}
  .pagina{background:#fff;width:210mm;min-height:297mm;margin:0 auto 20px;padding:14mm 16mm 12mm;
          page-break-after:always;position:relative;box-shadow:0 2px 12px rgba(0,0,0,.2)}
  .header{display:flex;justify-content:space-between;align-items:flex-start;
          border-bottom:3px solid #025196;padding-bottom:10px;margin-bottom:8px}
  .header-left .empresa{font-size:9pt;color:#f59e0b;font-weight:700;letter-spacing:1px;margin-bottom:2px}
  .header-left .doc-title{font-size:20pt;font-weight:700;color:#025196;letter-spacing:1px;line-height:1}
  .header-left .presupuesto-nombre{font-size:10pt;color:#444;margin-top:4px;font-weight:600}
  .header-right .meta-table{border-collapse:collapse;font-size:9pt}
  .header-right .meta-table td{padding:2px 7px;border:1px solid #dde3ea}
  .header-right .meta-table td:first-child{background:#eef3f9;color:#025196;font-weight:600;white-space:nowrap}
  .sub-header{display:flex;gap:24px;font-size:9pt;color:#555;padding:4px 0 8px;
              border-bottom:1px solid #dde3ea;margin-bottom:8px}
  .seccion-titulo{background:#025196;color:#fff;font-size:9pt;font-weight:700;
                  letter-spacing:.8px;padding:4px 10px;margin:10px 0 0;text-transform:uppercase}
  .personal-table{width:100%;border-collapse:collapse;font-size:10pt}
  .personal-table th{background:#eef3f9;color:#025196;padding:4px 10px;text-align:left;
                     font-size:9pt;border:1px solid #dde3ea}
  .personal-table td{padding:4px 10px;border:1px solid #dde3ea}
  .personal-table .center{text-align:center}
  .personal-table .total-row td{background:#025196;color:#fff}
  .campo-texto{border:1px solid #dde3ea;border-top:none;padding:8px 10px;font-size:10pt;
               line-height:1.6;min-height:50px;white-space:pre-wrap;background:#fafcff}
  .datos-table{width:100%;border-collapse:collapse;font-size:10pt}
  .datos-table .lbl{width:36%;background:#f4f7fc;color:#025196;font-weight:600;font-size:9pt;
                    padding:5px 10px;border:1px solid #dde3ea;vertical-align:top;white-space:nowrap}
  .datos-table .val{padding:5px 10px;border:1px solid #dde3ea;white-space:pre-wrap;
                    vertical-align:top;line-height:1.5}
  .incidente-row .inc-lbl{background:#fef2f2;color:#b91c1c;border-color:#fca5a5}
  .incidente-row .inc-val{background:#fff7f7;color:#b91c1c;border-color:#fca5a5;font-weight:500}
  .firmas{display:flex;gap:40px;margin-top:28px}
  .firma-bloque{flex:1;text-align:center}
  .firma-espacio{height:48px}
  .firma-linea{border-top:1.5px solid #333;margin:0 16px}
  .firma-nombre{font-size:10pt;font-weight:600;color:#025196;margin-top:5px}
  .firma-cargo{font-size:9pt;color:#666;margin-top:2px}
  .footer{display:flex;justify-content:space-between;font-size:8pt;color:#999;
          border-top:1px solid #dde3ea;padding-top:6px;margin-top:14px}
  @media print {
    body{background:white}
    .no-print{display:none!important}
    .pagina{box-shadow:none;margin:0;padding:12mm 14mm 10mm;
            width:100%;min-height:auto;page-break-after:always}
    .pagina:last-child{page-break-after:auto}
  }
</style>
</head>
<body>
<div class="no-print" style="background:#025196;color:#fff;padding:10px 20px;
     display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:99;
     font-family:Arial,sans-serif">
  <span style="font-weight:700;font-size:14px">
    Bitácora de Obra — ${esc(pres.nombre)}
    <span style="font-weight:400;font-size:12px;opacity:.8;margin-left:10px">
      ${entradas.length} entrada${entradas.length!==1?'s':''}
    </span>
  </span>
  <button onclick="window.print()" style="background:#fdb338;color:#1a1a1a;border:none;
    font-weight:700;padding:8px 22px;border-radius:5px;cursor:pointer;font-size:13px">
    🖨&nbsp; Imprimir / Guardar PDF
  </button>
</div>
${paginasHTML}
<script>
  if(new URLSearchParams(location.search).get('autoprint')==='1')
    window.onload = () => window.print();
</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/bitacora/:id ──────────────────────────────────
// Debe estar DESPUÉS de /pdf/:pid, /resumen/:pid y /presupuesto/:pid
router.get('/:id', requireAuth, async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'No encontrado' });
  try {
    const db = await getDb();
    const r  = row1(db, 'SELECT * FROM bitacora_entradas WHERE id=?', [parseInt(req.params.id)]);
    if (!r) return res.status(404).json({ error: 'No encontrado' });
    res.json(r);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/bitacora ─────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const { id_presupuesto, fecha, hora_inicio, hora_fin,
      personal_profesional, personal_tecnico, personal_operativo,
      condicion_clima, avance_fisico, actividades_ejecutadas,
      materiales_utilizados, equipos_utilizados, subcontratistas,
      incidentes, observaciones_calidad, observaciones_seguridad,
      visitas, instrucciones_recibidas, oc_referencias, fotos_referencias,
      elaborado_por, firma_residente, firma_supervisor } = req.body;
    if (!id_presupuesto || !fecha || !actividades_ejecutadas)
      return res.status(400).json({ error: 'id_presupuesto, fecha y actividades_ejecutadas son requeridos' });
    const db  = await getDb();
    const pid = parseInt(id_presupuesto);
    const maxRow = row1(db, 'SELECT MAX(numero_entrada) AS m FROM bitacora_entradas WHERE id_presupuesto=?', [pid]);
    const numero_entrada = (maxRow?.m || 0) + 1;
    db.run(`INSERT INTO bitacora_entradas
      (id_presupuesto,numero_entrada,fecha,hora_inicio,hora_fin,
       personal_profesional,personal_tecnico,personal_operativo,
       condicion_clima,avance_fisico,actividades_ejecutadas,
       materiales_utilizados,equipos_utilizados,subcontratistas,
       incidentes,observaciones_calidad,observaciones_seguridad,
       visitas,instrucciones_recibidas,oc_referencias,fotos_referencias,
       elaborado_por,firma_residente,firma_supervisor)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [pid, numero_entrada, fecha, n(hora_inicio), n(hora_fin),
       parseInt(personal_profesional)||0, parseInt(personal_tecnico)||0, parseInt(personal_operativo)||0,
       n(condicion_clima), parseFloat(avance_fisico)||0, actividades_ejecutadas,
       n(materiales_utilizados), n(equipos_utilizados), n(subcontratistas),
       n(incidentes), n(observaciones_calidad), n(observaciones_seguridad),
       n(visitas), n(instrucciones_recibidas), n(oc_referencias), n(fotos_referencias),
       n(elaborado_por), n(firma_residente), n(firma_supervisor)]);
    const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    saveDb();
    res.json({ ok: true, id, numero_entrada });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/bitacora/:id ──────────────────────────────────
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { fecha, hora_inicio, hora_fin,
      personal_profesional, personal_tecnico, personal_operativo,
      condicion_clima, avance_fisico, actividades_ejecutadas,
      materiales_utilizados, equipos_utilizados, subcontratistas,
      incidentes, observaciones_calidad, observaciones_seguridad,
      visitas, instrucciones_recibidas, oc_referencias, fotos_referencias,
      elaborado_por, firma_residente, firma_supervisor } = req.body;
    const db = await getDb();
    db.run(`UPDATE bitacora_entradas SET
      fecha=?,hora_inicio=?,hora_fin=?,
      personal_profesional=?,personal_tecnico=?,personal_operativo=?,
      condicion_clima=?,avance_fisico=?,actividades_ejecutadas=?,
      materiales_utilizados=?,equipos_utilizados=?,subcontratistas=?,
      incidentes=?,observaciones_calidad=?,observaciones_seguridad=?,
      visitas=?,instrucciones_recibidas=?,oc_referencias=?,fotos_referencias=?,
      elaborado_por=?,firma_residente=?,firma_supervisor=?,
      modificado_en=datetime('now')
      WHERE id=?`,
      [fecha, n(hora_inicio), n(hora_fin),
       parseInt(personal_profesional)||0, parseInt(personal_tecnico)||0, parseInt(personal_operativo)||0,
       n(condicion_clima), parseFloat(avance_fisico)||0, actividades_ejecutadas,
       n(materiales_utilizados), n(equipos_utilizados), n(subcontratistas),
       n(incidentes), n(observaciones_calidad), n(observaciones_seguridad),
       n(visitas), n(instrucciones_recibidas), n(oc_referencias), n(fotos_referencias),
       n(elaborado_por), n(firma_residente), n(firma_supervisor),
       parseInt(req.params.id)]);
    saveDb();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/bitacora/:id ───────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    db.run('DELETE FROM bitacora_entradas WHERE id=?', [parseInt(req.params.id)]);
    saveDb();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
