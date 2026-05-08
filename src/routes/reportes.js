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
    const proyectos=N("SELECT COUNT(*) FROM proyectos WHERE estado='activo'");
    const insumos=N('SELECT COUNT(*) FROM insumos WHERE activo=1');
    const actividades=N('SELECT COUNT(*) FROM actividades');
    const presupuestos=N('SELECT COUNT(*) FROM presupuestos');
    const totalPresup=N('SELECT COALESCE(SUM(total_general),0) FROM presupuestos');
    const recR=db.exec(`SELECT p.nombre,p.cliente,p.ubicacion,p.estado,COUNT(pr.id_presupuesto),COALESCE(SUM(pr.total_general),0) FROM proyectos p LEFT JOIN presupuestos pr ON p.id_proyecto=pr.id_proyecto WHERE p.estado!='archivado' GROUP BY p.id_proyecto ORDER BY p.id_proyecto DESC LIMIT 5`);
    const hpR=db.exec(`SELECT i.descripcion,hp.precio_anterior,hp.precio_nuevo,hp.fecha_cambio FROM historial_precios hp JOIN insumos i ON hp.id_insumo=i.id_insumo ORDER BY hp.fecha_cambio DESC LIMIT 5`);
    res.json({
      stats:{proyectos,insumos,actividades,presupuestos,totalPresup},
      proyectosRecientes:recR.length?recR[0].values.map(r=>({nombre:r[0],cliente:r[1],ubicacion:r[2],estado:r[3],presupuestos:r[4],monto_total:r[5]})): [],
      cambiosPrecios:hpR.length?hpR[0].values.map(r=>({descripcion:r[0],precio_anterior:r[1],precio_nuevo:r[2],fecha_cambio:r[3]})):[]
    });
  }catch(e){res.status(500).json({error:e.message});}
});

// ── HELPER: get project ──
async function getProy(db,id){
  const r=db.exec('SELECT nombre,cliente,ubicacion,moneda FROM proyectos WHERE id_proyecto=?',[id]);
  return r.length&&r[0].values.length?r[0].values[0]:null;
}

