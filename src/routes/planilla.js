/**
 * planilla.js — Planilla de Mano de Obra con retenciones Honduras
 * IHSS patronal 11%, empleado 2.5% | RAP patronal 1.5%, empleado 1.5%
 * ISR escala progresiva | Bonificación L 500/mes
 */
const express = require('express');
const router  = express.Router();
const { getDb, saveDb } = require('../db/database');
const { requireAuth }   = require('../middleware/auth');

function sqlAll(db,sql,p=[]){try{const r=db.exec(sql,p);if(!r.length)return[];return r[0].values.map(row=>{const o={};r[0].columns.forEach((c,i)=>o[c]=row[i]);return o;});}catch(e){throw new Error(e.message||String(e));}}
function sqlGet(db,sql,p=[]){return sqlAll(db,sql,p)[0]||null;}
function sqlRun(db,sql,p=[]){db.run(sql,p);const r=db.exec('SELECT last_insert_rowid()');return r.length?r[0].values[0][0]:null;}

// ── Tasas legales Honduras 2024-2026 ────────────────────
const TASAS = {
  ihss_patronal:   0.11,   // 11% patronal
  ihss_empleado:   0.025,  // 2.5% empleado
  rap_patronal:    0.015,  // 1.5% patronal RAP (Régimen Aportaciones Privadas)
  rap_empleado:    0.015,  // 1.5% empleado
  bonificacion:    500,    // L 500 mensual por ley (Decreto 105-2019 + ajustes)
  salario_minimo_const: 11_168.68, // L/mes construcción 2024 (referencia STSS)
};

// ISR mensual Honduras (escala 2024, anualizada ÷ 12)
function calcISR(salario_bruto_mensual) {
  const anual = salario_bruto_mensual * 12;
  let isr_anual = 0;
  if (anual <= 176_000)        isr_anual = 0;
  else if (anual <= 274_000)   isr_anual = (anual - 176_000) * 0.15;
  else if (anual <= 680_000)   isr_anual = 14_700 + (anual - 274_000) * 0.20;
  else                          isr_anual = 95_900 + (anual - 680_000) * 0.25;
  return isr_anual / 12;
}

