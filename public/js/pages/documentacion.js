// public/js/pages/documentacion.js

let _docPresupuesto = null;
let _docCategorias  = [];
let _docs           = [];
let _docCatActiva   = 0;
let _docEstado      = '';
let _docEditId      = null;

async function renderDocumentacion(ctx = {}) {
  if (ctx && ctx.id_presupuesto) _docPresupuesto = ctx;
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">DOCUMENTACIÓN</div>
        <div class="page-subtitle">Planos · Contratos · Órdenes de Cambio · Permisos y más</div>
      </div>
    </div>
    <div class="page-body" id="doc-body">
      ${_docPresupuesto ? '' : _docSelectorHTML()}
    </div>`;
  if (!_docPresupuesto) {
    await _docCargarSelector();
  } else {
    await _docMostrarModulo();
  }
}

// ── SELECTOR DE PRESUPUESTO ───────────────────────────────────
function _docSelectorHTML() {
  return `<div class="card">
    <div class="card-header"><div class="card-title">📂 Seleccionar Presupuesto</div></div>
    <div class="card-body">
      <p style="color:var(--text-muted);margin-bottom:14px">Seleccione el presupuesto para gestionar su documentación:</p>
      <div id="doc-sel-lista"><div class="loading"><div class="spinner"></div> Cargando...</div></div>
    </div>
  </div>`;
}

async function _docCargarSelector() {
  try {
    const lista = await api.get('/api/presupuestos');
    const wrap  = document.getElementById('doc-sel-lista');
    if (!lista.length) {
      wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">◻</div><div class="empty-title">Sin presupuestos</div></div>`;
      return;
    }
    wrap.innerHTML = `<table>
      <thead><tr><th>#</th><th>Presupuesto</th><th>Ubicación</th><th>Cliente</th><th>Monto Total</th><th>Estado</th><th></th></tr></thead>
      <tbody>${lista.map(p => `<tr>
        <td style="color:var(--text-muted);font-size:12px">${p.id_presupuesto}</td>
        <td><strong style="color:var(--blue)">${sanitize(p.nombre)}</strong></td>
        <td style="font-size:12px;color:var(--text-muted)">${sanitize(p.ubicacion||'—')}</td>
        <td>${sanitize(p.cliente||'—')}</td>
        <td class="td-monto">L ${fmt(p.total_general||0)}</td>
        <td><span class="badge badge-${p.estado||'activo'}">${p.estado||'activo'}</span></td>
        <td><button class="btn btn-sm btn-doc-blue"
          onclick="_docSeleccionar(${p.id_presupuesto},'${sanitize(p.nombre).replace(/'/g,"\\'")}','${sanitize(p.cliente||'').replace(/'/g,"\\'")}')">
          📂 Abrir</button></td>
      </tr>`).join('')}</tbody></table>`;
  } catch(e) {
    document.getElementById('doc-sel-lista').innerHTML = `<div class="empty-state"><div class="empty-icon">✕</div><div>Error: ${e.error||e.message}</div></div>`;
  }
}

async function _docSeleccionar(id, nombre, cliente) {
  _docPresupuesto = { id_presupuesto: id, nombre, cliente };
  _docCatActiva   = 0;
  _docEstado      = '';
  document.getElementById('doc-body').innerHTML = '';
  await _docMostrarModulo();
}

