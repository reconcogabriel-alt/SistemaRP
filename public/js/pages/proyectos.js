async function renderProyectos() {
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">PROYECTOS</div>
        <div class="page-subtitle">Gestión de proyectos de construcción</div>
      </div>
      <button class="btn btn-orange" onclick="modalNuevoProyecto()">+ Nuevo Proyecto</button>
    </div>
    <div class="page-body">
      <div class="toolbar">
        <div class="search-box"><input type="text" id="searchProyecto" placeholder="Buscar proyecto..." oninput="filterProyectos()"></div>
        <select class="filter-select" id="filterEstado" onchange="filterProyectos()">
          <option value="">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="finalizado">Finalizado</option>
          <option value="archivado">Archivado</option>
        </select>
      </div>
      <div class="card">
        <div class="table-wrap" id="proyectosTableWrap">
          <div class="loading"><div class="spinner"></div> Cargando...</div>
        </div>
      </div>
    </div>`;
  
  await loadProyectos();
}

let _proyectos = [];

async function loadProyectos() {
  try {
    _proyectos = await api.get('/api/proyectos');
    renderProyectosTable(_proyectos);
  } catch (e) {
    document.getElementById('proyectosTableWrap').innerHTML = `<div class="empty-state"><div class="empty-icon">✕</div><div>Error: ${e.error}</div></div>`;
  }
}

function filterProyectos() {
  const q = document.getElementById('searchProyecto')?.value.toLowerCase() || '';
  const est = document.getElementById('filterEstado')?.value || '';
  const filtered = _proyectos.filter(p =>
    (p.nombre.toLowerCase().includes(q) || (p.cliente || '').toLowerCase().includes(q) || (p.ubicacion || '').toLowerCase().includes(q)) &&
    (!est || p.estado === est)
  );
  renderProyectosTable(filtered);
}

function renderProyectosTable(lista) {
  const wrap = document.getElementById('proyectosTableWrap');
  if (!wrap) return;
  if (!lista.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">◻</div><div class="empty-title">Sin proyectos</div><div class="empty-desc">Crea tu primer proyecto para comenzar</div></div>`;
    return;
  }
  wrap.innerHTML = `
    <table>
      <thead><tr>
        <th>#</th><th>Nombre del Proyecto</th><th>Cliente</th>
        <th>Ubicación</th><th>Moneda</th><th>Fechas</th>
        <th>Pres.</th><th>Estado</th><th>Acciones</th>
      </tr></thead>
      <tbody>
        ${lista.map((p, i) => `
          <tr>
            <td style="color:var(--text-muted); font-size:12px">${i + 1}</td>
            <td><strong style="color:var(--blue); cursor:pointer" onclick="verPresupuestosProyecto(${p.id_proyecto}, '${sanitize(p.nombre)}')">${sanitize(p.nombre)}</strong></td>
            <td>${sanitize(p.cliente || '—')}</td>
            <td>${sanitize(p.ubicacion || '—')}</td>
            <td><span class="badge badge-blue">${p.moneda}</span></td>
            <td style="font-size:12px; color:var(--text-muted)">${p.fecha_inicio || '—'} → ${p.fecha_fin || '—'}</td>
            <td style="text-align:center">
              <span class="badge badge-orange" style="cursor:pointer" onclick="verPresupuestosProyecto(${p.id_proyecto}, '${sanitize(p.nombre)}')">${p.num_presupuestos}</span>
            </td>
            <td><span class="badge badge-${p.estado}">${p.estado}</span></td>
            <td>
              <div class="btn-group">
                <button class="btn btn-secondary btn-sm" onclick="verPresupuestosProyecto(${p.id_proyecto}, '${sanitize(p.nombre)}')">Presupuestos</button>
                <button class="btn btn-secondary btn-sm btn-icon" onclick="modalEditarProyecto(${p.id_proyecto})" title="Editar">✎</button>
              </div>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function modalNuevoProyecto() {
  showModal('NUEVO PROYECTO', `
    <div class="form-grid form-grid-2">
      <div class="form-group" style="grid-column:span 2">
        <label class="form-label">Nombre del Proyecto *</label>
        <input type="text" id="pNombre" placeholder="Ej: Sistema de AP Sector Norte">
      </div>
      <div class="form-group">
        <label class="form-label">Cliente</label>
        <input type="text" id="pCliente" placeholder="Municipalidad / SANAA / Privado">
      </div>
      <div class="form-group">
        <label class="form-label">Ubicación</label>
        <input type="text" id="pUbicacion" placeholder="Municipio, Departamento">
      </div>
      <div class="form-group">
        <label class="form-label">Moneda</label>
        <select id="pMoneda">
          <option value="HNL">HNL (Lempiras)</option>
          <option value="USD">USD (Dólares)</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Fecha Inicio</label>
        <input type="date" id="pFechaInicio">
      </div>
      <div class="form-group">
        <label class="form-label">Fecha Fin</label>
        <input type="date" id="pFechaFin">
      </div>
      <div class="form-group" style="grid-column:span 2">
        <label class="form-label">Descripción</label>
        <textarea id="pDesc" rows="3" placeholder="Descripción del alcance del proyecto..." style="resize:vertical; width:100%; padding:10px 12px; border:1.5px solid var(--gray-mid); border-radius:4px; font-family:Barlow,sans-serif"></textarea>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-orange" onclick="guardarProyecto()">Guardar Proyecto</button>
    </div>`);
}

