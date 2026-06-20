/* ============================================================
   PROVEEDORES — Administración / Financiero
   ============================================================ */

let _provData = [];

async function renderProveedores() {
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">🤝 Proveedores</h2>
        <p class="page-sub">Directorio de proveedores de materiales, servicios y subcontratos</p>
      </div>
      <button class="btn btn-orange" onclick="modalNuevoProv()">+ Nuevo Proveedor</button>
    </div>
    <div class="panel-toolbar">
      <input type="text" id="provQ" placeholder="Buscar por nombre o RTN..." oninput="provFiltrar()">
      <select id="provCat" onchange="provFiltrar()">
        <option value="">Todas las categorías</option>
        <option value="materiales">Materiales</option>
        <option value="subcontrato">Subcontrato</option>
        <option value="equipo">Equipo</option>
        <option value="servicios">Servicios</option>
        <option value="general">General</option>
      </select>
      <button class="btn btn-secondary" onclick="cargarProveedores()">🔄 Actualizar</button>
    </div>
    <div id="provResumen" style="margin-bottom:12px"></div>
    <div class="table-container">
      <table class="data-table" id="tablaProveedores">
        <thead>
          <tr>
            <th>Nombre</th><th>RTN</th><th>Categoría</th><th>Contacto</th>
            <th>Teléfono</th><th>Correo</th><th class="num">OCs</th><th>⭐</th><th></th>
          </tr>
        </thead>
        <tbody id="provBody"><tr><td colspan="9" class="loading">Cargando...</td></tr></tbody>
      </table>
    </div>

    <!-- Modal proveedor -->
    <div id="modalProv" class="modal-overlay hidden">
      <div class="modal-box" style="max-width:520px">
        <div class="modal-header">
          <h3 id="modalProvTit">Nuevo Proveedor</h3>
          <button onclick="hideModal('modalProv')" class="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="provId">
          <div class="form-grid-2">
            <div class="form-group form-span2">
              <label>Nombre *</label>
              <input type="text" id="provNombre" placeholder="Nombre del proveedor">
            </div>
            <div class="form-group">
              <label>RTN</label>
              <input type="text" id="provRtn" placeholder="XXXX-XXXX-XXXXXX">
            </div>
            <div class="form-group">
              <label>Categoría</label>
              <select id="provCategoria">
                <option value="general">General</option>
                <option value="materiales">Materiales</option>
                <option value="subcontrato">Subcontrato</option>
                <option value="equipo">Equipo</option>
                <option value="servicios">Servicios</option>
              </select>
            </div>
            <div class="form-group">
              <label>Contacto</label>
              <input type="text" id="provContacto" placeholder="Nombre del contacto">
            </div>
            <div class="form-group">
              <label>Teléfono</label>
              <input type="text" id="provTelefono" placeholder="XXXX-XXXX">
            </div>
            <div class="form-group">
              <label>Correo</label>
              <input type="email" id="provCorreo" placeholder="correo@ejemplo.com">
            </div>
            <div class="form-group form-span2">
              <label>Dirección</label>
              <input type="text" id="provDireccion" placeholder="Dirección del proveedor">
            </div>
            <div class="form-group form-span2">
              <label>Notas</label>
              <textarea id="provNotas" rows="2" placeholder="Observaciones..."></textarea>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="hideModal('modalProv')">Cancelar</button>
          <button class="btn btn-orange" onclick="guardarProveedor()">💾 Guardar</button>
        </div>
      </div>
    </div>`;

  await cargarProveedores();
}

async function cargarProveedores() {
  try {
    _provData = await api.get('/api/admin-financiero/proveedores');
    document.getElementById('provResumen').innerHTML =
      `<span class="badge badge-info">${_provData.length} proveedores activos</span>`;
    provFiltrar();
  } catch(e) {
    document.getElementById('provBody').innerHTML = `<tr><td colspan="9" class="error-msg">${e.message}</td></tr>`;
  }
}

function provFiltrar() {
  const q = (document.getElementById('provQ')?.value||'').toLowerCase();
  const cat = document.getElementById('provCat')?.value||'';
  const data = _provData.filter(p =>
    (!q || p.nombre.toLowerCase().includes(q) || (p.rtn||'').includes(q)) &&
    (!cat || p.categoria === cat)
  );

  const CATS = { materiales:'🧱 Materiales', subcontrato:'🔧 Subcontrato',
                 equipo:'🚜 Equipo', servicios:'📋 Servicios', general:'🏪 General' };
  const body = document.getElementById('provBody');
  if (!data.length) { body.innerHTML = '<tr><td colspan="9" class="empty-msg">Sin proveedores.</td></tr>'; return; }

  body.innerHTML = data.map(p => `
    <tr>
      <td><strong>${p.nombre}</strong></td>
      <td>${p.rtn||'—'}</td>
      <td><span class="badge badge-blue">${CATS[p.categoria]||p.categoria}</span></td>
      <td>${p.contacto||'—'}</td>
      <td>${p.telefono||'—'}</td>
      <td>${p.correo||'—'}</td>
      <td class="num">${p.num_oc}</td>
      <td class="num">${'⭐'.repeat(Math.round(p.calificacion||0))||'—'}</td>
      <td>
        <button class="btn-icon" title="Editar" onclick="editarProveedor(${p.id_prov})">✏️</button>
        <button class="btn-icon" title="Ver OCs" onclick="navigateTo('ordenes_compra',{id_prov:${p.id_prov}})">🛒</button>
        <button class="btn-icon danger" title="Desactivar" onclick="eliminarProveedor(${p.id_prov},'${p.nombre.replace(/'/g,"\\'")}')">🗑</button>
      </td>
    </tr>`).join('');
}

function modalNuevoProv() {
  document.getElementById('provId').value = '';
  document.getElementById('modalProvTit').textContent = 'Nuevo Proveedor';
  ['provNombre','provRtn','provContacto','provTelefono','provCorreo','provDireccion','provNotas'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('provCategoria').value = 'general';
  showModal('modalProv');
}

function editarProveedor(id) {
  const p = _provData.find(x => x.id_prov === id);
  if (!p) return;
  document.getElementById('provId').value = p.id_prov;
  document.getElementById('modalProvTit').textContent = 'Editar Proveedor';
  document.getElementById('provNombre').value = p.nombre||'';
  document.getElementById('provRtn').value = p.rtn||'';
  document.getElementById('provCategoria').value = p.categoria||'general';
  document.getElementById('provContacto').value = p.contacto||'';
  document.getElementById('provTelefono').value = p.telefono||'';
  document.getElementById('provCorreo').value = p.correo||'';
  document.getElementById('provDireccion').value = p.direccion||'';
  document.getElementById('provNotas').value = p.notas||'';
  showModal('modalProv');
}

async function guardarProveedor() {
  const id = document.getElementById('provId').value;
  const nombre = document.getElementById('provNombre').value.trim();
  if (!nombre) { toast('El nombre es requerido','error'); return; }
  const body = {
    nombre,
    rtn:        document.getElementById('provRtn').value.trim(),
    categoria:  document.getElementById('provCategoria').value,
    contacto:   document.getElementById('provContacto').value.trim(),
    telefono:   document.getElementById('provTelefono').value.trim(),
    correo:     document.getElementById('provCorreo').value.trim(),
    direccion:  document.getElementById('provDireccion').value.trim(),
    notas:      document.getElementById('provNotas').value.trim(),
  };
  try {
    if (id) {
      await api.put(`/api/admin-financiero/proveedores/${id}`, body);
      toast('Proveedor actualizado ✅');
    } else {
      await api.post('/api/admin-financiero/proveedores', body);
      toast('Proveedor registrado ✅');
    }
    hideModal('modalProv');
    await cargarProveedores();
  } catch(e) { toast(e.message,'error'); }
}

async function eliminarProveedor(id, nombre) {
  if (!confirm(`¿Desactivar al proveedor "${nombre}"?`)) return;
  try {
    await api.delete(`/api/admin-financiero/proveedores/${id}`);
    toast('Proveedor desactivado');
    await cargarProveedores();
  } catch(e) { toast(e.message,'error'); }
}