// ── REPORTE 1: FICHAS DE COSTOS ────────────────────────────
router.get('/proyecto/:id/fichas', requireAuth, async (req,res)=>{
  try{
    const db=await getDb();
    const p=await getProy(db,req.params.id);
    if(!p) return res.status(404).json({error:'Proyecto no encontrado'});
    const [pN,pC,pU,pM]=p;
    const actsR=db.exec(`SELECT DISTINCT a.id_actividad,a.codigo,a.descripcion,a.unidad,a.costo_total FROM presupuesto_partidas pp JOIN presupuestos pr ON pp.id_presupuesto=pr.id_presupuesto JOIN actividades a ON pp.id_actividad=a.id_actividad WHERE pr.id_proyecto=? ORDER BY a.codigo`,[req.params.id]);
    if(!actsR.length||!actsR[0].values.length) return res.status(400).json({error:'Sin actividades en este proyecto'});

    const wb=new ExcelJS.Workbook();
    const ws=wb.addWorksheet('FICHAS');
    ws.views=[{showGridLines:false}];
    [14,38,8,11,11,10,14,14,12].forEach((w,i)=>ws.getColumn(i+1).width=w);

    titleBlock(ws,`FICHAS DE COSTOS UNITARIOS — ${pN}`,'I',32);
    const inf=ws.addRow([`Cliente: ${pC||'—'}`,,,`Ubicación: ${pU||'—'}`,,,`Moneda: ${pM} | Fecha: ${new Date().toLocaleDateString('es-HN')}`,,'']);
    inf.eachCell(c=>{c.font={size:9,name:'Calibri'};});
    ws.addRow([`Precios de referencia: CHICO / Larach y Cía Honduras 2025-2026`]);
    ws.mergeCells(`A${ws.rowCount}:I${ws.rowCount}`);
    ws.lastRow.getCell(1).font={size:8,italic:true,color:{argb:'FF888888'},name:'Calibri'};
    ws.addRow([]);

    for(const [aId,aCod,aDesc,aUnid,aTotal] of actsR[0].values){
      ws.addRow([]);
      const ar=ws.addRow([`${aCod}`,aDesc,,,,`Unidad: ${aUnid}`,,`${pM} ${Number(aTotal).toFixed(2)}`,'']);
      ws.mergeCells(`B${ar.number}:E${ar.number}`);
      ar.height=20;
      ['A','B','F','G','H'].forEach(col=>{ const c=ar.getCell(col); c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_BLUE}}; c.font={bold:true,size:10,color:{argb:C_WHITE},name:'Calibri'}; c.alignment={vertical:'middle'}; });

      const hr=ws.addRow(['Cód.Insumo','Descripción','Unid','Cantidad','Rendto','Desp%',`P.Unit.(${pM})`,`C.Parcial(${pM})`,'Tipo']);
      hr.height=16; hr.eachCell(c=>hdr(c,C_ORANGE,'FF333333'));

      const dR=db.exec(`SELECT ai.cantidad,ai.rendimiento,ai.desperdicio,ai.costo_parcial,i.codigo,i.descripcion,i.unidad,i.precio_unitario,c.nombre,c.id_categoria FROM actividad_insumos ai JOIN insumos i ON ai.id_insumo=i.id_insumo JOIN categorias_insumo c ON i.id_categoria=c.id_categoria WHERE ai.id_actividad=? ORDER BY c.id_categoria,i.descripcion`,[aId]);
      if(dR.length&&dR[0].values.length){
        let lastCat=null,catT=0,rowI=0;
        for(const [cant,rend,desp,cp,iCod,iDesc,iUnid,iP,iCat] of dR[0].values){
          if(iCat!==lastCat){
            if(lastCat!==null){
              const st=ws.addRow([`SUBTOTAL ${lastCat}`,,,,,,, catT,'']);
              ws.mergeCells(`A${st.number}:G${st.number}`);
              st.getCell('H').numFmt=`"${pM} "#,##0.00`;
              st.eachCell(c=>{c.font={bold:true,size:9,name:'Calibri',color:{argb:C_BLUE}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_LBLUE}};});
              catT=0;
            }
            const ch=ws.addRow([`▸ ${iCat}`,,,,,,,,]);
            ws.mergeCells(`A${ch.number}:I${ch.number}`);
            ch.getCell(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:C_LBLUE}};
            ch.getCell(1).font={bold:true,size:10,name:'Calibri',color:{argb:C_BLUE}};
            lastCat=iCat;
          }
          rowI++;
          const dr=ws.addRow([iCod,iDesc,iUnid,cant,rend,desp+'%',iP,cp,iCat]);
          dr.getCell(4).numFmt='#,##0.0000'; dr.getCell(5).numFmt='#,##0.0000';
          dr.getCell(7).numFmt=`"${pM} "#,##0.00`; dr.getCell(8).numFmt=`"${pM} "#,##0.00`;
          stripeRow(dr,rowI%2===0);
          dr.getCell(1).font={size:9,name:'Calibri',color:{argb:C_BLUE},bold:true};
          catT+=Number(cp);
        }
        if(lastCat!==null){
          const st=ws.addRow([`SUBTOTAL ${lastCat}`,,,,,,,catT,'']);
          ws.mergeCells(`A${st.number}:G${st.number}`);
          st.getCell('H').numFmt=`"${pM} "#,##0.00`;
          st.eachCell(c=>{c.font={bold:true,size:9,name:'Calibri',color:{argb:C_BLUE}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_LBLUE}};});
        }
      }
      const tr=ws.addRow([`COSTO TOTAL — ${aCod}: ${aDesc}`,,,,,`${aUnid}`,,aTotal,'']);
      ws.mergeCells(`A${tr.number}:E${tr.number}`);
      tr.getCell('H').numFmt=`"${pM} "#,##0.00`; tr.height=18;
      tr.eachCell(c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_BLUE}};c.font={bold:true,size:10,color:{argb:C_WHITE},name:'Calibri'};c.alignment={vertical:'middle'};});
    }

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename=Fichas_${req.params.id}.xlsx`);
    await wb.xlsx.write(res);
  }catch(e){console.error(e);res.status(500).json({error:e.message});}
});

// ── REPORTE 2: LISTADO DE INSUMOS ─────────────────────────
router.get('/proyecto/:id/insumos', requireAuth, async (req,res)=>{
  try{
    const db=await getDb();
    const p=await getProy(db,req.params.id);
    if(!p) return res.status(404).json({error:'No encontrado'});
    const [pN,pC,pU,pM]=p;

    const iR=db.exec(`SELECT c.nombre,i.codigo,i.descripcion,i.unidad,i.precio_unitario, SUM(ai.cantidad*pp.cantidad) as qt, SUM(ai.costo_parcial*pp.cantidad) as ct FROM presupuesto_partidas pp JOIN presupuestos pr ON pp.id_presupuesto=pr.id_presupuesto JOIN actividad_insumos ai ON pp.id_actividad=ai.id_actividad JOIN insumos i ON ai.id_insumo=i.id_insumo JOIN categorias_insumo c ON i.id_categoria=c.id_categoria WHERE pr.id_proyecto=? GROUP BY i.id_insumo ORDER BY c.id_categoria,i.descripcion`,[req.params.id]);

    const wb=new ExcelJS.Workbook();
    const ws=wb.addWorksheet('INSUMOS');
    ws.views=[{showGridLines:false}];
    [14,10,44,9,15,16,18].forEach((w,i)=>ws.getColumn(i+1).width=w);

    titleBlock(ws,`LISTADO DE INSUMOS — ${pN}`,'G',30);
    ws.addRow([`Cliente: ${pC||'—'}`,,,`Fecha: ${new Date().toLocaleDateString('es-HN')}`,,,'']).eachCell(c=>c.font={size:9,name:'Calibri'});
    ws.addRow([]);

    const hr=ws.addRow(['Categoría','Código','Descripción','Unidad',`P.Unit(${pM})`,'Cantidad Total',`Costo Total(${pM})`]);
    hr.height=20; hr.eachCell(c=>hdr(c));

    let lastC=null,cSub=0,grand=0,ri=0;
    if(iR.length&&iR[0].values.length){
      for(const [cat,cod,desc,unid,precio,qt,ct] of iR[0].values){
        if(cat!==lastC){
          if(lastC!==null){
            const sr=ws.addRow([`SUBTOTAL ${lastC}`,,,,,,cSub]);
            ws.mergeCells(`A${sr.number}:F${sr.number}`);
            sr.getCell(7).numFmt=`"${pM} "#,##0.00`;
            sr.eachCell(c=>{c.font={bold:true,size:9,name:'Calibri',color:{argb:C_BLUE}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_LBLUE}};});
            cSub=0; ws.addRow([]);
          }
          const cr=ws.addRow([cat]);
          ws.mergeCells(`A${cr.number}:G${cr.number}`);
          cr.getCell(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:C_ORANGE}};
          cr.getCell(1).font={bold:true,size:10,name:'Calibri',color:{argb:'FF333333'}};
          cr.height=18; lastC=cat;
        }
        ri++;
        const dr=ws.addRow(['',cod,desc,unid,precio,qt,ct]);
        dr.getCell(5).numFmt=`"${pM} "#,##0.00`; dr.getCell(6).numFmt='#,##0.0000'; dr.getCell(7).numFmt=`"${pM} "#,##0.00`;
        stripeRow(dr,ri%2===0);
        dr.getCell(2).font={size:9,name:'Calibri',color:{argb:C_BLUE},bold:true};
        cSub+=Number(ct); grand+=Number(ct);
      }
      if(lastC){
        const sr=ws.addRow([`SUBTOTAL ${lastC}`,,,,,,cSub]);
        ws.mergeCells(`A${sr.number}:F${sr.number}`);
        sr.getCell(7).numFmt=`"${pM} "#,##0.00`;
        sr.eachCell(c=>{c.font={bold:true,size:9,name:'Calibri',color:{argb:C_BLUE}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_LBLUE}};});
      }
    }
    ws.addRow([]);
    const gt=ws.addRow(['COSTO TOTAL DE INSUMOS EN PROYECTO',,,,,,grand]);
    ws.mergeCells(`A${gt.number}:F${gt.number}`); gt.height=24;
    gt.getCell(7).numFmt=`"${pM} "#,##0.00`;
    gt.eachCell(c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_BLUE}};c.font={bold:true,size:12,color:{argb:C_WHITE},name:'Calibri'};c.alignment={vertical:'middle'};});
    ws.addRow([]);
    ws.addRow(['Nota: Precios de referencia según mercado hondureño 2025-2026 (CHICO / Larach y Cía / La Prensa HN). Verificar vigencia antes de presentar oferta.']);
    ws.mergeCells(`A${ws.rowCount}:G${ws.rowCount}`);
    ws.lastRow.getCell(1).font={size:8,italic:true,color:{argb:'FF888888'},name:'Calibri'};

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename=Insumos_${req.params.id}.xlsx`);
    await wb.xlsx.write(res);
  }catch(e){console.error(e);res.status(500).json({error:e.message});}
});

// ── REPORTE 3: PRESUPUESTO ────────────────────────────────
router.get('/presupuesto/:id/excel', requireAuth, async (req,res)=>{
  try{
    const db=await getDb();
    const pR=db.exec(`SELECT p.*,pr.nombre as pn,pr.moneda,pr.cliente,pr.ubicacion FROM presupuestos p JOIN proyectos pr ON p.id_proyecto=pr.id_proyecto WHERE p.id_presupuesto=?`,[req.params.id]);
    if(!pR.length||!pR[0].values.length) return res.status(404).json({error:'No encontrado'});
    const r=pR[0].values[0];
    const pres={nombre:r[2],cd:r[3],pi:r[4],pu:r[5],pim:r[6],ci:r[7],util:r[8],impr:r[9],total:r[10],fecha:r[11],pn:r[12],mon:r[13],cli:r[14],ubic:r[15]};

    const partR=db.exec(`SELECT pp.id_partida,c.nombre,c.orden_visual,a.codigo,a.descripcion,a.unidad,pp.cantidad,pp.precio_unitario,pp.subtotal FROM presupuesto_partidas pp JOIN actividades a ON pp.id_actividad=a.id_actividad LEFT JOIN capitulos c ON pp.id_capitulo=c.id_capitulo WHERE pp.id_presupuesto=? ORDER BY COALESCE(c.orden_visual,999),pp.id_partida`,[req.params.id]);
    const parts=partR.length?partR[0].values:[];

    const wb=new ExcelJS.Workbook();
    const ws=wb.addWorksheet('PRESUPUESTO');
    ws.views=[{showGridLines:false}];
    [6,12,46,9,12,16,18].forEach((w,i)=>ws.getColumn(i+1).width=w);

    titleBlock(ws,'PRESUPUESTO DE OBRA','G',32);
    ws.addRow([`PROYECTO: ${pres.pn}`]).eachCell(c=>c.font={bold:true,size:12,name:'Calibri'});
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
        const cr=ws.addRow([cap||'PARTIDAS GENERALES']);
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
        ['4.3','Documentación','Bitácora CICH actualizada diariamente. Memorias fotográficas por partida. Laboratorio acreditado. Planos as-built firmados por Ingeniero responsable. Dossier de calidad entregado 30 días post-recepción.'],
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

// ── REPORTE 5: EETT POR ACTIVIDAD ─────────────────────────
router.get('/proyecto/:id/especificaciones', requireAuth, async (req,res)=>{
  try{
    const db=await getDb();
    const p=await getProy(db,req.params.id);
    if(!p) return res.status(404).json({error:'No encontrado'});
    const [pN,pC,pU,pM]=p;

    const actsR=db.exec(`SELECT DISTINCT a.id_actividad,a.codigo,a.descripcion,a.unidad,a.costo_total FROM presupuesto_partidas pp JOIN presupuestos pr ON pp.id_presupuesto=pr.id_presupuesto JOIN actividades a ON pp.id_actividad=a.id_actividad WHERE pr.id_proyecto=? ORDER BY a.codigo`,[req.params.id]);

    const wb=new ExcelJS.Workbook();
    const ws=wb.addWorksheet('EETT ACTIVIDADES');
    ws.views=[{showGridLines:false}];
    ws.getColumn(1).width=5; ws.getColumn(2).width=22; ws.getColumn(3).width=68;

    titleBlock(ws,`ESPECIFICACIONES TÉCNICAS POR ACTIVIDAD`,'C',32);
    ws.addRow([`Proyecto: ${pN} | Cliente: ${pC||'—'} | Fecha: ${new Date().toLocaleDateString('es-HN')}`]);
    ws.mergeCells(`A${ws.rowCount}:C${ws.rowCount}`);
    ws.lastRow.getCell(1).font={size:10,name:'Calibri'};
    ws.addRow([]);

    const TMPL={
      F001:{t:'TOPOGRAFÍA',s:[['Norma','SOPTRAVI/INSEP — Manual de Carreteras. SANAA Normas Técnicas.'],['Alcance','Replanteo de ejes, nivelación, colocación de estacas BM permanentes. Registro de cotas con referencia a puntos fijos.'],['Equipo','Estación total o tránsito ±2\'. Mira, trípode, cinta calibrada. Nivel de mano.'],['Procedimiento','1) Verificar BM de referencia. 2) Replantear ejes (estacas cada 20 m en tangentes, 10 m en curvas). 3) Nivelar circuito cerrado (cierre máx. 0.012√L m). 4) Entregar plano de replanteo firmado.'],['Medición','Por ML de eje replanteado o GLB según contrato.']]},
      F002:{t:'CIMENTACIONES',s:[['Norma','ACI 318 — Estructuras de concreto. NSR-10 adaptado.'],['Materiales','Concreto f\'c≥210 kg/cm². Varilla corrugada Grado 40/60. Encofrado de madera o metálico.'],['Procedimiento','1) Excavar a nivel de planos. 2) Apisonar fondo ≥95% Proctor. 3) Concreto pobre 5 cm. 4) Armar, encofrar y colar. 5) Vibrar, curar 7 días. 6) Desencofrar ≥72 h.'],['Control','3 cilindros/50 m³. Slump máx. 10 cm. Nivelación previa con nivel óptico.']]},
      F003:{t:'ELEMENTOS ESTRUCTURALES',s:[['Norma','ACI 318. f\'c según planos estructurales.'],['Materiales','Concreto f\'c=210-280 kg/cm² según planos. Recubrimiento: 20 mm interior, 40 mm exterior, 50 mm en contacto con suelo.'],['Procedimiento','1) Armar según planos. 2) Separadores de recubrimiento. 3) Encofrar limpio y húmedo. 4) Colar en capas ≤50 cm, vibrar. 5) Curar 7 días. 6) Desencofrar: columnas 24h, vigas 14d, losas 21d.'],['Control','3 cilindros/50 m³. Revenimiento máx. 10 cm.']]},
      F004:{t:'MAMPOSTERÍA',s:[['Norma','ASTM C90 (bloques). ACI 530 (mampostería estructural).'],['Materiales','Bloque 15×20×40 cm, resistencia neta ≥130 kg/cm². Mortero 1:4. Varilla vertical según planos. Concreto relleno f\'c≥140 kg/cm².'],['Procedimiento','1) Trazar hilada de arranque, verificar nivel y plomo. 2) Junta 10 mm h y v. 3) Rellenar celdas con concreto fluido. 4) Curar juntas 3 días.'],['Tolerancias','Plomo: ±5 mm en 3 m. Nivel: ±5 mm. Junta: 10±3 mm.']]},
      F005:{t:'FONTANERÍA/AGUA POTABLE',s:[['Norma','AWWA C900/C905. ASTM D2241. SANAA Manual de Normas.'],['Materiales','PVC SDR según presión (SDR-17: P≥160 psi; SDR-26: P≥100 psi; SDR-41: P≥63 psi). Cama de arena 10 cm bajo y 15 cm sobre tubería.'],['Procedimiento','1) Excavación a profundidad de diseño (mín. 0.60 m sobre clave en zonas vehiculares). 2) Cama de arena nivelada. 3) Instalación con lubricante. 4) Relleno compactado ≥90% Proctor. 5) Prueba hidrostática 1.5× P nominal, 2 h.'],['Control','Prueba hidrostática obligatoria. Desinfección 50 ppm cloro antes de servicio.']]},
      F006:{t:'ALCANTARILLADO SANITARIO',s:[['Norma','ASTM D3034 (PVC). SANAA Normas de Saneamiento.'],['Materiales','PVC SDR-41 para colectores. Pozos de visita de concreto o prefabricados. Tapa y marco de hierro fundido para tránsito vehicular.'],['Procedimiento','1) Excavar verificando gradiente. 2) Cama de grava 6" (TM 3/4"). 3) Instalar verificando pendiente. 4) Prueba de exfiltración. 5) Rellenar ≥90% Proctor.'],['Pendiente Mínima','≥0.5% para Ø≥200 mm; ≥1.0% para Ø<200 mm. Velocidad autolimpiante ≥0.60 m/s.']]},
    };
    const DEFAULT={t:'OBRA CIVIL GENERAL',s:[
      ['Norma Aplicable','SOPTRAVI/INSEP, SANAA y CICH Honduras. Especificaciones del fabricante para materiales importados.'],
      ['Descripción','Trabajo según planos, detalles y memorias de cálculo aprobadas. El contratista presentará metodología constructiva antes de iniciar.'],
      ['Materiales','Nuevos, primera calidad, aprobados por supervisión. Fichas técnicas y certificados de calidad para materiales principales.'],
      ['Mano de Obra','Personal calificado por especialidad. Maestro de obras con ≥5 años experiencia. Precio ref. albanil: L 800-900/jornal (2025-2026).'],
      ['Control de Calidad','Supervisión diaria por Ingeniero residente. Pruebas de laboratorio según ET. Bitácora actualizada. Fotografías por etapa.'],
      ['Seguridad','EPP completo. Señalización perimetral. Plan de emergencias disponible en obra.'],
    ]};

    if(actsR.length&&actsR[0].values.length){
      let n=1;
      for(const [aId,aCod,aDesc,aUnid,aTotal] of actsR[0].values){
        const prefix=aCod.substring(0,4);
        const tmpl=TMPL[prefix]||DEFAULT;

        const ar=ws.addRow([`${n++}.`,`${aCod}`,aDesc]);
        ar.height=22;
        ['A','B','C'].forEach(col=>{const c=ar.getCell(col);c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_BLUE}};c.font={bold:true,size:10,color:{argb:C_WHITE},name:'Calibri'};c.alignment={vertical:'middle'};});

        ws.addRow(['',`Unidad: ${aUnid} | Costo: ${pM} ${Number(aTotal).toFixed(2)}`,`${tmpl.t}`]).eachCell(c=>{c.font={size:9,name:'Calibri',color:{argb:C_BLUE}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_LBLUE}};});

        for(const [campo,valor] of tmpl.s){
          const dr=ws.addRow(['',campo,valor]);
          dr.getCell(2).font={bold:true,size:9,name:'Calibri'};
          dr.getCell(3).font={size:9,name:'Calibri'};
          dr.getCell(3).alignment={wrapText:true};
          dr.eachCell(c=>c.border={bottom:{style:'hair',color:{argb:C_DGRAY}}});
        }

        // Insumos
        const mR=db.exec(`SELECT c.nombre,i.codigo,i.descripcion,i.unidad,ai.cantidad,ai.rendimiento,ai.desperdicio,i.precio_unitario,ai.costo_parcial FROM actividad_insumos ai JOIN insumos i ON ai.id_insumo=i.id_insumo JOIN categorias_insumo c ON i.id_categoria=c.id_categoria WHERE ai.id_actividad=? ORDER BY c.id_categoria`,[aId]);
        if(mR.length&&mR[0].values.length){
          ws.addRow(['','COMPOSICIÓN DE INSUMOS','Categoría | Código | Descripción | Unidad | Cant | Rendto | Desp% | P.Unit | C.Parcial']).eachCell(c=>{c.font={bold:true,size:8,name:'Calibri',color:{argb:C_WHITE}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_BLUE2}};});
          mR[0].values.forEach((mr,i)=>{
            const [cat,iCod,iDesc,iUnid,cant,rend,desp,precio,cp]=mr;
            const mr2=ws.addRow(['',cat,`${iCod} | ${iDesc} | ${iUnid} | ${cant} | ${rend} | ${desp}% | L ${Number(precio).toFixed(2)} | L ${Number(cp).toFixed(4)}`]);
            if(i%2===0) mr2.eachCell(c=>c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C_LGRAY}});
            mr2.eachCell(c=>c.font={size:8,name:'Calibri'});
          });
        }
        ws.addRow([]);
      }
    }

    ws.addRow(['Fuente precios: CHICO / Larach y Cía Honduras / La Prensa HN 2025-2026. Precios de referencia — verificar cotización actual.']);
    ws.mergeCells(`A${ws.rowCount}:C${ws.rowCount}`);
    ws.lastRow.getCell(1).font={size:8,italic:true,color:{argb:'FF888888'},name:'Calibri'};
    ws.lastRow.getCell(1).alignment={wrapText:true};

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename=EETT_Actividades_${req.params.id}.xlsx`);
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
             py.nombre as proyecto, py.ubicacion, py.cliente
      FROM presupuestos p JOIN proyectos py ON p.id_proyecto = py.id_proyecto
      WHERE p.id_presupuesto = ?`, [id]);

    if (!pr.length || !pr[0].values.length)
      return res.status(404).json({ error: 'Presupuesto no encontrado' });

    const [v] = pr[0].values;
    const presup = {
      id_presupuesto: v[0], nombre_presupuesto: v[1],
      costos_directos: v[2], costos_indirectos: v[3], utilidad: v[4],
      imprevistos: v[5], total_general: v[6],
      porcentaje_indirectos: v[7], porcentaje_utilidad: v[8], porcentaje_imprevistos: v[9],
      proyecto: v[10], ubicacion: v[11], cliente: v[12]
    };

    const partR = db.exec(`
      SELECT a.codigo, a.descripcion, a.unidad,
             pp.cantidad, pp.precio_unitario, pp.subtotal,
             c.nombre as capitulo
      FROM presupuesto_partidas pp
      JOIN actividades a ON pp.id_actividad = a.id_actividad
      LEFT JOIN capitulos c ON pp.id_capitulo = c.id_capitulo
      WHERE pp.id_presupuesto = ?
      ORDER BY c.orden_visual, a.codigo`, [id]);

    presup.partidas = partR.length ? partR[0].values.map(p => ({
      codigo: p[0], descripcion: p[1], unidad: p[2],
      cantidad: p[3], precio_unitario: p[4], subtotal: p[5], capitulo: p[6]
    })) : [];

    res.json(presup);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PDF-DATA: FICHAS DE COSTOS ────────────────────────────
router.get('/proyecto/:id/fichas/pdf-data', requireAuth, async (req,res) => {
  try {
    const db = await getDb();
    const p = await getProy(db, req.params.id);
    if (!p) return res.status(404).json({ error: 'Proyecto no encontrado' });
    const [pN, pC, pU, pM] = p;
    const actsR = db.exec(`
      SELECT DISTINCT a.id_actividad, a.codigo, a.descripcion, a.unidad, a.costo_total
      FROM presupuesto_partidas pp
      JOIN presupuestos pr ON pp.id_presupuesto = pr.id_presupuesto
      JOIN actividades a ON pp.id_actividad = a.id_actividad
      WHERE pr.id_proyecto = ? ORDER BY a.codigo`, [req.params.id]);
    if (!actsR.length || !actsR[0].values.length)
      return res.status(400).json({ error: 'Sin actividades en este proyecto' });

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
    res.json({ proyecto: pN, cliente: pC, ubicacion: pU, moneda: pM, actividades });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PDF-DATA: INSUMOS DEL PROYECTO ───────────────────────
router.get('/proyecto/:id/insumos/pdf-data', requireAuth, async (req,res) => {
  try {
    const db = await getDb();
    const p = await getProy(db, req.params.id);
    if (!p) return res.status(404).json({ error: 'Proyecto no encontrado' });
    const [pN, pC, pU, pM] = p;
    const iR = db.exec(`
      SELECT c.nombre, i.codigo, i.descripcion, i.unidad, i.precio_unitario,
             SUM(ai.cantidad * pp.cantidad) as qt, SUM(ai.costo_parcial * pp.cantidad) as ct
      FROM presupuesto_partidas pp
      JOIN presupuestos pr ON pp.id_presupuesto = pr.id_presupuesto
      JOIN actividad_insumos ai ON pp.id_actividad = ai.id_actividad
      JOIN insumos i ON ai.id_insumo = i.id_insumo
      JOIN categorias_insumo c ON i.id_categoria = c.id_categoria
      WHERE pr.id_proyecto = ?
      GROUP BY i.id_insumo ORDER BY c.id_categoria, i.descripcion`, [req.params.id]);
    const insumos = iR.length && iR[0].values.length ? iR[0].values.map(r => ({
      categoria: r[0], codigo: r[1], descripcion: r[2], unidad: r[3],
      precio_unitario: r[4], cantidad: r[5], costo_total: r[6]
    })) : [];
    const grand = insumos.reduce((s,i) => s + Number(i.costo_total||0), 0);
    res.json({ proyecto: pN, cliente: pC, ubicacion: pU, moneda: pM, insumos, gran_total: grand });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PDF-DATA: EETT POR ACTIVIDAD ─────────────────────────
router.get('/proyecto/:id/especificaciones/pdf-data', requireAuth, async (req,res) => {
  try {
    const db = await getDb();
    const p = await getProy(db, req.params.id);
    if (!p) return res.status(404).json({ error: 'Proyecto no encontrado' });
    const [pN, pC, pU, pM] = p;
    const actsR = db.exec(`
      SELECT DISTINCT a.codigo, a.descripcion, a.unidad, a.costo_total
      FROM presupuesto_partidas pp
      JOIN presupuestos pr ON pp.id_presupuesto = pr.id_presupuesto
      JOIN actividades a ON pp.id_actividad = a.id_actividad
      WHERE pr.id_proyecto = ? ORDER BY a.codigo`, [req.params.id]);
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
    res.json({ proyecto: pN, cliente: pC, ubicacion: pU, moneda: pM, actividades });
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

module.exports=router;
