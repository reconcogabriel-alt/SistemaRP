// public/js/pages/bitacora.js

let _bitPresupuesto = null;
let _bitEntradas = [];
let _bitEditId   = null;

async function renderBitacora(ctx = {}) {
  if (ctx && ctx.id_presupuesto) _bitPresupuesto = ctx;
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">BITÁCORA DE OBRA</div>
        <div class="page-subtitle">Registro diario · Personal · Actividades · Calidad · Incidentes</div>
      </div>
    </div>
    <div class="page-body" id="bit-body">
      ${_bitPresupuesto ? '' : _bitSelectorHTML()}
    </div>`;
  if (!_bitPresupuesto) { await _bitCargarSelector(); }
  else                    { await _bitMostrarModulo(); }
}

function _bitSelectorHTML() {
  return `<div class="card">
    <div class="card-header"><div class="card-title">📋 Seleccionar Presupuesto</div></div>
    <div class="card-body">
      <p style="color:var(--text-muted);margin-bottom:14px">Seleccione el presupuesto para su bitácora de obra:</p>
      <div id="bit-sel"><div class="loading"><div class="spinner"></div> Cargando...</div></div>
    </div>
  </div>`;
}

async function _bitCargarSelector() {
  try {
    const lista = await api.get('/api/presupuestos');
    const wrap  = document.getElementById('bit-sel');
    if (!lista.length) {
      wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">◻</div><div class="empty-title">Sin presupuestos</div></div>`;
      return;
    }
    wrap.innerHTML = `<table>
      <thead><tr><th>#</th><th>Presupuesto</th><th>Ubicación</th><th>Cliente</th><th>Monto Total</th><th></th></tr></thead>
      <tbody>${lista.map(p => `<tr>
        <td style="color:var(--text-muted);font-size:12px">${p.id_presupuesto}</td>
        <td><strong style="color:var(--blue)">${sanitize(p.nombre)}</strong></td>
        <td style="font-size:12px;color:var(--text-muted)">${sanitize(p.ubicacion||'—')}</td>
        <td>${sanitize(p.cliente||'—')}</td>
        <td class="td-monto">L ${fmt(p.total_general||0)}</td>
        <td><button class="btn btn-sm btn-doc-blue"
          onclick="_bitSeleccionar(${p.id_presupuesto},'${sanitize(p.nombre).replace(/'/g,"\\'")}','${sanitize(p.cliente||'').replace(/'/g,"\\'")}')">
          📋 Abrir</button></td>
      </tr>`).join('')}</tbody></table>`;
  } catch(e) {
    document.getElementById('bit-sel').innerHTML = `<div class="empty-state"><div class="empty-icon">✕</div><div>${e.error||e.message}</div></div>`;
  }
}

async function _bitSeleccionar(id, nombre, cliente) {
  _bitPresupuesto = { id_presupuesto: id, nombre, cliente };
  document.getElementById('bit-body').innerHTML = '';
  await _bitMostrarModulo();
}

