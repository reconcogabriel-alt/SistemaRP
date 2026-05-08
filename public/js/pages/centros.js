// ═══════════════════════════════════════════════════════════════
//  CENTROS DE COSTO — página completa
// ═══════════════════════════════════════════════════════════════

let _centroActual = null;   // centro abierto en edición de precios
let _insumosCentro = [];    // caché de insumos con precios del centro
let _filtroCategoria = '';
let _filtroBusqueda  = '';

// ─── RENDER LISTA DE CENTROS ──────────────────────────────────
async function renderCentros() {
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Centro de Costos</div>
        <div class="page-subtitle">Listas de precios diferenciadas por zona o condición de mercado</div>
      </div>
      <button class="btn btn-orange" onclick="modalNuevoCentro()">+ Nuevo Centro</button>
    </div>
    <div class="page-body">
      <div id="centros-grid" class="centros-grid">
        <div class="loading-spinner"></div>
      </div>
    </div>`;
  await cargarCentros();
}

async function cargarCentros() {
  const grid = document.getElementById('centros-grid');
  if (!grid) return;
  try {
    const centros = await api.get('/api/centros');
    if (!centros.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;padding:60px 20px">
          <div class="empty-icon">🏗</div>
          <div class="empty-title">Sin centros de costo</div>
          <div class="empty-desc">Crea un centro para manejar listas de precios diferenciadas por zona o ubicación.</div>
          <button class="btn btn-orange" style="margin-top:16px" onclick="modalNuevoCentro()">+ Crear primer centro</button>
        </div>`;
      return;
    }
    grid.innerHTML = centros.map(c => `
      <div class="centro-card ${!c.activo ? 'inactivo' : ''}">
        <div class="centro-card-header">
          <div class="centro-icon">📍</div>
          <div style="flex:1;min-width:0">
            <div class="centro-nombre">${sanitize(c.nombre)}</div>
            ${c.zona ? `<div class="centro-zona">${sanitize(c.zona)}</div>` : ''}
          </div>
          ${!c.activo ? '<span class="badge" style="background:#fee2e2;color:#991b1b;font-size:10px">Inactivo</span>' : ''}
        </div>
        ${c.descripcion ? `<div class="centro-desc">${sanitize(c.descripcion)}</div>` : ''}
        <div class="centro-stats">
          <span class="stat-pill">
            <span style="font-weight:700;color:var(--blue)">${c.total_precios}</span>
            insumo${c.total_precios !== 1 ? 's' : ''} con precio propio
          </span>
        </div>
        <div class="centro-actions">
          <button class="btn btn-secondary btn-sm" onclick="verCentroPrecios(${c.id_centro}, '${sanitize(c.nombre).replace(/'/g,"\\'")}')"
            style="flex:1">✏️ Editar precios</button>
          <button class="btn btn-secondary btn-sm btn-icon" onclick="modalEditarCentro(${c.id_centro})" title="Editar datos">⚙</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="eliminarCentro(${c.id_centro}, '${sanitize(c.nombre).replace(/'/g,"\\'")}')" title="Eliminar">✕</button>
        </div>
      </div>`).join('');
  } catch(e) { grid.innerHTML = `<p style="color:red;padding:20px">${e.error||e}</p>`; }
}

