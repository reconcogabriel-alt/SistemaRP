// ═══════════════════════════════════════════════════════════════
// PRESUPUESTOS
// ═══════════════════════════════════════════════════════════════
let _presCtx = { idProyecto: null, nombre: null };
let _presupuestos = [];
let _presActual = null;   // { presupuesto, capitulos, partidas }

// ─── RENDER PRINCIPAL ────────────────────────────────────────
async function renderPresupuestos(ctx = {}) {
  if (ctx.idProyecto) _presCtx = { idProyecto: ctx.idProyecto, nombre: ctx.nombre };

  const el = document.getElementById('pageContent');

  if (!_presCtx.idProyecto) {
    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">PRESUPUESTOS</div>
          <div class="page-subtitle">Selecciona un proyecto</div>
        </div>
      </div>
      <div class="page-body">
        <div class="loading"><div class="spinner"></div> Cargando proyectos...</div>
      </div>`;
    try {
      const proyectos = await api.get('/api/proyectos');
      el.querySelector('.page-body').innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px">
          ${proyectos.filter(p => p.estado !== 'archivado').map(p => `
            <div class="card" style="cursor:pointer; transition:box-shadow 0.2s"
                 onclick="verPresupuestosProyecto(${p.id_proyecto}, '${sanitize(p.nombre)}')"
                 onmouseenter="this.style.boxShadow='0 4px 20px rgba(2,81,150,0.15)'"
                 onmouseleave="this.style.boxShadow=''">
              <div class="card-body">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px">
                  <span class="badge badge-${p.estado}">${p.estado}</span>
                  <span class="badge badge-blue">${p.moneda}</span>
                </div>
                <div style="font-family:'Barlow Condensed',sans-serif; font-size:18px; font-weight:700; color:var(--blue); margin-bottom:4px">${sanitize(p.nombre)}</div>
                <div style="font-size:12px; color:var(--text-muted)">${sanitize(p.cliente||'—')} · ${sanitize(p.ubicacion||'—')}</div>
                <div style="margin-top:12px; padding-top:12px; border-top:1px solid var(--gray-light); display:flex; justify-content:space-between">
                  <span style="font-size:12px; color:var(--text-muted)">${p.num_presupuestos||0} presupuesto(s)</span>
                  <span style="color:var(--blue); font-size:13px">Ver →</span>
                </div>
              </div>
            </div>`).join('')}
        </div>`;
    } catch(e) { console.error(e); }
    return;
  }

  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="breadcrumb"><a onclick="resetPresupuestos()">Proyectos</a> → ${sanitize(_presCtx.nombre||'')}</div>
        <div class="page-title">PRESUPUESTOS</div>
        <div class="page-subtitle">${sanitize(_presCtx.nombre||'')}</div>
      </div>
      <div class="btn-group">
        <button class="btn btn-secondary" onclick="resetPresupuestos()">← Proyectos</button>
        <button class="btn btn-orange" onclick="modalNuevoPresupuesto()">+ Nuevo Presupuesto</button>
      </div>
    </div>
    <div class="page-body">
      <div id="presListWrap"><div class="loading"><div class="spinner"></div></div></div>
    </div>`;
  await loadPresupuestos();
}

function resetPresupuestos() { _presCtx = { idProyecto: null }; renderPresupuestos(); }

async function verPresupuestosProyecto(id, nombre) {
  _presCtx = { idProyecto: id, nombre };
  renderPresupuestos();
}

async function loadPresupuestos() {
  try {
    _presupuestos = await api.get(`/api/presupuestos/proyecto/${_presCtx.idProyecto}`);
    const wrap = document.getElementById('presListWrap');
    if (!wrap) return;
    if (!_presupuestos.length) {
      wrap.innerHTML = `<div class="empty-state">
        <div class="empty-icon">▤</div>
        <div class="empty-title">Sin presupuestos</div>
        <div class="empty-desc">Crea el primer presupuesto para este proyecto</div>
        <button class="btn btn-orange" style="margin-top:16px" onclick="modalNuevoPresupuesto()">+ Nuevo Presupuesto</button>
      </div>`;
      return;
    }
    wrap.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:16px">
        ${_presupuestos.map(p => `
          <div class="card" style="cursor:pointer; transition:box-shadow 0.2s"
               onclick="verPresupuestoDetalle(${p.id_presupuesto})"
               onmouseenter="this.style.boxShadow='0 4px 20px rgba(2,81,150,0.15)'"
               onmouseleave="this.style.boxShadow=''">
            <div class="card-body">
              <div style="font-family:'Barlow Condensed',sans-serif; font-size:17px; font-weight:700; color:var(--blue)">${sanitize(p.nombre||'Presupuesto')}</div>
              <div style="font-size:11px; color:var(--text-muted); margin:4px 0 12px">${p.fecha_creacion?.substring(0,10)||''}</div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:12px">
                <div><div style="color:var(--text-muted)">Costos Directos</div><div style="font-weight:600">L ${fmt(p.costos_directos||0)}</div></div>
                <div><div style="color:var(--text-muted)">Indirectos</div><div style="font-weight:600">${p.porcentaje_indirectos||0}%</div></div>
              </div>
              <div style="margin-top:12px; padding-top:12px; border-top:1px solid var(--gray-light); display:flex; justify-content:space-between; align-items:center">
                <span style="font-size:12px; color:var(--text-muted)">TOTAL</span>
                <span style="font-family:'Barlow Condensed',sans-serif; font-size:20px; font-weight:700; color:var(--blue)">L ${fmt(p.total_general||0)}</span>
              </div>
            </div>
          </div>`).join('')}
      </div>`;
  } catch(e) { console.error(e); }
}

