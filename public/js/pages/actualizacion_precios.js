// ═══════════════════════════════════════════════════════════════
// ACTUALIZACIÓN MASIVA DE PRECIOS
// ═══════════════════════════════════════════════════════════════
let _apInsumos    = [];   // catálogo cargado
let _apCambios    = {};   // { id_insumo: precio_nuevo }
let _apFiltro     = '';
let _apCategoria  = '';
let _apSoloEdit   = false;
let _apModo       = 'catalogo';   // 'catalogo' | 'centro'
let _apCentroId   = null;
let _apCentroNom  = '';
let _apCentros    = [];           // lista de centros disponibles

async function renderActualizacionPrecios() {
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">ACTUALIZACIÓN DE PRECIOS</div>
        <div class="page-subtitle" id="apSubtitle">Actualización masiva — materiales, mano de obra y equipo</div>
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

      <!-- ═══ SELECTOR DE MODO Y CENTRO ═══ -->
      <div class="card" style="margin-bottom:14px">
        <div class="card-body" style="padding:14px 20px">

          <!-- Fila 1: modo -->
          <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
            <span style="font-size:13px;font-weight:600;color:var(--blue);white-space:nowrap">Destino de precios:</span>
            <button id="apBtnModoCat" class="btn btn-orange"
              onclick="apCambiarModo('catalogo')"
              title="Los precios se guardan en el catálogo global de insumos">
              🗂 Catálogo Base
            </button>
            <button id="apBtnModoCentro" class="btn btn-secondary"
              onclick="apCambiarModo('centro')"
              title="Los precios se guardan en el centro de costos seleccionado">
              📍 Centro de Costos
            </button>

            <!-- Selector de centro (visible solo en modo centro) -->
            <div id="apCentroWrap" style="display:none;align-items:center;gap:8px;flex-wrap:wrap;width:100%;margin-top:6px">
              <label style="font-size:13px;font-weight:600;color:var(--blue);white-space:nowrap">Centro:</label>
              <select id="apCentroSel" class="form-control" style="min-width:260px;max-width:420px"
                onchange="apSeleccionarCentro()">
                <option value="">— Seleccione un centro de costos —</option>
              </select>
              <span id="apCentroBadge" style="display:none;background:#e8f0fb;color:#025196;
                border-radius:20px;padding:3px 12px;font-size:12px;font-weight:600"></span>
            </div>
          </div>

          <!-- Fila 2: filtros y herramientas -->
          <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
            <div style="flex:2;min-width:200px">
              <label class="form-label">Buscar</label>
              <input type="text" class="form-control" id="apSearch"
                     placeholder="Código o descripción..." oninput="apFiltrar()">
            </div>
            <div style="flex:1;min-width:160px">
              <label class="form-label">Categoría</label>
              <select class="form-control" id="apCatSelect" onchange="apFiltrar()">
                <option value="">Todas</option>
              </select>
            </div>
            <div style="flex:1;min-width:160px">
              <label class="form-label">Ajuste global (%)</label>
              <div style="display:flex;gap:6px">
                <input type="number" class="form-control" id="apPct" placeholder="Ej: 5"
                       style="width:90px" step="0.1">
                <button class="btn btn-secondary" onclick="apAplicarPct()">Aplicar</button>
              </div>
            </div>
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
          <div class="loading"><div class="spinner"></div> Seleccione un modo para comenzar...</div>
        </div>
      </div>

    </div>

    <!-- Modal confirmar -->
    <div id="modalApConfirmar" class="modal-overlay" style="display:none">
      <div class="modal" style="max-width:600px">
        <div class="modal-header">
          <div class="modal-title" id="apModalConfTitle">Confirmar actualización de precios</div>
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

  // Cargar lista de centros disponibles
  await apCargarCentros();
  // Modo inicial: catálogo base
  await apCambiarModo('catalogo');
}

// ─── CARGAR CENTROS ───────────────────────────────────────────
async function apCargarCentros() {
  try {
    _apCentros = await api.get('/api/centros');
    const sel = document.getElementById('apCentroSel');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Seleccione un centro de costos —</option>';
    if (!_apCentros.length) {
      sel.innerHTML += '<option disabled>Sin centros creados. Créelos en "Centros de Costos"</option>';
    } else {
      _apCentros.forEach(c => {
        sel.innerHTML += `<option value="${c.id_centro}">${c.nombre}${c.zona ? ' — ' + c.zona : ''} (${c.total_precios} precios)</option>`;
      });
    }
  } catch(e) { console.error('Error cargando centros:', e); }
}