// ─── VER / EDITAR PRECIOS DE UN CENTRO ───────────────────────
async function verCentroPrecios(centroId, centroNombre) {
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="breadcrumb">
          <a onclick="renderCentros()" style="cursor:pointer">Centros de Costo</a> → ${sanitize(centroNombre)}
        </div>
        <div class="page-title">${sanitize(centroNombre)}</div>
        <div class="page-subtitle">Precios propios de este centro — L 0 significa que se usa el precio base del catálogo</div>
      </div>
      <div class="btn-group">
        <button class="btn btn-secondary btn-sm" onclick="renderCentros()">← Volver</button>
        <button class="btn btn-orange btn-sm" id="btnGuardarCentro" onclick="guardarPreciosMasivo(${centroId})">💾 Guardar cambios</button>
      </div>
    </div>
    <div class="page-body">
      <!-- Filtros -->
      <div class="card" style="margin-bottom:12px;padding:12px 16px">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <input type="text" id="filtroBusq" placeholder="🔍 Buscar insumo..." style="width:220px"
            oninput="filtrarInsumosCentro()">
          <select id="filtrocat" onchange="filtrarInsumosCentro()" style="width:180px">
            <option value="">Todas las categorías</option>
          </select>
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
            <input type="checkbox" id="soloConPrecio" onchange="filtrarInsumosCentro()">
            Solo con precio propio
          </label>
          <span id="contadorVisible" style="font-size:12px;color:var(--text-muted);margin-left:auto"></span>
        </div>
      </div>
      <!-- Tabla -->
      <div class="card">
        <div class="table-wrap">
          <table id="tablaCentroPrecios">
            <thead><tr>
              <th style="width:110px">Código</th>
              <th>Descripción</th>
              <th style="width:65px">Unidad</th>
              <th style="width:100px;text-align:right">Precio Base</th>
              <th style="width:130px;text-align:right">Precio Centro</th>
              <th style="width:90px;text-align:right">Diferencia</th>
            </tr></thead>
            <tbody id="tbodyCentro">
              <tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted)">Cargando...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

  _centroActual = { id: centroId, nombre: centroNombre };
  await cargarInsumosCentro(centroId);
}

async function cargarInsumosCentro(centroId) {
  try {
    const data = await api.get(`/api/centros/${centroId}/insumos-completo`);
    _insumosCentro = data;

    // Poblar selector de categorías
    const cats = [...new Set(data.map(i => i.categoria))].sort();
    const sel = document.getElementById('filtrocat');
    if (sel) {
      sel.innerHTML = '<option value="">Todas las categorías</option>' +
        cats.map(c => `<option value="${c}">${c}</option>`).join('');
    }
    filtrarInsumosCentro();
  } catch(e) { toast('Error cargando insumos: ' + (e.error||e), 'error'); }
}

function filtrarInsumosCentro() {
  const busq  = (document.getElementById('filtroBusq')?.value || '').toLowerCase();
  const cat   = document.getElementById('filtrocat')?.value || '';
  const soloP = document.getElementById('soloConPrecio')?.checked;

  const filtrados = _insumosCentro.filter(i => {
    if (cat && i.categoria !== cat) return false;
    if (soloP && !i.precio_centro) return false;
    if (busq && !i.descripcion.toLowerCase().includes(busq) && !i.codigo.toLowerCase().includes(busq)) return false;
    return true;
  });

  const tbody = document.getElementById('tbodyCentro');
  const contador = document.getElementById('contadorVisible');
  if (contador) contador.textContent = `${filtrados.length} insumos`;

  if (!filtrados.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted)">Sin resultados</td></tr>`;
    return;
  }

  tbody.innerHTML = filtrados.map(i => {
    const pBase   = Number(i.precio_base  || 0);
    const pCentro = Number(i.precio_centro || 0);
    const diff    = pCentro > 0 ? pCentro - pBase : 0;
    const diffPct = pBase > 0 && pCentro > 0 ? ((pCentro - pBase) / pBase * 100) : 0;
    const diffColor = diff > 0 ? '#c05621' : diff < 0 ? '#276749' : '#888';
    const diffText  = pCentro > 0
      ? `<span style="color:${diffColor};font-size:11px">${diff >= 0 ? '+' : ''}${diff.toFixed(2)}<br>(${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(1)}%)</span>`
      : '<span style="color:#ccc;font-size:11px">—</span>';

    return `<tr data-id="${i.id_insumo}">
      <td style="font-family:monospace;color:var(--blue);font-size:11px">${sanitize(i.codigo||'')}</td>
      <td style="font-size:13px">${sanitize(i.descripcion)}</td>
      <td style="text-align:center"><span class="badge badge-blue" style="font-size:10px">${i.unidad}</span></td>
      <td style="text-align:right;color:var(--text-muted);font-size:12px">L ${fmt(pBase)}</td>
      <td style="text-align:right;padding:4px 8px">
        <input type="number" min="0" step="0.01"
          class="precio-centro-input"
          data-insumo="${i.id_insumo}"
          value="${pCentro > 0 ? pCentro : ''}"
          placeholder="${fmt(pBase)}"
          style="width:110px;text-align:right;border:1px solid #cce0f5;border-radius:4px;
                 padding:4px 8px;font-size:12px;background:${pCentro > 0 ? '#f0f7ff' : '#fafafa'};
                 color:var(--blue-dark)"
          oninput="marcarCambio(this)"
          onfocus="this.style.borderColor='#025196';this.style.background='#fff'"
          onblur="this.style.borderColor='#cce0f5';this.style.background=this.value?'#f0f7ff':'#fafafa'">
      </td>
      <td style="text-align:right">${diffText}</td>
    </tr>`;
  }).join('');
}