// ── MÓDULO PRINCIPAL ──────────────────────────────────────────
async function _docMostrarModulo() {
  const body = document.getElementById('doc-body');
  const p    = _docPresupuesto;
  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <button class="btn btn-sm btn-doc-ghost" onclick="_docCambiarPresupuesto()">← Presupuestos</button>
      <strong style="color:var(--blue)">${sanitize(p.nombre)}</strong>
      ${p.cliente ? `<span style="color:var(--text-muted);font-size:12px">— ${sanitize(p.cliente)}</span>` : ''}
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
      <div class="stat-card"><div class="stat-value" id="doc-k-total">—</div><div class="stat-label">Total documentos</div></div>
      <div class="stat-card green"><div class="stat-value" id="doc-k-vig">—</div><div class="stat-label">Vigentes</div></div>
      <div class="stat-card orange"><div class="stat-value" id="doc-k-monto">—</div><div class="stat-label">Monto OC acumulado</div></div>
      <div class="stat-card orange"><div class="stat-value" id="doc-k-plazo">—</div><div class="stat-label">Días adicionales OC</div></div>
    </div>

    <div style="display:grid;grid-template-columns:210px 1fr;gap:12px;align-items:start">

      <div class="card" style="padding:6px 0">
        <div style="font-size:10px;font-weight:700;color:var(--gray);padding:6px 12px 3px;text-transform:uppercase;letter-spacing:.5px">Categorías</div>
        <div id="doc-cat-lista">
          <div class="doc-cat-item doc-cat-on" data-cat="0" onclick="_docFiltrarCat(0,'Todos los documentos')">
            <span>📁</span><span style="flex:1">Todos</span>
            <span class="badge badge-blue" id="doc-c-0">0</span>
          </div>
        </div>
        <div style="font-size:10px;font-weight:700;color:var(--gray);padding:12px 12px 3px;text-transform:uppercase;letter-spacing:.5px">Órdenes de Cambio</div>
        <div style="padding:6px 12px;font-size:12px;line-height:1.7" id="doc-oc-res">—</div>
      </div>

      <div>
        <div class="toolbar" style="margin-bottom:8px">
          <span style="font-size:13px;font-weight:600;color:var(--blue);flex:1" id="doc-cat-tit">Todos los documentos</span>
          <input type="text" class="search-box" id="doc-q" placeholder="🔍 Buscar..." oninput="_docRender()" style="width:170px">
          <div style="display:flex;gap:4px">
            ${['','vigente','borrador','obsoleto'].map((e,i) =>
              `<button class="btn btn-sm doc-est-btn${i===0?' doc-est-on':''}" onclick="_docFiltrarEstado('${e}',this)">
                ${i===0?'Todos':e==='vigente'?'✅ Vigente':e==='borrador'?'✏️ Borrador':'📦 Obsoleto'}
              </button>`).join('')}
          </div>
          <button class="btn btn-orange" onclick="_docAbrirModal()">+ Agregar</button>
        </div>
        <div class="card">
          <div class="table-wrap" id="doc-tabla"><div class="loading"><div class="spinner"></div> Cargando...</div></div>
        </div>
      </div>

    </div>`;

  await _docCargarCategorias();
  await _docCargarKPIs();
  await _docCargar();
}

function _docCambiarPresupuesto() { _docPresupuesto = null; renderDocumentacion(); }

async function _docCargarCategorias() {
  try {
    _docCategorias = await api.get('/api/documentacion/categorias');
    const lista = document.getElementById('doc-cat-lista');
    if (!lista) return;
    _docCategorias.forEach(c => {
      const d = document.createElement('div');
      d.className = 'doc-cat-item';
      d.dataset.cat = c.id;
      d.onclick = () => _docFiltrarCat(c.id, c.nombre);
      d.innerHTML = `<span>${c.icono||'📁'}</span><span style="flex:1">${c.nombre}</span><span class="badge badge-blue" id="doc-c-${c.id}">0</span>`;
      lista.appendChild(d);
    });
  } catch(e) {}
}

async function _docCargarKPIs() {
  if (!_docPresupuesto) return;
  try {
    const [res, ocs] = await Promise.all([
      api.get(`/api/documentacion/resumen/${_docPresupuesto.id_presupuesto}`),
      api.get(`/api/documentacion/ocs/${_docPresupuesto.id_presupuesto}`)
    ]);
    const total = res.reduce((s,c) => s+(c.total||0), 0);
    const vig   = res.reduce((s,c) => s+(c.vigentes||0), 0);
    const set = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
    set('doc-k-total', total);
    set('doc-k-vig',   vig);
    set('doc-k-monto', `L ${_docFmt(ocs.totales.impacto_costo)}`);
    set('doc-k-plazo', `${ocs.totales.impacto_plazo}d`);
    res.forEach(c => { const e=document.getElementById(`doc-c-${c.id}`); if(e) e.textContent=c.total||0; });
    const c0=document.getElementById('doc-c-0'); if(c0) c0.textContent=total;
    const ocEl=document.getElementById('doc-oc-res');
    if (ocEl) ocEl.innerHTML = `<b style="color:var(--blue)">${ocs.totales.cantidad}</b> OC<br>
      Costo: <b style="color:var(--red)">L ${_docFmt(ocs.totales.impacto_costo)}</b><br>
      Plazo: <b style="color:var(--orange-dark)">${ocs.totales.impacto_plazo} días</b>`;
  } catch(e) {}
}

async function _docCargar() {
  if (!_docPresupuesto) return;
  try {
    let url = `/api/documentacion/presupuesto/${_docPresupuesto.id_presupuesto}?`;
    if (_docCatActiva > 0) url += `categoria=${_docCatActiva}&`;
    if (_docEstado)        url += `estado=${_docEstado}&`;
    const q = document.getElementById('doc-q')?.value||'';
    if (q) url += `q=${encodeURIComponent(q)}`;
    _docs = await api.get(url);
    _docRender();
  } catch(e) {
    const w=document.getElementById('doc-tabla');
    if(w) w.innerHTML=`<div class="empty-state"><div class="empty-icon">✕</div><div>Error: ${e.error||e.message}</div></div>`;
  }
}

function _docRender() {
  const wrap = document.getElementById('doc-tabla');
  if (!wrap) return;
  const q = (document.getElementById('doc-q')?.value||'').toLowerCase();
  let lista = _docs;
  if (q) lista = lista.filter(d =>
    (d.titulo||'').toLowerCase().includes(q)||(d.numero_doc||'').toLowerCase().includes(q)||(d.descripcion||'').toLowerCase().includes(q));
  if (!lista.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">📂</div><div class="empty-title">Sin documentos</div><div class="empty-desc">Haga clic en "+ Agregar" para registrar el primero</div></div>`;
    return;
  }
  const bE = e => { const m={vigente:'badge-activo',borrador:'badge-orange',obsoleto:'badge-finalizado',anulado:'badge-archivado'};const l={vigente:'Vigente',borrador:'Borrador',obsoleto:'Obsoleto',anulado:'Anulado'}; return `<span class="badge ${m[e]||''}">${l[e]||e}</span>`; };
  wrap.innerHTML = `<table><thead><tr>
    <th>N°</th><th>Cat.</th><th>Título</th><th>Ver.</th><th>Fecha</th><th>Estado</th><th>Archivo</th><th>Monto OC</th><th></th>
  </tr></thead><tbody>${lista.map((d,i) => `<tr>
    <td style="color:var(--text-muted);font-size:11px">${d.numero_doc||(i+1)}</td>
    <td title="${sanitize(d.categoria_nombre||'')}">${d.categoria_icono||'📁'}</td>
    <td><div style="font-weight:600">${sanitize(d.titulo)}</div>
      ${d.descripcion?`<div style="font-size:11px;color:var(--text-muted)">${sanitize(d.descripcion).substring(0,65)}${d.descripcion.length>65?'…':''}</div>`:''}</td>
    <td style="font-size:11px;color:var(--text-muted)">v${d.version||'1.0'}</td>
    <td style="font-size:12px;white-space:nowrap">${_docFecha(d.fecha_documento)}</td>
    <td>${bE(d.estado)}</td>
    <td>${d.archivo_url?`<a href="${d.archivo_url}" target="_blank" style="color:var(--blue);font-size:12px">🔗 Abrir</a>`:''}
        ${d.archivo_tipo?`<span class="badge badge-blue" style="font-size:10px;margin-left:3px">${d.archivo_tipo.toUpperCase()}</span>`:''}</td>
    <td style="font-size:12px;white-space:nowrap">${d.oc_impacto_costo?`<span style="color:var(--red)">L ${_docFmt(d.oc_impacto_costo)}</span>`:'—'}</td>
    <td><div class="btn-group">
      <button class="btn btn-sm btn-doc-ghost" onclick="_docEditar(${d.id})">✏️</button>
      <button class="btn btn-sm btn-doc-ghost" style="color:var(--red)" onclick="_docEliminar(${d.id})">🗑</button>
    </div></td>
  </tr>`).join('')}</tbody></table>`;
}

