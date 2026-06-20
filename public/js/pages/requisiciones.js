/* ============================================================
   REQUISICIONES
   Solicitudes de materiales — se relacionan con Bodega (stock)
   y con Órdenes de Compra, pero viven en su propio módulo.
   ============================================================ */

let reqInsumosCache = [];

async function renderRequisiciones() {
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">📋 Requisiciones</h2>
        <p class="page-sub">Solicitudes de materiales por presupuesto</p>
      </div>
    </div>

    <div id="tabReq" class="tab-panel">
      <div class="panel-toolbar">
        <select id="reqFiltroEstado" onchange="bodegaCargarReq()">
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="aprobada">Aprobada</option>
          <option value="parcial">Parcial</option>
          <option value="completa">Completa</option>
          <option value="anulada">Anulada</option>
        </select>
        <button class="btn btn-secondary" onclick="bodegaCargarReq()">🔄 Actualizar</button>
        <button class="btn btn-orange" onclick="modalNuevaReq()">+ Nueva Requisición</button>
        <button class="btn btn-secondary" onclick="navigateTo('bodega')">📦 Ver Stock</button>
      </div>
      <div class="table-container">
        <table class="data-table" id="tablaReq">
          <thead>
            <tr>
              <th>Número</th><th>Presupuesto</th><th>Solicitante</th>
              <th>Fecha</th><th>Entrega</th><th>Items</th><th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody id="reqBody"><tr><td colspan="8" class="loading">Cargando...</td></tr></tbody>
        </table>
      </div>
    </div>
  `;

  await bodegaCargarReq();
}

// ── REQUISICIONES ─────────────────────────────────────────
async function bodegaCargarReq() {
  const estado = document.getElementById('reqFiltroEstado')?.value||'';
  try {
    const params = estado ? `?estado=${estado}` : '';
    const datos = await api.get('/api/bodega/requisiciones'+params);
    const tbody = document.getElementById('reqBody');
    if (!datos.length) { tbody.innerHTML='<tr><td colspan="8" class="empty">Sin requisiciones</td></tr>'; return; }

    tbody.innerHTML = datos.map((r,i)=>`
      <tr class="${i%2===0?'even':''}">
        <td><strong>${r.numero}</strong></td>
        <td>${r.presupuesto}</td>
        <td>${r.solicitante||'—'}</td>
        <td>${r.fecha_req}</td>
        <td>${r.fecha_req_entrega||'—'}</td>
        <td class="center"><span class="badge-num">${r.num_items}</span></td>
        <td>${badgeEstado(r.estado)}</td>
        <td class="actions">
          <button class="btn-xs" onclick="verReq(${r.id_req})" title="Ver detalle">👁</button>
          <button class="btn-xs" onclick="descargarReqExcel(${r.id_req})" title="Descargar Excel">📥</button>
          ${r.estado==='pendiente'?`<button class="btn-xs" onclick="aprobarReq(${r.id_req})" title="Aprobar">✅</button>`:''}
          ${r.estado==='aprobada'?`<button class="btn-xs" onclick="crearOCDesdeReq(${r.id_req})" title="Generar Orden de Compra">🛒</button>`:''}
          ${['pendiente','aprobada'].includes(r.estado)?`<button class="btn-xs btn-xs-red" onclick="anularReq(${r.id_req})" title="Anular">✕</button>`:''}
        </td>
      </tr>
    `).join('');
  } catch(e) {
    document.getElementById('reqBody').innerHTML=`<tr><td colspan="8" class="error">${e.message}</td></tr>`;
  }
}

function badgeEstado(estado) {
  const badges = {
    pendiente:  '<span class="badge badge-warn">Pendiente</span>',
    aprobada:   '<span class="badge badge-ok">Aprobada</span>',
    parcial:    '<span class="badge badge-info">Parcial</span>',
    completa:   '<span class="badge badge-ok">Completa</span>',
    anulada:    '<span class="badge badge-red">Anulada</span>'
  };
  return badges[estado] || estado;
}

async function verReq(id) {
  try {
    const data = await api.get(`/api/bodega/requisiciones/${id}`);
    const { requisicion: r, items } = data;
    showModal(`Requisición ${r.numero}`, `
      <div class="req-detail">
        <div class="req-info-grid">
          <div><label>Presupuesto</label><span>${r.presupuesto}</span></div>
          <div><label>Solicitante</label><span>${r.solicitante||'—'}</span></div>
          <div><label>Fecha</label><span>${r.fecha_req}</span></div>
          <div><label>Entrega req.</label><span>${r.fecha_req_entrega||'—'}</span></div>
          <div><label>Estado</label><span>${badgeEstado(r.estado)}</span></div>
        </div>
        ${r.notas?`<p class="req-notas">📝 ${r.notas}</p>`:''}
        <table class="data-table" style="margin-top:12px">
          <thead><tr>
            <th>Código</th><th>Descripción</th><th>Unidad</th>
            <th class="num">Cantidad</th><th class="num">Stock</th><th>Notas</th>
          </tr></thead>
          <tbody>
            ${items.map((it,i)=>`<tr class="${i%2===0?'even':''}">
              <td><code>${it.codigo||'—'}</code></td>
              <td>${it.descripcion}</td>
              <td>${it.unidad}</td>
              <td class="num"><strong>${fmtNum3(it.cantidad_req)}</strong></td>
              <td class="num ${it.stock_actual>=it.cantidad_req?'stock-ok':'stock-bajo'}">${fmtNum3(it.stock_actual)}</td>
              <td class="muted">${it.notas||'—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div style="margin-top:12px;text-align:right">
          <button class="btn btn-secondary" onclick="descargarReqExcel(${id})">📥 Descargar Excel</button>
        </div>
      </div>
    `);
  } catch(e) { toast(e.message,'error'); }
}