async function ensureTables() {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS planillas (
    id_planilla   INTEGER PRIMARY KEY AUTOINCREMENT,
    id_presupuesto   INTEGER NOT NULL,
    numero        INTEGER NOT NULL,
    periodo       TEXT NOT NULL,
    fecha_inicio  TEXT NOT NULL,
    fecha_fin     TEXT NOT NULL,
    tipo          TEXT DEFAULT 'semanal' CHECK(tipo IN ('semanal','quincenal','mensual')),
    estado        TEXT DEFAULT 'borrador' CHECK(estado IN ('borrador','aprobada','pagada')),
    total_bruto   REAL DEFAULT 0,
    total_ihss_p  REAL DEFAULT 0,
    total_rap_p   REAL DEFAULT 0,
    total_desc_e  REAL DEFAULT 0,
    total_neto    REAL DEFAULT 0,
    notas         TEXT,
    elaborado_por TEXT,
    fecha_creacion TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS planilla_empleados (
    id_emp        INTEGER PRIMARY KEY AUTOINCREMENT,
    id_planilla   INTEGER NOT NULL,
    nombre        TEXT NOT NULL,
    identidad     TEXT,
    cargo         TEXT NOT NULL,
    categoria     TEXT DEFAULT 'operativo' CHECK(categoria IN ('profesional','tecnico','operativo')),
    salario_base  REAL NOT NULL,
    dias_laborados REAL DEFAULT 0,
    horas_extra   REAL DEFAULT 0,
    salario_bruto REAL DEFAULT 0,
    bonificacion  REAL DEFAULT 0,
    ihss_patronal REAL DEFAULT 0,
    rap_patronal  REAL DEFAULT 0,
    ihss_empleado REAL DEFAULT 0,
    rap_empleado  REAL DEFAULT 0,
    isr           REAL DEFAULT 0,
    otros_desc    REAL DEFAULT 0,
    total_desc    REAL DEFAULT 0,
    salario_neto  REAL DEFAULT 0,
    costo_total   REAL DEFAULT 0,
    observacion   TEXT
  )`);
  saveDb();
}

// Calcular todos los campos de un empleado
function calcEmpleado(e, tipo) {
  const dias_base = tipo==='mensual' ? 30 : tipo==='quincenal' ? 15 : 7.5;
  const salario_dia = (e.salario_base || 0) / dias_base;
  const dias = parseFloat(e.dias_laborados) || 0;
  const horas_extra = parseFloat(e.horas_extra) || 0;

  const salario_ordinario = salario_dia * dias;
  const valor_hora_extra  = (salario_dia / 8) * 1.5; // 150% hora extra
  const monto_extra       = valor_hora_extra * horas_extra;
  const bonificacion      = tipo === 'mensual' ? TASAS.bonificacion : tipo === 'quincenal' ? TASAS.bonificacion/2 : TASAS.bonificacion/4;
  const salario_bruto     = salario_ordinario + monto_extra;
  const base_ihss         = Math.min(salario_bruto, 9_500); // techo IHSS 2024

  const ihss_patronal = base_ihss * TASAS.ihss_patronal;
  const rap_patronal  = salario_bruto * TASAS.rap_patronal;
  const ihss_empleado = base_ihss * TASAS.ihss_empleado;
  const rap_empleado  = salario_bruto * TASAS.rap_empleado;
  const isr           = calcISR(e.salario_base || 0) * (dias / dias_base);
  const otros_desc    = parseFloat(e.otros_desc) || 0;
  const total_desc    = ihss_empleado + rap_empleado + isr + otros_desc;
  const salario_neto  = salario_bruto + bonificacion - total_desc;
  const costo_total   = salario_bruto + bonificacion + ihss_patronal + rap_patronal;

  return { salario_bruto, bonificacion, ihss_patronal, rap_patronal,
           ihss_empleado, rap_empleado, isr, otros_desc, total_desc,
           salario_neto, costo_total };
}

// GET /api/planilla?id_presupuesto=X
router.get('/', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const { id_presupuesto } = req.query;
    let sql = `SELECT p.*, pr.nombre as presupuesto_nombre,
      (SELECT COUNT(*) FROM planilla_empleados pe WHERE pe.id_planilla=p.id_planilla) as num_empleados
      FROM planillas p JOIN presupuestos pr ON p.id_presupuesto=pr.id_presupuesto`;
    const params = [];
    if (id_presupuesto) { sql += ' WHERE p.id_presupuesto=?'; params.push(parseInt(id_presupuesto)); }
    sql += ' ORDER BY p.fecha_inicio DESC';
    res.json(sqlAll(db, sql, params));
  } catch(e){res.status(500).json({error:e.message});}
});

// GET /api/planilla/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const id = parseInt(req.params.id);
    const plan = sqlGet(db,`SELECT p.*, pr.nombre as presupuesto_nombre, pr.cliente, pr.ubicacion
      FROM planillas p JOIN presupuestos pr ON p.id_presupuesto=pr.id_presupuesto
      WHERE p.id_planilla=?`,[id]);
    if (!plan) return res.status(404).json({error:'No encontrada'});
    const empleados = sqlAll(db,'SELECT * FROM planilla_empleados WHERE id_planilla=? ORDER BY categoria,nombre',[id]);
    res.json({planilla: plan, empleados});
  } catch(e){res.status(500).json({error:e.message});}
});

// POST /api/planilla — crear planilla
router.post('/', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const { id_presupuesto, fecha_inicio, fecha_fin, tipo='semanal', elaborado_por, notas } = req.body;
    if (!id_presupuesto||!fecha_inicio||!fecha_fin) return res.status(400).json({error:'id_presupuesto, fecha_inicio y fecha_fin son requeridos'});
    const maxR = db.exec('SELECT MAX(numero) FROM planillas WHERE id_presupuesto=?',[parseInt(id_presupuesto)]);
    const numero = ((maxR[0]?.values[0][0])||0)+1;
    const periodo = `${tipo.charAt(0).toUpperCase()+tipo.slice(1)} ${fecha_inicio} al ${fecha_fin}`;
    const id = sqlRun(db,`INSERT INTO planillas (id_presupuesto,numero,periodo,fecha_inicio,fecha_fin,tipo,elaborado_por,notas)
      VALUES(?,?,?,?,?,?,?,?)`,[parseInt(id_presupuesto),numero,periodo,fecha_inicio,fecha_fin,tipo,elaborado_por||null,notas||null]);
    saveDb();
    res.json({ok:true,id,numero});
  } catch(e){res.status(500).json({error:e.message});}
});

// POST /api/planilla/:id/empleados — agregar empleado
router.post('/:id/empleados', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const id = parseInt(req.params.id);
    const plan = sqlGet(db,'SELECT tipo FROM planillas WHERE id_planilla=?',[id]);
    if (!plan) return res.status(404).json({error:'Planilla no encontrada'});
    const { nombre, identidad, cargo, categoria='operativo', salario_base,
            dias_laborados, horas_extra=0, otros_desc=0, observacion } = req.body;
    if (!nombre||!cargo||!salario_base) return res.status(400).json({error:'nombre, cargo y salario_base son requeridos'});

    const e = { salario_base: parseFloat(salario_base), dias_laborados: parseFloat(dias_laborados)||0,
                horas_extra: parseFloat(horas_extra)||0, otros_desc: parseFloat(otros_desc)||0 };
    const calc = calcEmpleado(e, plan.tipo);

    const empId = sqlRun(db,`INSERT INTO planilla_empleados
      (id_planilla,nombre,identidad,cargo,categoria,salario_base,dias_laborados,horas_extra,
       bonificacion,ihss_patronal,rap_patronal,ihss_empleado,rap_empleado,isr,
       otros_desc,total_desc,salario_bruto,salario_neto,costo_total,observacion)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[
      id,nombre,identidad||null,cargo,categoria,parseFloat(salario_base),
      e.dias_laborados,e.horas_extra,
      calc.bonificacion,calc.ihss_patronal,calc.rap_patronal,
      calc.ihss_empleado,calc.rap_empleado,calc.isr,
      e.otros_desc,calc.total_desc,calc.salario_bruto,calc.salario_neto,calc.costo_total,
      observacion||null
    ]);

    // Recalcular totales de la planilla
    recalcPlanilla(db, id);
    saveDb();
    res.json({ok:true,id:empId,...calc});
  } catch(e){res.status(500).json({error:e.message});}
});

