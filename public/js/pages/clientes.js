// ══════════════════════════════════════════════════════════
//  MÓDULO: CLIENTES  —  solo administrador
// ══════════════════════════════════════════════════════════

let _clientesData = [];

async function renderClientes(ctx = {}) {
  const el = document.getElementById('pageContent');

  // Verificar que sea admin
  let me;
  try { me = await api.get('/api/auth/me'); } catch { return; }
  if (me.rol !== 'admin') {
    el.innerHTML = `
      <div class="page-header"><div class="page-title">CLIENTES</div></div>
      <div class="card"><div class="card-body" style="text-align:center;padding:60px;color:var(--text-muted)">
        <div style="font-size:48px;margin-bottom:12px">🔒</div>
        <div style="font-weight:600">Acceso restringido</div>
        <div style="font-size:13px;margin-top:6px">Solo el administrador puede acceder a este módulo</div>
      </div></div>`;
    return;
  }

  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">CLIENTES</div>
        <div class="page-subtitle" id="cliSubtitle">Cargando…</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" onclick="modalNuevoCliente()">＋ Nuevo cliente</button>
      </div>
    </div>

    <div class="page-body">
      <!-- Stats -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
        <div class="stat-card"><div class="stat-value" id="cliStatTotal" style="color:var(--blue)">—</div><div class="stat-label">Total clientes</div></div>
        <div class="stat-card"><div class="stat-value" id="cliStatActivos" style="color:#1A7A3C">—</div><div class="stat-label">Activos</div></div>
        <div class="stat-card"><div class="stat-value" id="cliStatInactivos" style="color:#8C9BAD">—</div><div class="stat-label">Inactivos</div></div>
      </div>

      <div class="card">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
          <span class="card-title">REGISTRO DE CLIENTES</span>
          <input type="text" id="busqCliente" placeholder="Buscar por nombre, empresa o correo…"
            style="padding:7px 12px;border:1.5px solid #d4dbe3;border-radius:4px;font-size:13px;width:280px"
            oninput="filtrarClientes(this.value)" />
        </div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:#f0f3f6;border-bottom:2px solid #d4dbe3">
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#025196;letter-spacing:.5px">#</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#025196;letter-spacing:.5px">NOMBRE</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#025196;letter-spacing:.5px">EMPRESA</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#025196;letter-spacing:.5px">CORREO</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#025196;letter-spacing:.5px">TELÉFONO</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#025196;letter-spacing:.5px">ESTADO</th>
                <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:#025196;letter-spacing:.5px">ACCIONES</th>
              </tr>
            </thead>
            <tbody id="cliTabla">
              <tr><td colspan="7" style="padding:40px;text-align:center;color:var(--text-muted)">Cargando…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

  await cargarClientes();
}

async function cargarClientes() {
  try {
    _clientesData = await api.get('/api/clientes');
    renderTablaClientes(_clientesData);
    actualizarStatsClientes(_clientesData);
  } catch(e) {
    toast(e.error || 'Error cargando clientes', 'error');
  }
}

function actualizarStatsClientes(lista) {
  document.getElementById('cliStatTotal').textContent    = lista.length;
  document.getElementById('cliStatActivos').textContent  = lista.filter(c => c.activo).length;
  document.getElementById('cliStatInactivos').textContent = lista.filter(c => !c.activo).length;
  const sub = document.getElementById('cliSubtitle');
  if (sub) sub.textContent = `${lista.length} clientes registrados`;
}

