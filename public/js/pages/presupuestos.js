// ═══════════════════════════════════════════════════════════════
// PRESUPUESTOS
// ═══════════════════════════════════════════════════════════════
let _presupuestos = [];
let _presActual = null;   // { presupuesto, modulos, actividades }

// ─── RENDER PRINCIPAL — lista directa de presupuestos ────────
async function renderPresupuestos(ctx = {}) {
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">PRESUPUESTOS</div>
        <div class="page-subtitle">Todos los presupuestos del sistema</div>
      </div>
      <div class="btn-group">
        <button class="btn btn-orange" onclick="modalNuevoPresupuesto()">+ Nuevo Presupuesto</button>
      </div>
    </div>
    <div class="page-body">
      <div id="presListWrap"><div class="loading"><div class="spinner"></div> Cargando...</div></div>
    </div>`;
  await loadPresupuestos();
}

async function loadPresupuestos() {
  try {
    _presupuestos = await api.get('/api/presupuestos');
    const wrap = document.getElementById('presListWrap');
    if (!wrap) return;
    if (!_presupuestos.length) {
      wrap.innerHTML = `<div class="empty-state">
        <div class="empty-icon">▤</div>
        <div class="empty-title">Sin presupuestos</div>
        <div class="empty-desc">Crea el primer presupuesto</div>
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
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
                <span class="badge badge-${p.estado||'activo'}">${p.estado||'activo'}</span>
                <span style="font-size:11px;color:var(--text-muted)">${p.fecha_creacion?.substring(0,10)||''}</span>
              </div>
              <div style="font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:700;color:var(--blue);margin-bottom:2px">${sanitize(p.nombre||'Presupuesto')}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">${sanitize(p.ubicacion||'')} · ${sanitize(p.cliente||'—')}</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
                <div><div style="color:var(--text-muted)">Costos Directos</div><div style="font-weight:600">L ${fmt(p.costos_directos||0)}</div></div>
                <div><div style="color:var(--text-muted)">Indirectos</div><div style="font-weight:600">${p.porcentaje_indirectos||0}%</div></div>
              </div>
              <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--gray-light);display:flex;justify-content:space-between;align-items:center">
                <span style="font-size:12px;color:var(--text-muted)">TOTAL</span>
                <span style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:700;color:var(--blue)">L ${fmt(p.total_general||0)}</span>
              </div>
              <div style="margin-top:8px;display:flex;justify-content:flex-end;gap:6px">
                <button class="btn btn-danger btn-sm" style="font-size:11px"
                  onclick="event.stopPropagation(); eliminarPresupuesto(${p.id_presupuesto})">✕ Eliminar</button>
              </div>
            </div>
          </div>`).join('')}
      </div>`;
  } catch(e) { console.error(e); }
}

// ─── DETALLE DE PRESUPUESTO ──────────────────────────────────
async function eliminarPresupuesto(presId) {
  if (!confirm('¿Eliminar este presupuesto y todas sus actividades? Esta acción no se puede deshacer.')) return;
  try {
    await api.del(`/api/presupuestos/${presId}`);
    toast('Presupuesto eliminado');
    await loadPresupuestos();
  } catch(e) { toast(e.error || 'Error al eliminar', 'error'); }
}

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
  const { presupuesto: pres, modulos, actividades } = data;
  const moneda = pres.moneda || 'L';

  // Construir mapa de módulos con sus actividades
  const chMap = new Map();
  modulos.forEach(c => chMap.set(c.id_modulo, { ...c, actividades: [] }));
  const sinCap = [];
  actividades.forEach(p => {
    if (p.id_modulo && chMap.has(p.id_modulo)) {
      chMap.get(p.id_modulo).actividades.push(p);
    } else {
      sinCap.push(p);
    }
  });

  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="breadcrumb">
          <a onclick="renderPresupuestos()">Presupuestos</a> → ${sanitize(pres.nombre||'Presupuesto')}
        </div>
        <div class="page-title">${sanitize(pres.nombre||'Presupuesto')}</div>
        <div class="page-subtitle">${sanitize(pres.ubicacion||'')} · ${sanitize(pres.cliente||'')}</div>
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
        <button class="btn btn-secondary btn-sm" onclick="renderPresupuestos()">← Presupuestos</button>
        <button class="btn btn-secondary btn-sm" onclick="modalNuevoMódulo(${presId})">+ Módulo</button>
        <button class="btn btn-secondary btn-sm" onclick="modalNuevaActividad(${presId})">+ Actividad</button>
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
              ${buildActividadesRows(chMap, sinCap, moneda, presId)}
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

