const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const ExcelJS = require('exceljs');

const C_BLUE='FF025196', C_ORANGE='FFFDB338', C_WHITE='FFFFFFFF', C_LGRAY='FFF5F5F5', C_DGRAY='FFD4DBE3', C_BLUE2='FF3D78B5', C_LBLUE='FFEEF3F9', C_INFO='FFBDD7EE';

function hdr(cell, bg=C_BLUE, color=C_WHITE) {
  cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:bg}};
  cell.font={bold:true,color:{argb:color},name:'Calibri',size:10};
  cell.alignment={horizontal:'center',vertical:'middle',wrapText:true};
  cell.border={bottom:{style:'thin',color:{argb:C_DGRAY}}};
}
function titleBlock(ws,text,cols='G',h=32) {
  const rn=ws.rowCount+1;
  ws.mergeCells(`A${rn}:${cols}${rn}`);
  const r=ws.getRow(rn); r.height=h;
  const c=r.getCell(1);
  c.value=text;
  c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_BLUE}};
  c.font={bold:true,size:13,color:{argb:C_WHITE},name:'Calibri'};
  c.alignment={horizontal:'center',vertical:'middle'};
  return r;
}
function secTitle(ws,text,cols='C') {
  const rn=ws.rowCount+1;
  ws.mergeCells(`A${rn}:${cols}${rn}`);
  const r=ws.getRow(rn);r.height=18;
  const c=r.getCell(1);
  c.value=text;
  c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_INFO}};
  c.font={bold:true,size:11,name:'Calibri',color:{argb:C_BLUE}};
  c.alignment={horizontal:'left',vertical:'middle'};
  return r;
}
function stripeRow(dr,even) {
  if(even) dr.eachCell(c=>c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_LGRAY}});
  dr.eachCell(c=>{c.font={size:9,name:'Calibri'};c.border={bottom:{style:'hair',color:{argb:C_DGRAY}}};});
}

// ── DASHBOARD ──────────────────────────────────────────────
router.get('/dashboard', requireAuth, async (req,res)=>{
  try {
    const db=await getDb();
    const N=q=>db.exec(q)[0].values[0][0];
    const presupuestosActivos=N("SELECT COUNT(*) FROM presupuestos WHERE estado='activo'");
    const insumos=N('SELECT COUNT(*) FROM insumos WHERE activo=1');
    const actividades=N('SELECT COUNT(*) FROM actividades');
    const presupuestos=N('SELECT COUNT(*) FROM presupuestos');
    const totalPresup=N('SELECT COALESCE(SUM(total_general),0) FROM presupuestos');
    const recR=db.exec(`SELECT id_presupuesto,nombre,cliente,ubicacion,estado,total_general FROM presupuestos ORDER BY id_presupuesto DESC LIMIT 6`);
    const hpR=db.exec(`SELECT i.descripcion,hp.precio_anterior,hp.precio_nuevo,hp.fecha_cambio FROM historial_precios hp JOIN insumos i ON hp.id_insumo=i.id_insumo ORDER BY hp.fecha_cambio DESC LIMIT 5`);
    res.json({
      stats:{presupuestosActivos,insumos,actividades,presupuestos,totalPresup},
      presupuestosRecientes:recR.length?recR[0].values.map(r=>({id:r[0],nombre:r[1],cliente:r[2],ubicacion:r[3],estado:r[4],monto_total:r[5]})): [],
      cambiosPrecios:hpR.length?hpR[0].values.map(r=>({descripcion:r[0],precio_anterior:r[1],precio_nuevo:r[2],fecha_cambio:r[3]})):[]
    });
  }catch(e){res.status(500).json({error:e.message});}
});

// ── HELPER: obtener datos de presupuesto (nombre, cliente, ubicacion, moneda, porcentajes) ──
async function getPres(db,id){
  const r=db.exec(`SELECT nombre, cliente, ubicacion, moneda,
    porcentaje_indirectos, porcentaje_utilidad, porcentaje_imprevistos
    FROM presupuestos WHERE id_presupuesto=?`,[id]);
  return r.length&&r[0].values.length?r[0].values[0]:null;
}

// ── HELPER: leer datos completos de empresa desde configuración ──────
async function getEmpresa(db) {
  const get = (clave) => {
    try {
      const r = db.exec('SELECT valor FROM configuracion_sistema WHERE clave=?', [clave]);
      if (r.length && r[0].values.length && r[0].values[0][0]) return r[0].values[0][0];
    } catch(e) {}
    return '';
  };
  return {
    nombre:    get('empresa_nombre'),
    subtitulo: get('empresa_subtitulo'),
    rtn:       get('empresa_rtn'),
    telefono:  get('empresa_telefono'),
    correo:    get('empresa_correo'),
    direccion: get('empresa_direccion'),
  };
}

// Helper: agregar fila de datos de empresa en un Excel, debajo del titleBlock
function empresaRow(ws, emp, mostrarFecha, colsStr) {
  if (!emp || !emp.nombre) return;
  const partes = [];
  if (emp.nombre)    partes.push(emp.nombre);
  if (emp.rtn)       partes.push('RTN: ' + emp.rtn);
  if (emp.telefono)  partes.push(emp.telefono);
  if (emp.correo)    partes.push(emp.correo);
  if (emp.direccion) partes.push(emp.direccion);
  if (mostrarFecha)  partes.push('Fecha: ' + new Date().toLocaleDateString('es-HN'));
  if (!partes.length) return;
  const rn = ws.rowCount + 1;
  ws.mergeCells('A' + rn + ':' + colsStr + rn);
  const r = ws.getRow(rn); r.height = 14;
  const c = r.getCell(1);
  c.value = partes.join('   |   ');
  c.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF3D78B5' } };
  c.font = { size:9, name:'Calibri', color:{ argb:'FFFFFFFF' } };
  c.alignment = { horizontal:'right', vertical:'middle' };
}

async function getDatosEmpresa(db) {
  const claves = ['empresa_nombre','empresa_subtitulo','empresa_rtn','empresa_telefono','empresa_correo','empresa_direccion'];
  const datos = {};
  try {
    const r = db.exec('SELECT clave, valor FROM configuracion_sistema WHERE clave IN (' + claves.map(()=>'?').join(',') + ')', claves);
    if (r.length && r[0].values.length) {
      r[0].values.forEach(([k,v]) => { datos[k] = v || ''; });
    }
  } catch(e) {}
  return {
    nombre:    datos.empresa_nombre    || '',
    subtitulo: datos.empresa_subtitulo || '',
    rtn:       datos.empresa_rtn       || '',
    telefono:  datos.empresa_telefono  || '',
    correo:    datos.empresa_correo    || '',
    direccion: datos.empresa_direccion || '',
  };
}

// ── HELPER: leer mostrar_fecha desde configuración ──────────
async function getMostrarFecha(db) {
  try {
    const r = db.exec("SELECT valor FROM configuracion_sistema WHERE clave='reporte_mostrar_fecha'");
    if (r.length && r[0].values.length) return r[0].values[0][0] !== '0';
  } catch(e) {}
  return false;
}


// ── REPORTE: FICHAS DE COSTOS POR PRESUPUESTO (Excel) ────────
router.get('/presupuesto/:id/fichas', requireAuth, async (req,res)=>{
  try{
    const db=await getDb();
    const pr=await getPres(db,req.params.id);
    if(!pr) return res.status(404).json({error:'Presupuesto no encontrado'});
    const [pN,pC,pU,pM,pctInd,pctUtil,pctImpr]=pr;
    const empresa=await getEmpresa(db);
    const mostrarFecha=await getMostrarFecha(db);

    const actsR=db.exec(
      `SELECT a.id_actividad,a.codigo,a.descripcion,a.unidad,a.costo_total,pp.cantidad
       FROM presupuesto_partidas pp
       JOIN actividades a ON pp.id_actividad=a.id_actividad
       WHERE pp.id_presupuesto=? ORDER BY a.codigo`,
      [req.params.id]);
    if(!actsR.length||!actsR[0].values.length)
      return res.status(400).json({error:'Sin actividades en este presupuesto'});

    const wb=new ExcelJS.Workbook();
    const ws=wb.addWorksheet('FICHAS');
    ws.views=[{showGridLines:false}];
    [14,38,8,11,11,10,14,14,12].forEach((w,i)=>ws.getColumn(i+1).width=w);

    titleBlock(ws,'FICHAS DE COSTOS UNITARIOS — '+pN,'I',32);
    empresaRow(ws, empresa, mostrarFecha, 'I1');
    const inf=ws.addRow(['Cliente: '+(pC||'—'),,,,'Ubicación: '+(pU||'—'),,,
      'Moneda: '+pM+(mostrarFecha?' | Fecha: '+new Date().toLocaleDateString('es-HN'):''),'']);
    inf.eachCell(c=>{c.font={size:9,name:'Calibri'};});
    ws.addRow(['Presupuesto: '+pN+' | Precios de referencia: CHICO / Larach y Cía Honduras 2025-2026']);
    ws.mergeCells('A'+ws.rowCount+':I'+ws.rowCount);
    ws.lastRow.getCell(1).font={size:8,italic:true,color:{argb:'FF888888'},name:'Calibri'};
    ws.addRow([]);

    for(const [aId,aCod,aDesc,aUnid,aTotal,aCant] of actsR[0].values){
      const cant=Number(aCant||1);
      ws.addRow([]);
      const ar=ws.addRow([aCod,aDesc,,,,
        'Unidad: '+aUnid+' | Cantidad: '+cant.toFixed(2),,
        pM+' '+Number(aTotal).toFixed(2),'']);
      ws.mergeCells('B'+ar.number+':E'+ar.number);
      ar.height=20;
      ['A','B','F','G','H'].forEach(col=>{
        const c=ar.getCell(col);
        c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_BLUE}};
        c.font={bold:true,size:10,color:{argb:C_WHITE},name:'Calibri'};
        c.alignment={vertical:'middle'};
      });

      const hr=ws.addRow(['Cód.Insumo','Descripción','Unid','Cant.Unit.','Cant.Pres.','Desp%',
        'P.Unit.('+pM+')','C.Parcial('+pM+')','Tipo']);
      hr.height=16; hr.eachCell(c=>hdr(c,C_ORANGE,'FF333333'));

      const dR=db.exec(
        `SELECT ai.cantidad,ai.rendimiento,ai.desperdicio,ai.costo_parcial,
                i.codigo,i.descripcion,i.unidad,i.precio_unitario,c.nombre,c.id_categoria
         FROM actividad_insumos ai
         JOIN insumos i ON ai.id_insumo=i.id_insumo
         JOIN categorias_insumo c ON i.id_categoria=c.id_categoria
         WHERE ai.id_actividad=? ORDER BY c.id_categoria,i.descripcion`,
        [aId]);

      if(dR.length&&dR[0].values.length){
        let lastCat=null,catT=0,rowI=0;
        for(const [iCant,rend,desp,cp,iCod,iDesc,iUnid,iP,iCat] of dR[0].values){
          if(iCat!==lastCat){
            if(lastCat!==null){
              const st=ws.addRow(['SUBTOTAL '+lastCat,,,,,,,catT,'']);
              ws.mergeCells('A'+st.number+':G'+st.number);
              st.getCell('H').numFmt='"'+pM+' "#,##0.00';
              st.eachCell(c=>{c.font={bold:true,size:9,name:'Calibri',color:{argb:C_BLUE}};
                c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_LBLUE}};});
              catT=0;
            }
            const ch=ws.addRow(['▸ '+iCat,,,,,,,,]);
            ws.mergeCells('A'+ch.number+':I'+ch.number);
            ch.getCell(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:C_LBLUE}};
            ch.getCell(1).font={bold:true,size:10,name:'Calibri',color:{argb:C_BLUE}};
            lastCat=iCat;
          }
          rowI++;
          const dr=ws.addRow([iCod,iDesc,iUnid,iCant,cant,desp+'%',iP,cp,iCat]);
          dr.getCell(4).numFmt='#,##0.0000';
          dr.getCell(5).numFmt='#,##0.00';
          dr.getCell(5).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF8DC'}};
          dr.getCell(5).font={bold:true,size:9,name:'Calibri',color:{argb:'FF333333'}};
          dr.getCell(7).numFmt='"'+pM+' "#,##0.00';
          dr.getCell(8).numFmt='"'+pM+' "#,##0.00';
          stripeRow(dr,rowI%2===0);
          dr.getCell(1).font={size:9,name:'Calibri',color:{argb:C_BLUE},bold:true};
          catT+=Number(cp);
        }
        if(lastCat!==null){
          const st=ws.addRow(['SUBTOTAL '+lastCat,,,,,,,catT,'']);
          ws.mergeCells('A'+st.number+':G'+st.number);
          st.getCell('H').numFmt='"'+pM+' "#,##0.00';
          st.eachCell(c=>{c.font={bold:true,size:9,name:'Calibri',color:{argb:C_BLUE}};
            c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_LBLUE}};});
        }
      }

      // Fila: Costo Directo Unitario
      const tr=ws.addRow(['COSTO DIRECTO UNITARIO — '+aCod,,,,,aUnid,,aTotal,'']);
      ws.mergeCells('A'+tr.number+':E'+tr.number);
      tr.getCell('H').numFmt='"'+pM+' "#,##0.00'; tr.height=18;
      tr.eachCell(c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_BLUE}};
        c.font={bold:true,size:10,color:{argb:C_WHITE},name:'Calibri'};
        c.alignment={vertical:'middle'};});

      // Resumen con cantidad y subtotal del presupuesto
      const pI=Number(pctInd||15), pU2=Number(pctUtil||10), pIm=Number(pctImpr||5);
      const cd=Number(aTotal);
      const ci=cd*pI/100, ut=cd*pU2/100, im=cd*pIm/100, totU=cd+ci+ut+im;
      ws.addRow([]);
      const sumHdr=ws.addRow([
        'Resumen de costos — Cant: '+cant.toFixed(2)+' '+aUnid,
        ,,,,'','P. Unitario','Subtotal (x'+cant.toFixed(2)+')','']);
      sumHdr.eachCell(c=>{
        c.font={bold:true,size:9,name:'Calibri',color:{argb:C_WHITE}};
        c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF8C9BAD'}};});

      [
        ['Costos Directos',           cd,  cd*cant],
        ['Costos Indirectos ('+pI+'%)',ci,  ci*cant],
        ['Utilidad ('+pU2+'%)',        ut,  ut*cant],
        ['Imprevistos ('+pIm+'%)',     im,  im*cant],
        ['TOTAL GENERAL',             totU, totU*cant],
      ].forEach(([lbl,pu,sub],i)=>{
        const rr=ws.addRow([lbl,,,,,,'',pu,sub,'']);
        rr.getCell(8).numFmt='"'+pM+' "#,##0.00';
        rr.getCell(9).numFmt='"'+pM+' "#,##0.00';
        if(i===4){
          rr.eachCell(c=>{
            c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_BLUE}};
            c.font={bold:true,size:11,color:{argb:C_WHITE},name:'Calibri'};});
        } else if(i%2===0){
          rr.eachCell(c=>{
            if(c.value||c.value===0)
              c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_LBLUE}};});
        }
      });
    }

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition','attachment; filename=Fichas_Pres_'+req.params.id+'.xlsx');
    await wb.xlsx.write(res);
  }catch(e){console.error(e);res.status(500).json({error:e.message});}
});

