// ═══════════════════════════════════════════════════════════════
// ACTIVIDADES — Búsqueda rápida server-side + virtual scroll
// ═══════════════════════════════════════════════════════════════
let _actTotal = 0;
let _actOffset = 0;
const _ACT_LIMIT = 50;
let _actSearchTimer = null;
let _actActual = null;
let _actInsumos = [];
let _actRows = [];

async function renderActividades() {
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">ACTIVIDADES — COSTOS UNITARIOS</div>
        <div class="page-subtitle">Catálogo de actividades 2016 — 2,804 ítems con precios CHICO Dic.2025</div>
      </div>
      <button class="btn btn-orange" onclick="modalNuevaActividad()">+ Nueva Actividad</button>
    </div>
    <div class="page-body">
      <div style="display:grid; grid-template-columns: 340px 1fr; gap:20px; align-items:start">
        
        <!-- PANEL IZQUIERDO — Búsqueda + Lista -->
        <div class="card" style="position:sticky; top:16px">
          <div style="padding:12px 12px 8px">
            
            <!-- Caja de búsqueda mejorada -->
            <div style="position:relative; margin-bottom:8px">
              <span style="position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--text-muted); font-size:14px; pointer-events:none">🔍</span>
              <input type="text" id="searchAct"
                placeholder="Código ej: F002, F005... o descripción"
                oninput="onActSearch()"
                onkeydown="onActSearchKey(event)"
                style="padding-left:34px; width:100%; font-size:13px"
                autocomplete="off">
              <button id="btnClearSearch" onclick="clearActSearch()"
                style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:var(--text-muted); font-size:16px; display:none">✕</button>
            </div>

            <!-- Filtros rápidos por familia de actividad -->
            <div id="actFiltrosRapidos" style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px">
              <button class="btn-chip active" onclick="setFiltroRapido('', this)">Todos</button>
              <button class="btn-chip" onclick="setFiltroRapido('F001', this)">F001 Topo</button>
              <button class="btn-chip" onclick="setFiltroRapido('F002', this)">F002 Cim.</button>
              <button class="btn-chip" onclick="setFiltroRapido('F003', this)">F003 Estr.</button>
              <button class="btn-chip" onclick="setFiltroRapido('F004', this)">F004 Mamp.</button>
              <button class="btn-chip" onclick="setFiltroRapido('F005', this)">F005 Font.</button>
              <button class="btn-chip" onclick="setFiltroRapido('F006', this)">F006 Alc.</button>
              <button class="btn-chip" onclick="setFiltroRapido('F007', this)">F007 Pav.</button>
              <button class="btn-chip" onclick="setFiltroRapido('AP-', this)">AP Agua</button>
              <button class="btn-chip" onclick="setFiltroRapido('AN-', this)">AN Negras</button>
              <button class="btn-chip" onclick="setFiltroRapido('M-', this)">M-Módulos</button>
            </div>

            <!-- Contador de resultados -->
            <div id="actCounter" style="font-size:11px; color:var(--text-muted); padding:0 2px 6px">
              Cargando...
            </div>
          </div>

          <!-- Lista virtual con scroll -->
          <div id="actListado" style="max-height:62vh; overflow-y:auto; border-top:1px solid var(--gray-light)">
            <div class="loading"><div class="spinner"></div></div>
          </div>

          <!-- Paginación -->
          <div id="actPager" style="padding:8px 12px; border-top:1px solid var(--gray-light); display:none; align-items:center; justify-content:space-between; gap:8px">
            <button id="btnActPrev" class="btn btn-secondary btn-sm" onclick="actPaginar(-1)">← Prev</button>
            <span id="actPagerInfo" style="font-size:11px; color:var(--text-muted)"></span>
            <button id="btnActNext" class="btn btn-secondary btn-sm" onclick="actPaginar(1)">Sig →</button>
          </div>
        </div>

        <!-- PANEL DERECHO — Detalle -->
        <div id="actDetalle">
          <div class="empty-state" style="background:var(--white); border-radius:4px; border:1px solid var(--gray-mid); padding:60px">
            <div class="empty-icon" style="font-size:48px">🔍</div>
            <div class="empty-title">Busca una actividad</div>
            <div class="empty-desc">Escribe el código (F001, F002...) o parte de la descripción.<br>
              <strong>Ejemplo:</strong> "excavacion", "zapata", "tuberia PVC"</div>
          </div>
        </div>
      </div>
    </div>`;

  await buscarActividades();
}

// ─── Búsqueda con debounce ───────────────────────────────
function onActSearch() {
  const inp = document.getElementById('searchAct');
  const btn = document.getElementById('btnClearSearch');
  if (btn) btn.style.display = inp.value ? 'block' : 'none';
  clearTimeout(_actSearchTimer);
  _actSearchTimer = setTimeout(() => {
    _actOffset = 0;
    buscarActividades();
  }, 280);
}

function onActSearchKey(e) {
  if (e.key === 'Escape') clearActSearch();
  if (e.key === 'Enter') { clearTimeout(_actSearchTimer); _actOffset = 0; buscarActividades(); }
}

function clearActSearch() {
  const inp = document.getElementById('searchAct');
  if (inp) inp.value = '';
  document.getElementById('btnClearSearch').style.display = 'none';
  // Reset chips
  document.querySelectorAll('.btn-chip').forEach((c,i) => c.classList.toggle('active', i===0));
  _actOffset = 0;
  buscarActividades();
}

function setFiltroRapido(prefix, btn) {
  // Update chips
  document.querySelectorAll('#actFiltrosRapidos .btn-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  const inp = document.getElementById('searchAct');
  if (inp) {
    inp.value = prefix;
    document.getElementById('btnClearSearch').style.display = prefix ? 'block' : 'none';
  }
  _actOffset = 0;
  buscarActividades();
}

async function buscarActividades() {
  const q = (document.getElementById('searchAct')?.value || '').trim();
  const listado = document.getElementById('actListado');
  const counter = document.getElementById('actCounter');
  if (listado) listado.innerHTML = `<div style="padding:20px; text-align:center"><div class="spinner" style="margin:0 auto"></div></div>`;

  try {
    const url = `/api/actividades?q=${encodeURIComponent(q)}&limit=${_ACT_LIMIT}&offset=${_actOffset}`;
    const data = await api.get(url);

    // Compatibilidad con respuesta nueva y posible array legacy
    const res = Array.isArray(data) ? { rows: data, total: data.length, hasMore: false } : data;
    _actRows = res.rows || [];
    _actTotal = res.total || _actRows.length;

    // Counter
    if (counter) {
      if (q) {
        counter.innerHTML = `<span style="color:var(--orange); font-weight:600">${_actTotal.toLocaleString()}</span> resultados para "<strong>${sanitize(q)}</strong>"`;
      } else {
        counter.textContent = `${_actTotal.toLocaleString()} actividades en total`;
      }
    }

    renderActListado(_actRows);
    renderActPager(_actTotal, res.hasMore);

  } catch (e) {
    if (listado) listado.innerHTML = `<div style="padding:20px; text-align:center; color:var(--red)">Error al cargar</div>`;
  }
}

function renderActListado(lista) {
  const el = document.getElementById('actListado');
  if (!el) return;
  if (!lista.length) {
    el.innerHTML = `<div style="padding:30px; text-align:center; color:var(--text-muted)">
      <div style="font-size:32px; margin-bottom:8px">◌</div>
      <div style="font-weight:600; margin-bottom:4px">Sin resultados</div>
      <div style="font-size:12px">Intenta con otro término o código</div>
    </div>`;
    return;
  }
  el.innerHTML = lista.map(a => `
    <div class="act-item" onclick="seleccionarActividad(${a.id_actividad})"
         id="actItem-${a.id_actividad}"
         style="padding:10px 14px; cursor:pointer; border-bottom:1px solid var(--gray-light); transition:background 0.1s">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px">
        <div style="min-width:0">
          <div class="td-code" style="font-size:11px; margin-bottom:2px">${sanitize(a.codigo)}</div>
          <div style="font-size:12px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis"
               title="${sanitize(a.descripcion)}">${sanitize(a.descripcion)}</div>
          <div style="font-size:10px; color:var(--text-muted); margin-top:1px">${a.unidad}</div>
        </div>
        <div style="text-align:right; flex-shrink:0">
          <div style="font-family:'Barlow Condensed',sans-serif; font-size:14px; font-weight:700;
               color:${a.costo_total > 0 ? 'var(--green)' : 'var(--text-muted)'}">
            ${a.costo_total > 0 ? 'L ' + fmt(a.costo_total) : '—'}
          </div>
        </div>
      </div>
    </div>`).join('');
}

function renderActPager(total, hasMore) {
  const pager = document.getElementById('actPager');
  const info  = document.getElementById('actPagerInfo');
  const prev  = document.getElementById('btnActPrev');
  const next  = document.getElementById('btnActNext');
  if (!pager) return;
  if (total <= _ACT_LIMIT) { pager.style.display = 'none'; return; }
  pager.style.display = 'flex';
  const from = _actOffset + 1;
  const to   = Math.min(_actOffset + _ACT_LIMIT, total);
  if (info) info.textContent = `${from}–${to} de ${total.toLocaleString()}`;
  if (prev) prev.disabled = _actOffset === 0;
  if (next) next.disabled = !hasMore;
}

function actPaginar(dir) {
  _actOffset = Math.max(0, _actOffset + dir * _ACT_LIMIT);
  buscarActividades();
  document.getElementById('actListado')?.scrollTo(0, 0);
}

// ─── Seleccionar actividad ───────────────────────────────
async function seleccionarActividad(id) {
  document.querySelectorAll('.act-item').forEach(el => el.style.background = '');
  const item = document.getElementById(`actItem-${id}`);
  if (item) item.style.background = 'rgba(2,81,150,0.09)';

  const det = document.getElementById('actDetalle');
  det.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

  try {
    const { actividad, detalles } = await api.get(`/api/actividades/${id}`);
    _actActual = actividad;
    _actInsumos = detalles;
    renderActDetalle(actividad, detalles);
  } catch (e) { det.innerHTML = `<div class="empty-state">Error al cargar</div>`; }
}

function renderActDetalle(act, detalles) {
  const det = document.getElementById('actDetalle');
  const groups = {};
  detalles.forEach(d => {
    if (!groups[d.categoria]) groups[d.categoria] = [];
    groups[d.categoria].push(d);
  });
  const subtotales = {};
  Object.entries(groups).forEach(([cat, items]) => {
    subtotales[cat] = items.reduce((s, d) => s + d.costo_parcial, 0);
  });

  det.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="breadcrumb">Actividades → <span>${sanitize(act.codigo)}</span></div>
          <div class="card-title">${sanitize(act.descripcion)}</div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:4px">Unidad: <strong>${act.unidad}</strong></div>
        </div>
        <div style="text-align:right; display:flex; align-items:center; gap:12px">
          <div>
            <div style="font-size:11px; color:var(--text-muted)">COSTO UNITARIO</div>
            <div class="precio-big">L ${fmt(act.costo_total)}</div>
          </div>
          <div class="btn-group">
            <button class="btn btn-secondary btn-sm" onclick="modalNuevoInsumoAct(${act.id_actividad})">+ Insumo</button>
            <button class="btn btn-secondary btn-sm btn-icon" onclick="modalEditarActividad(${act.id_actividad})" title="Editar">✎</button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="eliminarActividad(${act.id_actividad})" title="Eliminar">✕</button>
          </div>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Categoría</th><th>Descripción del Insumo</th><th>Unidad</th>
            <th>Cantidad</th><th>Rendimiento</th><th>Desperdicio</th>
            <th>P. Unitario</th><th>Costo Parcial</th><th></th>
          </tr></thead>
          <tbody>
            ${Object.entries(groups).map(([cat, items]) => `
              <tr style="background:var(--gray-light)">
                <td colspan="7"><span class="cat-tag ${catClass(cat)}">${cat}</span></td>
                <td class="td-monto" style="color:var(--blue)">L ${fmt(subtotales[cat])}</td>
                <td></td>
              </tr>
              ${items.map(d => `
                <tr>
                  <td></td>
                  <td>${sanitize(d.descripcion)}</td>
                  <td><span class="badge badge-blue" style="font-size:11px">${d.unidad}</span></td>
                  <td style="text-align:right">${fmt(d.cantidad, 4)}</td>
                  <td style="text-align:right">${fmt(d.rendimiento, 4)}</td>
                  <td style="text-align:right">${fmt(d.desperdicio, 2)}%</td>
                  <td class="td-monto">L ${fmt(d.precio_unitario)}</td>
                  <td class="td-monto" style="color:var(--green)">L ${fmt(d.costo_parcial)}</td>
                  <td>
                    <button class="btn btn-danger btn-sm btn-icon"
                      onclick="eliminarInsumoAct(${act.id_actividad}, ${d.id_detalle})" title="Quitar">✕</button>
                  </td>
                </tr>`).join('')}
            `).join('') || `
              <tr><td colspan="9"><div class="empty-state" style="padding:30px">
                <div class="empty-icon" style="font-size:32px">◇</div>
                <div class="empty-title">Sin insumos asignados</div>
                <button class="btn btn-orange" style="margin-top:12px"
                  onclick="modalNuevoInsumoAct(${act.id_actividad})">+ Agregar Insumo</button>
              </div></td></tr>`}
            <tr class="pres-total-row">
              <td colspan="7" style="text-align:right">COSTO TOTAL UNITARIO (${act.unidad})</td>
              <td class="td-monto" style="font-size:16px; color:var(--blue)">L ${fmt(act.costo_total)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>`;
}