async function aprobarReq(id) {
  if (!confirm('¿Aprobar esta requisición?')) return;
  try {
    await api.patch(`/api/bodega/requisiciones/${id}/estado`, { estado:'aprobada' });
    toast('Requisición aprobada','success');
    bodegaCargarReq();
  } catch(e) { toast(e.message,'error'); }
}

async function anularReq(id) {
  if (!confirm('¿Anular esta requisición?')) return;
  try {
    await api.delete(`/api/bodega/requisiciones/${id}`);
    toast('Requisición anulada','info');
    bodegaCargarReq();
  } catch(e) { toast(e.message,'error'); }
}

// Atajo: ir a Órdenes de Compra con esta requisición pre-cargada
function crearOCDesdeReq(idReq) {
  navigateTo('ordenes_compra', { id_req: idReq });
}

async function descargarReqExcel(id) {
  try {
    const response = await fetch(`/api/bodega/requisiciones/${id}/excel`);
    if (!response.ok) throw new Error('Error al generar');
    const blob = await response.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const cd   = response.headers.get('Content-Disposition')||'';
    const m    = cd.match(/filename="([^"]+)"/);
    a.href = url; a.download = m?m[1]:`Requisicion_${id}.xlsx`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    toast('Excel descargado','success');
  } catch(e) { toast(e.message,'error'); }
}

// ── NUEVA REQUISICIÓN ──────────────────────────────────────
async function reqCargarInsumos() {
  if (!reqInsumosCache.length) {
    const r = await api.get('/api/insumos');
    reqInsumosCache = Array.isArray(r) ? r : (r.insumos||[]);
  }
  return reqInsumosCache;
}

