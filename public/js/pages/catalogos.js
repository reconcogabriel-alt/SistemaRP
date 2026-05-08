// ═══════════════════════════════════════════════════════════════
// CATÁLOGOS DE PRECIOS — por proyecto / región
// ═══════════════════════════════════════════════════════════════
let _catalogos = [];
let _catActual = null;   // { catalogo, insumos }
let _catInsumos = [];    // insumos del catálogo abierto
let _catSearchTimer = null;

async function renderCatalogos() {
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">CATÁLOGOS DE PRECIOS</div>
        <div class="page-subtitle">Precios de insumos por proyecto, región o ubicación</div>
      </div>
      <button class="btn btn-orange" onclick="modalNuevoCatalogo()">+ Nuevo Catálogo</button>
    </div>
    <div class="page-body">
      <div id="catListWrap"><div class="loading"><div class="spinner"></div></div></div>
    </div>`;
  await cargarCatalogos();
}

async function cargarCatalogos() {
  try {
    _catalogos = await api.get('/api/catalogos');
    renderListaCatalogos();
  } catch(e) { document.getElementById('catListWrap').innerHTML = `<div class="empty-state">Error: ${e.error||e}</div>`; }
}

function renderListaCatalogos() {
  const wrap = document.getElementById('catListWrap');
  if (!wrap) return;

  wrap.innerHTML = `
    <!-- Explicación -->
    <div style="background:#e8f4fd; border-left:4px solid var(--blue); padding:14px 18px;
         border-radius:0 6px 6px 0; margin-bottom:20px; font-size:13px">
      <div style="font-weight:700; color:var(--blue); margin-bottom:6px">¿Para qué sirven los catálogos?</div>
      <div style="color:var(--text-muted); line-height:1.7">
        Cada catálogo tiene sus propios precios de insumos según la zona del proyecto.
        Por ejemplo: un proyecto en <strong>Choluteca</strong> puede tener precios de arena y grava
        diferentes a <strong>Tegucigalpa</strong> por el flete. Al asignar un catálogo a un proyecto,
        todos los costos unitarios se calculan con esos precios locales.<br>
        Si un insumo no tiene precio local, se usa el <strong>precio base (CHICO Nacional)</strong>.
      </div>
    </div>

    <!-- Grid de catálogos -->
    <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:16px">
      ${_catalogos.map(c => `
        <div class="card" style="border-top:3px solid ${c.es_base ? 'var(--blue)' : 'var(--orange)'}">
          <div class="card-body" style="padding:16px">

            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px">
              <div>
                ${c.es_base ? '<span class="badge badge-blue" style="font-size:10px; margin-bottom:4px">BASE</span><br>' : ''}
                <div style="font-family:\'Barlow Condensed\',sans-serif; font-size:19px; font-weight:700; color:var(--blue)">${sanitize(c.nombre)}</div>
              </div>
              ${!c.es_base ? `
              <div class="btn-group">
                <button class="btn btn-secondary btn-sm btn-icon" onclick="modalEditarCatalogo(${c.id_catalogo})" title="Editar">✎</button>
                <button class="btn btn-danger btn-sm btn-icon" onclick="eliminarCatalogo(${c.id_catalogo},'${sanitize(c.nombre)}')" title="Eliminar">✕</button>
              </div>` : ''}
            </div>

            <div style="font-size:12px; color:var(--text-muted); margin-bottom:4px">📍 ${sanitize(c.ubicacion||'—')}</div>
            <div style="font-size:12px; color:var(--text-muted); margin-bottom:12px">${sanitize(c.descripcion||'—')}</div>

            <div style="display:flex; justify-content:space-between; align-items:center;
                 padding:10px 12px; background:var(--gray-light); border-radius:4px; margin-bottom:12px">
              <div style="text-align:center">
                <div style="font-family:\'Barlow Condensed\',sans-serif; font-size:22px; font-weight:700; color:var(--blue)">${c.num_precios}</div>
                <div style="font-size:10px; color:var(--text-muted)">precios locales</div>
              </div>
              <div style="text-align:center">
                <div style="font-family:\'Barlow Condensed\',sans-serif; font-size:22px; font-weight:700; color:var(--text-muted)">1,799</div>
                <div style="font-size:10px; color:var(--text-muted)">insumos totales</div>
              </div>
              <div style="text-align:center">
                <div style="font-family:\'Barlow Condensed\',sans-serif; font-size:22px; font-weight:700;
                     color:${c.num_precios>0?'var(--green,#38a169)':'var(--red,#e53e3e)'}">
                  ${Math.round(c.num_precios/17.99)}%</div>
                <div style="font-size:10px; color:var(--text-muted)">cobertura</div>
              </div>
            </div>

            <div class="btn-group" style="width:100%">
              <button class="btn btn-primary btn-sm" style="flex:1" onclick="abrirCatalogo(${c.id_catalogo})">
                ✎ Editar precios
              </button>
              <button class="btn btn-secondary btn-sm" onclick="descargarCotizacionCat(${c.id_catalogo},'sin_precio')" title="Descargar lista sin precio para cotizar">
                📥 Cotización
              </button>
              ${!c.es_base ? `
              <button class="btn btn-secondary btn-sm" onclick="modalAsignarProyecto(${c.id_catalogo},'${sanitize(c.nombre)}')" title="Asignar a proyecto">
                🏗 Proyectos
              </button>` : ''}
            </div>
          </div>
        </div>`).join('')}
    </div>`;
}

// ─── ABRIR CATÁLOGO PARA EDITAR PRECIOS ──────────────────────
async function abrirCatalogo(id) {
  const el = document.getElementById('pageContent');
  el.innerHTML = `<div class="page-body"><div class="loading"><div class="spinner"></div> Cargando catálogo...</div></div>`;
  try {
    const data = await api.get(`/api/catalogos/${id}`);
    _catActual = data;
    _catInsumos = data.insumos;
    renderEditorCatalogo(data);
  } catch(e) { toast('Error cargando catálogo', 'error'); renderCatalogos(); }
}

function renderEditorCatalogo(data) {
  const { catalogo, insumos } = data;
  const conLocal = insumos.filter(i => i.tiene_precio_local).length;
  const el = document.getElementById('pageContent');

  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="breadcrumb"><a onclick="renderCatalogos()">Catálogos</a> → ${sanitize(catalogo.nombre)}</div>
        <div class="page-title">${sanitize(catalogo.nombre)}</div>
        <div class="page-subtitle">📍 ${sanitize(catalogo.ubicacion||'—')} — ${conLocal} precios locales de ${insumos.length}</div>
      </div>
      <div class="btn-group">
        <button class="btn btn-secondary" onclick="renderCatalogos()">← Catálogos</button>
        <button class="btn btn-secondary" onclick="descargarCotizacionCat(${catalogo.id_catalogo},'sin_precio')">📥 Cotización sin precio</button>
        <button class="btn btn-secondary" onclick="descargarCotizacionCat(${catalogo.id_catalogo},'todos')">📥 Catálogo completo</button>
      </div>
    </div>
    <div class="page-body">

      <!-- Buscador -->
      <div class="toolbar" style="margin-bottom:12px">
        <div class="search-box" style="flex:1; max-width:400px; position:relative">
          <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted)">🔍</span>
          <input type="text" id="catSearch"
            placeholder="Código o descripción del insumo..."
            oninput="filtrarCatInsumos()"
            style="padding-left:34px; width:100%">
        </div>
        <select id="catFiltroTipo" onchange="filtrarCatInsumos()" class="filter-select">
          <option value="">Todos</option>
          <option value="local">Con precio local</option>
          <option value="base">Solo precio base</option>
          <option value="sin">Sin ningún precio</option>
        </select>
        <select id="catFiltroCat" onchange="filtrarCatInsumos()" class="filter-select">
          <option value="">Todas las categorías</option>
        </select>
        <span id="catContador" style="font-size:12px; color:var(--text-muted); white-space:nowrap"></span>
      </div>

      <div class="card">

        <!-- Leyenda -->
        <div style="padding:10px 16px; border-bottom:1px solid var(--gray-light); display:flex; gap:20px; flex-wrap:wrap; font-size:11px; color:var(--text-muted)">
          <span>🔵 Precio local = precio específico de este catálogo</span>
          <span>⬜ Precio base = hereda de CHICO Nacional</span>
          <span>🔴 Sin precio = no tiene precio en ningún catálogo</span>
          <span style="margin-left:auto; color:var(--blue); font-weight:600">
            Haz clic en el precio para editarlo directamente
          </span>
        </div>

        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>Código</th>
              <th>Descripción</th>
              <th>Unidad</th>
              <th>Categoría</th>
              <th style="text-align:right">P. Base (L)</th>
              <th style="text-align:right; background:rgba(2,81,150,0.06)">P. Local (L)</th>
              <th style="text-align:right">P. Efectivo</th>
              <th style="width:90px; text-align:center">Acciones</th>
            </tr></thead>
            <tbody id="catTablaBody">
              <tr><td colspan="8"><div class="loading"><div class="spinner"></div></div></td></tr>
            </tbody>
          </table>
        </div>
        <div id="catPagerInfo" style="padding:8px 16px; font-size:11px; color:var(--text-muted); border-top:1px solid var(--gray-light)"></div>
      </div>
    </div>`;

  // Llenar filtro categorías
  const cats = [...new Set(insumos.map(i => i.categoria))].sort();
  const selCat = document.getElementById('catFiltroCat');
  if (selCat) cats.forEach(c => selCat.innerHTML += `<option value="${c}">${c}</option>`);

  filtrarCatInsumos();
}