// ── REPORTE: INSUMOS POR PRESUPUESTO (Excel) ─────────────────
router.get('/presupuesto/:id/insumos', requireAuth, async (req,res)=>{
  try{
    const db=await getDb();
    const pr=await getPres(db,req.params.id);
    if(!pr) return res.status(404).json({error:'Presupuesto no encontrado'});
    const [pN,pC,pU,pM]=pr;
    const empresa=await getEmpresa(db);
    const mostrarFecha=await getMostrarFecha(db);

    const iR=db.exec(
      `SELECT c.nombre,i.codigo,i.descripcion,i.unidad,i.precio_unitario,
              SUM(ai.cantidad*pp.cantidad) as qt,
              SUM(ai.costo_parcial*pp.cantidad) as ct
       FROM presupuesto_partidas pp
       JOIN actividad_insumos ai ON pp.id_actividad=ai.id_actividad
       JOIN insumos i ON ai.id_insumo=i.id_insumo
       JOIN categorias_insumo c ON i.id_categoria=c.id_categoria
       WHERE pp.id_presupuesto=?
       GROUP BY i.id_insumo ORDER BY c.id_categoria,i.descripcion`,
      [req.params.id]);

    const wb=new ExcelJS.Workbook();
    const ws=wb.addWorksheet('INSUMOS');
    ws.views=[{showGridLines:false}];
    [14,10,44,9,15,16,18].forEach((w,i)=>ws.getColumn(i+1).width=w);

    titleBlock(ws,'LISTADO DE INSUMOS — '+pN,'G',30);
    empresaRow(ws, empresa, mostrarFecha, 'G1');
    ws.addRow(['Cliente: '+(pC||'—'),,,
      mostrarFecha?'Fecha: '+new Date().toLocaleDateString('es-HN'):'',,,''
    ]).eachCell(c=>c.font={size:9,name:'Calibri'});
    ws.addRow(['Presupuesto: '+pN]).eachCell(c=>c.font={size:9,italic:true,name:'Calibri'});
    ws.addRow([]);

    const hr=ws.addRow(['Categoría','Código','Descripción','Unidad',
      'P.Unit('+pM+')','Cantidad Total','Costo Total('+pM+')']);
    hr.height=20; hr.eachCell(c=>hdr(c));

    let lastC=null,cSub=0,grand=0,ri=0;
    if(iR.length&&iR[0].values.length){
      for(const [cat,cod,desc,unid,precio,qt,ct] of iR[0].values){
        if(cat!==lastC){
          if(lastC!==null){
            const sr=ws.addRow(['SUBTOTAL '+lastC,,,,,,cSub]);
            ws.mergeCells('A'+sr.number+':F'+sr.number);
            sr.getCell(7).numFmt='"'+pM+' "#,##0.00';
            sr.eachCell(c=>{c.font={bold:true,size:9,name:'Calibri',color:{argb:C_BLUE}};
              c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_LBLUE}};});
            cSub=0; ws.addRow([]);
          }
          const cr=ws.addRow([cat]);
          ws.mergeCells('A'+cr.number+':G'+cr.number);
          cr.getCell(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:C_ORANGE}};
          cr.getCell(1).font={bold:true,size:10,name:'Calibri',color:{argb:'FF333333'}};
          cr.height=18; lastC=cat;
        }
        ri++;
        const dr=ws.addRow(['',cod,desc,unid,precio,qt,ct]);
        dr.getCell(5).numFmt='"'+pM+' "#,##0.00';
        dr.getCell(6).numFmt='#,##0.0000';
        dr.getCell(7).numFmt='"'+pM+' "#,##0.00';
        stripeRow(dr,ri%2===0);
        dr.getCell(2).font={size:9,name:'Calibri',color:{argb:C_BLUE},bold:true};
        cSub+=Number(ct); grand+=Number(ct);
      }
      if(lastC){
        const sr=ws.addRow(['SUBTOTAL '+lastC,,,,,,cSub]);
        ws.mergeCells('A'+sr.number+':F'+sr.number);
        sr.getCell(7).numFmt='"'+pM+' "#,##0.00';
        sr.eachCell(c=>{c.font={bold:true,size:9,name:'Calibri',color:{argb:C_BLUE}};
          c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_LBLUE}};});
      }
    }
    ws.addRow([]);
    const gt=ws.addRow(['COSTO TOTAL DE INSUMOS — '+pN,,,,,,grand]);
    ws.mergeCells('A'+gt.number+':F'+gt.number); gt.height=24;
    gt.getCell(7).numFmt='"'+pM+' "#,##0.00';
    gt.eachCell(c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_BLUE}};
      c.font={bold:true,size:12,color:{argb:C_WHITE},name:'Calibri'};
      c.alignment={vertical:'middle'};});
    ws.addRow([]);
    ws.addRow(['Nota: Precios de referencia según mercado hondureño 2025-2026 (CHICO / Larach y Cía). Verificar vigencia antes de presentar oferta.']);
    ws.mergeCells('A'+ws.rowCount+':G'+ws.rowCount);
    ws.lastRow.getCell(1).font={size:8,italic:true,color:{argb:'FF888888'},name:'Calibri'};

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition','attachment; filename=Insumos_Pres_'+req.params.id+'.xlsx');
    await wb.xlsx.write(res);
  }catch(e){console.error(e);res.status(500).json({error:e.message});}
});

// ── REPORTE: EETT POR ACTIVIDAD x PRESUPUESTO (Excel) ────────
router.get('/presupuesto/:id/especificaciones', requireAuth, async (req,res)=>{
  try{
    const db=await getDb();
    const pr=await getPres(db,req.params.id);
    if(!pr) return res.status(404).json({error:'Presupuesto no encontrado'});
    const [pN,pC,pU,pM]=pr;

    const actsR=db.exec(
      `SELECT DISTINCT a.id_actividad,a.codigo,a.descripcion,a.unidad,a.costo_total
       FROM presupuesto_partidas pp
       JOIN actividades a ON pp.id_actividad=a.id_actividad
       WHERE pp.id_presupuesto=? ORDER BY a.codigo`,
      [req.params.id]);

    const wb=new ExcelJS.Workbook();
    const ws=wb.addWorksheet('EETT ACTIVIDADES');
    ws.views=[{showGridLines:false}];
    ws.getColumn(1).width=5; ws.getColumn(2).width=22; ws.getColumn(3).width=68;

    titleBlock(ws,'ESPECIFICACIONES TÉCNICAS POR ACTIVIDAD','C',32);
    ws.addRow(['Presupuesto: '+pN+' | Cliente: '+(pC||'—')+' | Fecha: '+new Date().toLocaleDateString('es-HN')]);
    ws.mergeCells('A'+ws.rowCount+':C'+ws.rowCount);
    ws.lastRow.getCell(1).font={size:10,name:'Calibri'};
    ws.addRow([]);

    const TMPL={
      F001:{t:'TOPOGRAFÍA',s:[
        ['Norma','SOPTRAVI/INSEP — Manual de Carreteras. SANAA Normas Técnicas.'],
        ['Alcance','Replanteo de ejes, nivelación, colocación de estacas BM permanentes.'],
        ['Medición','Por ML de eje replanteado o GLB según contrato.']]},
      F002:{t:'CIMENTACIONES',s:[
        ['Norma','ACI 318 — Estructuras de concreto.'],
        ['Materiales',"Concreto f'c>=210 kg/cm2. Varilla corrugada Grado 40/60."],
        ['Procedimiento','Excavar, apisonar, armar, encofrar, colar, curar 7 días.']]},
      F003:{t:'ELEMENTOS ESTRUCTURALES',s:[
        ['Norma','ACI 318.'],
        ['Materiales',"Concreto f'c=210-280 kg/cm2 según planos."],
        ['Procedimiento','Armar, encofrar, colar en capas <=50cm, vibrar, curar 7 días.']]},
      F004:{t:'MAMPOSTERÍA',s:[
        ['Norma','ASTM C90. ACI 530.'],
        ['Materiales','Bloque 15x20x40 cm. Mortero 1:4.'],
        ['Tolerancias','Plomo: ±5 mm en 3 m. Junta: 10±3 mm.']]},
      F005:{t:'FONTANERÍA/AGUA POTABLE',s:[
        ['Norma','AWWA C900/C905. ASTM D2241. SANAA.'],
        ['Materiales','PVC SDR según presión. Cama de arena 10 cm.'],
        ['Control','Prueba hidrostática obligatoria. Desinfección 50 ppm cloro.']]},
      F006:{t:'ALCANTARILLADO SANITARIO',s:[
        ['Norma','ASTM D3034. SANAA Normas de Saneamiento.'],
        ['Materiales','PVC SDR-41. Pozos de visita de concreto o prefabricados.'],
        ['Pendiente Mín.','>=0.5% para Ø>=200mm; >=1.0% para Ø<200mm.']]},
    };
    const DEFAULT={t:'OBRA CIVIL GENERAL',s:[
      ['Norma Aplicable','SOPTRAVI/INSEP, SANAA y CICH Honduras.'],
      ['Descripción','Trabajo según planos y memorias de cálculo aprobadas.'],
      ['Materiales','Nuevos, primera calidad, aprobados por supervisión.'],
      ['Mano de Obra','Personal calificado. Maestro de obras con >=5 años experiencia.'],
      ['Control','Supervisión diaria. Bitácora actualizada. Fotografías por etapa.'],
      ['Seguridad','EPP completo. Señalización perimetral.'],
    ]};

    if(actsR.length&&actsR[0].values.length){
      let n=1;
      for(const [aId,aCod,aDesc,aUnid,aTotal] of actsR[0].values){
        const prefix=aCod.substring(0,4);
        const tmpl=TMPL[prefix]||DEFAULT;
        const ar=ws.addRow([n+++'.',aCod,aDesc]);
        ar.height=22;
        ['A','B','C'].forEach(col=>{
          const c=ar.getCell(col);
          c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_BLUE}};
          c.font={bold:true,size:10,color:{argb:C_WHITE},name:'Calibri'};
          c.alignment={vertical:'middle'};});
        ws.addRow(['','Unidad: '+aUnid+' | Costo: '+pM+' '+Number(aTotal).toFixed(2),tmpl.t])
          .eachCell(c=>{c.font={size:9,name:'Calibri',color:{argb:C_BLUE}};
            c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_LBLUE}};});
        for(const [campo,valor] of tmpl.s){
          const dr=ws.addRow(['',campo,valor]);
          dr.getCell(2).font={bold:true,size:9,name:'Calibri'};
          dr.getCell(3).font={size:9,name:'Calibri'};
          dr.getCell(3).alignment={wrapText:true};
          dr.eachCell(c=>c.border={bottom:{style:'hair',color:{argb:C_DGRAY}}});
        }
        const mR=db.exec(
          `SELECT c.nombre,i.codigo,i.descripcion,i.unidad,
                  ai.cantidad,ai.rendimiento,ai.desperdicio,i.precio_unitario,ai.costo_parcial
           FROM actividad_insumos ai
           JOIN insumos i ON ai.id_insumo=i.id_insumo
           JOIN categorias_insumo c ON i.id_categoria=c.id_categoria
           WHERE ai.id_actividad=? ORDER BY c.id_categoria`,
          [aId]);
        if(mR.length&&mR[0].values.length){
          ws.addRow(['','COMPOSICIÓN DE INSUMOS',
            'Categoría | Código | Descripción | Unidad | Cant | Rendto | Desp% | P.Unit | C.Parcial'])
            .eachCell(c=>{c.font={bold:true,size:8,name:'Calibri',color:{argb:C_WHITE}};
              c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_BLUE2}};});
          mR[0].values.forEach(([cat,iCod,iDesc,iUnid,cant,rend,desp,precio,cp],i)=>{
            const mr2=ws.addRow(['',cat,
              iCod+' | '+iDesc+' | '+iUnid+' | '+cant+' | '+rend+' | '+desp+'% | L '+
              Number(precio).toFixed(2)+' | L '+Number(cp).toFixed(4)]);
            if(i%2===0) mr2.eachCell(c=>c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_LGRAY}});
            mr2.eachCell(c=>c.font={size:8,name:'Calibri'});
          });
        }
        ws.addRow([]);
      }
    }
    ws.addRow(['Fuente precios: CHICO / Larach y Cía Honduras / La Prensa HN 2025-2026.']);
    ws.mergeCells('A'+ws.rowCount+':C'+ws.rowCount);
    ws.lastRow.getCell(1).font={size:8,italic:true,color:{argb:'FF888888'},name:'Calibri'};
    ws.lastRow.getCell(1).alignment={wrapText:true};

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition','attachment; filename=EETT_Pres_'+req.params.id+'.xlsx');
    await wb.xlsx.write(res);
  }catch(e){console.error(e);res.status(500).json({error:e.message});}
});


