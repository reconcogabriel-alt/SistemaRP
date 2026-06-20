// ============================================================
//  SEGUIMIENTO — Cronograma + Avance Físico vs Financiero
// ============================================================

async function renderSeguimiento(ctx = {}) {
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Cronograma y Seguimiento</h1>
        <p class="page-sub">Planificación Gantt · Avance Físico vs Financiero · Curva S</p>
      </div>
      <button class="btn btn-orange" id="btnNuevoCronograma">+ Nuevo Cronograma</button>
    </div>
    <div id="seg-content"><div class="loading-msg">Cargando cronogramas…</div></div>
  `;
  document.getElementById('btnNuevoCronograma').onclick = () => dlgCronograma();
  await cargarListaCronogramas();
}

// ── LISTA ────────────────────────────────────────────────────
async function cargarListaCronogramas() {
  const box = document.getElementById('seg-content');
  try {
    const cronogramas = await api.get('/api/seguimiento/cronogramas');
    if (!cronogramas.length) {
      box.innerHTML = `<div class="empty-state"><p>No hay cronogramas. Cree uno para comenzar.</p></div>`;
      return;
    }
    const estadoColor = {planificacion:'#3b82f6',en_ejecucion:'#f59e0b',finalizado:'#22c55e',suspendido:'#ef4444'};
    const estadoLabel = {planificacion:'Planificación',en_ejecucion:'En Ejecución',finalizado:'Finalizado',suspendido:'Suspendido'};
    box.innerHTML = `
      <div class="seg-grid">
        ${cronogramas.map(c => `
          <div class="seg-card">
            <div class="seg-card-top">
              <div>
                <div class="seg-card-title">${c.nombre}</div>
                <div class="seg-card-sub">${c.presupuesto_nombre}</div>
              </div>
              <span class="seg-badge" style="background:${estadoColor[c.estado]}22;color:${estadoColor[c.estado]}">${estadoLabel[c.estado]}</span>
            </div>
            <div class="seg-card-meta">
              <span>📅 Inicio: ${c.fecha_inicio}</span>
              <span>⏱ ${c.duracion_semanas} semanas</span>
              <span>💰 L ${(c.monto_total||0).toLocaleString('es-HN',{minimumFractionDigits:2})}</span>
            </div>
            <div class="seg-card-actions">
              <button class="btn btn-secondary" onclick="abrirGantt(${c.id_cronograma})">📊 Gantt</button>
              <button class="btn btn-secondary" onclick="abrirAvances(${c.id_cronograma})">📈 Avances</button>
              <button class="btn btn-secondary" onclick="abrirResumen(${c.id_cronograma})">📋 Resumen</button>
              <button class="btn btn-danger" onclick="eliminarCronograma(${c.id_cronograma})">🗑 Eliminar</button>
            </div>
          </div>
        `).join('')}
      </div>`;
  } catch(e) { box.innerHTML = `<div class="error-msg">Error: ${e.error||e.message}</div>`; }
}

// ── DIÁLOGO NUEVO CRONOGRAMA ─────────────────────────────────
async function dlgCronograma() {
  const presupuestos = await api.get('/api/seguimiento/presupuestos');
  const opts = presupuestos.map(p =>
    `<option value="${p.id_presupuesto}">${p.nombre} (L ${(p.total_general||0).toLocaleString('es-HN',{minimumFractionDigits:0})})</option>`
  ).join('');

  showModal('Nuevo Cronograma de Obra', `
    <div class="form-grid2">
      <div class="field-group" style="grid-column:1/-1">
        <label>Presupuesto base</label>
        <select id="dlg_pres">${opts}</select>
      </div>
      <div class="field-group" style="grid-column:1/-1">
        <label>Nombre del cronograma</label>
        <input id="dlg_nombre" type="text" placeholder="Ej: Cronograma Versión 1">
      </div>
      <div class="field-group">
        <label>Fecha de inicio</label>
        <input id="dlg_inicio" type="date" value="${new Date().toISOString().split('T')[0]}">
      </div>
      <div class="field-group">
        <label>Duración total (semanas)</label>
        <input id="dlg_semanas" type="number" min="1" max="104" value="16">
      </div>
      <div class="field-group" style="grid-column:1/-1">
        <label>Observaciones</label>
        <textarea id="dlg_obs" rows="2" placeholder="Opcional"></textarea>
      </div>
    </div>
    <p style="font-size:12px;opacity:.5;margin:.75rem 0 0">
      💡 Al crear, el sistema distribuirá las actividades proporcionalmente según su peso económico.
      Podrá ajustar manualmente en el Gantt.
    </p>
    <div style="margin-top:1rem;display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-orange" onclick="guardarCronograma()">Crear y abrir Gantt</button>
    </div>
  `);
}

async function guardarCronograma() {
  const body = {
    id_presupuesto:   parseInt(document.getElementById('dlg_pres').value),
    nombre:           document.getElementById('dlg_nombre').value.trim(),
    fecha_inicio:     document.getElementById('dlg_inicio').value,
    duracion_semanas: parseInt(document.getElementById('dlg_semanas').value),
    observaciones:    document.getElementById('dlg_obs').value.trim(),
  };
  if (!body.nombre) return toast('Ingrese un nombre', 'error');
  try {
    const r = await api.post('/api/seguimiento/cronogramas', body);
    hideModal();
    toast('Cronograma creado', 'success');
    await abrirGantt(r.id_cronograma, true);
  } catch(e) { toast(e.error||'Error al crear', 'error'); }
}

async function eliminarCronograma(id) {
  if (!confirm('¿Eliminar este cronograma y todos sus datos de avance?')) return;
  try {
    await api.delete(`/api/seguimiento/cronogramas/${id}`);
    toast('Cronograma eliminado', 'info');
    await cargarListaCronogramas();
  } catch(e) { toast(e.error||'Error', 'error'); }
}

// ── VISTA GANTT ──────────────────────────────────────────────
async function abrirGantt(id, importar=false) {
  const box = document.getElementById('seg-content');
  box.innerHTML = `<div class="loading-msg">Cargando Gantt…</div>`;
  try {
    const cronogramas = await api.get('/api/seguimiento/cronogramas');
    const c = cronogramas.find(x => x.id_cronograma === id);
    if (!c) { toast('Cronograma no encontrado','error'); return; }

    if (importar) {
      await api.post(`/api/seguimiento/cronogramas/${id}/tareas/importar-presupuesto`, {});
      toast('Actividades importadas del presupuesto','success');
    }

    const tareas = await api.get(`/api/seguimiento/cronogramas/${id}/tareas`);
    renderGanttUI(c, tareas);
  } catch(e) { box.innerHTML = `<div class="error-msg">Error: ${e.error||e.message}</div>`; }
}

function renderGanttUI(cron, tareas) {
  const box = document.getElementById('seg-content');
  const N   = cron.duracion_semanas;
  const semanas = Array.from({length: N}, (_,i) => i+1);
  const totalPeso = tareas.filter(t=>t.tipo==='actividad').reduce((s,t)=>s+(t.peso_ponderado||0),0);

  // Fechas de encabezado
  const fechaInicio = new Date(cron.fecha_inicio + 'T12:00:00');
  const headCols = semanas.map(s => {
    const d = new Date(fechaInicio); d.setDate(d.getDate() + (s-1)*7);
    return `<th class="gantt-week" title="Semana ${s} — ${d.toLocaleDateString('es-HN')}">S${s}<br><span class="gantt-fecha">${d.toLocaleDateString('es-HN',{day:'2-digit',month:'short'})}</span></th>`;
  }).join('');

  const filas = tareas.map(t => {
    const esMódulo = t.tipo === 'modulo';
    const inicio = t.semana_inicio;
    const fin    = inicio + t.duracion_semanas - 1;
    const celdas = semanas.map(s => {
      const activa = s >= inicio && s <= fin;
      let cls = activa ? (esMódulo ? 'gantt-bar-cap' : 'gantt-bar') : '';
      const esI = s === inicio, esF = s === fin || s === N;
      const rad  = `${esI?'5px':'0'} ${(esF||s===fin)?'5px':'0'} ${(esF||s===fin)?'5px':'0'} ${esI?'5px':'0'}`;
      return `<td class="gantt-cell ${cls}" style="${activa?`border-radius:${rad}`:''}"></td>`;
    }).join('');

    const peso = t.peso_ponderado ? `${t.peso_ponderado.toFixed(1)}%` : '—';
    return `
      <tr class="${esMódulo?'gantt-row-cap':''}" data-tarea="${t.id_tarea}">
        <td class="gantt-desc ${esMódulo?'gantt-desc-cap':''}" title="${t.descripcion}">
          ${esMódulo?'<span class="gantt-cap-icon">▸</span>':'<span style="display:inline-block;width:14px"></span>'}
          ${t.descripcion.length>34?t.descripcion.slice(0,32)+'…':t.descripcion}
        </td>
        <td class="gantt-peso">${peso}</td>
        <td class="gantt-ini"><input type="number" class="gantt-input" min="1" max="${N}" value="${inicio}" data-field="semana_inicio" data-id="${t.id_tarea}"></td>
        <td class="gantt-dur"><input type="number" class="gantt-input" min="1" max="${N}" value="${t.duracion_semanas}" data-field="duracion" data-id="${t.id_tarea}"></td>
        ${celdas}
      </tr>`;
  }).join('');

  box.innerHTML = `
    <div class="seg-toolbar">
      <div class="seg-title-box">
        <strong>${cron.nombre}</strong>
        <span class="seg-meta-pill">${cron.presupuesto_nombre}</span>
        <span class="seg-meta-pill">${N} semanas</span>
      </div>
      <div class="btn-group">
        <button class="btn btn-secondary" onclick="cargarListaCronogramas()">← Volver</button>
        <button class="btn btn-secondary" onclick="guardarGantt(${cron.id_cronograma})">💾 Guardar</button>
        <button class="btn btn-secondary" onclick="exportarGanttExcel(${cron.id_cronograma})">📥 Excel</button>
        <button class="btn btn-secondary" onclick="abrirGantt(${cron.id_cronograma},true)">🔄 Re-importar</button>
        <button class="btn btn-orange" onclick="abrirAvances(${cron.id_cronograma})">📈 Registrar Avances →</button>
      </div>
    </div>

    <div class="gantt-hint">
      💡 <strong>Inicio</strong> y <strong>Dur.</strong> = número de semana. Edite los campos y presione <strong>Guardar</strong>.
      Las barras se actualizan en tiempo real. Los pesos % provienen del presupuesto.
    </div>

    <div class="gantt-wrapper">
      <table class="gantt-table" id="ganttTable">
        <colgroup>
          <col style="width:230px"><col style="width:52px"><col style="width:46px"><col style="width:46px">
          ${semanas.map(()=>'<col style="min-width:32px;width:32px">').join('')}
        </colgroup>
        <thead>
          <tr>
            <th class="gantt-th-desc">Actividad</th>
            <th class="gantt-peso gantt-th">Peso%</th>
            <th class="gantt-th">Ini.</th>
            <th class="gantt-th">Dur.</th>
            ${headCols}
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
    <p style="font-size:11px;opacity:.4;margin-top:.5rem">
      Peso total actividades: ${totalPeso.toFixed(1)}% (ideal = 100%)
    </p>
  `;

  // Re-render en tiempo real
  document.getElementById('ganttTable').addEventListener('change', e => {
    const inp = e.target;
    if (!inp.classList.contains('gantt-input')) return;
    const row   = inp.closest('tr');
    const id    = inp.dataset.id;
    const field = inp.dataset.field;
    const val   = Math.max(1, parseInt(inp.value)||1);
    const tarea = tareas.find(t => t.id_tarea == id);
    if (!tarea) return;
    if (field==='semana_inicio')  tarea.semana_inicio = val;
    if (field==='duracion')       tarea.duracion_semanas = val;
    const ini = tarea.semana_inicio, dur = tarea.duracion_semanas, fin = ini + dur - 1;
    const esMódulo = tarea.tipo==='modulo';
    row.querySelectorAll('.gantt-cell').forEach((cell, idx) => {
      const s = idx + 1;
      const activa = s >= ini && s <= fin;
      cell.className = 'gantt-cell ' + (activa ? (esMódulo?'gantt-bar-cap':'gantt-bar') : '');
      if (activa) {
        const esI=s===ini, esF=s===fin;
        cell.style.borderRadius=`${esI?'5px':'0'} ${esF?'5px':'0'} ${esF?'5px':'0'} ${esI?'5px':'0'}`;
      } else { cell.style.borderRadius=''; }
    });
  });

  // Guardar referencia para Excel
  window._ganttCron  = cron;
  window._ganttTareas= tareas;
}

async function guardarGantt(id_cronograma) {
  const inputs = document.querySelectorAll('.gantt-input');
  const map = {};
  inputs.forEach(inp => {
    const tid = inp.dataset.id;
    if (!map[tid]) map[tid] = {id_tarea: parseInt(tid), peso_ponderado: 0};
    if (inp.dataset.field === 'semana_inicio') map[tid].semana_inicio   = parseInt(inp.value)||1;
    if (inp.dataset.field === 'duracion')      map[tid].duracion_semanas= parseInt(inp.value)||1;
  });
  const tareas = Object.values(map).map((t,i) => ({...t, orden_visual: i+1}));
  try {
    await api.put('/api/seguimiento/tareas/batch/update', {tareas});
    toast('Cronograma guardado ✓', 'success');
  } catch(e) { toast(e.error||'Error al guardar','error'); }
}

// ── EXPORTAR GANTT A EXCEL ────────────────────────────────────
async function exportarGanttExcel(id_cronograma) {
  try {
    const cron   = window._ganttCron;
    const tareas = window._ganttTareas;
    if (!cron || !tareas) { toast('Cargue el Gantt primero','error'); return; }

    // Leer valores actuales del DOM (pueden tener cambios no guardados)
    const inputs = document.querySelectorAll('.gantt-input');
    const mapaInputs = {};
    inputs.forEach(inp => {
      const tid = inp.dataset.id;
      if (!mapaInputs[tid]) mapaInputs[tid] = {};
      if (inp.dataset.field==='semana_inicio') mapaInputs[tid].semana_inicio   = parseInt(inp.value)||1;
      if (inp.dataset.field==='duracion')      mapaInputs[tid].duracion_semanas= parseInt(inp.value)||1;
    });
    // Mezclar con datos de tarea
    const tareasActuales = tareas.map(t => ({
      ...t,
      semana_inicio:    mapaInputs[t.id_tarea]?.semana_inicio    ?? t.semana_inicio,
      duracion_semanas: mapaInputs[t.id_tarea]?.duracion_semanas ?? t.duracion_semanas,
    }));

    const N = cron.duracion_semanas;
    const fechaInicio = new Date(cron.fecha_inicio + 'T12:00:00');

    // Construir CSV — compatible con Excel
    const SEP = '\t'; // tabulador para pegar directo en Excel
    const lines = [];

    // Encabezado principal
    lines.push(`CRONOGRAMA DE OBRA${SEP}${cron.nombre}`);
    lines.push(`Presupuesto${SEP}${cron.presupuesto_nombre || ''}`);
    lines.push(`Fecha inicio${SEP}${cron.fecha_inicio}${SEP}Duración${SEP}${N} semanas`);
    lines.push('');

    // Encabezado semanas
    const semanasHeader = Array.from({length:N},(_,i)=>{
      const d=new Date(fechaInicio); d.setDate(d.getDate()+i*7);
      return `S${i+1} (${d.toLocaleDateString('es-HN',{day:'2-digit',month:'short'})})`;
    });
    lines.push(`Actividad${SEP}Peso%${SEP}Inicio${SEP}Duración${SEP}${semanasHeader.join(SEP)}`);

    // Filas de actividades
    tareasActuales.forEach(t => {
      const esMódulo = t.tipo === 'modulo';
      const ini = t.semana_inicio;
      const fin = ini + t.duracion_semanas - 1;
      const peso = t.peso_ponderado ? t.peso_ponderado.toFixed(1)+'%' : '';
      const prefijo = esMódulo ? '' : '   ';
      const celdas = Array.from({length:N},(_,i)=>{
        const s = i+1;
        return (s >= ini && s <= fin) ? '█' : '';
      });
      lines.push(`${prefijo}${t.descripcion}${SEP}${peso}${SEP}${ini}${SEP}${t.duracion_semanas}${SEP}${celdas.join(SEP)}`);
    });

    // Generar y descargar
    const contenido = lines.join('\n');
    const blob = new Blob(['\uFEFF'+contenido], {type:'text/tab-separated-values;charset=utf-8'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Gantt_${cron.nombre.replace(/\s+/g,'_')}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Gantt exportado a Excel ✓', 'success');
  } catch(e) { toast('Error al exportar: '+e.message,'error'); }
}

// ── AVANCES ──────────────────────────────────────────────────
async function abrirAvances(id) {
  const box = document.getElementById('seg-content');
  box.innerHTML = `<div class="loading-msg">Cargando…</div>`;
  try {
    const cronogramas = await api.get('/api/seguimiento/cronogramas');
    const c = cronogramas.find(x => x.id_cronograma === id);
    const [tareas, periodos] = await Promise.all([
      api.get(`/api/seguimiento/cronogramas/${id}/tareas`),
      api.get(`/api/seguimiento/cronogramas/${id}/periodos`)
    ]);
    renderAvancesUI(c, tareas, periodos);
  } catch(e) { box.innerHTML = `<div class="error-msg">Error: ${e.error||e.message}</div>`; }
}

function renderAvancesUI(cron, tareas, periodos) {
  const box = document.getElementById('seg-content');
  const actividades = tareas.filter(t => t.tipo === 'actividad');

  box.innerHTML = `
    <div class="seg-toolbar">
      <div class="seg-title-box">
        <strong>${cron.nombre}</strong>
        <span class="seg-meta-pill">${cron.presupuesto_nombre}</span>
      </div>
      <div class="btn-group">
        <button class="btn btn-secondary" onclick="cargarListaCronogramas()">← Volver</button>
        <button class="btn btn-secondary" onclick="abrirGantt(${cron.id_cronograma})">📊 Gantt</button>
        <button class="btn btn-secondary" onclick="abrirResumen(${cron.id_cronograma})">📋 Resumen</button>
      </div>
    </div>

    <!-- PERÍODOS -->
    <div class="seg-section">
      <div class="seg-section-header">
        <span>⏱ Períodos de corte</span>
        <button class="btn btn-orange" onclick="dlgNuevoPeriodo(${cron.id_cronograma})">+ Nuevo período</button>
      </div>
      <div class="periodo-tabs" id="periodoTabs">
        ${periodos.map(p => `
          <button class="periodo-tab ${p.cerrado?'cerrado':''}" id="ptab-${p.id_periodo}"
            onclick="seleccionarPeriodo(${cron.id_cronograma},${p.id_periodo},'${p.descripcion}')">
            ${p.descripcion}<br><small>${p.fecha_corte}</small>
          </button>
        `).join('') || '<span style="opacity:.4;font-size:13px;padding:.5rem">Cree un período para registrar avances</span>'}
      </div>
    </div>

    <!-- TABLA AVANCES -->
    <div class="seg-section" id="avanceSection" style="display:none">
      <div class="seg-section-header">
        <span id="avancePeriodoLabel">Avances</span>
        <div class="btn-group">
          <button class="btn btn-secondary" onclick="guardarAvances()">💾 Guardar avances</button>
          <button class="btn btn-danger" onclick="cerrarPeriodo()">🔒 Cerrar período</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table" id="avanceTable">
          <thead><tr>
            <th>Actividad</th><th>Unid.</th>
            <th class="text-right">Cant. Pres.</th>
            <th class="text-right">Monto Pres. (L)</th>
            <th>Cant. Ejecutada</th>
            <th>% Físico</th>
            <th>Monto Ejecutado (L)</th>
            <th>Nota</th>
          </tr></thead>
          <tbody id="avanceTbody"></tbody>
        </table>
      </div>
    </div>
  `;

  window._segCron    = cron;
  window._segTareas  = actividades;
  window._segPeriodo = null;
}

async function dlgNuevoPeriodo(id_cronograma) {
  const periodos = await api.get(`/api/seguimiento/cronogramas/${id_cronograma}/periodos`);
  const siguiente = periodos.length + 1;
  showModal('Nuevo Período de Corte', `
    <div class="form-grid2">
      <div class="field-group">
        <label>Número</label>
        <input id="pd_num" type="number" value="${siguiente}" min="1">
      </div>
      <div class="field-group">
        <label>Fecha de corte</label>
        <input id="pd_fecha" type="date" value="${new Date().toISOString().split('T')[0]}">
      </div>
      <div class="field-group" style="grid-column:1/-1">
        <label>Descripción</label>
        <input id="pd_desc" type="text" placeholder="Ej: Semana 1, Quincena 1, Mes 1…" value="Período ${siguiente}">
      </div>
    </div>
    <div style="margin-top:1rem;display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-orange" onclick="crearPeriodo(${id_cronograma})">Crear</button>
    </div>
  `);
}

async function crearPeriodo(id_cronograma) {
  const body = {
    numero_periodo: parseInt(document.getElementById('pd_num').value),
    fecha_corte:    document.getElementById('pd_fecha').value,
    descripcion:    document.getElementById('pd_desc').value.trim(),
  };
  try {
    await api.post(`/api/seguimiento/cronogramas/${id_cronograma}/periodos`, body);
    hideModal();
    toast('Período creado','success');
    await abrirAvances(id_cronograma);
  } catch(e) { toast(e.error||'Error','error'); }
}

async function seleccionarPeriodo(id_cronograma, id_periodo, label) {
  document.querySelectorAll('.periodo-tab').forEach(b => b.classList.remove('activo'));
  const tab = document.getElementById(`ptab-${id_periodo}`);
  if (tab) tab.classList.add('activo');
  window._segPeriodo = id_periodo;

  let avancesExistentes = {};
  try {
    const avs = await api.get(`/api/seguimiento/periodos/${id_periodo}/avances`);
    avs.forEach(a => { avancesExistentes[a.id_tarea] = a; });
  } catch(e) {}

  const actividades = window._segTareas;
  document.getElementById('avancePeriodoLabel').textContent = `Avances — ${label}`;
  document.getElementById('avanceSection').style.display = '';

  const tbody = document.getElementById('avanceTbody');
  tbody.innerHTML = actividades.map(t => {
    const av = avancesExistentes[t.id_tarea] || {};
    const cantPres  = (t.cantidad_presupuestada||0).toLocaleString('es-HN',{minimumFractionDigits:2});
    const montoPres = (t.monto_presupuestado||0).toLocaleString('es-HN',{minimumFractionDigits:2});
    return `
      <tr data-tarea="${t.id_tarea}" data-monto-pres="${t.monto_presupuestado||0}" data-cant-pres="${t.cantidad_presupuestada||0}">
        <td style="font-size:12px">${t.descripcion}</td>
        <td style="text-align:center">${t.unidad||'—'}</td>
        <td class="text-right">${cantPres}</td>
        <td class="text-right">${montoPres}</td>
        <td><input type="number" class="av-cant" min="0" step="0.01" value="${av.cantidad_ejecutada||0}" style="width:84px"></td>
        <td style="white-space:nowrap"><input type="number" class="av-fisico" min="0" max="100" step="0.1" value="${av.avance_fisico_pct||0}" style="width:60px"> %</td>
        <td><input type="number" class="av-monto" min="0" step="0.01" value="${av.monto_ejecutado||0}" style="width:110px"></td>
        <td><input type="text" class="av-nota" value="${av.observacion||''}" style="width:130px" placeholder="Obs…"></td>
      </tr>`;
  }).join('');

  // Auto-calcular al cambiar cantidad o % físico
  tbody.addEventListener('input', e => {
    const row       = e.target.closest('tr');
    if (!row) return;
    const montoPres = parseFloat(row.dataset.montoPres)||0;
    const cantPres  = parseFloat(row.dataset.cantPres)||1;
    if (e.target.classList.contains('av-fisico')) {
      const pct = parseFloat(e.target.value)||0;
      row.querySelector('.av-monto').value = (montoPres * pct / 100).toFixed(2);
    }
    if (e.target.classList.contains('av-cant')) {
      const cant = parseFloat(e.target.value)||0;
      const pct  = Math.min(100, (cant / cantPres) * 100);
      row.querySelector('.av-fisico').value = pct.toFixed(1);
      row.querySelector('.av-monto').value  = (montoPres * pct / 100).toFixed(2);
    }
  });
}

async function guardarAvances() {
  if (!window._segPeriodo) return toast('Seleccione un período','error');
  const rows = document.querySelectorAll('#avanceTbody tr');
  const avances = [];
  rows.forEach(row => {
    avances.push({
      id_tarea:           parseInt(row.dataset.tarea),
      avance_fisico_pct:  parseFloat(row.querySelector('.av-fisico').value)||0,
      cantidad_ejecutada: parseFloat(row.querySelector('.av-cant').value)||0,
      monto_ejecutado:    parseFloat(row.querySelector('.av-monto').value)||0,
      observacion:        row.querySelector('.av-nota').value.trim(),
    });
  });
  try {
    await api.post(`/api/seguimiento/periodos/${window._segPeriodo}/avances`, {avances});
    toast('Avances guardados ✓','success');
  } catch(e) { toast(e.error||'Error','error'); }
}

async function cerrarPeriodo() {
  if (!window._segPeriodo) return;
  if (!confirm('¿Cerrar este período? Ya no se podrán editar sus avances.')) return;
  try {
    await api.put(`/api/seguimiento/periodos/${window._segPeriodo}/cerrar`, {});
    toast('Período cerrado','info');
    await abrirAvances(window._segCron.id_cronograma);
  } catch(e) { toast(e.error||'Error','error'); }
}

// ── RESUMEN / CURVA S ─────────────────────────────────────────
async function abrirResumen(id) {
  const box = document.getElementById('seg-content');
  box.innerHTML = `<div class="loading-msg">Calculando…</div>`;
  try {
    const data = await api.get(`/api/seguimiento/cronogramas/${id}/resumen`);
    renderResumenUI(id, data);
  } catch(e) { box.innerHTML = `<div class="error-msg">Error: ${e.error||e.message}</div>`; }
}

function renderResumenUI(id, data) {
  const { cronograma: c, kpis, curvaS, tareas, periodos, avancesAcumulados } = data;
  const box = document.getElementById('seg-content');
  const desviColor = kpis.desviacion >= 0 ? '#22c55e' : '#ef4444';
  const desviIcon  = kpis.desviacion >= 0 ? '▲' : '▼';

  // Curva real por período
  const avancePorPeriodo = periodos.map(per => {
    let avPond = 0;
    tareas.filter(t=>t.tipo==='actividad').forEach(t => {
      const av = avancesAcumulados[t.id_tarea];
      if (av) avPond += (av.fisico * (t.peso_ponderado||0) / 100);
    });
    return {descripcion: per.descripcion, avance: Math.min(100, avPond)};
  });

  // Tabla por actividad
  const filasTareas = tareas.filter(t=>t.tipo!=='modulo').map(t => {
    const av        = avancesAcumulados[t.id_tarea] || {fisico:0, monto:0};
    const montoPres = t.monto_presupuestado||0;
    const avFin     = montoPres > 0 ? Math.min(100,(av.monto/montoPres*100)) : 0;
    const diff      = av.fisico - avFin;
    const diffColor = diff >= 0 ? '#22c55e' : '#ef4444';
    return `
      <tr>
        <td style="font-size:12px">${t.descripcion}</td>
        <td class="text-right">${(montoPres).toLocaleString('es-HN',{minimumFractionDigits:0})}</td>
        <td class="text-right">${(av.monto||0).toLocaleString('es-HN',{minimumFractionDigits:0})}</td>
        <td><div class="mini-bar"><div class="mini-fill mini-fill-blue" style="width:${av.fisico||0}%"></div></div> ${(av.fisico||0).toFixed(1)}%</td>
        <td><div class="mini-bar"><div class="mini-fill mini-fill-orange" style="width:${avFin}%"></div></div> ${avFin.toFixed(1)}%</td>
        <td style="color:${diffColor};font-weight:600;text-align:center">${diff>=0?'+':''}${diff.toFixed(1)}%</td>
      </tr>`;
  }).join('');

  box.innerHTML = `
    <div class="seg-toolbar">
      <div class="seg-title-box">
        <strong>${c.nombre}</strong>
        <span class="seg-meta-pill">${c.presupuesto_nombre}</span>
      </div>
      <div class="btn-group">
        <button class="btn btn-secondary" onclick="cargarListaCronogramas()">← Volver</button>
        <button class="btn btn-secondary" onclick="abrirGantt(${id})">📊 Gantt</button>
        <button class="btn btn-secondary" onclick="abrirAvances(${id})">📈 Avances</button>
        <button class="btn btn-orange" onclick="window.print()">🖨 Imprimir</button>
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-row" id="resumenContent">
      <div class="kpi-card">
        <div class="kpi-label">Avance Físico Global</div>
        <div class="kpi-value" style="color:#3b82f6">${kpis.avanceFisico.toFixed(1)}%</div>
        <div class="kpi-bar"><div class="kpi-fill" style="width:${kpis.avanceFisico}%;background:#3b82f6"></div></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Avance Financiero</div>
        <div class="kpi-value" style="color:#f59e0b">${kpis.avanceFinanciero.toFixed(1)}%</div>
        <div class="kpi-bar"><div class="kpi-fill" style="width:${kpis.avanceFinanciero}%;background:#f59e0b"></div></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Monto Ejecutado</div>
        <div class="kpi-value" style="font-size:18px">L ${(kpis.montoEjecutado||0).toLocaleString('es-HN',{minimumFractionDigits:0})}</div>
        <div style="font-size:11px;opacity:.5">de L ${(kpis.montoTotal||0).toLocaleString('es-HN',{minimumFractionDigits:0})}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Desviación Física — Financiera</div>
        <div class="kpi-value" style="color:${desviColor}">${desviIcon} ${Math.abs(kpis.desviacion).toFixed(1)}%</div>
        <div style="font-size:11px;color:${desviColor}">${kpis.desviacion>=0?'Ejecución adelantada al gasto':'Gasto adelantado a ejecución'}</div>
      </div>
    </div>

    <!-- CURVA S -->
    <div class="seg-section">
      <div class="seg-section-header"><span>📈 Curva S — Avance Planificado vs Real</span></div>
      <div class="curvas-container">${renderCurvaS(curvaS, avancePorPeriodo, kpis.avanceFisico)}</div>
    </div>

    <!-- TABLA RESUMEN -->
    <div class="seg-section">
      <div class="seg-section-header"><span>📋 Resumen por Actividad</span></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Actividad</th>
            <th class="text-right">Monto Pres. (L)</th>
            <th class="text-right">Monto Ejec. (L)</th>
            <th>% Físico</th><th>% Financiero</th>
            <th style="text-align:center">Desv.</th>
          </tr></thead>
          <tbody>${filasTareas}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderCurvaS(curvaS, avanceReal, avanceFisicoActual) {
  const W=760, H=240, PAD=42;
  const nSem = curvaS.length;
  if (!nSem) return '<p style="opacity:.4;padding:1rem">Sin datos de semanas</p>';
  const xScale = s => PAD + (s-1)*((W-PAD*2)/(nSem-1||1));
  const yScale = v => H-PAD-(v/100)*(H-PAD*2);
  const pathPlan = curvaS.map((p,i)=>`${i===0?'M':'L'}${xScale(p.semana).toFixed(1)},${yScale(p.planificado).toFixed(1)}`).join(' ');
  let pathReal = '';
  if (avanceReal.length) {
    const step = (nSem-1)/Math.max(avanceReal.length,1);
    pathReal = avanceReal.map((p,i)=>`${i===0?'M':'L'}${xScale(1+Math.round(i*step)).toFixed(1)},${yScale(p.avance).toFixed(1)}`).join(' ');
  }
  const guias = [0,25,50,75,100].map(v =>
    `<line x1="${PAD}" y1="${yScale(v).toFixed(1)}" x2="${W-PAD}" y2="${yScale(v).toFixed(1)}" stroke="rgba(255,255,255,.06)" stroke-width="1"/>
     <text x="${PAD-5}" y="${(yScale(v)+4).toFixed(1)}" fill="rgba(255,255,255,.3)" font-size="10" text-anchor="end">${v}%</text>`
  ).join('');
  const ticksX = curvaS.filter((_,i)=>i%4===0||i===nSem-1).map(p =>
    `<text x="${xScale(p.semana).toFixed(1)}" y="${H-PAD+14}" fill="rgba(255,255,255,.3)" font-size="10" text-anchor="middle">S${p.semana}</text>`
  ).join('');
  return `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;height:auto;display:block">
      <rect width="${W}" height="${H}" rx="8" fill="rgba(0,0,0,.15)"/>
      ${guias}${ticksX}
      <path d="${pathPlan} L${xScale(nSem).toFixed(1)},${yScale(0).toFixed(1)} L${xScale(1).toFixed(1)},${yScale(0).toFixed(1)} Z" fill="rgba(59,130,246,.1)"/>
      <path d="${pathPlan}" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-dasharray="6,3"/>
      ${pathReal?`<path d="${pathReal}" fill="none" stroke="#f59e0b" stroke-width="2.5"/>`:''}
      <rect x="${PAD}" y="12" width="14" height="3" rx="2" fill="#3b82f6" opacity=".8"/>
      <text x="${PAD+18}" y="18" fill="rgba(255,255,255,.6)" font-size="11">Planificado</text>
      ${pathReal?`<rect x="${PAD+115}" y="12" width="14" height="3" rx="2" fill="#f59e0b"/>
      <text x="${PAD+133}" y="18" fill="rgba(255,255,255,.6)" font-size="11">Real ejecutado</text>`:''}
    </svg>`;
}
