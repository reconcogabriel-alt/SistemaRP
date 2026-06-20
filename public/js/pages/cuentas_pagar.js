/* ============================================================
   CUENTAS POR PAGAR — Administración / Financiero
   ============================================================ */

let _cpData = [], _cpProveedores = [], _cpPresupuestos = [];

async function renderCuentasPagar() {
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">💸 Cuentas por Pagar</h2>
        <p class="page-sub">Registro de facturas, recibos y control de pagos</p>
      </div>
      <button class="btn btn-orange" onclick="modalNuevaCP()">+ Registrar Documento</button>
    </div>

    <div class="panel-toolbar">
      <select id="cpFiltroEstado" onchange="cpFiltrar()">
        <option value="">Todos los estados</option>
        <option value="pendiente">Pendiente</option>
        <option value="pagada_parcial">Pago parcial</option>
        <option value="pagada">Pagada</option>
        <option value="anulada">Anulada</option>
      </select>
      <select id="cpFiltroTipo" onchange="cpFiltrar()">
        <option value="">Todos los tipos</option>
        <option value="factura">Factura</option>
        <option value="recibo">Recibo</option>
        <option value="planilla_sub">Planilla Subcontrato</option>
        <option value="estimacion">Estimación</option>
        <option value="otro">Otro</option>
      </select>
      <button class="btn btn-secondary" onclick="cargarCP()">🔄 Actualizar</button>
    </div>

    <div id="cpResumenBandas" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px"></div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Documento</th><th>Tipo</th><th>Proveedor</th><th>Presupuesto</th>
            <th>Fecha</th><th>Vence</th>
            <th class="num">Total (L)</th><th class="num">Pagado (L)</th>
            <th class="num">Saldo (L)</th><th>Estado</th><th></th>
          </tr>
        </thead>
        <tbody id="cpBody"><tr><td colspan="11" class="loading">Cargando...</td></tr></tbody>
      </table>
    </div>

    <!-- Modal nueva cuenta por pagar -->
    <div id="modalCP" class="modal-overlay hidden">
      <div class="modal-box" style="max-width:560px">
        <div class="modal-header">
          <h3>Registrar Documento</h3>
          <button onclick="hideModal('modalCP')" class="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-grid-2">
            <div class="form-group">
              <label>N° Documento *</label>
              <input type="text" id="cpNumDoc" placeholder="FAC-001 / REC-001">
            </div>
            <div class="form-group">
              <label>Tipo</label>
              <select id="cpTipo">
                <option value="factura">Factura</option>
                <option value="recibo">Recibo</option>
                <option value="planilla_sub">Planilla Subcontrato</option>
                <option value="estimacion">Estimación</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div class="form-group">
              <label>Proveedor / Subcontratista</label>
              <select id="cpProv"><option value="">— Sin proveedor —</option></select>
            </div>
            <div class="form-group">
              <label>Presupuesto</label>
              <select id="cpPres"><option value="">— Sin presupuesto —</option></select>
            </div>
            <div class="form-group">
              <label>Fecha Documento</label>
              <input type="date" id="cpFechaDoc">
            </div>
            <div class="form-group">
              <label>Fecha Vencimiento</label>
              <input type="date" id="cpFechaVence">
            </div>
            <div class="form-group">
              <label>Monto Total (L) *</label>
              <input type="number" id="cpMonto" min="0" step="0.01" placeholder="0.00">
            </div>
            <div class="form-group">
              <label>Categoría de Gasto</label>
              <select id="cpCategoria">
                <option value="materiales">🧱 Materiales</option>
                <option value="mano_obra">👷 Mano de Obra</option>
                <option value="subcontrato">🔧 Subcontrato</option>
                <option value="equipo">🚜 Equipo</option>
                <option value="administrativo">📋 Administrativo</option>
                <option value="otro">📌 Otro</option>
              </select>
            </div>
            <div class="form-group form-span2">
              <label>Descripción</label>
              <input type="text" id="cpDesc" placeholder="Detalle de lo facturado">
            </div>
            <div class="form-group form-span2">
              <label>Notas</label>
              <textarea id="cpNotas" rows="2" placeholder="Observaciones..."></textarea>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="hideModal('modalCP')">Cancelar</button>
          <button class="btn btn-orange" onclick="guardarCP()">💾 Registrar</button>
        </div>
      </div>
    </div>

    <!-- Modal pago -->
    <div id="modalPago" class="modal-overlay hidden">
      <div class="modal-box" style="max-width:400px">
        <div class="modal-header">
          <h3>💳 Registrar Pago</h3>
          <button onclick="hideModal('modalPago')" class="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="pagoIdCP">
          <div id="pagoInfo" style="background:var(--bg-card);padding:10px;border-radius:6px;margin-bottom:12px"></div>
          <div class="form-group">
            <label>Monto del pago (L) *</label>
            <input type="number" id="pagoMonto" min="0.01" step="0.01">
          </div>
          <div class="form-group">
            <label>Método de pago</label>
            <select id="pagoMetodo">
              <option value="transferencia">Transferencia bancaria</option>
              <option value="cheque">Cheque</option>
              <option value="efectivo">Efectivo</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div class="form-group">
            <label>Referencia</label>
            <input type="text" id="pagoRef" placeholder="N° cheque / transferencia">
          </div>
          <div class="form-group">
            <label>Fecha de pago</label>
            <input type="date" id="pagoFecha">
          </div>
          <div class="form-group">
            <label>Notas</label>
            <textarea id="pagoNotas" rows="2"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="hideModal('modalPago')">Cancelar</button>
          <button class="btn btn-orange" onclick="guardarPago()">💳 Confirmar Pago</button>
        </div>
      </div>
    </div>`;

  await cargarCPCombos();
  await cargarCP();
}

async function cargarCPCombos() {
  try {
    [_cpProveedores, _cpPresupuestos] = await Promise.all([
      api.get('/api/admin-financiero/proveedores'),
      api.get('/api/presupuestos'),
    ]);
    const provSel = document.getElementById('cpProv');
    if (provSel) provSel.innerHTML = '<option value="">— Sin proveedor —</option>' +
      _cpProveedores.map(p=>`<option value="${p.id_prov}">${p.nombre}</option>`).join('');
    const presSel = document.getElementById('cpPres');
    if (presSel) presSel.innerHTML = '<option value="">— Sin presupuesto —</option>' +
      _cpPresupuestos.map(p=>`<option value="${p.id_presupuesto}">${p.nombre}</option>`).join('');
  } catch(e) { console.warn('combos CP', e); }
}

async function cargarCP() {
  try {
    let url = '/api/admin-financiero/cuentas-pagar';
    const params = [];
    const est = document.getElementById('cpFiltroEstado')?.value;
    const tip = document.getElementById('cpFiltroTipo')?.value;
    if (est) params.push(`estado=${est}`);
    if (tip) params.push(`tipo_doc=${tip}`);
    if (params.length) url += '?' + params.join('&');

    _cpData = await api.get(url);
    cpFiltrar();
  } catch(e) {
    document.getElementById('cpBody').innerHTML = `<tr><td colspan="11" class="error-msg">${e.message}</td></tr>`;
  }
}

function cpFiltrar() {
  const totFacturas = _cpData.reduce((s,r)=>s+(r.monto_total||0),0);
  const totPagado   = _cpData.reduce((s,r)=>s+(r.monto_pagado||0),0);
  const totSaldo    = _cpData.reduce((s,r)=>s+(r.saldo||0),0);
  const vencidas    = _cpData.filter(r => r.fecha_vence && r.fecha_vence < new Date().toISOString().split('T')[0] && r.estado!=='pagada').length;

  document.getElementById('cpResumenBandas').innerHTML = [
    { label:'Total Facturado', val:fmtL3(totFacturas), color:'var(--primary)' },
    { label:'Total Pagado',    val:fmtL3(totPagado),   color:'var(--success)' },
    { label:'Saldo Pendiente', val:fmtL3(totSaldo),    color:'var(--danger)'  },
    { label:'Documentos Vencidos', val:vencidas, color: vencidas>0?'var(--danger)':'var(--success)' },
  ].map(k=>`
    <div style="background:var(--bg-card);border-radius:8px;padding:14px;border-left:4px solid ${k.color}">
      <div style="font-size:1.3rem;font-weight:700;color:${k.color}">${k.val}</div>
      <div style="font-size:0.78rem;color:#666;margin-top:4px">${k.label}</div>
    </div>`).join('');

  const ESTADOS = {
    pendiente:{label:'Pendiente',cls:'badge-orange'},
    pagada_parcial:{label:'Pago parcial',cls:'badge-blue'},
    pagada:{label:'Pagada',cls:'badge-green'},
    anulada:{label:'Anulada',cls:'badge-red'},
  };
  const TIPOS = { factura:'🧾', recibo:'📄', planilla_sub:'👷', estimacion:'📋', otro:'📌' };

  const hoy = new Date().toISOString().split('T')[0];
  const body = document.getElementById('cpBody');
  if (!_cpData.length) { body.innerHTML='<tr><td colspan="11" class="empty-msg">Sin documentos registrados.</td></tr>'; return; }

  body.innerHTML = _cpData.map(r => {
    const st = ESTADOS[r.estado]||{label:r.estado,cls:'badge-gray'};
    const vencido = r.fecha_vence && r.fecha_vence < hoy && r.estado !== 'pagada';
    return `<tr ${vencido?'style="background:#fff0f0"':''}>
      <td><strong>${r.numero_doc}</strong></td>
      <td>${TIPOS[r.tipo_doc]||''} ${r.tipo_doc}</td>
      <td>${r.proveedor}</td>
      <td>${r.presupuesto}</td>
      <td>${r.fecha_doc||'—'}</td>
      <td ${vencido?'style="color:var(--danger);font-weight:600"':''}>${r.fecha_vence||'—'}${vencido?' ⚠️':''}</td>
      <td class="num">${fmtL3(r.monto_total)}</td>
      <td class="num" style="color:var(--success)">${fmtL3(r.monto_pagado)}</td>
      <td class="num" style="color:${r.saldo>0?'var(--danger)':'var(--success)'}"><strong>${fmtL3(r.saldo)}</strong></td>
      <td><span class="badge ${st.cls}">${st.label}</span></td>
      <td>
        ${r.estado!=='pagada'&&r.estado!=='anulada'?`<button class="btn-icon" title="Registrar pago" onclick="abrirPago(${r.id_cp},'${r.numero_doc}',${r.saldo})">💳</button>`:''}
      </td>
    </tr>`;
  }).join('');
}

async function modalNuevaCP() {
  await cargarCPCombos();
  ['cpNumDoc','cpDesc','cpNotas'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('cpMonto').value='';
  document.getElementById('cpTipo').value='factura';
  document.getElementById('cpCategoria').value='materiales';
  document.getElementById('cpFechaDoc').value = new Date().toISOString().split('T')[0];
  document.getElementById('cpFechaVence').value='';
  showModal('modalCP');
}

async function guardarCP() {
  const numero_doc = document.getElementById('cpNumDoc').value.trim();
  const monto_total = document.getElementById('cpMonto').value;
  if (!numero_doc || !monto_total) { toast('Número de documento y monto son requeridos','error'); return; }
  try {
    await api.post('/api/admin-financiero/cuentas-pagar', {
      numero_doc, monto_total,
      tipo_doc:       document.getElementById('cpTipo').value,
      id_prov:        document.getElementById('cpProv').value||null,
      id_presupuesto:    document.getElementById('cpPres').value||null,
      fecha_doc:      document.getElementById('cpFechaDoc').value||null,
      fecha_vence:    document.getElementById('cpFechaVence').value||null,
      categoria_gasto: document.getElementById('cpCategoria').value,
      descripcion:    document.getElementById('cpDesc').value,
      notas:          document.getElementById('cpNotas').value,
    });
    toast('Documento registrado ✅');
    hideModal('modalCP');
    await cargarCP();
  } catch(e) { toast(e.message,'error'); }
}

function abrirPago(id, numero, saldo) {
  document.getElementById('pagoIdCP').value = id;
  document.getElementById('pagoInfo').innerHTML =
    `<strong>${numero}</strong> — Saldo: <span style="color:var(--danger)">${fmtL3(saldo)}</span>`;
  document.getElementById('pagoMonto').value = saldo.toFixed(2);
  document.getElementById('pagoMonto').max  = saldo;
  document.getElementById('pagoFecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('pagoRef').value='';
  document.getElementById('pagoNotas').value='';
  showModal('modalPago');
}

async function guardarPago() {
  const id    = document.getElementById('pagoIdCP').value;
  const monto = document.getElementById('pagoMonto').value;
  if (!monto || parseFloat(monto)<=0) { toast('Monto inválido','error'); return; }
  try {
    await api.post(`/api/admin-financiero/cuentas-pagar/${id}/pago`, {
      monto, metodo: document.getElementById('pagoMetodo').value,
      referencia:   document.getElementById('pagoRef').value,
      fecha_pago:   document.getElementById('pagoFecha').value||null,
      notas:        document.getElementById('pagoNotas').value,
    });
    toast('Pago registrado ✅');
    hideModal('modalPago');
    await cargarCP();
  } catch(e) { toast(e.message,'error'); }
}

function fmtL3(n) {
  return 'L ' + (parseFloat(n)||0).toLocaleString('es-HN',{minimumFractionDigits:2,maximumFractionDigits:2});
}
