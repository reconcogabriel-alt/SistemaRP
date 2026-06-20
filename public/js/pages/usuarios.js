// ============ MÓDULO: ADMINISTRACIÓN DE USUARIOS ============
// Solo accesible para rol 'admin'

async function renderUsuarios() {
  const content = document.getElementById('pageContent');

  let me;
  try { me = await api.get('/api/auth/me'); } catch { return; }
  if (me.rol !== 'admin') {
    content.innerHTML = `
      <div class="page-header"><h2 class="page-title">Administración de Usuarios</h2></div>
      <div class="empty-state">
        <div class="empty-icon">🔒</div>
        <p>Acceso restringido — solo administradores</p>
      </div>`;
    return;
  }

  content.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">⚙ Administración de Usuarios</h2>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-top:4px">Gestión de acceso al sistema — solo visible para administradores</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="abrirModalNuevoUsuario()">+ Nuevo Usuario</button>
      </div>
    </div>

    <div id="statsUsuarios" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px"></div>

    <div class="card">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
        <span class="card-title">Usuarios del Sistema</span>
        <input type="search" id="buscarUsuario" placeholder="Buscar nombre o correo…"
          style="padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text);width:220px;font-size:0.85rem"
          oninput="filtrarUsuarios(this.value)">
      </div>
      <div class="table-wrap">
        <table class="data-table" id="tablaUsuarios">
          <thead>
            <tr>
              <th>#</th>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Creado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="tbodyUsuarios">
            <tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">Cargando…</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="card-header"><span class="card-title">🔑 Cambiar Mi Contraseña</span></div>
      <div style="padding:20px;max-width:400px;display:grid;gap:14px">
        <div class="field-group">
          <label>Contraseña actual</label>
          <input type="password" id="passActual" placeholder="••••••••">
        </div>
        <div class="field-group">
          <label>Nueva contraseña (mín. 6 caracteres)</label>
          <input type="password" id="passNueva" placeholder="••••••••">
        </div>
        <div class="field-group">
          <label>Confirmar nueva contraseña</label>
          <input type="password" id="passConfirm" placeholder="••••••••">
        </div>
        <button class="btn btn-primary" onclick="cambiarMiPassword()" style="width:fit-content">Actualizar Contraseña</button>
      </div>
    </div>
  `;

  await cargarUsuarios();
}

let _usuariosData = [];

async function cargarUsuarios() {
  try {
    _usuariosData = await api.get('/api/usuarios');
    renderTablaUsuarios(_usuariosData);
    renderStatsUsuarios(_usuariosData);
  } catch (e) {
    toast('Error cargando usuarios: ' + (e.error || e.message), 'error');
  }
}

function renderStatsUsuarios(lista) {
  const container = document.getElementById('statsUsuarios');
  if (!container) return;
  const total      = lista.length;
  const admins     = lista.filter(u => u.rol === 'admin').length;
  const activos    = lista.filter(u => u.activo).length;
  const ingenieros = lista.filter(u => u.rol === 'ingeniero').length;
  container.innerHTML = `
    ${suCard('◈', 'Total Usuarios',   total,      '#3b82f6')}
    ${suCard('★', 'Administradores',  admins,     '#f59e0b')}
    ${suCard('✓', 'Activos',          activos,    '#10b981')}
    ${suCard('◎', 'Ingenieros',       ingenieros, '#6366f1')}
  `;
}

function suCard(icon, label, value, color) {
  return `
    <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:16px 20px;display:flex;align-items:center;gap:14px">
      <div style="font-size:1.6rem;color:${color}">${icon}</div>
      <div>
        <div style="font-size:1.5rem;font-weight:700;color:var(--text);line-height:1">${value}</div>
        <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px">${label}</div>
      </div>
    </div>`;
}

const _rolBadge = {
  admin:     `<span style="background:#f59e0b22;color:#f59e0b;padding:2px 10px;border-radius:99px;font-size:0.78rem;font-weight:600">ADMIN</span>`,
  ingeniero: `<span style="background:#6366f122;color:#6366f1;padding:2px 10px;border-radius:99px;font-size:0.78rem;font-weight:600">INGENIERO</span>`,
  consulta:  `<span style="background:#10b98122;color:#10b981;padding:2px 10px;border-radius:99px;font-size:0.78rem;font-weight:600">CONSULTA</span>`,
};

function renderTablaUsuarios(lista) {
  const tbody = document.getElementById('tbodyUsuarios');
  if (!tbody) return;
  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">Sin usuarios registrados</td></tr>`;
    return;
  }
  tbody.innerHTML = lista.map((u, i) => `
    <tr style="${!u.activo ? 'opacity:0.5' : ''}">
      <td style="color:var(--text-muted);font-size:0.8rem">${i + 1}</td>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;flex-shrink:0">
            ${sanitize(u.nombre[0].toUpperCase())}
          </div>
          <span style="font-weight:500">${sanitize(u.nombre)}</span>
        </div>
      </td>
      <td style="color:var(--text-muted);font-size:0.88rem">${sanitize(u.correo)}</td>
      <td>${_rolBadge[u.rol] || u.rol}</td>
      <td>
        <span style="background:${u.activo ? '#10b98122' : '#ef444422'};color:${u.activo ? '#10b981' : '#ef4444'};padding:2px 10px;border-radius:99px;font-size:0.78rem;font-weight:600">
          ${u.activo ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td style="color:var(--text-muted);font-size:0.82rem">${u.fecha_creacion ? u.fecha_creacion.slice(0,10) : '—'}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary btn-sm" onclick="abrirModalEditarUsuario(${u.id_usuario})" title="Editar">✏</button>
          <button class="btn btn-secondary btn-sm"
            onclick="toggleActivoUsuario(${u.id_usuario}, ${u.activo ? 0 : 1}, '${sanitize(u.nombre)}')"
            title="${u.activo ? 'Desactivar' : 'Activar'}">
            ${u.activo ? '⏸' : '▶'}
          </button>
          <button class="btn btn-danger btn-sm" onclick="eliminarUsuario(${u.id_usuario}, '${sanitize(u.nombre)}')" title="Eliminar">✕</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filtrarUsuarios(q) {
  const lower = q.toLowerCase();
  renderTablaUsuarios(_usuariosData.filter(u =>
    u.nombre.toLowerCase().includes(lower) || u.correo.toLowerCase().includes(lower)
  ));
}

function abrirModalNuevoUsuario() {
  showModal('Nuevo Usuario', `
    <div style="display:grid;gap:16px;padding:4px 0">
      <div class="field-group">
        <label>Nombre completo *</label>
        <input type="text" id="nu_nombre" placeholder="Ej: Juan Pérez García" autocomplete="off">
      </div>
      <div class="field-group">
        <label>Correo electrónico *</label>
        <input type="email" id="nu_correo" placeholder="correo@empresa.hn" autocomplete="off">
      </div>
      <div class="field-group">
        <label>Contraseña *</label>
        <input type="password" id="nu_pass" placeholder="Mínimo 6 caracteres" autocomplete="new-password">
      </div>
      <div class="field-group">
        <label>Rol</label>
        <select id="nu_rol">
          <option value="ingeniero">Ingeniero — acceso completo sin administración</option>
          <option value="consulta">Consulta — solo lectura</option>
        </select>
      </div>
      <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:12px;font-size:0.82rem;color:var(--text-muted)">
        <strong style="color:var(--text)">Roles:</strong><br>
        <b>Ingeniero</b>: crea/edita presupuestos y reportes<br>
        <b>Consulta</b>: solo visualización, sin crear ni editar
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:4px">
        <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="guardarNuevoUsuario()">Crear Usuario</button>
      </div>
    </div>
  `);
}

async function guardarNuevoUsuario() {
  const nombre = document.getElementById('nu_nombre')?.value?.trim();
  const correo = document.getElementById('nu_correo')?.value?.trim();
  const pass   = document.getElementById('nu_pass')?.value;
  const rol    = document.getElementById('nu_rol')?.value;
  if (!nombre || !correo || !pass) { toast('Complete todos los campos requeridos', 'error'); return; }
  if (pass.length < 6) { toast('La contraseña debe tener al menos 6 caracteres', 'error'); return; }
  try {
    await api.post('/api/usuarios', { nombre, correo, contrasena: pass, rol });
    hideModal();
    toast('Usuario creado exitosamente', 'success');
    await cargarUsuarios();
  } catch (e) {
    toast(e.error || 'Error al crear usuario', 'error');
  }
}

function abrirModalEditarUsuario(id) {
  const u = _usuariosData.find(x => x.id_usuario === id);
  if (!u) return;
  showModal('Editar Usuario', `
    <div style="display:grid;gap:16px;padding:4px 0">
      <div class="field-group">
        <label>Nombre completo</label>
        <input type="text" id="eu_nombre" value="${sanitize(u.nombre)}">
      </div>
      <div class="field-group">
        <label>Correo electrónico</label>
        <input type="email" id="eu_correo" value="${sanitize(u.correo)}">
      </div>
      <div class="field-group">
        <label>Rol</label>
        <select id="eu_rol">
          <option value="ingeniero" ${u.rol==='ingeniero'?'selected':''}>Ingeniero</option>
          <option value="consulta"  ${u.rol==='consulta' ?'selected':''}>Consulta</option>
        </select>
      </div>
      <div class="field-group">
        <label>Nueva contraseña <span style="color:var(--text-muted);font-weight:400">(vacío = no cambia)</span></label>
        <input type="password" id="eu_pass" placeholder="••••••••" autocomplete="new-password">
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:4px">
        <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="guardarEdicionUsuario(${id})">Guardar Cambios</button>
      </div>
    </div>
  `);
}

async function guardarEdicionUsuario(id) {
  const nombre = document.getElementById('eu_nombre')?.value?.trim();
  const correo = document.getElementById('eu_correo')?.value?.trim();
  const rol    = document.getElementById('eu_rol')?.value;
  const pass   = document.getElementById('eu_pass')?.value;
  const payload = {};
  if (nombre) payload.nombre = nombre;
  if (correo) payload.correo = correo;
  if (rol)    payload.rol = rol;
  if (pass)   {
    if (pass.length < 6) { toast('La contraseña debe tener al menos 6 caracteres', 'error'); return; }
    payload.contrasena = pass;
  }
  try {
    await api.put(`/api/usuarios/${id}`, payload);
    hideModal();
    toast('Usuario actualizado', 'success');
    await cargarUsuarios();
  } catch (e) {
    toast(e.error || 'Error al actualizar', 'error');
  }
}

async function toggleActivoUsuario(id, nuevoEstado, nombre) {
  if (!confirm(`¿Desea ${nuevoEstado ? 'activar' : 'desactivar'} al usuario "${nombre}"?`)) return;
  try {
    await api.patch(`/api/usuarios/${id}/activo`, { activo: nuevoEstado });
    toast(`Usuario ${nuevoEstado ? 'activado' : 'desactivado'}`, 'success');
    await cargarUsuarios();
  } catch (e) {
    toast(e.error || 'Error al cambiar estado', 'error');
  }
}

async function eliminarUsuario(id, nombre) {
  if (!confirm(`¿Eliminar permanentemente al usuario "${nombre}"?\n\nEsta acción no se puede deshacer.`)) return;
  try {
    await api.del(`/api/usuarios/${id}`);
    toast('Usuario eliminado', 'info');
    await cargarUsuarios();
  } catch (e) {
    toast(e.error || 'Error al eliminar', 'error');
  }
}

async function cambiarMiPassword() {
  const actual   = document.getElementById('passActual')?.value;
  const nueva    = document.getElementById('passNueva')?.value;
  const confirm_ = document.getElementById('passConfirm')?.value;
  if (!actual || !nueva || !confirm_) { toast('Complete todos los campos', 'error'); return; }
  if (nueva !== confirm_) { toast('Las contraseñas nuevas no coinciden', 'error'); return; }
  if (nueva.length < 6)  { toast('Mínimo 6 caracteres', 'error'); return; }
  try {
    await api.put('/api/usuarios/me/password', { actual, nueva });
    toast('Contraseña actualizada correctamente', 'success');
    document.getElementById('passActual').value  = '';
    document.getElementById('passNueva').value   = '';
    document.getElementById('passConfirm').value = '';
  } catch (e) {
    toast(e.error || 'Error al cambiar contraseña', 'error');
  }
}