// ─── DETALLE DE PRESUPUESTO ──────────────────────────────────
async function verPresupuestoDetalle(id) {
  const el = document.getElementById('pageContent');
  el.querySelector && el.querySelector('.page-body')
    ? el.querySelector('.page-body').innerHTML = `<div class="loading"><div class="spinner"></div> Cargando...</div>`
    : null;
  try {
    const data = await api.get(`/api/presupuestos/${id}`);
    _presActual = data;
    renderDetallePres(data, id);
  } catch(e) { console.error(e); toast('Error cargando presupuesto', 'error'); }
}

function renderDetallePres(data, presId) {
  const { presupuesto: pres, capitulos, partidas } = data;
  const moneda = pres.moneda || 'L';

  // Construir mapa de capítulos con sus partidas
  const chMap = new Map();
  capitulos.forEach(c => chMap.set(c.id_capitulo, { ...c, partidas: [] }));
  const sinCap = [];
  partidas.forEach(p => {
    if (p.id_capitulo && chMap.has(p.id_capitulo)) {
      chMap.get(p.id_capitulo).partidas.push(p);
    } else {
      sinCap.push(p);
    }
  });

  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="breadcrumb">
          <a onclick="resetPresupuestos()">Proyectos</a> →
          <a onclick="verPresupuestosProyecto(${pres.id_proyecto}, '${sanitize(pres.proyecto_nombre||'')}')">
            ${sanitize(pres.proyecto_nombre||'')}
          </a> → ${sanitize(pres.nombre||'Presupuesto')}
        </div>
        <div class="page-title">${sanitize(pres.nombre||'Presupuesto')}</div>
        <div class="page-subtitle">${sanitize(pres.proyecto_nombre||'')} — ${sanitize(pres.cliente||'')}</div>
      <div style="margin-top:5px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-size:12px;color:var(--text-muted)">Centro de costos:</span>
        ${pres.id_centro_costo
          ? `<span style="background:#e8f0fb;color:#025196;border-radius:20px;padding:2px 12px;font-size:12px;font-weight:600">📍 ${sanitize(pres.centro_nombre||'')}</span>`
          : `<span style="background:#f3f4f6;color:#888;border-radius:20px;padding:2px 12px;font-size:12px">Sin centro (precios base)</span>`}
        <button class="btn btn-secondary btn-sm" style="font-size:11px;padding:3px 10px"
          onclick="modalAsignarCentro(${presId}, ${pres.id_centro_costo||'null'})">Cambiar</button>
      </div>
      </div>
      <div class="btn-group" style="flex-wrap:wrap; justify-content:flex-end">
        <button class="btn btn-secondary btn-sm" onclick="verPresupuestosProyecto(${pres.id_proyecto}, '${sanitize(pres.proyecto_nombre||'')}')">← Volver</button>
        <button class="btn btn-secondary btn-sm" onclick="modalNuevoCapitulo(${presId})">+ Capítulo</button>
        <button class="btn btn-secondary btn-sm" onclick="modalNuevaPartida(${presId})">+ Partida</button>
        <button class="btn btn-secondary btn-sm" onclick="modalPorcentajes(${presId})">% Indirectos</button>
        <button class="btn btn-secondary btn-sm" id="btnRecalcular" onclick="recalcularPresupuesto(${presId})">🔄 Recalcular</button>
        <button class="btn btn-orange btn-sm" onclick="window.open('/api/reportes/presupuesto/${presId}/excel','_blank'); toast('Generando Excel...','info')">📥 Excel</button>
      </div>
    </div>
    <div class="page-body">
      <div id="banner-insumos-cero" style="display:none; margin-bottom:12px"></div>
      <div class="card" style="margin-bottom:16px">
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th style="width:46px">No.</th>
              <th style="width:100px">Código</th>
              <th>Descripción</th>
              <th style="width:68px">Unidad</th>
              <th style="width:85px; text-align:right">Cantidad</th>
              <th style="width:110px; text-align:right">P. Unitario</th>
              <th style="width:120px; text-align:right">Subtotal</th>
              <th style="width:56px"></th>
            </tr></thead>
            <tbody id="presTableBody">
              ${buildPartidasRows(chMap, sinCap, moneda, presId)}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" style="max-width:480px; margin-left:auto">
        <div class="card-body">
          <table style="width:100%">
            <tbody>
              ${sumRow('Costos Directos', pres.costos_directos, moneda)}
              ${sumRow('Costos Indirectos ('+pres.porcentaje_indirectos+'%)', pres.costos_indirectos, moneda)}
              ${sumRow('Utilidad ('+pres.porcentaje_utilidad+'%)', pres.utilidad, moneda)}
              ${sumRow('Imprevistos ('+pres.porcentaje_imprevistos+'%)', pres.imprevistos, moneda)}
              <tr class="grand-total">
                <td style="padding:12px 14px; font-family:'Barlow Condensed',sans-serif; font-size:15px; font-weight:700; letter-spacing:1px">TOTAL GENERAL</td>
                <td style="padding:12px 14px; text-align:right; font-family:'Barlow Condensed',sans-serif; font-size:20px; font-weight:700">${moneda} ${fmt(pres.total_general)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  // Esperar que el DOM esté pintado antes de buscar el banner
  setTimeout(() => cargarInsumosCero(presId), 50);
}

function buildPartidasRows(chMap, sinCap, moneda, presId) {
  let n = 1;
  let html = '';

  // Capítulos con sus partidas
  chMap.forEach((cap, capId) => {
    const subtotal = cap.partidas.reduce((s, p) => s + p.subtotal, 0);
    html += `
      <tr class="pres-chapter">
        <td colspan="6">
          <span style="opacity:0.7; font-size:11px; margin-right:8px">${cap.orden_visual||''}.</span>
          ${sanitize(cap.nombre)}
          <span style="margin-left:12px; font-weight:400; opacity:0.8; font-size:12px">${moneda} ${fmt(subtotal)}</span>
        </td>
        <td style="text-align:right; padding-right:6px">
          <button class="btn btn-add-partida btn-sm"
            onclick="modalNuevaPartida(${presId}, ${capId})" title="Agregar partida a este capítulo"
            style="background:rgba(255,255,255,0.18); border:1px solid rgba(255,255,255,0.5);
                   color:#fff; font-size:11px; padding:3px 9px; border-radius:4px; cursor:pointer;
                   font-weight:600; letter-spacing:0.5px; white-space:nowrap">+ Partida</button>
        </td>
        <td style="text-align:center">
          <button class="btn btn-danger btn-sm btn-icon"
            onclick="eliminarCapitulo(${presId},${capId},event)" title="Eliminar capítulo">✕</button>
        </td>
      </tr>`;
    if (cap.partidas.length === 0) {
      html += `<tr><td colspan="8" style="padding:8px 14px; font-size:11px; color:var(--text-muted); font-style:italic">— Capítulo vacío. Agrega partidas y asigna este capítulo. —</td></tr>`;
    }
    cap.partidas.forEach(p => { html += rowPartida(p, n++, moneda, presId); });
  });

  // Partidas sin capítulo
  sinCap.forEach(p => { html += rowPartida(p, n++, moneda, presId); });

  if (!html) {
    html = `<tr><td colspan="8">
      <div class="empty-state" style="padding:40px">
        <div class="empty-icon">▤</div>
        <div class="empty-title">Sin partidas</div>
        <div class="empty-desc">Crea capítulos con <strong>+ Capítulo</strong>, luego agrega partidas con <strong>+ Partida</strong></div>
      </div>
    </td></tr>`;
  }
  return html;
}

function rowPartida(p, n, moneda, presId) {
  return `<tr data-partida="${p.id_partida}">
    <td style="color:var(--text-muted); font-size:11px; text-align:center">${n}</td>
    <td class="td-code">${sanitize(p.actividad_codigo||'')}</td>
    <td>${sanitize(p.actividad_desc||'')}</td>
    <td><span class="badge badge-blue" style="font-size:10px">${p.actividad_unidad||''}</span></td>
    <td class="td-monto" style="padding:4px 8px">
      <input type="number" class="qty-input" value="${p.cantidad}"
        min="0" step="any"
        style="width:80px; text-align:right; border:1px solid #cce0f5; border-radius:4px;
               padding:4px 6px; font-size:13px; font-family:inherit; background:#f0f7ff;
               color:#013a6e; font-weight:500; outline:none"
        onchange="actualizarCantidad(${presId}, ${p.id_partida}, this)"
        onfocus="this.style.borderColor='#025196'; this.style.background='#ffffff'"
        onblur="this.style.borderColor='#cce0f5'; this.style.background='#f0f7ff'">
    </td>
    <td class="td-monto">${moneda} ${fmt(p.precio_unitario)}</td>
    <td class="td-monto subtotal-cell" style="color:var(--green)">${moneda} ${fmt(p.subtotal)}</td>
    <td style="text-align:center">
      <button class="btn btn-danger btn-sm btn-icon"
        onclick="eliminarPartida(${presId},${p.id_partida})" title="Eliminar">✕</button>
    </td>
  </tr>`;
}

function sumRow(label, val, moneda) {
  return `<tr style="border-bottom:1px solid var(--gray-light)">
    <td style="padding:9px 14px; font-size:13px; color:var(--text-muted)">${label}</td>
    <td style="padding:9px 14px; text-align:right; font-family:'Barlow Condensed',sans-serif; font-size:14px; font-weight:600">${moneda} ${fmt(val||0)}</td>
  </tr>`;
}

// ─── CREAR CAPÍTULO ──────────────────────────────────────────
function modalNuevoCapitulo(presId) {
  const orden = (_presActual?.capitulos?.length || 0) + 1;
  showModal('NUEVO CAPÍTULO', `
    <div class="form-grid">
      <div class="form-group" style="grid-column:span 2">
        <label class="form-label">Nombre del Capítulo *</label>
        <input type="text" id="capNombre" placeholder="Ej: I. OBRAS PRELIMINARES" autofocus>
        <div style="margin-top:6px; display:flex; flex-wrap:wrap; gap:4px">
          ${['I. PRELIMINARES','II. CIMENTACIONES','III. ESTRUCTURA','IV. MAMPOSTERÍA','V. TECHOS','VI. REPELLOS Y ACABADOS',
             'VII. PISOS','VIII. PUERTAS Y VENTANAS','IX. INSTALACIONES ELÉCTRICAS','X. INSTALACIONES HIDROSANITARIAS',
             'XI. PINTURA','XII. OBRAS EXTERIORES','XIII. AGUA POTABLE','XIV. ALCANTARILLADO SANITARIO',
             'XV. GENERALES'].map(s =>
            `<button type="button" class="btn-chip" style="font-size:10px" onclick="document.getElementById('capNombre').value='${s}'">${s}</button>`
          ).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Orden</label>
        <input type="number" id="capOrden" value="${orden}" min="1" style="width:80px">
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-orange" onclick="guardarCapitulo(${presId})">Crear Capítulo</button>
    </div>`);
  setTimeout(() => document.getElementById('capNombre')?.focus(), 50);
}

async function guardarCapitulo(presId) {
  const nombre = document.getElementById('capNombre').value.trim();
  if (!nombre) { toast('Escribe el nombre del capítulo', 'error'); return; }
  try {
    await api.post(`/api/presupuestos/${presId}/capitulos`, {
      nombre,
      orden_visual: parseInt(document.getElementById('capOrden').value) || 1
    });
    hideModal();
    toast('Capítulo creado ✓');
    await verPresupuestoDetalle(presId);
  } catch(e) { toast(e.error||'Error', 'error'); }
}

async function eliminarCapitulo(presId, capId, evt) {
  evt && evt.stopPropagation();
  const cap = _presActual?.capitulos?.find(c => c.id_capitulo == capId);
  const tienePartidas = _presActual?.partidas?.some(p => p.id_capitulo == capId);
  if (tienePartidas) {
    toast('No se puede eliminar — el capítulo tiene partidas asignadas', 'error');
    return;
  }
  if (!confirm(`¿Eliminar capítulo "${cap?.nombre||capId}"?`)) return;
  try {
    await api.del(`/api/presupuestos/${presId}/capitulos/${capId}`);
    toast('Capítulo eliminado');
    await verPresupuestoDetalle(presId);
  } catch(e) { toast(e.error||'Error al eliminar', 'error'); }
}

// ─── NUEVA PARTIDA ───────────────────────────────────────────
async function modalNuevaPartida(presId, preselCapId = null) {
  const caps = _presActual?.capitulos || [];
  showModal('NUEVA PARTIDA', `
    <div class="form-grid">
      <div class="form-group" style="grid-column:span 2">
        <label class="form-label">Buscar actividad *</label>
        <div style="position:relative; margin-bottom:6px">
          <span style="position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--text-muted)">🔍</span>
          <input type="text" id="partActSearch"
            placeholder="Código (F001, F002, AP-001, M-0001...) o descripción"
            oninput="buscarActsPart()"
            onkeydown="if(event.key==='Enter'){clearTimeout(_partTimer);buscarActsPart(true);}"
            style="padding-left:34px; width:100%" autocomplete="off">
        </div>
        <select id="partAct" size="6" style="width:100%; font-size:12px; border:1px solid var(--gray-mid); border-radius:4px">
          <option disabled selected value="">— Escribe arriba para buscar (mínimo 2 caracteres) —</option>
        </select>
        <div id="partActInfo" style="font-size:11px; color:var(--text-muted); margin-top:3px; height:16px"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Capítulo</label>
        <select id="partCap" style="width:100%">
          <option value="">Sin capítulo</option>
          ${caps.map(c => `<option value="${c.id_capitulo}" ${preselCapId == c.id_capitulo ? 'selected' : ''}>${c.nombre}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Cantidad *</label>
        <input type="number" id="partCant" value="1" min="0.001" step="0.001">
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-orange" onclick="guardarPartida(${presId})">Agregar Partida</button>
    </div>`);
  setTimeout(() => {
    document.getElementById('partActSearch')?.focus();
    // Mostrar las primeras 50 actividades al abrir
    buscarActsPart(true, '');
  }, 80);
}

let _partTimer = null;
async function buscarActsPart(inmediato = false, forceQ) {
  const q = forceQ !== undefined ? forceQ : (document.getElementById('partActSearch')?.value || '').trim();
  const sel = document.getElementById('partAct');
  const info = document.getElementById('partActInfo');
  if (!sel) return;

  // No buscar si menos de 2 caracteres (a menos que sea forzado)
  if (!inmediato && q.length > 0 && q.length < 2) {
    if (info) info.textContent = 'Escribe al menos 2 caracteres...';
    return;
  }

  clearTimeout(_partTimer);
  const run = async () => {
    if (info) info.textContent = 'Buscando...';
    sel.innerHTML = '<option disabled>Cargando...</option>';
    try {
      const url = `/api/actividades?limit=80&offset=0${q ? '&q=' + encodeURIComponent(q) : ''}`;
      const data = await api.get(url);
      const rows = Array.isArray(data) ? data : (data.rows || []);
      const total = Array.isArray(data) ? data.length : (data.total || rows.length);
      if (!rows.length) {
        sel.innerHTML = '<option disabled>Sin resultados para "' + q + '"</option>';
        if (info) info.textContent = '0 resultados';
        return;
      }
      sel.innerHTML = rows.map(a =>
        `<option value="${a.id_actividad}">[${a.codigo}] ${a.descripcion} — ${a.costo_total > 0 ? 'L ' + fmt(a.costo_total) : 'sin precio'} / ${a.unidad}</option>`
      ).join('');
      if (info) {
        info.textContent = total > 80
          ? `${total} resultados — mostrando 80. Afina la búsqueda.`
          : `${total} resultado${total !== 1 ? 's' : ''}`;
      }
    } catch(e) {
      sel.innerHTML = '<option disabled>Error al buscar</option>';
      if (info) info.textContent = 'Error de conexión';
    }
  };

  if (inmediato) { run(); } else { _partTimer = setTimeout(run, 300); }
}

async function guardarPartida(presId) {
  const sel = document.getElementById('partAct');
  const id_actividad = sel?.value;
  if (!id_actividad) { toast('Selecciona una actividad de la lista', 'error'); return; }
  const capVal = document.getElementById('partCap').value;
  try {
    await api.post(`/api/presupuestos/${presId}/partidas`, {
      id_actividad,
      id_capitulo: capVal || null,
      cantidad: parseFloat(document.getElementById('partCant').value) || 1
    });
    hideModal();
    toast('Partida agregada ✓');
    await verPresupuestoDetalle(presId);
  } catch(e) { toast(e.error||'Error', 'error'); }
}

// ─── ACTUALIZAR CANTIDAD INLINE ──────────────────────────────
async function actualizarCantidad(presId, partId, inputEl) {
  const val = parseFloat(inputEl.value);
  if (isNaN(val) || val < 0) {
    inputEl.classList.add('qty-error');
    toast('Cantidad inválida', 'error');
    return;
  }
  inputEl.disabled = true;
  inputEl.style.opacity = '0.6';
  try {
    const res = await api.put(`/api/presupuestos/${presId}/partidas/${partId}`, { cantidad: val });
    // Actualizar subtotal de la fila
    const tr = inputEl.closest('tr[data-partida]');
    if (tr) {
      const subtotalCell = tr.querySelector('.subtotal-cell');
      if (subtotalCell) {
        const moneda = _presActual?.presupuesto?.moneda || 'HNL';
        subtotalCell.textContent = `${moneda} ${fmt(res.subtotal)}`;
      }
    }
    // Actualizar los totales del pie de presupuesto sin recargar toda la página
    if (res.totales) {
      const t = res.totales;
      const moneda = _presActual?.presupuesto?.moneda || 'HNL';
      const sumRows = document.querySelectorAll('.sum-table tr');
      sumRows.forEach(row => {
        const lbl = row.cells[0]?.textContent?.trim() || '';
        const valCell = row.cells[1];
        if (!valCell) return;
        if (lbl.includes('Costos Directos'))    valCell.textContent = `${moneda} ${fmt(t.costos_directos)}`;
        if (lbl.includes('Indirectos'))         valCell.textContent = `${moneda} ${fmt(t.costos_indirectos)}`;
        if (lbl.includes('Utilidad'))           valCell.textContent = `${moneda} ${fmt(t.utilidad)}`;
        if (lbl.includes('Imprevistos'))        valCell.textContent = `${moneda} ${fmt(t.imprevistos)}`;
      });
      // Total general (grand total)
      const grandCell = document.querySelector('.grand-total td:last-child');
      if (grandCell) grandCell.textContent = `${moneda} ${fmt(t.total_general)}`;
      // Actualizar datos en memoria
      if (_presActual?.presupuesto) {
        _presActual.presupuesto.total_general = t.total_general;
      }
    }
    inputEl.classList.remove('qty-error');
    // Feedback visual breve
    inputEl.style.borderColor = '#27ae60';
    inputEl.style.background = '#eafaf1';
    setTimeout(() => {
      inputEl.style.borderColor = '#cce0f5';
      inputEl.style.background = '#f0f7ff';
    }, 1000);
  } catch(e) {
    toast(e.error || 'Error al actualizar cantidad', 'error');
    inputEl.classList.add('qty-error');
  } finally {
    inputEl.disabled = false;
    inputEl.style.opacity = '1';
  }
}

async function eliminarPartida(presId, partId) {
  if (!confirm('¿Eliminar esta partida?')) return;
  try {
    await api.del(`/api/presupuestos/${presId}/partidas/${partId}`);
    toast('Partida eliminada');
    await verPresupuestoDetalle(presId);
  } catch(e) { toast(e.error||'Error', 'error'); }
}

// ─── PORCENTAJES ─────────────────────────────────────────────
function modalPorcentajes(presId) {
  const p = _presActual?.presupuesto;
  showModal('% INDIRECTOS, UTILIDAD E IMPREVISTOS', `
    <div class="form-grid form-grid-3">
      <div class="form-group">
        <label class="form-label">Indirectos (%)</label>
        <input type="number" id="pctInd" value="${p?.porcentaje_indirectos||0}" min="0" step="0.5">
      </div>
      <div class="form-group">
        <label class="form-label">Utilidad (%)</label>
        <input type="number" id="pctUtil" value="${p?.porcentaje_utilidad||0}" min="0" step="0.5">
      </div>
      <div class="form-group">
        <label class="form-label">Imprevistos (%)</label>
        <input type="number" id="pctImp" value="${p?.porcentaje_imprevistos||0}" min="0" step="0.5">
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarPorcentajes(${presId})">Actualizar</button>
    </div>`);
}

async function guardarPorcentajes(presId) {
  try {
    await api.put(`/api/presupuestos/${presId}/porcentajes`, {
      porcentaje_indirectos: parseFloat(document.getElementById('pctInd').value)||0,
      porcentaje_utilidad: parseFloat(document.getElementById('pctUtil').value)||0,
      porcentaje_imprevistos: parseFloat(document.getElementById('pctImp').value)||0
    });
    hideModal();
    toast('Porcentajes actualizados');
    await verPresupuestoDetalle(presId);
  } catch(e) { toast(e.error||'Error', 'error'); }
}

// ─── NUEVO PRESUPUESTO ───────────────────────────────────────
function modalNuevoPresupuesto() {
  showModal('NUEVO PRESUPUESTO', `
    <div class="form-grid">
      <div class="form-group" style="grid-column:span 2">
        <label class="form-label">Nombre del Presupuesto *</label>
        <input type="text" id="presNombre" placeholder="Ej: Presupuesto Oferta, Revisión 1...">
      </div>
      <div class="form-group">
        <label class="form-label">Indirectos (%)</label>
        <input type="number" id="presInd" value="15" min="0" step="0.5">
      </div>
      <div class="form-group">
        <label class="form-label">Utilidad (%)</label>
        <input type="number" id="presUtil" value="10" min="0" step="0.5">
      </div>
      <div class="form-group">
        <label class="form-label">Imprevistos (%)</label>
        <input type="number" id="presImp" value="5" min="0" step="0.5">
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-orange" onclick="guardarPresupuesto()">Crear Presupuesto</button>
    </div>`);
  setTimeout(() => document.getElementById('presNombre')?.focus(), 50);
}

async function guardarPresupuesto() {
  try {
    const res = await api.post('/api/presupuestos', {
      id_proyecto: _presCtx.idProyecto,
      nombre: document.getElementById('presNombre').value.trim() || 'Presupuesto',
      porcentaje_indirectos: parseFloat(document.getElementById('presInd').value)||0,
      porcentaje_utilidad: parseFloat(document.getElementById('presUtil').value)||0,
      porcentaje_imprevistos: parseFloat(document.getElementById('presImp').value)||0
    });
    hideModal();
    toast('Presupuesto creado ✓');
    await loadPresupuestos();
    verPresupuestoDetalle(res.id);
  } catch(e) { toast(e.error||'Error', 'error'); }
}

// ─── BANNER INSUMOS EN CERO ───────────────────────────────────
async function cargarInsumosCero(presId) {
  const banner = document.getElementById('banner-insumos-cero');
  if (!banner) return;
  try {
    const data = await api.get(`/api/presupuestos/${presId}/insumos-cero`);
    const nPartidas = (data.partidas_cero || []).length;
    const nInsumos  = (data.insumos_cero  || []).length;
    const total     = nPartidas + nInsumos;

    if (total === 0) { banner.style.display = 'none'; return; }

    // Construir detalle de actividades en cero (máximo 5 visibles)
    let detalle = '';
    if (nPartidas > 0) {
      const muestras = (data.partidas_cero || []).slice(0, 4);
      detalle += `<div style="margin-top:6px;font-size:11px;color:#92400e">
        <strong>Actividades sin precio (${nPartidas}):</strong>
        ${muestras.map(p => `<span style="display:inline-block;background:#fef3c7;
          border-radius:3px;padding:1px 6px;margin:2px 3px 2px 0;font-size:11px">
          ${sanitize(p.codigo)} — ${sanitize(p.descripcion.substring(0,35))}${p.descripcion.length>35?'…':''}</span>`).join('')}
        ${nPartidas > 4 ? `<span style="color:#b45309">... y ${nPartidas-4} más</span>` : ''}
      </div>`;
    }
    if (nInsumos > 0) {
      detalle += `<div style="margin-top:4px;font-size:11px;color:#92400e">
        <strong>Insumos sin precio en catálogo (${nInsumos}):</strong>
        ${(data.insumos_cero||[]).slice(0,3).map(i =>
          `<span style="display:inline-block;background:#fef3c7;border-radius:3px;
            padding:1px 6px;margin:2px 3px 2px 0;font-size:11px">${sanitize(i.descripcion.substring(0,30))}</span>`
        ).join('')}
        ${nInsumos > 3 ? `<span style="color:#b45309">... y ${nInsumos-3} más</span>` : ''}
      </div>`;
    }

    banner.style.display = 'block';
    banner.innerHTML = `
      <div style="background:#fff8e1;border:2px solid #f59e0b;border-radius:8px;padding:14px 16px">
        <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div style="font-size:26px;line-height:1;flex-shrink:0">⚠️</div>
          <div style="flex:1;min-width:220px">
            <div style="font-weight:700;color:#92400e;font-size:14px;margin-bottom:3px">
              Presupuesto incompleto —
              ${nPartidas > 0 ? `${nPartidas} actividad${nPartidas>1?'es':''} sin precio` : ''}
              ${nPartidas > 0 && nInsumos > 0 ? ' y ' : ''}
              ${nInsumos > 0 ? `${nInsumos} insumo${nInsumos>1?'s':''} sin cotizar` : ''}
            </div>
            <div style="font-size:12px;color:#b45309">
              ${data.id_centro
                ? `Centro <strong>${sanitize(_presActual?.presupuesto?.centro_nombre||'')}</strong> asignado.
                   Actualice precios en <strong>Centro de Costos → Editar precios</strong> y presione <strong>🔄 Recalcular</strong>.`
                : `Actualice precios en <strong>Catálogos → Insumos</strong> y presione <strong>🔄 Recalcular</strong>.`}
            </div>
            ${detalle}
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
            <button style="background:#f59e0b;color:#fff;border:none;font-weight:600;
                           padding:7px 14px;border-radius:5px;cursor:pointer;font-size:12px;white-space:nowrap"
              onclick="imprimirInsumosFaltantes(${presId})">🖨️ Imprimir lista para cotizar</button>
            <button style="background:#fff;color:#92400e;border:1.5px solid #f59e0b;font-weight:600;
                           padding:5px 14px;border-radius:5px;cursor:pointer;font-size:11px;white-space:nowrap"
              onclick="recalcularPresupuesto(${presId})">🔄 Recalcular ahora</button>
          </div>
        </div>
      </div>`;
  } catch(e) {
    console.error('cargarInsumosCero error:', e);
    banner.style.display = 'none';
  }
}

// ─── RECALCULAR PRESUPUESTO ───────────────────────────────────
async function recalcularPresupuesto(presId) {
  const btn = document.getElementById('btnRecalcular');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Recalculando...'; }
  try {
    await api.post(`/api/presupuestos/${presId}/recalcular`, {});
    toast('Presupuesto recalculado ✓', 'success');
    await verPresupuestoDetalle(presId);
  } catch(e) {
    toast(e.error || 'Error al recalcular', 'error');
    if (btn) { btn.disabled = false; btn.textContent = '🔄 Recalcular'; }
  }
}

// ─── PDF INSUMOS FALTANTES ────────────────────────────────────
async function imprimirInsumosFaltantes(presId) {
  toast('Generando lista para cotizar...', 'info');
  try {
    const [cotData, presData] = await Promise.all([
      api.get(`/api/presupuestos/${presId}/cotizacion-insumos`),
      api.get(`/api/presupuestos/${presId}`)
    ]);
    const pres           = presData.presupuesto || {};
    const por_actividad  = cotData.por_actividad  || {};
    const sin_insumos    = cotData.sin_insumos    || [];
    const insumos_sueltos = cotData.insumos_sueltos || [];

    const tieneConInsumos = Object.keys(por_actividad).length > 0;
    const tieneSinInsumos = sin_insumos.length > 0;
    const tieneInsumosSueltos = insumos_sueltos.length > 0;

    if (!tieneConInsumos && !tieneSinInsumos && !tieneInsumosSueltos) {
      toast('Todos los insumos tienen precio ✓', 'info');
      return;
    }

    let filas = '';

    // ── SECCIÓN A: Actividades con insumos cargados → mostrar insumos sin precio ──
    if (tieneConInsumos) {
      for (const [actCod, act] of Object.entries(por_actividad)) {
        if (!act.insumos.length) continue;

        // Encabezado de la actividad
        filas += `<tr style="background:#e8f0fb">
          <td colspan="5" style="padding:8px 12px;font-weight:700;font-size:11px;color:#013a6e">
            📋 ${actCod} — ${act.descripcion}
            <span style="font-weight:400;color:#555;font-size:10px;margin-left:8px">
              (${act.unidad} × ${act.cantidad})
            </span>
          </td>
        </tr>`;

        // Insumos de esa actividad que necesitan precio
        const cats = {};
        act.insumos.forEach(i => { if (!cats[i.categoria]) cats[i.categoria]=[]; cats[i.categoria].push(i); });
        for (const [cat, items] of Object.entries(cats)) {
          filas += `<tr style="background:#f7f9fc">
            <td colspan="5" style="padding:5px 12px 4px 24px;font-size:10px;
                color:#025196;font-weight:600;text-transform:uppercase;letter-spacing:0.3px">
              ${cat}
            </td>
          </tr>`;
          items.forEach(i => {
            filas += `<tr>
              <td style="padding-left:24px;font-family:monospace;color:#025196;font-size:10px">${i.codigo}</td>
              <td>${i.descripcion}</td>
              <td style="text-align:center">${i.unidad}</td>
              <td style="text-align:right;color:#888;font-size:10px">${Number(i.cantidad_total).toFixed(4)}</td>
              <td style="text-align:right;background:#fffbeb;color:#c05621;font-weight:600;
                          font-size:12px;min-width:90px">L ___________</td>
            </tr>`;
          });
        }
      }
    }

    // ── SECCIÓN B: Actividades SIN insumos cargados ──
    if (tieneSinInsumos) {
      filas += `<tr style="background:#fef3c7">
        <td colspan="5" style="padding:8px 12px;font-weight:700;font-size:11px;color:#92400e">
          ⚠ ACTIVIDADES SIN INSUMOS CARGADOS — Ingresar composición en Actividades/CU
        </td>
      </tr>`;
      sin_insumos.forEach(p => {
        filas += `<tr style="background:#fffbeb">
          <td style="font-family:monospace;color:#025196;font-size:10px">${p.codigo}</td>
          <td>${p.descripcion}</td>
          <td style="text-align:center">${p.unidad}</td>
          <td style="text-align:right;color:#c05621">${Number(p.cantidad).toFixed(4)}</td>
          <td style="text-align:right;background:#fef3c7;color:#92400e;font-size:10px;font-style:italic">
            Sin insumos →<br>ir a Actividades/CU
          </td>
        </tr>`;
      });
    }

    // ── SECCIÓN C: Insumos sueltos sin precio ──
    if (tieneInsumosSueltos) {
      filas += `<tr style="background:#e8f0fb">
        <td colspan="5" style="padding:8px 12px;font-weight:700;font-size:11px;color:#013a6e">
          📦 INSUMOS SIN PRECIO EN CATÁLOGO
        </td>
      </tr>`;
      const cats = {};
      insumos_sueltos.forEach(i => { if (!cats[i.categoria]) cats[i.categoria]=[]; cats[i.categoria].push(i); });
      for (const [cat, items] of Object.entries(cats)) {
        filas += `<tr style="background:#f7f9fc">
          <td colspan="5" style="padding:5px 12px 4px 24px;font-size:10px;
              color:#025196;font-weight:600;text-transform:uppercase">${cat}</td>
        </tr>`;
        items.forEach(i => {
          filas += `<tr>
            <td style="padding-left:24px;font-family:monospace;color:#025196;font-size:10px">${i.codigo}</td>
            <td>${i.descripcion}</td>
            <td style="text-align:center">${i.unidad}</td>
            <td style="text-align:right;color:#888;font-size:10px">${Number(i.cantidad_total).toFixed(4)}</td>
            <td style="text-align:right;background:#fffbeb;color:#c05621;font-weight:600;
                        font-size:12px">L ___________</td>
          </tr>`;
        });
      }
    }

    const fecha     = new Date().toLocaleDateString('es-HN');
    const centroPart = pres.id_centro_costo
      ? `<span><strong>Centro de costos:</strong> 📍 ${sanitize(pres.centro_nombre||'')}</span>` : '';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Cotización Insumos — ${pres.nombre||presId}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:11px;color:#222;padding:18px}
      .hdr{border-bottom:3px solid #025196;padding-bottom:10px;margin-bottom:12px;
           display:flex;justify-content:space-between;align-items:flex-end}
      .hdr-left .tag{font-size:10px;color:#f59e0b;font-weight:700;letter-spacing:1px;margin-bottom:3px}
      .hdr-left h1{font-size:17px;color:#025196;text-transform:uppercase;letter-spacing:1px}
      .hdr-right{font-size:10px;color:#666;text-align:right;line-height:1.6}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:5px 20px;margin-bottom:12px;
            background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:9px 14px}
      .meta span{font-size:10px;color:#555}
      .instruct{background:#e8f0fb;border-left:3px solid #025196;border-radius:0 6px 6px 0;
                padding:9px 14px;margin-bottom:12px;font-size:11px;color:#013a6e;line-height:1.6}
      .instruct strong{display:block;margin-bottom:3px;font-size:12px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      thead th{background:#025196;color:#fff;padding:7px 10px;text-align:left}
      tbody tr{border-bottom:1px solid #f0f0f0}
      td{padding:5px 10px;vertical-align:middle}
      .footer{margin-top:16px;border-top:1px solid #ccc;padding-top:8px;
              font-size:9px;color:#888;display:flex;justify-content:space-between}
      @media print{body{padding:10px}}
    </style></head><body>
    <div class="hdr">
      <div class="hdr-left">
        <div class="tag">⚠ INSUMOS A COTIZAR</div>
        <h1>Lista de Cotización</h1>
      </div>
      <div class="hdr-right">Servicios y Construcciones RP<br>${fecha}</div>
    </div>
    <div class="meta">
      <span><strong>Presupuesto:</strong> ${sanitize(pres.nombre||'—')}</span>
      <span><strong>Proyecto:</strong> ${sanitize(pres.proyecto_nombre||'—')}</span>
      <span><strong>Cliente:</strong> ${sanitize(pres.cliente||'—')}</span>
      ${centroPart || '<span><strong>Centro de costos:</strong> Sin centro asignado</span>'}
    </div>
    <div class="instruct">
      <strong>Instrucciones</strong>
      1. Solicite cotización de precios para los insumos listados.<br>
      2. Ingrese los precios en <strong>Catálogos → Insumos</strong>
         ${pres.id_centro_costo ? 'o en <strong>Centro de Costos → Editar precios</strong>' : ''}.<br>
      3. Regrese al presupuesto y presione <strong>🔄 Recalcular</strong>.
    </div>
    <table>
      <thead><tr>
        <th style="width:100px">Código</th>
        <th>Descripción</th>
        <th style="width:55px;text-align:center">Unidad</th>
        <th style="width:100px;text-align:right">Cant. requerida</th>
        <th style="width:110px;text-align:right">Precio L</th>
      </tr></thead>
      <tbody>${filas}</tbody>
    </table>
    <div class="footer">
      <span>Sistema de Costos Unitarios — Servicios y Construcciones RP</span>
      <span>${fecha} — Para uso interno</span>
    </div>
    <script>window.onload=()=>window.print()<\/script>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
    else toast('Active las ventanas emergentes para imprimir', 'error');
  } catch(e) { toast('Error: ' + (e.error||e), 'error'); }
}
// ─── MODAL ASIGNAR CENTRO DE COSTO ───────────────────────────
async function modalAsignarCentro(presId, centroActualId) {
  try {
    const centros = await api.get('/api/centros');
    showModal('CENTRO DE COSTO DEL PRESUPUESTO', `
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">
        El centro de costo define la lista de precios que se usará al presionar
        <strong>🔄 Recalcular</strong>. Sin centro se usan los precios base del catálogo.
      </p>
      <div class="form-group">
        <label class="form-label">Centro de costo</label>
        <select id="selCentro" style="width:100%">
          <option value="">— Sin centro (precios base del catálogo) —</option>
          ${centros.map(c => `<option value="${c.id_centro}" ${c.id_centro == centroActualId ? 'selected' : ''}>
            📍 ${sanitize(c.nombre)} ${c.zona ? '— ' + sanitize(c.zona) : ''}
            (${c.total_precios} precios propios)
          </option>`).join('')}
        </select>
      </div>
      <div style="background:#f0f7ff;border-radius:6px;padding:10px 14px;margin-top:10px;font-size:12px;color:#025196">
        💡 Después de cambiar el centro presione <strong>Recalcular</strong> para aplicar los nuevos precios al presupuesto.
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
        <button class="btn btn-orange" onclick="confirmarAsignarCentro(${presId})">Asignar</button>
      </div>`);
  } catch(e) { toast(e.error || 'Error cargando centros', 'error'); }
}

async function confirmarAsignarCentro(presId) {
  const val = document.getElementById('selCentro')?.value;
  try {
    const r = await api.put(`/api/presupuestos/${presId}/centro`, {
      id_centro_costo: val ? parseInt(val) : null
    });
    hideModal();
    toast(r.centro_nombre ? `Centro asignado: ${r.centro_nombre} ✓` : 'Centro removido ✓');
    await verPresupuestoDetalle(presId);
  } catch(e) { toast(e.error || 'Error', 'error'); }
}

function exportarExcel(presId) {
  window.open(`/api/reportes/presupuesto/${presId}/excel`, '_blank');
  toast('Generando Excel...', 'info');
}