// ── REPORTE 3: PRESUPUESTO ────────────────────────────────
router.get('/presupuesto/:id/excel', requireAuth, async (req,res)=>{
  try{
    const db=await getDb(); const empresa=await getEmpresa(db); const mostrarFecha=await getMostrarFecha(db);
    const pR=db.exec(`SELECT p.id_presupuesto,p.nombre,p.costos_directos,p.porcentaje_indirectos,p.porcentaje_utilidad,p.porcentaje_imprevistos,p.costos_indirectos,p.utilidad,p.imprevistos,p.total_general,p.fecha_creacion,p.moneda,p.cliente,p.ubicacion FROM presupuestos p WHERE p.id_presupuesto=?`,[req.params.id]);
    if(!pR.length||!pR[0].values.length) return res.status(404).json({error:'No encontrado'});
    const r=pR[0].values[0];
    const pres={nombre:r[1],cd:r[2],pi:r[3],pu:r[4],pim:r[5],ci:r[6],util:r[7],impr:r[8],total:r[9],fecha:r[10],mon:r[11],cli:r[12],ubic:r[13]};

    const partR=db.exec(`SELECT pp.id_partida,c.nombre,c.orden_visual,a.codigo,a.descripcion,a.unidad,pp.cantidad,pp.precio_unitario,pp.subtotal FROM presupuesto_partidas pp JOIN actividades a ON pp.id_actividad=a.id_actividad LEFT JOIN modulos c ON pp.id_modulo=c.id_modulo WHERE pp.id_presupuesto=? ORDER BY COALESCE(c.orden_visual,999),pp.id_partida`,[req.params.id]);
    const parts=partR.length?partR[0].values:[];

    const wb=new ExcelJS.Workbook();
    const ws=wb.addWorksheet('PRESUPUESTO');
    ws.views=[{showGridLines:false}];
    [6,12,46,9,12,16,18].forEach((w,i)=>ws.getColumn(i+1).width=w);

    titleBlock(ws,'PRESUPUESTO DE OBRA','G',32);
    empresaRow(ws, empresa, mostrarFecha, 'G1');
    ws.addRow([`PRESUPUESTO: ${pres.nombre}`]).eachCell(c=>c.font={bold:true,size:12,name:'Calibri'});
    ws.mergeCells(`A${ws.rowCount}:G${ws.rowCount}`);
    ws.addRow([`Cliente: ${pres.cli||'—'}`,,,`Fecha: ${pres.fecha?.substring(0,10)||'—'}`,,,`Moneda: ${pres.mon}`]).eachCell(c=>c.font={size:10,name:'Calibri'});
    ws.addRow([`Ubicación: ${pres.ubic||'—'}`]).eachCell(c=>c.font={size:10,name:'Calibri'});
    ws.mergeCells(`A${ws.rowCount}:G${ws.rowCount}`);
    ws.addRow([]);

    const hr=ws.addRow(['No.','Código','Descripción','Unidad','Cantidad',`P.Unit.(${pres.mon})`,`Subtotal(${pres.mon})`]);
    hr.height=22; hr.eachCell(c=>hdr(c));

    let n=1,lastCap=null,capT=0;
    for(const [pid,cap,co,cod,desc,unid,cant,pu,sub] of parts){
      if(cap!==lastCap){
        if(lastCap!==null){
          const sr=ws.addRow([`Subtotal: ${lastCap}`,,,,,, capT]);
          ws.mergeCells(`A${sr.number}:F${sr.number}`);
          sr.getCell(7).numFmt=`"${pres.mon} "#,##0.00`;
          sr.eachCell(c=>{c.font={bold:true,size:10,name:'Calibri',color:{argb:C_WHITE}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_BLUE2}};});
          capT=0;
        }
        const cr=ws.addRow([cap||'ACTIVIDADES GENERALES']);
        ws.mergeCells(`A${cr.number}:G${cr.number}`);
        cr.getCell(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:C_BLUE}};
        cr.getCell(1).font={bold:true,size:11,color:{argb:C_WHITE},name:'Calibri'};
        cr.height=20; lastCap=cap;
      }
      const dr=ws.addRow([n++,cod,desc,unid,cant,pu,sub]);
      dr.getCell(5).numFmt='#,##0.00'; dr.getCell(6).numFmt=`"${pres.mon} "#,##0.00`; dr.getCell(7).numFmt=`"${pres.mon} "#,##0.00`;
      stripeRow(dr,n%2===0);
      dr.getCell(2).font={size:9,name:'Calibri',color:{argb:C_BLUE},bold:true};
      capT+=Number(sub);
    }
    if(lastCap!==null){
      const sr=ws.addRow([`Subtotal: ${lastCap}`,,,,,, capT]);
      ws.mergeCells(`A${sr.number}:F${sr.number}`);
      sr.getCell(7).numFmt=`"${pres.mon} "#,##0.00`;
      sr.eachCell(c=>{c.font={bold:true,size:10,name:'Calibri',color:{argb:C_WHITE}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_BLUE2}};});
    }

    ws.addRow([]);
    const addT=(label,val,big=false)=>{
      const tr=ws.addRow([label,,,,,,val]);
      ws.mergeCells(`A${tr.number}:F${tr.number}`);
      tr.getCell(7).numFmt=`"${pres.mon} "#,##0.00`; tr.height=big?24:18;
      tr.eachCell(c=>{
        if(big){c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_BLUE}};c.font={bold:true,size:13,color:{argb:C_WHITE},name:'Calibri'};c.alignment={vertical:'middle'};}
        else{c.font={size:10,name:'Calibri'};c.border={top:{style:'hair',color:{argb:C_DGRAY}}};}
        c.getCell&&(c.font={size:10,name:'Calibri'});
      });
      tr.getCell(1).font=big?{bold:true,size:13,color:{argb:C_WHITE},name:'Calibri'}:{bold:true,size:10,name:'Calibri'};
    };
    addT('COSTOS DIRECTOS',pres.cd);
    addT(`COSTOS INDIRECTOS (${pres.pi}%)`,pres.ci);
    addT(`UTILIDAD (${pres.pu}%)`,pres.util);
    addT(`IMPREVISTOS (${pres.pim}%)`,pres.impr);
    addT('TOTAL GENERAL',pres.total,true);

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename=Presupuesto_${req.params.id}.xlsx`);
    await wb.xlsx.write(res);
  }catch(e){console.error(e);res.status(500).json({error:e.message});}
});

// ── REPORTE 4: EETT GENERALES ─────────────────────────────
router.get('/especificaciones/generales', requireAuth, async (req,res)=>{
  try{
    const wb=new ExcelJS.Workbook();
    const ws=wb.addWorksheet('EETT GENERALES');
    ws.views=[{showGridLines:false}];
    ws.getColumn(1).width=5; ws.getColumn(2).width=28; ws.getColumn(3).width=68;

    titleBlock(ws,'ESPECIFICACIONES TÉCNICAS GENERALES','C',32);
    ws.addRow(['NORMAS Y REGLAMENTOS APLICABLES — REPÚBLICA DE HONDURAS']);
    ws.mergeCells(`A${ws.rowCount}:C${ws.rowCount}`);
    ws.lastRow.getCell(1).font={size:10,italic:true,name:'Calibri',color:{argb:'FF555555'}};
    ws.addRow([]);

    const SECS=[
      {t:'1. NORMATIVA APLICABLE',rows:[
        ['1.1','Marco Legal','Ley de Municipalidades (Decreto 134-90). Ley General del Ambiente (Decreto 104-93). Normas SOPTRAVI/INSEP para obras de infraestructura. Normas SANAA para sistemas de agua potable y saneamiento. Reglamento de la Industria de la Construcción (CICH Honduras).'],
        ['1.2','Normas Técnicas','ACI 318 — Diseño estructural de concreto. ASTM — Materiales y ensayos. AWWA — Sistemas de agua potable. AASHTO — Vías y pavimentos. NTC Honduras (Normas Técnicas de Construcción). CONASA/ERSAPS para agua y saneamiento.'],
      ]},
      {t:'2. MATERIALES',rows:[
        ['2.1','Cemento Portland','Tipo I conforme ASTM C150. Resistencia a 28 días: mínimo 280 kg/cm² (estructural) y 210 kg/cm² (infraestructura hidráulica). Bolsa 42.5 kg cerrada, sin grumos. Precio referencia 2026: L 220-235/bolsa (Tegucigalpa). Almacenar en bodega seca <40°C, máximo 3 meses.'],
        ['2.2','Agregados','Arena de río lavada (M.F. 2.3-3.1, ASTM C33). Grava limpia y dura (TM ≤25 mm en elementos armados). Sin materia orgánica >1%. Absorción máxima 2%. Precio referencia: arena L 480-520/m³, grava L 550-580/m³.'],
        ['2.3','Acero de Refuerzo','Grado 40 (fy=2,800 kg/cm²) o Grado 60 según planos, ASTM A615. Sin corrosión activa. Recubrimiento mínimo: 20 mm interior, 40 mm exterior, 75 mm en fundación. Traslapes ≥40 diámetros (Grado 40). Precio ref. 2025: varilla 3/8" L 155/unidad; 1/2" L 271/unidad.'],
        ['2.4','Agua','Potable, libre de aceites, ácidos, álcalis y sales. Relación A/C según diseño (máx. 0.60 para durabilidad). No usar agua de mar. T° de mezclado 10-32°C.'],
        ['2.5','Bloque de Concreto','ASTM C90, Grado N. Resistencia neta ≥130 kg/cm². Absorción ≤208 kg/m³. Dimensiones estándar 15×20×40 cm. Sin fracturas ni esquinas rotas. Precio ref.: L 28-32/unidad.'],
        ['2.6','Tuberías PVC','ASTM D2241 (presión) o ASTM D3034 (sanitario). SDR-17: P≥160 psi; SDR-26: P≥100 psi; SDR-41: P≥63 psi. Accesorios del mismo fabricante y clase de presión.'],
      ]},
      {t:'3. EJECUCIÓN',rows:[
        ['3.1','Replanteo','Topógrafo graduado con equipo calibrado. BM de referencia permanentes. Estacas cada 20 m en tangentes y en todos los quiebres. Entrega de plano de replanteo firmado y sellado.'],
        ['3.2','Excavaciones','Taludes según tipo de suelo (suelo firme 1:1; roca 0.2:1). Profundidad mínima fundación: 0.80 m bajo nivel natural. Entibado obligatorio en excavaciones >1.50 m. Retiro de material blando antes de colocar plantilla.'],
        ['3.3','Concreto','Dosificación en peso (preferible) o en volumen con corrección por humedad. Mezclado mecánico mínimo 90 seg/batchada. Transporte máximo 30 min. Colocación antes de 1.5 h de mezclado. Vibrado mecánico cada 30-45 cm. Curado 7 días mínimo (agua o membrana).'],
        ['3.4','Rellenos','Material selecto libre de raíces, materia orgánica y piedras >100 mm. Capas de 20 cm máximo. Compactación ≥95% Proctor Standard en vía; ≥90% en rellenos generales. Control cada 100 m o 500 m².'],
        ['3.5','Manejo Ambiental','Restauración de zonas perturbadas al finalizar. Disposición de residuos en sitio municipal autorizado. No arrojar material a ríos o quebradas. Aplicar PGAS del financiador.'],
      ]},
      {t:'4. CONTROL DE CALIDAD',rows:[
        ['4.1','Concreto','Mínimo 3 cilindros por 50 m³ o fracción. Slump máximo 10 cm (15 cm con vibrador). Rotura a 7 y 28 días en laboratorio certificado. Aceptable: ≥85% f\'c a 7 días; ≥100% a 28 días.'],
        ['4.2','Tuberías','Prueba hidrostática: 1.5× presión nominal, 2 horas sin fugas. Alcantarillado: infiltración/exfiltración máx. 0.5 L/mm-día-100 m. Mandril para PVC: deflexión máxima 5%.'],
        ['4.3','Documentación','Bitácora CICH actualizada diariamente. Memorias fotográficas por actividad. Laboratorio acreditado. Planos as-built firmados por Ingeniero responsable. Dossier de calidad entregado 30 días post-recepción.'],
      ]},
      {t:'5. SEGURIDAD OCUPACIONAL',rows:[
        ['5.1','EPP','Casco clase E, chaleco reflectivo, botas punta de acero, guantes. Protección auditiva en zonas con ruido >85 dB. Arnés obligatorio >1.80 m altura. Equipo contra polvo en trabajos de demolición o excavación.'],
        ['5.2','Señalización','Cintas de restricción perimetral. Señales SOPTRAVI en vía pública. Iluminación nocturna con conos reflectivos. Extintores en bodega y zona de mezclado. Plan de emergencias disponible en obra.'],
      ]},
    ];

    for(const sec of SECS){
      secTitle(ws,sec.t);
      const hr=ws.addRow(['Ítem','Concepto','Descripción / Requisito']);
      hr.height=16; hr.eachCell(c=>hdr(c,C_ORANGE,'FF333333',true));
      sec.rows.forEach(([it,con,desc],i)=>{
        const dr=ws.addRow([it,con,desc]);
        if(i%2===0) dr.eachCell(c=>c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_LGRAY}});
        dr.eachCell(c=>{c.font={size:9,name:'Calibri'};c.border={bottom:{style:'hair',color:{argb:C_DGRAY}}};c.alignment={wrapText:true,vertical:'top'};});
        dr.getCell(1).font={size:9,bold:true,name:'Calibri',color:{argb:C_BLUE}};
        dr.getCell(2).font={size:9,bold:true,name:'Calibri'};
      });
      ws.addRow([]);
    }

    ws.addRow(['Nota: Estas especificaciones son de carácter general. Las especificaciones particulares de cada actividad prevalecen. Revisión técnica obligatoria por Ingeniero responsable del proyecto.']);
    ws.mergeCells(`A${ws.rowCount}:C${ws.rowCount}`);
    ws.lastRow.getCell(1).font={size:8,italic:true,color:{argb:'FF888888'},name:'Calibri'};
    ws.lastRow.getCell(1).alignment={wrapText:true}; ws.lastRow.height=25;

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition','attachment; filename=EETT_Generales.xlsx');
    await wb.xlsx.write(res);
  }catch(e){console.error(e);res.status(500).json({error:e.message});}
});

// ── REPORTE: LISTA DE COTIZACIÓN DE INSUMOS ──────────────────
// ?filtro=todos|sin_precio|con_precio   ?categoria=1,2,3
router.get('/insumos/cotizacion', requireAuth, async (req, res) => {
  try {
    const db  = await getDb();
    const filtro = req.query.filtro || 'sin_precio'; // por defecto: los que faltan
    const wb  = new ExcelJS.Workbook();
    wb.creator = 'Sistema CU Honduras';

    // ── Consulta principal ──────────────────────────────────
    let wherePrecio = '';
    if (filtro === 'sin_precio') wherePrecio = "AND (i.precio_unitario=0 OR i.precio_unitario IS NULL)";
    if (filtro === 'con_precio') wherePrecio = "AND i.precio_unitario > 0";

    const insR = db.exec(`
      SELECT i.id_insumo, i.codigo, i.descripcion, i.unidad,
             c.nombre as categoria, c.id_categoria,
             i.precio_unitario, i.fecha_actualizacion
      FROM insumos i
      JOIN categorias_insumo c ON i.id_categoria = c.id_categoria
      WHERE i.activo = 1 ${wherePrecio}
      ORDER BY c.id_categoria, i.descripcion`);

    const insumos = insR.length ? insR[0].values : [];

    // Cuántas actividades usa cada insumo (para priorizar)
    const actCountR = db.exec(`
      SELECT ai.id_insumo, COUNT(DISTINCT ai.id_actividad) as n
      FROM actividad_insumos ai GROUP BY ai.id_insumo`);
    const actCount = {};
    if (actCountR.length) actCountR[0].values.forEach(r => { actCount[r[0]] = r[1]; });

    // ── Hoja 1: Lista de Cotización ─────────────────────────
    const ws = wb.addWorksheet('COTIZACIÓN');
    ws.views = [{ showGridLines: false }];
    ws.getColumn(1).width = 6;   // No.
    ws.getColumn(2).width = 16;  // Código
    ws.getColumn(3).width = 48;  // Descripción
    ws.getColumn(4).width = 9;   // Unidad
    ws.getColumn(5).width = 14;  // Categoría
    ws.getColumn(6).width = 16;  // Precio actual
    ws.getColumn(7).width = 18;  // PRECIO COTIZADO ← rellena proveedor
    ws.getColumn(8).width = 22;  // Proveedor/Observación
    ws.getColumn(9).width = 12;  // Actos

    // Encabezado título
    const titulo = filtro === 'sin_precio'
      ? 'LISTA DE INSUMOS PARA COTIZACIÓN (SIN PRECIO)'
      : filtro === 'con_precio'
        ? 'LISTA DE INSUMOS CON PRECIO (ACTUALIZACIÓN)'
        : 'CATÁLOGO COMPLETO DE INSUMOS PARA COTIZACIÓN';

    const rT = ws.addRow([titulo]);
    ws.mergeCells(`A1:I1`); rT.height = 30;
    const cT = rT.getCell(1);
    cT.fill = {type:'pattern',pattern:'solid',fgColor:{argb:C_BLUE}};
    cT.font = {bold:true,size:13,color:{argb:C_WHITE},name:'Calibri'};
    cT.alignment = {horizontal:'center',vertical:'middle'};

    // Fila de info
    const rI = ws.addRow([
      `Fecha: ${new Date().toLocaleDateString('es-HN')}`,,,
      `Total insumos: ${insumos.length}`,,,
      'Fuente ref.: CHICO Boletín IV-2025 / Larach y Cía HN',,
    ]);
    ws.mergeCells(`A2:C2`); ws.mergeCells(`D2:F2`); ws.mergeCells(`G2:I2`);
    rI.eachCell(c => { c.font={size:9,italic:true,name:'Calibri',color:{argb:'FF555555'}}; });

    // Instrucciones
    const rInst = ws.addRow([
      '📝 INSTRUCCIONES: Completa las columnas "PRECIO COTIZADO (L)" y "Proveedor/Observación". Guarda y carga en el sistema.',,,,,,,,
    ]);
    ws.mergeCells(`A3:I3`);
    rInst.getCell(1).fill = {type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF3CD'}};
    rInst.getCell(1).font = {size:9,name:'Calibri',color:{argb:'FF856404'}};
    rInst.getCell(1).alignment = {wrapText:true};

    ws.addRow([]); // espacio

    // Header de columnas
    const hdr = ws.addRow(['No.','Código','Descripción','Unidad','Categoría','Precio Actual (L)','PRECIO COTIZADO (L)','Proveedor / Observación','Acts.']);
    hdr.height = 22;
    hdr.eachCell((c, col) => {
      const isEditable = col === 7 || col === 8;
      c.fill = {type:'pattern',pattern:'solid',fgColor:{argb: isEditable ? C_ORANGE : C_BLUE}};
      c.font = {bold:true,size:10,color:{argb: isEditable ? 'FF333333' : C_WHITE},name:'Calibri'};
      c.alignment = {horizontal:'center',vertical:'middle',wrapText:true};
      c.border = {bottom:{style:'thin',color:{argb:C_DGRAY}}};
    });

    // Agrupar por categoría
    let lastCat = null;
    let n = 1;
    for (const [id, codigo, desc, unidad, cat, catId, precio, fechaAct] of insumos) {
      // Fila de cabecera de categoría
      if (cat !== lastCat) {
        const cr = ws.addRow([cat]);
        ws.mergeCells(`A${cr.number}:I${cr.number}`);
        cr.getCell(1).fill = {type:'pattern',pattern:'solid',fgColor:{argb:C_ORANGE}};
        cr.getCell(1).font = {bold:true,size:11,name:'Calibri',color:{argb:'FF1A3353'}};
        cr.height = 18;
        lastCat = cat;
      }

      const numActs = actCount[id] || 0;
      const precioOK = precio > 0;
      const even = n % 2 === 0;

      const dr = ws.addRow([
        n++,
        codigo || '—',
        desc,
        unidad,
        cat,
        precioOK ? precio : '',  // precio actual
        '',                       // PRECIO COTIZADO — celda editable vacía
        '',                       // Proveedor
        numActs || ''
      ]);

      // Estilo fila
      dr.eachCell((c, col) => {
        if (even && col !== 7 && col !== 8) {
          c.fill = {type:'pattern',pattern:'solid',fgColor:{argb:'FFF5F8FC'}};
        }
        c.font = {size:9,name:'Calibri'};
        c.border = {bottom:{style:'hair',color:{argb:C_DGRAY}}};
      });

      // Precio actual: rojo si es 0
      const cPrecio = dr.getCell(6);
      if (!precioOK) {
        cPrecio.value = 'SIN PRECIO';
        cPrecio.font = {size:9,name:'Calibri',color:{argb:'FFCC0000'},bold:true};
      } else {
        cPrecio.numFmt = '"L "#,##0.00';
        cPrecio.font = {size:9,name:'Calibri',color:{argb:'FF1E6B31'}};
      }

      // Columna PRECIO COTIZADO — resaltar para que el usuario sepa que debe llenar
      const cCot = dr.getCell(7);
      cCot.fill = {type:'pattern',pattern:'solid',fgColor:{argb:'FFFFFDE7'}};
      cCot.numFmt = '"L "#,##0.00';
      cCot.border = {
        top:{style:'thin',color:{argb:'FFDDCC44'}},
        bottom:{style:'thin',color:{argb:'FFDDCC44'}},
        left:{style:'medium',color:{argb:'FFDDCC44'}},
        right:{style:'medium',color:{argb:'FFDDCC44'}}
      };

      // Columna Proveedor
      const cProv = dr.getCell(8);
      cProv.fill = {type:'pattern',pattern:'solid',fgColor:{argb:'FFFFFDE7'}};
      cProv.border = {
        top:{style:'thin',color:{argb:'FFDDCC44'}},
        bottom:{style:'thin',color:{argb:'FFDDCC44'}},
        right:{style:'medium',color:{argb:'FFDDCC44'}}
      };

      // Nro de actividades: badge visual
      const cActs = dr.getCell(9);
      cActs.alignment = {horizontal:'center'};
      if (numActs > 0) {
        cActs.font = {size:9,name:'Calibri',bold:true,
          color:{argb: numActs >= 10 ? 'FFCC0000' : numActs >= 5 ? 'FFDD6B20' : 'FF1A3353'}};
      }
    }

    // Fila totales / leyenda al final
    ws.addRow([]);
    const rL = ws.addRow([
      '⚠ Columnas amarillas son editables. Rellena "PRECIO COTIZADO" con el precio de mercado en Lempiras y el nombre del proveedor o ferretería. La columna "Acts." indica cuántas fichas de costo se verán afectadas.'
    ]);
    ws.mergeCells(`A${rL.number}:I${rL.number}`);
    rL.getCell(1).font = {size:8,italic:true,name:'Calibri',color:{argb:'FF777777'}};
    rL.getCell(1).alignment = {wrapText:true};
    rL.height = 28;

    // ── Hoja 2: Resumen por categoría ──────────────────────
    const ws2 = wb.addWorksheet('RESUMEN');
    ws2.views = [{showGridLines:false}];
    ws2.getColumn(1).width = 20;
    ws2.getColumn(2).width = 14;
    ws2.getColumn(3).width = 14;
    ws2.getColumn(4).width = 14;
    ws2.getColumn(5).width = 16;

    const rT2 = ws2.addRow(['RESUMEN DE COTIZACIÓN POR CATEGORÍA']);
    ws2.mergeCells('A1:E1'); rT2.height = 26;
    rT2.getCell(1).fill = {type:'pattern',pattern:'solid',fgColor:{argb:C_BLUE}};
    rT2.getCell(1).font = {bold:true,size:12,color:{argb:C_WHITE},name:'Calibri'};
    rT2.getCell(1).alignment = {horizontal:'center',vertical:'middle'};

    ws2.addRow([]);
    const hdr2 = ws2.addRow(['Categoría','Total','Con precio','Sin precio','Cobertura %']);
    hdr2.height = 18;
    hdr2.eachCell(c=>{
      c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_BLUE}};
      c.font={bold:true,size:10,color:{argb:C_WHITE},name:'Calibri'};
      c.alignment={horizontal:'center',vertical:'middle'};
    });

    // Resumen por categoría
    const resR = db.exec(`
      SELECT c.nombre, COUNT(*) as total,
        SUM(CASE WHEN i.precio_unitario>0 THEN 1 ELSE 0 END) as con_p
      FROM insumos i JOIN categorias_insumo c ON i.id_categoria=c.id_categoria
      WHERE i.activo=1 GROUP BY c.id_categoria ORDER BY c.id_categoria`);

    let grandTotal=0, grandCon=0;
    if (resR.length) {
      resR[0].values.forEach(([cat, tot, conP], idx) => {
        const sinP = tot - conP;
        const pct = tot > 0 ? ((conP/tot)*100).toFixed(1) : '0.0';
        const dr2 = ws2.addRow([cat, tot, conP, sinP, pct+'%']);
        if (idx%2===0) dr2.eachCell(c=>c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_LGRAY}});
        dr2.eachCell(c=>{c.font={size:10,name:'Calibri'};c.border={bottom:{style:'hair',color:{argb:C_DGRAY}}};});
        dr2.getCell(4).font={size:10,name:'Calibri',color:{argb:sinP>0?'FFCC0000':'FF1E6B31'},bold:true};
        dr2.getCell(5).font={size:10,name:'Calibri',
          color:{argb:Number(pct)>=80?'FF1E6B31':Number(pct)>=50?'FFDD6B20':'FFCC0000'},bold:true};
        grandTotal+=tot; grandCon+=conP;
      });
    }

    const rTot = ws2.addRow(['TOTAL CATÁLOGO', grandTotal, grandCon, grandTotal-grandCon,
      grandTotal>0 ? ((grandCon/grandTotal)*100).toFixed(1)+'%' : '0%']);
    rTot.height = 20;
    rTot.eachCell(c=>{
      c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_BLUE}};
      c.font={bold:true,size:11,color:{argb:C_WHITE},name:'Calibri'};
    });

    // Nombre del archivo
    const nombres = { sin_precio:'Cotizacion_SinPrecio', con_precio:'Cotizacion_Actualizacion', todos:'Cotizacion_Completa' };
    const fname = (nombres[filtro]||'Cotizacion') + '_' + new Date().toISOString().substring(0,10) + '.xlsx';

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename=${fname}`);
    await wb.xlsx.write(res);
  } catch(e) { console.error(e); res.status(500).json({error:e.message}); }
});