async function _bitMostrarModulo() {
  const body = document.getElementById('bit-body');
  const p    = _bitPresupuesto;
  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <button class="btn btn-sm btn-doc-ghost" onclick="_bitCambiarPresupuesto()">← Presupuestos</button>
      <strong style="color:var(--blue)">${sanitize(p.nombre)}</strong>
      ${p.cliente?`<span style="color:var(--text-muted);font-size:12px">— ${sanitize(p.cliente)}</span>`:''}
    </div>

    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:14px">
      <div class="stat-card"><div class="stat-value" id="bit-k-ent">—</div><div class="stat-label">Entradas</div></div>
      <div class="stat-card green"><div class="stat-value" id="bit-k-av">—</div><div class="stat-label">Avance físico</div></div>
      <div class="stat-card"><div class="stat-value" id="bit-k-per">—</div><div class="stat-label">Jornadas-persona</div></div>
      <div class="stat-card orange"><div class="stat-value" id="bit-k-llu">—</div><div class="stat-label">Días lluvia</div></div>
      <div class="stat-card" style="border-top-color:var(--red)">
        <div class="stat-value" id="bit-k-inc" style="color:var(--red)">—</div>
        <div class="stat-label">C/Incidente</div>
      </div>
    </div>

    <div class="toolbar" style="margin-bottom:10px">
      <span style="font-size:13px;font-weight:600;color:var(--blue);flex:1">Entradas de Bitácora</span>
      <label style="font-size:12px;color:var(--text-muted)">Desde</label>
      <input type="date" id="bit-desde" onchange="_bitCargar()" style="padding:5px 8px;border:1px solid var(--gray-mid);border-radius:var(--radius);font-size:13px">
      <label style="font-size:12px;color:var(--text-muted)">Hasta</label>
      <input type="date" id="bit-hasta" onchange="_bitCargar()" style="padding:5px 8px;border:1px solid var(--gray-mid);border-radius:var(--radius);font-size:13px">
      <input type="text" class="search-box" id="bit-q" placeholder="🔍 Buscar..." oninput="_bitCargar()" style="width:160px">
      <button class="btn btn-secondary" onclick="_bitImprimirTodas()" title="Imprimir todas las entradas del filtro actual">🖨 Imprimir</button>
      <button class="btn btn-orange" onclick="_bitAbrirModal()">+ Nueva Entrada</button>
    </div>

    <div id="bit-lista"></div>`;

  await _bitCargarKPIs();
  await _bitCargar();
}

function _bitCambiarPresupuesto() { _bitPresupuesto = null; renderBitacora(); }

async function _bitCargarKPIs() {
  if (!_bitPresupuesto) return;
  try {
    const s = await api.get(`/api/bitacora/resumen/${_bitPresupuesto.id_presupuesto}`);
    const set=(id,v)=>{ const e=document.getElementById(id); if(e) e.textContent=v; };
    set('bit-k-ent', s.total_entradas||0);
    set('bit-k-av',  `${s.avance_actual||0}%`);
    set('bit-k-per', s.total_jornadas_persona||0);
    set('bit-k-llu', s.dias_lluvia||0);
    set('bit-k-inc', s.entradas_con_incidentes||0);
  } catch(e) {}
}

async function _bitCargar() {
  if (!_bitPresupuesto) return;
  try {
    let url = `/api/bitacora/presupuesto/${_bitPresupuesto.id_presupuesto}?`;
    const desde = document.getElementById('bit-desde')?.value;
    const hasta = document.getElementById('bit-hasta')?.value;
    const q     = document.getElementById('bit-q')?.value;
    if (desde) url += `desde=${desde}&`;
    if (hasta) url += `hasta=${hasta}&`;
    if (q)     url += `q=${encodeURIComponent(q)}`;
    _bitEntradas = await api.get(url);
    _bitRender();
  } catch(e) {
    const d=document.getElementById('bit-lista');
    if(d) d.innerHTML=`<div class="empty-state"><div class="empty-icon">✕</div><div>${e.error||e.message}</div></div>`;
  }
}

function _bitRender() {
  const div = document.getElementById('bit-lista');
  if (!div) return;
  if (!_bitEntradas.length) {
    div.innerHTML=`<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">Sin entradas registradas</div><div class="empty-desc">Haga clic en "+ Nueva Entrada" para comenzar</div></div>`;
    return;
  }
  const cIco = {soleado:'☀️',nublado:'☁️',parcialmente_nublado:'⛅',lluvioso:'🌧️'};
  div.innerHTML = _bitEntradas.map(e => {
    const tieneInc = !!(e.incidentes && e.incidentes.trim());
    const esLluvia = e.condicion_clima==='lluvioso';
    const totPer   = (e.personal_profesional||0)+(e.personal_tecnico||0)+(e.personal_operativo||0);
    const av       = e.avance_fisico||0;
    const brd      = tieneInc?'var(--red)':esLluvia?'#4A90D9':'var(--blue)';
    return `
    <div style="background:var(--white);border-radius:var(--radius);box-shadow:var(--shadow);margin-bottom:10px;border-left:4px solid ${brd}">
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer"
           onclick="_bitToggle(${e.id})" id="bit-hdr-${e.id}">
        <span style="background:var(--blue);color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:3px;white-space:nowrap">N° ${e.numero_entrada}</span>
        <div style="flex:1">
          <div style="font-weight:600;font-size:13px">${_bitFecha(e.fecha)}</div>
          <div style="font-size:11px;color:var(--text-muted)">${e.hora_inicio||''}${e.hora_fin?' → '+e.hora_fin:''}</div>
        </div>
        <span style="font-size:18px">${cIco[e.condicion_clima]||'🌤️'}</span>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          ${e.personal_profesional>0?`<span class="badge badge-blue">${e.personal_profesional} Prof.</span>`:''}
          ${e.personal_tecnico>0?`<span class="badge badge-orange">${e.personal_tecnico} Téc.</span>`:''}
          ${e.personal_operativo>0?`<span class="badge badge-activo">${e.personal_operativo} Op.</span>`:''}
          ${totPer===0?`<span class="badge">Sin personal</span>`:''}
        </div>
        <div style="text-align:center;min-width:65px">
          <div style="width:65px;height:6px;background:var(--gray-light);border-radius:3px;overflow:hidden">
            <div style="width:${av}%;height:100%;background:var(--blue);border-radius:3px"></div>
          </div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${av}%</div>
        </div>
        ${tieneInc?`<span title="Incidente registrado" style="font-size:15px">⚠️</span>`:''}
        <span style="color:var(--gray);font-size:12px" id="bit-ico-${e.id}">▼</span>
      </div>
      <div id="bit-cuerpo-${e.id}" style="display:none;padding:12px 14px;border-top:1px solid var(--gray-light)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div>
            ${_bitBloque('📋 Actividades Ejecutadas', e.actividades_ejecutadas)}
            ${e.materiales_utilizados?_bitBloque('🧱 Materiales',e.materiales_utilizados):''}
            ${e.equipos_utilizados?_bitBloque('🚜 Equipos',e.equipos_utilizados):''}
            ${e.subcontratistas?_bitBloque('🏢 Subcontratistas',e.subcontratistas):''}
          </div>
          <div>
            ${e.observaciones_calidad?_bitBloque('✅ Calidad',e.observaciones_calidad):''}
            ${tieneInc?`<div style="margin-bottom:10px"><div style="font-size:10px;font-weight:700;color:var(--gray);text-transform:uppercase;margin-bottom:4px">⚠️ Incidentes</div>
              <div style="background:var(--red-bg);border:1px solid #f0c0c0;border-radius:var(--radius);padding:8px 10px;font-size:13px;color:var(--red)">${sanitize(e.incidentes)}</div></div>`:''}
            ${e.observaciones_seguridad?_bitBloque('🦺 Seguridad',e.observaciones_seguridad):''}
            ${e.visitas?_bitBloque('👤 Visitas',e.visitas):''}
            ${e.instrucciones_recibidas?_bitBloque('📩 Instrucciones',e.instrucciones_recibidas):''}
            ${e.oc_referencias?_bitBloque('🔄 OC Activas',e.oc_referencias):''}
            ${e.fotos_referencias?_bitBloque('📷 Fotografías',e.fotos_referencias):''}
          </div>
        </div>
        ${(e.firma_residente||e.firma_supervisor)?`
        <div style="display:flex;gap:30px;margin-top:12px;padding-top:10px;border-top:1px solid var(--gray-light)">
          <div style="flex:1;text-align:center"><div style="border-top:1px solid #bbb;margin-top:22px;padding-top:4px;font-size:11px;color:var(--text-muted)">${sanitize(e.firma_residente||'Ingeniero Residente')}<br>Elaborado por</div></div>
          <div style="flex:1;text-align:center"><div style="border-top:1px solid #bbb;margin-top:22px;padding-top:4px;font-size:11px;color:var(--text-muted)">${sanitize(e.firma_supervisor||'Supervisor / Fiscal')}<br>Revisado por</div></div>
        </div>`:''}
        <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:10px">
          <button class="btn btn-sm btn-doc-ghost" onclick="_bitImprimirEntrada(${e.id})" title="Imprimir esta entrada">🖨 Imprimir</button>
          <button class="btn btn-sm btn-doc-ghost" onclick="_bitEditar(${e.id})">✏️ Editar</button>
          <button class="btn btn-sm btn-doc-ghost" style="color:var(--red)" onclick="_bitEliminar(${e.id})">🗑 Eliminar</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function _bitBloque(t, c) {
  return `<div style="margin-bottom:10px">
    <div style="font-size:10px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">${t}</div>
    <div style="background:var(--gray-light);border-radius:var(--radius);padding:7px 10px;font-size:13px;line-height:1.5;white-space:pre-wrap">${sanitize(c)}</div>
  </div>`;
}

function _bitToggle(id) {
  const b=document.getElementById(`bit-cuerpo-${id}`);
  const i=document.getElementById(`bit-ico-${id}`);
  if(!b) return;
  const open = b.style.display==='none';
  b.style.display = open?'block':'none';
  if(i) i.textContent = open?'▲':'▼';
}

// ── MODAL ─────────────────────────────────────────────────────
function _bitAbrirModal(e = null) {
  _bitEditId = e ? e.id : null;
  const hoy  = new Date().toISOString().split('T')[0];
  const ta   = (id,val,ph='')=>`<textarea id="${id}" class="doc-ta" style="min-height:55px" placeholder="${ph}">${sanitize(val||'')}</textarea>`;
  showModal(e ? `Editar Entrada N° ${e.numero_entrada}` : 'Nueva Entrada de Bitácora', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px">
      <div style="grid-column:1/-1" class="doc-sep">Encabezado</div>
      <div class="field-group"><label>Fecha *</label><input type="date" id="bf-fecha" value="${e?.fecha||hoy}"></div>
      <div class="field-group"><label>Avance Físico Acumulado (%)</label><input type="number" id="bf-av" min="0" max="100" step="0.5" value="${e?.avance_fisico||0}"></div>
      <div class="field-group"><label>Hora inicio</label><input type="time" id="bf-hi" value="${e?.hora_inicio||'07:00'}"></div>
      <div class="field-group"><label>Hora fin</label><input type="time" id="bf-hf" value="${e?.hora_fin||'17:00'}"></div>

      <div style="grid-column:1/-1" class="doc-sep">Personal en Obra</div>
      <div class="field-group"><label>Profesionales (Ing./Supervisores)</label><input type="number" id="bf-prof" min="0" value="${e?.personal_profesional||0}"></div>
      <div class="field-group"><label>Técnicos (Maestros/Técnicos)</label><input type="number" id="bf-tec" min="0" value="${e?.personal_tecnico||0}"></div>
      <div class="field-group"><label>Operativos (Obreros/Peones)</label><input type="number" id="bf-op" min="0" value="${e?.personal_operativo||0}"></div>
      <div class="field-group"><label>Clima</label>
        <select id="bf-clima">
          <option value="">— Sin registrar —</option>
          <option value="soleado" ${e?.condicion_clima==='soleado'?'selected':''}>☀️ Soleado</option>
          <option value="parcialmente_nublado" ${e?.condicion_clima==='parcialmente_nublado'?'selected':''}>⛅ Parcialmente nublado</option>
          <option value="nublado" ${e?.condicion_clima==='nublado'?'selected':''}>☁️ Nublado</option>
          <option value="lluvioso" ${e?.condicion_clima==='lluvioso'?'selected':''}>🌧️ Lluvioso</option>
        </select>
      </div>

      <div style="grid-column:1/-1" class="doc-sep">Actividades Ejecutadas</div>
      <div class="field-group" style="grid-column:1/-1"><label>Descripción detallada *</label>
        ${ta('bf-act',e?.actividades_ejecutadas,'Trabajos ejecutados: actividades, ubicaciones, avances...')}
      </div>

      <div style="grid-column:1/-1" class="doc-sep">Recursos</div>
      <div class="field-group" style="grid-column:1/-1"><label>Materiales utilizados</label>
        ${ta('bf-mat',e?.materiales_utilizados,'Cemento: 20 bolsas, Acero: 150 kg, Piedra: 2 m³...')}
      </div>
      <div class="field-group"><label>Equipos y maquinaria</label>
        ${ta('bf-eq',e?.equipos_utilizados,'Retroexcavadora: 4h, Vibrador: 2h...')}
      </div>
      <div class="field-group"><label>Subcontratistas</label>
        ${ta('bf-sub',e?.subcontratistas,'Empresa Eléctrica S.A. — 4 electricistas...')}
      </div>

      <div style="grid-column:1/-1" class="doc-sep">Calidad y Seguridad</div>
      <div class="field-group" style="grid-column:1/-1"><label>Observaciones de Calidad</label>
        ${ta('bf-cal',e?.observaciones_calidad,'Cilindros moldeados, inspecciones, no conformidades...')}
      </div>
      <div class="field-group" style="grid-column:1/-1"><label>⚠️ Incidentes / Accidentes (dejar en blanco si no hubo)</label>
        ${ta('bf-inc',e?.incidentes,'Describir con detalle...')}
      </div>
      <div class="field-group"><label>Observaciones de Seguridad</label>
        ${ta('bf-seg',e?.observaciones_seguridad,'EPP, señalización, riesgos observados...')}
      </div>
      <div class="field-group"><label>Visitas recibidas</label>
        ${ta('bf-vis',e?.visitas,'Ing. X (Supervisor ERSAPS) — 10:30 AM...')}
      </div>

      <div style="grid-column:1/-1" class="doc-sep">Instrucciones y Referencias</div>
      <div class="field-group" style="grid-column:1/-1"><label>Instrucciones recibidas</label>
        ${ta('bf-inst',e?.instrucciones_recibidas,'Instrucciones del supervisor o fiscalizador...')}
      </div>
      <div class="field-group"><label>OC Activas que afectan el día</label>
        <input type="text" id="bf-oc" value="${sanitize(e?.oc_referencias||'')}" placeholder="OC-002 activa...">
      </div>
      <div class="field-group"><label>Fotografías (URLs o nombres)</label>
        ${ta('bf-fotos',e?.fotos_referencias,'https://drive.google.com/...')}
      </div>

      <div style="grid-column:1/-1" class="doc-sep">Firmas</div>
      <div class="field-group"><label>Ingeniero Residente (elaborado por)</label>
        <input type="text" id="bf-res" value="${sanitize(e?.firma_residente||'')}" placeholder="Ing. Nombre Apellido">
      </div>
      <div class="field-group"><label>Supervisor / Fiscal del Propietario</label>
        <input type="text" id="bf-sup" value="${sanitize(e?.firma_supervisor||'')}" placeholder="Nombre del supervisor">
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
      <button class="btn btn-ghost" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-orange" onclick="_bitGuardar()">💾 Guardar Entrada</button>
    </div>`, 'modal-lg');
}