// ─── Modales CRUD ─────────────────────────────────────────
function modalNuevaActividad() {
  showModal('NUEVA ACTIVIDAD', `
    <div class="form-grid form-grid-2">
      <div class="form-group">
        <label class="form-label">Código *</label>
        <input type="text" id="aCodigo" placeholder="AP-001 / APA-001 / M-001">
      </div>
      <div class="form-group">
        <label class="form-label">Unidad *</label>
        <input type="text" id="aUnidad" placeholder="m³ / m² / ML / Global">
      </div>
      <div class="form-group" style="grid-column:span 2">
        <label class="form-label">Descripción *</label>
        <input type="text" id="aDesc" placeholder="Ej: Tubería PVC 4'' SDR-26 instalada">
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-orange" onclick="guardarActividad()">Guardar</button>
    </div>`);
}

async function guardarActividad() {
  const codigo = document.getElementById('aCodigo').value.trim();
  const desc   = document.getElementById('aDesc').value.trim();
  if (!codigo || !desc) { toast('Código y descripción son obligatorios', 'error'); return; }
  try {
    await api.post('/api/actividades', {
      codigo, descripcion: desc,
      unidad: document.getElementById('aUnidad').value.trim()
    });
    hideModal(); toast('Actividad creada');
    _actOffset = 0; await buscarActividades();
  } catch (e) { toast(e.error || 'Error', 'error'); }
}

