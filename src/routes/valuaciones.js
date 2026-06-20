/**
 * valuaciones.js — Estimaciones de pago / valuaciones de obra
 * Permite registrar avance físico por partida y generar el documento de cobro
 */
const express = require('express');
const router  = express.Router();
const { getDb, saveDb } = require('../db/database');
const { requireAuth }   = require('../middleware/auth');

function sqlAll(db,sql,p=[]){try{const r=db.exec(sql,p);if(!r.length)return[];return r[0].values.map(row=>{const o={};r[0].columns.forEach((c,i)=>o[c]=row[i]);return o;});}catch(e){throw new Error(e.message||String(e));}}
function sqlGet(db,sql,p=[]){return sqlAll(db,sql,p)[0]||null;}
function sqlRun(db,sql,p=[]){db.run(sql,p);const r=db.exec('SELECT last_insert_rowid()');return r.length?r[0].values[0][0]:null;}

// ── Migrations (se llaman en cada request de init) ──────
async function ensureTables() {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS valuaciones (
    id_valuacion    INTEGER PRIMARY KEY AUTOINCREMENT,
    id_presupuesto  INTEGER NOT NULL,
    numero          INTEGER NOT NULL,
    fecha           TEXT NOT NULL,
    fecha_desde     TEXT,
    fecha_hasta     TEXT,
    descripcion     TEXT,
    estado          TEXT DEFAULT 'borrador' CHECK(estado IN ('borrador','enviada','aprobada','pagada')),
    monto_bruto     REAL DEFAULT 0,
    monto_retencion REAL DEFAULT 0,
    pct_retencion   REAL DEFAULT 0,
    monto_neto      REAL DEFAULT 0,
    acumulado_ant   REAL DEFAULT 0,
    acumulado_act   REAL DEFAULT 0,
    notas           TEXT,
    elaborado_por   TEXT,
    aprobado_por    TEXT,
    fecha_aprobacion TEXT,
    fecha_creacion  TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS valuacion_items (
    id_item         INTEGER PRIMARY KEY AUTOINCREMENT,
    id_valuacion    INTEGER NOT NULL,
    id_partida      INTEGER NOT NULL,
    avance_anterior REAL DEFAULT 0,
    avance_periodo  REAL DEFAULT 0,
    avance_acum     REAL DEFAULT 0,
    cant_anterior   REAL DEFAULT 0,
    cant_periodo    REAL DEFAULT 0,
    cant_acum       REAL DEFAULT 0,
    monto_periodo   REAL DEFAULT 0,
    monto_acum      REAL DEFAULT 0,
    observacion     TEXT,
    UNIQUE(id_valuacion, id_partida)
  )`);
  saveDb();
}

// GET /api/valuaciones?id_presupuesto=X
router.get('/', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const { id_presupuesto } = req.query;
    let sql = `SELECT v.*, p.nombre as presupuesto_nombre
      FROM valuaciones v
      JOIN presupuestos p ON v.id_presupuesto=p.id_presupuesto`;
    const params = [];
    if (id_presupuesto) { sql += ' WHERE v.id_presupuesto=?'; params.push(parseInt(id_presupuesto)); }
    sql += ' ORDER BY v.numero DESC';
    res.json(sqlAll(db, sql, params));
  } catch(e){res.status(500).json({error:e.message});}
});

// GET /api/valuaciones/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const val = sqlGet(db,`SELECT v.*, p.nombre as presupuesto_nombre,
      p.cliente, p.ubicacion, p.moneda, p.total_general as monto_contrato,
      p.porcentaje_indirectos, p.porcentaje_utilidad, p.porcentaje_imprevistos
      FROM valuaciones v
      JOIN presupuestos p ON v.id_presupuesto=p.id_presupuesto
      WHERE v.id_valuacion=?`,[parseInt(req.params.id)]);
    if (!val) return res.status(404).json({error:'No encontrada'});
    const items = sqlAll(db,`
      SELECT vi.*, pp.precio_unitario, pp.cantidad as cant_presup, pp.subtotal as monto_presup,
             a.codigo, a.descripcion, a.unidad, m.nombre as modulo
      FROM valuacion_items vi
      JOIN presupuesto_partidas pp ON vi.id_partida=pp.id_partida
      JOIN actividades a ON pp.id_actividad=a.id_actividad
      LEFT JOIN modulos m ON pp.id_modulo=m.id_modulo
      WHERE vi.id_valuacion=?
      ORDER BY m.orden_visual, a.codigo`,[parseInt(req.params.id)]);
    res.json({valuacion: val, items});
  } catch(e){res.status(500).json({error:e.message});}
});

// POST /api/valuaciones — crear nueva valuación
router.post('/', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const { id_presupuesto, fecha, fecha_desde, fecha_hasta, descripcion,
            pct_retencion=0, elaborado_por, notas } = req.body;
    if (!id_presupuesto||!fecha) return res.status(400).json({error:'id_presupuesto y fecha son requeridos'});

    // Número correlativo
    const maxR = db.exec('SELECT MAX(numero) FROM valuaciones WHERE id_presupuesto=?',[parseInt(id_presupuesto)]);
    const numero = ((maxR[0]?.values[0][0])||0)+1;

    // Calcular acumulado anterior (suma de montos_bruto de valuaciones aprobadas/pagadas anteriores)
    const antR = db.exec(`SELECT COALESCE(SUM(monto_bruto),0) FROM valuaciones
      WHERE id_presupuesto=? AND estado IN ('aprobada','pagada')`,[parseInt(id_presupuesto)]);
    const acumulado_ant = antR[0]?.values[0][0]||0;

    const id = sqlRun(db,`INSERT INTO valuaciones
      (id_presupuesto,numero,fecha,fecha_desde,fecha_hasta,descripcion,pct_retencion,elaborado_por,notas,acumulado_ant)
      VALUES(?,?,?,?,?,?,?,?,?,?)`,[
      parseInt(id_presupuesto),numero,fecha,fecha_desde||null,fecha_hasta||null,
      descripcion||`Valuación N° ${numero}`,parseFloat(pct_retencion)||0,
      elaborado_por||null,notas||null,acumulado_ant
    ]);

    // Pre-poblar items con todas las partidas del presupuesto
    const partidas = sqlAll(db,'SELECT id_partida FROM presupuesto_partidas WHERE id_presupuesto=?',[parseInt(id_presupuesto)]);

    // Calcular avances anteriores acumulados por partida
    const antItems = sqlAll(db,`SELECT vi.id_partida, MAX(vi.avance_acum) as av_ant, MAX(vi.cant_acum) as cant_ant, MAX(vi.monto_acum) as monto_ant
      FROM valuacion_items vi
      JOIN valuaciones v ON vi.id_valuacion=v.id_valuacion
      WHERE v.id_presupuesto=? AND v.estado IN ('aprobada','pagada')
      GROUP BY vi.id_partida`,[parseInt(id_presupuesto)]);
    const antMap = {};
    antItems.forEach(a => { antMap[a.id_partida] = a; });

    for (const {id_partida} of partidas) {
      const ant = antMap[id_partida];
      sqlRun(db,`INSERT OR IGNORE INTO valuacion_items
        (id_valuacion,id_partida,avance_anterior,cant_anterior,monto_acum)
        VALUES(?,?,?,?,?)`,[
        id, id_partida,
        ant?.av_ant||0, ant?.cant_ant||0, ant?.monto_ant||0
      ]);
    }
    saveDb();
    res.json({ok:true,id,numero});
  } catch(e){res.status(500).json({error:e.message});}
});

// PUT /api/valuaciones/:id/items — actualizar avances del período
router.put('/:id/items', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const id = parseInt(req.params.id);
    const { items } = req.body; // [{id_partida, avance_periodo, observacion}]

    let monto_bruto = 0;
    for (const it of items) {
      // Obtener datos del presupuesto
      const pp = sqlGet(db,'SELECT cantidad,precio_unitario,subtotal FROM presupuesto_partidas WHERE id_partida=?',[it.id_partida]);
      if (!pp) continue;
      const ant = sqlGet(db,'SELECT avance_anterior,cant_anterior,monto_acum FROM valuacion_items WHERE id_valuacion=? AND id_partida=?',[id,it.id_partida]);
      const avAnt  = ant?.avance_anterior||0;
      const avPer  = Math.min(Math.max(parseFloat(it.avance_periodo)||0,0),100-avAnt);
      const avAcum = avAnt + avPer;
      const cantPer = pp.cantidad * avPer / 100;
      const cantAcum= pp.cantidad * avAcum / 100;
      const montoPer= cantPer * pp.precio_unitario;
      const montoAcum=(ant?.monto_acum||0) + montoPer;

      db.run(`UPDATE valuacion_items SET avance_periodo=?,avance_acum=?,cant_periodo=?,cant_acum=?,
              monto_periodo=?,monto_acum=?,observacion=?
              WHERE id_valuacion=? AND id_partida=?`,
        [avPer,avAcum,cantPer,cantAcum,montoPer,montoAcum,it.observacion||null,id,it.id_partida]);
      monto_bruto += montoPer;
    }

    // Actualizar totales de la valuación
    const val = sqlGet(db,'SELECT pct_retencion,acumulado_ant FROM valuaciones WHERE id_valuacion=?',[id]);
    const retencion = monto_bruto * (val?.pct_retencion||0) / 100;
    const acum_act  = (val?.acumulado_ant||0) + monto_bruto;

    db.run(`UPDATE valuaciones SET monto_bruto=?,monto_retencion=?,monto_neto=?,acumulado_act=?
            WHERE id_valuacion=?`,[monto_bruto,retencion,monto_bruto-retencion,acum_act,id]);
    saveDb();
    res.json({ok:true,monto_bruto,retencion,monto_neto:monto_bruto-retencion,acumulado_act:acum_act});
  } catch(e){res.status(500).json({error:e.message});}
});

// PUT /api/valuaciones/:id — actualizar estado/datos generales
router.put('/:id', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const { estado, pct_retencion, aprobado_por, fecha_aprobacion, notas, descripcion } = req.body;
    const id = parseInt(req.params.id);
    db.run(`UPDATE valuaciones SET estado=COALESCE(?,estado), pct_retencion=COALESCE(?,pct_retencion),
            aprobado_por=COALESCE(?,aprobado_por), fecha_aprobacion=COALESCE(?,fecha_aprobacion),
            notas=COALESCE(?,notas), descripcion=COALESCE(?,descripcion)
            WHERE id_valuacion=?`,
      [estado||null,pct_retencion!=null?parseFloat(pct_retencion):null,
       aprobado_por||null,fecha_aprobacion||null,notas||null,descripcion||null,id]);

    // Si cambió retención, recalcular
    if (pct_retencion != null) {
      const val = sqlGet(db,'SELECT monto_bruto FROM valuaciones WHERE id_valuacion=?',[id]);
      if (val) {
        const ret = (val.monto_bruto||0)*(parseFloat(pct_retencion)||0)/100;
        db.run('UPDATE valuaciones SET monto_retencion=?,monto_neto=? WHERE id_valuacion=?',
          [ret,(val.monto_bruto||0)-ret,id]);
      }
    }
    saveDb();
    res.json({ok:true});
  } catch(e){res.status(500).json({error:e.message});}
});

// DELETE /api/valuaciones/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const id = parseInt(req.params.id);
    const v = sqlGet(db,'SELECT estado FROM valuaciones WHERE id_valuacion=?',[id]);
    if (!v) return res.status(404).json({error:'No encontrada'});
    if (v.estado === 'pagada') return res.status(400).json({error:'No se puede eliminar una valuación pagada'});
    db.run('DELETE FROM valuacion_items WHERE id_valuacion=?',[id]);
    db.run('DELETE FROM valuaciones WHERE id_valuacion=?',[id]);
    saveDb();
    res.json({ok:true});
  } catch(e){res.status(500).json({error:e.message});}
});

// GET /api/valuaciones/:id/html — reporte HTML para impresión
router.get('/:id/html', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const id = parseInt(req.params.id);
    const val = sqlGet(db,`SELECT v.*, p.nombre as presupuesto_nombre,
      p.cliente, p.ubicacion, p.moneda, p.total_general as monto_contrato
      FROM valuaciones v JOIN presupuestos p ON v.id_presupuesto=p.id_presupuesto
      WHERE v.id_valuacion=?`,[id]);
    if (!val) return res.status(404).send('<h3>Valuación no encontrada</h3>');

    const items = sqlAll(db,`SELECT vi.*, pp.precio_unitario, pp.cantidad as cant_presup, pp.subtotal as monto_presup,
      a.codigo, a.descripcion, a.unidad, m.nombre as modulo
      FROM valuacion_items vi JOIN presupuesto_partidas pp ON vi.id_partida=pp.id_partida
      JOIN actividades a ON pp.id_actividad=a.id_actividad
      LEFT JOIN modulos m ON pp.id_modulo=m.id_modulo
      WHERE vi.id_valuacion=? AND vi.monto_periodo>0
      ORDER BY m.orden_visual, a.codigo`,[id]);

    // Empresa
    let empresa_nombre='', empresa_rtn='', empresa_tel='', empresa_dir='';
    try {
      const cfgR = db.exec("SELECT clave,valor FROM configuracion_sistema WHERE clave LIKE 'empresa_%'");
      if (cfgR.length) cfgR[0].values.forEach(([k,v])=>{
        if(k==='empresa_nombre') empresa_nombre=v||'';
        if(k==='empresa_rtn') empresa_rtn=v||'';
        if(k==='empresa_telefono') empresa_tel=v||'';
        if(k==='empresa_direccion') empresa_dir=v||'';
      });
    } catch(e){}

    const fmtL=(n)=>`L ${Number(n||0).toLocaleString('es-HN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    const fmtD=(d)=>d?new Date(d+'T00:00:00').toLocaleDateString('es-HN',{year:'numeric',month:'long',day:'numeric'}):'—';
    const esc=(s)=>(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    // Agrupar items por módulo
    const grupos={};
    items.forEach(it=>{const k=it.modulo||'General';if(!grupos[k])grupos[k]=[];grupos[k].push(it);});

    let filasHTML='',n=1;
    for(const[mod,rows] of Object.entries(grupos)){
      const subMod=rows.reduce((s,it)=>s+(it.monto_periodo||0),0);
      filasHTML+=`<tr style="background:#025196;color:#fff"><td colspan="9" style="padding:6px 10px;font-weight:700">${esc(mod)}</td></tr>`;
      rows.forEach(it=>{
        const avAnt=Number(it.avance_anterior||0),avPer=Number(it.avance_periodo||0),avAcum=avAnt+avPer;
        filasHTML+=`<tr>
          <td style="text-align:center;padding:5px 6px;font-size:10px;color:#888">${n++}</td>
          <td style="padding:5px 6px;font-family:monospace;font-size:10px;color:#025196">${esc(it.codigo)}</td>
          <td style="padding:5px 8px;font-size:11px">${esc(it.descripcion)}</td>
          <td style="text-align:center;padding:5px 6px">${esc(it.unidad)}</td>
          <td style="text-align:right;padding:5px 6px">${Number(it.cant_presup||0).toFixed(2)}</td>
          <td style="text-align:right;padding:5px 6px;color:#888">${avAnt.toFixed(1)}%</td>
          <td style="text-align:right;padding:5px 6px;font-weight:700;color:#025196">${avPer.toFixed(1)}%</td>
          <td style="text-align:right;padding:5px 6px;color:#555">${avAcum.toFixed(1)}%</td>
          <td style="text-align:right;padding:5px 6px;font-weight:700;color:#1A7A3C">${fmtL(it.monto_periodo)}</td>
        </tr>`;
      });
      filasHTML+=`<tr style="background:#dce8f5"><td colspan="8" style="text-align:right;padding:5px 10px;font-weight:700;color:#025196">Subtotal ${esc(mod)}</td>
        <td style="text-align:right;padding:5px 6px;font-weight:700;color:#025196">${fmtL(subMod)}</td></tr>`;
    }

    const estadoColor={borrador:'#888',enviada:'#0057A8',aprobada:'#1A7A3C',pagada:'#5B4FBE'}[val.estado]||'#888';
    const pctAvance=val.monto_contrato>0?((val.acumulado_act||0)/val.monto_contrato*100).toFixed(1):'0';

    const html=`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>Valuación N°${val.numero} — ${esc(val.presupuesto_nombre)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:11px;color:#1a1a1a;background:#f0f0f0}
  @page{size:letter;margin:14mm 12mm}
  @media print{body{background:#fff}.no-print{display:none!important}}
  .pagina{background:#fff;max-width:800px;margin:0 auto 20px;padding:16px;box-shadow:0 2px 12px rgba(0,0,0,.15)}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #025196;padding-bottom:10px;margin-bottom:12px}
  .titulo-doc{font-size:22px;font-weight:700;color:#025196;letter-spacing:1px}
  .empresa-bloque{font-size:9px;color:#555;line-height:1.6;text-align:right}
  .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px;background:#f0f5fb;padding:8px 12px;border-radius:3px;margin-bottom:12px;border:1px solid #d0e0f0}
  .meta-item{font-size:10px}.meta-lbl{font-weight:700;color:#025196}
  table{width:100%;border-collapse:collapse;margin-bottom:12px}
  thead th{background:#025196;color:#fff;padding:6px 7px;font-size:10px;text-align:left}
  tbody td{border-bottom:1px solid #e8e8e8;font-size:11px}
  tbody tr:nth-child(even) td{background:#f9fafc}
  .totales{max-width:320px;margin-left:auto;border:1px solid #025196;border-radius:4px;overflow:hidden}
  .tot-row{display:flex;justify-content:space-between;padding:6px 12px;font-size:11px;border-bottom:1px solid #e8e8e8}
  .tot-row.hl{background:#f0f5fb}
  .tot-row.grand{background:#025196;color:#fff;font-weight:700;font-size:13px;border:none}
  .estado-badge{display:inline-block;padding:3px 12px;border-radius:12px;font-size:10px;font-weight:700;
    color:#fff;background:${estadoColor};text-transform:uppercase;letter-spacing:.5px}
  .firmas{display:flex;gap:40px;margin-top:28px}
  .firma-bloque{flex:1;text-align:center}
  .firma-linea{border-top:1px solid #333;margin:40px 10px 0}
  .firma-cargo{font-size:9px;color:#666;margin-top:5px}
  .footer{display:flex;justify-content:space-between;font-size:8px;color:#999;margin-top:12px;border-top:1px solid #ddd;padding-top:6px}
  .no-print-bar{background:#025196;color:#fff;padding:10px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:99}
</style>
</head><body>
<div class="no-print no-print-bar">
  <span style="font-weight:700;font-size:14px">Valuación N°${val.numero} — ${esc(val.presupuesto_nombre)}</span>
  <button onclick="window.print()" style="background:#FDB338;color:#1a1a1a;border:none;font-weight:700;padding:8px 22px;border-radius:5px;cursor:pointer;font-size:13px">🖨 Imprimir / PDF</button>
</div>
<div class="pagina">
  <div class="header">
    <div>
      <div class="titulo-doc">VALUACIÓN DE OBRA</div>
      <div style="font-size:14px;font-weight:700;color:#333;margin-top:4px">N° ${val.numero}</div>
      <div style="margin-top:6px"><span class="estado-badge">${val.estado}</span></div>
    </div>
    <div class="empresa-bloque">
      ${empresa_nombre?`<strong>${esc(empresa_nombre)}</strong><br>`:''}
      ${empresa_rtn?`RTN: ${esc(empresa_rtn)}<br>`:''}
      ${empresa_tel?`Tel: ${esc(empresa_tel)}<br>`:''}
      ${empresa_dir?`${esc(empresa_dir)}<br>`:''}
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item"><span class="meta-lbl">Presupuesto:</span> ${esc(val.presupuesto_nombre)}</div>
    <div class="meta-item"><span class="meta-lbl">Cliente:</span> ${esc(val.cliente||'—')}</div>
    <div class="meta-item"><span class="meta-lbl">Ubicación:</span> ${esc(val.ubicacion||'—')}</div>
    <div class="meta-item"><span class="meta-lbl">Fecha valuación:</span> ${fmtD(val.fecha)}</div>
    <div class="meta-item"><span class="meta-lbl">Período:</span> ${val.fecha_desde?fmtD(val.fecha_desde)+' al '+fmtD(val.fecha_hasta):'—'}</div>
    <div class="meta-item"><span class="meta-lbl">Monto contrato:</span> ${fmtL(val.monto_contrato)}</div>
    <div class="meta-item"><span class="meta-lbl">Avance acumulado:</span> ${pctAvance}% del contrato</div>
  </div>

  <table>
    <thead><tr>
      <th style="width:30px">N°</th><th style="width:65px">Código</th><th>Descripción</th>
      <th style="text-align:center;width:45px">Unid</th><th style="text-align:right;width:65px">Cant.Contr.</th>
      <th style="text-align:right;width:55px">Av.Ant.%</th><th style="text-align:right;width:60px">Av.Per.%</th>
      <th style="text-align:right;width:55px">Av.Ac.%</th><th style="text-align:right;width:90px">Monto Período</th>
    </tr></thead>
    <tbody>${filasHTML}</tbody>
  </table>

  <div class="totales">
    <div class="tot-row hl"><span>Monto bruto período</span><span>${fmtL(val.monto_bruto)}</span></div>
    <div class="tot-row"><span>Retención (${Number(val.pct_retencion||0)}%)</span><span>- ${fmtL(val.monto_retencion)}</span></div>
    <div class="tot-row hl"><span>Acumulado anterior</span><span>${fmtL(val.acumulado_ant)}</span></div>
    <div class="tot-row"><span>Acumulado actual</span><span>${fmtL(val.acumulado_act)}</span></div>
    <div class="tot-row grand"><span>MONTO NETO A COBRAR</span><span>${fmtL(val.monto_neto)}</span></div>
  </div>

  ${val.notas?`<div style="margin-top:12px;background:#fffbe6;border:1px solid #FDB338;border-radius:4px;padding:10px 14px;font-size:11px"><strong>Notas:</strong> ${esc(val.notas)}</div>`:''}

  <div class="firmas">
    <div class="firma-bloque">
      <div class="firma-linea"></div>
      <div style="margin-top:5px;font-weight:600;color:#025196">${esc(val.elaborado_por||'Ingeniero Residente')}</div>
      <div class="firma-cargo">Elaboró / Ingeniero Residente</div>
    </div>
    <div class="firma-bloque">
      <div class="firma-linea"></div>
      <div style="margin-top:5px;font-weight:600;color:#025196">${esc(val.aprobado_por||'Supervisor / Fiscal')}</div>
      <div class="firma-cargo">Revisó / Aprobó</div>
    </div>
    <div class="firma-bloque">
      <div class="firma-linea"></div>
      <div style="margin-top:5px;font-weight:600;color:#025196">Cliente / Representante</div>
      <div class="firma-cargo">Recibido / Visto Bueno</div>
    </div>
  </div>

  <div class="footer">
    <span>${empresa_nombre||'Sistema de Costos Unitarios'} — Valuación N°${val.numero}</span>
    <span>Generado: ${new Date().toLocaleDateString('es-HN')}</span>
  </div>
</div>
<script>if(new URLSearchParams(location.search).get('autoprint')==='1')window.onload=()=>window.print();</script>
</body></html>`;

    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.send(html);
  } catch(e){res.status(500).send(`<h3>Error: ${e.message}</h3>`);}
});

module.exports = router;
