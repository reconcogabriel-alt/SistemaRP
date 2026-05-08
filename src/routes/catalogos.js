const express = require('express');
const router  = express.Router();
const { getDb, saveDb } = require('../db/database');
const { requireAuth }   = require('../middleware/auth');
const ExcelJS = require('exceljs');

const C_BLUE='FF025196', C_ORANGE='FFFDB338', C_WHITE='FFFFFFFF',
      C_LGRAY='FFF5F5F5', C_DGRAY='FFD4DBE3';

// ── GET todos los catálogos ────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const r = db.exec(`
      SELECT c.id_catalogo, c.nombre, c.descripcion, c.ubicacion, c.es_base, c.fecha_creacion,
             COUNT(d.id_detalle) as num_precios
      FROM catalogos_precios c
      LEFT JOIN catalogo_precios_detalle d ON c.id_catalogo = d.id_catalogo
      GROUP BY c.id_catalogo ORDER BY c.es_base DESC, c.nombre`);
    const rows = r.length ? r[0].values.map(v => ({
      id_catalogo: v[0], nombre: v[1], descripcion: v[2], ubicacion: v[3],
      es_base: v[4], fecha_creacion: v[5], num_precios: v[6]
    })) : [];
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET catálogo con sus precios ───────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const catR = db.exec(
      'SELECT id_catalogo,nombre,descripcion,ubicacion,es_base,fecha_creacion FROM catalogos_precios WHERE id_catalogo=?',
      [req.params.id]);
    if (!catR.length || !catR[0].values.length) return res.status(404).json({ error: 'No encontrado' });
    const [id,nombre,desc,ub,base,fecha] = catR[0].values[0];

    // Todos los insumos + precio en este catálogo (o 0 si no tiene)
    const detalleR = db.exec(`
      SELECT i.id_insumo, i.codigo, i.descripcion, i.unidad, c.nombre as cat,
             i.precio_unitario as precio_base,
             COALESCE(d.precio_unitario, 0) as precio_catalogo,
             d.fuente, d.fecha_actualizacion,
             CASE WHEN d.id_detalle IS NOT NULL THEN 1 ELSE 0 END as tiene_precio_local
      FROM insumos i
      JOIN categorias_insumo c ON i.id_categoria = c.id_categoria
      LEFT JOIN catalogo_precios_detalle d
        ON d.id_insumo = i.id_insumo AND d.id_catalogo = ?
      WHERE i.activo = 1
      ORDER BY c.id_categoria, i.descripcion`, [req.params.id]);

    const insumos = detalleR.length ? detalleR[0].values.map(v => ({
      id_insumo: v[0], codigo: v[1], descripcion: v[2], unidad: v[3], categoria: v[4],
      precio_base: v[5], precio_catalogo: v[6], fuente: v[7],
      fecha_actualizacion: v[8], tiene_precio_local: v[9]
    })) : [];

    // Precio efectivo = precio_catalogo si tiene_precio_local, sino precio_base
    insumos.forEach(i => {
      i.precio_efectivo = i.tiene_precio_local ? i.precio_catalogo : i.precio_base;
    });

    res.json({ catalogo: {id_catalogo:id,nombre,descripcion:desc,ubicacion:ub,es_base:base,fecha_creacion:fecha}, insumos });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST crear catálogo ────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const { nombre, descripcion, ubicacion, clonar_de } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    const db = await getDb();
    db.run(`INSERT INTO catalogos_precios (nombre, descripcion, ubicacion, es_base) VALUES (?,?,?,0)`,
      [nombre, descripcion||'', ubicacion||'']);
    const r = db.exec('SELECT last_insert_rowid()');
    const newId = r[0].values[0][0];

    // Clonar precios de otro catálogo si se indica
    if (clonar_de) {
      const src = db.exec(
        'SELECT id_insumo, precio_unitario, fuente FROM catalogo_precios_detalle WHERE id_catalogo=?',
        [clonar_de]);
      if (src.length && src[0].values.length) {
        for (const [idIns, precio, fuente] of src[0].values) {
          db.run(`INSERT OR IGNORE INTO catalogo_precios_detalle (id_catalogo, id_insumo, precio_unitario, fuente)
                  VALUES (?,?,?,?)`, [newId, idIns, precio, fuente ? `Clonado de cat.${clonar_de}` : '']);
        }
      }
    }
    saveDb();
    res.json({ ok: true, id: newId });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PUT editar catálogo ────────────────────────────────────
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { nombre, descripcion, ubicacion } = req.body;
    const db = await getDb();
    db.run(`UPDATE catalogos_precios SET nombre=?, descripcion=?, ubicacion=? WHERE id_catalogo=?`,
      [nombre, descripcion||'', ubicacion||'', req.params.id]);
    saveDb();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE catálogo (no base) ──────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const chk = db.exec('SELECT es_base FROM catalogos_precios WHERE id_catalogo=?', [req.params.id]);
    if (chk.length && chk[0].values[0][0]) return res.status(400).json({ error: 'No se puede eliminar el catálogo base' });
    // Verificar si algún proyecto lo usa
    const enUso = db.exec('SELECT COUNT(*) FROM proyectos WHERE id_catalogo=?', [req.params.id]);
    if (enUso.length && enUso[0].values[0][0] > 0)
      return res.status(400).json({ error: 'El catálogo está asignado a uno o más proyectos' });
    db.run('DELETE FROM catalogo_precios_detalle WHERE id_catalogo=?', [req.params.id]);
    db.run('DELETE FROM catalogos_precios WHERE id_catalogo=?', [req.params.id]);
    saveDb();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PUT precio individual en catálogo ─────────────────────
router.put('/:id/insumos/:idIns', requireAuth, async (req, res) => {
  try {
    const { precio_unitario, fuente } = req.body;
    const db = await getDb();
    const idCat = req.params.id;
    const idIns = req.params.idIns;

    // Historial
    const prev = db.exec(
      'SELECT precio_unitario FROM catalogo_precios_detalle WHERE id_catalogo=? AND id_insumo=?',
      [idCat, idIns]);
    if (prev.length && prev[0].values.length) {
      db.run(`INSERT INTO catalogo_historial_precios (id_catalogo, id_insumo, precio_anterior, precio_nuevo)
              VALUES (?,?,?,?)`, [idCat, idIns, prev[0].values[0][0], precio_unitario]);
    }

    db.run(`INSERT INTO catalogo_precios_detalle (id_catalogo, id_insumo, precio_unitario, fuente, fecha_actualizacion)
            VALUES (?,?,?,?,date('now'))
            ON CONFLICT(id_catalogo, id_insumo) DO UPDATE SET
              precio_unitario=excluded.precio_unitario,
              fuente=excluded.fuente,
              fecha_actualizacion=excluded.fecha_actualizacion`,
      [idCat, idIns, precio_unitario, fuente||'Manual']);
    saveDb();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE precio local (volver al precio base) ────────────
router.delete('/:id/insumos/:idIns', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    db.run('DELETE FROM catalogo_precios_detalle WHERE id_catalogo=? AND id_insumo=?',
      [req.params.id, req.params.idIns]);
    saveDb();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET precio efectivo de un insumo en proyecto ───────────
// Usado por presupuestos al calcular costos
router.get('/proyecto/:idProyecto/precio/:idInsumo', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const proy = db.exec('SELECT id_catalogo FROM proyectos WHERE id_proyecto=?', [req.params.idProyecto]);
    const idCat = proy.length && proy[0].values.length ? proy[0].values[0][0] : null;

    let precio = null;
    if (idCat) {
      const loc = db.exec(
        'SELECT precio_unitario FROM catalogo_precios_detalle WHERE id_catalogo=? AND id_insumo=?',
        [idCat, req.params.idInsumo]);
      if (loc.length && loc[0].values.length) precio = loc[0].values[0][0];
    }
    if (precio === null) {
      const base = db.exec('SELECT precio_unitario FROM insumos WHERE id_insumo=?', [req.params.idInsumo]);
      precio = base.length && base[0].values.length ? base[0].values[0][0] : 0;
    }
    res.json({ precio_efectivo: precio });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST asignar catálogo a proyecto ──────────────────────
router.post('/asignar-proyecto', requireAuth, async (req, res) => {
  try {
    const { id_proyecto, id_catalogo } = req.body;
    const db = await getDb();
    db.run('UPDATE proyectos SET id_catalogo=? WHERE id_proyecto=?', [id_catalogo||null, id_proyecto]);
    saveDb();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET costo unitario de actividad con precios de proyecto ─
router.get('/proyecto/:idProyecto/actividad/:idActividad/costo', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const { idProyecto, idActividad } = req.params;

    // Obtener catálogo del proyecto
    const proyR = db.exec('SELECT id_catalogo FROM proyectos WHERE id_proyecto=?', [idProyecto]);
    const idCat = proyR.length && proyR[0].values.length ? proyR[0].values[0][0] : null;

    // Insumos de la actividad
    const ins = db.exec(`
      SELECT ai.id_detalle, ai.id_insumo, ai.cantidad, ai.rendimiento, ai.desperdicio,
             i.descripcion, i.unidad, i.precio_unitario as precio_base, c.nombre as cat
      FROM actividad_insumos ai
      JOIN insumos i ON ai.id_insumo = i.id_insumo
      JOIN categorias_insumo c ON i.id_categoria = c.id_categoria
      WHERE ai.id_actividad = ?`, [idActividad]);

    if (!ins.length || !ins[0].values.length) return res.json({ costo_total: 0, detalles: [] });

    let total = 0;
    const detalles = [];
    for (const [detId, idIns, cant, rend, desp, desc, unid, precioBase, cat] of ins[0].values) {
      // Precio local del catálogo del proyecto, sino precio base
      let precio = precioBase;
      if (idCat) {
        const loc = db.exec(
          'SELECT precio_unitario FROM catalogo_precios_detalle WHERE id_catalogo=? AND id_insumo=?',
          [idCat, idIns]);
        if (loc.length && loc[0].values.length) precio = loc[0].values[0][0];
      }
      const cp = (cant / (rend||1)) * (1 + (desp||0)/100) * precio;
      total += cp;
      detalles.push({ id_insumo: idIns, descripcion: desc, unidad: unid,
        cantidad: cant, rendimiento: rend, desperdicio: desp,
        precio_efectivo: precio, precio_base: precioBase,
        usa_precio_local: precio !== precioBase, categoria: cat, costo_parcial: cp });
    }
    res.json({ costo_total: total, id_catalogo: idCat, detalles });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST importar precios masivos desde JSON ───────────────
// Body: { precios: [{id_insumo, precio_unitario, fuente}] }
router.post('/:id/importar', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const { precios } = req.body;
    if (!Array.isArray(precios)) return res.status(400).json({ error: 'precios debe ser array' });
    let ok = 0, err = 0;
    for (const p of precios) {
      try {
        db.run(`INSERT INTO catalogo_precios_detalle (id_catalogo, id_insumo, precio_unitario, fuente, fecha_actualizacion)
                VALUES (?,?,?,?,date('now'))
                ON CONFLICT(id_catalogo, id_insumo) DO UPDATE SET
                  precio_unitario=excluded.precio_unitario,
                  fuente=excluded.fuente,
                  fecha_actualizacion=excluded.fecha_actualizacion`,
          [req.params.id, p.id_insumo, p.precio_unitario, p.fuente||'Importado']);
        ok++;
      } catch(e2) { err++; }
    }
    saveDb();
    res.json({ ok: true, actualizados: ok, errores: err });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET Excel de cotización por catálogo ───────────────────
router.get('/:id/cotizacion-excel', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const filtro = req.query.filtro || 'sin_precio'; // todos | sin_precio | con_precio

    const catR = db.exec('SELECT nombre, ubicacion FROM catalogos_precios WHERE id_catalogo=?', [req.params.id]);
    if (!catR.length || !catR[0].values.length) return res.status(404).json({ error: 'No encontrado' });
    const [catNombre, catUb] = catR[0].values[0];

    let whereFiltro = '';
    if (filtro === 'sin_precio') whereFiltro = 'AND (d.precio_unitario IS NULL OR d.precio_unitario = 0) AND (i.precio_unitario = 0 OR i.precio_unitario IS NULL)';
    if (filtro === 'con_precio') whereFiltro = 'AND (COALESCE(d.precio_unitario, i.precio_unitario) > 0)';

    const insR = db.exec(`
      SELECT i.id_insumo, i.codigo, i.descripcion, i.unidad, cat.nombre as categoria,
             i.precio_unitario as precio_base,
             COALESCE(d.precio_unitario, 0) as precio_local,
             CASE WHEN d.id_detalle IS NOT NULL THEN 1 ELSE 0 END as tiene_local,
             d.fuente,
             (SELECT COUNT(DISTINCT ai.id_actividad) FROM actividad_insumos ai WHERE ai.id_insumo=i.id_insumo) as num_acts
      FROM insumos i
      JOIN categorias_insumo cat ON i.id_categoria = cat.id_categoria
      LEFT JOIN catalogo_precios_detalle d ON d.id_insumo=i.id_insumo AND d.id_catalogo=?
      WHERE i.activo=1 ${whereFiltro}
      ORDER BY cat.id_categoria, i.descripcion`, [req.params.id]);

    const insumos = insR.length ? insR[0].values : [];

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('COTIZACIÓN');
    ws.views = [{ showGridLines: false }];
    [6,16,46,9,14,16,18,18,22,10].forEach((w,i)=>ws.getColumn(i+1).width=w);

    // Título
    const rT = ws.addRow([`LISTA DE COTIZACIÓN — ${catNombre} (${catUb})`]);
    ws.mergeCells(`A1:J1`); rT.height=28;
    Object.assign(rT.getCell(1), {
      fill:{type:'pattern',pattern:'solid',fgColor:{argb:C_BLUE}},
      font:{bold:true,size:13,color:{argb:C_WHITE},name:'Calibri'},
      alignment:{horizontal:'center',vertical:'middle'}
    });

    // Info
    ws.addRow([`Catálogo: ${catNombre}`,,,`Ubicación: ${catUb}`,,,`Fecha: ${new Date().toLocaleDateString('es-HN')}`,,,`Total: ${insumos.length} insumos`]);
    ws.mergeCells(`A2:C2`); ws.mergeCells(`D2:F2`); ws.mergeCells(`G2:I2`); ws.mergeCells(`J2:J2`);
    ws.lastRow.eachCell(c=>c.font={size:9,italic:true,name:'Calibri',color:{argb:'FF555555'}});

    // Instrucción
    const rI = ws.addRow(['📝 Completa las columnas amarillas: "PRECIO COTIZADO" y "Proveedor". Las columnas azules son de referencia.',,,,,,,,,]);
    ws.mergeCells(`A3:J3`);
    rI.getCell(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF3CD'}};
    rI.getCell(1).font={size:9,name:'Calibri',color:{argb:'FF856404'}};

    ws.addRow([]);

    // Header
    const hdr = ws.addRow(['No.','Código','Descripción','Unidad','Categoría','P. Base (L)','P. Local Actual (L)','PRECIO COTIZADO (L)','Proveedor / Observación','Acts.']);
    hdr.height=20;
    hdr.eachCell((c,col)=>{
      const amarillo = col===8||col===9;
      c.fill={type:'pattern',pattern:'solid',fgColor:{argb:amarillo?C_ORANGE:C_BLUE}};
      c.font={bold:true,size:10,color:{argb:amarillo?'FF333333':C_WHITE},name:'Calibri'};
      c.alignment={horizontal:'center',vertical:'middle',wrapText:true};
      c.border={bottom:{style:'thin',color:{argb:C_DGRAY}}};
    });

    let lastCat=null, n=1;
    for(const [idI,cod,desc,unid,cat,precioBase,precioLocal,tieneLocal,fuente,numActs] of insumos) {
      if(cat!==lastCat){
        const cr=ws.addRow([cat]);
        ws.mergeCells(`A${cr.number}:J${cr.number}`);
        cr.getCell(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:C_ORANGE}};
        cr.getCell(1).font={bold:true,size:11,name:'Calibri',color:{argb:'FF1A3353'}};
        cr.height=17; lastCat=cat;
      }
      const even=n%2===0;
      const dr=ws.addRow([n++, cod||'—', desc, unid, cat, precioBase||'', tieneLocal?precioLocal:'', '', '', numActs||'']);

      dr.eachCell((c,col)=>{
        if(even&&col!==8&&col!==9) c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF5F8FC'}};
        c.font={size:9,name:'Calibri'};
        c.border={bottom:{style:'hair',color:{argb:C_DGRAY}}};
      });

      // P.Base
      const cB=dr.getCell(6);
      if(precioBase>0){cB.numFmt='"L "#,##0.00';cB.font={size:9,name:'Calibri',color:{argb:'FF1E6B31'}};}
      else{cB.value='—';cB.font={size:9,name:'Calibri',color:{argb:'FFAAAAAA'}};}

      // P.Local
      const cL=dr.getCell(7);
      if(tieneLocal&&precioLocal>0){
        cL.numFmt='"L "#,##0.00';
        cL.font={size:9,name:'Calibri',bold:true,color:{argb:'FF025196'}};
      }else{cL.value='';cL.font={size:9,name:'Calibri',color:{argb:'FFAAAAAA'}};}

      // Celda editable cotización
      const cC=dr.getCell(8);
      cC.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFFDE7'}};
      cC.numFmt='"L "#,##0.00';
      cC.border={top:{style:'thin',color:{argb:'FFDDCC44'}},bottom:{style:'thin',color:{argb:'FFDDCC44'}},
                 left:{style:'medium',color:{argb:'FFDDCC44'}},right:{style:'medium',color:{argb:'FFDDCC44'}}};

      // Celda proveedor
      const cP=dr.getCell(9);
      cP.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFFDE7'}};
      cP.border={top:{style:'thin',color:{argb:'FFDDCC44'}},bottom:{style:'thin',color:{argb:'FFDDCC44'}},
                 right:{style:'medium',color:{argb:'FFDDCC44'}}};

      // Acts
      const cA=dr.getCell(10);
      cA.alignment={horizontal:'center'};
      if(numActs>0) cA.font={size:9,bold:true,name:'Calibri',
        color:{argb:numActs>=10?'FFCC0000':numActs>=5?'FFDD6B20':'FF1A3353'}};
    }

    ws.addRow([]);
    const rN=ws.addRow(['Referencia: CHICO Boletín IV-2025 / Larach y Cía / EPA Honduras. Precios en Lempiras (HNL). "Acts." = actividades del catálogo afectadas por cada insumo.']);
    ws.mergeCells(`A${rN.number}:J${rN.number}`);
    rN.getCell(1).font={size:8,italic:true,color:{argb:'FF777777'},name:'Calibri'};
    rN.getCell(1).alignment={wrapText:true}; rN.height=24;

    const fname=`Cotizacion_${catNombre.replace(/[^a-zA-Z0-9]/g,'_')}_${new Date().toISOString().substring(0,10)}.xlsx`;
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename=${fname}`);
    await wb.xlsx.write(res);
  } catch(e){ console.error(e); res.status(500).json({error:e.message}); }
});

module.exports = router;