async function _bitEditar(id) {
  try { const e=await api.get(`/api/bitacora/${id}`); _bitAbrirModal(e); }
  catch(e) { toast('Error cargando entrada','error'); }
}

async function _bitGuardar() {
  const v = id => document.getElementById(id)?.value||'';
  const body = {
    id_presupuesto:        _bitPresupuesto.id_presupuesto,
    fecha:                 v('bf-fecha'),
    hora_inicio:           v('bf-hi'),
    hora_fin:              v('bf-hf'),
    personal_profesional:  parseInt(v('bf-prof'))||0,
    personal_tecnico:      parseInt(v('bf-tec'))||0,
    personal_operativo:    parseInt(v('bf-op'))||0,
    condicion_clima:       v('bf-clima')||null,
    avance_fisico:         parseFloat(v('bf-av'))||0,
    actividades_ejecutadas:v('bf-act').trim(),
    materiales_utilizados: v('bf-mat')||null,
    equipos_utilizados:    v('bf-eq')||null,
    subcontratistas:       v('bf-sub')||null,
    incidentes:            v('bf-inc')||null,
    observaciones_calidad: v('bf-cal')||null,
    observaciones_seguridad:v('bf-seg')||null,
    visitas:               v('bf-vis')||null,
    instrucciones_recibidas:v('bf-inst')||null,
    oc_referencias:        v('bf-oc')||null,
    fotos_referencias:     v('bf-fotos')||null,
    firma_residente:       v('bf-res'),
    firma_supervisor:      v('bf-sup'),
  };
  if (!body.fecha || !body.actividades_ejecutadas) { toast('Fecha y actividades son requeridas','error'); return; }
  try {
    if (_bitEditId) { await api.put(`/api/bitacora/${_bitEditId}`, body); toast('Entrada actualizada','success'); }
    else            { await api.post('/api/bitacora', body);              toast('Entrada registrada','success'); }
    hideModal();
    await _bitCargarKPIs();
    await _bitCargar();
  } catch(e) { toast(e.error||'Error guardando','error'); }
}