function _docFiltrarCat(id, nombre) {
  _docCatActiva = id;
  document.querySelectorAll('.doc-cat-item').forEach(e => e.classList.remove('doc-cat-on'));
  const el = document.querySelector(`.doc-cat-item[data-cat="${id}"]`);
  if (el) el.classList.add('doc-cat-on');
  const t = document.getElementById('doc-cat-tit'); if(t) t.textContent = nombre||'Todos los documentos';
  _docCargar();
}

function _docFiltrarEstado(estado, btn) {
  _docEstado = estado;
  document.querySelectorAll('.doc-est-btn').forEach(b => b.classList.remove('doc-est-on'));
  if (btn) btn.classList.add('doc-est-on');
  _docCargar();
}

// ── MODAL ─────────────────────────────────────────────────────
function _docAbrirModal(d = null) {
  _docEditId = d ? d.id : null;
  const opts = _docCategorias.map(c =>
    `<option value="${c.id}" ${d?.categoria_id===c.id?'selected':(!d&&_docCatActiva===c.id?'selected':'')}>${c.icono} ${c.nombre}</option>`
  ).join('');
  showModal(d ? 'Editar Documento' : 'Agregar Documento', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px">
      <div class="field-group"><label>Categoría *</label>
        <select id="df-cat" onchange="_docTogOC()">${opts ? `<option value="">--</option>${opts}` : '<option>Sin categorías</option>'}</select>
      </div>
      <div class="field-group"><label>N° Documento</label>
        <input type="text" id="df-num" value="${sanitize(d?.numero_doc||'')}" placeholder="PL-A01, OC-003, CT-2025">
      </div>
      <div class="field-group" style="grid-column:1/-1"><label>Título *</label>
        <input type="text" id="df-titulo" value="${sanitize(d?.titulo||'')}">
      </div>
      <div class="field-group" style="grid-column:1/-1"><label>Descripción</label>
        <textarea id="df-desc" class="doc-ta">${sanitize(d?.descripcion||'')}</textarea>
      </div>
      <div class="field-group"><label>Versión</label>
        <input type="text" id="df-ver" value="${d?.version||'1.0'}">
      </div>
      <div class="field-group"><label>Estado</label>
        <select id="df-est">
          <option value="vigente" ${(!d||d.estado==='vigente')?'selected':''}>✅ Vigente</option>
          <option value="borrador" ${d?.estado==='borrador'?'selected':''}>✏️ Borrador</option>
          <option value="obsoleto" ${d?.estado==='obsoleto'?'selected':''}>📦 Obsoleto</option>
          <option value="anulado"  ${d?.estado==='anulado' ?'selected':''}>❌ Anulado</option>
        </select>
      </div>
      <div class="field-group"><label>Fecha del Documento</label>
        <input type="date" id="df-fecha" value="${d?.fecha_documento||''}">
      </div>
      <div class="field-group"><label>Fecha de Vencimiento</label>
        <input type="date" id="df-venc" value="${d?.fecha_vencimiento||''}">
      </div>

      <div style="grid-column:1/-1" class="doc-sep">Archivo / Referencia</div>
      <div class="field-group"><label>Nombre del archivo</label>
        <input type="text" id="df-anom" value="${sanitize(d?.archivo_nombre||'')}" placeholder="plano-v2.pdf">
      </div>
      <div class="field-group"><label>Tipo</label>
        <select id="df-atipo">
          <option value="">—</option>
          ${['pdf','dwg','xlsx','docx','jpg','png','otro'].map(t=>`<option value="${t}" ${d?.archivo_tipo===t?'selected':''}>${t.toUpperCase()}</option>`).join('')}
        </select>
      </div>
      <div class="field-group" style="grid-column:1/-1"><label>URL / Enlace (Google Drive, OneDrive, etc.)</label>
        <input type="text" id="df-aurl" value="${sanitize(d?.archivo_url||'')}" placeholder="https://drive.google.com/...">
      </div>

      <div style="grid-column:1/-1" class="doc-sep">Aprobación</div>
      <div class="field-group"><label>Elaborado por</label><input type="text" id="df-elab" value="${sanitize(d?.elaborado_por||'')}"></div>
      <div class="field-group"><label>Revisado por</label><input type="text" id="df-rev" value="${sanitize(d?.revisado_por||'')}"></div>
      <div class="field-group"><label>Aprobado por</label><input type="text" id="df-apro" value="${sanitize(d?.aprobado_por||'')}"></div>
      <div class="field-group"><label>Fecha Aprobación</label><input type="date" id="df-fapro" value="${d?.fecha_aprobacion||''}"></div>

      <div id="df-oc-sec" style="grid-column:1/-1;display:${d?.categoria_id===3?'grid':'none'};grid-template-columns:1fr 1fr;gap:11px">
        <div style="grid-column:1/-1" class="doc-sep" style="color:var(--orange-dark)">🔄 Datos de la Orden de Cambio</div>
        <div class="field-group"><label>N° OC</label><input type="text" id="df-ocnum" value="${sanitize(d?.oc_numero||'')}" placeholder="OC-001"></div>
        <div class="field-group"><label>Moneda</label>
          <select id="df-ocmon"><option value="HNL" ${(!d||d.moneda==='HNL')?'selected':''}>HNL</option><option value="USD" ${d?.moneda==='USD'?'selected':''}>USD</option></select>
        </div>
        <div class="field-group"><label>Impacto en Costo</label><input type="number" id="df-occosto" value="${d?.oc_impacto_costo||''}" step="0.01" placeholder="0.00"></div>
        <div class="field-group"><label>Impacto en Plazo (días)</label><input type="number" id="df-ocplazo" value="${d?.oc_impacto_plazo||''}" placeholder="0"></div>
      </div>

      <div class="field-group" style="grid-column:1/-1"><label>Notas</label>
        <textarea id="df-notas" class="doc-ta">${sanitize(d?.notas||'')}</textarea>
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
      <button class="btn btn-ghost" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-orange" onclick="_docGuardar()">💾 Guardar</button>
    </div>`, 'modal-lg');
}

function _docTogOC() {
  const cat = parseInt(document.getElementById('df-cat')?.value||0);
  const sec = document.getElementById('df-oc-sec');
  if (sec) sec.style.display = cat===3 ? 'grid' : 'none';
}

async function _docEditar(id) {
  try { const d = await api.get(`/api/documentacion/${id}`); _docAbrirModal(d); }
  catch(e) { toast('Error cargando documento','error'); }
}

async function _docGuardar() {
  const v = id => document.getElementById(id)?.value||'';
  const body = {
    id_presupuesto:   _docPresupuesto.id_presupuesto,
    categoria_id:     v('df-cat'),
    numero_doc:       v('df-num'),
    titulo:           v('df-titulo').trim(),
    descripcion:      v('df-desc'),
    version:          v('df-ver')||'1.0',
    estado:           v('df-est'),
    fecha_documento:  v('df-fecha')||null,
    fecha_vencimiento:v('df-venc')||null,
    archivo_nombre:   v('df-anom'),
    archivo_tipo:     v('df-atipo'),
    archivo_url:      v('df-aurl'),
    elaborado_por:    v('df-elab'),
    revisado_por:     v('df-rev'),
    aprobado_por:     v('df-apro'),
    fecha_aprobacion: v('df-fapro')||null,
    oc_numero:        v('df-ocnum')||null,
    moneda:           v('df-ocmon')||'HNL',
    oc_impacto_costo: v('df-occosto')||null,
    oc_impacto_plazo: v('df-ocplazo')||null,
    notas:            v('df-notas'),
  };
  if (!body.titulo || !body.categoria_id) { toast('Título y categoría son requeridos','error'); return; }
  try {
    if (_docEditId) { await api.put(`/api/documentacion/${_docEditId}`, body); toast('Documento actualizado','success'); }
    else            { await api.post('/api/documentacion', body);              toast('Documento agregado','success'); }
    hideModal();
    await _docCargarKPIs();
    await _docCargar();
  } catch(e) { toast(e.error||'Error guardando','error'); }
}

async function _docEliminar(id) {
  if (!confirm('¿Eliminar este documento?')) return;
  try {
    await api.del(`/api/documentacion/${id}`);
    toast('Documento eliminado','info');
    await _docCargarKPIs();
    await _docCargar();
  } catch(e) { toast(e.error||'Error eliminando','error'); }
}

function _docFmt(n)  { return (n||0).toLocaleString('es-HN',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function _docFecha(f){ if(!f) return '—'; const [y,m,d]=f.split('-'); return `${d}/${m}/${y}`; }