// PUT /api/planilla/:id/empleados/:empId — actualizar empleado
router.put('/:id/empleados/:empId', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const id = parseInt(req.params.id);
    const empId = parseInt(req.params.empId);
    const plan = sqlGet(db,'SELECT tipo FROM planillas WHERE id_planilla=?',[id]);
    if (!plan) return res.status(404).json({error:'No encontrada'});

    const { nombre, identidad, cargo, categoria, salario_base,
            dias_laborados, horas_extra=0, otros_desc=0, observacion } = req.body;
    const e = { salario_base: parseFloat(salario_base), dias_laborados: parseFloat(dias_laborados)||0,
                horas_extra: parseFloat(horas_extra)||0, otros_desc: parseFloat(otros_desc)||0 };
    const calc = calcEmpleado(e, plan.tipo);

    db.run(`UPDATE planilla_empleados SET nombre=?,identidad=?,cargo=?,categoria=?,salario_base=?,
      dias_laborados=?,horas_extra=?,bonificacion=?,ihss_patronal=?,rap_patronal=?,
      ihss_empleado=?,rap_empleado=?,isr=?,otros_desc=?,total_desc=?,salario_bruto=?,
      salario_neto=?,costo_total=?,observacion=? WHERE id_emp=?`,[
      nombre,identidad||null,cargo,categoria||'operativo',parseFloat(salario_base),
      e.dias_laborados,e.horas_extra,calc.bonificacion,calc.ihss_patronal,calc.rap_patronal,
      calc.ihss_empleado,calc.rap_empleado,calc.isr,e.otros_desc,calc.total_desc,
      calc.salario_bruto,calc.salario_neto,calc.costo_total,observacion||null,empId
    ]);
    recalcPlanilla(db, id);
    saveDb();
    res.json({ok:true,...calc});
  } catch(e){res.status(500).json({error:e.message});}
});