async function guardarProyecto() {
  const nombre = document.getElementById('pNombre').value.trim();
  if (!nombre) { toast('El nombre es requerido', 'error'); return; }
  try {
    await api.post('/api/proyectos', {
      nombre,
      cliente: document.getElementById('pCliente').value,
      ubicacion: document.getElementById('pUbicacion').value,
      moneda: document.getElementById('pMoneda').value,
      fecha_inicio: document.getElementById('pFechaInicio').value,
      fecha_fin: document.getElementById('pFechaFin').value,
      descripcion: document.getElementById('pDesc').value
    });
    hideModal();
    toast('Proyecto creado exitosamente');
    await loadProyectos();
  } catch (e) { toast(e.error || 'Error al guardar', 'error'); }
}

async function modalEditarProyecto(id) {
  const p = _proyectos.find(x => x.id_proyecto === id);
  if (!p) return;
  showModal('EDITAR PROYECTO', `
    <div class="form-grid form-grid-2">
      <div class="form-group" style="grid-column:span 2">
        <label class="form-label">Nombre *</label>
        <input type="text" id="pNombre" value="${sanitize(p.nombre)}">
      </div>
      <div class="form-group">
        <label class="form-label">Cliente</label>
        <input type="text" id="pCliente" value="${sanitize(p.cliente || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Ubicación</label>
        <input type="text" id="pUbicacion" value="${sanitize(p.ubicacion || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Moneda</label>
        <select id="pMoneda">
          <option ${p.moneda === 'HNL' ? 'selected' : ''} value="HNL">HNL</option>
          <option ${p.moneda === 'USD' ? 'selected' : ''} value="USD">USD</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Estado</label>
        <select id="pEstado">
          <option ${p.estado === 'activo' ? 'selected' : ''} value="activo">Activo</option>
          <option ${p.estado === 'finalizado' ? 'selected' : ''} value="finalizado">Finalizado</option>
          <option ${p.estado === 'archivado' ? 'selected' : ''} value="archivado">Archivado</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Fecha Inicio</label>
        <input type="date" id="pFechaInicio" value="${p.fecha_inicio || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Fecha Fin</label>
        <input type="date" id="pFechaFin" value="${p.fecha_fin || ''}">
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="actualizarProyecto(${id})">Actualizar</button>
    </div>`);
}

async function actualizarProyecto(id) {
  try {
    await api.put(`/api/proyectos/${id}`, {
      nombre: document.getElementById('pNombre').value,
      cliente: document.getElementById('pCliente').value,
      ubicacion: document.getElementById('pUbicacion').value,
      moneda: document.getElementById('pMoneda').value,
      estado: document.getElementById('pEstado').value,
      fecha_inicio: document.getElementById('pFechaInicio').value,
      fecha_fin: document.getElementById('pFechaFin').value
    });
    hideModal();
    toast('Proyecto actualizado');
    await loadProyectos();
  } catch (e) { toast(e.error || 'Error', 'error'); }
}

async function verPresupuestosProyecto(idProyecto, nombre) {
  navigateTo('presupuestos', { idProyecto, nombre });
}