async function modalNuevaReq() {
  await reqCargarInsumos();

  // Cargar presupuestos
  let presupuestos=[];
  try { presupuestos = await api.get('/api/presupuestos'); } catch(e){}

  showModal('📋 Nueva Requisición de Materiales', `
    <div class="form-grid">
      <div class="field-group">
        <label>Presupuesto</label>
        <select id="reqPresupuesto">
          <option value="">— Seleccione presupuesto —</option>
          ${presupuestos.map(p=>`<option value="${p.id_presupuesto}">${p.nombre}</option>`).join('')}
        </select>
      </div>
      <div class="field-group">
        <label>Solicitante</label>
        <input type="text" id="reqSolicitante" placeholder="Nombre del solicitante">
      </div>
      <div class="field-group">
        <label>Fecha req. de entrega</label>
        <input type="date" id="reqFechaEntrega">
      </div>
      <div class="field-group fg-full">
        <label>Notas</label>
        <input type="text" id="reqNotas" placeholder="Observaciones generales">
      </div>
    </div>

    <div style="margin-top:14px">
      <label style="font-weight:600;font-size:13px;">Materiales requeridos</label>
      <div id="reqItemsContainer">
        <div class="req-item-row">
          <div class="req-insumo-box"></div>
          <input type="number" class="req-cant" placeholder="Cantidad" min="0.001" step="0.001">
          <input type="text" class="req-notas-item" placeholder="Observación">
          <button class="btn-xs btn-xs-red" onclick="this.closest('.req-item-row').remove()">✕</button>
        </div>
      </div>
      <button class="btn-xs" style="margin-top:6px" onclick="reqAgregarItem()">+ Agregar material</button>
    </div>

    <div style="text-align:right;margin-top:14px">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-orange" onclick="guardarRequisicion()">📋 Crear Requisición</button>
    </div>
  `);

  // Montar buscador en la primera fila (ya presente en el HTML del modal)
  document.querySelectorAll('#reqItemsContainer .req-item-row').forEach(montarBuscadorEnFila);
}

function montarBuscadorEnFila(fila) {
  const box = fila.querySelector('.req-insumo-box');
  if (!box || box.dataset.montado) return;
  box.dataset.montado = '1';
  crearBuscadorInsumo(box, {
    insumos: reqInsumosCache,
    placeholder: 'Buscar insumo por código o descripción...',
    onSelect: (i) => { fila.dataset.idInsumo = i.id_insumo; fila.dataset.unidad = i.unidad||''; }
  });
}

function reqAgregarItem() {
  const cont = document.getElementById('reqItemsContainer');
  const div = document.createElement('div');
  div.className='req-item-row';
  div.innerHTML=`
    <div class="req-insumo-box"></div>
    <input type="number" class="req-cant" placeholder="Cantidad" min="0.001" step="0.001">
    <input type="text" class="req-notas-item" placeholder="Observación">
    <button class="btn-xs btn-xs-red" onclick="this.closest('.req-item-row').remove()">✕</button>
  `;
  cont.appendChild(div);
  montarBuscadorEnFila(div);
}

async function guardarRequisicion() {
  const id_presupuesto   = document.getElementById('reqPresupuesto')?.value;
  const solicitante   = document.getElementById('reqSolicitante')?.value||'';
  const fecha_entrega = document.getElementById('reqFechaEntrega')?.value||null;
  const notas         = document.getElementById('reqNotas')?.value||'';

  if (!id_presupuesto) { toast('Seleccione un presupuesto','warning'); return; }

  const filas = document.querySelectorAll('.req-item-row');
  const items=[];
  for (const fila of filas) {
    const insumo = fila.dataset.idInsumo;
    const cant   = parseFloat(fila.querySelector('.req-cant')?.value);
    const nota   = fila.querySelector('.req-notas-item')?.value||'';
    if (insumo && cant>0) items.push({ id_insumo:parseInt(insumo), cantidad:cant, notas:nota });
  }

  if (!items.length) { toast('Agregue al menos un material','warning'); return; }

  try {
    const r = await api.post('/api/bodega/requisiciones', {
      id_presupuesto:parseInt(id_presupuesto), solicitante, fecha_req_entrega:fecha_entrega, notas, items
    });
    toast(`Requisición ${r.numero} creada exitosamente`,'success');
    hideModal();
    bodegaCargarReq();
  } catch(e) { toast(e.message,'error'); }
}