// DELETE /api/planilla/:id/empleados/:empId
router.delete('/:id/empleados/:empId', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    db.run('DELETE FROM planilla_empleados WHERE id_emp=?',[parseInt(req.params.empId)]);
    recalcPlanilla(db, parseInt(req.params.id));
    saveDb();
    res.json({ok:true});
  } catch(e){res.status(500).json({error:e.message});}
});

// PUT /api/planilla/:id — actualizar estado/datos generales
router.put('/:id', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const { estado, notas, elaborado_por } = req.body;
    db.run(`UPDATE planillas SET estado=COALESCE(?,estado),notas=COALESCE(?,notas),
      elaborado_por=COALESCE(?,elaborado_por) WHERE id_planilla=?`,
      [estado||null,notas||null,elaborado_por||null,parseInt(req.params.id)]);
    saveDb();
    res.json({ok:true});
  } catch(e){res.status(500).json({error:e.message});}
});

// DELETE /api/planilla/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const id = parseInt(req.params.id);
    const p = sqlGet(db,'SELECT estado FROM planillas WHERE id_planilla=?',[id]);
    if (!p) return res.status(404).json({error:'No encontrada'});
    if (p.estado==='pagada') return res.status(400).json({error:'No se puede eliminar una planilla pagada'});
    db.run('DELETE FROM planilla_empleados WHERE id_planilla=?',[id]);
    db.run('DELETE FROM planillas WHERE id_planilla=?',[id]);
    saveDb();
    res.json({ok:true});
  } catch(e){res.status(500).json({error:e.message});}
});

function recalcPlanilla(db, id) {
  const r = db.exec(`SELECT COALESCE(SUM(salario_bruto),0),COALESCE(SUM(ihss_patronal),0),
    COALESCE(SUM(rap_patronal),0),COALESCE(SUM(total_desc),0),COALESCE(SUM(salario_neto),0)
    FROM planilla_empleados WHERE id_planilla=?`,[id]);
  if (!r.length||!r[0].values.length) return;
  const [tb,ti,tr,td,tn] = r[0].values[0];
  db.run('UPDATE planillas SET total_bruto=?,total_ihss_p=?,total_rap_p=?,total_desc_e=?,total_neto=? WHERE id_planilla=?',
    [tb,ti,tr,td,tn,id]);
}