function buildActividadesRows(chMap, sinCap, moneda, presId) {
  let n = 1;
  let html = '';

  // Módulos con sus actividades
  chMap.forEach((cap, capId) => {
    const subtotal = cap.actividades.reduce((s, p) => s + p.subtotal, 0);
    html += `
      <tr class="pres-chapter">
        <td colspan="6">
          <span style="opacity:0.7; font-size:11px; margin-right:8px">${cap.orden_visual||''}.</span>
          ${sanitize(cap.nombre)}
          <span style="margin-left:12px; font-weight:400; opacity:0.8; font-size:12px">${moneda} ${fmt(subtotal)}</span>
        </td>
        <td style="text-align:right; padding-right:6px">
          <button class="btn btn-add-actividad btn-sm"
            onclick="modalNuevaActividad(${presId}, ${capId})" title="Agregar actividad a este módulo"
            style="background:rgba(255,255,255,0.18); border:1px solid rgba(255,255,255,0.5);
                   color:#fff; font-size:11px; padding:3px 9px; border-radius:4px; cursor:pointer;
                   font-weight:600; letter-spacing:0.5px; white-space:nowrap">+ Actividad</button>
        </td>
        <td style="text-align:center">
          <button class="btn btn-danger btn-sm btn-icon"
            onclick="eliminarMódulo(${presId},${capId},event)" title="Eliminar módulo">✕</button>
        </td>
      </tr>`;
    if (cap.actividades.length === 0) {
      html += `<tr><td colspan="8" style="padding:8px 14px; font-size:11px; color:var(--text-muted); font-style:italic">— Módulo vacío. Agrega actividades y asigna este módulo. —</td></tr>`;
    }
    cap.actividades.forEach(p => { html += rowActividad(p, n++, moneda, presId); });
  });

  // Actividades sin módulo
  sinCap.forEach(p => { html += rowActividad(p, n++, moneda, presId); });

  if (!html) {
    html = `<tr><td colspan="8">
      <div class="empty-state" style="padding:40px">
        <div class="empty-icon">▤</div>
        <div class="empty-title">Sin actividades</div>
        <div class="empty-desc">Crea módulos con <strong>+ Módulo</strong>, luego agrega actividades con <strong>+ Actividad</strong></div>
      </div>
    </td></tr>`;
  }
  return html;
}

function rowActividad(p, n, moneda, presId) {
  return `<tr data-actividad="${p.id_partida}">
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
        onclick="eliminarActividad(${presId},${p.id_partida})" title="Eliminar">✕</button>
    </td>
  </tr>`;
}

function sumRow(label, val, moneda) {
  return `<tr style="border-bottom:1px solid var(--gray-light)">
    <td style="padding:9px 14px; font-size:13px; color:var(--text-muted)">${label}</td>
    <td style="padding:9px 14px; text-align:right; font-family:'Barlow Condensed',sans-serif; font-size:14px; font-weight:600">${moneda} ${fmt(val||0)}</td>
  </tr>`;
}

// ─── CREAR MÓDULO ──────────────────────────────────────────
function modalNuevoMódulo(presId) {
  const orden = (_presActual?.modulos?.length || 0) + 1;
  showModal('NUEVO MÓDULO', `
    <div class="form-grid">
      <div class="form-group" style="grid-column:span 2">
        <label class="form-label">Nombre del Módulo *</label>
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
      <button class="btn btn-orange" onclick="guardarMódulo(${presId})">Crear Módulo</button>
    </div>`);
  setTimeout(() => document.getElementById('capNombre')?.focus(), 50);
}

async function guardarMódulo(presId) {
  const nombre = document.getElementById('capNombre').value.trim();
  if (!nombre) { toast('Escribe el nombre del módulo', 'error'); return; }
  try {
    await api.post(`/api/presupuestos/${presId}/modulos`, {
      nombre,
      orden_visual: parseInt(document.getElementById('capOrden').value) || 1
    });
    hideModal();
    toast('Módulo creado ✓');
    await verPresupuestoDetalle(presId);
  } catch(e) { toast(e.error||'Error', 'error'); }
}

