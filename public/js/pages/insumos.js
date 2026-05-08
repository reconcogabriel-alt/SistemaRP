// ═══════════════════════════════════════════════════════════════
// INSUMOS — con panel de alertas de precios faltantes
// ═══════════════════════════════════════════════════════════════
let _insumos = [];
let _categorias = [];

async function renderInsumos() {
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">INSUMOS</div>
        <div class="page-subtitle">Catálogo maestro — materiales, mano de obra y equipo</div>
      </div>
      <div class="btn-group">
        <button class="btn btn-secondary" id="btnAlertaPrecios"
          onclick="switchInsumoTab('alertas', this)"
          style="position:relative">
          ⚠ Sin Precio
          <span id="badgeSinPrecio" style="display:none; position:absolute; top:-6px; right:-6px;
            background:var(--red,#e53e3e); color:#fff; border-radius:50%; width:18px; height:18px;
            font-size:10px; font-weight:700; line-height:18px; text-align:center">0</span>
        </button>
        <button class="btn btn-orange" onclick="modalNuevoInsumo()">+ Nuevo Insumo</button>
      </div>
    </div>
    <div class="page-body">

      <!-- Tabs -->
      <div class="tabs" style="margin-bottom:16px">
        <div class="tab active" id="tab-catalogo" onclick="switchInsumoTab('catalogo', this)">📋 Catálogo</div>
        <div class="tab" id="tab-alertas" onclick="switchInsumoTab('alertas', this)">⚠ Sin Precio / Precio Cero</div>
      </div>

      <!-- Panel catálogo -->
      <div id="panel-catalogo">
        <div class="toolbar">
          <div class="search-box">
            <input type="text" id="searchInsumo" placeholder="Buscar por código o descripción..." oninput="filterInsumos()">
          </div>
          <select class="filter-select" id="filterCat" onchange="filterInsumos()">
            <option value="">Todas las categorías</option>
          </select>
          <select class="filter-select" id="filterPrecio" onchange="filterInsumos()">
            <option value="">Todos los precios</option>
            <option value="con">Con precio (&gt; 0)</option>
            <option value="sin">Sin precio (= 0)</option>
          </select>
        </div>
        <div class="card">
          <div class="table-wrap" id="insumosTableWrap">
            <div class="loading"><div class="spinner"></div> Cargando...</div>
          </div>
        </div>
      </div>

      <!-- Panel alertas -->
      <div id="panel-alertas" style="display:none">
        <div class="loading" id="alertasLoading"><div class="spinner"></div> Analizando catálogo...</div>
        <div id="alertasContent" style="display:none"></div>
      </div>

    </div>`;

  try {
    [_insumos, _categorias] = await Promise.all([
      api.get('/api/insumos'),
      api.get('/api/insumos/categorias')
    ]);
    const sel = document.getElementById('filterCat');
    _categorias.forEach(c => sel.innerHTML += `<option value="${c.id_categoria}">${c.nombre}</option>`);
    renderInsumosTable(_insumos);

    // Mostrar badge con conteo de sin precio
    const sinPrecio = _insumos.filter(i => !i.precio_unitario || i.precio_unitario == 0).length;
    if (sinPrecio > 0) {
      const badge = document.getElementById('badgeSinPrecio');
      if (badge) {
        badge.textContent = sinPrecio > 99 ? '99+' : sinPrecio;
        badge.style.display = 'block';
      }
    }
  } catch(e) {
    document.getElementById('insumosTableWrap').innerHTML = `<div class="empty-state"><div>Error: ${e.error}</div></div>`;
  }
}

function switchInsumoTab(tab, btn) {
  document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('panel-catalogo').style.display = tab === 'catalogo' ? '' : 'none';
  document.getElementById('panel-alertas').style.display  = tab === 'alertas'  ? '' : 'none';
  if (tab === 'alertas') cargarAlertasPrecios();
}

// ─── CATÁLOGO ────────────────────────────────────────────────
function filterInsumos() {
  const q   = (document.getElementById('searchInsumo')?.value  || '').toLowerCase();
  const cat = document.getElementById('filterCat')?.value    || '';
  const prc = document.getElementById('filterPrecio')?.value || '';
  const f = _insumos.filter(i =>
    (i.descripcion.toLowerCase().includes(q) || (i.codigo||'').toLowerCase().includes(q)) &&
    (!cat || i.id_categoria == cat) &&
    (!prc || (prc==='con' ? i.precio_unitario > 0 : !i.precio_unitario || i.precio_unitario==0))
  );
  renderInsumosTable(f);
}

function renderInsumosTable(lista) {
  const wrap = document.getElementById('insumosTableWrap');
  if (!wrap) return;
  if (!lista.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">◇</div><div class="empty-title">Sin insumos</div></div>`;
    return;
  }
  wrap.innerHTML = `
    <table>
      <thead><tr>
        <th>Código</th><th>Descripción</th><th>Unidad</th><th>Categoría</th>
        <th style="text-align:right">Precio Unitario</th><th>Actualizado</th><th></th>
      </tr></thead>
      <tbody>
        ${lista.map(i => `
          <tr>
            <td class="td-code">${sanitize(i.codigo||'')}</td>
            <td>${sanitize(i.descripcion)}</td>
            <td><span class="badge badge-blue" style="font-size:11px">${i.unidad}</span></td>
            <td><span class="cat-tag ${catClass(i.categoria)}">${i.categoria}</span></td>
            <td style="text-align:right">
              ${i.precio_unitario > 0
                ? `<span style="font-family:'Barlow Condensed',sans-serif; font-size:15px; font-weight:700; color:var(--green)">L ${fmt(i.precio_unitario)}</span>`
                : `<span style="color:var(--red,#e53e3e); font-weight:700; font-size:12px">⚠ SIN PRECIO</span>`}
            </td>
            <td style="font-size:11px; color:var(--text-muted)">${i.fecha_actualizacion||'—'}</td>
            <td>
              <div class="btn-group">
                <button class="btn btn-secondary btn-sm btn-icon" onclick="modalEditarInsumo(${i.id_insumo})" title="Editar precio">✎</button>
                <button class="btn btn-secondary btn-sm btn-icon" onclick="modalHistorial(${i.id_insumo},'${sanitize(i.descripcion)}')" title="Historial">📈</button>
              </div>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>
    <div style="padding:8px 14px; font-size:11px; color:var(--text-muted); border-top:1px solid var(--gray-light)">
      ${lista.length.toLocaleString()} insumos mostrados
    </div>`;
}

// ─── PANEL ALERTAS — SIN PRECIO ──────────────────────────────
async function cargarAlertasPrecios() {
  const loading = document.getElementById('alertasLoading');
  const content = document.getElementById('alertasContent');
  if (!loading || !content) return;
  if (content.dataset.loaded) return; // ya cargado

  loading.style.display = '';
  content.style.display = 'none';

  try {
    const data = await api.get('/api/insumos/sin-precio');
    loading.style.display = 'none';
    content.style.display = '';
    content.dataset.loaded = '1';

    const pct = ((data.total_sin_precio / data.total_insumos) * 100).toFixed(1);
    const usadosCnt = data.insumos_usados.length;
    const noUsadosCnt = data.insumos_no_usados.length;

    // Agrupar insumos_usados por categoría
    const porCat = {};
    data.insumos_usados.forEach(i => {
      if (!porCat[i.categoria]) porCat[i.categoria] = [];
      porCat[i.categoria].push(i);
    });

    content.innerHTML = `
      <!-- Resumen ejecutivo -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:20px">
        <div class="card" style="border-top:3px solid var(--red,#e53e3e)">
          <div class="card-body" style="text-align:center; padding:16px">
            <div style="font-size:32px; font-weight:700; color:var(--red,#e53e3e); font-family:'Barlow Condensed',sans-serif">${data.total_sin_precio.toLocaleString()}</div>
            <div style="font-size:12px; color:var(--text-muted)">Insumos sin precio</div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px">${pct}% del catálogo</div>
          </div>
        </div>
        <div class="card" style="border-top:3px solid var(--orange)">
          <div class="card-body" style="text-align:center; padding:16px">
            <div style="font-size:32px; font-weight:700; color:var(--orange); font-family:'Barlow Condensed',sans-serif">${usadosCnt.toLocaleString()}</div>
            <div style="font-size:12px; color:var(--text-muted)">Usados en actividades del catálogo</div>
            <div style="font-size:11px; color:var(--red,#e53e3e); font-weight:600; margin-top:2px">⚠ AFECTAN COSTOS UNITARIOS</div>
          </div>
        </div>
        <div class="card" style="border-top:3px solid var(--gray-mid)">
          <div class="card-body" style="text-align:center; padding:16px">
            <div style="font-size:32px; font-weight:700; color:var(--text-muted); font-family:'Barlow Condensed',sans-serif">${noUsadosCnt.toLocaleString()}${data.insumos_no_usados.length>=100?'+':''}</div>
            <div style="font-size:12px; color:var(--text-muted)">Sin usar en actividades</div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px">Menor prioridad</div>
          </div>
        </div>
        <div class="card" style="border-top:3px solid var(--blue)">
          <div class="card-body" style="text-align:center; padding:16px">
            <div style="font-size:32px; font-weight:700; color:var(--blue); font-family:'Barlow Condensed',sans-serif">${(data.total_insumos-data.total_sin_precio).toLocaleString()}</div>
            <div style="font-size:12px; color:var(--text-muted)">Con precio asignado</div>
            <div style="font-size:11px; color:var(--green,#38a169); margin-top:2px">✓ OK</div>
          </div>
        </div>
      </div>

      <!-- Resumen por categoría -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><span class="card-title">Resumen por Categoría</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>Categoría</th>
              <th style="text-align:right">Total insumos</th>
              <th style="text-align:right">Sin precio</th>
              <th style="text-align:right">Con precio</th>
              <th style="min-width:200px">Cobertura</th>
            </tr></thead>
            <tbody>
              ${data.categorias.map(c => {
                const conPrecio = c.total - c.sin_precio;
                const pctCov = c.total > 0 ? ((conPrecio/c.total)*100) : 0;
                const barColor = pctCov >= 80 ? '#38a169' : pctCov >= 50 ? '#dd6b20' : '#e53e3e';
                return `<tr>
                  <td><span class="cat-tag ${catClass(c.nombre)}">${c.nombre}</span></td>
                  <td style="text-align:right">${c.total}</td>
                  <td style="text-align:right; color:${c.sin_precio>0?'#e53e3e':'#38a169'}; font-weight:600">${c.sin_precio}</td>
                  <td style="text-align:right; color:#38a169; font-weight:600">${conPrecio}</td>
                  <td>
                    <div style="display:flex; align-items:center; gap:8px">
                      <div style="flex:1; background:var(--gray-light); border-radius:4px; height:8px; overflow:hidden">
                        <div style="width:${pctCov.toFixed(0)}%; height:100%; background:${barColor}; border-radius:4px; transition:width 0.5s"></div>
                      </div>
                      <span style="font-size:11px; font-weight:600; color:${barColor}; min-width:36px">${pctCov.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Insumos usados en actividades SIN precio — MÁS URGENTES -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-header" style="background:rgba(229,62,62,0.06); border-bottom:2px solid rgba(229,62,62,0.2)">
          <div>
            <span class="card-title" style="color:#c53030">⚠ URGENTE — Insumos sin precio usados en actividades del catálogo</span>
            <div style="font-size:12px; color:var(--text-muted); margin-top:2px">
              Estos insumos tienen precio = 0 y están en fichas de costos. <strong>El costo unitario de esas actividades es incorrecto.</strong>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="filtrarSinPrecioCatalogo()">Ver en Catálogo →</button>
        </div>
        ${Object.keys(porCat).length === 0
          ? `<div style="padding:24px; text-align:center; color:var(--green,#38a169); font-weight:600">✓ Todos los insumos usados en actividades tienen precio asignado</div>`
          : Object.entries(porCat).map(([cat, items]) => `
              <div style="border-bottom:1px solid var(--gray-light)">
                <div style="padding:8px 16px; background:var(--gray-light); font-weight:700; font-size:12px; color:var(--blue); display:flex; justify-content:space-between">
                  <span>${cat}</span>
                  <span style="color:#e53e3e">${items.length} sin precio</span>
                </div>
                <div class="table-wrap" style="max-height:300px; overflow-y:auto">
                  <table>
                    <thead><tr>
                      <th>Código</th><th>Descripción</th><th>Unidad</th>
                      <th style="text-align:right">Actividades afectadas</th><th></th>
                    </tr></thead>
                    <tbody>
                      ${items.map(i => `
                        <tr style="background:rgba(229,62,62,0.03)">
                          <td class="td-code">${sanitize(i.codigo||'—')}</td>
                          <td>${sanitize(i.descripcion)}</td>
                          <td><span class="badge badge-blue" style="font-size:10px">${i.unidad}</span></td>
                          <td style="text-align:right">
                            <span style="background:#fff3cd; color:#856404; border-radius:12px; padding:2px 8px; font-size:11px; font-weight:600">
                              ${i.num_actividades} actividad${i.num_actividades!==1?'es':''}
                            </span>
                          </td>
                          <td>
                            <button class="btn btn-orange btn-sm" onclick="editarPrecioRapido(${i.id_insumo},'${sanitize(i.descripcion)}','${i.unidad}')"
                              style="white-space:nowrap">💰 Ingresar precio</button>
                          </td>
                        </tr>`).join('')}
                    </tbody>
                  </table>
                </div>
              </div>`).join('')}
      </div>

      <div style="padding:12px 16px; background:var(--gray-light); border-radius:4px; font-size:12px; color:var(--text-muted)">
        💡 <strong>Tip:</strong> Haz clic en <strong>"💰 Ingresar precio"</strong> para asignar el precio directamente desde esta pantalla.
        Después de actualizar, el sistema recalculará automáticamente los costos unitarios de todas las actividades afectadas.
        Fuente recomendada: <strong>CHICO Boletín IV-2025</strong>, Larach y Cía, cotizaciones de mercado Tegucigalpa.
      </div>`;

  } catch(e) {
    loading.style.display = 'none';
    content.style.display = '';
    content.innerHTML = `<div class="empty-state"><div>Error al cargar: ${e.error||e}</div></div>`;
  }
}

function filtrarSinPrecioCatalogo() {
  // Cambiar al tab de catálogo y filtrar sin precio
  const tabCat = document.getElementById('tab-catalogo');
  if (tabCat) switchInsumoTab('catalogo', tabCat);
  setTimeout(() => {
    const sel = document.getElementById('filterPrecio');
    if (sel) { sel.value = 'sin'; filterInsumos(); }
  }, 100);
}

// ─── EDICIÓN RÁPIDA DE PRECIO DESDE ALERTAS ──────────────────
function editarPrecioRapido(id, desc, unidad) {
  showModal(`PRECIO — ${desc}`, `
    <div style="margin-bottom:16px; padding:12px; background:rgba(229,62,62,0.06); border-radius:4px; border-left:3px solid #e53e3e">
      <div style="font-size:12px; color:#c53030; font-weight:600">⚠ Insumo sin precio</div>
      <div style="font-size:13px; margin-top:4px">${sanitize(desc)}</div>
      <div style="font-size:11px; color:var(--text-muted)">Unidad: ${unidad}</div>
    </div>
    <div class="form-group">
      <label class="form-label">Precio Unitario (L) *</label>
      <input type="number" id="precioRapido" placeholder="0.00" step="0.01" min="0"
        style="font-size:20px; font-weight:700; text-align:right" autofocus>
      <div style="font-size:11px; color:var(--text-muted); margin-top:4px">
        Referencia: CHICO Boletín Dic.2025 / Larach y Cía / cotización de mercado
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-orange" onclick="guardarPrecioRapido(${id})">Guardar y Recalcular</button>
    </div>`);
  setTimeout(() => document.getElementById('precioRapido')?.focus(), 60);
}

async function guardarPrecioRapido(id) {
  const precio = parseFloat(document.getElementById('precioRapido').value);
  if (!precio || precio <= 0) { toast('Ingresa un precio mayor a 0', 'error'); return; }
  try {
    // Get current insumo data
    const ins = _insumos.find(i => i.id_insumo == id);
    if (!ins) { toast('Insumo no encontrado', 'error'); return; }
    await api.put(`/api/insumos/${id}`, {
      codigo:        ins.codigo,
      descripcion:   ins.descripcion,
      unidad:        ins.unidad,
      id_categoria:  ins.id_categoria,
      precio_unitario: precio
    });
    hideModal();
    toast('Precio guardado. Recalculando costos unitarios...');

    // Recalculate actividades via a background call
    await fetch('/api/actividades/recalcular', { method: 'POST',
      headers: { 'Content-Type': 'application/json' } }).catch(() => {});

    // Reload insumos and reset alertas panel
    _insumos = await api.get('/api/insumos');
    const badge = document.getElementById('badgeSinPrecio');
    const sinPrecio = _insumos.filter(i => !i.precio_unitario || i.precio_unitario==0).length;
    if (badge) { badge.textContent = sinPrecio > 99 ? '99+' : sinPrecio; badge.style.display = sinPrecio > 0 ? 'block' : 'none'; }

    // Force reload of alertas panel
    const cont = document.getElementById('alertasContent');
    if (cont) { delete cont.dataset.loaded; cont.innerHTML = ''; }
    cargarAlertasPrecios();
    toast('✓ Precio actualizado correctamente');
  } catch(e) { toast(e.error||'Error al guardar', 'error'); }
}

// ─── MODALES CRUD NORMALES ───────────────────────────────────
function modalNuevoInsumo() {
  showModal('NUEVO INSUMO', `
    <div class="form-grid form-grid-2">
      <div class="form-group">
        <label class="form-label">Código</label>
        <input type="text" id="iCodigo" placeholder="MN-F0101001">
      </div>
      <div class="form-group">
        <label class="form-label">Unidad *</label>
        <input type="text" id="iUnidad" placeholder="M3 / KG / ML / C/U / BOLSA">
      </div>
      <div class="form-group" style="grid-column:span 2">
        <label class="form-label">Descripción *</label>
        <input type="text" id="iDesc" placeholder="Nombre del insumo">
      </div>
      <div class="form-group">
        <label class="form-label">Categoría *</label>
        <select id="iCat">
          ${_categorias.map(c => `<option value="${c.id_categoria}">${c.nombre}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Precio Unitario (L)</label>
        <input type="number" id="iPrecio" value="0" min="0" step="0.01">
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-orange" onclick="guardarInsumo()">Guardar</button>
    </div>`);
}

async function guardarInsumo() {
  const desc = document.getElementById('iDesc').value.trim();
  if (!desc) { toast('Descripción requerida', 'error'); return; }
  try {
    await api.post('/api/insumos', {
      codigo:        document.getElementById('iCodigo').value.trim() || null,
      descripcion:   desc,
      unidad:        document.getElementById('iUnidad').value.trim(),
      id_categoria:  document.getElementById('iCat').value,
      precio_unitario: parseFloat(document.getElementById('iPrecio').value) || 0
    });
    hideModal(); toast('Insumo creado');
    _insumos = await api.get('/api/insumos');
    filterInsumos();
  } catch(e) { toast(e.error||'Error', 'error'); }
}

async function modalEditarInsumo(id) {
  const i = _insumos.find(x => x.id_insumo == id);
  if (!i) return;
  showModal('EDITAR INSUMO', `
    <div class="form-grid form-grid-2">
      <div class="form-group">
        <label class="form-label">Código</label>
        <input type="text" id="iCodigo" value="${sanitize(i.codigo||'')}">
      </div>
      <div class="form-group">
        <label class="form-label">Unidad</label>
        <input type="text" id="iUnidad" value="${sanitize(i.unidad)}">
      </div>
      <div class="form-group" style="grid-column:span 2">
        <label class="form-label">Descripción</label>
        <input type="text" id="iDesc" value="${sanitize(i.descripcion)}">
      </div>
      <div class="form-group">
        <label class="form-label">Categoría</label>
        <select id="iCat">
          ${_categorias.map(c => `<option value="${c.id_categoria}" ${c.id_categoria==i.id_categoria?'selected':''}>${c.nombre}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Precio Unitario (L) *</label>
        <input type="number" id="iPrecio" value="${i.precio_unitario||0}" step="0.01" min="0"
          style="font-size:18px; font-weight:700; text-align:right">
      </div>
    </div>
    <div id="histPreview" style="margin-top:8px; font-size:11px; color:var(--text-muted)">
      Precio actual: <strong>L ${fmt(i.precio_unitario||0)}</strong> — actualizado: ${i.fecha_actualizacion||'—'}
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-secondary" onclick="modalHistorial(${id},'${sanitize(i.descripcion)}')">📈 Historial</button>
      <button class="btn btn-primary" onclick="actualizarInsumo(${id})">Actualizar</button>
    </div>`);
  setTimeout(() => document.getElementById('iPrecio')?.select(), 60);
}

async function actualizarInsumo(id) {
  try {
    await api.put(`/api/insumos/${id}`, {
      codigo:        document.getElementById('iCodigo').value.trim(),
      descripcion:   document.getElementById('iDesc').value.trim(),
      unidad:        document.getElementById('iUnidad').value.trim(),
      id_categoria:  document.getElementById('iCat').value,
      precio_unitario: parseFloat(document.getElementById('iPrecio').value) || 0
    });
    hideModal(); toast('Insumo actualizado');
    _insumos = await api.get('/api/insumos');
    filterInsumos();
    // Reset alertas para reflejar el cambio
    const cont = document.getElementById('alertasContent');
    if (cont) delete cont.dataset.loaded;
  } catch(e) { toast(e.error||'Error', 'error'); }
}

async function modalHistorial(id, desc) {
  try {
    const hist = await api.get(`/api/insumos/${id}/historial`);
    showModal(`HISTORIAL DE PRECIOS — ${desc}`, !hist.length
      ? `<div class="empty-state" style="padding:30px"><div>Sin cambios de precio registrados</div></div>
         <div class="form-actions"><button class="btn btn-secondary" onclick="hideModal()">Cerrar</button></div>`
      : `<div class="table-wrap">
          <table>
            <thead><tr><th>Fecha</th><th style="text-align:right">Precio Anterior</th><th style="text-align:right">Precio Nuevo</th><th style="text-align:right">Variación</th></tr></thead>
            <tbody>
              ${hist.map(h => {
                const diff = (h.precio_nuevo - h.precio_anterior);
                const pct  = h.precio_anterior > 0 ? (diff/h.precio_anterior*100).toFixed(1) : '—';
                return `<tr>
                  <td style="font-size:12px">${h.fecha_cambio||'—'}</td>
                  <td class="td-monto">L ${fmt(h.precio_anterior)}</td>
                  <td class="td-monto" style="color:var(--blue)">L ${fmt(h.precio_nuevo)}</td>
                  <td style="text-align:right; color:${diff>=0?'var(--red,#e53e3e)':'var(--green,#38a169)'}; font-weight:600">
                    ${diff>=0?'+':''}${fmt(diff)} (${pct}%)
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div class="form-actions"><button class="btn btn-secondary" onclick="hideModal()">Cerrar</button></div>`);
  } catch(e) { toast('Error cargando historial', 'error'); }
}