function filtrarCatInsumos() {
  const q    = (document.getElementById('catSearch')?.value || '').toLowerCase();
  const tipo = document.getElementById('catFiltroTipo')?.value || '';
  const cat  = document.getElementById('catFiltroCat')?.value  || '';

  const filtered = _catInsumos.filter(i => {
    const matchQ = !q || i.descripcion.toLowerCase().includes(q) || (i.codigo||'').toLowerCase().includes(q);
    const matchC = !cat || i.categoria === cat;
    const matchT = !tipo
      || (tipo === 'local' && i.tiene_precio_local)
      || (tipo === 'base'  && !i.tiene_precio_local && i.precio_base > 0)
      || (tipo === 'sin'   && !i.tiene_precio_local && !i.precio_base);
    return matchQ && matchC && matchT;
  });

  const cnt = document.getElementById('catContador');
  if (cnt) cnt.textContent = `${filtered.length.toLocaleString()} insumos`;

  renderCatTabla(filtered);
}

function renderCatTabla(lista) {
  const tbody = document.getElementById('catTablaBody');
  const pager = document.getElementById('catPagerInfo');
  if (!tbody) return;

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state" style="padding:30px"><div class="empty-icon">◌</div><div class="empty-title">Sin resultados</div></div></td></tr>`;
    if (pager) pager.textContent = '';
    return;
  }

  // Mostrar hasta 200 filas
  const MAX = 200;
  const show = lista.slice(0, MAX);
  if (pager) pager.textContent = lista.length > MAX
    ? `Mostrando ${MAX} de ${lista.length.toLocaleString()} — afina la búsqueda para ver más`
    : `${lista.length.toLocaleString()} insumos`;

  tbody.innerHTML = show.map(i => {
    const pEfectivo = i.tiene_precio_local ? i.precio_catalogo : i.precio_base;
    const sinPrecio = pEfectivo === 0 || pEfectivo === null;
    const esLocal   = i.tiene_precio_local && i.precio_catalogo > 0;
    const soloBase  = !i.tiene_precio_local && i.precio_base > 0;

    return `<tr style="${esLocal ? 'background:rgba(2,81,150,0.04)' : ''}">
      <td class="td-code" style="font-size:11px">${sanitize(i.codigo||'—')}</td>
      <td style="font-size:12px">${sanitize(i.descripcion)}</td>
      <td><span class="badge badge-blue" style="font-size:10px">${i.unidad}</span></td>
      <td style="font-size:11px; color:var(--text-muted)">${i.categoria}</td>
      <td style="text-align:right; font-size:12px; color:var(--text-muted)">
        ${i.precio_base > 0 ? 'L ' + fmt(i.precio_base) : '<span style="color:#aaa">—</span>'}
      </td>
      <td style="text-align:right; background:rgba(2,81,150,0.04)">
        ${esLocal
          ? `<span style="font-family:'Barlow Condensed',sans-serif; font-size:14px; font-weight:700; color:var(--blue); cursor:pointer"
               onclick="editarPrecioLocal(${i.id_insumo},'${sanitize(i.descripcion)}','${i.unidad}',${i.precio_catalogo})">
               L ${fmt(i.precio_catalogo)} ✎</span>`
          : `<button class="btn btn-orange btn-sm" style="font-size:10px; padding:3px 8px"
               onclick="editarPrecioLocal(${i.id_insumo},'${sanitize(i.descripcion)}','${i.unidad}',0)">
               + Precio local</button>`}
      </td>
      <td style="text-align:right">
        ${sinPrecio
          ? `<span style="color:var(--red,#e53e3e); font-size:11px; font-weight:700">⚠ SIN PRECIO</span>`
          : `<span style="font-family:'Barlow Condensed',sans-serif; font-size:14px; font-weight:700;
               color:${esLocal?'var(--blue)':'var(--green,#38a169)'}">L ${fmt(pEfectivo)}</span>
             <span style="font-size:9px; color:var(--text-muted)"> ${esLocal?'🔵local':'⬜base'}</span>`}
      </td>
      <td style="text-align:center">
        ${esLocal ? `<button class="btn btn-danger btn-sm btn-icon" title="Quitar precio local → usar base"
          onclick="quitarPrecioLocal(${i.id_insumo},'${sanitize(i.descripcion)}')">✕</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

// ─── EDITAR PRECIO LOCAL ─────────────────────────────────────
function editarPrecioLocal(idInsumo, desc, unidad, precioActual) {
  const cat = _catActual?.catalogo;
  showModal(`PRECIO LOCAL — ${desc}`, `
    <div style="margin-bottom:14px; padding:10px 14px; background:rgba(2,81,150,0.05);
         border-left:3px solid var(--blue); border-radius:0 4px 4px 0; font-size:12px">
      <strong style="color:var(--blue)">${sanitize(cat?.nombre||'')}</strong>
      <span style="color:var(--text-muted)"> · ${sanitize(cat?.ubicacion||'')}</span><br>
      <span style="color:var(--text-muted)">Insumo: </span><strong>${sanitize(desc)}</strong> (${unidad})
    </div>
    <div class="form-grid form-grid-2">
      <div class="form-group" style="grid-column:span 2">
        <label class="form-label">Precio Local (L) *</label>
        <input type="number" id="precioLocal" value="${precioActual||''}"
          placeholder="0.00" step="0.01" min="0"
          style="font-size:22px; font-weight:700; text-align:right" autofocus>
        ${precioActual > 0
          ? `<div style="font-size:11px; color:var(--text-muted); margin-top:4px">Precio actual: <strong>L ${fmt(precioActual)}</strong></div>`
          : `<div style="font-size:11px; color:var(--text-muted); margin-top:4px">Sin precio local — heredará precio base si se deja vacío</div>`}
      </div>
      <div class="form-group" style="grid-column:span 2">
        <label class="form-label">Fuente / Referencia</label>
        <input type="text" id="fuenteLocal" placeholder="Ej: Ferretería EPA Choluteca, cotización 04/2026">
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-orange" onclick="guardarPrecioLocal(${idInsumo})">Guardar</button>
    </div>`);
  setTimeout(() => {
    const inp = document.getElementById('precioLocal');
    inp?.focus(); inp?.select();
  }, 60);
}

async function guardarPrecioLocal(idInsumo) {
  const precio = parseFloat(document.getElementById('precioLocal').value);
  if (isNaN(precio) || precio < 0) { toast('Precio inválido', 'error'); return; }
  const fuente = document.getElementById('fuenteLocal').value.trim();
  try {
    await api.put(`/api/catalogos/${_catActual.catalogo.id_catalogo}/insumos/${idInsumo}`, {
      precio_unitario: precio,
      fuente: fuente || 'Manual'
    });
    hideModal();
    // Actualizar en memoria sin recargar toda la página
    const ins = _catInsumos.find(i => i.id_insumo == idInsumo);
    if (ins) {
      ins.precio_catalogo = precio;
      ins.tiene_precio_local = precio > 0 ? 1 : 0;
      ins.precio_efectivo = precio > 0 ? precio : ins.precio_base;
    }
    filtrarCatInsumos();
    toast(`Precio L ${fmt(precio)} guardado ✓`);
  } catch(e) { toast(e.error||'Error', 'error'); }
}

async function quitarPrecioLocal(idInsumo, desc) {
  if (!confirm(`¿Quitar precio local de "${desc}"? El insumo usará el precio base (CHICO Nacional).`)) return;
  try {
    await api.del(`/api/catalogos/${_catActual.catalogo.id_catalogo}/insumos/${idInsumo}`);
    const ins = _catInsumos.find(i => i.id_insumo == idInsumo);
    if (ins) { ins.precio_catalogo = 0; ins.tiene_precio_local = 0; ins.precio_efectivo = ins.precio_base; }
    filtrarCatInsumos();
    toast('Precio local eliminado — se usa precio base');
  } catch(e) { toast(e.error||'Error', 'error'); }
}

// ─── CREAR CATÁLOGO ───────────────────────────────────────────
function modalNuevoCatalogo() {
  showModal('NUEVO CATÁLOGO DE PRECIOS', `
    <div class="form-grid">
      <div class="form-group" style="grid-column:span 2">
        <label class="form-label">Nombre del Catálogo *</label>
        <input type="text" id="catNombre" placeholder="Ej: Choluteca / Sur, San Marcos de Colón" autofocus>
      </div>
      <div class="form-group" style="grid-column:span 2">
        <label class="form-label">Ubicación / Zona</label>
        <input type="text" id="catUbicacion" placeholder="Ej: Choluteca, Choluteca — Zona Sur">
      </div>
      <div class="form-group" style="grid-column:span 2">
        <label class="form-label">Descripción</label>
        <input type="text" id="catDesc" placeholder="Ej: Precios ajustados por flete zona sur">
      </div>
      <div class="form-group" style="grid-column:span 2">
        <label class="form-label">Clonar precios de</label>
        <select id="catClonar">
          <option value="">Iniciar vacío (heredar todo del catálogo base)</option>
          ${_catalogos.map(c => `<option value="${c.id_catalogo}">${c.nombre} (${c.num_precios} precios)</option>`).join('')}
        </select>
        <div style="font-size:11px; color:var(--text-muted); margin-top:4px">
          Clonar copia todos los precios locales del catálogo seleccionado como punto de partida
        </div>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-orange" onclick="crearCatalogo()">Crear Catálogo</button>
    </div>`);
  setTimeout(() => document.getElementById('catNombre')?.focus(), 60);
}

async function crearCatalogo() {
  const nombre = document.getElementById('catNombre').value.trim();
  if (!nombre) { toast('Nombre requerido', 'error'); return; }
  try {
    await api.post('/api/catalogos', {
      nombre,
      ubicacion:   document.getElementById('catUbicacion').value.trim(),
      descripcion: document.getElementById('catDesc').value.trim(),
      clonar_de:   document.getElementById('catClonar').value || null
    });
    hideModal();
    toast('Catálogo creado ✓');
    await cargarCatalogos();
  } catch(e) { toast(e.error||'Error', 'error'); }
}

async function modalEditarCatalogo(id) {
  const c = _catalogos.find(x => x.id_catalogo == id);
  if (!c) return;
  showModal('EDITAR CATÁLOGO', `
    <div class="form-grid">
      <div class="form-group" style="grid-column:span 2">
        <label class="form-label">Nombre *</label>
        <input type="text" id="catNombre" value="${sanitize(c.nombre)}">
      </div>
      <div class="form-group" style="grid-column:span 2">
        <label class="form-label">Ubicación</label>
        <input type="text" id="catUbicacion" value="${sanitize(c.ubicacion||'')}">
      </div>
      <div class="form-group" style="grid-column:span 2">
        <label class="form-label">Descripción</label>
        <input type="text" id="catDesc" value="${sanitize(c.descripcion||'')}">
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="actualizarCatalogo(${id})">Actualizar</button>
    </div>`);
}

async function actualizarCatalogo(id) {
  try {
    await api.put(`/api/catalogos/${id}`, {
      nombre:      document.getElementById('catNombre').value.trim(),
      ubicacion:   document.getElementById('catUbicacion').value.trim(),
      descripcion: document.getElementById('catDesc').value.trim()
    });
    hideModal(); toast('Catálogo actualizado');
    await cargarCatalogos();
  } catch(e) { toast(e.error||'Error', 'error'); }
}

async function eliminarCatalogo(id, nombre) {
  if (!confirm(`¿Eliminar catálogo "${nombre}"?\nSe eliminarán todos sus precios locales.`)) return;
  try {
    await api.del(`/api/catalogos/${id}`);
    toast('Catálogo eliminado');
    await cargarCatalogos();
  } catch(e) { toast(e.error||'Error al eliminar: '+e.error, 'error'); }
}

// ─── ASIGNAR CATÁLOGO A PROYECTO ─────────────────────────────
async function modalAsignarProyecto(idCat, nombreCat) {
  let proyectos;
  try { proyectos = await api.get('/api/proyectos'); }
  catch(e) { toast('Error cargando proyectos', 'error'); return; }

  showModal(`ASIGNAR "${nombreCat}" A PROYECTOS`, `
    <div style="margin-bottom:14px; font-size:13px; color:var(--text-muted)">
      Selecciona el proyecto y asigna este catálogo de precios. Los costos unitarios
      del presupuesto usarán los precios locales de <strong>${sanitize(nombreCat)}</strong>.
    </div>
    <div class="form-group">
      <label class="form-label">Proyecto *</label>
      <select id="proyectoAsignar" style="width:100%">
        <option value="">-- Seleccionar proyecto --</option>
        ${proyectos.map(p => `<option value="${p.id_proyecto}">${p.nombre} (${p.ubicacion||'—'})</option>`).join('')}
      </select>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-orange" onclick="asignarCatalogo(${idCat})">Asignar</button>
    </div>`);
}

async function asignarCatalogo(idCat) {
  const idProy = document.getElementById('proyectoAsignar').value;
  if (!idProy) { toast('Selecciona un proyecto', 'error'); return; }
  try {
    await api.post('/api/catalogos/asignar-proyecto', { id_proyecto: idProy, id_catalogo: idCat });
    hideModal();
    toast('Catálogo asignado al proyecto ✓');
  } catch(e) { toast(e.error||'Error', 'error'); }
}

// ─── DESCARGAR COTIZACIÓN ────────────────────────────────────
function descargarCotizacionCat(idCat, filtro) {
  window.open(`/api/catalogos/${idCat}/cotizacion-excel?filtro=${filtro}`, '_blank');
  toast(`Generando Excel de cotización...`, 'info');
}
