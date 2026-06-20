const express = require('express');
const router  = express.Router();
const { getDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const ExcelJS = require('exceljs');

// Paleta institucional
const C_BLUE  = 'FF025196';
const C_ORANGE= 'FFFDB338';
const C_WHITE = 'FFFFFFFF';
const C_LGRAY = 'FFF5F5F5';
const C_DGRAY = 'FFD4DBE3';
const C_LBLUE = 'FFEEF3F9';
const C_YELLOW= 'FFFFFF99';

function hdr(cell, bg=C_BLUE, color=C_WHITE, size=9) {
  cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:bg} };
  cell.font = { bold:true, color:{argb:color}, name:'Calibri', size };
  cell.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
  cell.border = {
    top:{style:'thin',color:{argb:C_DGRAY}},
    bottom:{style:'thin',color:{argb:C_DGRAY}},
    left:{style:'thin',color:{argb:C_DGRAY}},
    right:{style:'thin',color:{argb:C_DGRAY}}
  };
}

function dataCell(cell, align='left', size=9) {
  cell.font = { name:'Calibri', size };
  cell.alignment = { horizontal:align, vertical:'middle', wrapText:true };
  cell.border = {
    bottom:{style:'hair',color:{argb:C_DGRAY}},
    right:{style:'hair',color:{argb:C_DGRAY}}
  };
}

function moneyFmt(cell) {
  cell.numFmt = '#,##0.00';
  cell.alignment = { horizontal:'right', vertical:'middle' };
}

// ── Catálogo de financiadores ─────────────────────────────
const FINANCIADORES = {
  FHIS: {
    nombre: 'FHIS — Fondo Hondureño de Inversión Social',
    sigla: 'FHIS',
    color: 'FF003087',
    columnas: ['N°','CÓDIGO','DESCRIPCIÓN DE LA ACTIVIDAD','UNIDAD','CANTIDAD','P.UNITARIO (L)','MONTO TOTAL (L)'],
    anchos: [5,12,45,8,10,14,14],
    pie: 'Formulario de Oferta FHIS-BID. Precios incluyen mano de obra, materiales, equipo, transporte e impuestos.',
    seccionResumen: true
  },
  BCIE: {
    nombre: 'BCIE — Banco Centroamericano de Integración Económica',
    sigla: 'BCIE',
    color: 'FF00703C',
    columnas: ['ITEM','CÓDIGO','DESCRIPCIÓN','UNIDAD','CANT.','P.U. (L)','P.U. (USD)','TOTAL (L)','TOTAL (USD)'],
    anchos: [5,12,42,8,9,12,12,12,12],
    pie: 'Contrato BCIE. Tipo de cambio referencial BCH. Los precios en USD son referenciales.',
    seccionResumen: true,
    dualMoneda: true
  },
  BID: {
    nombre: 'BID — Banco Interamericano de Desarrollo',
    sigla: 'BID',
    color: 'FF0057A8',
    columnas: ['No.','CÓDIGO','DESCRIPCIÓN DE LA ACTIVIDAD','U/M','METRADO','PRECIO UNIT.','PARCIAL','% DEL TOTAL'],
    anchos: [5,12,43,8,10,13,13,10],
    pie: 'Presupuesto de Oferta — Contrato BID/FOMIN. Incluye todos los costos directos e indirectos.',
    seccionResumen: true,
    conPorcentaje: true
  },
  JICA: {
    nombre: 'JICA — Japan International Cooperation Agency',
    sigla: 'JICA',
    color: 'FF8B0000',
    columnas: ['No.','CODE','DESCRIPTION','UNIT','QUANTITY','UNIT PRICE (L)','AMOUNT (L)','REMARKS'],
    anchos: [5,12,42,8,10,13,13,15],
    pie: 'Bill of Quantities — JICA Grant Aid Project. Prices in Honduran Lempiras (HNL).',
    seccionResumen: true,
    enIngles: true
  },
  KFW: {
    nombre: 'KfW — Kreditanstalt für Wiederaufbau',
    sigla: 'KFW',
    color: 'FF004B87',
    columnas: ['Pos.','Código','Descripción de la Actividad','Ud.','Cant.','P.U. (€)','P.U. (L)','Total (L)','Total (€)'],
    anchos: [5,12,42,7,9,12,12,12,12],
    pie: 'Leistungsverzeichnis / Lista de Cantidades — KfW. Precios en EUR son referenciales (BCE).',
    seccionResumen: true,
    dualMoneda: true,
    monedaExt: 'EUR'
  },
  SANAA: {
    nombre: 'SANAA — Servicio Autónomo Nacional de Acueductos y Alcantarillados',
    sigla: 'SANAA',
    color: 'FF025196',
    columnas: ['N°','CÓDIGO','DESCRIPCIÓN DE LA ACTIVIDAD','UNIDAD','CANTIDAD','P.UNITARIO','TOTAL'],
    anchos: [5,12,45,8,10,13,13],
    pie: 'Presupuesto de Obras — Formato SANAA. Lempiras hondureños.',
    seccionResumen: true
  }
};

