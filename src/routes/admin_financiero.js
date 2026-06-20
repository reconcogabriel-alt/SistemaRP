const express = require('express');
const router  = express.Router();
const { getDb, saveDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const ExcelJS = require('exceljs');

const C_BLUE='FF025196', C_ORANGE='FFFDB338', C_WHITE='FFFFFFFF',
      C_LGRAY='FFF5F5F5', C_DGRAY='FFD4DBE3', C_LBLUE='FFEEF3F9',
      C_GREEN='FF00703C', C_RED='FFCC0000';

// ─────────────────────────────────────────────────────────────────────────────
// MIGRACIONES
// ─────────────────────────────────────────────────────────────────────────────
async function ensureTables() {
  const db = await getDb();

  // PROVEEDORES
  db.run(`CREATE TABLE IF NOT EXISTS proveedores (
    id_prov       INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre        TEXT NOT NULL,
    rtn           TEXT,
    contacto      TEXT,
    telefono      TEXT,
    correo        TEXT,
    direccion     TEXT,
    categoria     TEXT DEFAULT 'general'
                  CHECK(categoria IN ('materiales','subcontrato','equipo','servicios','general')),
    calificacion  REAL DEFAULT 0,
    activo        INTEGER DEFAULT 1,
    notas         TEXT,
    fecha_creacion TEXT DEFAULT (datetime('now'))
  )`);

  // ÓRDENES DE COMPRA
  db.run(`CREATE TABLE IF NOT EXISTS ordenes_compra (
    id_oc         INTEGER PRIMARY KEY AUTOINCREMENT,
    numero        TEXT NOT NULL UNIQUE,
    id_presupuesto   INTEGER NOT NULL,
    id_prov       INTEGER NOT NULL,
    id_req        INTEGER,
    fecha_oc      TEXT DEFAULT (date('now')),
    fecha_entrega TEXT,
    estado        TEXT DEFAULT 'borrador'
                  CHECK(estado IN ('borrador','pendiente','aprobada','recibida_parcial','recibida_total','anulada')),
    condicion_pago TEXT DEFAULT 'contado',
    subtotal      REAL DEFAULT 0,
    impuesto      REAL DEFAULT 0,
    total         REAL DEFAULT 0,
    aprobado_por  TEXT,
    fecha_aprobacion TEXT,
    notas         TEXT,
    fecha_creacion TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (id_presupuesto) REFERENCES presupuestos(id_presupuesto),
    FOREIGN KEY (id_prov)     REFERENCES proveedores(id_prov),
    FOREIGN KEY (id_req)      REFERENCES requisiciones(id_req)
  )`);

  // ÍTEMS DE ORDEN DE COMPRA
  db.run(`CREATE TABLE IF NOT EXISTS oc_items (
    id_item       INTEGER PRIMARY KEY AUTOINCREMENT,
    id_oc         INTEGER NOT NULL,
    id_insumo     INTEGER NOT NULL,
    descripcion   TEXT,
    unidad        TEXT,
    cantidad      REAL NOT NULL,
    precio_unit   REAL NOT NULL DEFAULT 0,
    subtotal      REAL DEFAULT 0,
    cantidad_recibida REAL DEFAULT 0,
    FOREIGN KEY (id_oc)      REFERENCES ordenes_compra(id_oc),
    FOREIGN KEY (id_insumo)  REFERENCES insumos(id_insumo)
  )`);

  // COTIZACIONES
  db.run(`CREATE TABLE IF NOT EXISTS cotizaciones (
    id_cot        INTEGER PRIMARY KEY AUTOINCREMENT,
    id_oc         INTEGER NOT NULL,
    id_prov       INTEGER NOT NULL,
    fecha_cot     TEXT DEFAULT (date('now')),
    validez_dias  INTEGER DEFAULT 30,
    total         REAL DEFAULT 0,
    seleccionada  INTEGER DEFAULT 0,
    notas         TEXT,
    fecha_creacion TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (id_oc)   REFERENCES ordenes_compra(id_oc),
    FOREIGN KEY (id_prov) REFERENCES proveedores(id_prov)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS cotizacion_items (
    id_ci         INTEGER PRIMARY KEY AUTOINCREMENT,
    id_cot        INTEGER NOT NULL,
    id_insumo     INTEGER NOT NULL,
    precio_unit   REAL NOT NULL DEFAULT 0,
    subtotal      REAL DEFAULT 0,
    notas         TEXT,
    FOREIGN KEY (id_cot)     REFERENCES cotizaciones(id_cot),
    FOREIGN KEY (id_insumo)  REFERENCES insumos(id_insumo)
  )`);

  // CUENTAS POR PAGAR (facturas de proveedores/subcontratistas)
  db.run(`CREATE TABLE IF NOT EXISTS cuentas_pagar (
    id_cp         INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_doc    TEXT NOT NULL,
    tipo_doc      TEXT DEFAULT 'factura'
                  CHECK(tipo_doc IN ('factura','recibo','planilla_sub','estimacion','otro')),
    id_prov       INTEGER,
    id_presupuesto   INTEGER,
    id_oc         INTEGER,
    fecha_doc     TEXT DEFAULT (date('now')),
    fecha_vence   TEXT,
    monto_total   REAL NOT NULL DEFAULT 0,
    monto_pagado  REAL DEFAULT 0,
    saldo         REAL DEFAULT 0,
    estado        TEXT DEFAULT 'pendiente'
                  CHECK(estado IN ('pendiente','pagada_parcial','pagada','anulada')),
    categoria_gasto TEXT DEFAULT 'materiales'
                  CHECK(categoria_gasto IN ('materiales','mano_obra','subcontrato','equipo','administrativo','otro')),
    descripcion   TEXT,
    notas         TEXT,
    fecha_creacion TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (id_prov)     REFERENCES proveedores(id_prov),
    FOREIGN KEY (id_presupuesto) REFERENCES presupuestos(id_presupuesto),
    FOREIGN KEY (id_oc)       REFERENCES ordenes_compra(id_oc)
  )`);

  // PAGOS
  db.run(`CREATE TABLE IF NOT EXISTS pagos (
    id_pago       INTEGER PRIMARY KEY AUTOINCREMENT,
    id_cp         INTEGER NOT NULL,
    fecha_pago    TEXT DEFAULT (date('now')),
    monto         REAL NOT NULL,
    metodo        TEXT DEFAULT 'transferencia'
                  CHECK(metodo IN ('efectivo','cheque','transferencia','otro')),
    referencia    TEXT,
    notas         TEXT,
    fecha_creacion TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (id_cp) REFERENCES cuentas_pagar(id_cp)
  )`);

  // TAREO DIARIO
  db.run(`CREATE TABLE IF NOT EXISTS tareo_cuadrillas (
    id_cuadrilla  INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre        TEXT NOT NULL,
    id_presupuesto   INTEGER,
    capataz       TEXT,
    activa        INTEGER DEFAULT 1,
    fecha_creacion TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (id_presupuesto) REFERENCES presupuestos(id_presupuesto)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS trabajadores (
    id_trab       INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre        TEXT NOT NULL,
    identidad     TEXT,
    cargo         TEXT DEFAULT 'peon'
                  CHECK(cargo IN ('maestro','oficial','ayudante','peon','caporal','otro')),
    salario_base  REAL DEFAULT 0,
    id_cuadrilla  INTEGER,
    activo        INTEGER DEFAULT 1,
    fecha_ingreso TEXT DEFAULT (date('now')),
    FOREIGN KEY (id_cuadrilla) REFERENCES tareo_cuadrillas(id_cuadrilla)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tareo_diario (
    id_tareo      INTEGER PRIMARY KEY AUTOINCREMENT,
    id_trab       INTEGER NOT NULL,
    id_presupuesto   INTEGER NOT NULL,
    id_actividad  INTEGER,
    fecha         TEXT NOT NULL DEFAULT (date('now')),
    horas_normales REAL DEFAULT 8,
    horas_extra   REAL DEFAULT 0,
    tipo_pago     TEXT DEFAULT 'jornal'
                  CHECK(tipo_pago IN ('jornal','destajo','hora')),
    monto_destajo REAL DEFAULT 0,
    descripcion_trabajo TEXT,
    asistio       INTEGER DEFAULT 1,
    fecha_creacion TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (id_trab)       REFERENCES trabajadores(id_trab),
    FOREIGN KEY (id_presupuesto)   REFERENCES presupuestos(id_presupuesto),
    FOREIGN KEY (id_actividad)  REFERENCES actividades(id_actividad)
  )`);

  saveDb();
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function nextNumOC(db) {
  const r = db.exec("SELECT COUNT(*) FROM ordenes_compra");
  const n = r.length ? (r[0].values[0][0] + 1) : 1;
  const y = new Date().getFullYear();
  return `OC-${y}-${String(n).padStart(4,'0')}`;
}

function rows(db, sql, params=[]) {
  const r = db.exec(sql, params);
  return r.length ? r[0].values : [];
}

function toObj(cols, vals) {
  const o = {};
  cols.forEach((c,i) => o[c] = vals[i]);
  return o;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVEEDORES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/proveedores', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const { categoria, q } = req.query;
    let where = 'p.activo=1';
    const params = [];
    if (categoria) { where += ' AND p.categoria=?'; params.push(categoria); }
    if (q) { where += ' AND (p.nombre LIKE ? OR p.rtn LIKE ?)'; params.push(`%${q}%`,`%${q}%`); }

    const vv = rows(db, `
      SELECT p.id_prov, p.nombre, p.rtn, p.contacto, p.telefono, p.correo,
             p.categoria, p.calificacion, p.activo, p.notas,
             COUNT(DISTINCT oc.id_oc) as num_oc
      FROM proveedores p
      LEFT JOIN ordenes_compra oc ON oc.id_prov=p.id_prov
      WHERE ${where}
      GROUP BY p.id_prov ORDER BY p.nombre`, params);

    res.json(vv.map(v => ({
      id_prov:v[0], nombre:v[1], rtn:v[2], contacto:v[3], telefono:v[4],
      correo:v[5], categoria:v[6], calificacion:v[7], activo:v[8],
      notas:v[9], num_oc:v[10]
    })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/proveedores', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const { nombre, rtn, contacto, telefono, correo, direccion, categoria, notas } = req.body;
    if (!nombre) return res.status(400).json({ error: 'nombre requerido' });
    db.run(`INSERT INTO proveedores (nombre,rtn,contacto,telefono,correo,direccion,categoria,notas)
            VALUES (?,?,?,?,?,?,?,?)`,
           [nombre, rtn||'', contacto||'', telefono||'', correo||'', direccion||'', categoria||'general', notas||'']);
    const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    saveDb();
    res.json({ ok:true, id_prov:id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/proveedores/:id', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const { nombre, rtn, contacto, telefono, correo, direccion, categoria, calificacion, notas } = req.body;
    db.run(`UPDATE proveedores SET nombre=?,rtn=?,contacto=?,telefono=?,correo=?,
            direccion=?,categoria=?,calificacion=?,notas=? WHERE id_prov=?`,
           [nombre, rtn||'', contacto||'', telefono||'', correo||'', direccion||'',
            categoria||'general', calificacion||0, notas||'', req.params.id]);
    saveDb();
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/proveedores/:id', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    db.run('UPDATE proveedores SET activo=0 WHERE id_prov=?', [req.params.id]);
    saveDb();
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// ÓRDENES DE COMPRA
// ─────────────────────────────────────────────────────────────────────────────
router.get('/ordenes-compra', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const { id_presupuesto, estado, id_prov } = req.query;
    let where = '1=1'; const params = [];
    if (id_presupuesto) { where += ' AND oc.id_presupuesto=?'; params.push(id_presupuesto); }
    if (estado)      { where += ' AND oc.estado=?';      params.push(estado); }
    if (id_prov)     { where += ' AND oc.id_prov=?';     params.push(id_prov); }

    const vv = rows(db, `
      SELECT oc.id_oc, oc.numero, oc.id_presupuesto, pr.nombre as presupuesto,
             oc.id_prov, pv.nombre as proveedor,
             oc.id_req, rq.numero as req_numero,
             oc.fecha_oc, oc.fecha_entrega, oc.estado, oc.condicion_pago,
             oc.subtotal, oc.impuesto, oc.total,
             oc.aprobado_por, oc.fecha_aprobacion, oc.notas,
             COUNT(oi.id_item) as num_items
      FROM ordenes_compra oc
      JOIN presupuestos pr ON oc.id_presupuesto=pr.id_presupuesto
      JOIN proveedores pv ON oc.id_prov=pv.id_prov
      LEFT JOIN requisiciones rq ON oc.id_req=rq.id_req
      LEFT JOIN oc_items oi ON oi.id_oc=oc.id_oc
      WHERE ${where}
      GROUP BY oc.id_oc ORDER BY oc.fecha_creacion DESC`, params);

    res.json(vv.map(v => ({
      id_oc:v[0], numero:v[1], id_presupuesto:v[2], presupuesto:v[3],
      id_prov:v[4], proveedor:v[5], id_req:v[6], req_numero:v[7],
      fecha_oc:v[8], fecha_entrega:v[9], estado:v[10], condicion_pago:v[11],
      subtotal:v[12], impuesto:v[13], total:v[14],
      aprobado_por:v[15], fecha_aprobacion:v[16], notas:v[17], num_items:v[18]
    })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/ordenes-compra/:id', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const vv = rows(db, `
      SELECT oc.id_oc, oc.numero, oc.id_presupuesto, pr.nombre as presupuesto,
             oc.id_prov, pv.nombre as proveedor, pv.rtn, pv.telefono, pv.correo,
             oc.id_req, rq.numero as req_numero,
             oc.fecha_oc, oc.fecha_entrega, oc.estado, oc.condicion_pago,
             oc.subtotal, oc.impuesto, oc.total,
             oc.aprobado_por, oc.fecha_aprobacion, oc.notas
      FROM ordenes_compra oc
      JOIN presupuestos pr ON oc.id_presupuesto=pr.id_presupuesto
      JOIN proveedores pv ON oc.id_prov=pv.id_prov
      LEFT JOIN requisiciones rq ON oc.id_req=rq.id_req
      WHERE oc.id_oc=?`, [req.params.id]);

    if (!vv.length) return res.status(404).json({ error: 'OC no encontrada' });
    const v = vv[0];
    const oc = {
      id_oc:v[0], numero:v[1], id_presupuesto:v[2], presupuesto:v[3],
      id_prov:v[4], proveedor:v[5], prov_rtn:v[6], prov_tel:v[7], prov_correo:v[8],
      id_req:v[9], req_numero:v[10],
      fecha_oc:v[11], fecha_entrega:v[12], estado:v[13], condicion_pago:v[14],
      subtotal:v[15], impuesto:v[16], total:v[17],
      aprobado_por:v[18], fecha_aprobacion:v[19], notas:v[20]
    };

    const items = rows(db, `
      SELECT oi.id_item, oi.id_insumo, i.codigo, COALESCE(oi.descripcion, i.descripcion) as descripcion,
             COALESCE(oi.unidad, i.unidad) as unidad,
             oi.cantidad, oi.precio_unit, oi.subtotal, oi.cantidad_recibida
      FROM oc_items oi JOIN insumos i ON oi.id_insumo=i.id_insumo
      WHERE oi.id_oc=?`, [req.params.id]).map(r => ({
      id_item:r[0], id_insumo:r[1], codigo:r[2], descripcion:r[3], unidad:r[4],
      cantidad:r[5], precio_unit:r[6], subtotal:r[7], cantidad_recibida:r[8]
    }));

    res.json({ oc, items });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/ordenes-compra', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const { id_presupuesto, id_prov, id_req, fecha_entrega, condicion_pago, notas, items, impuesto_pct } = req.body;
    if (!id_presupuesto || !id_prov || !items?.length)
      return res.status(400).json({ error: 'id_presupuesto, id_prov e items son requeridos' });

    const numero = await nextNumOC(db);
    let subtotal = 0;
    items.forEach(it => { subtotal += (it.cantidad || 0) * (it.precio_unit || 0); });
    const impuesto = subtotal * ((parseFloat(impuesto_pct) || 0) / 100);
    const total = subtotal + impuesto;

    db.run(`INSERT INTO ordenes_compra (numero,id_presupuesto,id_prov,id_req,fecha_entrega,
            condicion_pago,subtotal,impuesto,total,notas)
            VALUES (?,?,?,?,?,?,?,?,?,?)`,
           [numero, id_presupuesto, id_prov, id_req||null, fecha_entrega||null,
            condicion_pago||'contado', subtotal, impuesto, total, notas||'']);
    const id_oc = db.exec('SELECT last_insert_rowid()')[0].values[0][0];

    for (const it of items) {
      const sub = (it.cantidad||0) * (it.precio_unit||0);
      db.run(`INSERT INTO oc_items (id_oc,id_insumo,descripcion,unidad,cantidad,precio_unit,subtotal)
              VALUES (?,?,?,?,?,?,?)`,
             [id_oc, it.id_insumo, it.descripcion||null, it.unidad||null, it.cantidad, it.precio_unit||0, sub]);
    }
    saveDb();
    res.json({ ok:true, id_oc, numero });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.patch('/ordenes-compra/:id/estado', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const { estado, aprobado_por } = req.body;
    const validos = ['borrador','pendiente','aprobada','recibida_parcial','recibida_total','anulada'];
    if (!validos.includes(estado)) return res.status(400).json({ error: 'Estado no válido' });

    if (estado === 'aprobada') {
      db.run(`UPDATE ordenes_compra SET estado=?, aprobado_por=?, fecha_aprobacion=date('now')
              WHERE id_oc=?`, [estado, aprobado_por||'Sistema', req.params.id]);
      // Actualizar requisición asociada
      const vv = rows(db, 'SELECT id_req FROM ordenes_compra WHERE id_oc=?', [req.params.id]);
      if (vv.length && vv[0][0]) {
        db.run("UPDATE requisiciones SET estado='aprobada' WHERE id_req=?", [vv[0][0]]);
      }
    } else {
      db.run('UPDATE ordenes_compra SET estado=? WHERE id_oc=?', [estado, req.params.id]);
    }
    saveDb();
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Registrar recepción parcial o total
router.post('/ordenes-compra/:id/recepcion', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const { recepciones } = req.body; // [{id_item, cantidad_recibida}]
    if (!recepciones?.length) return res.status(400).json({ error: 'recepciones requeridas' });

    for (const r of recepciones) {
      db.run('UPDATE oc_items SET cantidad_recibida=? WHERE id_item=?',
             [r.cantidad_recibida, r.id_item]);
    }

    // Determinar si es total o parcial
    const items = rows(db,
      'SELECT cantidad, cantidad_recibida FROM oc_items WHERE id_oc=?', [req.params.id]);
    const total_ok = items.every(([c, cr]) => cr >= c);
    const algun_ok = items.some(([, cr]) => cr > 0);
    const estado = total_ok ? 'recibida_total' : algun_ok ? 'recibida_parcial' : 'aprobada';
    db.run('UPDATE ordenes_compra SET estado=? WHERE id_oc=?', [estado, req.params.id]);

    // Registrar entradas en bodega automáticamente
    const oc_info = rows(db,
      'SELECT id_presupuesto, id_prov FROM ordenes_compra WHERE id_oc=?', [req.params.id]);
    if (oc_info.length) {
      const [id_presupuesto, id_prov] = oc_info[0];
      const prov_info = rows(db, 'SELECT nombre FROM proveedores WHERE id_prov=?', [id_prov]);
      const prov_nombre = prov_info.length ? prov_info[0][0] : '';
      const oc_num = rows(db, 'SELECT numero FROM ordenes_compra WHERE id_oc=?', [req.params.id]);
      const ref = oc_num.length ? oc_num[0][0] : '';

      for (const r of recepciones) {
        if (r.cantidad_recibida > 0) {
          const item_info = rows(db,
            'SELECT id_insumo, precio_unit FROM oc_items WHERE id_item=?', [r.id_item]);
          if (item_info.length) {
            const [id_insumo, pu] = item_info[0];
            const tot = r.cantidad_recibida * pu;
            db.run(`INSERT INTO bodega_movimientos
                    (tipo,id_insumo,id_presupuesto,cantidad,precio_unitario,total,referencia,proveedor,notas)
                    VALUES ('entrada',?,?,?,?,?,?,?,'Entrada desde OC: '||?)`,
                   [id_insumo, id_presupuesto, r.cantidad_recibida, pu, tot, ref, prov_nombre, ref]);
            // Actualizar stock
            const st = rows(db, 'SELECT id_stock, cantidad_actual FROM bodega_stock WHERE id_insumo=?', [id_insumo]);
            if (st.length) {
              db.run('UPDATE bodega_stock SET cantidad_actual=?, ultima_actualizacion=datetime("now") WHERE id_stock=?',
                     [st[0][1] + r.cantidad_recibida, st[0][0]]);
            } else {
              db.run('INSERT INTO bodega_stock (id_insumo, cantidad_actual) VALUES (?,?)',
                     [id_insumo, r.cantidad_recibida]);
            }
          }
        }
      }
    }
    saveDb();
    res.json({ ok:true, estado });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// CUENTAS POR PAGAR
// ─────────────────────────────────────────────────────────────────────────────
router.get('/cuentas-pagar', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const { id_presupuesto, estado, tipo_doc } = req.query;
    let where = '1=1'; const params = [];
    if (id_presupuesto) { where += ' AND cp.id_presupuesto=?'; params.push(id_presupuesto); }
    if (estado)      { where += ' AND cp.estado=?';      params.push(estado); }
    if (tipo_doc)    { where += ' AND cp.tipo_doc=?';    params.push(tipo_doc); }

    const vv = rows(db, `
      SELECT cp.id_cp, cp.numero_doc, cp.tipo_doc,
             cp.id_prov, COALESCE(pv.nombre,'—') as proveedor,
             cp.id_presupuesto, COALESCE(pr.nombre,'—') as presupuesto,
             cp.fecha_doc, cp.fecha_vence,
             cp.monto_total, cp.monto_pagado, cp.saldo,
             cp.estado, cp.categoria_gasto, cp.descripcion, cp.notas
      FROM cuentas_pagar cp
      LEFT JOIN proveedores pv ON cp.id_prov=pv.id_prov
      LEFT JOIN presupuestos pr ON cp.id_presupuesto=pr.id_presupuesto
      WHERE ${where} ORDER BY cp.fecha_creacion DESC`, params);

    res.json(vv.map(v => ({
      id_cp:v[0], numero_doc:v[1], tipo_doc:v[2],
      id_prov:v[3], proveedor:v[4], id_presupuesto:v[5], presupuesto:v[6],
      fecha_doc:v[7], fecha_vence:v[8],
      monto_total:v[9], monto_pagado:v[10], saldo:v[11],
      estado:v[12], categoria_gasto:v[13], descripcion:v[14], notas:v[15]
    })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/cuentas-pagar', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const { numero_doc, tipo_doc, id_prov, id_presupuesto, id_oc,
            fecha_doc, fecha_vence, monto_total, categoria_gasto, descripcion, notas } = req.body;
    if (!numero_doc || !monto_total) return res.status(400).json({ error: 'numero_doc y monto_total requeridos' });

    const monto = parseFloat(monto_total) || 0;
    db.run(`INSERT INTO cuentas_pagar
            (numero_doc,tipo_doc,id_prov,id_presupuesto,id_oc,fecha_doc,fecha_vence,
             monto_total,saldo,categoria_gasto,descripcion,notas)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
           [numero_doc, tipo_doc||'factura', id_prov||null, id_presupuesto||null, id_oc||null,
            fecha_doc||null, fecha_vence||null, monto, monto,
            categoria_gasto||'materiales', descripcion||'', notas||'']);
    const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    saveDb();
    res.json({ ok:true, id_cp:id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Registrar pago de una cuenta
router.post('/cuentas-pagar/:id/pago', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const { monto, metodo, referencia, fecha_pago, notas } = req.body;
    const monto_pago = parseFloat(monto) || 0;
    if (monto_pago <= 0) return res.status(400).json({ error: 'Monto inválido' });

    db.run(`INSERT INTO pagos (id_cp, fecha_pago, monto, metodo, referencia, notas)
            VALUES (?,?,?,?,?,?)`,
           [req.params.id, fecha_pago||null, monto_pago, metodo||'transferencia', referencia||'', notas||'']);

    // Actualizar saldo y estado
    const cp = rows(db, 'SELECT monto_total, monto_pagado FROM cuentas_pagar WHERE id_cp=?', [req.params.id]);
    if (cp.length) {
      const [total, pagado_prev] = cp[0];
      const nuevo_pagado = pagado_prev + monto_pago;
      const nuevo_saldo  = total - nuevo_pagado;
      const nuevo_estado = nuevo_saldo <= 0 ? 'pagada' : 'pagada_parcial';
      db.run('UPDATE cuentas_pagar SET monto_pagado=?, saldo=?, estado=? WHERE id_cp=?',
             [nuevo_pagado, Math.max(0, nuevo_saldo), nuevo_estado, req.params.id]);
    }
    saveDb();
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// TAREO DIARIO
// ─────────────────────────────────────────────────────────────────────────────
router.get('/cuadrillas', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const vv = rows(db, `
      SELECT c.id_cuadrilla, c.nombre, c.capataz, c.activa,
             COALESCE(p.nombre,'—') as presupuesto,
             COUNT(t.id_trab) as num_trabajadores
      FROM tareo_cuadrillas c
      LEFT JOIN presupuestos p ON c.id_presupuesto=p.id_presupuesto
      LEFT JOIN trabajadores t ON t.id_cuadrilla=c.id_cuadrilla AND t.activo=1
      WHERE c.activa=1
      GROUP BY c.id_cuadrilla ORDER BY c.nombre`);
    res.json(vv.map(v => ({
      id_cuadrilla:v[0], nombre:v[1], capataz:v[2], activa:v[3], presupuesto:v[4], num_trabajadores:v[5]
    })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/cuadrillas', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const { nombre, capataz, id_presupuesto } = req.body;
    if (!nombre) return res.status(400).json({ error: 'nombre requerido' });
    db.run('INSERT INTO tareo_cuadrillas (nombre,capataz,id_presupuesto) VALUES (?,?,?)',
           [nombre, capataz||'', id_presupuesto||null]);
    const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    saveDb();
    res.json({ ok:true, id_cuadrilla:id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/trabajadores', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const { id_cuadrilla } = req.query;
    let where = 't.activo=1'; const params = [];
    if (id_cuadrilla) { where += ' AND t.id_cuadrilla=?'; params.push(id_cuadrilla); }

    const vv = rows(db, `
      SELECT t.id_trab, t.nombre, t.identidad, t.cargo, t.salario_base,
             t.id_cuadrilla, COALESCE(c.nombre,'—') as cuadrilla, t.fecha_ingreso
      FROM trabajadores t
      LEFT JOIN tareo_cuadrillas c ON t.id_cuadrilla=c.id_cuadrilla
      WHERE ${where} ORDER BY t.nombre`, params);

    res.json(vv.map(v => ({
      id_trab:v[0], nombre:v[1], identidad:v[2], cargo:v[3], salario_base:v[4],
      id_cuadrilla:v[5], cuadrilla:v[6], fecha_ingreso:v[7]
    })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/trabajadores', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const { nombre, identidad, cargo, salario_base, id_cuadrilla, fecha_ingreso } = req.body;
    if (!nombre) return res.status(400).json({ error: 'nombre requerido' });
    db.run(`INSERT INTO trabajadores (nombre,identidad,cargo,salario_base,id_cuadrilla,fecha_ingreso)
            VALUES (?,?,?,?,?,?)`,
           [nombre, identidad||'', cargo||'peon', parseFloat(salario_base)||0,
            id_cuadrilla||null, fecha_ingreso||null]);
    const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    saveDb();
    res.json({ ok:true, id_trab:id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET tareo por fecha y presupuesto
router.get('/tareo', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const { fecha, id_presupuesto, desde, hasta } = req.query;
    let where = '1=1'; const params = [];
    if (fecha)       { where += ' AND td.fecha=?';           params.push(fecha); }
    if (id_presupuesto) { where += ' AND td.id_presupuesto=?';     params.push(id_presupuesto); }
    if (desde)       { where += ' AND td.fecha>=?';          params.push(desde); }
    if (hasta)       { where += ' AND td.fecha<=?';          params.push(hasta); }

    const vv = rows(db, `
      SELECT td.id_tareo, td.fecha,
             td.id_trab, tr.nombre as trabajador, tr.cargo,
             td.id_presupuesto, pr.nombre as presupuesto,
             td.id_actividad, COALESCE(ac.descripcion,'—') as actividad,
             td.horas_normales, td.horas_extra, td.tipo_pago,
             td.monto_destajo, td.descripcion_trabajo, td.asistio,
             tr.salario_base,
             CASE td.tipo_pago
               WHEN 'jornal'  THEN tr.salario_base + (td.horas_extra * (tr.salario_base/8.0) * 1.5)
               WHEN 'destajo' THEN td.monto_destajo
               WHEN 'hora'    THEN (td.horas_normales + td.horas_extra) * (tr.salario_base/8.0)
               ELSE 0
             END as monto_dia
      FROM tareo_diario td
      JOIN trabajadores tr ON td.id_trab=tr.id_trab
      JOIN presupuestos pr ON td.id_presupuesto=pr.id_presupuesto
      LEFT JOIN actividades ac ON td.id_actividad=ac.id_actividad
      WHERE ${where}
      ORDER BY td.fecha DESC, tr.nombre`, params);

    res.json(vv.map(v => ({
      id_tareo:v[0], fecha:v[1], id_trab:v[2], trabajador:v[3], cargo:v[4],
      id_presupuesto:v[5], presupuesto:v[6], id_actividad:v[7], actividad:v[8],
      horas_normales:v[9], horas_extra:v[10], tipo_pago:v[11],
      monto_destajo:v[12], descripcion_trabajo:v[13], asistio:v[14],
      salario_base:v[15], monto_dia:v[16]
    })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST tareo en lote (un día completo de cuadrilla)
router.post('/tareo', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const { registros } = req.body; // [{id_trab, id_presupuesto, id_actividad, fecha, horas_normales, horas_extra, tipo_pago, monto_destajo, descripcion_trabajo, asistio}]
    if (!registros?.length) return res.status(400).json({ error: 'registros requeridos' });

    let insertados = 0;
    for (const r of registros) {
      // Evitar duplicados en mismo día/trabajador/presupuesto
      const dup = rows(db, 'SELECT id_tareo FROM tareo_diario WHERE id_trab=? AND fecha=? AND id_presupuesto=?',
                       [r.id_trab, r.fecha, r.id_presupuesto]);
      if (dup.length) {
        db.run(`UPDATE tareo_diario SET horas_normales=?,horas_extra=?,tipo_pago=?,
                monto_destajo=?,descripcion_trabajo=?,asistio=?,id_actividad=?
                WHERE id_tareo=?`,
               [r.horas_normales||8, r.horas_extra||0, r.tipo_pago||'jornal',
                r.monto_destajo||0, r.descripcion_trabajo||'', r.asistio!==undefined?r.asistio:1,
                r.id_actividad||null, dup[0][0]]);
      } else {
        db.run(`INSERT INTO tareo_diario
                (id_trab,id_presupuesto,id_actividad,fecha,horas_normales,horas_extra,
                 tipo_pago,monto_destajo,descripcion_trabajo,asistio)
                VALUES (?,?,?,?,?,?,?,?,?,?)`,
               [r.id_trab, r.id_presupuesto, r.id_actividad||null, r.fecha,
                r.horas_normales||8, r.horas_extra||0, r.tipo_pago||'jornal',
                r.monto_destajo||0, r.descripcion_trabajo||'', r.asistio!==undefined?r.asistio:1]);
        insertados++;
      }
    }
    saveDb();
    res.json({ ok:true, insertados });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET resumen de nómina por rango de fechas
router.get('/nomina-resumen', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const { desde, hasta, id_presupuesto } = req.query;
    if (!desde || !hasta) return res.status(400).json({ error: 'desde y hasta requeridos' });

    let where = 'td.fecha>=? AND td.fecha<=? AND td.asistio=1';
    const params = [desde, hasta];
    if (id_presupuesto) { where += ' AND td.id_presupuesto=?'; params.push(id_presupuesto); }

    const vv = rows(db, `
      SELECT tr.id_trab, tr.nombre, tr.cargo, tr.salario_base,
             COALESCE(c.nombre,'—') as cuadrilla,
             COUNT(td.id_tareo) as dias_trabajados,
             SUM(td.horas_extra) as total_horas_extra,
             SUM(CASE td.tipo_pago
               WHEN 'jornal'  THEN tr.salario_base + (td.horas_extra * (tr.salario_base/8.0) * 1.5)
               WHEN 'destajo' THEN td.monto_destajo
               WHEN 'hora'    THEN (td.horas_normales + td.horas_extra) * (tr.salario_base/8.0)
               ELSE 0
             END) as total_bruto
      FROM tareo_diario td
      JOIN trabajadores tr ON td.id_trab=tr.id_trab
      LEFT JOIN tareo_cuadrillas c ON tr.id_cuadrilla=c.id_cuadrilla
      WHERE ${where}
      GROUP BY tr.id_trab ORDER BY c.nombre, tr.nombre`, params);

    const total_planilla = vv.reduce((s, v) => s + (v[7]||0), 0);
    res.json({
      desde, hasta, total_planilla,
      trabajadores: vv.map(v => ({
        id_trab:v[0], nombre:v[1], cargo:v[2], salario_base:v[3], cuadrilla:v[4],
        dias_trabajados:v[5], total_horas_extra:v[6], total_bruto:v[7]
      }))
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD FINANCIERO (KPIs)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();

    const oc_por_estado = rows(db, `
      SELECT estado, COUNT(*) as n, COALESCE(SUM(total),0) as monto
      FROM ordenes_compra GROUP BY estado`);

    const cp_resumen = rows(db, `
      SELECT COALESCE(SUM(monto_total),0) as total_facturas,
             COALESCE(SUM(monto_pagado),0) as total_pagado,
             COALESCE(SUM(saldo),0) as total_saldo,
             COUNT(*) FILTER (WHERE estado='pendiente') as pendientes,
             COUNT(*) FILTER (WHERE fecha_vence < date('now') AND estado != 'pagada') as vencidas
      FROM cuentas_pagar WHERE estado != 'anulada'`);

    const proveedores_activos = rows(db, 'SELECT COUNT(*) FROM proveedores WHERE activo=1');
    const trabajadores_activos = rows(db, 'SELECT COUNT(*) FROM trabajadores WHERE activo=1');

    const nomina_mes = rows(db, `
      SELECT COALESCE(SUM(
        CASE tipo_pago
          WHEN 'jornal'  THEN tr.salario_base + (td.horas_extra * (tr.salario_base/8.0) * 1.5)
          WHEN 'destajo' THEN td.monto_destajo
          WHEN 'hora'    THEN (td.horas_normales + td.horas_extra) * (tr.salario_base/8.0)
          ELSE 0
        END),0)
      FROM tareo_diario td JOIN trabajadores tr ON td.id_trab=tr.id_trab
      WHERE td.fecha >= date('now','start of month') AND td.asistio=1`);

    const gastos_categoria = rows(db, `
      SELECT categoria_gasto, COALESCE(SUM(monto_total),0) as total
      FROM cuentas_pagar WHERE estado != 'anulada'
      GROUP BY categoria_gasto ORDER BY total DESC`);

    res.json({
      oc_por_estado: oc_por_estado.map(v => ({ estado:v[0], count:v[1], monto:v[2] })),
      cuentas_pagar: cp_resumen.length ? {
        total_facturas: cp_resumen[0][0], total_pagado: cp_resumen[0][1],
        total_saldo: cp_resumen[0][2], pendientes: cp_resumen[0][3], vencidas: cp_resumen[0][4]
      } : {},
      proveedores_activos: proveedores_activos[0]?.[0] || 0,
      trabajadores_activos: trabajadores_activos[0]?.[0] || 0,
      nomina_mes_actual: nomina_mes[0]?.[0] || 0,
      gastos_por_categoria: gastos_categoria.map(v => ({ categoria:v[0], total:v[1] }))
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