// ─── CAMBIAR MODO ─────────────────────────────────────────────
async function apCambiarModo(modo) {
  _apModo    = modo;
  _apCambios = {};
  _apSoloEdit = false;

  const btnCat    = document.getElementById('apBtnModoCat');
  const btnCentro = document.getElementById('apBtnModoCentro');
  const centroWrap = document.getElementById('apCentroWrap');
  const subtitle   = document.getElementById('apSubtitle');

  if (btnCat)    btnCat.className    = modo === 'catalogo' ? 'btn btn-orange' : 'btn btn-secondary';
  if (btnCentro) btnCentro.className = modo === 'centro'   ? 'btn btn-orange' : 'btn btn-secondary';
  if (centroWrap) centroWrap.style.display = modo === 'centro' ? 'flex' : 'none';

  if (modo === 'catalogo') {
    _apCentroId  = null;
    _apCentroNom = '';
    if (subtitle) subtitle.textContent = 'Precios globales — catálogo base de insumos';
    await apCargar();
  } else {
    // Esperar selección de centro
    if (subtitle) subtitle.textContent = 'Precios por centro de costos — seleccione un centro';
    document.getElementById('apTablaWrap').innerHTML =
      `<div class="empty-state" style="padding:40px">
        <div class="empty-icon">📍</div>
        <div class="empty-title">Seleccione un centro de costos</div>
        <div class="empty-desc">Elija el centro en el selector de arriba para ver y editar sus precios</div>
      </div>`;
    document.getElementById('apTituloTabla').textContent = 'Centro de costos';
    // Si ya había uno seleccionado, cargarlo
    const sel = document.getElementById('apCentroSel');
    if (sel && sel.value) await apSeleccionarCentro();
  }
}

// ─── SELECCIONAR CENTRO ───────────────────────────────────────
async function apSeleccionarCentro() {
  const sel = document.getElementById('apCentroSel');
  const id  = sel ? parseInt(sel.value) : null;
  if (!id) {
    _apCentroId = null;
    _apCentroNom = '';
    document.getElementById('apTablaWrap').innerHTML =
      `<div class="empty-state" style="padding:40px"><div class="empty-icon">📍</div>
       <div class="empty-title">Seleccione un centro de costos</div></div>`;
    const badge = document.getElementById('apCentroBadge');
    if (badge) badge.style.display = 'none';
    return;
  }
  _apCambios = {};
  _apCentroId = id;
  const centro = _apCentros.find(c => c.id_centro === id);
  _apCentroNom = centro ? centro.nombre : '';

  const badge = document.getElementById('apCentroBadge');
  if (badge) {
    badge.textContent = `📍 ${_apCentroNom}`;
    badge.style.display = '';
  }

  document.getElementById('apSubtitle').textContent =
    `Centro: ${_apCentroNom}${centro?.zona ? ' — ' + centro.zona : ''} · Los precios se guardan solo en este centro`;
  document.getElementById('apTablaWrap').innerHTML =
    `<div class="loading"><div class="spinner"></div> Cargando precios del centro...</div>`;

  try {
    const r = await api.get(`/api/actualizacion-precios/insumos-centro/${id}`);
    _apInsumos = r.insumos || [];
    // Repoblar selector categorías
    const cats = [...new Map(_apInsumos.map(i => [i.id_categoria, i.categoria])).entries()];
    const catSel = document.getElementById('apCatSelect');
    catSel.innerHTML = '<option value="">Todas</option>';
    cats.forEach(([cid, cnombre]) => {
      catSel.innerHTML += `<option value="${cid}">${cnombre}</option>`;
    });
    apRenderTabla();
  } catch(e) {
    document.getElementById('apTablaWrap').innerHTML =
      `<div class="empty-state"><div>Error al cargar centro: ${e.error || e}</div></div>`;
  }
}