// ── GET: Lista de financiadores disponibles ───────────────
router.get('/financiadores', requireAuth, (req, res) => {
  const lista = Object.entries(FINANCIADORES).map(([key, f]) => ({
    id: key,
    nombre: f.nombre,
    sigla: f.sigla,
    color: '#' + f.color.substring(2)
  }));
  res.json(lista);
});

// ── GET: Presupuestos disponibles para plantillas ─────────
router.get('/presupuestos', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const r = db.exec(`
      SELECT pr.id_presupuesto, pr.nombre, pr.total_general, pr.fecha_creacion,
             pr.cliente, pr.ubicacion, pr.moneda
      FROM presupuestos pr
      WHERE pr.estado != 'archivado'
      ORDER BY pr.fecha_creacion DESC`);
    const rows = r.length ? r[0].values.map(v => ({
      id_presupuesto: v[0], nombre: v[1], total_general: v[2],
      fecha_creacion: v[3],
      cliente: v[4], ubicacion: v[5], moneda: v[6]
    })) : [];
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST: Generar plantilla Excel por financiador ─────────
router.post('/generar', requireAuth, async (req, res) => {
  try {
    const { id_presupuesto, financiador, tipo_cambio_usd, tipo_cambio_eur, incluir_desglose } = req.body;

    if (!id_presupuesto || !financiador) {
      return res.status(400).json({ error: 'Se requiere id_presupuesto y financiador' });
    }

    const fin = FINANCIADORES[financiador];
    if (!fin) return res.status(400).json({ error: 'Financiador no reconocido' });

    const db = await getDb();

    // Datos del presupuesto
    const presR = db.exec(`
      SELECT pr.id_presupuesto, pr.nombre, pr.costos_directos,
             pr.porcentaje_indirectos, pr.porcentaje_utilidad, pr.porcentaje_imprevistos,
             pr.costos_indirectos, pr.utilidad, pr.imprevistos, pr.total_general,
             pr.fecha_creacion,
             pr.cliente, pr.ubicacion, pr.moneda
      FROM presupuestos pr
      WHERE pr.id_presupuesto = ?`, [id_presupuesto]);

    if (!presR.length || !presR[0].values.length)
      return res.status(404).json({ error: 'Presupuesto no encontrado' });

    const pv = presR[0].values[0];
    const pres = {
      id: pv[0], nombre: pv[1], costos_directos: pv[2],
      pct_indirect: pv[3], pct_utilidad: pv[4], pct_imprevistos: pv[5],
      indirectos: pv[6], utilidad: pv[7], imprevistos: pv[8], total: pv[9],
      fecha: pv[10], cliente: pv[11], ubicacion: pv[12], moneda: pv[13]
    };

    // Módulos y actividades
    const capR = db.exec(
      'SELECT id_modulo, nombre, orden_visual FROM modulos WHERE id_presupuesto=? ORDER BY orden_visual, id_modulo',
      [id_presupuesto]);
    const caps = capR.length ? capR[0].values.map(v => ({ id:v[0], nombre:v[1], orden:v[2] })) : [];

    const parR = db.exec(`
      SELECT pp.id_partida, pp.id_modulo, pp.id_actividad,
             pp.cantidad, pp.precio_unitario, pp.subtotal,
             a.codigo, a.descripcion, a.unidad
      FROM presupuesto_partidas pp
      JOIN actividades a ON pp.id_actividad = a.id_actividad
      WHERE pp.id_presupuesto = ?
      ORDER BY pp.id_modulo, pp.id_partida`, [id_presupuesto]);
    const actividades = parR.length ? parR[0].values.map(v => ({
      id:v[0], id_cap:v[1], id_act:v[2],
      cantidad:v[3], pu:v[4], subtotal:v[5],
      codigo:v[6], desc:v[7], unidad:v[8]
    })) : [];

    const tcUSD = parseFloat(tipo_cambio_usd) || 25.0;
    const tcEUR = parseFloat(tipo_cambio_eur) || 27.5;

    // ── Generar Excel ──────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator = 'COSTOS UNITARIOS HN';
    wb.created = new Date();

    const ws = wb.addWorksheet(`Plantilla ${fin.sigla}`);
    ws.views = [{ showGridLines: false }];

    // Anchos de columna
    fin.anchos.forEach((w, i) => ws.getColumn(i+1).width = w);

    // ── ENCABEZADO ─────────────────────────────────────────
    const COL_END = String.fromCharCode(64 + fin.columnas.length); // Última columna

    // Fila logo/título
    let rn = 1;
    ws.mergeCells(`A${rn}:${COL_END}${rn}`);
    const tCell = ws.getRow(rn).getCell(1);
    tCell.value = `PRESUPUESTO DE OBRA — ${fin.nombre.toUpperCase()}`;
    tCell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:fin.color} };
    tCell.font = { bold:true, size:12, color:{argb:C_WHITE}, name:'Calibri' };
    tCell.alignment = { horizontal:'center', vertical:'middle' };
    ws.getRow(rn).height = 28;
    rn++;

    // Info del presupuesto
    const infoData = [
      [`Presupuesto: ${pres.nombre}`, `Cliente: ${pres.cliente || '—'}`, `Ubicación: ${pres.ubicacion || '—'}`],
      [`Fecha: ${new Date(pres.fecha).toLocaleDateString('es-HN')}`, '',
       fin.dualMoneda ? `T.C. USD: L ${tcUSD.toFixed(2)} | T.C. EUR: L ${tcEUR.toFixed(2)}` : `Moneda: ${pres.moneda}`]
    ];
    for (const row of infoData) {
      const nCols = fin.columnas.length;
      const third = Math.floor(nCols/3);
      ws.mergeCells(`A${rn}:${String.fromCharCode(64+third)}${rn}`);
      ws.mergeCells(`${String.fromCharCode(65+third)}${rn}:${String.fromCharCode(64+third*2)}${rn}`);
      ws.mergeCells(`${String.fromCharCode(65+third*2)}${rn}:${COL_END}${rn}`);
      const dr = ws.getRow(rn);
      dr.height = 16;
      [1, third+1, third*2+1].forEach((col, idx) => {
        const c = dr.getCell(col);
        c.value = row[idx];
        c.font = { name:'Calibri', size:9 };
        c.fill = { type:'pattern', pattern:'solid', fgColor:{argb:C_LBLUE} };
        c.alignment = { horizontal:'left', vertical:'middle' };
      });
      rn++;
    }
    ws.addRow([]);
    rn++;

    // ── CABECERA DE TABLA ─────────────────────────────────
    const hr = ws.getRow(rn);
    hr.height = 32;
    fin.columnas.forEach((col, i) => {
      const c = hr.getCell(i+1);
      c.value = col;
      hdr(c, fin.color);
    });
    rn++;

    // ── ACTIVIDADES ──────────────────────────────────────────
    let itemNum = 0;
    let capMap = {};
    caps.forEach(c => capMap[c.id] = c.nombre);

    // Calcular totales por módulo
    let totalGeneral = 0;
    const capTotales = {};
    actividades.forEach(p => {
      capTotales[p.id_cap] = (capTotales[p.id_cap] || 0) + p.subtotal;
      totalGeneral += p.subtotal;
    });

    // Agrupar por módulo
    const capIds = [...new Set(actividades.map(p => p.id_cap))];

    for (const capId of capIds) {
      const capNombre = capMap[capId] || `Módulo ${capId}`;
      const capParts = actividades.filter(p => p.id_cap === capId);

      // Fila de módulo
      ws.mergeCells(`A${rn}:${COL_END}${rn}`);
      const cr = ws.getRow(rn);
      cr.height = 18;
      const cc = cr.getCell(1);
      cc.value = capNombre.toUpperCase();
      cc.fill = { type:'pattern', pattern:'solid', fgColor:{argb:C_ORANGE} };
      cc.font = { bold:true, size:10, color:{argb:'FF333333'}, name:'Calibri' };
      cc.alignment = { horizontal:'left', vertical:'middle' };
      rn++;

      // Actividades del módulo
      capParts.forEach((p, idx) => {
        itemNum++;
        const dr = ws.getRow(rn);
        dr.height = 15;

        const tcExt = fin.monedaExt === 'EUR' ? tcEUR : tcUSD;

        if (financiador === 'BCIE') {
          const vals = [itemNum, p.codigo, p.desc, p.unidad, p.cantidad,
                        p.pu, p.pu/tcUSD, p.subtotal, p.subtotal/tcUSD];
          vals.forEach((v, i) => {
            const c = dr.getCell(i+1);
            c.value = v;
            dataCell(c, i>=4?'right':'left');
            if (i>=4) moneyFmt(c);
          });
        } else if (financiador === 'KFW') {
          const vals = [itemNum, p.codigo, p.desc, p.unidad, p.cantidad,
                        p.pu/tcEUR, p.pu, p.subtotal, p.subtotal/tcEUR];
          vals.forEach((v, i) => {
            const c = dr.getCell(i+1);
            c.value = v;
            dataCell(c, i>=4?'right':'left');
            if (i>=4) moneyFmt(c);
          });
        } else if (financiador === 'BID') {
          const pct = totalGeneral > 0 ? p.subtotal/totalGeneral : 0;
          const vals = [itemNum, p.codigo, p.desc, p.unidad, p.cantidad,
                        p.pu, p.subtotal, pct];
          vals.forEach((v, i) => {
            const c = dr.getCell(i+1);
            c.value = v;
            dataCell(c, i>=4?'right':'left');
            if (i>=4 && i<7) moneyFmt(c);
            if (i===7) { c.numFmt = '0.00%'; c.alignment={horizontal:'right',vertical:'middle'}; }
          });
        } else {
          // FHIS, BID básico, JICA, SANAA: N°,CÓDIGO,DESC,UNIDAD,CANT,PU,TOTAL [,REMARKS]
          const vals = [itemNum, p.codigo, p.desc, p.unidad, p.cantidad, p.pu, p.subtotal];
          if (fin.columnas.length > 7) vals.push('');
          vals.forEach((v, i) => {
            const c = dr.getCell(i+1);
            c.value = v;
            dataCell(c, i>=4?'right':'left');
            if (i>=4 && i<7) moneyFmt(c);
          });
        }

        // Zebra
        if (idx % 2 === 0) {
          dr.eachCell(c => {
            if (!c.fill || c.fill.fgColor?.argb === C_WHITE || !c.fill.fgColor?.argb)
              c.fill = { type:'pattern', pattern:'solid', fgColor:{argb:C_LGRAY} };
          });
        }
        rn++;
      });

      // Subtotal de módulo
      const str = ws.getRow(rn);
      str.height = 16;
      const nCols = fin.columnas.length;
      ws.mergeCells(`A${rn}:${String.fromCharCode(64+nCols-1)}${rn}`);
      const stc = str.getCell(1);
      stc.value = `SUBTOTAL — ${capNombre}`;
      stc.font = { bold:true, size:9, name:'Calibri', color:{argb:fin.color} };
      stc.alignment = { horizontal:'right', vertical:'middle' };
      stc.fill = { type:'pattern', pattern:'solid', fgColor:{argb:C_LBLUE} };
      const stv = str.getCell(nCols);
      stv.value = capTotales[capId];
      stv.fill = { type:'pattern', pattern:'solid', fgColor:{argb:C_LBLUE} };
      stv.font = { bold:true, size:9, name:'Calibri', color:{argb:fin.color} };
      moneyFmt(stv);
      rn++;
    }

    // ── RESUMEN DE COSTOS ─────────────────────────────────
    if (fin.seccionResumen) {
      ws.addRow([]); rn++;
      const nCols = fin.columnas.length;

      const resumenItems = [
        { label: 'A. COSTOS DIRECTOS', val: pres.costos_directos, bold: true },
        { label: `B. COSTOS INDIRECTOS (${pres.pct_indirect}%)`, val: pres.indirectos, bold: false },
        { label: `C. UTILIDAD (${pres.pct_utilidad}%)`, val: pres.utilidad, bold: false },
        { label: `D. IMPREVISTOS (${pres.pct_imprevistos}%)`, val: pres.imprevistos, bold: false },
        { label: 'TOTAL GENERAL DEL PRESUPUESTO', val: pres.total, bold: true, highlight: true },
      ];

      if (fin.dualMoneda) {
        const tc = fin.monedaExt === 'EUR' ? tcEUR : tcUSD;
        const extLabel = fin.monedaExt === 'EUR' ? 'EUR' : 'USD';
        resumenItems.push({
          label: `TOTAL REFERENCIAL EN ${extLabel} (T.C. L ${tc.toFixed(2)})`,
          val: pres.total / tc, bold: true, highlight: false, ext: true
        });
      }

      for (const item of resumenItems) {
        ws.mergeCells(`A${rn}:${String.fromCharCode(64+nCols-1)}${rn}`);
        const rr = ws.getRow(rn);
        rr.height = 18;
        const lc = rr.getCell(1);
        lc.value = item.label;
        lc.font = { bold: item.bold, size: 10, name:'Calibri',
                    color:{argb: item.highlight ? C_WHITE : (item.ext ? 'FF444444' : '333333')} };
        lc.alignment = { horizontal:'right', vertical:'middle' };
        if (item.highlight)
          lc.fill = { type:'pattern', pattern:'solid', fgColor:{argb:fin.color} };
        else if (item.ext)
          lc.fill = { type:'pattern', pattern:'solid', fgColor:{argb:C_DGRAY} };

        const vc = rr.getCell(nCols);
        vc.value = item.val;
        moneyFmt(vc);
        vc.font = { bold: item.bold, size: 10, name:'Calibri',
                    color:{argb: item.highlight ? C_WHITE : '333333'} };
        if (item.highlight)
          vc.fill = { type:'pattern', pattern:'solid', fgColor:{argb:fin.color} };
        else if (item.ext)
          vc.fill = { type:'pattern', pattern:'solid', fgColor:{argb:C_DGRAY} };
        rn++;
      }
    }

    // ── PIE DE PÁGINA ─────────────────────────────────────
    ws.addRow([]); rn++;
    ws.mergeCells(`A${rn}:${COL_END}${rn}`);
    const pc = ws.getRow(rn).getCell(1);
    pc.value = fin.pie;
    pc.font = { italic:true, size:8, color:{argb:'FF666666'}, name:'Calibri' };
    pc.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
    ws.getRow(rn).height = 20;

    // ── Hoja de desglose de insumos (opcional) ────────────
    if (incluir_desglose) {
      const ws2 = wb.addWorksheet('Desglose de Insumos');
      ws2.views = [{ showGridLines: false }];
      [8,12,38,8,10,13,13].forEach((w,i)=>ws2.getColumn(i+1).width=w);

      ws2.mergeCells('A1:G1');
      const dt = ws2.getRow(1).getCell(1);
      dt.value = `DESGLOSE DE INSUMOS — ${pres.nombre}`;
      dt.fill = { type:'pattern', pattern:'solid', fgColor:{argb:fin.color} };
      dt.font = { bold:true, size:11, color:{argb:C_WHITE}, name:'Calibri' };
      dt.alignment = { horizontal:'center', vertical:'middle' };
      ws2.getRow(1).height = 24;

      const dhr = ws2.getRow(2);
      ['Categoría','Código','Descripción','Unidad','Cant. Total','P. Unitario','Total'].forEach((h,i)=>{
        hdr(dhr.getCell(i+1), fin.color);
        dhr.getCell(i+1).value = h;
      });
      dhr.height = 20;

      // Agregar insumos sumados de todas las actividades
      const insumoMap = {};
      for (const p of actividades) {
        const aiR = db.exec(`
          SELECT ai.id_insumo, i.codigo, i.descripcion, i.unidad,
                 c.nombre as categoria,
                 ai.cantidad * ? as cant_total,
                 i.precio_unitario,
                 ai.cantidad * ? * i.precio_unitario as total
          FROM actividad_insumos ai
          JOIN insumos i ON ai.id_insumo = i.id_insumo
          JOIN categorias_insumo c ON i.id_categoria = c.id_categoria
          WHERE ai.id_actividad = ?`, [p.cantidad, p.cantidad, p.id_act]);
        if (aiR.length && aiR[0].values.length) {
          for (const r of aiR[0].values) {
            const key = r[0];
            if (!insumoMap[key]) {
              insumoMap[key] = { cat:r[4], codigo:r[1], desc:r[2], unidad:r[3], cant:0, pu:r[6], total:0 };
            }
            insumoMap[key].cant += r[5];
            insumoMap[key].total += r[7];
          }
        }
      }

      const insumos = Object.values(insumoMap).sort((a,b) => a.cat.localeCompare(b.cat) || a.desc.localeCompare(b.desc));
      let lastCat = '';
      insumos.forEach((ins, idx) => {
        if (ins.cat !== lastCat) {
          const cr2 = ws2.addRow([ins.cat, '', '', '', '', '', '']);
          ws2.mergeCells(`A${cr2.number}:G${cr2.number}`);
          cr2.getCell(1).fill = { type:'pattern', pattern:'solid', fgColor:{argb:C_ORANGE} };
          cr2.getCell(1).font = { bold:true, size:9, name:'Calibri' };
          lastCat = ins.cat;
        }
        const dr2 = ws2.addRow(['', ins.codigo, ins.desc, ins.unidad,
                                 ins.cant, ins.pu, ins.total]);
        dr2.height = 14;
        [5,6,7].forEach(i => { moneyFmt(dr2.getCell(i)); });
        dr2.getCell(5).numFmt = '#,##0.000';
        if (idx%2===0) dr2.eachCell(c => {
          if (!c.fill?.fgColor?.argb || c.fill.fgColor.argb===C_WHITE)
            c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_LGRAY}};
        });
      });
    }

    // ── Enviar archivo ────────────────────────────────────
    const fname = `Plantilla_${fin.sigla}_${pres.nombre.replace(/\s+/g,'_').substring(0,30)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    await wb.xlsx.write(res);
    res.end();

  } catch(e) {
    console.error('Error generando plantilla:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