async function eliminarMódulo(presId, capId, evt) {
  evt && evt.stopPropagation();
  const cap = _presActual?.modulos?.find(c => c.id_modulo == capId);
  const tieneActividades = _presActual?.actividades?.some(p => p.id_modulo == capId);
  if (tieneActividades) {
    toast('No se puede eliminar — el módulo tiene actividades asignadas', 'error');
    return;
  }
  if (!confirm(`¿Eliminar módulo "${cap?.nombre||capId}"?`)) return;
  try {
    await api.del(`/api/presupuestos/${presId}/modulos/${capId}`);
    toast('Módulo eliminado');
    await verPresupuestoDetalle(presId);
  } catch(e) { toast(e.error||'Error al eliminar', 'error'); }
}

// ─── NUEVA ACTIVIDAD ───────────────────────────────────────────
async function modalNuevaActividad(presId, preselCapId = null) {
  const caps = _presActual?.modulos || [];
  showModal('NUEVA ACTIVIDAD', `
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
        <label class="form-label">Módulo</label>
        <select id="partCap" style="width:100%">
          <option value="">Sin módulo</option>
          ${caps.map(c => `<option value="${c.id_modulo}" ${preselCapId == c.id_modulo ? 'selected' : ''}>${c.nombre}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Cantidad *</label>
        <input type="number" id="partCant" value="1" min="0.001" step="0.001">
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-orange" onclick="guardarActividad(${presId})">Agregar Actividad</button>
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

async function guardarActividad(presId) {
  const sel = document.getElementById('partAct');
  const id_actividad = sel?.value;
  if (!id_actividad) { toast('Selecciona una actividad de la lista', 'error'); return; }
  const capVal = document.getElementById('partCap').value;
  try {
    await api.post(`/api/presupuestos/${presId}/actividades`, {
      id_actividad,
      id_modulo: capVal || null,
      cantidad: parseFloat(document.getElementById('partCant').value) || 1
    });
    hideModal();
    toast('Actividad agregada ✓');
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
    const res = await api.put(`/api/presupuestos/${presId}/actividades/${partId}`, { cantidad: val });
    // Actualizar subtotal de la fila
    const tr = inputEl.closest('tr[data-actividad]');
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
      const moneda = _presActual?.presupuesto?.moneda || 'L';
      // Recorrer TODAS las filas de todas las tablas del pie
      document.querySelectorAll('table tr').forEach(row => {
        if (row.cells.length < 2) return;
        const lbl = row.cells[0]?.textContent?.trim() || '';
        const valCell = row.cells[1];
        if (!valCell) return;
        if (lbl.includes('Costos Directos'))   valCell.textContent = `${moneda} ${fmt(t.costos_directos)}`;
        if (lbl.includes('Indirectos'))        valCell.textContent = `${moneda} ${fmt(t.costos_indirectos)}`;
        if (lbl.includes('Utilidad'))          valCell.textContent = `${moneda} ${fmt(t.utilidad)}`;
        if (lbl.includes('Imprevistos'))       valCell.textContent = `${moneda} ${fmt(t.imprevistos)}`;
      });
      // Total general (grand total)
      const grandCell = document.querySelector('.grand-total td:last-child');
      if (grandCell) grandCell.textContent = `${moneda} ${fmt(t.total_general)}`;
      // Actualizar datos en memoria
      if (_presActual?.presupuesto) {
        _presActual.presupuesto.costos_directos   = t.costos_directos;
        _presActual.presupuesto.costos_indirectos = t.costos_indirectos;
        _presActual.presupuesto.utilidad          = t.utilidad;
        _presActual.presupuesto.imprevistos       = t.imprevistos;
        _presActual.presupuesto.total_general     = t.total_general;
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

async function eliminarActividad(presId, partId) {
  if (!confirm('¿Eliminar esta actividad?')) return;
  try {
    await api.del(`/api/presupuestos/${presId}/actividades/${partId}`);
    toast('Actividad eliminada');
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
      <button class="btn btn-orange" onclick="guardarPorcentajes(${presId})">Actualizar</button>
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
async function modalNuevoPresupuesto() {
  showModal('NUEVO PRESUPUESTO', `
    <div class="form-grid">
      <div class="form-group" style="grid-column:span 2">
        <label class="form-label">Nombre del Presupuesto *</label>
        <input type="text" id="presNombre" placeholder="Ej: Construcción de vivienda, Tramo Km 5-10...">
      </div>
      <div class="form-group">
        <label class="form-label">Cliente</label>
        <input type="text" id="presCliente" placeholder="Nombre del cliente">
      </div>
      <div class="form-group">
        <label class="form-label">Ubicación</label>
        <input type="text" id="presUbicacion" placeholder="Ciudad / sitio de la obra">
      </div>
      <div class="form-group">
        <label class="form-label">Moneda</label>
        <select id="presMoneda">
          <option value="HNL" selected>Lempiras (HNL)</option>
          <option value="USD">Dólares (USD)</option>
          <option value="EUR">Euros (EUR)</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Fecha de inicio</label>
        <input type="date" id="presFechaInicio">
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
      nombre: document.getElementById('presNombre').value.trim() || 'Presupuesto',
      cliente: document.getElementById('presCliente')?.value.trim() || null,
      ubicacion: document.getElementById('presUbicacion')?.value.trim() || null,
      moneda: document.getElementById('presMoneda')?.value || 'HNL',
      fecha_inicio: document.getElementById('presFechaInicio')?.value || null,
      porcentaje_indirectos: parseFloat(document.getElementById('presInd').value)||0,
      porcentaje_utilidad: parseFloat(document.getElementById('presUtil').value)||0,
      porcentaje_imprevistos: parseFloat(document.getElementById('presImp').value)||0
    });
    hideModal();
    toast('Presupuesto creado ✓');
    verPresupuestoDetalle(res.id);
  } catch(e) { toast(e.error||'Error', 'error'); }
}

// ─── BANNER INSUMOS EN CERO ───────────────────────────────────
async function cargarInsumosCero(presId) {
  const banner = document.getElementById('banner-insumos-cero');
  if (!banner) return;
  try {
    const data = await api.get(`/api/presupuestos/${presId}/insumos-cero`);
    const nActividades = (data.actividads_cero || []).length;
    const nInsumos  = (data.insumos_cero  || []).length;
    const total     = nActividades + nInsumos;

    if (total === 0) { banner.style.display = 'none'; return; }

    // Construir detalle de actividades en cero (máximo 5 visibles)
    let detalle = '';
    if (nActividades > 0) {
      const muestras = (data.actividads_cero || []).slice(0, 4);
      detalle += `<div style="margin-top:6px;font-size:11px;color:#92400e">
        <strong>Actividades sin precio (${nActividades}):</strong>
        ${muestras.map(p => `<span style="display:inline-block;background:#fef3c7;
          border-radius:3px;padding:1px 6px;margin:2px 3px 2px 0;font-size:11px">
          ${sanitize(p.codigo)} — ${sanitize(p.descripcion.substring(0,35))}${p.descripcion.length>35?'…':''}</span>`).join('')}
        ${nActividades > 4 ? `<span style="color:#b45309">... y ${nActividades-4} más</span>` : ''}
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
              ${nActividades > 0 ? `${nActividades} actividad${nActividades>1?'es':''} sin precio` : ''}
              ${nActividades > 0 && nInsumos > 0 ? ' y ' : ''}
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
    // Cargar configuración de empresa
    let _empresa = 'Servicios y Construcciones RP';
    try { const _cfg = await api.get('/api/configuracion'); if (_cfg.empresa_nombre?.valor) _empresa = _cfg.empresa_nombre.valor; } catch(e) {}
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
      <div class="hdr-right">${_empresa}<br>${fecha}</div>
    </div>
    <div class="meta">
      <span><strong>Presupuesto:</strong> ${sanitize(pres.nombre||'—')}</span>
      <span><strong>Ubicación:</strong> ${sanitize(pres.ubicacion||'—')}</span>
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
      <span>Sistema de Costos Unitarios — ${_empresa}</span>
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