function marcarCambio(input) {
  // Actualizar la diferencia en tiempo real
  const tr = input.closest('tr');
  if (!tr) return;
  const id = parseInt(tr.dataset.id);
  const ins = _insumosCentro.find(i => i.id_insumo === id);
  if (!ins) return;
  const pBase   = Number(ins.precio_base || 0);
  const pCentro = parseFloat(input.value) || 0;
  const diff    = pCentro > 0 ? pCentro - pBase : 0;
  const diffPct = pBase > 0 && pCentro > 0 ? ((pCentro - pBase) / pBase * 100) : 0;
  const diffColor = diff > 0 ? '#c05621' : diff < 0 ? '#276749' : '#888';
  const diffCell = tr.cells[5];
  if (diffCell) {
    diffCell.innerHTML = pCentro > 0
      ? `<span style="color:${diffColor};font-size:11px">${diff >= 0 ? '+' : ''}${diff.toFixed(2)}<br>(${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(1)}%)</span>`
      : '<span style="color:#ccc;font-size:11px">—</span>';
  }
  // Indicador visual de cambio pendiente
  input.style.borderColor = '#f59e0b';
}

async function guardarPreciosMasivo(centroId) {
  const btn = document.getElementById('btnGuardarCentro');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; }

  const inputs = document.querySelectorAll('.precio-centro-input');
  const precios = [];
  inputs.forEach(inp => {
    const id_insumo = parseInt(inp.dataset.insumo);
    const val = inp.value.trim();
    // Si está vacío, manda 0 para borrar el precio del centro
    precios.push({ id_insumo, precio_unitario: val === '' ? 0 : parseFloat(val) });
  });

  try {
    const r = await api.post(`/api/centros/${centroId}/precios-masivo`, { precios });
    toast(`${r.actualizados} precios guardados ✓`, 'success');
    // Recargar para actualizar diferencias y caché
    await cargarInsumosCentro(centroId);
    if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar cambios'; }
  } catch(e) {
    toast(e.error || 'Error guardando', 'error');
    if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar cambios'; }
  }
}

// ─── MODALES CRUD CENTRO ──────────────────────────────────────
function modalNuevoCentro() {
  showModal('NUEVO CENTRO DE COSTO', `
    <div class="form-grid">
      <div class="form-group" style="grid-column:span 2">
        <label class="form-label">Nombre del centro *</label>
        <input type="text" id="cNombre" placeholder="Ej: Zona Sur — Choluteca, Zona Norte — Cortés">
      </div>
      <div class="form-group">
        <label class="form-label">Zona / Región</label>
        <input type="text" id="cZona" placeholder="Ej: Choluteca, Comayagua">
      </div>
      <div class="form-group">
        <label class="form-label">Descripción</label>
        <input type="text" id="cDesc" placeholder="Descripción opcional">
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-orange" onclick="guardarNuevoCentro()">Crear Centro</button>
    </div>`);
  setTimeout(() => document.getElementById('cNombre')?.focus(), 80);
}