function modalEditarActividad(id) {
  const a = _actActual;
  showModal('EDITAR ACTIVIDAD', `
    <div class="form-grid form-grid-2">
      <div class="form-group">
        <label class="form-label">Código *</label>
        <input type="text" id="aCodigo" value="${sanitize(a.codigo)}">
      </div>
      <div class="form-group">
        <label class="form-label">Unidad *</label>
        <input type="text" id="aUnidad" value="${sanitize(a.unidad)}">
      </div>
      <div class="form-group" style="grid-column:span 2">
        <label class="form-label">Descripción *</label>
        <input type="text" id="aDesc" value="${sanitize(a.descripcion)}">
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="actualizarActividad(${id})">Actualizar</button>
    </div>`);
}

async function actualizarActividad(id) {
  try {
    await api.put(`/api/actividades/${id}`, {
      codigo:      document.getElementById('aCodigo').value.trim(),
      descripcion: document.getElementById('aDesc').value.trim(),
      unidad:      document.getElementById('aUnidad').value.trim()
    });
    hideModal(); toast('Actividad actualizada');
    await buscarActividades(); seleccionarActividad(id);
  } catch (e) { toast(e.error || 'Error', 'error'); }
}

async function eliminarActividad(id) {
  if (!confirm('¿Eliminar actividad y todos sus insumos asignados?')) return;
  try {
    await api.del(`/api/actividades/${id}`);
    toast('Actividad eliminada');
    document.getElementById('actDetalle').innerHTML = `
      <div class="empty-state" style="background:var(--white); border-radius:4px; border:1px solid var(--gray-mid); padding:60px">
        <div class="empty-icon">◎</div><div class="empty-title">Seleccionar actividad</div>
      </div>`;
    await buscarActividades();
  } catch (e) { toast(e.error || 'Error', 'error'); }
}

