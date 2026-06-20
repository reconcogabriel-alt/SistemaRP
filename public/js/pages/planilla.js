// ═══════════════════════════════════════════════════════════════
// PLANILLA DE MANO DE OBRA — Con retenciones Honduras
// IHSS patronal 11% | RAP 1.5% | ISR escala progresiva
// ═══════════════════════════════════════════════════════════════
let _planCtx = { idPresupuesto: null };

async function renderPlanilla(ctx = {}) {
  if (ctx.idPresupuesto) _planCtx.idPresupuesto = ctx.idPresupuesto;
  const el = document.getElementById('pageContent');

  let presupuestos = [];
  try { presupuestos = await api.get('/api/presupuestos'); } catch(e){}

  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">PLANILLA DE MANO DE OBRA</div>
        <div class="page-subtitle">Registro de personal con retenciones legales Honduras — IHSS, RAP, ISR</div>
      </div>
      <button class="btn btn-orange" onclick="modalNuevaPlanilla()">+ Nueva Planilla</button>
    </div>
    <div class="page-body">
      <!-- Info de tasas -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
        ${[
          ['IHSS Patronal','11%','Aporte empresa','#025196'],
          ['RAP Patronal','1.5%','Previsión empresa','#1A7A3C'],
          ['IHSS Empleado','2.5%','Descuento trabajador','#c0392b'],
          ['RAP Empleado','1.5%','Descuento trabajador','#8C4A00'],
        ].map(([t,v,s,c])=>`
          <div style="background:#f7f9fc;border-left:3px solid ${c};border-radius:4px;padding:10px 14px">
            <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.4px">${t}</div>
            <div style="font-size:22px;font-weight:700;color:${c};font-family:'Barlow Condensed',sans-serif">${v}</div>
            <div style="font-size:10px;color:#888">${s}</div>
          </div>`).join('')}
      </div>

      <div class="card" style="margin-bottom:14px;padding:12px 18px">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <label style="font-size:13px;font-weight:600;color:var(--blue);white-space:nowrap">Filtrar por presupuesto:</label>
          <select id="planPresSelect" onchange="onPlanPresChange()" style="flex:1;min-width:200px;max-width:380px">
            <option value="">— Todos los presupuestos —</option>
            ${presupuestos.map(p=>`<option value="${p.id_presupuesto}" ${_planCtx.idPresupuesto==p.id_presupuesto?'selected':''}>${sanitize(p.nombre)}</option>`).join('')}
          </select>
          <button class="btn btn-secondary btn-sm" onclick="loadPlanillas()">🔄 Actualizar</button>
        </div>
      </div>

      <div id="planListado"><div class="loading"><div class="spinner"></div></div></div>
    </div>`;

  await loadPlanillas();
}

async function onPlanPresChange() {
  const sel = document.getElementById('planPresSelect');
  _planCtx.idPresupuesto = sel.value ? parseInt(sel.value) : null;
  await loadPlanillas();
}

async function loadPlanillas() {
  const el = document.getElementById('planListado');
  if (!el) return;
  el.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
  try {
    const url = _planCtx.idPresupuesto ? `/api/planilla?id_presupuesto=${_planCtx.idPresupuesto}` : '/api/planilla';
    const lista = await api.get(url);
    if (!lista.length) {
      el.innerHTML = `<div class="empty-state" style="background:var(--white);border:1px solid var(--gray-mid);border-radius:4px;padding:60px">
        <div class="empty-icon" style="font-size:48px">👷</div>
        <div class="empty-title">Sin planillas registradas</div>
        <div class="empty-desc">Crea una planilla para registrar el personal y calcular salarios con retenciones IHSS, RAP e ISR automáticamente.</div>
        <button class="btn btn-orange" style="margin-top:16px" onclick="modalNuevaPlanilla()">+ Nueva Planilla</button>
      </div>`; return;
    }
    const estadoC = {borrador:{c:'#888',bg:'#f5f5f5'},aprobada:{c:'#1A7A3C',bg:'#e8f5eb'},pagada:{c:'#5B4FBE',bg:'#eeecfb'}};
    el.innerHTML = `<div class="card"><div class="table-wrap"><table>
      <thead><tr>
        <th>N°</th><th>Presupuesto</th><th>Período</th><th>Tipo</th>
        <th style="text-align:center">Empl.</th>
        <th style="text-align:right">S.Bruto Total</th>
        <th style="text-align:right">IHSS+RAP Patr.</th>
        <th style="text-align:right">Desc. Emp.</th>
        <th style="text-align:right">S.Neto Total</th>
        <th style="text-align:center">Estado</th>
        <th></th>
      </tr></thead>
      <tbody>
      ${lista.map(p=>{
        const ec = estadoC[p.estado]||estadoC.borrador;
        const ihssRap = (p.total_ihss_p||0)+(p.total_rap_p||0);
        return `<tr>
          <td class="td-code">PL-${String(p.numero).padStart(3,'0')}</td>
          <td style="font-size:12px">${sanitize(p.presupuesto_nombre||'')}</td>
          <td style="font-size:11px;color:#555">${sanitize(p.periodo||'')}</td>
          <td style="font-size:11px;text-transform:capitalize">${p.tipo||'—'}</td>
          <td style="text-align:center;font-weight:700">${p.num_empleados||0}</td>
          <td class="td-monto">L ${fmt(p.total_bruto)}</td>
          <td style="text-align:right;color:#c0392b;font-size:12px">L ${fmt(ihssRap)}</td>
          <td style="text-align:right;color:#8C4A00;font-size:12px">L ${fmt(p.total_desc_e)}</td>
          <td class="td-monto" style="color:var(--blue);font-weight:700">L ${fmt(p.total_neto)}</td>
          <td style="text-align:center">
            <span style="background:${ec.bg};color:${ec.c};padding:3px 10px;border-radius:12px;font-size:10px;font-weight:700">${(p.estado||'borrador').charAt(0).toUpperCase()+(p.estado||'borrador').slice(1)}</span>
          </td>
          <td style="white-space:nowrap">
            <button class="btn btn-secondary btn-sm" onclick="abrirPlanilla(${p.id_planilla})">✎ Editar</button>
            <button class="btn btn-secondary btn-sm" onclick="window.open('/api/planilla/${p.id_planilla}/html','_blank')" title="Imprimir">🖨</button>
            ${p.estado!=='pagada'?`<button class="btn btn-danger btn-sm btn-icon" onclick="eliminarPlanilla(${p.id_planilla})">✕</button>`:''}
          </td>
        </tr>`;
      }).join('')}
      </tbody></table></div></div>`;
  } catch(e) { el.innerHTML = `<div class="empty-state">Error: ${e.error||e.message||''}</div>`; }
}

function modalNuevaPlanilla() {
  let presupuestos = [];
  showModal('NUEVA PLANILLA DE MANO DE OBRA', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div style="grid-column:span 2">
        <label class="form-label">Presupuesto *</label>
        <select id="planPres" style="width:100%"><option value="">Cargando...</option></select>
      </div>
      <div>
        <label class="form-label">Tipo de período *</label>
        <select id="planTipo" style="width:100%">
          <option value="semanal">Semanal (7.5 días hábiles)</option>
          <option value="quincenal">Quincenal (15 días)</option>
          <option value="mensual" selected>Mensual (30 días)</option>
        </select>
      </div>
      <div>
        <label class="form-label">Elaborado por</label>
        <input type="text" id="planElab" placeholder="Nombre del responsable">
      </div>
      <div>
        <label class="form-label">Fecha inicio *</label>
        <input type="date" id="planDesde" value="${new Date().toISOString().slice(0,10)}">
      </div>
      <div>
        <label class="form-label">Fecha fin *</label>
        <input type="date" id="planHasta" value="${new Date().toISOString().slice(0,10)}">
      </div>
      <div style="grid-column:span 2">
        <label class="form-label">Notas</label>
        <input type="text" id="planNotas" placeholder="Observaciones generales">
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-orange" onclick="crearPlanilla()">Crear Planilla</button>
    </div>`);

  api.get('/api/presupuestos').then(lista => {
    const sel = document.getElementById('planPres');
    if (!sel) return;
    sel.innerHTML = '<option value="">Seleccionar presupuesto...</option>' +
      lista.map(p => `<option value="${p.id_presupuesto}" ${_planCtx.idPresupuesto==p.id_presupuesto?'selected':''}>${sanitize(p.nombre)}</option>`).join('');
  });
}

