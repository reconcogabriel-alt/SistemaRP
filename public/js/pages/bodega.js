/* ============================================================
   BODEGA — Stock Actual
   Control de existencias e inventario valorizado
   ============================================================ */

let bodegaStockData = [];
let bodegaInsumos   = [];

async function renderBodega() {
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">📦 Bodega — Stock Actual</h2>
        <p class="page-sub">Existencias e inventario valorizado</p>
      </div>
    </div>

    <div id="tabStock" class="tab-panel">
      <div class="panel-toolbar">
        <input type="text" id="stockFiltro" placeholder="Filtrar por código, descripción..." oninput="stockFiltrar(this.value)">
        <select id="stockCategoria" onchange="stockFiltrar(document.getElementById('stockFiltro').value)">
          <option value="">Todas las categorías</option>
        </select>
        <button class="btn btn-secondary" onclick="bodegaCargarStock()">🔄 Actualizar</button>
        <button class="btn btn-secondary" onclick="bodegaReporteExcel()">📥 Reporte Excel</button>
        <button class="btn btn-secondary" onclick="modalEntrada()">📥 Registrar Entrada</button>
        <button class="btn btn-secondary" onclick="modalSalida()">📤 Registrar Salida</button>
        <button class="btn btn-orange" onclick="navigateTo('requisiciones')">📋 Ir a Requisiciones</button>
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
  `;

  await bodegaCargarStock();
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

// ── MODALES DE MOVIMIENTO RÁPIDO (entrada/salida desde Stock) ─
async function cargarInsumos() {
  if (!bodegaInsumos.length) {
    const r = await api.get('/api/insumos');
    bodegaInsumos = Array.isArray(r) ? r : (r.insumos||[]);
  }
  return bodegaInsumos;
}

let _mvInsumoSeleccionado = null;

async function modalEntrada(idInsumo=null) {
  await cargarInsumos();
  _mvInsumoSeleccionado = idInsumo ? bodegaInsumos.find(i=>i.id_insumo==idInsumo) : null;
  showModal('📥 Registrar Entrada de Material', `
    <div class="form-grid">
      <div class="field-group fg-full">
        <label>Insumo</label>
        <div id="mvInsumoBox"></div>
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
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-orange" onclick="guardarMovimiento('entrada')">📥 Registrar Entrada</button>
    </div>
  `);
  montarBuscadorMovimiento();
}

async function modalSalida(idInsumo=null) {
  await cargarInsumos();
  _mvInsumoSeleccionado = idInsumo ? bodegaInsumos.find(i=>i.id_insumo==idInsumo) : null;
  showModal('📤 Registrar Salida de Material', `
    <div class="form-grid">
      <div class="field-group fg-full">
        <label>Insumo</label>
        <div id="mvInsumoBox"></div>
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
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-orange" onclick="guardarMovimiento('salida')">📤 Registrar Salida</button>
    </div>
  `);
  montarBuscadorMovimiento();
}

function montarBuscadorMovimiento() {
  const box = document.getElementById('mvInsumoBox');
  if (!box) return;
  const buscador = crearBuscadorInsumo(box, {
    insumos: bodegaInsumos,
    placeholder: 'Buscar insumo por código o descripción...',
    onSelect: (i) => { _mvInsumoSeleccionado = i; }
  });
  if (_mvInsumoSeleccionado) buscador.setValue(_mvInsumoSeleccionado);
}

async function guardarMovimiento(tipo) {
  const id_insumo  = _mvInsumoSeleccionado?.id_insumo;
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

// ── Utilidades compartidas (también usadas por requisiciones.js y movimientos.js) ─
function fmtNum(n)  { return new Intl.NumberFormat('es-HN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0); }
function fmtNum3(n) { return new Intl.NumberFormat('es-HN',{minimumFractionDigits:0,maximumFractionDigits:3}).format(n||0); }