async function modalNuevoInsumoAct(idActividad) {
  let ins = await api.get('/api/insumos?limit=2000');
  const lista = Array.isArray(ins) ? ins : (ins.rows || []);
  showModal('AGREGAR INSUMO A ACTIVIDAD', `
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Buscar insumo *</label>
        <input type="text" id="aiSearch" placeholder="Escribe nombre del insumo..."
          oninput="filtrarInsumosModal()" style="margin-bottom:6px">
        <select id="aiInsumo" size="6" style="width:100%; font-size:12px">
          ${lista.map(i => `<option value="${i.id_insumo}">[${i.categoria||''}] ${i.descripcion} — L ${fmt(i.precio_unitario)}/${i.unidad}</option>`).join('')}
        </select>
      </div>
      <div class="form-grid form-grid-3">
        <div class="form-group">
          <label class="form-label">Cantidad</label>
          <input type="number" id="aiCantidad" value="1" step="0.0001" min="0.0001">
        </div>
        <div class="form-group">
          <label class="form-label">Rendimiento</label>
          <input type="number" id="aiRendimiento" value="1" step="0.0001" min="0.0001">
        </div>
        <div class="form-group">
          <label class="form-label">Desperdicio (%)</label>
          <input type="number" id="aiDesperdicio" value="0" step="0.5" min="0">
        </div>
      </div>
      <div style="background:var(--gray-light); padding:10px; border-radius:4px; font-size:12px; color:var(--text-muted)">
        💡 Costo parcial = (Cantidad ÷ Rendimiento) × (1 + Desperdicio%) × Precio unitario
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-orange" onclick="guardarInsumoAct(${idActividad})">Agregar</button>
    </div>`);
  window._insumosModal = lista;
}

