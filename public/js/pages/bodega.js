/* ============================================================
   REQUISICIONES Y BODEGA BÁSICA
   Control de solicitudes de materiales y movimientos de stock
   ============================================================ */

async function renderBodega() {
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Requisiciones y Bodega</h2>
        <p class="page-sub">Control de solicitudes de materiales y movimientos de inventario</p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="bodega-tabs">
      <button class="tab-btn active" data-tab="stock"      onclick="bodegaTab('stock')">📦 Stock Actual</button>
      <button class="tab-btn"        data-tab="req"        onclick="bodegaTab('req')">📋 Requisiciones</button>
      <button class="tab-btn"        data-tab="movimientos" onclick="bodegaTab('movimientos')">↕️ Movimientos</button>
    </div>

    <!-- TAB: Stock -->
    <div id="tabStock" class="tab-panel">
      <div class="panel-toolbar">
        <input type="text" id="stockFiltro" placeholder="Filtrar por código, descripción..." oninput="stockFiltrar(this.value)">
        <select id="stockCategoria" onchange="stockFiltrar(document.getElementById('stockFiltro').value)">
          <option value="">Todas las categorías</option>
        </select>
        <button class="btn-secondary" onclick="bodegaCargarStock()">🔄 Actualizar</button>
        <button class="btn-primary"   onclick="bodegaReporteExcel()">📥 Reporte Excel</button>
        <button class="btn-action"    onclick="modalEntrada()">📥 Registrar Entrada</button>
        <button class="btn-danger-sm" onclick="modalSalida()">📤 Registrar Salida</button>
      </div>
      <div class="stock-resumen" id="stockResumen"></div>
      <div class="table-container">
        <table class="data-table" id="tablaStock">
          <thead>
            <tr>
              <th>Categoría</th><th>Código</th><th>Descripción</th><th>Unidad</th>
              <th class="num">Stock</th><th class="num">P.Unit (L)</th>
              <th class="num">Valor Stock (L)</th><th>Última Mov.</th><th></th>
            </tr>
          </thead>
          <tbody id="stockBody"><tr><td colspan="9" class="loading">Cargando stock...</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- TAB: Requisiciones -->
    <div id="tabReq" class="tab-panel hidden">
      <div class="panel-toolbar">
        <select id="reqFiltroEstado" onchange="bodegaCargarReq()">
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="aprobada">Aprobada</option>
          <option value="parcial">Parcial</option>
          <option value="completa">Completa</option>
          <option value="anulada">Anulada</option>
        </select>
        <button class="btn-secondary" onclick="bodegaCargarReq()">🔄 Actualizar</button>
        <button class="btn-primary"   onclick="modalNuevaReq()">+ Nueva Requisición</button>
      </div>
      <div class="table-container">
        <table class="data-table" id="tablaReq">
          <thead>
            <tr>
              <th>Número</th><th>Proyecto</th><th>Solicitante</th>
              <th>Fecha</th><th>Entrega</th><th>Items</th><th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody id="reqBody"><tr><td colspan="8" class="loading">Cargando...</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- TAB: Movimientos -->
    <div id="tabMovimientos" class="tab-panel hidden">
      <div class="panel-toolbar">
        <select id="movFiltroTipo" onchange="bodegaCargarMov()">
          <option value="">Todos los tipos</option>
          <option value="entrada">📥 Entradas</option>
          <option value="salida">📤 Salidas</option>
          <option value="ajuste">⚖️ Ajustes</option>
        </select>
        <input type="date" id="movDesde" onchange="bodegaCargarMov()">
        <input type="date" id="movHasta" onchange="bodegaCargarMov()">
        <button class="btn-secondary" onclick="bodegaCargarMov()">🔄 Actualizar</button>
      </div>
      <div class="table-container">
        <table class="data-table" id="tablaMov">
          <thead>
            <tr>
              <th>Fecha</th><th>Tipo</th><th>Insumo</th><th>Unidad</th>
              <th class="num">Cantidad</th><th class="num">P.Unit</th><th class="num">Total (L)</th>
              <th>Proyecto</th><th>Referencia</th>
            </tr>
          </thead>
          <tbody id="movBody"><tr><td colspan="9" class="loading">Cargando...</td></tr></tbody>
        </table>
      </div>
    </div>
  `;

  await bodegaCargarStock();
}

let bodegaStockData = [];
let bodegaInsumos   = [];

// ── TAB SWITCHING ─────────────────────────────────────────
function bodegaTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  document.getElementById(`tab${tab.charAt(0).toUpperCase()+tab.slice(1)}`).classList.remove('hidden');

  if (tab==='req')         bodegaCargarReq();
  if (tab==='movimientos') bodegaCargarMov();
}

// ── STOCK ─────────────────────────────────────────────────
async function bodegaCargarStock() {
  try {
    bodegaStockData = await api.get('/api/bodega/stock');

    // Categorías únicas
    const cats = [...new Set(bodegaStockData.map(i=>i.categoria))].sort();
    const sel = document.getElementById('stockCategoria');
    if (sel.options.length <= 1) {
      cats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.textContent = c;
        sel.appendChild(opt);
      });
    }

    stockFiltrar(document.getElementById('stockFiltro')?.value || '');
    stockResumen();
  } catch(e) {
    document.getElementById('stockBody').innerHTML =
      `<tr><td colspan="9" class="error">Error: ${e.message}</td></tr>`;
  }
}

function stockResumen() {
  const total = bodegaStockData.reduce((s,i)=>s+i.valor_stock,0);
  const sinStock = bodegaStockData.filter(i=>i.stock===0).length;
  const el = document.getElementById('stockResumen');
  el.innerHTML = `
    <div class="resumen-card c-blue">
      <div class="rc-num">${bodegaStockData.length}</div>
      <div class="rc-label">Insumos activos</div>
    </div>
    <div class="resumen-card c-green">
      <div class="rc-num">L ${fmtNum(total)}</div>
      <div class="rc-label">Valor total en bodega</div>
    </div>
    <div class="resumen-card ${sinStock>0?'c-red':'c-gray'}">
      <div class="rc-num">${sinStock}</div>
      <div class="rc-label">Insumos sin stock</div>
    </div>
    <div class="resumen-card c-orange">
      <div class="rc-num">${bodegaStockData.filter(i=>i.stock>0).length}</div>
      <div class="rc-label">Con existencia</div>
    </div>
  `;
}

function stockFiltrar(q) {
  const cat = document.getElementById('stockCategoria')?.value || '';
  const txt = (q||'').toLowerCase();
  const datos = bodegaStockData.filter(i =>
    (!cat || i.categoria===cat) &&
    (!txt || i.descripcion.toLowerCase().includes(txt) || (i.codigo||'').toLowerCase().includes(txt))
  );

  const tbody = document.getElementById('stockBody');
  if (!datos.length) { tbody.innerHTML='<tr><td colspan="9" class="empty">Sin resultados</td></tr>'; return; }

  let lastCat='', html='';
  datos.forEach((i, idx) => {
    if (i.categoria !== lastCat) {
      html += `<tr class="cat-row"><td colspan="9">📂 ${i.categoria}</td></tr>`;
      lastCat = i.categoria;
    }
    const stockClass = i.stock===0 ? 'stock-cero' : i.stock<5 ? 'stock-bajo' : 'stock-ok';
    html += `<tr class="${idx%2===0?'even':''}">
      <td>${i.categoria}</td>
      <td><code>${i.codigo||'—'}</code></td>
      <td>${i.descripcion}</td>
      <td>${i.unidad}</td>
      <td class="num ${stockClass}"><strong>${fmtNum3(i.stock)}</strong></td>
      <td class="num">${fmtNum(i.precio_unitario)}</td>
      <td class="num">${fmtNum(i.valor_stock)}</td>
      <td class="muted">${i.ultima_actualizacion ? i.ultima_actualizacion.split('T')[0] : '—'}</td>
      <td>
        <button class="btn-xs" onclick="modalEntrada(${i.id_insumo})" title="Entrada">📥</button>
        <button class="btn-xs btn-xs-red" onclick="modalSalida(${i.id_insumo})" title="Salida">📤</button>
      </td>
    </tr>`;
  });
  tbody.innerHTML = html;
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
        <td>${r.proyecto}</td>
        <td>${r.solicitante||'—'}</td>
        <td>${r.fecha_req}</td>
        <td>${r.fecha_req_entrega||'—'}</td>
        <td class="center"><span class="badge-num">${r.num_items}</span></td>
        <td>${badgeEstado(r.estado)}</td>
        <td class="actions">
          <button class="btn-xs" onclick="verReq(${r.id_req})" title="Ver detalle">👁</button>
          <button class="btn-xs" onclick="descargarReqExcel(${r.id_req})" title="Descargar Excel">📥</button>
          ${r.estado==='pendiente'?`<button class="btn-xs" onclick="aprobarReq(${r.id_req})" title="Aprobar">✅</button>`:''}
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
          <div><label>Proyecto</label><span>${r.proyecto}</span></div>
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
          <button class="btn-secondary" onclick="descargarReqExcel(${id})">📥 Descargar Excel</button>
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

// ── MOVIMIENTOS ───────────────────────────────────────────
async function bodegaCargarMov() {
  const tipo   = document.getElementById('movFiltroTipo')?.value||'';
  const desde  = document.getElementById('movDesde')?.value||'';
  const hasta  = document.getElementById('movHasta')?.value||'';
  const params = new URLSearchParams();
  if (tipo)  params.append('tipo',tipo);
  if (desde) params.append('desde',desde);
  if (hasta) params.append('hasta',hasta);

  try {
    const datos = await api.get('/api/bodega/movimientos'+(params.toString()?'?'+params:''));
    const tbody = document.getElementById('movBody');
    if (!datos.length) { tbody.innerHTML='<tr><td colspan="9" class="empty">Sin movimientos</td></tr>'; return; }

    tbody.innerHTML = datos.map((m,i)=>{
      const tipoBadge = m.tipo==='entrada'
        ? '<span class="badge badge-ok">📥 Entrada</span>'
        : m.tipo==='salida'
        ? '<span class="badge badge-red">📤 Salida</span>'
        : '<span class="badge badge-info">⚖️ Ajuste</span>';
      return `<tr class="${i%2===0?'even':''}">
        <td>${m.fecha_mov}</td>
        <td>${tipoBadge}</td>
        <td><code>${m.codigo||'—'}</code> ${m.descripcion}</td>
        <td>${m.unidad}</td>
        <td class="num">${fmtNum3(m.cantidad)}</td>
        <td class="num">${fmtNum(m.precio_unitario)}</td>
        <td class="num">${fmtNum(m.total)}</td>
        <td class="muted">${m.proyecto||'—'}</td>
        <td class="muted">${m.referencia||'—'}</td>
      </tr>`;
    }).join('');
  } catch(e) {
    document.getElementById('movBody').innerHTML=`<tr><td colspan="9" class="error">${e.message}</td></tr>`;
  }
}

// ── MODALES ───────────────────────────────────────────────
async function cargarInsumos() {
  if (!bodegaInsumos.length) {
    const r = await api.get('/api/insumos');
    bodegaInsumos = Array.isArray(r) ? r : (r.insumos||[]);
  }
  return bodegaInsumos;
}

async function modalEntrada(idInsumo=null) {
  await cargarInsumos();
  showModal('📥 Registrar Entrada de Material', `
    <div class="form-grid">
      <div class="field-group fg-full">
        <label>Insumo</label>
        <select id="mvInsumo">
          <option value="">— Seleccione insumo —</option>
          ${bodegaInsumos.map(i=>`<option value="${i.id_insumo}" ${i.id_insumo==idInsumo?'selected':''}>${i.codigo||''} - ${i.descripcion} (${i.unidad})</option>`).join('')}
        </select>
      </div>
      <div class="field-group">
        <label>Cantidad</label>
        <input type="number" id="mvCantidad" min="0.001" step="0.001" placeholder="0.000">
      </div>
      <div class="field-group">
        <label>Precio Unitario (L)</label>
        <input type="number" id="mvPrecioUnit" min="0" step="0.01" placeholder="0.00">
      </div>
      <div class="field-group">
        <label>Fecha</label>
        <input type="date" id="mvFecha" value="${new Date().toISOString().split('T')[0]}">
      </div>
      <div class="field-group">
        <label>Proveedor</label>
        <input type="text" id="mvProveedor" placeholder="Nombre del proveedor">
      </div>
      <div class="field-group">
        <label>Referencia/Factura</label>
        <input type="text" id="mvRef" placeholder="No. factura o remisión">
      </div>
      <div class="field-group fg-full">
        <label>Notas</label>
        <input type="text" id="mvNotas" placeholder="Observaciones opcionales">
      </div>
    </div>
    <div style="text-align:right;margin-top:14px">
      <button class="btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn-primary" onclick="guardarMovimiento('entrada')">📥 Registrar Entrada</button>
    </div>
  `);
}

async function modalSalida(idInsumo=null) {
  await cargarInsumos();
  showModal('📤 Registrar Salida de Material', `
    <div class="form-grid">
      <div class="field-group fg-full">
        <label>Insumo</label>
        <select id="mvInsumo">
          <option value="">— Seleccione insumo —</option>
          ${bodegaInsumos.map(i=>`<option value="${i.id_insumo}" ${i.id_insumo==idInsumo?'selected':''}>${i.codigo||''} - ${i.descripcion} (${i.unidad})</option>`).join('')}
        </select>
      </div>
      <div class="field-group">
        <label>Cantidad</label>
        <input type="number" id="mvCantidad" min="0.001" step="0.001" placeholder="0.000">
      </div>
      <div class="field-group">
        <label>Fecha</label>
        <input type="date" id="mvFecha" value="${new Date().toISOString().split('T')[0]}">
      </div>
      <div class="field-group">
        <label>Referencia</label>
        <input type="text" id="mvRef" placeholder="Orden de trabajo, requisa...">
      </div>
      <div class="field-group fg-full">
        <label>Notas</label>
        <input type="text" id="mvNotas" placeholder="Destino o uso del material">
      </div>
    </div>
    <div style="text-align:right;margin-top:14px">
      <button class="btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn-danger-sm" onclick="guardarMovimiento('salida')">📤 Registrar Salida</button>
    </div>
  `);
}

async function guardarMovimiento(tipo) {
  const id_insumo  = document.getElementById('mvInsumo')?.value;
  const cantidad   = parseFloat(document.getElementById('mvCantidad')?.value);
  const precio     = parseFloat(document.getElementById('mvPrecioUnit')?.value)||0;
  const fecha_mov  = document.getElementById('mvFecha')?.value;
  const proveedor  = document.getElementById('mvProveedor')?.value||'';
  const referencia = document.getElementById('mvRef')?.value||'';
  const notas      = document.getElementById('mvNotas')?.value||'';

  if (!id_insumo || !cantidad || cantidad<=0) {
    toast('Seleccione un insumo e ingrese una cantidad válida','warning');
    return;
  }

  try {
    await api.post('/api/bodega/movimientos', {
      tipo, id_insumo: parseInt(id_insumo),
      cantidad, precio_unitario: precio,
      referencia, proveedor, notas, fecha_mov
    });
    toast(`${tipo==='entrada'?'Entrada':'Salida'} registrada correctamente`, 'success');
    hideModal();
    bodegaCargarStock();
    if (document.getElementById('tabMovimientos')?.classList.contains('hidden')===false)
      bodegaCargarMov();
  } catch(e) { toast(e.message,'error'); }
}

async function modalNuevaReq() {
  await cargarInsumos();

  // Cargar proyectos
  let proyectos=[];
  try { proyectos = await api.get('/api/proyectos'); } catch(e){}

  showModal('📋 Nueva Requisición de Materiales', `
    <div class="form-grid">
      <div class="field-group">
        <label>Proyecto</label>
        <select id="reqProyecto">
          <option value="">— Seleccione proyecto —</option>
          ${proyectos.map(p=>`<option value="${p.id_proyecto}">${p.nombre}</option>`).join('')}
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
          <select class="req-insumo-sel">
            <option value="">— Insumo —</option>
            ${bodegaInsumos.map(i=>`<option value="${i.id_insumo}" data-unid="${i.unidad}">${i.codigo||''} - ${i.descripcion} (${i.unidad})</option>`).join('')}
          </select>
          <input type="number" class="req-cant" placeholder="Cantidad" min="0.001" step="0.001">
          <input type="text" class="req-notas-item" placeholder="Observación">
          <button class="btn-xs btn-xs-red" onclick="this.closest('.req-item-row').remove()">✕</button>
        </div>
      </div>
      <button class="btn-xs" style="margin-top:6px" onclick="reqAgregarItem()">+ Agregar material</button>
    </div>

    <div style="text-align:right;margin-top:14px">
      <button class="btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn-primary" onclick="guardarRequisicion()">📋 Crear Requisición</button>
    </div>
  `);
}

function reqAgregarItem() {
  const cont = document.getElementById('reqItemsContainer');
  const div = document.createElement('div');
  div.className='req-item-row';
  div.innerHTML=`
    <select class="req-insumo-sel">
      <option value="">— Insumo —</option>
      ${bodegaInsumos.map(i=>`<option value="${i.id_insumo}">${i.codigo||''} - ${i.descripcion} (${i.unidad})</option>`).join('')}
    </select>
    <input type="number" class="req-cant" placeholder="Cantidad" min="0.001" step="0.001">
    <input type="text" class="req-notas-item" placeholder="Observación">
    <button class="btn-xs btn-xs-red" onclick="this.closest('.req-item-row').remove()">✕</button>
  `;
  cont.appendChild(div);
}

async function guardarRequisicion() {
  const id_proyecto   = document.getElementById('reqProyecto')?.value;
  const solicitante   = document.getElementById('reqSolicitante')?.value||'';
  const fecha_entrega = document.getElementById('reqFechaEntrega')?.value||null;
  const notas         = document.getElementById('reqNotas')?.value||'';

  if (!id_proyecto) { toast('Seleccione un proyecto','warning'); return; }

  const filas = document.querySelectorAll('.req-item-row');
  const items=[];
  for (const fila of filas) {
    const insumo = fila.querySelector('.req-insumo-sel')?.value;
    const cant   = parseFloat(fila.querySelector('.req-cant')?.value);
    const nota   = fila.querySelector('.req-notas-item')?.value||'';
    if (insumo && cant>0) items.push({ id_insumo:parseInt(insumo), cantidad:cant, notas:nota });
  }

  if (!items.length) { toast('Agregue al menos un material','warning'); return; }

  try {
    const r = await api.post('/api/bodega/requisiciones', {
      id_proyecto:parseInt(id_proyecto), solicitante, fecha_req_entrega:fecha_entrega, notas, items
    });
    toast(`Requisición ${r.numero} creada exitosamente`,'success');
    hideModal();
    bodegaTab('req');
  } catch(e) { toast(e.message,'error'); }
}

// ── Reporte Excel de Bodega ───────────────────────────────
async function bodegaReporteExcel() {
  try {
    const response = await fetch('/api/bodega/reporte-excel');
    if (!response.ok) throw new Error('Error generando reporte');
    const blob = await response.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const cd   = response.headers.get('Content-Disposition')||'';
    const m    = cd.match(/filename="([^"]+)"/);
    a.href = url; a.download = m?m[1]:'Reporte_Bodega.xlsx';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    toast('Reporte de bodega descargado','success');
  } catch(e) { toast(e.message,'error'); }
}

// ── Utilidades ────────────────────────────────────────────
function fmtNum(n)  { return new Intl.NumberFormat('es-HN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0); }
function fmtNum3(n) { return new Intl.NumberFormat('es-HN',{minimumFractionDigits:0,maximumFractionDigits:3}).format(n||0); }
