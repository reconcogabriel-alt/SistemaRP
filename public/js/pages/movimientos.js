/* ============================================================
   MOVIMIENTOS DE BODEGA
   Historial de entradas, salidas y ajustes de inventario
   ============================================================ */

async function renderMovimientos() {
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">↕️ Movimientos de Bodega</h2>
        <p class="page-sub">Historial de entradas, salidas y ajustes de inventario</p>
      </div>
    </div>

    <div id="tabMovimientos" class="tab-panel">
      <div class="panel-toolbar">
        <select id="movFiltroTipo" onchange="bodegaCargarMov()">
          <option value="">Todos los tipos</option>
          <option value="entrada">📥 Entradas</option>
          <option value="salida">📤 Salidas</option>
          <option value="ajuste">⚖️ Ajustes</option>
        </select>
        <input type="date" id="movDesde" onchange="bodegaCargarMov()">
        <input type="date" id="movHasta" onchange="bodegaCargarMov()">
        <button class="btn btn-secondary" onclick="bodegaCargarMov()">🔄 Actualizar</button>
        <button class="btn btn-secondary" onclick="navigateTo('bodega')">📦 Ver Stock</button>
      </div>
      <div class="table-container">
        <table class="data-table" id="tablaMov">
          <thead>
            <tr>
              <th>Fecha</th><th>Tipo</th><th>Insumo</th><th>Unidad</th>
              <th class="num">Cantidad</th><th class="num">P.Unit</th><th class="num">Total (L)</th>
              <th>Presupuesto</th><th>Referencia</th>
            </tr>
          </thead>
          <tbody id="movBody"><tr><td colspan="9" class="loading">Cargando...</td></tr></tbody>
        </table>
      </div>
    </div>
  `;

  await bodegaCargarMov();
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
        <td class="muted">${m.presupuesto||'—'}</td>
        <td class="muted">${m.referencia||'—'}</td>
      </tr>`;
    }).join('');
  } catch(e) {
    document.getElementById('movBody').innerHTML=`<tr><td colspan="9" class="error">${e.message}</td></tr>`;
  }
}