async function crearPlanilla() {
  const id_presupuesto = document.getElementById('planPres').value;
  const fecha_inicio = document.getElementById('planDesde').value;
  const fecha_fin = document.getElementById('planHasta').value;
  if (!id_presupuesto||!fecha_inicio||!fecha_fin) { toast('Presupuesto y fechas son requeridos', 'error'); return; }
  try {
    const r = await api.post('/api/planilla', {
      id_presupuesto: parseInt(id_presupuesto),
      fecha_inicio, fecha_fin,
      tipo: document.getElementById('planTipo').value,
      elaborado_por: document.getElementById('planElab').value || null,
      notas: document.getElementById('planNotas').value || null,
    });
    hideModal();
    toast(`Planilla N°${r.numero} creada`);
    _planCtx.idPresupuesto = parseInt(id_presupuesto);
    await loadPlanillas();
    abrirPlanilla(r.id);
  } catch(e) { toast(e.error || 'Error', 'error'); }
}

async function abrirPlanilla(id) {
  try {
    const { planilla: pl, empleados } = await api.get(`/api/planilla/${id}`);
    const cargos = {
      profesional: ['Ingeniero Residente','Topógrafo','Inspector','Director de Obra','Ingeniero de Campo'],
      tecnico: ['Maestro de Obras','Técnico Electricista','Técnico Plomero','Capataz','Bodeguero'],
      operativo: ['Oficial Albañil','Ayudante de Albañilería','Peón','Operador Equipo','Conductor']
    };

    const renderEmpleados = (emps) => emps.length ? emps.map(e => `
      <tr id="empRow-${e.id_emp}">
        <td style="padding:6px 8px;font-weight:600;font-size:12px">${sanitize(e.nombre)}</td>
        <td style="padding:6px 8px;font-size:11px;color:#555">${sanitize(e.cargo)}</td>
        <td style="text-align:center;padding:6px 4px">
          <span style="background:${e.categoria==='profesional'?'#e8f0fb':e.categoria==='tecnico'?'#e8f5eb':'#fff3cd'};
            color:${e.categoria==='profesional'?'#025196':e.categoria==='tecnico'?'#1A7A3C':'#8C4A00'};
            padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">
            ${e.categoria||'operativo'}
          </span>
        </td>
        <td style="text-align:right;padding:6px 8px">L ${fmt(e.salario_base)}</td>
        <td style="text-align:center;padding:6px 4px">${Number(e.dias_laborados||0).toFixed(1)}</td>
        <td style="text-align:center;padding:6px 4px">${Number(e.horas_extra||0).toFixed(1)}</td>
        <td style="text-align:right;padding:6px 8px;font-weight:600">L ${fmt(e.salario_bruto)}</td>
        <td style="text-align:right;padding:6px 8px;color:#1A7A3C">L ${fmt(e.bonificacion)}</td>
        <td style="text-align:right;padding:6px 8px;color:#c0392b;font-size:11px">L ${fmt(e.ihss_patronal)}</td>
        <td style="text-align:right;padding:6px 8px;color:#c0392b;font-size:11px">L ${fmt(e.rap_patronal)}</td>
        <td style="text-align:right;padding:6px 8px;color:#8C4A00;font-size:11px">L ${fmt(e.total_desc)}</td>
        <td style="text-align:right;padding:6px 8px;font-weight:700;color:var(--blue)">L ${fmt(e.salario_neto)}</td>
        <td style="text-align:right;padding:6px 8px;font-weight:700;color:#5B4FBE">L ${fmt(e.costo_total)}</td>
        <td style="text-align:center;padding:4px;white-space:nowrap">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="modalEditarEmpleado(${id},${e.id_emp})" title="Editar">✎</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="eliminarEmpleado(${id},${e.id_emp})" title="Eliminar">✕</button>
        </td>
      </tr>`).join('') :
      `<tr><td colspan="14" style="padding:20px;text-align:center;color:#888">Sin empleados registrados</td></tr>`;

    const totalBruto = empleados.reduce((s,e)=>s+(e.salario_bruto||0),0);
    const totalNeto  = empleados.reduce((s,e)=>s+(e.salario_neto||0),0);
    const totalCosto = empleados.reduce((s,e)=>s+(e.costo_total||0),0);
    const totalIhssP = empleados.reduce((s,e)=>s+(e.ihss_patronal||0),0);
    const totalRapP  = empleados.reduce((s,e)=>s+(e.rap_patronal||0),0);
    const totalDesc  = empleados.reduce((s,e)=>s+(e.total_desc||0),0);
    const totalBonif = empleados.reduce((s,e)=>s+(e.bonificacion||0),0);

    showModal(`PLANILLA N°${pl.numero} — ${sanitize(pl.presupuesto_nombre||'')}`, `
      <!-- KPIs -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">
        ${[
          ['Costo Total Empresa','#5B4FBE',totalCosto],
          ['Salario Bruto Total','#025196',totalBruto],
          ['IHSS+RAP Patronal','#c0392b',totalIhssP+totalRapP],
          ['Salario Neto Total','#1A7A3C',totalNeto],
        ].map(([lbl,c,val])=>`
          <div style="background:#f7f9fc;border-left:3px solid ${c};border-radius:4px;padding:8px 12px">
            <div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.4px">${lbl}</div>
            <div id="kpi${lbl.replace(/\W/g,'')}" style="font-size:16px;font-weight:700;color:${c};font-family:'Barlow Condensed',sans-serif">L ${fmt(val)}</div>
          </div>`).join('')}
      </div>

      <!-- Tabla empleados -->
      <div style="max-height:320px;overflow:auto;border:1px solid var(--gray-light);border-radius:4px;margin-bottom:12px">
        <table id="empTable" style="width:100%;border-collapse:collapse;font-size:11px;min-width:900px">
          <thead style="position:sticky;top:0;z-index:1">
            <tr style="background:var(--blue);color:#fff">
              <th style="padding:6px 8px;text-align:left">Nombre</th>
              <th style="padding:6px 8px;text-align:left">Cargo</th>
              <th style="padding:6px 8px;text-align:center">Cat.</th>
              <th style="padding:6px 8px;text-align:right">Sal./Mes</th>
              <th style="padding:6px 8px;text-align:center">Días</th>
              <th style="padding:6px 8px;text-align:center">H.Extra</th>
              <th style="padding:6px 8px;text-align:right">S.Bruto</th>
              <th style="padding:6px 8px;text-align:right">Bonif.</th>
              <th style="padding:6px 8px;text-align:right">IHSS Pat</th>
              <th style="padding:6px 8px;text-align:right">RAP Pat</th>
              <th style="padding:6px 8px;text-align:right">Desc.Emp</th>
              <th style="padding:6px 8px;text-align:right">S.Neto</th>
              <th style="padding:6px 8px;text-align:right">Costo Total</th>
              <th style="padding:6px 8px"></th>
            </tr>
          </thead>
          <tbody id="empTbody">${renderEmpleados(empleados)}</tbody>
          <tfoot>
            <tr style="background:var(--blue);color:#fff;font-weight:700">
              <td colspan="6" style="padding:8px">TOTALES — ${empleados.length} empleado${empleados.length!==1?'s':''}</td>
              <td style="text-align:right;padding:8px">L ${fmt(totalBruto)}</td>
              <td style="text-align:right;padding:8px;color:#FDB338">L ${fmt(totalBonif)}</td>
              <td style="text-align:right;padding:8px">L ${fmt(totalIhssP)}</td>
              <td style="text-align:right;padding:8px">L ${fmt(totalRapP)}</td>
              <td style="text-align:right;padding:8px">L ${fmt(totalDesc)}</td>
              <td style="text-align:right;padding:8px">L ${fmt(totalNeto)}</td>
              <td style="text-align:right;padding:8px;color:#FDB338;font-size:14px">L ${fmt(totalCosto)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <button class="btn btn-orange" onclick="modalAgregarEmpleado(${id},'${pl.tipo}')">+ Agregar Empleado</button>
        <select id="planEstado" style="width:130px">
          ${['borrador','aprobada','pagada'].map(s=>`<option ${pl.estado===s?'selected':''}>${s}</option>`).join('')}
        </select>
        <button class="btn btn-secondary btn-sm" onclick="guardarEstadoPlanilla(${id})">Guardar estado</button>
        <div style="flex:1"></div>
        <button class="btn btn-secondary" onclick="window.open('/api/planilla/${id}/html','_blank')">🖨 Imprimir</button>
        <button class="btn btn-secondary" onclick="hideModal()">Cerrar</button>
      </div>`, 'modal-xl');

    // Store context
    window._planActual = { id, tipo: pl.tipo, empleados };

  } catch(e) { toast(e.error || 'Error al abrir', 'error'); }
}