function filtrarInsumosModal() {
  const q = (document.getElementById('aiSearch')?.value || '').toLowerCase();
  const sel = document.getElementById('aiInsumo');
  if (!sel || !window._insumosModal) return;
  const filtered = window._insumosModal.filter(i =>
    i.descripcion.toLowerCase().includes(q) || (i.codigo||'').toLowerCase().includes(q));
  sel.innerHTML = filtered.map(i =>
    `<option value="${i.id_insumo}">[${i.categoria||''}] ${i.descripcion} — L ${fmt(i.precio_unitario)}/${i.unidad}</option>`
  ).join('');
}

async function guardarInsumoAct(idActividad) {
  const id_insumo = document.getElementById('aiInsumo').value;
  if (!id_insumo) { toast('Selecciona un insumo', 'error'); return; }
  try {
    await api.post(`/api/actividades/${idActividad}/insumos`, {
      id_insumo,
      cantidad:     parseFloat(document.getElementById('aiCantidad').value) || 1,
      rendimiento:  parseFloat(document.getElementById('aiRendimiento').value) || 1,
      desperdicio:  parseFloat(document.getElementById('aiDesperdicio').value) || 0
    });
    hideModal(); toast('Insumo agregado');
    await buscarActividades(); seleccionarActividad(idActividad);
  } catch (e) { toast(e.error || 'Error', 'error'); }
}

async function eliminarInsumoAct(idActividad, idDetalle) {
  try {
    await api.del(`/api/actividades/${idActividad}/insumos/${idDetalle}`);
    toast('Insumo removido');
    await buscarActividades(); seleccionarActividad(idActividad);
  } catch (e) { toast(e.error || 'Error', 'error'); }
}
