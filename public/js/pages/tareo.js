/* ============================================================
   TAREO DIARIO / NÓMINA — Administración / Financiero
   ============================================================ */

let _tareoTab = 'tareo';
let _tareoPresupuestos = [], _tareoCuadrillas = [], _tareoTrabajadores = [], _tareoActividades = [];

async function renderTareo() {
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">👷 Registro Diario y Nómina</h2>
        <p class="page-sub">Control de asistencia diaria, destajos y resumen de planilla</p>
      </div>
    </div>
    <div class="bodega-tabs">
      <button class="tab-btn active" data-tab="tareo" onclick="tareoTab('tareo')">📋 Registro Diario</button>
      <button class="tab-btn" data-tab="cuadrillas" onclick="tareoTab('cuadrillas')">👥 Cuadrillas</button>
      <button class="tab-btn" data-tab="trabajadores" onclick="tareoTab('trabajadores')">👤 Trabajadores</button>
      <button class="tab-btn" data-tab="nomina" onclick="tareoTab('nomina')">💰 Nómina / Resumen</button>
    </div>

    <!-- TAB: Registro Diario -->
    <div id="tabTareo" class="tab-panel">
      <div class="panel-toolbar">
        <input type="date" id="tareofecha" value="${new Date().toISOString().split('T')[0]}" onchange="cargarTareoFecha()">
        <select id="tareoPres" onchange="cargarTareoFecha()">
          <option value="">Todos los presupuestos</option>
        </select>
        <button class="btn btn-secondary" onclick="cargarTareoFecha()">🔄 Actualizar</button>
        <button class="btn btn-orange" onclick="modalNuevoTareo()">+ Registrar Día</button>
      </div>
      <div id="tareoResumenDia" style="margin-bottom:12px"></div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr><th>Trabajador</th><th>Cargo</th><th>Presupuesto</th><th>Actividad</th>
              <th class="num">H.Norm</th><th class="num">H.Extra</th><th>Tipo Pago</th>
              <th class="num">Monto Día (L)</th><th>Asistió</th></tr>
          </thead>
          <tbody id="tareoBody"><tr><td colspan="9" class="loading">Seleccione fecha...</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- TAB: Cuadrillas -->
    <div id="tabCuadrillas" class="tab-panel hidden">
      <div class="panel-toolbar">
        <button class="btn btn-secondary" onclick="cargarCuadrillas()">🔄 Actualizar</button>
        <button class="btn btn-orange" onclick="modalNuevaCuadrilla()">+ Nueva Cuadrilla</button>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead><tr><th>Cuadrilla</th><th>Capataz</th><th>Presupuesto</th><th class="num">Trabajadores</th><th></th></tr></thead>
          <tbody id="cuadrillasBody"><tr><td colspan="5" class="loading">Cargando...</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- TAB: Trabajadores -->
    <div id="tabTrabajadores" class="tab-panel hidden">
      <div class="panel-toolbar">
        <select id="filtroTrabCuadrilla" onchange="cargarTrabajadores()">
          <option value="">Todas las cuadrillas</option>
        </select>
        <button class="btn btn-secondary" onclick="cargarTrabajadores()">🔄 Actualizar</button>
        <button class="btn btn-orange" onclick="modalNuevoTrabajador()">+ Nuevo Trabajador</button>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead><tr><th>Nombre</th><th>Identidad</th><th>Cargo</th><th>Cuadrilla</th>
            <th class="num">Salario Base (L/día)</th><th>Ingreso</th><th></th></tr></thead>
          <tbody id="trabajadoresBody"><tr><td colspan="7" class="loading">Cargando...</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- TAB: Nómina -->
    <div id="tabNomina" class="tab-panel hidden">
      <div class="panel-toolbar">
        <label>Desde: <input type="date" id="nominaDesde"></label>
        <label>Hasta: <input type="date" id="nominaHasta"></label>
        <select id="nominaPres"><option value="">Todos los presupuestos</option></select>
        <button class="btn btn-orange" onclick="generarNomina()">📊 Generar Resumen</button>
      </div>
      <div id="nominaResult"></div>
    </div>

    <!-- Modal Tareo masivo -->
    <div id="modalTareo" class="modal-overlay hidden">
      <div class="modal-box" style="max-width:700px;max-height:90vh;overflow-y:auto">
        <div class="modal-header">
          <h3>📋 Registrar Día de Trabajo</h3>
          <button onclick="hideModal('modalTareo')" class="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-grid-2" style="margin-bottom:12px">
            <div class="form-group">
              <label>Fecha *</label>
              <input type="date" id="tareoModalFecha" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="form-group">
              <label>Presupuesto *</label>
              <select id="tareoModalPres"></select>
            </div>
            <div class="form-group">
              <label>Cuadrilla</label>
              <select id="tareoModalCuadrilla" onchange="tareoCargarTrabsModal()">
                <option value="">— Sin filtro —</option>
              </select>
            </div>
            <div class="form-group">
              <label>Actividad</label>
              <select id="tareoModalActividad">
                <option value="">— Sin actividad —</option>
              </select>
            </div>
          </div>
          <div style="overflow-x:auto">
            <table class="data-table" id="tareoModalTabla">
              <thead>
                <tr>
                  <th style="width:30px"><input type="checkbox" id="tareoCheckAll" onchange="tareoCheckTodos(this)"></th>
                  <th>Trabajador</th><th>Cargo</th>
                  <th class="num" style="width:80px">H.Norm</th>
                  <th class="num" style="width:80px">H.Extra</th>
                  <th style="width:110px">Tipo Pago</th>
                  <th class="num" style="width:100px">Destajo (L)</th>
                </tr>
              </thead>
              <tbody id="tareoModalBody"><tr><td colspan="7" class="empty-msg">Seleccione cuadrilla...</td></tr></tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="hideModal('modalTareo')">Cancelar</button>
          <button class="btn btn-orange" onclick="guardarTareo()">💾 Guardar Tareo</button>
        </div>
      </div>
    </div>

    <!-- Modal Cuadrilla -->
    <div id="modalCuadrilla" class="modal-overlay hidden">
      <div class="modal-box" style="max-width:400px">
        <div class="modal-header">
          <h3>Nueva Cuadrilla</h3>
          <button onclick="hideModal('modalCuadrilla')" class="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group"><label>Nombre *</label><input type="text" id="cuanombre" placeholder="Cuadrilla de albañilería"></div>
          <div class="form-group"><label>Capataz</label><input type="text" id="cuacapataz"></div>
          <div class="form-group"><label>Presupuesto</label><select id="cuapres"><option value="">— General —</option></select></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="hideModal('modalCuadrilla')">Cancelar</button>
          <button class="btn btn-orange" onclick="guardarCuadrilla()">💾 Guardar</button>
        </div>
      </div>
    </div>

    <!-- Modal Trabajador -->
    <div id="modalTrabajador" class="modal-overlay hidden">
      <div class="modal-box" style="max-width:440px">
        <div class="modal-header">
          <h3>Nuevo Trabajador</h3>
          <button onclick="hideModal('modalTrabajador')" class="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group"><label>Nombre completo *</label><input type="text" id="trabnombre"></div>
          <div class="form-group"><label>N° Identidad</label><input type="text" id="trabidentidad" placeholder="XXXX-XXXX-XXXXXXXX"></div>
          <div class="form-group"><label>Cargo</label>
            <select id="trabcargo">
              <option value="peon">Peón</option>
              <option value="ayudante">Ayudante</option>
              <option value="oficial">Oficial</option>
              <option value="maestro">Maestro</option>
              <option value="caporal">Caporal</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div class="form-group"><label>Salario Base (L/día)</label><input type="number" id="trabsalario" value="350" min="0" step="0.01"></div>
          <div class="form-group"><label>Cuadrilla</label>
            <select id="trabcuadrilla"><option value="">— Sin cuadrilla —</option></select>
          </div>
          <div class="form-group"><label>Fecha de ingreso</label><input type="date" id="trabingreso"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="hideModal('modalTrabajador')">Cancelar</button>
          <button class="btn btn-orange" onclick="guardarTrabajador()">💾 Guardar</button>
        </div>
      </div>
    </div>`;

  await tareoCargarCombos();
  cargarTareoFecha();
}

function tareoTab(tab) {
  _tareoTab = tab;
  document.querySelectorAll('.bodega-tabs .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  document.getElementById(`tab${tab.charAt(0).toUpperCase()+tab.slice(1)}`).classList.remove('hidden');
  if (tab==='cuadrillas') cargarCuadrillas();
  if (tab==='trabajadores') cargarTrabajadores();
}

async function tareoCargarCombos() {
  try {
    let actividadesResp;
    [_tareoPresupuestos, _tareoCuadrillas, _tareoTrabajadores, actividadesResp] = await Promise.all([
      api.get('/api/presupuestos'),
      api.get('/api/admin-financiero/cuadrillas'),
      api.get('/api/admin-financiero/trabajadores'),
      api.get('/api/actividades?limit=200').catch(()=>[]),
    ]);
    // /api/actividades devuelve { rows, total, limit, offset, hasMore } (paginado), no un array plano
    _tareoActividades = Array.isArray(actividadesResp) ? actividadesResp : (actividadesResp?.rows || []);
    // Llenar selects de presupuestos
    const presOpts = '<option value="">Todos</option>' +
      _tareoPresupuestos.map(p=>`<option value="${p.id_presupuesto}">${p.nombre}</option>`).join('');
    ['tareoPres','nominaPres'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = presOpts;
    });
    // Cuadrilla filtro trabajadores
    const cuaFilt = document.getElementById('filtroTrabCuadrilla');
    if (cuaFilt) cuaFilt.innerHTML = '<option value="">Todas las cuadrillas</option>' +
      _tareoCuadrillas.map(c=>`<option value="${c.id_cuadrilla}">${c.nombre}</option>`).join('');
  } catch(e) {
    console.warn('combos tareo', e);
    toast('No se pudieron cargar los datos del módulo: ' + e.message, 'error');
  }
}

async function cargarTareoFecha() {
  const fecha = document.getElementById('tareofecha')?.value;
  const proy  = document.getElementById('tareoPres')?.value;
  if (!fecha) return;
  try {
    let url = `/api/admin-financiero/tareo?fecha=${fecha}`;
    if (proy) url += `&id_presupuesto=${proy}`;
    const data = await api.get(url);
    const totalDia = data.reduce((s,r)=>s+(r.monto_dia||0),0);
    document.getElementById('tareoResumenDia').innerHTML =
      `<div style="display:flex;gap:12px;align-items:center">
        <span class="badge badge-blue">${data.length} registros</span>
        <span class="badge badge-green">Total día: L ${totalDia.toLocaleString('es-HN',{minimumFractionDigits:2})}</span>
      </div>`;

    const body = document.getElementById('tareoBody');
    const CARGOS = { maestro:'🎓 Maestro', oficial:'⚒️ Oficial', ayudante:'🔨 Ayudante',
                     peon:'👷 Peón', caporal:'🦺 Caporal', otro:'👤 Otro' };
    if (!data.length) { body.innerHTML='<tr><td colspan="9" class="empty-msg">Sin registros para esta fecha.</td></tr>'; return; }

    body.innerHTML = data.map(r => `
      <tr>
        <td><strong>${r.trabajador}</strong></td>
        <td>${CARGOS[r.cargo]||r.cargo}</td>
        <td>${r.presupuesto}</td>
        <td>${r.actividad||'—'}</td>
        <td class="num">${r.horas_normales}</td>
        <td class="num">${r.horas_extra||0}</td>
        <td>${r.tipo_pago}</td>
        <td class="num"><strong>L ${(r.monto_dia||0).toLocaleString('es-HN',{minimumFractionDigits:2})}</strong></td>
        <td style="text-align:center">${r.asistio?'✅':'❌'}</td>
      </tr>`).join('');
  } catch(e) {
    document.getElementById('tareoBody').innerHTML = `<tr><td colspan="9" class="error-msg">${e.message}</td></tr>`;
  }
}

async function cargarCuadrillas() {
  try {
    _tareoCuadrillas = await api.get('/api/admin-financiero/cuadrillas');
    const body = document.getElementById('cuadrillasBody');
    if (!_tareoCuadrillas.length) { body.innerHTML='<tr><td colspan="5" class="empty-msg">Sin cuadrillas.</td></tr>'; return; }
    body.innerHTML = _tareoCuadrillas.map(c=>`
      <tr>
        <td><strong>${c.nombre}</strong></td>
        <td>${c.capataz||'—'}</td>
        <td>${c.presupuesto}</td>
        <td class="num">${c.num_trabajadores}</td>
        <td><button class="btn-icon" onclick="tareoTab('trabajadores')">👥 Ver</button></td>
      </tr>`).join('');
  } catch(e) { document.getElementById('cuadrillasBody').innerHTML=`<tr><td colspan="5" class="error-msg">${e.message}</td></tr>`; }
}

async function cargarTrabajadores() {
  try {
    const cuaId = document.getElementById('filtroTrabCuadrilla')?.value||'';
    let url = '/api/admin-financiero/trabajadores';
    if (cuaId) url += `?id_cuadrilla=${cuaId}`;
    _tareoTrabajadores = await api.get(url);
    const body = document.getElementById('trabajadoresBody');
    const CARGOS = { maestro:'Maestro', oficial:'Oficial', ayudante:'Ayudante', peon:'Peón', caporal:'Caporal', otro:'Otro' };
    if (!_tareoTrabajadores.length) { body.innerHTML='<tr><td colspan="7" class="empty-msg">Sin trabajadores.</td></tr>'; return; }
    body.innerHTML = _tareoTrabajadores.map(t=>`
      <tr>
        <td><strong>${t.nombre}</strong></td>
        <td>${t.identidad||'—'}</td>
        <td>${CARGOS[t.cargo]||t.cargo}</td>
        <td>${t.cuadrilla}</td>
        <td class="num">L ${(t.salario_base||0).toLocaleString('es-HN',{minimumFractionDigits:2})}</td>
        <td>${t.fecha_ingreso||'—'}</td>
        <td></td>
      </tr>`).join('');
  } catch(e) { document.getElementById('trabajadoresBody').innerHTML=`<tr><td colspan="7" class="error-msg">${e.message}</td></tr>`; }
}

async function modalNuevoTareo() {
  // Refrescar combos por si quedaron vacíos/obsoletos desde la carga inicial
  if (!_tareoPresupuestos.length) {
    await tareoCargarCombos();
  }
  if (!_tareoPresupuestos.length) {
    toast('No hay presupuestos activos. Cree un presupuesto antes de registrar el día.', 'error');
    return;
  }
  // Llenar combos del modal
  const proySel = document.getElementById('tareoModalPres');
  proySel.innerHTML = '<option value="">— Seleccione —</option>' +
    _tareoPresupuestos.map(p=>`<option value="${p.id_presupuesto}">${p.nombre}</option>`).join('');
  const cuaSel = document.getElementById('tareoModalCuadrilla');
  cuaSel.innerHTML = '<option value="">— Sin filtro —</option>' +
    _tareoCuadrillas.map(c=>`<option value="${c.id_cuadrilla}">${c.nombre}</option>`).join('');
  const actSel = document.getElementById('tareoModalActividad');
  const actividades = Array.isArray(_tareoActividades) ? _tareoActividades : [];
  actSel.innerHTML = '<option value="">— Sin actividad —</option>' +
    actividades.map(a=>`<option value="${a.id_actividad}">${a.codigo} — ${a.descripcion}</option>`).join('');
  if (!_tareoTrabajadores.length) {
    document.getElementById('tareoModalBody').innerHTML = '<tr><td colspan="7" class="empty-msg">No hay trabajadores registrados. Vaya a la pestaña Trabajadores para agregar uno.</td></tr>';
  } else {
    document.getElementById('tareoModalBody').innerHTML = '<tr><td colspan="7" class="empty-msg">Seleccione cuadrilla (o deje "Sin filtro" para ver a todos)...</td></tr>';
    tareoCargarTrabsModal();
  }
  showModal('modalTareo');
}

function tareoCargarTrabsModal() {
  const cuaId = document.getElementById('tareoModalCuadrilla')?.value;
  const trabs = cuaId
    ? _tareoTrabajadores.filter(t=>String(t.id_cuadrilla)===String(cuaId))
    : _tareoTrabajadores;

  if (!trabs.length) {
    document.getElementById('tareoModalBody').innerHTML='<tr><td colspan="7" class="empty-msg">Sin trabajadores en esta cuadrilla.</td></tr>';
    return;
  }
  document.getElementById('tareoModalBody').innerHTML = trabs.map(t=>`
    <tr>
      <td><input type="checkbox" class="tareo-chk" data-id="${t.id_trab}" checked></td>
      <td>${t.nombre}</td>
      <td>${t.cargo}</td>
      <td><input type="number" id="thn-${t.id_trab}" value="8" min="0" max="24" step="0.5" style="width:70px;text-align:right"></td>
      <td><input type="number" id="the-${t.id_trab}" value="0" min="0" max="12" step="0.5" style="width:70px;text-align:right"></td>
      <td>
        <select id="ttp-${t.id_trab}" onchange="tareoTipoCambia('${t.id_trab}')">
          <option value="jornal">Jornal</option>
          <option value="destajo">Destajo</option>
          <option value="hora">Hora</option>
        </select>
      </td>
      <td><input type="number" id="tdes-${t.id_trab}" value="0" min="0" step="0.01" style="width:90px;text-align:right" disabled></td>
    </tr>`).join('');
}

function tareoCheckTodos(chkAll) {
  document.querySelectorAll('.tareo-chk').forEach(c => c.checked = chkAll.checked);
}

function tareoTipoCambia(id) {
  const tipo = document.getElementById(`ttp-${id}`)?.value;
  const des  = document.getElementById(`tdes-${id}`);
  if (des) des.disabled = tipo !== 'destajo';
}

async function guardarTareo() {
  const fecha = document.getElementById('tareoModalFecha').value;
  const id_presupuesto = document.getElementById('tareoModalPres').value;
  const id_actividad = document.getElementById('tareoModalActividad').value||null;
  if (!fecha||!id_presupuesto) { toast('Fecha y presupuesto son requeridos','error'); return; }

  const chks = document.querySelectorAll('.tareo-chk:checked');
  if (!chks.length) { toast('Seleccione al menos un trabajador','error'); return; }

  const registros = Array.from(chks).map(chk => {
    const id = chk.dataset.id;
    return {
      id_trab:      parseInt(id),
      id_presupuesto:  parseInt(id_presupuesto),
      id_actividad: id_actividad ? parseInt(id_actividad) : null,
      fecha,
      horas_normales: parseFloat(document.getElementById(`thn-${id}`)?.value)||8,
      horas_extra:    parseFloat(document.getElementById(`the-${id}`)?.value)||0,
      tipo_pago:      document.getElementById(`ttp-${id}`)?.value||'jornal',
      monto_destajo:  parseFloat(document.getElementById(`tdes-${id}`)?.value)||0,
      asistio: 1,
    };
  });

  try {
    const r = await api.post('/api/admin-financiero/tareo', { registros });
    toast(`Tareo guardado — ${r.insertados} registros nuevos ✅`);
    hideModal('modalTareo');
    document.getElementById('tareofecha').value = fecha;
    await cargarTareoFecha();
  } catch(e) { toast(e.message,'error'); }
}

async function generarNomina() {
  const desde = document.getElementById('nominaDesde').value;
  const hasta = document.getElementById('nominaHasta').value;
  const proy  = document.getElementById('nominaPres').value;
  if (!desde||!hasta) { toast('Seleccione rango de fechas','error'); return; }

  try {
    let url = `/api/admin-financiero/nomina-resumen?desde=${desde}&hasta=${hasta}`;
    if (proy) url += `&id_presupuesto=${proy}`;
    const data = await api.get(url);

    document.getElementById('nominaResult').innerHTML = `
      <div style="margin-bottom:12px;display:flex;gap:12px">
        <span class="badge badge-blue">Período: ${desde} → ${hasta}</span>
        <span class="badge badge-green">Total: L ${(data.total_planilla||0).toLocaleString('es-HN',{minimumFractionDigits:2})}</span>
        <span class="badge badge-info">${data.trabajadores.length} trabajadores</span>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead><tr><th>Trabajador</th><th>Cargo</th><th>Cuadrilla</th>
            <th class="num">Salario/Día</th><th class="num">Días</th>
            <th class="num">H. Extra</th><th class="num">Total Bruto (L)</th></tr></thead>
          <tbody>${(data.trabajadores||[]).map(t=>`
            <tr>
              <td><strong>${t.nombre}</strong></td>
              <td>${t.cargo}</td>
              <td>${t.cuadrilla}</td>
              <td class="num">L ${(t.salario_base||0).toLocaleString('es-HN',{minimumFractionDigits:2})}</td>
              <td class="num">${t.dias_trabajados}</td>
              <td class="num">${t.total_horas_extra||0}</td>
              <td class="num"><strong>L ${(t.total_bruto||0).toLocaleString('es-HN',{minimumFractionDigits:2})}</strong></td>
            </tr>`).join('')}
            <tr style="background:var(--bg-card);font-size:1rem">
              <td colspan="6" style="text-align:right"><strong>TOTAL PLANILLA:</strong></td>
              <td class="num" style="color:var(--primary)"><strong>L ${(data.total_planilla||0).toLocaleString('es-HN',{minimumFractionDigits:2})}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>`;
  } catch(e) { document.getElementById('nominaResult').innerHTML=`<p class="error-msg">${e.message}</p>`; }
}

// CUADRILLA - guardar
async function modalNuevaCuadrilla() {
  document.getElementById('cuanombre').value='';
  document.getElementById('cuacapataz').value='';
  const sel = document.getElementById('cuapres');
  sel.innerHTML = '<option value="">— General —</option>' +
    _tareoPresupuestos.map(p=>`<option value="${p.id_presupuesto}">${p.nombre}</option>`).join('');
  showModal('modalCuadrilla');
}
async function guardarCuadrilla() {
  const nombre = document.getElementById('cuanombre').value.trim();
  if (!nombre) { toast('Nombre requerido','error'); return; }
  try {
    await api.post('/api/admin-financiero/cuadrillas', {
      nombre, capataz: document.getElementById('cuacapataz').value,
      id_presupuesto: document.getElementById('cuapres').value||null
    });
    toast('Cuadrilla creada ✅');
    hideModal('modalCuadrilla');
    await tareoCargarCombos();
    await cargarCuadrillas();
  } catch(e) { toast(e.message,'error'); }
}

// TRABAJADOR - guardar
async function modalNuevoTrabajador() {
  ['trabnombre','trabidentidad'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('trabsalario').value='350';
  document.getElementById('trabcargo').value='peon';
  document.getElementById('trabingreso').value=new Date().toISOString().split('T')[0];
  const sel = document.getElementById('trabcuadrilla');
  sel.innerHTML = '<option value="">— Sin cuadrilla —</option>' +
    _tareoCuadrillas.map(c=>`<option value="${c.id_cuadrilla}">${c.nombre}</option>`).join('');
  showModal('modalTrabajador');
}
async function guardarTrabajador() {
  const nombre = document.getElementById('trabnombre').value.trim();
  if (!nombre) { toast('Nombre requerido','error'); return; }
  try {
    await api.post('/api/admin-financiero/trabajadores', {
      nombre, identidad: document.getElementById('trabidentidad').value,
      cargo:        document.getElementById('trabcargo').value,
      salario_base: document.getElementById('trabsalario').value,
      id_cuadrilla: document.getElementById('trabcuadrilla').value||null,
      fecha_ingreso: document.getElementById('trabingreso').value||null,
    });
    toast('Trabajador registrado ✅');
    hideModal('modalTrabajador');
    _tareoTrabajadores = await api.get('/api/admin-financiero/trabajadores');
    await cargarTrabajadores();
  } catch(e) { toast(e.message,'error'); }
}