async function guardarEstadoPlanilla(id) {
  const estado = document.getElementById('planEstado').value;
  try {
    await api.put(`/api/planilla/${id}`, { estado });
    toast(`Estado actualizado: ${estado}`);
    await loadPlanillas();
  } catch(e) { toast(e.error || 'Error', 'error'); }
}

function modalAgregarEmpleado(idPlanilla, tipo) {
  const diasDefault = tipo==='mensual'?30:tipo==='quincenal'?15:5;
  showModal('AGREGAR EMPLEADO', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div style="grid-column:span 2">
        <label class="form-label">Nombre completo *</label>
        <input type="text" id="empNombre" placeholder="Nombre y apellidos">
      </div>
      <div>
        <label class="form-label">Categoría *</label>
        <select id="empCat" onchange="actualizarSalarioRef()" style="width:100%">
          <option value="profesional">👔 Profesional</option>
          <option value="tecnico">🔧 Técnico</option>
          <option value="operativo" selected>👷 Operativo</option>
        </select>
      </div>
      <div>
        <label class="form-label">Cargo *</label>
        <input type="text" id="empCargo" placeholder="Ej: Oficial Albañil">
      </div>
      <div>
        <label class="form-label">No. Identidad</label>
        <input type="text" id="empId" placeholder="0801-XXXX-XXXXX">
      </div>
      <div>
        <label class="form-label">Salario mensual (L) *</label>
        <input type="number" id="empSalario" value="11169" min="0" step="100" oninput="previewCalcPlanilla()">
        <div id="salRef" style="font-size:10px;color:var(--blue);margin-top:3px">Mínimo construcción: L 11,168.68/mes</div>
      </div>
      <div>
        <label class="form-label">Días laborados</label>
        <input type="number" id="empDias" value="${diasDefault}" min="0" step="0.5" max="30" oninput="previewCalcPlanilla()">
      </div>
      <div>
        <label class="form-label">Horas extra</label>
        <input type="number" id="empHExtra" value="0" min="0" step="0.5" oninput="previewCalcPlanilla()">
        <div style="font-size:10px;color:#888;margin-top:3px">Se pagan al 150%</div>
      </div>
      <div>
        <label class="form-label">Otros descuentos (L)</label>
        <input type="number" id="empOtros" value="0" min="0" step="10" oninput="previewCalcPlanilla()">
      </div>
    </div>
    <!-- Preview calculado -->
    <div id="planCalcPreview" style="margin-top:12px;background:#f0f5fb;border-radius:4px;padding:12px;border:1px solid #d0e0f0">
      <div style="font-size:11px;font-weight:700;color:var(--blue);margin-bottom:8px;text-transform:uppercase">Vista previa del cálculo</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:11px">
        <div><span style="color:#888">S.Bruto:</span> <strong id="pv_bruto">—</strong></div>
        <div><span style="color:#888">Bonificación:</span> <strong id="pv_bonif">—</strong></div>
        <div><span style="color:#888">IHSS Pat (11%):</span> <strong id="pv_ihss_p" style="color:#c0392b">—</strong></div>
        <div><span style="color:#888">RAP Pat (1.5%):</span> <strong id="pv_rap_p" style="color:#c0392b">—</strong></div>
        <div><span style="color:#888">Desc.Emp.:</span> <strong id="pv_desc" style="color:#8C4A00">—</strong></div>
        <div><span style="color:#888">ISR:</span> <strong id="pv_isr" style="color:#8C4A00">—</strong></div>
        <div><span style="color:#888">S.Neto:</span> <strong id="pv_neto" style="color:var(--blue)">—</strong></div>
        <div><span style="color:#888">Costo Total Empresa:</span> <strong id="pv_costo" style="color:#5B4FBE">—</strong></div>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-orange" onclick="agregarEmpleado(${idPlanilla},'${tipo}')">Agregar a Planilla</button>
    </div>`);

  previewCalcPlanilla();
  window._empEditId = null;
  window._empEditPlanId = idPlanilla;
  window._empEditTipo = tipo;
}

function actualizarSalarioRef() {
  const cat = document.getElementById('empCat').value;
  const ref = {profesional:'L 25,000+/mes',tecnico:'L 13,000 – 18,000/mes',operativo:'L 11,168.68/mes (mínimo STSS 2024)'};
  const el = document.getElementById('salRef');
  if (el) el.textContent = ref[cat]||'';
}

function previewCalcPlanilla() {
  const sal = parseFloat(document.getElementById('empSalario')?.value)||0;
  const dias = parseFloat(document.getElementById('empDias')?.value)||0;
  const hext = parseFloat(document.getElementById('empHExtra')?.value)||0;
  const otros = parseFloat(document.getElementById('empOtros')?.value)||0;
  const tipo = window._empEditTipo || 'mensual';
  const diasBase = tipo==='mensual'?30:tipo==='quincenal'?15:7.5;
  const salOrd = (sal/diasBase)*dias;
  const vHE = (sal/diasBase/8)*1.5*hext;
  const bruto = salOrd+vHE;
  const bonif = tipo==='mensual'?500:tipo==='quincenal'?250:125;
  const baseIhss = Math.min(bruto,9500);
  const ihssP = baseIhss*0.11, rapP = bruto*0.015;
  const ihssE = baseIhss*0.025, rapE = bruto*0.015;
  const anual = sal*12;
  let isrA=0;
  if(anual>176000&&anual<=274000) isrA=(anual-176000)*0.15;
  else if(anual>274000&&anual<=680000) isrA=14700+(anual-274000)*0.20;
  else if(anual>680000) isrA=95900+(anual-680000)*0.25;
  const isr = (isrA/12)*(dias/diasBase);
  const totalDesc = ihssE+rapE+isr+otros;
  const neto = bruto+bonif-totalDesc;
  const costo = bruto+bonif+ihssP+rapP;

  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=`L ${Number(v).toLocaleString('es-HN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;};
  set('pv_bruto',bruto); set('pv_bonif',bonif); set('pv_ihss_p',ihssP);
  set('pv_rap_p',rapP); set('pv_desc',totalDesc); set('pv_isr',isr);
  set('pv_neto',neto); set('pv_costo',costo);
}

async function agregarEmpleado(idPlanilla, tipo) {
  const nombre = document.getElementById('empNombre').value.trim();
  const cargo  = document.getElementById('empCargo').value.trim();
  const sal    = parseFloat(document.getElementById('empSalario').value);
  if (!nombre||!cargo||!sal) { toast('Nombre, cargo y salario son requeridos','error'); return; }
  try {
    await api.post(`/api/planilla/${idPlanilla}/empleados`, {
      nombre, cargo,
      identidad:      document.getElementById('empId').value.trim()||null,
      categoria:      document.getElementById('empCat').value,
      salario_base:   sal,
      dias_laborados: parseFloat(document.getElementById('empDias').value)||0,
      horas_extra:    parseFloat(document.getElementById('empHExtra').value)||0,
      otros_desc:     parseFloat(document.getElementById('empOtros').value)||0,
    });
    toast('Empleado agregado');
    await abrirPlanilla(idPlanilla);
  } catch(e) { toast(e.error||'Error','error'); }
}

async function modalEditarEmpleado(idPlanilla, idEmp) {
  const ctx = window._planActual;
  const emp = ctx?.empleados?.find(e=>e.id_emp===idEmp);
  if (!emp) return;
  const tipo = ctx?.tipo||'mensual';
  window._empEditTipo = tipo;

  showModal('EDITAR EMPLEADO', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div style="grid-column:span 2">
        <label class="form-label">Nombre *</label>
        <input type="text" id="empNombre" value="${sanitize(emp.nombre)}">
      </div>
      <div>
        <label class="form-label">Categoría</label>
        <select id="empCat" style="width:100%">
          ${['profesional','tecnico','operativo'].map(c=>`<option value="${c}" ${emp.categoria===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="form-label">Cargo *</label>
        <input type="text" id="empCargo" value="${sanitize(emp.cargo)}">
      </div>
      <div>
        <label class="form-label">No. Identidad</label>
        <input type="text" id="empId" value="${sanitize(emp.identidad||'')}">
      </div>
      <div>
        <label class="form-label">Salario mensual (L)</label>
        <input type="number" id="empSalario" value="${emp.salario_base}" min="0" step="100" oninput="previewCalcPlanilla()">
      </div>
      <div>
        <label class="form-label">Días laborados</label>
        <input type="number" id="empDias" value="${emp.dias_laborados||0}" min="0" step="0.5" oninput="previewCalcPlanilla()">
      </div>
      <div>
        <label class="form-label">Horas extra</label>
        <input type="number" id="empHExtra" value="${emp.horas_extra||0}" min="0" oninput="previewCalcPlanilla()">
      </div>
      <div>
        <label class="form-label">Otros descuentos (L)</label>
        <input type="number" id="empOtros" value="${emp.otros_desc||0}" min="0" oninput="previewCalcPlanilla()">
      </div>
    </div>
    <div id="planCalcPreview" style="margin-top:12px;background:#f0f5fb;border-radius:4px;padding:12px;border:1px solid #d0e0f0">
      <div style="font-size:11px;font-weight:700;color:var(--blue);margin-bottom:8px">Vista previa</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font-size:11px">
        <div><span style="color:#888">S.Bruto:</span> <strong id="pv_bruto">—</strong></div>
        <div><span style="color:#888">Bonif:</span> <strong id="pv_bonif">—</strong></div>
        <div><span style="color:#888">IHSS Pat:</span> <strong id="pv_ihss_p" style="color:#c0392b">—</strong></div>
        <div><span style="color:#888">Desc.Emp:</span> <strong id="pv_desc" style="color:#8C4A00">—</strong></div>
        <div><span style="color:#888">ISR:</span> <strong id="pv_isr" style="color:#8C4A00">—</strong></div>
        <div><span style="color:#888">S.Neto:</span> <strong id="pv_neto" style="color:var(--blue)">—</strong></div>
        <div style="grid-column:span 2"><span style="color:#888">Costo Total Empresa:</span> <strong id="pv_costo" style="color:#5B4FBE">—</strong></div>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="abrirPlanilla(${idPlanilla})">Cancelar</button>
      <button class="btn btn-primary" onclick="actualizarEmpleado(${idPlanilla},${idEmp})">Guardar cambios</button>
    </div>`);

  previewCalcPlanilla();
}

async function actualizarEmpleado(idPlanilla, idEmp) {
  try {
    await api.put(`/api/planilla/${idPlanilla}/empleados/${idEmp}`, {
      nombre:         document.getElementById('empNombre').value.trim(),
      cargo:          document.getElementById('empCargo').value.trim(),
      identidad:      document.getElementById('empId').value.trim()||null,
      categoria:      document.getElementById('empCat').value,
      salario_base:   parseFloat(document.getElementById('empSalario').value)||0,
      dias_laborados: parseFloat(document.getElementById('empDias').value)||0,
      horas_extra:    parseFloat(document.getElementById('empHExtra').value)||0,
      otros_desc:     parseFloat(document.getElementById('empOtros').value)||0,
    });
    toast('Empleado actualizado');
    await abrirPlanilla(idPlanilla);
  } catch(e) { toast(e.error||'Error','error'); }
}

async function eliminarEmpleado(idPlanilla, idEmp) {
  if (!confirm('¿Eliminar este empleado de la planilla?')) return;
  try {
    await api.del(`/api/planilla/${idPlanilla}/empleados/${idEmp}`);
    toast('Empleado eliminado');
    await abrirPlanilla(idPlanilla);
  } catch(e) { toast(e.error||'Error','error'); }
}

async function eliminarPlanilla(id) {
  if (!confirm('¿Eliminar esta planilla y todos sus registros?')) return;
  try {
    await api.del(`/api/planilla/${id}`);
    toast('Planilla eliminada');
    await loadPlanillas();
  } catch(e) { toast(e.error||'Error','error'); }
}
