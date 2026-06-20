/* ============================================================
   ÓRDENES DE COMPRA — Administración / Financiero
   ============================================================ */

let _ocData = [], _ocProveedores = [], _ocPresupuestos = [], _ocReqs = [];

async function renderOrdenesCompra(ctx={}) {
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">🛒 Órdenes de Compra</h2>
        <p class="page-sub">Gestión y flujo de aprobación de órdenes de compra</p>
      </div>
      <button class="btn btn-orange" onclick="modalNuevaOC()">+ Nueva OC</button>
    </div>
    <div class="panel-toolbar">
      <select id="ocFiltroEstado" onchange="ocFiltrar()">
        <option value="">Todos los estados</option>
        <option value="borrador">Borrador</option>
        <option value="pendiente">Pendiente aprobación</option>
        <option value="aprobada">Aprobada</option>
        <option value="recibida_parcial">Recibida parcial</option>
        <option value="recibida_total">Recibida total</option>
        <option value="anulada">Anulada</option>
      </select>
      <select id="ocFiltroPres" onchange="ocFiltrar()">
        <option value="">Todos los presupuestos</option>
      </select>
      <button class="btn btn-secondary" onclick="cargarOC()">🔄 Actualizar</button>
    </div>
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Número</th><th>Presupuesto</th><th>Proveedor</th>
            <th>Fecha OC</th><th>Entrega</th><th>Estado</th>
            <th class="num">Total (L)</th><th></th>
          </tr>
        </thead>
        <tbody id="ocBody"><tr><td colspan="8" class="loading">Cargando...</td></tr></tbody>
      </table>
    </div>

    <!-- Modal Nueva OC -->
    <div id="modalOC" class="modal-overlay hidden">
      <div class="modal-box" style="max-width:700px;max-height:90vh;overflow-y:auto">
        <div class="modal-header">
          <h3>Nueva Orden de Compra</h3>
          <button onclick="hideModal('modalOC')" class="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-grid-2">
            <div class="form-group">
              <label>Presupuesto *</label>
              <select id="ocPres"></select>
            </div>
            <div class="form-group">
              <label>Proveedor *</label>
              <select id="ocProv"></select>
            </div>
            <div class="form-group">
              <label>Requisición relacionada</label>
              <select id="ocReq"><option value="">— Ninguna —</option></select>
            </div>
            <div class="form-group">
              <label>Condición de pago</label>
              <select id="ocCondPago">
                <option value="contado">Contado</option>
                <option value="15 días">15 días</option>
                <option value="30 días">30 días</option>
                <option value="60 días">60 días</option>
                <option value="credito">Crédito negociado</option>
              </select>
            </div>
            <div class="form-group">
              <label>Fecha de entrega</label>
              <input type="date" id="ocFechaEnt">
            </div>
            <div class="form-group">
              <label>Impuesto (%)</label>
              <input type="number" id="ocImpPct" value="15" min="0" max="100" step="0.01">
            </div>
          </div>

          <div style="margin:16px 0 8px;font-weight:600">📋 Ítems de la orden</div>
          <div id="ocItemsContainer">
            <table class="data-table" id="tablaOCItems">
              <thead>
                <tr>
                  <th style="width:35%">Insumo</th><th>Unidad</th>
                  <th class="num" style="width:100px">Cantidad</th>
                  <th class="num" style="width:120px">P. Unit (L)</th>
                  <th class="num" style="width:120px">Subtotal</th>
                  <th style="width:40px"></th>
                </tr>
              </thead>
              <tbody id="ocItemsBody"></tbody>
            </table>
          </div>
          <button class="btn btn-secondary" style="margin-top:8px" onclick="ocAgregarItem()">+ Agregar ítem</button>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px">
            <div></div>
            <div>
              <div style="display:flex;justify-content:space-between;padding:4px 0">
                <span>Subtotal:</span><strong id="ocSubtotalLbl">L 0.00</strong>
              </div>
              <div style="display:flex;justify-content:space-between;padding:4px 0">
                <span>Impuesto:</span><strong id="ocImpuestoLbl">L 0.00</strong>
              </div>
              <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:2px solid var(--primary);font-size:1.05rem">
                <span><strong>TOTAL:</strong></span><strong id="ocTotalLbl" style="color:var(--primary)">L 0.00</strong>
              </div>
            </div>
          </div>

          <div class="form-group" style="margin-top:12px">
            <label>Notas</label>
            <textarea id="ocNotas" rows="2" placeholder="Condiciones especiales, instrucciones de entrega..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="hideModal('modalOC')">Cancelar</button>
          <button class="btn btn-secondary" onclick="guardarOC('borrador')">💾 Guardar borrador</button>
          <button class="btn btn-orange" onclick="guardarOC('pendiente')">📤 Enviar a aprobación</button>
        </div>
      </div>
    </div>

    <!-- Modal Detalle OC -->
    <div id="modalOCDet" class="modal-overlay hidden">
      <div class="modal-box" style="max-width:700px;max-height:90vh;overflow-y:auto">
        <div class="modal-header">
          <h3 id="modalOCDetTit">Detalle OC</h3>
          <button onclick="hideModal('modalOCDet')" class="modal-close">✕</button>
        </div>
        <div id="modalOCDetBody" class="modal-body"></div>
        <div class="modal-footer" id="modalOCDetFooter"></div>
      </div>
    </div>`;

  // Pre-load select options
  await cargarOCCombos();
  await cargarOC(ctx.id_prov);
  if (ctx.id_req) {
    await modalNuevaOC();
    const reqSel = document.getElementById('ocReq');
    if (reqSel) reqSel.value = ctx.id_req;
  }
}

async function cargarOCCombos() {
  try {
    [_ocProveedores, _ocPresupuestos, _ocReqs] = await Promise.all([
      api.get('/api/admin-financiero/proveedores'),
      api.get('/api/presupuestos'),
      api.get('/api/bodega/requisiciones?estado=aprobada').catch(() => [])
    ]);

    const provSel = document.getElementById('ocProv');
    if (provSel) {
      provSel.innerHTML = '<option value="">— Seleccione proveedor —</option>' +
        _ocProveedores.map(p => `<option value="${p.id_prov}">${p.nombre}</option>`).join('');
    }
    const proyFilt = document.getElementById('ocFiltroPres');
    if (proyFilt) {
      proyFilt.innerHTML = '<option value="">Todos los presupuestos</option>' +
        _ocPresupuestos.map(p => `<option value="${p.id_presupuesto}">${p.nombre}</option>`).join('');
    }
    const proySel = document.getElementById('ocPres');
    if (proySel) {
      proySel.innerHTML = '<option value="">— Seleccione presupuesto —</option>' +
        _ocPresupuestos.map(p => `<option value="${p.id_presupuesto}">${p.nombre}</option>`).join('');
    }
    const reqSel = document.getElementById('ocReq');
    if (reqSel && _ocReqs.length) {
      reqSel.innerHTML = '<option value="">— Ninguna —</option>' +
        _ocReqs.map(r => `<option value="${r.id_req}">${r.numero} — ${r.presupuesto}</option>`).join('');
    }
  } catch(e) { console.warn('combos OC', e); }
}

async function cargarOC(id_prov_filter) {
  try {
    let url = '/api/admin-financiero/ordenes-compra';
    const estado = document.getElementById('ocFiltroEstado')?.value;
    const proy   = document.getElementById('ocFiltroPres')?.value;
    const params = [];
    if (estado) params.push(`estado=${estado}`);
    if (proy)   params.push(`id_presupuesto=${proy}`);
    if (id_prov_filter) params.push(`id_prov=${id_prov_filter}`);
    if (params.length) url += '?' + params.join('&');

    _ocData = await api.get(url);
    ocFiltrar();
  } catch(e) {
    document.getElementById('ocBody').innerHTML = `<tr><td colspan="8" class="error-msg">${e.message}</td></tr>`;
  }
}

function ocFiltrar() {
  const ESTADOS = {
    borrador: { label:'Borrador', cls:'badge-gray' },
    pendiente: { label:'Pendiente', cls:'badge-orange' },
    aprobada:  { label:'Aprobada',  cls:'badge-green' },
    recibida_parcial: { label:'Recib. Parcial', cls:'badge-blue' },
    recibida_total:   { label:'Recibida Total', cls:'badge-green' },
    anulada: { label:'Anulada', cls:'badge-red' },
  };
  const body = document.getElementById('ocBody');
  if (!_ocData.length) { body.innerHTML='<tr><td colspan="8" class="empty-msg">Sin órdenes de compra.</td></tr>'; return; }

  body.innerHTML = _ocData.map(oc => {
    const st = ESTADOS[oc.estado] || { label: oc.estado, cls:'badge-gray' };
    return `<tr>
      <td><strong>${oc.numero}</strong></td>
      <td>${oc.presupuesto}</td>
      <td>${oc.proveedor}</td>
      <td>${oc.fecha_oc}</td>
      <td>${oc.fecha_entrega||'—'}</td>
      <td><span class="badge ${st.cls}">${st.label}</span></td>
      <td class="num"><strong>${fmtL2(oc.total)}</strong></td>
      <td>
        <button class="btn-icon" title="Ver detalle" onclick="verDetalleOC(${oc.id_oc})">👁</button>
        ${oc.estado==='borrador'?`<button class="btn-icon" title="Enviar a aprobación" onclick="enviarAprobacionOC(${oc.id_oc},'${oc.numero}')">📤</button>`:''}
        ${oc.estado==='pendiente'?`<button class="btn-icon" title="Aprobar" onclick="aprobarOC(${oc.id_oc},'${oc.numero}')">✅</button>`:''}
        ${oc.estado==='aprobada'?`<button class="btn-icon" title="Registrar recepción" onclick="modalRecepcionOC(${oc.id_oc},'${oc.numero}')">📥</button>`:''}
        ${['borrador','pendiente'].includes(oc.estado)?`<button class="btn-icon danger" title="Anular" onclick="anularOC(${oc.id_oc},'${oc.numero}')">❌</button>`:''}
      </td>
    </tr>`;
  }).join('');
}

let _ocItems = [];
function ocAgregarItem() {
  const idx = _ocItems.length;
  _ocItems.push({ id_insumo:'', descripcion:'', unidad:'', cantidad:1, precio_unit:0 });

  const row = document.createElement('tr');
  row.id = `oc-item-row-${idx}`;
  row.innerHTML = `
    <td><div id="oc-ins-${idx}"></div></td>
    <td><input type="text" id="oc-und-${idx}" style="width:70px" readonly></td>
    <td><input type="number" id="oc-cant-${idx}" value="1" min="0.001" step="any" style="width:90px;text-align:right" oninput="ocRecalc(${idx})"></td>
    <td><input type="number" id="oc-pu-${idx}" value="0" min="0" step="any" style="width:110px;text-align:right" oninput="ocRecalc(${idx})"></td>
    <td><span id="oc-sub-${idx}" style="font-weight:600">0.00</span></td>
    <td><button class="btn-icon danger" onclick="ocQuitarItem(${idx})">✕</button></td>`;
  document.getElementById('ocItemsBody').appendChild(row);

  async function montarBuscador() {
    if (!window._insumosCache) window._insumosCache = await api.get('/api/insumos');
    crearBuscadorInsumo(document.getElementById(`oc-ins-${idx}`), {
      insumos: window._insumosCache,
      placeholder: 'Buscar insumo por código o descripción...',
      onSelect: (i) => ocItemCambia(idx, i)
    });
  }
  montarBuscador();
}

function ocItemCambia(idx, insumo) {
  document.getElementById(`oc-und-${idx}`).value = insumo.unidad||'';
  document.getElementById(`oc-pu-${idx}`).value  = insumo.precio_unitario||0;
  _ocItems[idx].id_insumo = insumo.id_insumo;
  _ocItems[idx].unidad = insumo.unidad||'';
  ocRecalc(idx);
}

function ocRecalc(idx) {
  const cant = parseFloat(document.getElementById(`oc-cant-${idx}`)?.value)||0;
  const pu   = parseFloat(document.getElementById(`oc-pu-${idx}`)?.value)||0;
  const sub  = cant * pu;
  _ocItems[idx].cantidad   = cant;
  _ocItems[idx].precio_unit = pu;
  const span = document.getElementById(`oc-sub-${idx}`);
  if (span) span.textContent = sub.toLocaleString('es-HN',{minimumFractionDigits:2});
  ocTotales();
}

function ocTotales() {
  const impPct = parseFloat(document.getElementById('ocImpPct')?.value)||0;
  const subtotal = _ocItems.reduce((s,it,i) => {
    const c = parseFloat(document.getElementById(`oc-cant-${i}`)?.value)||0;
    const p = parseFloat(document.getElementById(`oc-pu-${i}`)?.value)||0;
    return s + c*p;
  }, 0);
  const imp = subtotal * impPct / 100;
  const tot = subtotal + imp;
  document.getElementById('ocSubtotalLbl').textContent = fmtL2(subtotal);
  document.getElementById('ocImpuestoLbl').textContent = fmtL2(imp);
  document.getElementById('ocTotalLbl').textContent    = fmtL2(tot);
}

function ocQuitarItem(idx) {
  const row = document.getElementById(`oc-item-row-${idx}`);
  if (row) row.remove();
  _ocItems[idx] = null;
  ocTotales();
}

async function guardarOC(estadoInicial) {
  const id_presupuesto = document.getElementById('ocPres').value;
  const id_prov     = document.getElementById('ocProv').value;
  if (!id_presupuesto || !id_prov) { toast('Seleccione presupuesto y proveedor','error'); return; }

  const items = _ocItems
    .filter(it => it && it.id_insumo)
    .map((it, i) => ({
      id_insumo:  it.id_insumo,
      unidad:     document.getElementById(`oc-und-${i}`)?.value||'',
      cantidad:   parseFloat(document.getElementById(`oc-cant-${i}`)?.value)||0,
      precio_unit: parseFloat(document.getElementById(`oc-pu-${i}`)?.value)||0,
    }));

  if (!items.length) { toast('Agregue al menos un ítem','error'); return; }

  try {
    const r = await api.post('/api/admin-financiero/ordenes-compra', {
      id_presupuesto, id_prov,
      id_req:        document.getElementById('ocReq').value||null,
      fecha_entrega: document.getElementById('ocFechaEnt').value||null,
      condicion_pago: document.getElementById('ocCondPago').value,
      impuesto_pct:  document.getElementById('ocImpPct').value,
      notas:         document.getElementById('ocNotas').value,
      items
    });
    if (estadoInicial === 'pendiente' && r.id_oc) {
      await api.patch(`/api/admin-financiero/ordenes-compra/${r.id_oc}/estado`, { estado:'pendiente' });
    }
    toast(`OC ${r.numero} creada ✅`);
    hideModal('modalOC');
    _ocItems = [];
    await cargarOC();
  } catch(e) { toast(e.message,'error'); }
}

async function verDetalleOC(id) {
  try {
    const { oc, items } = await api.get(`/api/admin-financiero/ordenes-compra/${id}`);
    const ESTADOS = {
      borrador:'📝 Borrador', pendiente:'⏳ Pendiente aprobación',
      aprobada:'✅ Aprobada', recibida_parcial:'📦 Recibida parcialmente',
      recibida_total:'✔️ Recibida total', anulada:'❌ Anulada'
    };
    document.getElementById('modalOCDetTit').textContent = `OC: ${oc.numero}`;
    document.getElementById('modalOCDetBody').innerHTML = `
      <div class="form-grid-2" style="margin-bottom:16px">
        <div><strong>Presupuesto:</strong> ${oc.presupuesto}</div>
        <div><strong>Proveedor:</strong> ${oc.proveedor}</div>
        <div><strong>RTN:</strong> ${oc.prov_rtn||'—'}</div>
        <div><strong>Teléfono:</strong> ${oc.prov_tel||'—'}</div>
        <div><strong>Fecha OC:</strong> ${oc.fecha_oc}</div>
        <div><strong>Fecha entrega:</strong> ${oc.fecha_entrega||'—'}</div>
        <div><strong>Estado:</strong> ${ESTADOS[oc.estado]||oc.estado}</div>
        <div><strong>Condición pago:</strong> ${oc.condicion_pago}</div>
        ${oc.aprobado_por?`<div><strong>Aprobado por:</strong> ${oc.aprobado_por}</div><div><strong>Fecha aprobación:</strong> ${oc.fecha_aprobacion}</div>`:''}
      </div>
      <table class="data-table">
        <thead><tr><th>Código</th><th>Descripción</th><th>Unidad</th>
          <th class="num">Cant.</th><th class="num">P.Unit (L)</th>
          <th class="num">Subtotal (L)</th><th class="num">Recibido</th></tr></thead>
        <tbody>${items.map(it=>`
          <tr>
            <td>${it.codigo}</td><td>${it.descripcion}</td><td>${it.unidad}</td>
            <td class="num">${it.cantidad}</td>
            <td class="num">${fmtL2(it.precio_unit)}</td>
            <td class="num"><strong>${fmtL2(it.subtotal)}</strong></td>
            <td class="num ${it.cantidad_recibida>=it.cantidad?'text-green':it.cantidad_recibida>0?'text-orange':'text-red'}">
              ${it.cantidad_recibida}/${it.cantidad}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div style="text-align:right;margin-top:12px;padding:8px;background:var(--bg-card);border-radius:6px">
        <div>Subtotal: <strong>${fmtL2(oc.subtotal)}</strong></div>
        <div>Impuesto: <strong>${fmtL2(oc.impuesto)}</strong></div>
        <div style="font-size:1.1rem;color:var(--primary)">TOTAL: <strong>${fmtL2(oc.total)}</strong></div>
      </div>
      ${oc.notas?`<div style="margin-top:8px;color:#666;font-size:0.85rem">Notas: ${oc.notas}</div>`:''}`;

    document.getElementById('modalOCDetFooter').innerHTML = `
      <button class="btn btn-secondary" onclick="hideModal('modalOCDet')">Cerrar</button>
      ${oc.estado==='borrador'?`<button class="btn btn-orange" onclick="enviarAprobacionOC(${id},'${oc.numero}')">📤 Enviar a aprobación</button>`:''}
      ${oc.estado==='pendiente'?`<button class="btn btn-secondary" onclick="regresarBorradorOC(${id},'${oc.numero}')">↩️ Regresar a borrador</button>`:''}
      ${oc.estado==='pendiente'?`<button class="btn btn-orange" onclick="aprobarOC(${id},'${oc.numero}')">✅ Aprobar</button>`:''}
      ${oc.estado==='aprobada'?`<button class="btn btn-orange" onclick="modalRecepcionOC(${id},'${oc.numero}')">📥 Registrar Recepción</button>`:''}
      ${['borrador','pendiente'].includes(oc.estado)?`<button class="btn btn-secondary" style="color:var(--red,#c0392b)" onclick="anularOC(${id},'${oc.numero}')">❌ Anular</button>`:''}`;
    showModal('modalOCDet');
  } catch(e) { toast(e.message,'error'); }
}

async function enviarAprobacionOC(id, numero) {
  if (!confirm(`¿Enviar la OC ${numero} a aprobación? Ya no podrá editarse como borrador.`)) return;
  try {
    await api.patch(`/api/admin-financiero/ordenes-compra/${id}/estado`, { estado:'pendiente' });
    toast(`OC ${numero} enviada a aprobación ⏳`);
    hideModal('modalOCDet');
    await cargarOC();
  } catch(e) { toast(e.message,'error'); }
}

async function regresarBorradorOC(id, numero) {
  if (!confirm(`¿Regresar la OC ${numero} a borrador para corregirla?`)) return;
  try {
    await api.patch(`/api/admin-financiero/ordenes-compra/${id}/estado`, { estado:'borrador' });
    toast(`OC ${numero} regresada a borrador 📝`);
    hideModal('modalOCDet');
    await cargarOC();
  } catch(e) { toast(e.message,'error'); }
}

async function aprobarOC(id, numero) {
  if (!confirm(`¿Aprobar la OC ${numero}?`)) return;
  const aprobado_por = prompt('Nombre del aprobador:', 'Ing. Gabriel Reconco')||'';
  try {
    await api.patch(`/api/admin-financiero/ordenes-compra/${id}/estado`, { estado:'aprobada', aprobado_por });
    toast(`OC ${numero} aprobada ✅`);
    hideModal('modalOCDet');
    await cargarOC();
  } catch(e) { toast(e.message,'error'); }
}

async function anularOC(id, numero) {
  if (!confirm(`¿Anular la OC ${numero}? Esta acción no se puede deshacer.`)) return;
  try {
    await api.patch(`/api/admin-financiero/ordenes-compra/${id}/estado`, { estado:'anulada' });
    toast(`OC ${numero} anulada`);
    await cargarOC();
  } catch(e) { toast(e.message,'error'); }
}

async function modalRecepcionOC(id, numero) {
  try {
    const { items } = await api.get(`/api/admin-financiero/ordenes-compra/${id}`);
    const pendientes = items.filter(it => it.cantidad_recibida < it.cantidad);
    if (!pendientes.length) { toast('Todos los ítems ya fueron recibidos','info'); return; }

    const html = pendientes.map(it => `
      <tr>
        <td>${it.codigo} — ${it.descripcion}</td>
        <td class="num">${it.cantidad - it.cantidad_recibida} ${it.unidad}</td>
        <td><input type="number" id="rec-${it.id_item}" value="${it.cantidad - it.cantidad_recibida}"
            min="0" max="${it.cantidad - it.cantidad_recibida}" step="any" style="width:90px;text-align:right"></td>
      </tr>`).join('');

    const ok = await new Promise(resolve => {
      const div = document.createElement('div');
      div.innerHTML = `<div style="padding:16px">
        <h4>📥 Registrar Recepción — ${numero}</h4>
        <p style="color:#666;font-size:0.85rem">Ingrese la cantidad efectivamente recibida por ítem:</p>
        <table class="data-table" style="margin-top:8px">
          <thead><tr><th>Ítem</th><th class="num">Pendiente</th><th>Cant. Recibida</th></tr></thead>
          <tbody>${html}</tbody>
        </table>
        <div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end">
          <button id="recCancel" class="btn btn-secondary">Cancelar</button>
          <button id="recOk" class="btn btn-orange">📥 Confirmar Recepción</button>
        </div>
      </div>`;
      document.body.appendChild(div);
      div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center';
      div.querySelector('#recCancel').onclick = () => { div.remove(); resolve(false); };
      div.querySelector('#recOk').onclick = () => {
        const recepciones = pendientes.map(it => ({
          id_item: it.id_item,
          cantidad_recibida: it.cantidad_recibida + (parseFloat(document.getElementById(`rec-${it.id_item}`)?.value)||0)
        }));
        div.remove();
        resolve(recepciones);
      };
    });

    if (!ok) return;
    const r = await api.post(`/api/admin-financiero/ordenes-compra/${id}/recepcion`, { recepciones: ok });
    toast(`Recepción registrada — Estado: ${r.estado} ✅`);
    toast('Entradas de bodega generadas automáticamente 📦','info');
    await cargarOC();
  } catch(e) { toast(e.message,'error'); }
}

async function modalNuevaOC() {
  _ocItems = [];
  document.getElementById('ocItemsBody').innerHTML = '';
  document.getElementById('ocNotas').value = '';
  document.getElementById('ocFechaEnt').value = '';
  document.getElementById('ocSubtotalLbl').textContent = 'L 0.00';
  document.getElementById('ocImpuestoLbl').textContent = 'L 0.00';
  document.getElementById('ocTotalLbl').textContent    = 'L 0.00';
  document.getElementById('ocImpPct').value = '15';
  await cargarOCCombos();
  showModal('modalOC');
  ocAgregarItem();
}

function fmtL2(n) {
  return 'L ' + (parseFloat(n)||0).toLocaleString('es-HN',{minimumFractionDigits:2,maximumFractionDigits:2});
}