async function _bitEliminar(id) {
  if (!confirm('¿Eliminar esta entrada? No se puede deshacer.')) return;
  try {
    await api.del(`/api/bitacora/${id}`);
    toast('Entrada eliminada','info');
    await _bitCargarKPIs();
    await _bitCargar();
  } catch(e) { toast(e.error||'Error eliminando','error'); }
}

function _bitFecha(f) {
  if (!f) return '—';
  const meses=['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const [y,m,d] = f.split('-');
  return `${parseInt(d)} ${meses[parseInt(m)]} ${y}`;
}

// ── IMPRIMIR ENTRADA INDIVIDUAL ─────────────────────────────
function _bitImprimirEntrada(id) {
  if (!_bitPresupuesto) { toast('Sin presupuesto seleccionado', 'error'); return; }
  const url = `/api/bitacora/pdf/${_bitPresupuesto.id_presupuesto}?id=${id}`;
  window.open(url, '_blank');
}

// ── IMPRIMIR TODAS LAS ENTRADAS DEL FILTRO ACTUAL ──────────
function _bitImprimirTodas() {
  if (!_bitPresupuesto) { toast('Sin presupuesto seleccionado', 'error'); return; }
  if (!_bitEntradas.length) { toast('No hay entradas que imprimir', 'error'); return; }
  const desde = document.getElementById('bit-desde')?.value || '';
  const hasta  = document.getElementById('bit-hasta')?.value || '';
  let url = `/api/bitacora/pdf/${_bitPresupuesto.id_presupuesto}?`;
  if (desde) url += `desde=${desde}&`;
  if (hasta)  url += `hasta=${hasta}&`;
  window.open(url, '_blank');
  toast(`Abriendo ${_bitEntradas.length} entrada(s) para imprimir...`, 'info');
}
