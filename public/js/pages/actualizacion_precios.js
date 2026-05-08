// ═══════════════════════════════════════════════════════════════
// ACTUALIZACIÓN MASIVA DE PRECIOS
// ═══════════════════════════════════════════════════════════════
let _apInsumos   = [];        // catálogo completo
let _apCambios   = {};        // { id_insumo: precio_nuevo } — precios editados
let _apFiltro    = '';
let _apCategoria = '';
let _apSoloEdit  = false;

async function renderActualizacionPrecios() {
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">ACTUALIZACIÓN DE PRECIOS</div>
        <div class="page-subtitle">Actualización masiva — materiales, mano de obra y equipo</div>
      </div>
      <div class="btn-group">
        <button class="btn btn-secondary" onclick="apVerHistorial()">📋 Historial</button>
        <button class="btn btn-secondary" id="btnApSoloEdit" onclick="apToggleSoloEdit()">Ver editados</button>
        <button class="btn btn-orange" id="btnApAplicar" onclick="apModalConfirmar()" style="display:none">
          ✔ Aplicar (<span id="apConteo">0</span>)
        </button>
      </div>
    </div>
    <div class="page-body">

      <!-- Herramientas superiores -->
      <div class="card" style="margin-bottom:14px">
        <div class="card-body" style="padding:14px 20px">
          <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">

            <!-- Búsqueda -->
            <div style="flex:2;min-width:200px">
              <label class="form-label">Buscar</label>
              <input type="text" class="form-control" id="apSearch"
                     placeholder="Código o descripción..." oninput="apFiltrar()">
            </div>

            <!-- Categoría -->
            <div style="flex:1;min-width:160px">
              <label class="form-label">Categoría</label>
              <select class="form-control" id="apCatSelect" onchange="apFiltrar()">
                <option value="">Todas</option>
              </select>
            </div>

            <!-- Ajuste por porcentaje -->
            <div style="flex:1;min-width:160px">
              <label class="form-label">Ajuste global (%)</label>
              <div style="display:flex;gap:6px">
                <input type="number" class="form-control" id="apPct" placeholder="Ej: 5"
                       style="width:90px" step="0.1">
                <button class="btn btn-secondary" onclick="apAplicarPct()" title="Aplica el % a los filtrados">Aplicar</button>
              </div>
            </div>

            <!-- Limpiar cambios -->
            <div style="align-self:flex-end">
              <button class="btn btn-danger btn-sm" onclick="apLimpiarCambios()"
                      title="Descarta todos los precios editados">🗑 Limpiar</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabla de insumos -->
      <div class="card">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
          <span class="card-title" id="apTituloTabla">Cargando...</span>
          <span id="apResumenCambios" style="font-size:12px;color:#666"></span>
        </div>
        <div class="table-wrap" id="apTablaWrap">
          <div class="loading"><div class="spinner"></div> Cargando insumos...</div>
        </div>
      </div>

    </div>

    <!-- Modal confirmar -->
    <div id="modalApConfirmar" class="modal-overlay" style="display:none">
      <div class="modal" style="max-width:560px">
        <div class="modal-header">
          <div class="modal-title">Confirmar actualización de precios</div>
          <button class="modal-close" onclick="apCerrarModal()">✕</button>
        </div>
        <div class="modal-body">
          <div id="apPreviewContent">
            <div class="loading"><div class="spinner"></div> Calculando impacto...</div>
          </div>
          <div style="margin-top:16px">
            <label class="form-label">Nombre de la sesión *</label>
            <input type="text" class="form-control" id="apNombreSesion"
                   placeholder="Ej: Precios mayo 2026 — SINCO">
            <label class="form-label" style="margin-top:10px">Nota (opcional)</label>
            <textarea class="form-control" id="apNotaSesion" rows="2"
                      placeholder="Fuente de precios, observaciones..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="apCerrarModal()">Cancelar</button>
          <button class="btn btn-orange" id="btnApConfirmar" onclick="apEjecutar()">
            ✔ Confirmar y aplicar
          </button>
        </div>
      </div>
    </div>

    <!-- Modal historial -->
    <div id="modalApHistorial" class="modal-overlay" style="display:none">
      <div class="modal" style="max-width:700px">
        <div class="modal-header">
          <div class="modal-title">Historial de actualizaciones</div>
          <button class="modal-close" onclick="document.getElementById('modalApHistorial').style.display='none'">✕</button>
        </div>
        <div class="modal-body" id="apHistorialBody">
          <div class="loading"><div class="spinner"></div> Cargando...</div>
        </div>
      </div>
    </div>

    <!-- Modal detalle sesión -->
    <div id="modalApDetalle" class="modal-overlay" style="display:none">
      <div class="modal" style="max-width:760px">
        <div class="modal-header">
          <div class="modal-title" id="apDetalleTitulo">Detalle de sesión</div>
          <button class="modal-close" onclick="document.getElementById('modalApDetalle').style.display='none'">✕</button>
        </div>
        <div class="modal-body" id="apDetalleBody">
          <div class="loading"><div class="spinner"></div> Cargando...</div>
        </div>
      </div>
    </div>`;

  await apCargar();
}

// ─── CARGA INICIAL ────────────────────────────────────────────
async function apCargar() {
  try {
    _apInsumos = await api.get('/api/actualizacion-precios/insumos');
    _apCambios = {};

    // Poblar selector categorías
    const cats = [...new Map(_apInsumos.map(i => [i.id_categoria, i.categoria])).entries()];
    const sel = document.getElementById('apCatSelect');
    cats.forEach(([id, nombre]) => {
      sel.innerHTML += `<option value="${id}">${nombre}</option>`;
    });

    apRenderTabla();
  } catch(e) {
    document.getElementById('apTablaWrap').innerHTML =
      `<div class="empty-state"><div>Error al cargar: ${e.error || e}</div></div>`;
  }
}

// ─── FILTRADO ─────────────────────────────────────────────────
function apFiltrar() {
  _apFiltro    = (document.getElementById('apSearch')?.value || '').toLowerCase();
  _apCategoria = document.getElementById('apCatSelect')?.value || '';
  apRenderTabla();
}

function apToggleSoloEdit() {
  _apSoloEdit = !_apSoloEdit;
  const btn = document.getElementById('btnApSoloEdit');
  btn.textContent = _apSoloEdit ? '📋 Ver todos' : 'Ver editados';
  btn.classList.toggle('btn-orange', _apSoloEdit);
  btn.classList.toggle('btn-secondary', !_apSoloEdit);
  apRenderTabla();
}

// ─── RENDERIZADO DE TABLA ─────────────────────────────────────
function apRenderTabla() {
  let lista = _apInsumos;

  if (_apFiltro)
    lista = lista.filter(i =>
      i.descripcion.toLowerCase().includes(_apFiltro) ||
      (i.codigo || '').toLowerCase().includes(_apFiltro));

  if (_apCategoria)
    lista = lista.filter(i => String(i.id_categoria) === _apCategoria);

  if (_apSoloEdit)
    lista = lista.filter(i => _apCambios[i.id_insumo] !== undefined);

  const nCambios  = Object.keys(_apCambios).length;
  const nFiltrado = lista.length;

  document.getElementById('apTituloTabla').textContent =
    `${nFiltrado} insumos${_apFiltro || _apCategoria ? ' (filtrados)' : ''}`;

  document.getElementById('apResumenCambios').textContent =
    nCambios > 0 ? `${nCambios} precio(s) modificado(s)` : '';

  const btnAplicar = document.getElementById('btnApAplicar');
  btnAplicar.style.display = nCambios > 0 ? '' : 'none';
  document.getElementById('apConteo').textContent = nCambios;

  if (!lista.length) {
    document.getElementById('apTablaWrap').innerHTML =
      `<div class="empty-state"><div>Sin insumos para mostrar</div></div>`;
    return;
  }

  // Agrupar por categoría
  const grupos = {};
  lista.forEach(i => {
    if (!grupos[i.categoria]) grupos[i.categoria] = [];
    grupos[i.categoria].push(i);
  });

  let html = `<table>
    <thead><tr>
      <th style="width:90px">Código</th>
      <th>Descripción</th>
      <th style="width:60px;text-align:center">Unidad</th>
      <th style="width:120px;text-align:right">Precio actual</th>
      <th style="width:150px;text-align:right">Nuevo precio</th>
      <th style="width:80px;text-align:center">Variación</th>
      <th style="width:60px;text-align:center">Usos</th>
    </tr></thead><tbody>`;

  Object.entries(grupos).forEach(([cat, items]) => {
    html += `<tr style="background:#f0f4f8">
      <td colspan="7" style="font-weight:700;color:var(--blue);font-size:12px;padding:6px 14px;
          text-transform:uppercase;letter-spacing:.5px">${cat}</td>
    </tr>`;

    items.forEach(i => {
      const editado   = _apCambios[i.id_insumo] !== undefined;
      const precioNvo = editado ? _apCambios[i.id_insumo] : '';
      const pct       = editado && i.precio_unitario > 0
        ? ((precioNvo - i.precio_unitario) / i.precio_unitario * 100).toFixed(1)
        : '';
      const pctColor  = pct === '' ? '' : (parseFloat(pct) > 0 ? 'color:var(--red)' : parseFloat(pct) < 0 ? 'color:var(--green)' : '');
      const rowBg     = editado ? 'background:#fffde7' : '';

      html += `<tr style="${rowBg}" id="apRow_${i.id_insumo}">
        <td style="font-family:monospace;font-size:12px">${i.codigo || '—'}</td>
        <td>${i.descripcion}</td>
        <td style="text-align:center;font-size:12px">${i.unidad}</td>
        <td style="text-align:right;font-family:monospace">
          ${i.precio_unitario ? 'L ' + i.precio_unitario.toLocaleString('es-HN', {minimumFractionDigits:2}) : '<span style="color:#aaa">—</span>'}
        </td>
        <td style="text-align:right">
          <input type="number" min="0" step="0.01"
                 class="form-control" style="width:130px;text-align:right;margin-left:auto;
                   ${editado ? 'border-color:var(--orange);background:#fff9e6' : ''}"
                 value="${precioNvo}"
                 placeholder="${i.precio_unitario ? i.precio_unitario.toFixed(2) : '0.00'}"
                 oninput="apRegistrarCambio(${i.id_insumo}, ${i.precio_unitario}, this.value)"
                 id="apInput_${i.id_insumo}">
        </td>
        <td style="text-align:center;font-size:12px;font-weight:600;${pctColor}" id="apPct_${i.id_insumo}">
          ${pct !== '' ? (parseFloat(pct) > 0 ? '+' : '') + pct + '%' : ''}
        </td>
        <td style="text-align:center">
          <span style="font-size:11px;background:#e8f0fe;color:var(--blue);
              border-radius:10px;padding:2px 7px">${i.num_actividades}</span>
        </td>
      </tr>`;
    });
  });

  html += `</tbody></table>`;
  document.getElementById('apTablaWrap').innerHTML = html;
}

// ─── REGISTRO DE CAMBIO INDIVIDUAL ───────────────────────────
function apRegistrarCambio(id_insumo, precioAnt, valor) {
  const v = parseFloat(valor);
  const input = document.getElementById(`apInput_${id_insumo}`);
  const pctEl = document.getElementById(`apPct_${id_insumo}`);
  const row   = document.getElementById(`apRow_${id_insumo}`);

  if (valor === '' || isNaN(v)) {
    delete _apCambios[id_insumo];
    if (input) { input.style.borderColor = ''; input.style.background = ''; }
    if (row)   row.style.background = '';
    if (pctEl) pctEl.textContent = '';
  } else {
    _apCambios[id_insumo] = v;
    if (input) { input.style.borderColor = 'var(--orange)'; input.style.background = '#fff9e6'; }
    if (row)   row.style.background = '#fffde7';
    if (pctEl && precioAnt > 0) {
      const pct = ((v - precioAnt) / precioAnt * 100).toFixed(1);
      pctEl.textContent  = (parseFloat(pct) > 0 ? '+' : '') + pct + '%';
      pctEl.style.color  = parseFloat(pct) > 0 ? 'var(--red)' : parseFloat(pct) < 0 ? 'var(--green)' : '';
    }
  }

  // Actualizar contador y visibilidad del botón
  const n = Object.keys(_apCambios).length;
  document.getElementById('apConteo').textContent = n;
  document.getElementById('btnApAplicar').style.display = n > 0 ? '' : 'none';
  document.getElementById('apResumenCambios').textContent =
    n > 0 ? `${n} precio(s) modificado(s)` : '';
}

// ─── AJUSTE GLOBAL POR PORCENTAJE ────────────────────────────
function apAplicarPct() {
  const pct = parseFloat(document.getElementById('apPct').value);
  if (isNaN(pct) || pct === 0) {
    alert('Ingrese un porcentaje válido (puede ser negativo para reducir).');
    return;
  }

  // Aplicar sólo a los insumos actualmente visibles en la tabla
  let lista = _apInsumos;
  if (_apFiltro)    lista = lista.filter(i => i.descripcion.toLowerCase().includes(_apFiltro) || (i.codigo||'').toLowerCase().includes(_apFiltro));
  if (_apCategoria) lista = lista.filter(i => String(i.id_categoria) === _apCategoria);

  lista.forEach(i => {
    if (!i.precio_unitario) return;
    const nuevo = parseFloat((i.precio_unitario * (1 + pct / 100)).toFixed(2));
    _apCambios[i.id_insumo] = nuevo;
  });

  apRenderTabla();
}

// ─── LIMPIAR CAMBIOS ─────────────────────────────────────────
function apLimpiarCambios() {
  if (!Object.keys(_apCambios).length) return;
  if (!confirm('¿Descartar todos los precios editados?')) return;
  _apCambios = {};
  _apSoloEdit = false;
  document.getElementById('btnApSoloEdit').textContent = 'Ver editados';
  document.getElementById('btnApSoloEdit').className = 'btn btn-secondary';
  apRenderTabla();
}

// ─── MODAL CONFIRMAR ──────────────────────────────────────────
async function apModalConfirmar() {
  const modal = document.getElementById('modalApConfirmar');
  modal.style.display = 'flex';

  // Sugerir nombre
  const hoy = new Date().toLocaleDateString('es-HN', { month:'long', year:'numeric' });
  document.getElementById('apNombreSesion').value = `Actualización ${hoy}`;

  // Preview
  const cambiosArr = Object.entries(_apCambios).map(([id, precio]) => ({
    id_insumo: parseInt(id), precio_nuevo: precio
  }));

  try {
    const r = await api.post('/api/actualizacion-precios/preview', { cambios: cambiosArr });
    renderPreview(r.preview);
  } catch(e) {
    document.getElementById('apPreviewContent').innerHTML =
      `<div style="color:var(--red)">Error al calcular impacto: ${e.error || e}</div>`;
  }
}

function renderPreview(preview) {
  const sube   = preview.filter(p => p.variacion_pct > 0);
  const baja   = preview.filter(p => p.variacion_pct < 0);
  const igual  = preview.filter(p => p.variacion_pct === 0 || p.variacion_pct === null);
  const maxAct = Math.max(...preview.map(p => p.num_actividades), 0);

  let html = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
      <div class="stat-card" style="padding:10px 14px">
        <div class="stat-label">Insumos a actualizar</div>
        <div class="stat-value" style="font-size:20px">${preview.length}</div>
      </div>
      <div class="stat-card orange" style="padding:10px 14px">
        <div class="stat-label">Actividades afectadas</div>
        <div class="stat-value" style="font-size:20px">${[...new Set(preview.flatMap(p=>Array(p.num_actividades).fill(0)))].length > 0 ? preview.reduce((s,p)=>s+p.num_actividades,0) : '—'}</div>
      </div>
      <div class="stat-card" style="padding:10px 14px">
        <div class="stat-label">Suben / bajan / iguales</div>
        <div class="stat-value" style="font-size:16px">
          <span style="color:var(--red)">${sube.length}↑</span> /
          <span style="color:var(--green)">${baja.length}↓</span> /
          ${igual.length}=
        </div>
      </div>
    </div>
    <div class="table-wrap" style="max-height:260px;overflow-y:auto">
    <table>
      <thead><tr>
        <th>Insumo</th>
        <th style="text-align:right">Anterior</th>
        <th style="text-align:right">Nuevo</th>
        <th style="text-align:center">Variación</th>
        <th style="text-align:center">Actividades</th>
      </tr></thead><tbody>`;

  preview.forEach(p => {
    const pct     = p.variacion_pct !== null ? p.variacion_pct.toFixed(1) : '—';
    const pctColor = p.variacion_pct > 0 ? 'color:var(--red)' : p.variacion_pct < 0 ? 'color:var(--green)' : '';
    const signo   = p.variacion_pct > 0 ? '+' : '';
    html += `<tr>
      <td style="font-size:12px">${p.descripcion}</td>
      <td style="text-align:right;font-family:monospace;font-size:12px">L ${(p.precio_anterior||0).toLocaleString('es-HN',{minimumFractionDigits:2})}</td>
      <td style="text-align:right;font-family:monospace;font-size:12px;font-weight:600">L ${p.precio_nuevo.toLocaleString('es-HN',{minimumFractionDigits:2})}</td>
      <td style="text-align:center;font-size:12px;font-weight:600;${pctColor}">${pct !== '—' ? signo+pct+'%' : '—'}</td>
      <td style="text-align:center">
        <span style="font-size:11px;background:#e8f0fe;color:var(--blue);border-radius:10px;padding:2px 7px">
          ${p.num_actividades}
        </span>
      </td>
    </tr>`;
  });

  html += `</tbody></table></div>`;
  document.getElementById('apPreviewContent').innerHTML = html;
}