// ─── CARGA INICIAL (modo catálogo) ───────────────────────────
async function apCargar() {
  document.getElementById('apTablaWrap').innerHTML =
    `<div class="loading"><div class="spinner"></div> Cargando insumos...</div>`;
  try {
    _apInsumos = await api.get('/api/actualizacion-precios/insumos');
    _apCambios = {};
    const cats = [...new Map(_apInsumos.map(i => [i.id_categoria, i.categoria])).entries()];
    const sel = document.getElementById('apCatSelect');
    sel.innerHTML = '<option value="">Todas</option>';
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
  if (_apFiltro)    lista = lista.filter(i => i.descripcion.toLowerCase().includes(_apFiltro) || (i.codigo||'').toLowerCase().includes(_apFiltro));
  if (_apCategoria) lista = lista.filter(i => String(i.id_categoria) === _apCategoria);
  if (_apSoloEdit)  lista = lista.filter(i => _apCambios[i.id_insumo] !== undefined);

  const nCambios  = Object.keys(_apCambios).length;
  const nFiltrado = lista.length;
  const esCentro  = _apModo === 'centro';

  document.getElementById('apTituloTabla').textContent =
    `${nFiltrado} insumo${nFiltrado!==1?'s':''}${_apFiltro || _apCategoria ? ' (filtrados)' : ''}` +
    (esCentro ? ` — ${_apCentroNom}` : ' — Catálogo base');

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
  lista.forEach(i => { if (!grupos[i.categoria]) grupos[i.categoria] = []; grupos[i.categoria].push(i); });

  // Columnas extra en modo centro
  const colPrecioHeader = esCentro
    ? `<th style="width:120px;text-align:right">Precio base</th>
       <th style="width:130px;text-align:right">Precio centro</th>`
    : `<th style="width:120px;text-align:right">Precio actual</th>`;

  let html = `<table>
    <thead><tr>
      <th style="width:90px">Código</th>
      <th>Descripción</th>
      <th style="width:60px;text-align:center">Unidad</th>
      ${colPrecioHeader}
      <th style="width:150px;text-align:right">Nuevo precio</th>
      <th style="width:80px;text-align:center">Variación</th>
      <th style="width:60px;text-align:center">Usos</th>
    </tr></thead><tbody>`;

  Object.entries(grupos).forEach(([cat, items]) => {
    html += `<tr style="background:#f0f4f8">
      <td colspan="${esCentro ? 8 : 7}" style="font-weight:700;color:var(--blue);font-size:12px;
          padding:6px 14px;text-transform:uppercase;letter-spacing:.5px">${cat}</td>
    </tr>`;

    items.forEach(i => {
      const editado    = _apCambios[i.id_insumo] !== undefined;
      const precioNvo  = editado ? _apCambios[i.id_insumo] : '';
      // Precio de referencia para calcular variación
      const precioRef  = esCentro
        ? (i.precio_centro !== null ? i.precio_centro : i.precio_base)
        : i.precio_unitario;
      const pct        = editado && precioRef > 0
        ? ((precioNvo - precioRef) / precioRef * 100).toFixed(1) : '';
      const pctColor   = pct === '' ? '' : (parseFloat(pct) > 0 ? 'color:var(--red)' : parseFloat(pct) < 0 ? 'color:var(--green)' : '');
      const rowBg      = editado ? 'background:#fffde7' : '';
      const tienePrecioCentro = esCentro && i.precio_centro !== null;

      // Columna(s) de precio según modo
      const colPrecioCell = esCentro ? `
        <td style="text-align:right;font-family:monospace;font-size:11px;color:#888">
          ${i.precio_base ? 'L ' + i.precio_base.toLocaleString('es-HN',{minimumFractionDigits:2}) : '<span style="color:#aaa">—</span>'}
        </td>
        <td style="text-align:right;font-family:monospace">
          ${tienePrecioCentro
            ? `<span style="color:var(--blue);font-weight:600">L ${i.precio_centro.toLocaleString('es-HN',{minimumFractionDigits:2})}</span>`
            : `<span style="color:#aaa;font-size:11px;font-style:italic">Sin precio propio</span>`}
        </td>`
      : `<td style="text-align:right;font-family:monospace">
          ${i.precio_unitario ? 'L ' + i.precio_unitario.toLocaleString('es-HN',{minimumFractionDigits:2}) : '<span style="color:#aaa">—</span>'}
        </td>`;

      html += `<tr style="${rowBg}" id="apRow_${i.id_insumo}">
        <td style="font-family:monospace;font-size:12px">${i.codigo || '—'}</td>
        <td>${i.descripcion}</td>
        <td style="text-align:center;font-size:12px">${i.unidad}</td>
        ${colPrecioCell}
        <td style="text-align:right">
          <input type="number" min="0" step="0.01"
                 class="form-control" style="width:130px;text-align:right;margin-left:auto;
                   ${editado ? 'border-color:var(--orange);background:#fff9e6' : ''}"
                 value="${precioNvo}"
                 placeholder="${precioRef ? precioRef.toFixed(2) : '0.00'}"
                 oninput="apRegistrarCambio(${i.id_insumo}, ${precioRef||0}, this.value)"
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
  const v     = parseFloat(valor);
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
      pctEl.textContent = (parseFloat(pct) > 0 ? '+' : '') + pct + '%';
      pctEl.style.color = parseFloat(pct) > 0 ? 'var(--red)' : parseFloat(pct) < 0 ? 'var(--green)' : '';
    }
  }
  const n = Object.keys(_apCambios).length;
  document.getElementById('apConteo').textContent = n;
  document.getElementById('btnApAplicar').style.display = n > 0 ? '' : 'none';
  document.getElementById('apResumenCambios').textContent = n > 0 ? `${n} precio(s) modificado(s)` : '';
}

// ─── AJUSTE GLOBAL POR PORCENTAJE ────────────────────────────
function apAplicarPct() {
  const pct = parseFloat(document.getElementById('apPct').value);
  if (isNaN(pct) || pct === 0) { alert('Ingrese un porcentaje válido.'); return; }

  let lista = _apInsumos;
  if (_apFiltro)    lista = lista.filter(i => i.descripcion.toLowerCase().includes(_apFiltro) || (i.codigo||'').toLowerCase().includes(_apFiltro));
  if (_apCategoria) lista = lista.filter(i => String(i.id_categoria) === _apCategoria);

  lista.forEach(i => {
    const base = _apModo === 'centro'
      ? (i.precio_centro !== null ? i.precio_centro : i.precio_base)
      : i.precio_unitario;
    if (!base) return;
    _apCambios[i.id_insumo] = parseFloat((base * (1 + pct / 100)).toFixed(2));
  });
  apRenderTabla();
}

// ─── LIMPIAR CAMBIOS ─────────────────────────────────────────
function apLimpiarCambios() {
  if (!Object.keys(_apCambios).length) return;
  if (!confirm('¿Descartar todos los precios editados?')) return;
  _apCambios  = {};
  _apSoloEdit = false;
  document.getElementById('btnApSoloEdit').textContent  = 'Ver editados';
  document.getElementById('btnApSoloEdit').className    = 'btn btn-secondary';
  apRenderTabla();
}

// ─── MODAL CONFIRMAR ─────────────────────────────────────────
async function apModalConfirmar() {
  // Validación modo centro
  if (_apModo === 'centro' && !_apCentroId) {
    toast('Seleccione un centro de costos antes de aplicar', 'error');
    return;
  }

  const modal = document.getElementById('modalApConfirmar');
  modal.style.display = 'flex';

  // Título del modal según modo
  const titleEl = document.getElementById('apModalConfTitle');
  if (titleEl) {
    titleEl.textContent = _apModo === 'centro'
      ? `Confirmar actualización — Centro: ${_apCentroNom}`
      : 'Confirmar actualización de precios — Catálogo Base';
  }

  // Sugerir nombre de sesión
  const hoy = new Date().toLocaleDateString('es-HN', { month:'long', year:'numeric' });
  const sufijo = _apModo === 'centro' ? ` — ${_apCentroNom}` : '';
  document.getElementById('apNombreSesion').value = `Actualización ${hoy}${sufijo}`;

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
  const sube  = preview.filter(p => p.variacion_pct > 0);
  const baja  = preview.filter(p => p.variacion_pct < 0);
  const igual = preview.filter(p => p.variacion_pct === 0 || p.variacion_pct === null);

  const destinoLabel = _apModo === 'centro'
    ? `<div style="background:#e8f0fb;border-left:3px solid var(--blue);padding:8px 12px;border-radius:4px;margin-bottom:12px;font-size:12px;color:var(--blue)">
         📍 Los precios se guardarán <strong>únicamente</strong> en el centro <strong>${_apCentroNom}</strong>. El catálogo base no se modificará.
       </div>`
    : `<div style="background:#fff8e1;border-left:3px solid var(--orange);padding:8px 12px;border-radius:4px;margin-bottom:12px;font-size:12px;color:#92400e">
         🗂 Los precios se guardarán en el <strong>catálogo base global</strong>. Esto afecta a todas las actividades y presupuestos que usen estos insumos.
       </div>`;

  let html = destinoLabel + `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
      <div class="stat-card" style="padding:10px 14px">
        <div class="stat-label">Insumos a actualizar</div>
        <div class="stat-value" style="font-size:20px">${preview.length}</div>
      </div>
      <div class="stat-card orange" style="padding:10px 14px">
        <div class="stat-label">Actividades afectadas</div>
        <div class="stat-value" style="font-size:20px">${preview.reduce((s,p)=>s+p.num_actividades,0)||'—'}</div>
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
    const pct    = p.variacion_pct !== null ? p.variacion_pct.toFixed(1) : '—';
    const color  = p.variacion_pct > 0 ? 'color:var(--red)' : p.variacion_pct < 0 ? 'color:var(--green)' : '';
    const signo  = p.variacion_pct > 0 ? '+' : '';
    html += `<tr>
      <td style="font-size:12px">${p.descripcion}</td>
      <td style="text-align:right;font-family:monospace;font-size:12px">L ${(p.precio_anterior||0).toLocaleString('es-HN',{minimumFractionDigits:2})}</td>
      <td style="text-align:right;font-family:monospace;font-size:12px;font-weight:600">L ${p.precio_nuevo.toLocaleString('es-HN',{minimumFractionDigits:2})}</td>
      <td style="text-align:center;font-size:12px;font-weight:600;${color}">${pct!=='—'?signo+pct+'%':'—'}</td>
      <td style="text-align:center">
        <span style="font-size:11px;background:#e8f0fe;color:var(--blue);border-radius:10px;padding:2px 7px">${p.num_actividades}</span>
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
    let r;
    if (_apModo === 'centro') {
      r = await api.post('/api/actualizacion-precios/aplicar-centro', {
        id_centro: _apCentroId,
        nombre,
        nota: document.getElementById('apNotaSesion').value.trim(),
        cambios: cambiosArr
      });
    } else {
      r = await api.post('/api/actualizacion-precios/aplicar', {
        nombre,
        nota: document.getElementById('apNotaSesion').value.trim(),
        cambios: cambiosArr
      });
    }

    apCerrarModal();
    _apCambios = {};

    // Recargar tabla
    if (_apModo === 'centro' && _apCentroId) {
      await apSeleccionarCentro();
    } else {
      await apCargar();
    }

    toast(`✔ ${r.afectados} precio(s) actualizados${_apModo==='centro'?' en '+r.nombre_centro:''}. Variación prom: ${r.variacion_prom > 0 ? '+' : ''}${r.variacion_prom}%`, 'success');
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
      <th>Nombre</th><th style="width:90px">Fecha</th>
      <th style="width:80px;text-align:center">Insumos</th>
      <th style="width:100px;text-align:center">Var. promedio</th>
      <th style="width:100px">Usuario</th>
      <th style="width:60px"></th>
    </tr></thead><tbody>`;
    rows.forEach(r => {
      const vp    = r.variacion_prom ? parseFloat(r.variacion_prom).toFixed(1) : '0.0';
      const color = parseFloat(vp) > 0 ? 'var(--red)' : parseFloat(vp) < 0 ? 'var(--green)' : '';
      const esCentro = r.nota && r.nota.startsWith('[Centro:');
      html += `<tr>
        <td>
          <strong>${r.nombre}</strong>
          ${esCentro ? `<span style="font-size:10px;background:#e8f0fb;color:#025196;border-radius:10px;padding:1px 7px;margin-left:5px">📍 Centro</span>` : ''}
          ${r.nota ? `<br><span style="font-size:11px;color:#888">${r.nota}</span>`:''}</td>
        <td style="font-size:12px">${r.fecha}</td>
        <td style="text-align:center">${r.total_afectados}</td>
        <td style="text-align:center;font-weight:600;color:${color}">${parseFloat(vp)>0?'+':''}${vp}%</td>
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
