const express = require('express');
const router  = express.Router();
const { getDb, saveDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const ExcelJS = require('exceljs');

const C_BLUE='FF025196', C_ORANGE='FFFDB338', C_WHITE='FFFFFFFF',
      C_LGRAY='FFF5F5F5', C_DGRAY='FFD4DBE3', C_LBLUE='FFEEF3F9',
      C_GREEN='FF00703C', C_RED='FFCC0000', C_YELLOW='FFFFFF99';

// ── Migraciones de tablas ─────────────────────────────────
async function ensureTables() {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS requisiciones (
    id_req       INTEGER PRIMARY KEY AUTOINCREMENT,
    numero       TEXT NOT NULL,
    id_presupuesto  INTEGER NOT NULL,
    solicitante  TEXT,
    fecha_req    TEXT DEFAULT (date('now')),
    fecha_req_entrega TEXT,
    estado       TEXT DEFAULT 'pendiente'
                 CHECK(estado IN ('pendiente','aprobada','parcial','completa','anulada')),
    notas        TEXT,
    fecha_creacion TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (id_presupuesto) REFERENCES presupuestos(id_presupuesto)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS requisicion_items (
    id_item      INTEGER PRIMARY KEY AUTOINCREMENT,
    id_req       INTEGER NOT NULL,
    id_insumo    INTEGER NOT NULL,
    cantidad_req REAL NOT NULL,
    unidad       TEXT,
    notas        TEXT,
    FOREIGN KEY (id_req) REFERENCES requisiciones(id_req),
    FOREIGN KEY (id_insumo) REFERENCES insumos(id_insumo)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS bodega_movimientos (
    id_mov       INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo         TEXT NOT NULL CHECK(tipo IN ('entrada','salida','ajuste')),
    id_insumo    INTEGER NOT NULL,
    id_presupuesto  INTEGER,
    id_req       INTEGER,
    cantidad     REAL NOT NULL,
    precio_unitario REAL DEFAULT 0,
    total        REAL DEFAULT 0,
    referencia   TEXT,
    proveedor    TEXT,
    notas        TEXT,
    fecha_mov    TEXT DEFAULT (date('now')),
    fecha_creacion TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (id_insumo) REFERENCES insumos(id_insumo),
    FOREIGN KEY (id_presupuesto) REFERENCES presupuestos(id_presupuesto),
    FOREIGN KEY (id_req) REFERENCES requisiciones(id_req)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS bodega_stock (
    id_stock     INTEGER PRIMARY KEY AUTOINCREMENT,
    id_insumo    INTEGER UNIQUE NOT NULL,
    cantidad_actual REAL DEFAULT 0,
    ultima_actualizacion TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (id_insumo) REFERENCES insumos(id_insumo)
  )`);
  saveDb();
}

// ── Generar número de requisición ─────────────────────────
async function nextNumReq(db) {
  const r = db.exec("SELECT COUNT(*) FROM requisiciones");
  const n = r.length ? (r[0].values[0][0] + 1) : 1;
  const y = new Date().getFullYear();
  return `REQ-${y}-${String(n).padStart(4,'0')}`;
}

// ── Actualizar stock ──────────────────────────────────────
async function actualizarStock(db, id_insumo, cantidad, tipo) {
  const mult = tipo === 'entrada' ? 1 : tipo === 'salida' ? -1 : 0;
  const exist = db.exec('SELECT id_stock, cantidad_actual FROM bodega_stock WHERE id_insumo=?', [id_insumo]);
  if (exist.length && exist[0].values.length) {
    const [id_stock, current] = exist[0].values[0];
    const nueva = current + cantidad * mult;
    db.run('UPDATE bodega_stock SET cantidad_actual=?, ultima_actualizacion=datetime("now") WHERE id_stock=?',
           [nueva, id_stock]);
  } else {
    db.run('INSERT INTO bodega_stock (id_insumo, cantidad_actual) VALUES (?,?)',
           [id_insumo, Math.max(0, cantidad * mult)]);
  }
}

// ── REQUISICIONES ─────────────────────────────────────────

// GET todas las requisiciones
router.get('/requisiciones', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const { id_presupuesto, estado } = req.query;
    let where = '1=1';
    const params = [];
    if (id_presupuesto) { where += ' AND r.id_presupuesto=?'; params.push(id_presupuesto); }
    if (estado)      { where += ' AND r.estado=?';      params.push(estado); }

    const rr = db.exec(`
      SELECT r.id_req, r.numero, r.id_presupuesto, p.nombre as presupuesto,
             r.solicitante, r.fecha_req, r.fecha_req_entrega, r.estado,
             r.notas, r.fecha_creacion,
             COUNT(ri.id_item) as num_items
      FROM requisiciones r
      JOIN presupuestos p ON r.id_presupuesto = p.id_presupuesto
      LEFT JOIN requisicion_items ri ON ri.id_req = r.id_req
      WHERE ${where}
      GROUP BY r.id_req
      ORDER BY r.fecha_creacion DESC`, params);

    const rows = rr.length ? rr[0].values.map(v => ({
      id_req:v[0], numero:v[1], id_presupuesto:v[2], presupuesto:v[3],
      solicitante:v[4], fecha_req:v[5], fecha_req_entrega:v[6],
      estado:v[7], notas:v[8], fecha_creacion:v[9], num_items:v[10]
    })) : [];
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET detalle de una requisición
router.get('/requisiciones/:id', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const rr = db.exec(`
      SELECT r.id_req, r.numero, r.id_presupuesto, p.nombre as presupuesto,
             r.solicitante, r.fecha_req, r.fecha_req_entrega, r.estado, r.notas
      FROM requisiciones r
      JOIN presupuestos p ON r.id_presupuesto = p.id_presupuesto
      WHERE r.id_req=?`, [req.params.id]);
    if (!rr.length || !rr[0].values.length)
      return res.status(404).json({ error: 'Requisición no encontrada' });
    const v = rr[0].values[0];
    const req_data = {
      id_req:v[0], numero:v[1], id_presupuesto:v[2], presupuesto:v[3],
      solicitante:v[4], fecha_req:v[5], fecha_req_entrega:v[6], estado:v[7], notas:v[8]
    };

    const ir = db.exec(`
      SELECT ri.id_item, ri.id_insumo, i.codigo, i.descripcion, i.unidad,
             ri.cantidad_req, ri.notas,
             COALESCE(bs.cantidad_actual, 0) as stock_actual
      FROM requisicion_items ri
      JOIN insumos i ON ri.id_insumo = i.id_insumo
      LEFT JOIN bodega_stock bs ON bs.id_insumo = ri.id_insumo
      WHERE ri.id_req=?`, [req.params.id]);
    const items = ir.length ? ir[0].values.map(v => ({
      id_item:v[0], id_insumo:v[1], codigo:v[2], descripcion:v[3], unidad:v[4],
      cantidad_req:v[5], notas:v[6], stock_actual:v[7]
    })) : [];

    res.json({ requisicion: req_data, items });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST crear requisición
router.post('/requisiciones', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const { id_presupuesto, solicitante, fecha_req_entrega, notas, items } = req.body;
    if (!id_presupuesto || !items?.length)
      return res.status(400).json({ error: 'Se requiere id_presupuesto e items' });

    const numero = await nextNumReq(db);
    db.run(`INSERT INTO requisiciones (numero, id_presupuesto, solicitante, fecha_req_entrega, notas)
            VALUES (?,?,?,?,?)`,
           [numero, id_presupuesto, solicitante||'', fecha_req_entrega||null, notas||'']);
    const idReq = db.exec('SELECT last_insert_rowid()')[0].values[0][0];

    for (const item of items) {
      db.run(`INSERT INTO requisicion_items (id_req, id_insumo, cantidad_req, notas)
              VALUES (?,?,?,?)`,
             [idReq, item.id_insumo, item.cantidad, item.notas||'']);
    }
    saveDb();
    res.json({ ok: true, id_req: idReq, numero });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PATCH cambiar estado de requisición
router.patch('/requisiciones/:id/estado', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const { estado } = req.body;
    const valid = ['pendiente','aprobada','parcial','completa','anulada'];
    if (!valid.includes(estado))
      return res.status(400).json({ error: 'Estado no válido' });
    db.run('UPDATE requisiciones SET estado=? WHERE id_req=?', [estado, req.params.id]);
    saveDb();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE anular requisición
router.delete('/requisiciones/:id', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    db.run("UPDATE requisiciones SET estado='anulada' WHERE id_req=?", [req.params.id]);
    saveDb();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── BODEGA — MOVIMIENTOS ──────────────────────────────────

// GET stock actual
router.get('/stock', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const r = db.exec(`
      SELECT i.id_insumo, i.codigo, i.descripcion, i.unidad,
             c.nombre as categoria, i.precio_unitario,
             COALESCE(bs.cantidad_actual, 0) as stock,
             COALESCE(bs.cantidad_actual, 0) * i.precio_unitario as valor_stock,
             bs.ultima_actualizacion
      FROM insumos i
      JOIN categorias_insumo c ON i.id_categoria = c.id_categoria
      LEFT JOIN bodega_stock bs ON bs.id_insumo = i.id_insumo
      WHERE i.activo=1
      ORDER BY c.id_categoria, i.descripcion`);
    const rows = r.length ? r[0].values.map(v => ({
      id_insumo:v[0], codigo:v[1], descripcion:v[2], unidad:v[3],
      categoria:v[4], precio_unitario:v[5],
      stock:v[6], valor_stock:v[7], ultima_actualizacion:v[8]
    })) : [];
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET movimientos (con filtros opcionales)
router.get('/movimientos', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const { tipo, id_presupuesto, desde, hasta, limit } = req.query;
    let where = '1=1';
    const params = [];
    if (tipo)       { where += ' AND m.tipo=?';           params.push(tipo); }
    if (id_presupuesto){ where += ' AND m.id_presupuesto=?';    params.push(id_presupuesto); }
    if (desde)      { where += ' AND m.fecha_mov>=?';     params.push(desde); }
    if (hasta)      { where += ' AND m.fecha_mov<=?';     params.push(hasta); }

    const lim = parseInt(limit) || 200;
    const r = db.exec(`
      SELECT m.id_mov, m.tipo, m.id_insumo, i.codigo, i.descripcion, i.unidad,
             m.id_presupuesto, p.nombre as presupuesto,
             m.id_req, r.numero as req_numero,
             m.cantidad, m.precio_unitario, m.total,
             m.referencia, m.proveedor, m.notas, m.fecha_mov, m.fecha_creacion
      FROM bodega_movimientos m
      JOIN insumos i ON m.id_insumo = i.id_insumo
      LEFT JOIN presupuestos p ON m.id_presupuesto = p.id_presupuesto
      LEFT JOIN requisiciones r ON m.id_req = r.id_req
      WHERE ${where}
      ORDER BY m.fecha_creacion DESC
      LIMIT ${lim}`, params);
    const rows = r.length ? r[0].values.map(v => ({
      id_mov:v[0], tipo:v[1], id_insumo:v[2], codigo:v[3], descripcion:v[4], unidad:v[5],
      id_presupuesto:v[6], presupuesto:v[7],
      id_req:v[8], req_numero:v[9],
      cantidad:v[10], precio_unitario:v[11], total:v[12],
      referencia:v[13], proveedor:v[14], notas:v[15],
      fecha_mov:v[16], fecha_creacion:v[17]
    })) : [];
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST registrar movimiento
router.post('/movimientos', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const { tipo, id_insumo, id_presupuesto, id_req, cantidad,
            precio_unitario, referencia, proveedor, notas, fecha_mov } = req.body;

    if (!tipo || !id_insumo || !cantidad)
      return res.status(400).json({ error: 'tipo, id_insumo y cantidad son requeridos' });

    const pu = parseFloat(precio_unitario) || 0;
    const total = parseFloat(cantidad) * pu;

    db.run(`INSERT INTO bodega_movimientos
            (tipo, id_insumo, id_presupuesto, id_req, cantidad, precio_unitario, total,
             referencia, proveedor, notas, fecha_mov)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
           [tipo, id_insumo, id_presupuesto||null, id_req||null,
            parseFloat(cantidad), pu, total,
            referencia||'', proveedor||'', notas||'',
            fecha_mov || new Date().toISOString().split('T')[0]]);
    const newId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];

    // Actualizar stock
    await actualizarStock(db, id_insumo, parseFloat(cantidad), tipo);
    saveDb();

    res.json({ ok: true, id_mov: newId, total });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── REPORTE EXCEL DE BODEGA ───────────────────────────────
router.get('/reporte-excel', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();

    const wb = new ExcelJS.Workbook();
    wb.creator = 'COSTOS UNITARIOS HN';

    // Hoja 1: Stock actual
    const ws1 = wb.addWorksheet('Stock Actual');
    ws1.views = [{ showGridLines: false }];
    [12,10,38,8,16,12,12,16].forEach((w,i)=>ws1.getColumn(i+1).width=w);

    ws1.mergeCells('A1:H1');
    const t1 = ws1.getRow(1).getCell(1);
    t1.value = `INVENTARIO DE BODEGA — ${new Date().toLocaleDateString('es-HN')}`;
    t1.fill = { type:'pattern', pattern:'solid', fgColor:{argb:C_BLUE} };
    t1.font = { bold:true, size:12, color:{argb:C_WHITE}, name:'Calibri' };
    t1.alignment = { horizontal:'center', vertical:'middle' };
    ws1.getRow(1).height = 26;

    const h1 = ws1.getRow(2);
    ['Categoría','Código','Descripción','Unidad','Precio Unit. (L)','Stock','Valor Stock (L)','Última Mov.'].forEach((h,i) => {
      h1.getCell(i+1).value = h;
      const fill = i===5 ? C_GREEN : C_BLUE;
      h1.getCell(i+1).fill = { type:'pattern', pattern:'solid', fgColor:{argb:fill} };
      h1.getCell(i+1).font = { bold:true, size:9, color:{argb:C_WHITE}, name:'Calibri' };
      h1.getCell(i+1).alignment = { horizontal:'center', vertical:'middle', wrapText:true };
      h1.getCell(i+1).border = { bottom:{style:'thin',color:{argb:C_DGRAY}} };
    });
    h1.height = 24;

    const stockR = db.exec(`
      SELECT i.codigo, i.descripcion, i.unidad, c.nombre,
             i.precio_unitario, COALESCE(bs.cantidad_actual,0),
             COALESCE(bs.cantidad_actual,0)*i.precio_unitario,
             bs.ultima_actualizacion
      FROM insumos i JOIN categorias_insumo c ON i.id_categoria=c.id_categoria
      LEFT JOIN bodega_stock bs ON bs.id_insumo=i.id_insumo
      WHERE i.activo=1 ORDER BY c.id_categoria, i.descripcion`);

    if (stockR.length) {
      let lastCat = '';
      stockR[0].values.forEach(([cod,desc,unid,cat,pu,stock,valor,fecha], idx) => {
        if (cat !== lastCat) {
          const cr = ws1.addRow([cat,'','','','','','','']);
          ws1.mergeCells(`A${cr.number}:H${cr.number}`);
          cr.getCell(1).fill = { type:'pattern', pattern:'solid', fgColor:{argb:C_ORANGE} };
          cr.getCell(1).font = { bold:true, size:9, name:'Calibri' };
          lastCat = cat;
        }
        const dr = ws1.addRow(['', cod, desc, unid, pu, stock, valor, fecha||'—']);
        dr.height = 14;
        dr.getCell(5).numFmt = '#,##0.00'; dr.getCell(5).alignment={horizontal:'right',vertical:'middle'};
        dr.getCell(6).numFmt = '#,##0.000'; dr.getCell(6).alignment={horizontal:'right',vertical:'middle'};
        dr.getCell(7).numFmt = '#,##0.00'; dr.getCell(7).alignment={horizontal:'right',vertical:'middle'};
        // Resaltar stock en 0
        if (stock === 0) {
          dr.getCell(6).fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFFFE0E0'} };
          dr.getCell(6).font = { color:{argb:C_RED}, bold:true, size:9, name:'Calibri' };
        }
        if (idx%2===0) [2,3,4,5,7,8].forEach(i => {
          const c = dr.getCell(i);
          if (!c.fill?.fgColor?.argb || c.fill.fgColor.argb===C_WHITE)
            c.fill = { type:'pattern', pattern:'solid', fgColor:{argb:C_LGRAY} };
        });
      });
    }

    // Hoja 2: Movimientos recientes
    const ws2 = wb.addWorksheet('Movimientos');
    ws2.views = [{ showGridLines: false }];
    [9,10,10,32,8,10,12,12,15,12,20].forEach((w,i)=>ws2.getColumn(i+1).width=w);

    ws2.mergeCells('A1:K1');
    const t2 = ws2.getRow(1).getCell(1);
    t2.value = 'REGISTRO DE MOVIMIENTOS DE BODEGA';
    t2.fill = { type:'pattern', pattern:'solid', fgColor:{argb:C_BLUE} };
    t2.font = { bold:true, size:12, color:{argb:C_WHITE}, name:'Calibri' };
    t2.alignment = { horizontal:'center', vertical:'middle' };
    ws2.getRow(1).height = 24;

    const h2 = ws2.getRow(2);
    ['Fecha','Tipo','Código','Descripción','Unidad','Cantidad','P.Unit (L)','Total (L)','Referencia','Presupuesto','Notas'].forEach((h,i) => {
      h2.getCell(i+1).value = h;
      const bg = h==='Tipo'?C_ORANGE:C_BLUE;
      h2.getCell(i+1).fill = { type:'pattern', pattern:'solid', fgColor:{argb:bg} };
      h2.getCell(i+1).font = { bold:true, size:9, color:{argb:h==='Tipo'?'FF333333':C_WHITE}, name:'Calibri' };
      h2.getCell(i+1).alignment = { horizontal:'center', vertical:'middle', wrapText:true };
    });
    h2.height = 22;

    const movR = db.exec(`
      SELECT m.fecha_mov, m.tipo, i.codigo, i.descripcion, i.unidad,
             m.cantidad, m.precio_unitario, m.total,
             m.referencia, COALESCE(p.nombre,'—'), m.notas
      FROM bodega_movimientos m
      JOIN insumos i ON m.id_insumo=i.id_insumo
      LEFT JOIN presupuestos p ON m.id_presupuesto=p.id_presupuesto
      ORDER BY m.fecha_creacion DESC LIMIT 500`);

    if (movR.length) {
      movR[0].values.forEach(([fecha,tipo,cod,desc,unid,cant,pu,total,ref,proy,notas], idx) => {
        const dr = ws2.addRow([fecha,tipo,cod,desc,unid,cant,pu,total,ref,proy,notas]);
        dr.height = 14;
        dr.getCell(6).numFmt='#,##0.000'; dr.getCell(6).alignment={horizontal:'right',vertical:'middle'};
        dr.getCell(7).numFmt='#,##0.00'; dr.getCell(7).alignment={horizontal:'right',vertical:'middle'};
        dr.getCell(8).numFmt='#,##0.00'; dr.getCell(8).alignment={horizontal:'right',vertical:'middle'};
        // Color por tipo
        const tipoBg = tipo==='entrada'?'FFE8F5E9':tipo==='salida'?'FFFFE8E8':'FFFFF8E1';
        dr.getCell(2).fill = { type:'pattern', pattern:'solid', fgColor:{argb:tipoBg.replace('#','')} };
        dr.getCell(2).font = { bold:true, size:9, name:'Calibri',
          color:{argb: tipo==='entrada'?C_GREEN:tipo==='salida'?C_RED:'FF8B6914'} };
        if (idx%2===0) [1,3,4,5,9,10,11].forEach(i => {
          dr.getCell(i).fill = { type:'pattern', pattern:'solid', fgColor:{argb:C_LGRAY} };
        });
      });
    }

    const fname = `Reporte_Bodega_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── REPORTE PDF-DATA de Requisición ──────────────────────
router.get('/requisiciones/:id/pdf-data', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const rr = db.exec(`
      SELECT r.numero, r.solicitante, r.fecha_req, r.fecha_req_entrega,
             r.estado, r.notas, p.nombre as presupuesto, p.cliente
      FROM requisiciones r
      JOIN presupuestos p ON r.id_presupuesto=p.id_presupuesto
      WHERE r.id_req=?`, [req.params.id]);
    if (!rr.length || !rr[0].values.length)
      return res.status(404).json({ error: 'No encontrada' });
    const [numero,solicit,fecha,fechaEnt,estado,notas,presupuesto,cliente] = rr[0].values[0];

    const ir = db.exec(`
      SELECT i.codigo, i.descripcion, i.unidad, ri.cantidad_req, ri.notas
      FROM requisicion_items ri
      JOIN insumos i ON ri.id_insumo=i.id_insumo
      WHERE ri.id_req=?`, [req.params.id]);
    const items = ir.length ? ir[0].values.map(v=>({
      codigo:v[0], descripcion:v[1], unidad:v[2], cantidad:v[3], notas:v[4]
    })) : [];

    res.json({ numero, solicitante:solicit, fecha_req:fecha, fecha_entrega:fechaEnt,
               estado, notas, presupuesto, cliente, items });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Excel de una requisición ──────────────────────────────
router.get('/requisiciones/:id/excel', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const db = await getDb();
    const rr = db.exec(`
      SELECT r.numero, r.solicitante, r.fecha_req, r.fecha_req_entrega,
             r.estado, r.notas, p.nombre as presupuesto, p.cliente, p.ubicacion
      FROM requisiciones r
      JOIN presupuestos p ON r.id_presupuesto=p.id_presupuesto
      WHERE r.id_req=?`, [req.params.id]);
    if (!rr.length || !rr[0].values.length)
      return res.status(404).json({ error: 'No encontrada' });
    const [numero,solicit,fecha,fechaEnt,estado,notas,presupuesto,cliente,ubi] = rr[0].values[0];

    const ir = db.exec(`
      SELECT i.codigo, i.descripcion, i.unidad, ri.cantidad_req, ri.notas,
             i.precio_unitario,
             ri.cantidad_req * i.precio_unitario as total_est
      FROM requisicion_items ri
      JOIN insumos i ON ri.id_insumo=i.id_insumo
      WHERE ri.id_req=?`, [req.params.id]);
    const items = ir.length ? ir[0].values : [];

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Requisición');
    ws.views = [{ showGridLines: false }];
    [10,38,8,10,14,14,20].forEach((w,i)=>ws.getColumn(i+1).width=w);

    // Encabezado
    ws.mergeCells('A1:G1');
    const tit = ws.getRow(1).getCell(1);
    tit.value = `REQUISICIÓN DE MATERIALES — ${numero}`;
    tit.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_BLUE}};
    tit.font={bold:true,size:13,color:{argb:C_WHITE},name:'Calibri'};
    tit.alignment={horizontal:'center',vertical:'middle'};
    ws.getRow(1).height=28;

    const info = [
      [`Presupuesto: ${presupuesto}`, `Cliente: ${cliente||'—'}`, `Estado: ${estado.toUpperCase()}`],
      [`Solicitante: ${solicit||'—'}`, `Fecha: ${fecha}`, `Fecha req. entrega: ${fechaEnt||'—'}`]
    ];
    info.forEach(row => {
      ws.mergeCells(`A${ws.rowCount+1}:C${ws.rowCount+1}`);
      ws.mergeCells(`D${ws.rowCount}:E${ws.rowCount}`);
      ws.mergeCells(`F${ws.rowCount}:G${ws.rowCount}`);
      const r = ws.lastRow;
      r.height=16;
      [1,4,6].forEach((col,idx)=>{
        const c=r.getCell(col);
        c.value=row[idx];
        c.font={name:'Calibri',size:9};
        c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_LBLUE}};
        c.alignment={horizontal:'left',vertical:'middle'};
      });
    });
    ws.addRow([]);

    // Cabecera de tabla
    const hr = ws.addRow(['Código','Descripción','Unidad','Cantidad','P.Unit. Est.','Total Est. (L)','Notas']);
    hr.height=20;
    hr.eachCell((c,i)=>{
      c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_BLUE}};
      c.font={bold:true,size:9,color:{argb:C_WHITE},name:'Calibri'};
      c.alignment={horizontal:i>=4?'center':'left',vertical:'middle'};
    });

    let totalEst = 0;
    items.forEach(([cod,desc,unid,cant,notas,pu,tot], idx)=>{
      totalEst += tot||0;
      const dr = ws.addRow([cod,desc,unid,cant,pu||0,tot||0,notas||'']);
      dr.height=14;
      dr.getCell(5).numFmt='#,##0.00'; dr.getCell(5).alignment={horizontal:'right',vertical:'middle'};
      dr.getCell(6).numFmt='#,##0.00'; dr.getCell(6).alignment={horizontal:'right',vertical:'middle'};
      dr.getCell(4).alignment={horizontal:'center',vertical:'middle'};
      if(idx%2===0) [1,2,3,7].forEach(i=>dr.getCell(i).fill={type:'pattern',pattern:'solid',fgColor:{argb:C_LGRAY}});
    });

    // Total
    ws.addRow([]);
    ws.mergeCells(`A${ws.rowCount+1}:E${ws.rowCount+1}`);
    const totRow = ws.addRow(['','','','','TOTAL ESTIMADO',totalEst,'']);
    ws.mergeCells(`A${totRow.number}:E${totRow.number}`);
    totRow.getCell(1).value='TOTAL ESTIMADO (L)';
    totRow.getCell(1).font={bold:true,size:10,color:{argb:C_WHITE},name:'Calibri'};
    totRow.getCell(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:C_BLUE}};
    totRow.getCell(1).alignment={horizontal:'right',vertical:'middle'};
    totRow.getCell(6).value=totalEst;
    totRow.getCell(6).numFmt='#,##0.00';
    totRow.getCell(6).font={bold:true,size:10,color:{argb:C_WHITE},name:'Calibri'};
    totRow.getCell(6).fill={type:'pattern',pattern:'solid',fgColor:{argb:C_BLUE}};
    totRow.getCell(6).alignment={horizontal:'right',vertical:'middle'};
    totRow.height=20;

    if (notas) {
      ws.addRow([]);
      ws.mergeCells(`A${ws.rowCount+1}:G${ws.rowCount+1}`);
      const nr = ws.addRow([`Notas: ${notas}`]);
      nr.getCell(1).font={italic:true,size:8,name:'Calibri',color:{argb:'FF666666'}};
      nr.getCell(1).alignment={wrapText:true};
      nr.height=18;
    }

    const fname = `Requisicion_${numero}.xlsx`;
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename="${fname}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