function apCerrarModal() {
  document.getElementById('modalApConfirmar').style.display = 'none';
}

// ─── EJECUTAR ACTUALIZACIÓN ───────────────────────────────────
async function apEjecutar() {
  const nombre = document.getElementById('apNombreSesion').value.trim();
  if (!nombre) { alert('Ingrese un nombre para la sesión.'); return; }

  const btn = document.getElementById('btnApConfirmar');
  btn.disabled = true;
  btn.textContent = '⏳ Aplicando...';

  const cambiosArr = Object.entries(_apCambios).map(([id, precio]) => ({
    id_insumo: parseInt(id), precio_nuevo: precio
  }));

  try {
    const r = await api.post('/api/actualizacion-precios/aplicar', {
      nombre,
      nota: document.getElementById('apNotaSesion').value.trim(),
      cambios: cambiosArr
    });

    apCerrarModal();
    _apCambios = {};

    // Recargar datos actualizados
    await apCargar();

    // Notificación
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed;bottom:24px;right:24px;background:var(--green);color:#fff;
      padding:14px 20px;border-radius:8px;font-weight:600;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2)`;
    toast.textContent = `✔ ${r.afectados} insumos actualizados. Variación promedio: ${r.variacion_prom > 0 ? '+' : ''}${r.variacion_prom}%`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);

  } catch(e) {
    alert('Error al aplicar: ' + (e.error || e));
    btn.disabled = false;
    btn.textContent = '✔ Confirmar y aplicar';
  }
}

// ─── HISTORIAL ────────────────────────────────────────────────
async function apVerHistorial() {
  document.getElementById('modalApHistorial').style.display = 'flex';
  document.getElementById('apHistorialBody').innerHTML =
    `<div class="loading"><div class="spinner"></div> Cargando...</div>`;
  try {
    const rows = await api.get('/api/actualizacion-precios/historial');
    if (!rows.length) {
      document.getElementById('apHistorialBody').innerHTML =
        `<div class="empty-state"><div>Aún no hay actualizaciones registradas</div></div>`;
      return;
    }
    let html = `<table><thead><tr>
      <th>Nombre</th><th style="width:90px">Fecha</th><th style="width:80px;text-align:center">Insumos</th>
      <th style="width:100px;text-align:center">Var. promedio</th><th style="width:100px">Usuario</th>
      <th style="width:60px"></th>
    </tr></thead><tbody>`;
    rows.forEach(r => {
      const vp = r.variacion_prom ? parseFloat(r.variacion_prom).toFixed(1) : '0.0';
      const color = parseFloat(vp) > 0 ? 'var(--red)' : parseFloat(vp) < 0 ? 'var(--green)' : '';
      html += `<tr>
        <td><strong>${r.nombre}</strong>${r.nota ? `<br><span style="font-size:11px;color:#888">${r.nota}</span>`:''}</td>
        <td style="font-size:12px">${r.fecha}</td>
        <td style="text-align:center">${r.total_afectados}</td>
        <td style="text-align:center;font-weight:600;color:${color}">
          ${parseFloat(vp)>0?'+':''}${vp}%
        </td>
        <td style="font-size:12px">${r.usuario||'—'}</td>
        <td><button class="btn btn-sm btn-secondary" onclick="apVerDetalle(${r.id_sesion})">Ver</button></td>
      </tr>`;
    });
    html += `</tbody></table>`;
    document.getElementById('apHistorialBody').innerHTML = html;
  } catch(e) {
    document.getElementById('apHistorialBody').innerHTML =
      `<div style="color:var(--red)">Error: ${e.error || e}</div>`;
  }
}

async function apVerDetalle(id_sesion) {
  document.getElementById('modalApDetalle').style.display = 'flex';
  document.getElementById('apDetalleBody').innerHTML =
    `<div class="loading"><div class="spinner"></div> Cargando...</div>`;
  try {
    const { sesion, detalle } = await api.get(`/api/actualizacion-precios/historial/${id_sesion}`);
    document.getElementById('apDetalleTitulo').textContent = sesion.nombre;

    const vp = parseFloat(sesion.variacion_prom||0).toFixed(1);
    let html = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
        <div class="stat-card" style="padding:8px 14px">
          <div class="stat-label">Fecha</div>
          <div class="stat-value" style="font-size:16px">${sesion.fecha}</div>
        </div>
        <div class="stat-card orange" style="padding:8px 14px">
          <div class="stat-label">Insumos actualizados</div>
          <div class="stat-value" style="font-size:16px">${sesion.total_afectados}</div>
        </div>
        <div class="stat-card" style="padding:8px 14px">
          <div class="stat-label">Variación promedio</div>
          <div class="stat-value" style="font-size:16px;color:${parseFloat(vp)>0?'var(--red)':parseFloat(vp)<0?'var(--green)':''}">
            ${parseFloat(vp)>0?'+':''}${vp}%
          </div>
        </div>
      </div>
      <div class="table-wrap" style="max-height:340px;overflow-y:auto">
      <table><thead><tr>
        <th>Código</th><th>Insumo</th><th>Categoría</th>
        <th style="text-align:right">Anterior</th>
        <th style="text-align:right">Nuevo</th>
        <th style="text-align:center">Variación</th>
      </tr></thead><tbody>`;

    detalle.forEach(d => {
      const pct   = d.variacion_pct !== null ? parseFloat(d.variacion_pct).toFixed(1) : '—';
      const color = d.variacion_pct > 0 ? 'var(--red)' : d.variacion_pct < 0 ? 'var(--green)' : '';
      html += `<tr>
        <td style="font-family:monospace;font-size:11px">${d.codigo||'—'}</td>
        <td style="font-size:12px">${d.descripcion}</td>
        <td style="font-size:11px;color:#666">${d.categoria}</td>
        <td style="text-align:right;font-family:monospace;font-size:12px">L ${(d.precio_anterior||0).toLocaleString('es-HN',{minimumFractionDigits:2})}</td>
        <td style="text-align:right;font-family:monospace;font-size:12px;font-weight:600">L ${(d.precio_nuevo||0).toLocaleString('es-HN',{minimumFractionDigits:2})}</td>
        <td style="text-align:center;font-size:12px;font-weight:600;color:${color}">
          ${pct!=='—'?(parseFloat(pct)>0?'+':'')+pct+'%':'—'}
        </td>
      </tr>`;
    });

    html += `</tbody></table></div>`;
    if (sesion.nota) html += `<p style="margin-top:10px;font-size:12px;color:#666">Nota: ${sesion.nota}</p>`;
    document.getElementById('apDetalleBody').innerHTML = html;
  } catch(e) {
    document.getElementById('apDetalleBody').innerHTML =
      `<div style="color:var(--red)">Error: ${e.error || e}</div>`;
  }
}