// ── GET datos JSON para impresión PDF del presupuesto ─────
router.get('/presupuesto/:id/pdf-data', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const id = req.params.id;

    const pr = db.exec(`
      SELECT p.id_presupuesto, p.nombre, p.costos_directos, p.costos_indirectos,
             p.utilidad, p.imprevistos, p.total_general,
             p.porcentaje_indirectos, p.porcentaje_utilidad, p.porcentaje_imprevistos,
             p.ubicacion, p.cliente
      FROM presupuestos p
      WHERE p.id_presupuesto = ?`, [id]);

    if (!pr.length || !pr[0].values.length)
      return res.status(404).json({ error: 'Presupuesto no encontrado' });

    const [v] = pr[0].values;
    const presup = {
      id_presupuesto: v[0], nombre_presupuesto: v[1],
      costos_directos: v[2], costos_indirectos: v[3], utilidad: v[4],
      imprevistos: v[5], total_general: v[6],
      porcentaje_indirectos: v[7], porcentaje_utilidad: v[8], porcentaje_imprevistos: v[9],
      ubicacion: v[10], cliente: v[11]
    };

    const partR = db.exec(`
      SELECT a.codigo, a.descripcion, a.unidad,
             pp.cantidad, pp.precio_unitario, pp.subtotal,
             c.nombre as modulo
      FROM presupuesto_partidas pp
      JOIN actividades a ON pp.id_actividad = a.id_actividad
      LEFT JOIN modulos c ON pp.id_modulo = c.id_modulo
      WHERE pp.id_presupuesto = ?
      ORDER BY c.orden_visual, a.codigo`, [id]);

    presup.actividades = partR.length ? partR[0].values.map(p => ({
      codigo: p[0], descripcion: p[1], unidad: p[2],
      cantidad: p[3], precio_unitario: p[4], subtotal: p[5], modulo: p[6]
    })) : [];

    res.json(presup);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PDF-DATA: FICHAS DE COSTOS ────────────────────────────
router.get('/presupuesto/:id/fichas/pdf-data', requireAuth, async (req,res) => {
  try {
    const db = await getDb();
    const p = await getPres(db, req.params.id);
    if (!p) return res.status(404).json({ error: 'Presupuesto no encontrado' });
    const [pN, pC, pU, pM] = p;
    const actsR = db.exec(`
      SELECT DISTINCT a.id_actividad, a.codigo, a.descripcion, a.unidad, a.costo_total
      FROM presupuesto_partidas pp
      JOIN actividades a ON pp.id_actividad = a.id_actividad
      WHERE pp.id_presupuesto = ? ORDER BY a.codigo`, [req.params.id]);
    if (!actsR.length || !actsR[0].values.length)
      return res.status(400).json({ error: 'Sin actividades en este presupuesto' });

    const actividades = [];
    for (const [aId, aCod, aDesc, aUnid, aTotal] of actsR[0].values) {
      const dR = db.exec(`
        SELECT i.codigo, i.descripcion, i.unidad, ai.cantidad, ai.rendimiento, ai.desperdicio,
               i.precio_unitario, ai.costo_parcial, c.nombre as cat
        FROM actividad_insumos ai
        JOIN insumos i ON ai.id_insumo = i.id_insumo
        JOIN categorias_insumo c ON i.id_categoria = c.id_categoria
        WHERE ai.id_actividad = ? ORDER BY c.id_categoria, i.descripcion`, [aId]);
      actividades.push({
        codigo: aCod, descripcion: aDesc, unidad: aUnid, costo_total: aTotal,
        insumos: dR.length && dR[0].values.length ? dR[0].values.map(r => ({
          codigo: r[0], descripcion: r[1], unidad: r[2], cantidad: r[3],
          rendimiento: r[4], desperdicio: r[5], precio_unitario: r[6],
          costo_parcial: r[7], categoria: r[8]
        })) : []
      });
    }
    res.json({ presupuesto: pN, cliente: pC, ubicacion: pU, moneda: pM, actividades });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PDF-DATA: INSUMOS DEL PRESUPUESTO ────────────────────
router.get('/presupuesto/:id/insumos/pdf-data', requireAuth, async (req,res) => {
  try {
    const db = await getDb();
    const p = await getPres(db, req.params.id);
    if (!p) return res.status(404).json({ error: 'Presupuesto no encontrado' });
    const [pN, pC, pU, pM] = p;
    const iR = db.exec(`
      SELECT c.nombre, i.codigo, i.descripcion, i.unidad, i.precio_unitario,
             SUM(ai.cantidad * pp.cantidad) as qt, SUM(ai.costo_parcial * pp.cantidad) as ct
      FROM presupuesto_partidas pp
      JOIN actividad_insumos ai ON pp.id_actividad = ai.id_actividad
      JOIN insumos i ON ai.id_insumo = i.id_insumo
      JOIN categorias_insumo c ON i.id_categoria = c.id_categoria
      WHERE pp.id_presupuesto = ?
      GROUP BY i.id_insumo ORDER BY c.id_categoria, i.descripcion`, [req.params.id]);
    const insumos = iR.length && iR[0].values.length ? iR[0].values.map(r => ({
      categoria: r[0], codigo: r[1], descripcion: r[2], unidad: r[3],
      precio_unitario: r[4], cantidad: r[5], costo_total: r[6]
    })) : [];
    const grand = insumos.reduce((s,i) => s + Number(i.costo_total||0), 0);
    res.json({ presupuesto: pN, cliente: pC, ubicacion: pU, moneda: pM, insumos, gran_total: grand });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PDF-DATA: EETT POR ACTIVIDAD ─────────────────────────
router.get('/presupuesto/:id/especificaciones/pdf-data', requireAuth, async (req,res) => {
  try {
    const db = await getDb();
    const p = await getPres(db, req.params.id);
    if (!p) return res.status(404).json({ error: 'Presupuesto no encontrado' });
    const [pN, pC, pU, pM] = p;
    const actsR = db.exec(`
      SELECT DISTINCT a.codigo, a.descripcion, a.unidad, a.costo_total
      FROM presupuesto_partidas pp
      JOIN actividades a ON pp.id_actividad = a.id_actividad
      WHERE pp.id_presupuesto = ? ORDER BY a.codigo`, [req.params.id]);
    if (!actsR.length || !actsR[0].values.length)
      return res.status(400).json({ error: 'Sin actividades' });

    const actividades = [];
    for (const [aCod, aDesc, aUnid, aTotal] of actsR[0].values) {
      const eR = db.exec(
        `SELECT codigo, nombre, unidad, descripcion, consideraciones, criterios_pago
         FROM especificaciones_fhis WHERE codigo = ?`, [aCod]);
      const spec = eR.length && eR[0].values.length ? {
        nombre: eR[0].values[0][1], descripcion: eR[0].values[0][3],
        consideraciones: eR[0].values[0][4], criterios_pago: eR[0].values[0][5]
      } : null;
      actividades.push({ codigo: aCod, descripcion: aDesc, unidad: aUnid, costo_total: aTotal, spec });
    }
    res.json({ presupuesto: pN, cliente: pC, ubicacion: pU, moneda: pM, actividades });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PDF-DATA: COTIZACIÓN DE INSUMOS ──────────────────────
router.get('/insumos/cotizacion/pdf-data', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const filtro = req.query.filtro || 'todos';
    let where = '';
    if (filtro === 'sin_precio') where = 'WHERE i.precio_unitario = 0 OR i.precio_unitario IS NULL';
    else if (filtro === 'con_precio') where = 'WHERE i.precio_unitario > 0';
    const r = db.exec(`
      SELECT c.nombre, i.codigo, i.descripcion, i.unidad, i.precio_unitario
      FROM insumos i
      JOIN categorias_insumo c ON i.id_categoria = c.id_categoria
      ${where} ORDER BY c.id_categoria, i.descripcion`);
    const insumos = r.length && r[0].values.length ? r[0].values.map(v => ({
      categoria: v[0], codigo: v[1], descripcion: v[2], unidad: v[3], precio_unitario: v[4]
    })) : [];
    res.json({ filtro, insumos, fecha: new Date().toLocaleDateString('es-HN') });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════
//  HTML COMPLETO GENERADO EN SERVIDOR — sin dependencia de caché JS
// ══════════════════════════════════════════════════════════════════

// Helper: leer config del sistema
function getCfg(db) {
  const get = (clave, def) => {
    try {
      const r = db.exec('SELECT valor FROM configuracion_sistema WHERE clave=?', [clave]);
      if (r.length && r[0].values.length && r[0].values[0][0] !== null)
        return r[0].values[0][0];
    } catch(e) {}
    return def;
  };
  const empresa = {
    nombre:    get('empresa_nombre',    ''),
    subtitulo: get('empresa_subtitulo', ''),
    rtn:       get('empresa_rtn',       ''),
    telefono:  get('empresa_telefono',  ''),
    correo:    get('empresa_correo',    ''),
    direccion: get('empresa_direccion', ''),
  };
  const mostrarFecha        = get('reporte_mostrar_fecha',    '0') !== '0';
  const fichasMostrarEmpresa = get('ficha_mostrar_empresa',   '1') !== '0';
  return { empresa, mostrarFecha, fichasMostrarEmpresa };
}

// Helper: formatear número en lempiras
function fmtL(n) {
  return 'L ' + Number(n||0).toLocaleString('es-HN', {minimumFractionDigits:2, maximumFractionDigits:2});
}

// Helper: CSS compartido para todos los reportes HTML
const REPORT_CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:11px;color:#222;background:#fff}
  @page{
    margin:18mm 12mm 12mm 12mm;
    size:letter;
    /* Eliminar encabezado y pie del browser (fecha/hora/URL) */
    @top-left{content:none}
    @top-center{content:none}
    @top-right{content:none}
    @bottom-left{content:none}
    @bottom-center{content:none}
    @bottom-right{content:none}
  }
  @media print{
    body{padding:0}
    .no-print{display:none!important}
    /* Ocultar fecha/hora y URL que imprime el browser */
    html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .page-header-print{display:block!important}
  }
  @media screen{body{padding:16px;max-width:960px;margin:auto}}
  /* Encabezado que se repite en cada página al imprimir */
  .page-header-print{
    display:none;
    position:running(pageHeader);
    background:#025196;color:#fff;
    padding:7px 16px;
    font-size:11px;font-weight:700;
    width:100%;
  }
  .logo-bar{background:#025196;color:#fff;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:0}
  .logo-bar h1{font-size:13px;font-weight:700;letter-spacing:.3px}
  .logo-bar small{font-size:10px;opacity:.8}
  .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px;border:1px solid #025196;padding:6px 14px;background:#f0f5fb;margin-bottom:0}
  .meta-item{font-size:10px}.meta-label{font-weight:700;color:#025196}
  table{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:10.5px}
  thead th{background:#025196;color:#fff;padding:6px 7px;text-align:left;font-size:10px;white-space:nowrap}
  tbody td{padding:5px 7px;border-bottom:1px solid #e8e8e8}
  tbody tr:nth-child(even) td{background:#f7f9fc}
  .cat-hdr td{background:#FDB338!important;font-weight:700;font-size:11px;color:#333;padding:6px 7px}
  .subtotal td{background:#dce8f5!important;font-weight:700;color:#025196}
  .grand-total td{background:#025196!important;color:#fff!important;font-weight:700;font-size:12px}
  .ficha-box{border:1px solid #ddd;border-radius:4px;margin-bottom:16px;break-inside:avoid;page-break-inside:avoid;break-before:auto}
  .ficha-box+.ficha-box{break-before:page;page-break-before:always}
  .ficha-hdr{background:#025196;color:#fff;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;break-after:avoid;page-break-after:avoid}
  .ficha-hdr .code{font-family:monospace;font-size:13px;font-weight:700}
  .ficha-hdr .name{font-size:11px;flex:1;margin:0 12px}
  .ficha-hdr .unit{background:#FDB338;color:#333;padding:3px 10px;border-radius:3px;font-weight:700;font-size:11px}
  .ficha-section{margin-bottom:10px}
  .ficha-section h4{font-size:10px;font-weight:700;color:#025196;text-transform:uppercase;margin-bottom:5px}
  .ficha-section p{font-size:10.5px;line-height:1.6;text-align:justify}
  .section-title{font-size:11px;font-weight:700;color:#025196;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid #025196;padding-bottom:3px;margin:14px 0 8px}
  .ficha-body{padding:10px 12px}
  .ins-table{width:100%;border-collapse:collapse;font-size:10px;margin-top:4px}
  .ins-table th{background:#8C9BAD;color:#fff;padding:4px 6px}
  .ins-table td{padding:3px 6px;border-bottom:1px solid #eee}
  .ins-table tr:nth-child(even) td{background:#f9f9f9}
  .resumen{max-width:340px;margin:10px 0 0 auto;border:1px solid #025196;border-radius:4px;overflow:hidden;font-size:10px}
  .res-row{display:flex;justify-content:space-between;padding:5px 10px;border-bottom:1px solid #ddd}
  .res-row.alt{background:#f0f5fb}
  .res-row.grand{background:#025196;color:#fff;font-weight:700;font-size:12px;padding:7px 10px;border:none}
  .totales-box{max-width:320px;margin-left:auto;border:1px solid #025196;border-radius:4px;overflow:hidden;margin-bottom:14px}
  .total-row{display:flex;justify-content:space-between;padding:5px 12px;font-size:11px}
  .total-row.hl{background:#f0f5fb}
  .total-row.grand{background:#025196;color:#fff;font-weight:700;font-size:13px;padding:8px 12px}
  .footer{margin-top:16px;border-top:1px solid #ccc;padding-top:8px;font-size:9px;color:#888;display:flex;justify-content:space-between}
  .print-btn{position:fixed;bottom:20px;right:20px;background:#025196;color:#fff;border:none;padding:12px 20px;border-radius:6px;font-size:13px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.25)}
  .print-btn:hover{background:#FDB338;color:#333}
  /* ── Encabezado repetido en cada página al imprimir ── */
  @media print {
    .print-header-fixed { display: contents; }
    .print-top-spacer { display: none; }
  }
  @media screen {
    .print-top-spacer { display: none; }
    .print-header-fixed { display: contents; }
  }
  /* Tabla exterior que permite repetir thead en cada página */
  .report-table { width:100%; border-collapse:collapse; }
  .report-thead td { padding:0; }
  .report-tbody td { padding:0; vertical-align:top; }`;

function htmlWrap(titulo, body, empresa, mostrarFecha) {
  const empNombre = (typeof empresa === 'object') ? (empresa.nombre || '') : (empresa || '');
  const fechaPie = mostrarFecha ? '<span>' + new Date().toLocaleString('es-HN') + '</span>' : '';
  const footerTxt = empNombre ? ('Generado por Sistema de Costos Unitarios — ' + empNombre) : 'Sistema de Costos Unitarios';
  const footer = '<div class="footer"><span>' + footerTxt + '</span>' + fechaPie + '</div>';
  const html = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">'
    + '<title>' + titulo + '</title>'
    + '<style>' + REPORT_CSS + '</style></head><body>'
    + body
    + footer
    + '<button class="print-btn no-print" onclick="window.print()">\uD83D\uDDA8\uFE0F Imprimir / Guardar PDF</button>'
    + '<script>'
    + 'window.onbeforeprint=function(){document.title=""};'
    + 'window.onafterprint=function(){document.title="' + titulo.replace(/"/g,'\"') + '"};'
    + 'window.onload=function(){window.print();};'
    + '<\/script>'
    + '</body></html>';
  return html;
}

function htmlHeader(titulo, subtitulo, empresa, mostrarFecha) {
  const fechaStr = mostrarFecha ? new Date().toLocaleDateString('es-HN') : '';
  const sub = subtitulo ? '<small>' + subtitulo + '</small>' : '';

  // Construir bloque de empresa (compatible con string legacy o con objeto {nombre,rtn,...})
  let empHtml = '';
  if (empresa && typeof empresa === 'object') {
    const lineas = [];
    if (empresa.nombre)    lineas.push('<strong>' + empresa.nombre + '</strong>');
    if (empresa.subtitulo) lineas.push(empresa.subtitulo);
    if (empresa.rtn)       lineas.push('RTN: ' + empresa.rtn);
    const contacto = [empresa.telefono, empresa.correo, empresa.direccion].filter(Boolean).join(' &nbsp;|&nbsp; ');
    if (contacto) lineas.push(contacto);
    if (fechaStr) lineas.push(fechaStr);
    empHtml = lineas.length ? '<div style="text-align:right;line-height:1.55;font-size:10px">' + lineas.join('<br>') + '</div>' : '';
  } else {
    const empStr = empresa || '';
    empHtml = '<small>' + empStr + (fechaStr ? '&nbsp;|&nbsp;' + fechaStr : '') + '</small>';
  }

  return '<div class="logo-bar"><div><h1>' + titulo + '</h1>' + sub + '</div>' + empHtml + '</div>';
}

function htmlMeta(campos) {
  return `<div class="meta-grid">${campos.map(([k,v])=>`<div class="meta-item"><span class="meta-label">${k}:</span> ${v||'—'}</div>`).join('')}</div>`;
}

// ── HTML: PRESUPUESTO ─────────────────────────────────────
router.get('/presupuesto/:id/html', requireAuth, async (req,res) => {
  try {
    const db  = await getDb();
    const cfg = getCfg(db);
    const pr  = db.exec(`
      SELECT p.nombre, p.costos_directos, p.costos_indirectos, p.utilidad, p.imprevistos,
             p.total_general, p.porcentaje_indirectos, p.porcentaje_utilidad, p.porcentaje_imprevistos,
             p.ubicacion, p.cliente
      FROM presupuestos p
      WHERE p.id_presupuesto=?`,[req.params.id]);
    if (!pr.length||!pr[0].values.length) return res.status(404).send('<h3>No encontrado</h3>');
    const [nombre,cd,ci,util,impr,tot,pctInd,pctUtil,pctImpr,pU,pC] = pr[0].values[0];

    const partR = db.exec(`
      SELECT a.codigo, a.descripcion, a.unidad, pp.cantidad, pp.precio_unitario, pp.subtotal, c.nombre
      FROM presupuesto_partidas pp
      JOIN actividades a ON pp.id_actividad=a.id_actividad
      LEFT JOIN modulos c ON pp.id_modulo=c.id_modulo
      WHERE pp.id_presupuesto=? ORDER BY COALESCE(c.orden_visual,999), a.codigo`,[req.params.id]);
    const parts = partR.length ? partR[0].values : [];

    // Agrupar por módulo
    const caps = {};
    for (const p of parts) { const cap=p[6]||'General'; if(!caps[cap]) caps[cap]=[]; caps[cap].push(p); }

    let filas='', item=0;
    for (const [cap, rows] of Object.entries(caps)) {
      const subCap = rows.reduce((s,p)=>s+Number(p[5]||0),0);
      if (Object.keys(caps).length>1)
        filas += `<tr class="cat-hdr"><td colspan="7">${cap}</td></tr>`;
      for (const p of rows) {
        item++;
        filas += `<tr>
          <td style="text-align:center">${item}</td>
          <td style="font-family:monospace;color:#025196;font-size:10px">${p[0]||''}</td>
          <td>${p[1]}</td><td style="text-align:center">${p[2]}</td>
          <td style="text-align:right">${Number(p[3]).toFixed(2)}</td>
          <td style="text-align:right">${fmtL(p[4])}</td>
          <td style="text-align:right">${fmtL(p[5])}</td></tr>`;
      }
      if (Object.keys(caps).length>1)
        filas += `<tr class="subtotal"><td colspan="6" style="text-align:right">Subtotal ${cap}</td><td style="text-align:right">${fmtL(subCap)}</td></tr>`;
    }

    const tabla = `<table><thead><tr>
      <th style="text-align:center;width:35px">N°</th><th>Código</th><th>Descripción</th>
      <th style="text-align:center">Unidad</th><th style="text-align:right">Cantidad</th>
      <th style="text-align:right">P. Unitario</th><th style="text-align:right">Subtotal</th>
      </tr></thead><tbody>${filas}</tbody></table>`;

    const totalesBox = `<div class="totales-box">
      <div class="total-row hl"><span>Costos Directos</span><span>${fmtL(cd)}</span></div>
      <div class="total-row"><span>Costos Indirectos (${pctInd||0}%)</span><span>${fmtL(ci)}</span></div>
      <div class="total-row hl"><span>Utilidad (${pctUtil||0}%)</span><span>${fmtL(util)}</span></div>
      <div class="total-row"><span>Imprevistos (${pctImpr||0}%)</span><span>${fmtL(impr)}</span></div>
      <div class="total-row grand"><span>TOTAL GENERAL</span><span>${fmtL(tot)}</span></div>
    </div>`;

    const body = htmlHeader('PRESUPUESTO DE OBRA', nombre, cfg.empresa, cfg.mostrarFecha)
      + htmlMeta([['Presupuesto',nombre],['Cliente',pC],['Ubicación',pU]])
      + tabla + totalesBox;

    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.send(htmlWrap(`Presupuesto — ${nombre}`, body, cfg.empresa, cfg.mostrarFecha));
  } catch(e) { res.status(500).send(`<h3>Error: ${e.message}</h3>`); }
});

// ── HTML: FICHAS POR PRESUPUESTO ────────────────────────────
router.get('/presupuesto/:id/fichas/html', requireAuth, async (req,res) => {
  try {
    const db  = await getDb();
    const cfg = getCfg(db);
    const pr  = await getPres(db, req.params.id);
    if (!pr) return res.status(404).send('<h3>Presupuesto no encontrado</h3>');
    const [pN,pC,pU,pM,pctInd,pctUtil,pctImpr] = pr;

    const actsR = db.exec(`
      SELECT a.id_actividad, a.codigo, a.descripcion, a.unidad, a.costo_total, pp.cantidad
      FROM presupuesto_partidas pp
      JOIN actividades a ON pp.id_actividad=a.id_actividad
      WHERE pp.id_presupuesto=? ORDER BY a.codigo`, [req.params.id]);

    if (!actsR.length || !actsR[0].values.length)
      return res.status(400).send('<h3>Sin actividades en este presupuesto</h3>');

    let fichasHTML = '';
    for (const [aId, aCod, aDesc, aUnid, aTotal, aCant] of actsR[0].values) {
      const cant = Number(aCant||1);
      const dR = db.exec(`
        SELECT i.codigo, i.descripcion, i.unidad, ai.cantidad, ai.rendimiento, ai.desperdicio,
               i.precio_unitario, ai.costo_parcial, c.nombre
        FROM actividad_insumos ai
        JOIN insumos i ON ai.id_insumo=i.id_insumo
        JOIN categorias_insumo c ON i.id_categoria=c.id_categoria
        WHERE ai.id_actividad=? ORDER BY c.id_categoria, i.descripcion`, [aId]);
      const insumos = dR.length && dR[0].values.length ? dR[0].values : [];
      const cats = {};
      for (const ins of insumos) { const cat=ins[8]; if(!cats[cat]) cats[cat]=[]; cats[cat].push(ins); }
      let insHTML = '';
      if (insumos.length) {
        insHTML = `<table class="ins-table"><thead><tr>
          <th>Código</th><th>Descripción</th><th>Unid</th>
          <th style="text-align:right">Cant.Unit.</th><th style="text-align:right">Cant.Pres.</th>
          <th style="text-align:right">P.Unit.</th><th style="text-align:right">C.Parcial</th>
          </tr></thead><tbody>`;
        for (const [cat, items] of Object.entries(cats)) {
          const sub = items.reduce((s,i)=>s+Number(i[7]||0),0);
          insHTML += `<tr><td colspan="7" style="background:#dce8f5;font-weight:700;color:#025196;font-size:10px">▸ ${cat}</td></tr>`;
          for (const i of items) {
            insHTML += `<tr>
              <td style="font-family:monospace;color:#025196">${i[0]}</td>
              <td>${i[1]}</td><td>${i[2]}</td>
              <td style="text-align:right">${Number(i[3]).toFixed(4)}</td>
              <td style="text-align:right;font-weight:700;color:#333">${cant.toFixed(2)}</td>
              <td style="text-align:right">${fmtL(i[6])}</td>
              <td style="text-align:right">${fmtL(i[7])}</td></tr>`;
          }
          insHTML += `<tr><td colspan="6" style="text-align:right;font-weight:700;color:#025196;font-size:10px">Subtotal ${cat}</td>
            <td style="text-align:right;font-weight:700;color:#025196">${fmtL(sub)}</td></tr>`;
        }
        insHTML += `<tr style="background:#025196"><td colspan="6" style="color:#fff;font-weight:700;text-align:right">COSTO DIRECTO UNITARIO</td>
          <td style="color:#fff;font-weight:700;text-align:right">${fmtL(aTotal)}</td></tr>`;
        insHTML += '</tbody></table>';
      }
      const cd=Number(aTotal||0), ci=cd*(pctInd||15)/100, util=cd*(pctUtil||10)/100, impr=cd*(pctImpr||5)/100, tot=cd+ci+util+impr;
      const resumen = `<div class="resumen" style="max-width:480px;margin-left:auto">
        <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:0">
          <thead><tr>
            <th style="background:#8C9BAD;color:#fff;padding:5px 10px;text-align:left">Concepto</th>
            <th style="background:#8C9BAD;color:#fff;padding:5px 10px;text-align:right">P. Unitario</th>
            <th style="background:#8C9BAD;color:#fff;padding:5px 10px;text-align:right">Cant: ${cant.toFixed(2)} ${aUnid}</th>
            <th style="background:#8C9BAD;color:#fff;padding:5px 10px;text-align:right">Subtotal</th>
          </tr></thead>
          <tbody>
            <tr style="background:#f0f5fb"><td style="padding:4px 10px">Costos Directos</td><td style="text-align:right;padding:4px 10px">${fmtL(cd)}</td><td style="text-align:right;padding:4px 10px">${cant.toFixed(2)}</td><td style="text-align:right;padding:4px 10px">${fmtL(cd*cant)}</td></tr>
            <tr><td style="padding:4px 10px">Costos Indirectos (${pctInd||15}%)</td><td style="text-align:right;padding:4px 10px">${fmtL(ci)}</td><td style="text-align:right;padding:4px 10px">${cant.toFixed(2)}</td><td style="text-align:right;padding:4px 10px">${fmtL(ci*cant)}</td></tr>
            <tr style="background:#f0f5fb"><td style="padding:4px 10px">Utilidad (${pctUtil||10}%)</td><td style="text-align:right;padding:4px 10px">${fmtL(util)}</td><td style="text-align:right;padding:4px 10px">${cant.toFixed(2)}</td><td style="text-align:right;padding:4px 10px">${fmtL(util*cant)}</td></tr>
            <tr><td style="padding:4px 10px">Imprevistos (${pctImpr||5}%)</td><td style="text-align:right;padding:4px 10px">${fmtL(impr)}</td><td style="text-align:right;padding:4px 10px">${cant.toFixed(2)}</td><td style="text-align:right;padding:4px 10px">${fmtL(impr*cant)}</td></tr>
            <tr style="background:#025196"><td style="padding:6px 10px;color:#fff;font-weight:700">TOTAL GENERAL</td><td style="text-align:right;padding:6px 10px;color:#fff;font-weight:700">${fmtL(tot)}</td><td style="text-align:right;padding:6px 10px;color:#fff;font-weight:700">${cant.toFixed(2)}</td><td style="text-align:right;padding:6px 10px;color:#fff;font-weight:700;font-size:12px">${fmtL(tot*cant)}</td></tr>
          </tbody>
        </table>
      </div>`;
      // Bloque derecho del encabezado: empresa (si está activado) o cliente/ubicación
      let bloqueDerechoFicha = '';
      if (cfg.fichasMostrarEmpresa && cfg.empresa && cfg.empresa.nombre) {
        const emp = cfg.empresa;
        const lineas = [];
        if (emp.nombre)   lineas.push('<strong>' + emp.nombre + '</strong>');
        if (emp.subtitulo) lineas.push(emp.subtitulo);
        if (emp.rtn)      lineas.push('RTN: ' + emp.rtn);
        const contacto = [emp.telefono, emp.correo].filter(Boolean).join('  |  ');
        if (contacto)     lineas.push(contacto);
        bloqueDerechoFicha = '<div style="text-align:right;font-size:9px;line-height:1.6">' + lineas.join('<br>') + '</div>';
      } else {
        bloqueDerechoFicha = '<div style="text-align:right;font-size:9px">' + pC + ' | ' + pU + '</div>';
      }

      const headerFicha = '<div class="logo-bar" style="margin-bottom:0;font-size:10px">'
        + '<div><strong>FICHAS DE COSTOS UNITARIOS</strong> &nbsp;|&nbsp; ' + pN + '</div>'
        + bloqueDerechoFicha
        + '</div>'
        + '<div style="background:#025196;color:#fff;padding:6px 12px;display:flex;justify-content:space-between;align-items:center;font-size:11px">'
        + '<span style="font-family:monospace;font-weight:700;font-size:13px">' + aCod + '</span>'
        + '<span style="flex:1;margin:0 12px">' + aDesc + '</span>'
        + '<span style="background:#FDB338;color:#333;padding:2px 8px;border-radius:3px;font-weight:700">' + aUnid + ' &times; ' + cant.toFixed(2) + '</span>'
        + '</div>'
        + '<div style="background:#f0f5fb;border:1px solid #025196;border-top:none;padding:4px 12px;font-size:9px;display:grid;grid-template-columns:1fr 1fr;gap:2px">'
        + '<span><strong style="color:#025196">Presupuesto:</strong> ' + pN + '</span>'
        + '<span><strong style="color:#025196">Cliente:</strong> ' + pC + '</span>'
        + '<span><strong style="color:#025196">Ubicación:</strong> ' + pU + '</span>'
        + '</div>';

      fichasHTML += '<table class="report-table" style="page-break-before:' + (fichasHTML ? 'always' : 'auto') + '">'
        + '<thead class="report-thead"><tr><td>' + headerFicha + '</td></tr></thead>'
        + '<tbody class="report-tbody"><tr><td>'
        + '<div class="ficha-body">' + insHTML + resumen + '</div>'
        + '</td></tr></tbody>'
        + '</table>'
        + '<div style="height:8px"></div>';
    }
    const body = fichasHTML;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.send(htmlWrap(`Fichas — ${pN}`, body, cfg.empresa, cfg.mostrarFecha));
  } catch(e) { res.status(500).send(`<h3>Error: ${e.message}</h3>`); }
});

// ── HTML: INSUMOS POR PRESUPUESTO ───────────────────────────
router.get('/presupuesto/:id/insumos/html', requireAuth, async (req,res) => {
  try {
    const db  = await getDb();
    const cfg = getCfg(db);
    const pr  = await getPres(db, req.params.id);
    if (!pr) return res.status(404).send('<h3>Presupuesto no encontrado</h3>');
    const [pN,pC,pU,pM] = pr;

    const iR = db.exec(`
      SELECT c.nombre, i.codigo, i.descripcion, i.unidad, i.precio_unitario,
             SUM(ai.cantidad*pp.cantidad), SUM(ai.costo_parcial*pp.cantidad)
      FROM presupuesto_partidas pp
      JOIN actividad_insumos ai ON pp.id_actividad=ai.id_actividad
      JOIN insumos i ON ai.id_insumo=i.id_insumo
      JOIN categorias_insumo c ON i.id_categoria=c.id_categoria
      WHERE pp.id_presupuesto=?
      GROUP BY i.id_insumo ORDER BY c.id_categoria, i.descripcion`,[req.params.id]);

    const insumos = iR.length && iR[0].values.length ? iR[0].values : [];
    const cats = {};
    for (const ins of insumos) { const cat=ins[0]; if(!cats[cat]) cats[cat]=[]; cats[cat].push(ins); }
    let filas='', grand=0;
    for (const [cat, items] of Object.entries(cats)) {
      const sub = items.reduce((s,i)=>s+Number(i[6]||0),0);
      filas += `<tr class="cat-hdr"><td colspan="6">${cat}</td></tr>`;
      for (const i of items) {
        filas += `<tr>
          <td style="font-family:monospace;color:#025196;font-size:10px">${i[1]}</td>
          <td>${i[2]}</td><td style="text-align:center">${i[3]}</td>
          <td style="text-align:right">${fmtL(i[4])}</td>
          <td style="text-align:right">${Number(i[5]).toFixed(4)}</td>
          <td style="text-align:right">${fmtL(i[6])}</td></tr>`;
      }
      filas += `<tr class="subtotal"><td colspan="5" style="text-align:right">Subtotal ${cat}</td><td style="text-align:right">${fmtL(sub)}</td></tr>`;
      grand += sub;
    }
    filas += `<tr class="grand-total"><td colspan="5" style="text-align:right">COSTO TOTAL DE INSUMOS</td><td style="text-align:right">${fmtL(grand)}</td></tr>`;
    const tabla = `<table><thead><tr>
      <th>Código</th><th>Descripción</th><th style="text-align:center">Unidad</th>
      <th style="text-align:right">P. Unitario</th>
      <th style="text-align:right">Cantidad Total</th>
      <th style="text-align:right">Costo Total</th>
      </tr></thead><tbody>${filas}</tbody></table>`;
    const body = htmlHeader('LISTADO DE INSUMOS', pN, cfg.empresa, cfg.mostrarFecha)
      + htmlMeta([['Presupuesto',pN],['Cliente',pC],['Ubicación',pU]])
      + tabla;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.send(htmlWrap(`Insumos — ${pN}`, body, cfg.empresa, cfg.mostrarFecha));
  } catch(e) { res.status(500).send(`<h3>Error: ${e.message}</h3>`); }
});

// ── HTML: EETT POR ACTIVIDAD x PRESUPUESTO ──────────────────
router.get('/presupuesto/:id/especificaciones/html', requireAuth, async (req,res) => {
  try {
    const db  = await getDb();
    const cfg = getCfg(db);
    const pr  = await getPres(db, req.params.id);
    if (!pr) return res.status(404).send('<h3>Presupuesto no encontrado</h3>');
    const [pN,pC,pU] = pr;

    const actsR = db.exec(`
      SELECT DISTINCT a.codigo, a.descripcion, a.unidad, a.costo_total
      FROM presupuesto_partidas pp
      JOIN actividades a ON pp.id_actividad=a.id_actividad
      WHERE pp.id_presupuesto=? ORDER BY a.codigo`, [req.params.id]);

    if (!actsR.length || !actsR[0].values.length)
      return res.status(400).send('<h3>Sin actividades en este presupuesto</h3>');

    let fichasHTML = '';
    for (const [aCod, aDesc, aUnid] of actsR[0].values) {
      const eR = db.exec(
        `SELECT descripcion, consideraciones, criterios_pago FROM especificaciones_fhis WHERE codigo=?`, [aCod]);
      const spec = eR.length && eR[0].values.length ? eR[0].values[0] : null;
      fichasHTML += `<div class="ficha-box">
        <div class="ficha-hdr">
          <span class="code">${aCod}</span>
          <span class="name">${aDesc}</span>
          <span class="unit">${aUnid}</span>
        </div>
        <div class="ficha-body">
          ${spec ? `
            <div class="ficha-section"><h4>Descripción de la actividad</h4><p>${spec[0]||'—'}</p></div>
            <div class="ficha-section"><h4>Consideraciones del análisis de costo</h4><p>${spec[1]||'—'}</p></div>
            <div class="ficha-section"><h4>Criterios de medición y pago</h4><p>${spec[2]||'—'}</p></div>`
          : `<p style="color:#888;font-size:10px;font-style:italic">Especificación técnica no disponible para código ${aCod}. Descripción: ${aDesc}</p>`}
        </div>
      </div>`;
    }
    const body = htmlHeader('ESPECIFICACIONES TÉCNICAS POR ACTIVIDAD', pN, cfg.empresa, cfg.mostrarFecha)
      + htmlMeta([['Presupuesto',pN],['Cliente',pC],['Ubicación',pU],['Fuente','Especificaciones FHIS — agosto 2007']])
      + fichasHTML;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.send(htmlWrap(`EETT — ${pN}`, body, cfg.empresa, cfg.mostrarFecha));
  } catch(e) { res.status(500).send(`<h3>Error: ${e.message}</h3>`); }
});

// ── HTML: EETT GENERALES (texto estático) ────────────────
router.get('/especificaciones/generales/html', requireAuth, async (req,res) => {
  try {
    const db  = await getDb();
    const cfg = getCfg(db);
    const fecha = new Date().toLocaleDateString('es-HN');

    const secciones = [
      ['1. NORMATIVA APLICABLE',
       'Las presentes especificaciones técnicas se rigen por: Ley de Contratación del Estado (Decreto 74-2001), Reglamento General de la Ley de Municipalidades (Decreto 134-90), normas ACI 318 para concreto estructural, normas ASTM para materiales de construcción, normas AWWA para sistemas de agua potable, Normas Técnicas de SANAA para sistemas de agua y saneamiento en Honduras, y Manual de Especificaciones Técnicas de Actividades (agosto 2007).'],
      ['2. ESPECIFICACIONES DE MATERIALES',
       'CEMENTO: Se utilizará cemento Portland Tipo I o Tipo II, conforme a ASTM C-150. El cemento debe almacenarse en bodegas secas sobre tarimas. No se aceptará cemento con grumos o parcialmente fraguado. ACERO DE REFUERZO: Varilla corrugada grado 40 (Fy=2,800 kg/cm²) o grado 60 (Fy=4,200 kg/cm²) según diseño, conforme a ASTM A-615. AGREGADOS: Arena de río limpia, libre de arcillas y materia orgánica. Grava o piedra triturada de granulometría uniforme. Tamaño máximo del agregado grueso no mayor a 1/3 del espesor del elemento estructural. AGUA: Potable, libre de aceites, ácidos, álcalis o materias orgánicas. TUBERÍAS PVC: Conforme a ASTM D-1785 (presión) y ASTM D-3034 (drenaje). Las tuberías de agua potable deben cumplir NSF/ANSI 61.'],
      ['3. PROCEDIMIENTOS DE EJECUCIÓN',
       'TRAZO Y REPLANTEO: Toda obra civil iniciará con replanteo topográfico por Ingeniero o Topógrafo calificado, dejando referencias permanentes para control de niveles y alineamientos. EXCAVACIONES: Las excavaciones se ejecutarán conforme a los planos aprobados. En suelos inestables se requerirá entibado o taludes adecuados. Se prohíbe circular equipo pesado a menos de 1.0 m del borde de excavación. CONCRETO: El concreto se producirá con mezcladoras mecánicas. La mezcla manual solo se permite para concreto no estructural. El vaciado debe ser continuo sin interrupciones que causen juntas frías. El curado mínimo es de 7 días con agua. MAMPOSTERÍA: Los bloques de concreto deben tener resistencia mínima de 55 kg/cm². La mezcla de pega será proporción 1:4 (cemento:arena). El espesor de juntas horizontales y verticales será de 10-15 mm. INSTALACIONES HIDRÁULICAS: Las tuberías de PVC se instalarán con accesorios del mismo material y fabricante. Las uniones solventadas requieren limpieza previa con primer. El relleno sobre tuberías se ejecutará en capas de 15 cm compactadas manualmente.'],
      ['4. CONTROL DE CALIDAD',
       'CONCRETO: Se realizarán ensayos de resistencia a la compresión conforme a ASTM C-39. Mínimo un juego de 3 cilindros por cada 10 m³ vaciados. La resistencia de diseño debe alcanzarse a los 28 días. COMPACTACIÓN: El control de compactación de rellenos se verificará por ensayo Proctor Estándar (ASTM D-698). La compactación mínima será del 95% del Proctor en áreas exteriores y 98% bajo estructuras. TUBERÍAS: Prueba hidrostática a 1.5 veces la presión de trabajo durante 2 horas sin pérdidas.'],
      ['5. SEGURIDAD E HIGIENE OCUPACIONAL',
       'El Contratista es responsable de la seguridad del personal según la Ley del IHSS y el Reglamento General de Medidas Preventivas de Accidentes de Trabajo y Enfermedades Profesionales. Todo el personal usará equipo de protección personal (EPP): casco, botas punta de acero, guantes y chaleco reflectivo. Las excavaciones mayores de 1.5 m de profundidad requieren sistemas de protección contra derrumbes. Se mantendrá señalización perimetral y luminaria nocturna en toda la obra.'],
      ['6. MEDICIÓN Y PAGO',
       'Los trabajos se medirán y pagarán conforme a las unidades establecidas en el catálogo de precios del contrato. No se reconocerá trabajo adicional sin orden de cambio escrita y aprobada por la supervisión. Los precios unitarios son fijos durante la vigencia del contrato. Las demasías de materiales por desperdicio no justificado son a cargo del Contratista.']
    ];

    const seccionesHTML = secciones.map(([titulo, contenido]) =>
      `<div style="margin-bottom:18px;page-break-inside:avoid">
        <div class="section-title">${titulo}</div>
        <p style="font-size:11px;line-height:1.75;text-align:justify">${contenido}</p>
      </div>`).join('');

    const nota = `<div style="margin-top:20px;padding:12px 14px;background:#fff3cd;border:1px solid #FDB338;border-radius:4px;font-size:10px;color:#555">
      <strong style="color:#025196">Nota:</strong> Las presentes especificaciones son de carácter general.
      Las especificaciones particulares de cada actividad del catálogo prevalecen sobre estas.
      La revisión técnica por el Ingeniero responsable del proyecto es obligatoria antes de su aplicación.
    </div>`;

    const body = htmlHeader('ESPECIFICACIONES TÉCNICAS GENERALES', 'Proyectos de Construcción — Honduras', cfg.empresa, cfg.mostrarFecha)
      + htmlMeta([
          ['Normas de referencia','SOPTRAVI/INSEP, SANAA, ACI, ASTM, AWWA'],
          ['Aplicación','Proyectos de infraestructura y edificaciones'],
          ['Fecha emisión', fecha],
          ['Vigencia','Verificar actualización normativa antes de aplicar']
        ])
      + seccionesHTML + nota;

    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.send(htmlWrap('EETT Generales', body, cfg.empresa, cfg.mostrarFecha));
  } catch(e) { res.status(500).send(`<h3>Error: ${e.message}</h3>`); }
});

// ── HTML: COTIZACIÓN DE INSUMOS ───────────────────────────
router.get('/insumos/cotizacion/html', requireAuth, async (req,res) => {
  try {
    const db   = await getDb();
    const cfg  = getCfg(db);
    const filtro = req.query.filtro || 'todos';
    const labels = { sin_precio:'Insumos sin precio (prioritario)', con_precio:'Insumos con precio (actualización)', todos:'Catálogo completo de insumos' };
    let where = '';
    if (filtro === 'sin_precio') where = 'WHERE i.precio_unitario = 0 OR i.precio_unitario IS NULL';
    else if (filtro === 'con_precio') where = 'WHERE i.precio_unitario > 0';

    const r = db.exec(`
      SELECT c.nombre, i.codigo, i.descripcion, i.unidad, i.precio_unitario
      FROM insumos i
      JOIN categorias_insumo c ON i.id_categoria=c.id_categoria
      ${where} ORDER BY c.id_categoria, i.descripcion`);

    const insumos = r.length && r[0].values.length ? r[0].values : [];
    const cats = {};
    for (const ins of insumos) { const cat=ins[0]; if(!cats[cat]) cats[cat]=[]; cats[cat].push(ins); }

    let filas='', n=0;
    for (const [cat, items] of Object.entries(cats)) {
      filas += `<tr class="cat-hdr"><td colspan="6">${cat}</td></tr>`;
      for (const i of items) {
        n++;
        const precio = (i[4] && Number(i[4])>0) ? fmtL(i[4]) : '<span style="color:#c00">Sin precio</span>';
        filas += `<tr>
          <td style="text-align:center;color:#888">${n}</td>
          <td style="font-family:monospace;color:#025196;font-size:10px">${i[1]}</td>
          <td>${i[2]}</td>
          <td style="text-align:center">${i[3]}</td>
          <td style="text-align:right">${precio}</td>
          <td style="background:#fffbe6;text-align:center;color:#888;font-style:italic">Anotar aquí</td></tr>`;
      }
    }

    const fecha = new Date().toLocaleDateString('es-HN');
    const tabla = `<table><thead><tr>
      <th style="text-align:center">N°</th><th>Código</th><th>Descripción</th>
      <th style="text-align:center">Unidad</th>
      <th style="text-align:right">Precio actual</th>
      <th style="background:#fffbe6;color:#333;text-align:center">Precio cotizado (L)</th>
      </tr></thead><tbody>${filas}</tbody></table>`;

    const instrucciones = `<div style="background:#e8f4fd;border-left:4px solid #025196;padding:10px 14px;border-radius:0 4px 4px 0;font-size:10px;margin-bottom:14px">
      <strong style="color:#025196">Instrucciones para el proveedor:</strong>
      Complete la columna <strong>"Precio cotizado"</strong> con el precio en Lempiras (L) incluyendo IVA.
      Indique también el nombre de su empresa/ferretería. Devuelva este documento al solicitante.
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;font-size:11px">
      <div style="border-top:1px solid #333;padding-top:8px;text-align:center">Firma del proveedor / Sello</div>
      <div style="border-top:1px solid #333;padding-top:8px;text-align:center">Nombre del proveedor / Ferretería</div>
    </div>`;

    const body = htmlHeader('LISTA DE COTIZACIÓN DE INSUMOS', labels[filtro]||filtro, cfg.empresa, cfg.mostrarFecha)
      + htmlMeta([
          ['Tipo', labels[filtro]||filtro],
          ['Total insumos', insumos.length.toLocaleString()],
          ['Fecha emisión', fecha],
          ['Instrucción','Complete la columna "Precio cotizado" y devuelva']
        ])
      + tabla + instrucciones;

    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.send(htmlWrap(`Cotización — ${labels[filtro]||filtro}`, body, cfg.empresa, cfg.mostrarFecha));
  } catch(e) { res.status(500).send(`<h3>Error: ${e.message}</h3>`); }
});

module.exports = router;