// GET /api/planilla/:id/html
router.get('/:id/html', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const id = parseInt(req.params.id);
    const plan = sqlGet(db,`SELECT p.*, pr.nombre as presupuesto_nombre, pr.cliente, pr.ubicacion
      FROM planillas p JOIN presupuestos pr ON p.id_presupuesto=pr.id_presupuesto WHERE p.id_planilla=?`,[id]);
    if (!plan) return res.status(404).send('<h3>Planilla no encontrada</h3>');
    const empleados = sqlAll(db,'SELECT * FROM planilla_empleados WHERE id_planilla=? ORDER BY categoria,nombre',[id]);

    let empresa_nombre='',empresa_rtn='';
    try {
      const cfgR = db.exec("SELECT clave,valor FROM configuracion_sistema WHERE clave IN ('empresa_nombre','empresa_rtn')");
      if (cfgR.length) cfgR[0].values.forEach(([k,v])=>{
        if(k==='empresa_nombre') empresa_nombre=v||'';
        if(k==='empresa_rtn') empresa_rtn=v||'';
      });
    } catch(e){}

    const fmtL=(n)=>`L ${Number(n||0).toLocaleString('es-HN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    const esc=(s)=>(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    const catLabel={'profesional':'👔 Profesional','tecnico':'🔧 Técnico','operativo':'👷 Operativo'};
    const grupos={profesional:[],tecnico:[],operativo:[]};
    empleados.forEach(e => { const g=e.categoria||'operativo'; if(!grupos[g]) grupos[g]=[]; grupos[g].push(e); });

    let filasHTML='',n=1;
    for(const[cat,emps] of Object.entries(grupos)){
      if(!emps.length) continue;
      filasHTML+=`<tr style="background:#025196;color:#fff">
        <td colspan="13" style="padding:6px 10px;font-weight:700">${catLabel[cat]||cat}</td></tr>`;
      emps.forEach(e=>{
        filasHTML+=`<tr>
          <td style="text-align:center;font-size:10px;color:#888">${n++}</td>
          <td style="padding:4px 6px;font-weight:600">${esc(e.nombre)}</td>
          <td style="padding:4px 6px;font-size:10px;color:#555">${esc(e.cargo)}</td>
          <td style="text-align:right">${fmtL(e.salario_base)}</td>
          <td style="text-align:center">${Number(e.dias_laborados||0).toFixed(1)}</td>
          <td style="text-align:right;font-weight:600">${fmtL(e.salario_bruto)}</td>
          <td style="text-align:right;color:#1A7A3C">${fmtL(e.bonificacion)}</td>
          <td style="text-align:right;color:#c0392b">${fmtL(e.ihss_patronal)}</td>
          <td style="text-align:right;color:#c0392b">${fmtL(e.rap_patronal)}</td>
          <td style="text-align:right;color:#8C4A00">${fmtL(e.ihss_empleado+e.rap_empleado+e.isr)}</td>
          <td style="text-align:right;color:#8C4A00">${fmtL(e.total_desc)}</td>
          <td style="text-align:right;font-weight:700;color:#025196">${fmtL(e.salario_neto)}</td>
          <td style="text-align:right;font-weight:700;color:#5B4FBE">${fmtL(e.costo_total)}</td>
        </tr>`;
      });
    }

    const costo_total = empleados.reduce((s,e)=>s+(e.costo_total||0),0);
    const ihss_total  = empleados.reduce((s,e)=>s+(e.ihss_patronal||0),0);
    const rap_total   = empleados.reduce((s,e)=>s+(e.rap_patronal||0),0);

    const html=`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>Planilla N°${plan.numero} — ${esc(plan.presupuesto_nombre)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:10px;color:#1a1a1a;background:#f0f0f0}
  @page{size:letter landscape;margin:10mm 8mm}
  @media print{body{background:#fff}.no-print{display:none!important}}
  .pagina{background:#fff;max-width:1050px;margin:0 auto 20px;padding:12px;box-shadow:0 2px 12px rgba(0,0,0,.15)}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #025196;padding-bottom:8px;margin-bottom:10px}
  .titulo{font-size:18px;font-weight:700;color:#025196}
  table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:10px}
  thead th{background:#025196;color:#fff;padding:5px 6px;text-align:right;font-size:9px;white-space:nowrap}
  thead th:nth-child(1),thead th:nth-child(2),thead th:nth-child(3){text-align:left}
  tbody td{border-bottom:1px solid #eee;padding:4px 6px}
  tbody tr:nth-child(even) td{background:#f9fafc}
  tfoot td{background:#025196;color:#fff;font-weight:700;padding:6px;text-align:right;font-size:11px}
  .legend{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px;font-size:9px}
  .leg-item{background:#f0f5fb;padding:6px 8px;border-radius:3px;border-left:3px solid #025196}
  .firmas{display:flex;gap:40px;margin-top:20px}
  .firma-linea{border-top:1px solid #333;margin:30px 8px 0;text-align:center}
  .firma-cargo{font-size:9px;color:#666;margin-top:4px}
  .noprint-bar{background:#025196;color:#fff;padding:8px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:99}
</style>
</head><body>
<div class="no-print noprint-bar">
  <span style="font-weight:700">Planilla N°${plan.numero} — ${esc(plan.presupuesto_nombre)}</span>
  <button onclick="window.print()" style="background:#FDB338;color:#1a1a1a;border:none;font-weight:700;padding:7px 18px;border-radius:5px;cursor:pointer">🖨 Imprimir / PDF</button>
</div>
<div class="pagina">
  <div class="header">
    <div>
      <div class="titulo">PLANILLA DE MANO DE OBRA</div>
      <div style="font-size:12px;font-weight:700;color:#333;margin-top:3px">N° ${plan.numero} — ${esc(plan.periodo)}</div>
      <div style="font-size:10px;color:#555;margin-top:3px">Presupuesto: <strong>${esc(plan.presupuesto_nombre)}</strong></div>
    </div>
    <div style="text-align:right;font-size:9px;color:#555;line-height:1.6">
      ${empresa_nombre?`<strong>${esc(empresa_nombre)}</strong><br>`:''}
      ${empresa_rtn?`RTN: ${esc(empresa_rtn)}<br>`:''}
      <span>Tasas: IHSS pat. 11% | RAP pat. 1.5% | IHSS emp. 2.5% | RAP emp. 1.5%</span>
    </div>
  </div>
  <table>
    <thead><tr>
      <th style="width:25px">N°</th><th style="width:140px">Nombre</th><th style="width:100px">Cargo</th>
      <th style="width:80px">Salario/Mes</th><th style="width:40px;text-align:center">Días</th>
      <th>S.Bruto</th><th>Bonif.</th><th>IHSS Pat.</th><th>RAP Pat.</th>
      <th>Desc.Emp.</th><th>Total Desc.</th><th>S.Neto</th><th>Costo Total</th>
    </tr></thead>
    <tbody>${filasHTML}</tbody>
    <tfoot><tr>
      <td colspan="5" style="text-align:left;font-size:11px">TOTALES — ${empleados.length} empleado${empleados.length!==1?'s':''}</td>
      <td>${fmtL(plan.total_bruto)}</td>
      <td>${fmtL(empleados.reduce((s,e)=>s+(e.bonificacion||0),0))}</td>
      <td>${fmtL(plan.total_ihss_p)}</td>
      <td>${fmtL(plan.total_rap_p)}</td>
      <td>${fmtL(empleados.reduce((s,e)=>s+(e.ihss_empleado+e.rap_empleado+e.isr),0))}</td>
      <td>${fmtL(plan.total_desc_e)}</td>
      <td>${fmtL(plan.total_neto)}</td>
      <td style="color:#FDB338;font-size:13px">${fmtL(costo_total)}</td>
    </tr></tfoot>
  </table>
  <div class="legend">
    <div class="leg-item"><strong>Costo Total Empresa:</strong> ${fmtL(costo_total)}</div>
    <div class="leg-item"><strong>IHSS Patronal (11%):</strong> ${fmtL(ihss_total)}</div>
    <div class="leg-item"><strong>RAP Patronal (1.5%):</strong> ${fmtL(rap_total)}</div>
    <div class="leg-item"><strong>S.Bruto ÷ 30 días:</strong> salario diario referencia</div>
  </div>
  <div class="firmas">
    <div class="firma-linea" style="flex:1"><div class="firma-cargo">Gerente/Director de Proyecto</div></div>
    <div class="firma-linea" style="flex:1"><div class="firma-cargo">Elaboró — ${esc(plan.elaborado_por||'')}</div></div>
    <div class="firma-linea" style="flex:1"><div class="firma-cargo">Revisó / Contador</div></div>
    <div class="firma-linea" style="flex:1"><div class="firma-cargo">Pagó / Tesorero</div></div>
  </div>
  <div style="margin-top:12px;font-size:8px;color:#999;border-top:1px solid #ddd;padding-top:6px;display:flex;justify-content:space-between">
    <span>Tasas Honduras 2024-2026: IHSS Patronal 11% | RAP Patronal 1.5% | Bonificación L ${TASAS.bonificacion}/mes | Base IHSS techo L 9,500</span>
    <span>Generado: ${new Date().toLocaleDateString('es-HN')}</span>
  </div>
</div>
<script>if(new URLSearchParams(location.search).get('autoprint')==='1')window.onload=()=>window.print();</script>
</body></html>`;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.send(html);
  } catch(e){res.status(500).send(`<h3>Error: ${e.message}</h3>`);}
});

// GET /api/planilla/tasas — devolver tasas vigentes
router.get('/info/tasas', requireAuth, (req, res) => {
  res.json({...TASAS, vigencia:'2024-2026', fuente:'STSS/IHSS Honduras'});
});

module.exports = router;