function renderTablaClientes(lista) {
  const tbody = document.getElementById('cliTabla');
  if (!tbody) return;
  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="padding:40px;text-align:center;color:var(--text-muted)">Sin clientes registrados</td></tr>`;
    return;
  }
  tbody.innerHTML = lista.map((c, i) => `
    <tr style="border-bottom:1px solid #d4dbe3;${!c.activo?'opacity:.55':''}">
      <td style="padding:10px 14px;color:#8C9BAD;font-size:12px">${i+1}</td>
      <td style="padding:10px 14px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:34px;height:34px;border-radius:50%;background:#025196;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0">
            ${sanitize(c.nombre[0].toUpperCase())}
          </div>
          <div>
            <div style="font-weight:600;color:#1a2332">${sanitize(c.nombre)}</div>
            ${c.contacto ? `<div style="font-size:11px;color:#8C9BAD">${sanitize(c.contacto)}</div>` : ''}
          </div>
        </div>
      </td>
      <td style="padding:10px 14px;color:#1a2332">${sanitize(c.empresa) || '—'}</td>
      <td style="padding:10px 14px;color:#5a6878;font-size:12px">${sanitize(c.correo) || '—'}</td>
      <td style="padding:10px 14px;color:#5a6878;font-size:12px">${sanitize(c.telefono) || '—'}</td>
      <td style="padding:10px 14px">
        <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:3px;
          background:${c.activo?'#C6EFCE':'#f0f3f6'};color:${c.activo?'#1A7A3C':'#8C9BAD'}">
          ${c.activo ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td style="padding:10px 14px;text-align:center">
        <div style="display:flex;gap:6px;justify-content:center">
          <button class="btn btn-secondary btn-sm" onclick="modalVerCliente(${c.id_cliente})" title="Ver detalle">👁</button>
          <button class="btn btn-secondary btn-sm" onclick="modalEditarCliente(${c.id_cliente})" title="Editar">✏️</button>
          <button class="btn btn-secondary btn-sm" onclick="toggleActivoCliente(${c.id_cliente},${c.activo?0:1},'${sanitize(c.nombre)}')" title="${c.activo?'Desactivar':'Activar'}">
            ${c.activo ? '⏸' : '▶'}
          </button>
          <button class="btn btn-danger btn-sm" onclick="eliminarCliente(${c.id_cliente},'${sanitize(c.nombre)}')" title="Eliminar">✕</button>
        </div>
      </td>
    </tr>`).join('');
}

function filtrarClientes(q) {
  const lower = q.toLowerCase();
  renderTablaClientes(_clientesData.filter(c =>
    (c.nombre||'').toLowerCase().includes(lower) ||
    (c.empresa||'').toLowerCase().includes(lower) ||
    (c.correo||'').toLowerCase().includes(lower)
  ));
}

// ── Formulario compartido ────────────────────────────────
function _formCliente(vals = {}) {
  const v = (campo) => sanitize(vals[campo] || '');
  return `
    <div class="form-grid form-grid-2" style="margin-bottom:12px">
      <div class="form-group">
        <label class="form-label">Nombre *</label>
        <input type="text" id="cliNombre" value="${v('nombre')}" placeholder="Nombre completo" />
      </div>
      <div class="form-group">
        <label class="form-label">Empresa / Organización</label>
        <input type="text" id="cliEmpresa" value="${v('empresa')}" placeholder="Nombre de la empresa" />
      </div>
    </div>
    <div class="form-grid form-grid-2" style="margin-bottom:12px">
      <div class="form-group">
        <label class="form-label">Correo electrónico</label>
        <input type="email" id="cliCorreo" value="${v('correo')}" placeholder="correo@empresa.hn" />
      </div>
      <div class="form-group">
        <label class="form-label">Teléfono</label>
        <input type="text" id="cliTelefono" value="${v('telefono')}" placeholder="+504 0000-0000" />
      </div>
    </div>
    <div class="form-grid form-grid-2" style="margin-bottom:12px">
      <div class="form-group">
        <label class="form-label">RTN / NIT</label>
        <input type="text" id="cliNit" value="${v('nit')}" placeholder="Número fiscal" />
      </div>
      <div class="form-group">
        <label class="form-label">Persona de contacto</label>
        <input type="text" id="cliContacto" value="${v('contacto')}" placeholder="Nombre del contacto principal" />
      </div>
    </div>
    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label">Dirección</label>
      <input type="text" id="cliDireccion" value="${v('direccion')}" placeholder="Dirección completa" />
    </div>
    <div class="form-group" style="margin-bottom:18px">
      <label class="form-label">Notas</label>
      <textarea id="cliNotas" rows="3"
        style="width:100%;padding:8px 10px;border:1.5px solid #d4dbe3;border-radius:4px;font-size:13px;resize:vertical;font-family:inherit"
        placeholder="Observaciones, condiciones comerciales, referencias…">${v('notas')}</textarea>
    </div>`;
}

function _getDatos() {
  return {
    nombre:    (document.getElementById('cliNombre')?.value || '').trim(),
    empresa:   (document.getElementById('cliEmpresa')?.value || '').trim(),
    correo:    (document.getElementById('cliCorreo')?.value || '').trim(),
    telefono:  (document.getElementById('cliTelefono')?.value || '').trim(),
    nit:       (document.getElementById('cliNit')?.value || '').trim(),
    contacto:  (document.getElementById('cliContacto')?.value || '').trim(),
    direccion: (document.getElementById('cliDireccion')?.value || '').trim(),
    notas:     (document.getElementById('cliNotas')?.value || '').trim(),
  };
}

// ── Nuevo cliente ────────────────────────────────────────
function modalNuevoCliente() {
  showModal('NUEVO CLIENTE', `
    ${_formCliente()}
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-orange" onclick="guardarNuevoCliente()">💾 Guardar cliente</button>
    </div>
  `, 'modal-lg');
}

async function guardarNuevoCliente() {
  const datos = _getDatos();
  if (!datos.nombre) { toast('El nombre del cliente es obligatorio', 'error'); return; }
  try {
    await api.post('/api/clientes', datos);
    hideModal();
    toast('Cliente registrado correctamente');
    await cargarClientes();
  } catch(e) { toast(e.error || 'Error al guardar', 'error'); }
}

// ── Editar cliente ───────────────────────────────────────
async function modalEditarCliente(id) {
  const c = _clientesData.find(x => x.id_cliente === id);
  if (!c) return;
  showModal('EDITAR CLIENTE — ' + sanitize(c.nombre), `
    ${_formCliente(c)}
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarEdicionCliente(${id})">💾 Actualizar</button>
    </div>
  `, 'modal-lg');
}

async function guardarEdicionCliente(id) {
  const datos = _getDatos();
  if (!datos.nombre) { toast('El nombre del cliente es obligatorio', 'error'); return; }
  try {
    await api.put(`/api/clientes/${id}`, datos);
    hideModal();
    toast('Cliente actualizado');
    await cargarClientes();
  } catch(e) { toast(e.error || 'Error al actualizar', 'error'); }
}

// ── Ver detalle ──────────────────────────────────────────
function modalVerCliente(id) {
  const c = _clientesData.find(x => x.id_cliente === id);
  if (!c) return;
  const fila = (label, val) => val
    ? `<tr><td style="padding:7px 0;color:#8C9BAD;font-size:12px;width:140px;font-weight:600">${label}</td>
           <td style="padding:7px 0;color:#1a2332;font-size:13px">${sanitize(val)}</td></tr>`
    : '';
  showModal('DETALLE CLIENTE — ' + sanitize(c.nombre), `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;padding-bottom:16px;border-bottom:1px solid #d4dbe3">
      <div style="width:52px;height:52px;border-radius:50%;background:#025196;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;flex-shrink:0">
        ${sanitize(c.nombre[0].toUpperCase())}
      </div>
      <div>
        <div style="font-weight:700;font-size:16px;color:#1a2332">${sanitize(c.nombre)}</div>
        ${c.empresa ? `<div style="font-size:13px;color:#5a6878">${sanitize(c.empresa)}</div>` : ''}
        <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:3px;
          background:${c.activo?'#C6EFCE':'#f0f3f6'};color:${c.activo?'#1A7A3C':'#8C9BAD'}">
          ${c.activo ? 'Activo' : 'Inactivo'}
        </span>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse">
      ${fila('Correo', c.correo)}
      ${fila('Teléfono', c.telefono)}
      ${fila('RTN / NIT', c.nit)}
      ${fila('Contacto', c.contacto)}
      ${fila('Dirección', c.direccion)}
      ${fila('Notas', c.notas)}
      ${fila('Registrado', c.fecha_creacion ? c.fecha_creacion.slice(0,10) : '')}
    </table>
    <div class="form-actions" style="margin-top:16px">
      <button class="btn btn-secondary" onclick="hideModal()">Cerrar</button>
      <button class="btn btn-primary" onclick="hideModal();modalEditarCliente(${id})">✏️ Editar</button>
    </div>
  `);
}

// ── Activar / Desactivar ─────────────────────────────────
async function toggleActivoCliente(id, nuevoEstado, nombre) {
  if (!confirm(`¿Desea ${nuevoEstado ? 'activar' : 'desactivar'} al cliente "${nombre}"?`)) return;
  try {
    await api.patch(`/api/clientes/${id}/activo`, { activo: nuevoEstado });
    toast(`Cliente ${nuevoEstado ? 'activado' : 'desactivado'}`);
    await cargarClientes();
  } catch(e) { toast(e.error || 'Error', 'error'); }
}

// ── Eliminar ─────────────────────────────────────────────
async function eliminarCliente(id, nombre) {
  if (!confirm(`¿Eliminar permanentemente al cliente "${nombre}"?\n\nEsta acción no se puede deshacer.`)) return;
  try {
    await api.del(`/api/clientes/${id}`);
    toast('Cliente eliminado', 'info');
    await cargarClientes();
  } catch(e) { toast(e.error || 'Error al eliminar', 'error'); }
}