async function guardarNuevoCentro() {
  const nombre = document.getElementById('cNombre')?.value?.trim();
  if (!nombre) { toast('El nombre es requerido', 'error'); return; }
  try {
    await api.post('/api/centros', {
      nombre,
      zona: document.getElementById('cZona')?.value?.trim() || '',
      descripcion: document.getElementById('cDesc')?.value?.trim() || ''
    });
    hideModal();
    toast('Centro creado ✓');
    await cargarCentros();
  } catch(e) { toast(e.error || 'Error', 'error'); }
}

async function modalEditarCentro(centroId) {
  try {
    const d = await api.get(`/api/centros/${centroId}`);
    showModal('EDITAR CENTRO', `
      <div class="form-grid">
        <div class="form-group" style="grid-column:span 2">
          <label class="form-label">Nombre *</label>
          <input type="text" id="cNombreE" value="${sanitize(d.nombre)}">
        </div>
        <div class="form-group">
          <label class="form-label">Zona / Región</label>
          <input type="text" id="cZonaE" value="${sanitize(d.zona||'')}">
        </div>
        <div class="form-group">
          <label class="form-label">Descripción</label>
          <input type="text" id="cDescE" value="${sanitize(d.descripcion||'')}">
        </div>
        <div class="form-group">
          <label class="form-label">Estado</label>
          <select id="cActivoE">
            <option value="1" ${d.activo ? 'selected' : ''}>Activo</option>
            <option value="0" ${!d.activo ? 'selected' : ''}>Inactivo</option>
          </select>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
        <button class="btn btn-orange" onclick="guardarEditarCentro(${centroId})">Guardar</button>
      </div>`);
  } catch(e) { toast(e.error || 'Error', 'error'); }
}

async function guardarEditarCentro(centroId) {
  const nombre = document.getElementById('cNombreE')?.value?.trim();
  if (!nombre) { toast('El nombre es requerido', 'error'); return; }
  try {
    await api.put(`/api/centros/${centroId}`, {
      nombre,
      zona: document.getElementById('cZonaE')?.value?.trim() || '',
      descripcion: document.getElementById('cDescE')?.value?.trim() || '',
      activo: parseInt(document.getElementById('cActivoE')?.value) || 1
    });
    hideModal();
    toast('Centro actualizado ✓');
    await cargarCentros();
  } catch(e) { toast(e.error || 'Error', 'error'); }
}

async function eliminarCentro(centroId, nombre) {
  if (!confirm(`¿Eliminar el centro "${nombre}"?\nSe borrarán todos sus precios asignados.`)) return;
  try {
    await api.del(`/api/centros/${centroId}`);
    toast('Centro eliminado');
    await cargarCentros();
  } catch(e) { toast(e.error || 'No se puede eliminar', 'error'); }
}

// ─── CSS PROPIO DEL MÓDULO (inyectado una sola vez) ──────────
(function injectCentrosCss() {
  if (document.getElementById('css-centros')) return;
  const s = document.createElement('style');
  s.id = 'css-centros';
  s.textContent = `
    .centros-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
      gap: 16px;
    }
    .centro-card {
      background: var(--white);
      border: 1px solid var(--gray-light);
      border-radius: 10px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      transition: box-shadow 0.15s;
    }
    .centro-card:hover { box-shadow: 0 4px 16px rgba(2,81,150,0.10); }
    .centro-card.inactivo { opacity: 0.6; }
    .centro-card-header { display: flex; align-items: flex-start; gap: 10px; }
    .centro-icon { font-size: 24px; line-height: 1; }
    .centro-nombre { font-weight: 700; font-size: 15px; color: var(--blue-dark); line-height: 1.2; }
    .centro-zona { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
    .centro-desc { font-size: 12px; color: var(--text-secondary); }
    .centro-stats { margin-top: 2px; }
    .stat-pill {
      display: inline-block;
      background: #e8f0fb;
      color: #025196;
      border-radius: 20px;
      padding: 3px 12px;
      font-size: 12px;
    }
    .centro-actions { display: flex; gap: 6px; margin-top: 4px; }
  `;
  document.head.appendChild(s);
})();
