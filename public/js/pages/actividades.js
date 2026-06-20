// ═══════════════════════════════════════════════════════════════
// ACTIVIDADES — Editor APU Visual con edición en línea
// ═══════════════════════════════════════════════════════════════
let _actTotal = 0;
let _actOffset = 0;
const _ACT_LIMIT = 50;
let _actSearchTimer = null;
let _actActual = null;
let _actInsumos = [];
let _actRows = [];

async function renderActividades() {
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">ANÁLISIS DE PRECIOS UNITARIOS</div>
        <div class="page-subtitle">Editor APU — Catálogo de actividades con fichas de costo interactivas</div>
      </div>
      <button class="btn btn-orange" onclick="modalNuevaActividad()">+ Nueva Actividad</button>
    </div>
    <div class="page-body">
      <div style="display:grid; grid-template-columns: 340px 1fr; gap:20px; align-items:start">
        
        <!-- PANEL IZQUIERDO — Búsqueda + Lista -->
        <div class="card" style="position:sticky; top:16px">
          <div style="padding:12px 12px 8px">
            <div style="position:relative; margin-bottom:8px">
              <span style="position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--text-muted); font-size:14px; pointer-events:none">🔍</span>
              <input type="text" id="searchAct"
                placeholder="Código ej: F002, F005... o descripción"
                oninput="onActSearch()"
                onkeydown="onActSearchKey(event)"
                style="padding-left:34px; width:100%; font-size:13px"
                autocomplete="off">
              <button id="btnClearSearch" onclick="clearActSearch()"
                style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:var(--text-muted); font-size:16px; display:none">✕</button>
            </div>

            <div id="actFiltrosRapidos" style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px">
              <button class="btn-chip active" onclick="setFiltroRapido('', this)">Todos</button>
              <button class="btn-chip" onclick="setFiltroRapido('F001', this)">F001 Topo</button>
              <button class="btn-chip" onclick="setFiltroRapido('F002', this)">F002 Cim.</button>
              <button class="btn-chip" onclick="setFiltroRapido('F003', this)">F003 Estr.</button>
              <button class="btn-chip" onclick="setFiltroRapido('F004', this)">F004 Mamp.</button>
              <button class="btn-chip" onclick="setFiltroRapido('F005', this)">F005 Font.</button>
              <button class="btn-chip" onclick="setFiltroRapido('F006', this)">F006 Alc.</button>
              <button class="btn-chip" onclick="setFiltroRapido('F007', this)">F007 Pav.</button>
              <button class="btn-chip" onclick="setFiltroRapido('AP-', this)">AP Agua</button>
              <button class="btn-chip" onclick="setFiltroRapido('AN-', this)">AN Negras</button>
              <button class="btn-chip" onclick="setFiltroRapido('M-', this)">M-Módulos</button>
            </div>

            <div id="actCounter" style="font-size:11px; color:var(--text-muted); padding:0 2px 6px">
              Cargando...
            </div>
          </div>

          <div id="actListado" style="max-height:62vh; overflow-y:auto; border-top:1px solid var(--gray-light)">
            <div class="loading"><div class="spinner"></div></div>
          </div>

          <div id="actPager" style="padding:8px 12px; border-top:1px solid var(--gray-light); display:none; align-items:center; justify-content:space-between; gap:8px">
            <button id="btnActPrev" class="btn btn-secondary btn-sm" onclick="actPaginar(-1)">← Prev</button>
            <span id="actPagerInfo" style="font-size:11px; color:var(--text-muted)"></span>
            <button id="btnActNext" class="btn btn-secondary btn-sm" onclick="actPaginar(1)">Sig →</button>
          </div>
        </div>

        <!-- PANEL DERECHO — Ficha APU -->
        <div id="actDetalle">
          <div class="empty-state" style="background:var(--white); border-radius:4px; border:1px solid var(--gray-mid); padding:60px">
            <div class="empty-icon" style="font-size:48px">📐</div>
            <div class="empty-title">Selecciona una actividad</div>
            <div class="empty-desc">Haz clic en cualquier actividad de la lista para ver y editar su ficha de costo unitario.<br>
              <strong>Tip:</strong> Puedes editar cantidad, rendimiento y desperdicio directamente en la tabla.</div>
          </div>
        </div>
      </div>
    </div>`;

  await buscarActividades();
}

// ─── Búsqueda ────────────────────────────────────────────
function onActSearch() {
  const inp = document.getElementById('searchAct');
  const btn = document.getElementById('btnClearSearch');
  if (btn) btn.style.display = inp.value ? 'block' : 'none';
  clearTimeout(_actSearchTimer);
  _actSearchTimer = setTimeout(() => { _actOffset = 0; buscarActividades(); }, 280);
}

function onActSearchKey(e) {
  if (e.key === 'Escape') clearActSearch();
  if (e.key === 'Enter') { clearTimeout(_actSearchTimer); _actOffset = 0; buscarActividades(); }
}

function clearActSearch() {
  const inp = document.getElementById('searchAct');
  if (inp) inp.value = '';
  document.getElementById('btnClearSearch').style.display = 'none';
  document.querySelectorAll('.btn-chip').forEach((c,i) => c.classList.toggle('active', i===0));
  _actOffset = 0; buscarActividades();
}

function setFiltroRapido(prefix, btn) {
  document.querySelectorAll('#actFiltrosRapidos .btn-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  const inp = document.getElementById('searchAct');
  if (inp) { inp.value = prefix; document.getElementById('btnClearSearch').style.display = prefix ? 'block' : 'none'; }
  _actOffset = 0; buscarActividades();
}

async function buscarActividades() {
  const q = (document.getElementById('searchAct')?.value || '').trim();
  const listado = document.getElementById('actListado');
  const counter = document.getElementById('actCounter');
  if (listado) listado.innerHTML = `<div style="padding:20px; text-align:center"><div class="spinner" style="margin:0 auto"></div></div>`;
  try {
    const data = await api.get(`/api/actividades?q=${encodeURIComponent(q)}&limit=${_ACT_LIMIT}&offset=${_actOffset}`);
    const res = Array.isArray(data) ? { rows: data, total: data.length, hasMore: false } : data;
    _actRows = res.rows || [];
    _actTotal = res.total || _actRows.length;
    if (counter) {
      counter.innerHTML = q
        ? `<span style="color:var(--orange); font-weight:600">${_actTotal.toLocaleString()}</span> resultados para "<strong>${sanitize(q)}</strong>"`
        : `${_actTotal.toLocaleString()} actividades en total`;
    }
    renderActListado(_actRows);
    renderActPager(_actTotal, res.hasMore);
  } catch (e) {
    if (listado) listado.innerHTML = `<div style="padding:20px; text-align:center; color:var(--red)">Error al cargar</div>`;
  }
}

function renderActListado(lista) {
  const el = document.getElementById('actListado');
  if (!el) return;
  if (!lista.length) {
    el.innerHTML = `<div style="padding:30px; text-align:center; color:var(--text-muted)">
      <div style="font-size:32px; margin-bottom:8px">◌</div>
      <div style="font-weight:600; margin-bottom:4px">Sin resultados</div>
      <div style="font-size:12px">Intenta con otro término o código</div>
    </div>`; return;
  }
  el.innerHTML = lista.map(a => `
    <div class="act-item" onclick="seleccionarActividad(${a.id_actividad})"
         id="actItem-${a.id_actividad}"
         style="padding:10px 14px; cursor:pointer; border-bottom:1px solid var(--gray-light); transition:background 0.1s">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px">
        <div style="min-width:0">
          <div class="td-code" style="font-size:11px; margin-bottom:2px">${sanitize(a.codigo)}</div>
          <div style="font-size:12px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis"
               title="${sanitize(a.descripcion)}">${sanitize(a.descripcion)}</div>
          <div style="font-size:10px; color:var(--text-muted); margin-top:1px">${a.unidad}</div>
        </div>
        <div style="text-align:right; flex-shrink:0">
          <div style="font-family:'Barlow Condensed',sans-serif; font-size:14px; font-weight:700;
               color:${a.costo_total > 0 ? 'var(--green)' : 'var(--text-muted)'}">
            ${a.costo_total > 0 ? 'L ' + fmt(a.costo_total) : '—'}
          </div>
        </div>
      </div>
    </div>`).join('');
}

function renderActPager(total, hasMore) {
  const pager = document.getElementById('actPager');
  if (!pager) return;
  if (total <= _ACT_LIMIT) { pager.style.display = 'none'; return; }
  pager.style.display = 'flex';
  const from = _actOffset + 1, to = Math.min(_actOffset + _ACT_LIMIT, total);
  document.getElementById('actPagerInfo').textContent = `${from}–${to} de ${total.toLocaleString()}`;
  document.getElementById('btnActPrev').disabled = _actOffset === 0;
  document.getElementById('btnActNext').disabled = !hasMore;
}

function actPaginar(dir) {
  _actOffset = Math.max(0, _actOffset + dir * _ACT_LIMIT);
  buscarActividades();
  document.getElementById('actListado')?.scrollTo(0, 0);
}

// ─── Seleccionar y renderizar ficha APU ──────────────────
async function seleccionarActividad(id) {
  document.querySelectorAll('.act-item').forEach(el => el.style.background = '');
  const item = document.getElementById(`actItem-${id}`);
  if (item) item.style.background = 'rgba(2,81,150,0.09)';
  const det = document.getElementById('actDetalle');
  det.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
  try {
    const { actividad, detalles } = await api.get(`/api/actividades/${id}`);
    _actActual = actividad;
    _actInsumos = detalles;
    renderFichaAPU(actividad, detalles);
  } catch (e) { det.innerHTML = `<div class="empty-state">Error al cargar</div>`; }
}

// ─── FICHA APU VISUAL con edición en línea ───────────────
function renderFichaAPU(act, detalles) {
  const det = document.getElementById('actDetalle');

  // Agrupar por categoría y calcular subtotales
  const groups = {};
  const ORDER = ['Mano de Obra','Materiales','Equipo','Herramientas','Subcontratos'];
  detalles.forEach(d => {
    if (!groups[d.categoria]) groups[d.categoria] = [];
    groups[d.categoria].push(d);
  });
  const catsSorted = [...ORDER.filter(c => groups[c]), ...Object.keys(groups).filter(c => !ORDER.includes(c))];

  const totalCosto = detalles.reduce((s,d) => s + (d.costo_parcial||0), 0);

  // Construir filas de tabla por categoría
  let filasHTML = '';
  catsSorted.forEach(cat => {
    const items = groups[cat];
    const subTotal = items.reduce((s,d) => s + (d.costo_parcial||0), 0);
    const pct = totalCosto > 0 ? (subTotal/totalCosto*100).toFixed(1) : '0';
    const catColor = {
      'Mano de Obra':'#025196','Materiales':'#1A7A3C',
      'Equipo':'#8C4A00','Herramientas':'#5B4FBE','Subcontratos':'#C0392B'
    }[cat] || '#555';

    filasHTML += `
      <tr style="background:#f0f5fb">
        <td colspan="2" style="padding:6px 10px">
          <span style="background:${catColor};color:#fff;font-size:10px;font-weight:700;
            padding:2px 8px;border-radius:3px;letter-spacing:.5px">${cat.toUpperCase()}</span>
        </td>
        <td colspan="4" style="padding:6px 10px; font-size:11px; color:#666">${items.length} insumo${items.length!==1?'s':''}</td>
        <td style="text-align:right; padding:6px 10px; font-weight:700; color:${catColor}">L ${fmt(subTotal)}</td>
        <td style="text-align:right; padding:6px 10px; font-size:11px; color:#888">${pct}%</td>
        <td></td>
      </tr>`;

    items.forEach(d => {
      const cp = ((d.cantidad/(d.rendimiento||1))*(1+(d.desperdicio||0)/100)*(d.precio_unitario||0));
      filasHTML += `
        <tr id="apuRow-${d.id_detalle}" class="apu-row">
          <td style="padding:5px 10px 5px 22px; font-family:monospace; font-size:10px; color:var(--blue)">${sanitize(d.codigo||'')}</td>
          <td style="padding:5px 8px; font-size:12px; max-width:220px">
            <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${sanitize(d.descripcion)}">${sanitize(d.descripcion)}</div>
            <div style="font-size:10px;color:#888">${d.unidad}</div>
          </td>
          <td style="padding:4px 6px; text-align:center">
            <input type="number" class="apu-input" value="${d.cantidad}" min="0.0001" step="0.001"
              onchange="apuCambio(${act.id_actividad},${d.id_detalle},'cantidad',this)"
              style="width:72px;text-align:right;font-size:12px;padding:3px 5px;border:1px solid #ddd;border-radius:3px">
          </td>
          <td style="padding:4px 6px; text-align:center">
            <input type="number" class="apu-input" value="${d.rendimiento||1}" min="0.0001" step="0.001"
              onchange="apuCambio(${act.id_actividad},${d.id_detalle},'rendimiento',this)"
              style="width:72px;text-align:right;font-size:12px;padding:3px 5px;border:1px solid #ddd;border-radius:3px">
          </td>
          <td style="padding:4px 6px; text-align:center">
            <input type="number" class="apu-input" value="${d.desperdicio||0}" min="0" step="0.5"
              onchange="apuCambio(${act.id_actividad},${d.id_detalle},'desperdicio',this)"
              style="width:56px;text-align:right;font-size:12px;padding:3px 5px;border:1px solid #ddd;border-radius:3px">
          </td>
          <td style="padding:5px 8px; text-align:right; font-size:12px; color:#555">
            L ${fmt(d.precio_unitario)}
          </td>
          <td id="cp-${d.id_detalle}" style="padding:5px 8px; text-align:right; font-size:12px; font-weight:600; color:var(--green)">
            L ${fmt(cp)}
          </td>
          <td id="pct-${d.id_detalle}" style="padding:5px 8px; text-align:right; font-size:11px; color:#888">
            ${totalCosto > 0 ? (cp/totalCosto*100).toFixed(1) : '0'}%
          </td>
          <td style="padding:4px 6px; text-align:center; white-space:nowrap">
            <button class="btn btn-secondary btn-sm btn-icon" title="Editar insumo"
              onclick="modalEditarInsumoAPU(${act.id_actividad},${d.id_detalle})" style="margin-right:2px">✎</button>
            <button class="btn btn-danger btn-sm btn-icon" title="Quitar"
              onclick="eliminarInsumoAct(${act.id_actividad},${d.id_detalle})">✕</button>
          </td>
        </tr>`;
    });
  });

  // Barra de composición (gráfica de barras)
  const barHTML = catsSorted.map(cat => {
    const sub = groups[cat].reduce((s,d)=>s+(d.costo_parcial||0),0);
    const pct = totalCosto > 0 ? sub/totalCosto*100 : 0;
    const c = {'Mano de Obra':'#025196','Materiales':'#1A7A3C','Equipo':'#8C4A00',
               'Herramientas':'#5B4FBE','Subcontratos':'#C0392B'}[cat]||'#888';
    return pct > 0.5 ? `<div style="width:${pct.toFixed(1)}%;background:${c};height:100%;display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;font-weight:700;overflow:hidden;white-space:nowrap" title="${cat}: ${pct.toFixed(1)}%">${pct>=8?cat:''}` : '';
  }).join('</div>') + (catsSorted.some(c=>(groups[c].reduce((s,d)=>s+(d.costo_parcial||0),0)/totalCosto*100)>0.5)?'</div>':'');

  det.innerHTML = `
    <div class="card">
      <!-- Encabezado de ficha -->
      <div style="background:var(--blue);color:#fff;padding:14px 18px;border-radius:4px 4px 0 0">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-family:monospace;font-size:13px;opacity:.8;margin-bottom:2px">${sanitize(act.codigo)}</div>
            <div style="font-size:16px;font-weight:700;line-height:1.3">${sanitize(act.descripcion)}</div>
            <div style="font-size:12px;opacity:.75;margin-top:4px">Unidad de medida: <strong>${act.unidad}</strong></div>
          </div>
          <div style="text-align:right">
            <div style="font-size:10px;opacity:.7;text-transform:uppercase;letter-spacing:.5px">Costo Directo Unitario</div>
            <div id="apuTotalDisplay" style="font-size:28px;font-weight:700;font-family:'Barlow Condensed',sans-serif;color:#FDB338">
              L ${fmt(totalCosto)}
            </div>
            <div style="font-size:10px;opacity:.7">${detalles.length} insumo${detalles.length!==1?'s':''}</div>
          </div>
        </div>
      </div>

      <!-- Barra composición -->
      ${totalCosto > 0 ? `
      <div style="padding:8px 18px 0">
        <div style="font-size:10px;color:#888;margin-bottom:4px;text-transform:uppercase;letter-spacing:.4px">Composición del costo</div>
        <div style="display:flex;height:18px;border-radius:3px;overflow:hidden;background:#eee">${barHTML}</div>
        <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:6px">
          ${catsSorted.map(cat => {
            const sub = groups[cat].reduce((s,d)=>s+(d.costo_parcial||0),0);
            const pct = totalCosto>0 ? (sub/totalCosto*100).toFixed(1) : '0';
            const c = {'Mano de Obra':'#025196','Materiales':'#1A7A3C','Equipo':'#8C4A00',
                       'Herramientas':'#5B4FBE','Subcontratos':'#C0392B'}[cat]||'#888';
            return `<span style="font-size:10px;display:flex;align-items:center;gap:4px">
              <span style="width:10px;height:10px;background:${c};border-radius:2px;display:inline-block"></span>
              ${cat}: <strong>${pct}%</strong>
            </span>`;
          }).join('')}
        </div>
      </div>` : ''}

      <!-- Acciones -->
      <div style="padding:10px 18px;border-bottom:1px solid var(--gray-light);display:flex;gap:8px;align-items:center">
        <button class="btn btn-orange btn-sm" onclick="modalNuevoInsumoAct(${act.id_actividad})">+ Agregar Insumo</button>
        <button class="btn btn-secondary btn-sm" onclick="modalEditarActividad(${act.id_actividad})">✎ Editar actividad</button>
        <button class="btn btn-secondary btn-sm" onclick="clonarActividad(${act.id_actividad})">⎘ Clonar</button>
        <div style="flex:1"></div>
        <span style="font-size:11px;color:#888">✏ Edita cantidad/rendimiento/desperdicio directo en la tabla</span>
        <button class="btn btn-danger btn-sm" onclick="eliminarActividad(${act.id_actividad})">🗑 Eliminar</button>
      </div>

      <!-- Tabla APU -->
      <div class="table-wrap" style="margin:0">
        <table style="font-size:12px">
          <thead>
            <tr style="background:var(--blue);color:#fff">
              <th style="width:80px">Código</th>
              <th>Descripción / Unidad</th>
              <th style="text-align:center;width:80px">Cantidad</th>
              <th style="text-align:center;width:80px">Rendto</th>
              <th style="text-align:center;width:65px">Desp.%</th>
              <th style="text-align:right;width:100px">P.Unitario</th>
              <th style="text-align:right;width:110px">C.Parcial</th>
              <th style="text-align:right;width:55px">%</th>
              <th style="width:80px"></th>
            </tr>
          </thead>
          <tbody id="apuTbody">
            ${filasHTML || `<tr><td colspan="9"><div class="empty-state" style="padding:30px">
              <div class="empty-icon" style="font-size:32px">◇</div>
              <div class="empty-title">Sin insumos</div>
              <button class="btn btn-orange" style="margin-top:12px" onclick="modalNuevoInsumoAct(${act.id_actividad})">+ Agregar Insumo</button>
            </div></td></tr>`}
          </tbody>
          <tfoot>
            <tr style="background:var(--blue);color:#fff;font-weight:700">
              <td colspan="6" style="padding:10px 18px;text-align:right;font-size:13px">COSTO DIRECTO UNITARIO — ${act.unidad}</td>
              <td id="apuTotalFoot" style="padding:10px 8px;text-align:right;font-size:15px;color:#FDB338">L ${fmt(totalCosto)}</td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Resumen con porcentajes típicos -->
      <div style="padding:14px 18px;border-top:1px solid var(--gray-light)">
        <div style="font-size:11px;font-weight:700;color:var(--blue);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">
          Resumen de costo con incidencias
        </div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px" id="apuResumen">
          ${renderApuResumen(act, totalCosto)}
        </div>
      </div>
    </div>`;
}

function renderApuResumen(act, cd) {
  // Leer porcentajes del primer presupuesto o usar defaults
  const pI = 15, pU = 10, pIm = 5;
  const ci = cd*pI/100, ut = cd*pU/100, im = cd*pIm/100, tot = cd+ci+ut+im;
  return [
    ['Costos Directos','#025196',cd],
    [`Indirectos (${pI}%)`,'#5B4FBE',ci],
    [`Utilidad (${pU}%)`,'#1A7A3C',ut],
    [`Imprevistos (${pIm}%)`,'#8C4A00',im],
    ['TOTAL GENERAL','#c0392b',tot]
  ].map(([lbl,clr,val])=>`
    <div style="background:#f7f9fc;border-left:3px solid ${clr};border-radius:3px;padding:8px 10px">
      <div style="font-size:10px;color:#666;margin-bottom:3px">${lbl}</div>
      <div style="font-size:14px;font-weight:700;color:${clr};font-family:'Barlow Condensed',sans-serif">L ${fmt(val)}</div>
    </div>`).join('');
}

// ─── Cambio en línea de cantidad/rendimiento/desperdicio ──
let _apuSaveTimer = null;
function apuCambio(idActividad, idDetalle, campo, inputEl) {
  // Actualizar preview local inmediato
  const row = document.getElementById(`apuRow-${idDetalle}`);
  if (!row) return;
  const inputs = row.querySelectorAll('.apu-input');
  const cant  = parseFloat(inputs[0].value) || 1;
  const rend  = parseFloat(inputs[1].value) || 1;
  const desp  = parseFloat(inputs[2].value) || 0;

  // Obtener precio del insumo (está en la celda de precio)
  const celdas = row.querySelectorAll('td');
  const precioText = celdas[5]?.textContent?.replace(/[L\s,]/g,'') || '0';
  const precio = parseFloat(precioText) || 0;

  const cp = (cant / rend) * (1 + desp/100) * precio;
  const cpCell = document.getElementById(`cp-${idDetalle}`);
  if (cpCell) cpCell.textContent = `L ${fmt(cp)}`;

  // Recalcular total global en la ficha
  let total = 0;
  document.querySelectorAll('.apu-row').forEach(r => {
    const ins = r.querySelectorAll('.apu-input');
    const c2 = parseFloat(ins[0]?.value)||1;
    const r2 = parseFloat(ins[1]?.value)||1;
    const d2 = parseFloat(ins[2]?.value)||0;
    const txt = r.querySelectorAll('td')[5]?.textContent?.replace(/[L\s,]/g,'')||'0';
    const p2 = parseFloat(txt)||0;
    total += (c2/r2)*(1+d2/100)*p2;
  });
  const totalEl = document.getElementById('apuTotalDisplay');
  const totalFt = document.getElementById('apuTotalFoot');
  if (totalEl) totalEl.textContent = `L ${fmt(total)}`;
  if (totalFt) totalFt.textContent = `L ${fmt(total)}`;

  // Actualizar % de cada fila
  document.querySelectorAll('.apu-row').forEach(r => {
    const ins = r.querySelectorAll('.apu-input');
    const c2 = parseFloat(ins[0]?.value)||1;
    const r2 = parseFloat(ins[1]?.value)||1;
    const d2 = parseFloat(ins[2]?.value)||0;
    const txt = r.querySelectorAll('td')[5]?.textContent?.replace(/[L\s,]/g,'')||'0';
    const p2 = parseFloat(txt)||0;
    const cp2 = (c2/r2)*(1+d2/100)*p2;
    const id = r.id.replace('apuRow-','');
    const pctEl = document.getElementById(`pct-${id}`);
    if (pctEl) pctEl.textContent = total > 0 ? `${(cp2/total*100).toFixed(1)}%` : '0%';
  });

  // Guardar en backend con debounce (700ms)
  inputEl.style.borderColor = '#FDB338';
  clearTimeout(_apuSaveTimer);
  _apuSaveTimer = setTimeout(async () => {
    try {
      // Reunir todos los valores actuales del insumo
      const cantS  = parseFloat(row.querySelectorAll('.apu-input')[0].value)||1;
      const rendS  = parseFloat(row.querySelectorAll('.apu-input')[1].value)||1;
      const despS  = parseFloat(row.querySelectorAll('.apu-input')[2].value)||0;
      // Necesitamos id_insumo - lo guardamos como data attr en la fila
      const idInsumo = row.dataset.idInsumo;
      if (!idInsumo) {
        // Fallback: recargar actividad completa y guardar
        await api.put(`/api/actividades/${idActividad}/insumos/${idDetalle}`, {
          id_insumo: null, cantidad: cantS, rendimiento: rendS, desperdicio: despS
        });
      } else {
        await api.put(`/api/actividades/${idActividad}/insumos/${idDetalle}`, {
          id_insumo: parseInt(idInsumo), cantidad: cantS, rendimiento: rendS, desperdicio: despS
        });
      }
      inputEl.style.borderColor = '#1A7A3C';
      setTimeout(() => { if (inputEl) inputEl.style.borderColor = '#ddd'; }, 1500);
      // Actualizar la ficha silenciosamente
      const data = await api.get(`/api/actividades/${idActividad}`);
      _actActual = data.actividad;
      _actInsumos = data.detalles;
      // Actualizar solo el total en la lista lateral
      const listItem = document.getElementById(`actItem-${idActividad}`);
      if (listItem) {
        const priceEl = listItem.querySelector('div[style*="font-weight:700"]');
        if (priceEl) priceEl.textContent = `L ${fmt(data.actividad.costo_total)}`;
      }
    } catch(e) {
      inputEl.style.borderColor = 'var(--red)';
      toast('Error al guardar', 'error');
    }
  }, 700);
}

// ─── CRUD Actividades ─────────────────────────────────────
function modalNuevaActividad() {
  showModal('NUEVA ACTIVIDAD', `
    <div class="form-grid form-grid-2">
      <div class="form-group">
        <label class="form-label">Código *</label>
        <input type="text" id="aCodigo" placeholder="AP-001 / F002050 / M-001">
      </div>
      <div class="form-group">
        <label class="form-label">Unidad *</label>
        <input type="text" id="aUnidad" placeholder="m³ / m² / ML / Global">
      </div>
      <div class="form-group" style="grid-column:span 2">
        <label class="form-label">Descripción *</label>
        <input type="text" id="aDesc" placeholder="Ej: Tubería PVC 4'' SDR-26 instalada">
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-orange" onclick="guardarActividad()">Guardar</button>
    </div>`);
}

async function guardarActividad() {
  const codigo = document.getElementById('aCodigo').value.trim();
  const desc   = document.getElementById('aDesc').value.trim();
  if (!codigo || !desc) { toast('Código y descripción son obligatorios', 'error'); return; }
  try {
    const r = await api.post('/api/actividades', {
      codigo, descripcion: desc, unidad: document.getElementById('aUnidad').value.trim()
    });
    hideModal(); toast('Actividad creada');
    _actOffset = 0; await buscarActividades();
    if (r.id) seleccionarActividad(r.id);
  } catch (e) { toast(e.error || 'Error', 'error'); }
}

function modalEditarActividad(id) {
  const a = _actActual;
  showModal('EDITAR ACTIVIDAD', `
    <div class="form-grid form-grid-2">
      <div class="form-group">
        <label class="form-label">Código *</label>
        <input type="text" id="aCodigo" value="${sanitize(a.codigo)}">
      </div>
      <div class="form-group">
        <label class="form-label">Unidad *</label>
        <input type="text" id="aUnidad" value="${sanitize(a.unidad)}">
      </div>
      <div class="form-group" style="grid-column:span 2">
        <label class="form-label">Descripción *</label>
        <input type="text" id="aDesc" value="${sanitize(a.descripcion)}">
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="actualizarActividad(${id})">Actualizar</button>
    </div>`);
}

async function actualizarActividad(id) {
  try {
    await api.put(`/api/actividades/${id}`, {
      codigo: document.getElementById('aCodigo').value.trim(),
      descripcion: document.getElementById('aDesc').value.trim(),
      unidad: document.getElementById('aUnidad').value.trim()
    });
    hideModal(); toast('Actividad actualizada');
    await buscarActividades(); seleccionarActividad(id);
  } catch (e) { toast(e.error || 'Error', 'error'); }
}

async function eliminarActividad(id) {
  if (!confirm('¿Eliminar esta actividad y todos sus insumos?')) return;
  try {
    await api.del(`/api/actividades/${id}`);
    toast('Actividad eliminada');
    document.getElementById('actDetalle').innerHTML = `
      <div class="empty-state" style="background:var(--white); border-radius:4px; border:1px solid var(--gray-mid); padding:60px">
        <div class="empty-icon">📐</div><div class="empty-title">Selecciona una actividad</div>
      </div>`;
    await buscarActividades();
  } catch (e) { toast(e.error || 'Error', 'error'); }
}

async function clonarActividad(id) {
  try {
    const r = await api.post(`/api/actividades/${id}/clonar`, {});
    toast('Actividad clonada — ahora puedes editarla');
    await buscarActividades();
    if (r.id) seleccionarActividad(r.id);
  } catch (e) { toast(e.error || 'Error al clonar', 'error'); }
}

// ─── Agregar / Editar insumo en APU ──────────────────────
async function modalNuevoInsumoAct(idActividad) {
  let ins = await api.get('/api/insumos?limit=3000');
  const lista = Array.isArray(ins) ? ins : (ins.rows || []);
  window._insumosModal = lista;
  showModal('AGREGAR INSUMO AL APU', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div style="grid-column:span 2">
        <label class="form-label">Buscar insumo *</label>
        <div style="position:relative">
          <input type="text" id="aiSearch" placeholder="Escribe nombre o código del insumo..."
            oninput="filtrarInsumosModal()" style="width:100%;padding-right:36px"
            autocomplete="off">
        </div>
        <select id="aiInsumo" size="7" style="width:100%; font-size:12px; margin-top:6px; border:1px solid var(--gray-mid)"
          onchange="onInsumoModalSelect()">
          ${lista.slice(0,200).map(i => `<option value="${i.id_insumo}" data-precio="${i.precio_unitario}" data-unidad="${i.unidad||''}">[${i.categoria||''}] ${sanitize(i.descripcion)} — L ${fmt(i.precio_unitario)}/${i.unidad}</option>`).join('')}
        </select>
        <div id="aiPrecioInfo" style="margin-top:6px;font-size:11px;color:var(--blue);background:#f0f5fb;padding:5px 10px;border-radius:3px"></div>
      </div>
      <div>
        <label class="form-label">Cantidad</label>
        <input type="number" id="aiCantidad" value="1" step="0.0001" min="0.0001" oninput="calcApuPreview()">
        <div style="font-size:10px;color:#888;margin-top:3px">Ej: 0.35 m³ por m² de muro</div>
      </div>
      <div>
        <label class="form-label">Rendimiento</label>
        <input type="number" id="aiRendimiento" value="1" step="0.0001" min="0.0001" oninput="calcApuPreview()">
        <div style="font-size:10px;color:#888;margin-top:3px">Factor de eficiencia (1 = 100%)</div>
      </div>
      <div>
        <label class="form-label">Desperdicio (%)</label>
        <input type="number" id="aiDesperdicio" value="0" step="0.5" min="0" oninput="calcApuPreview()">
        <div style="font-size:10px;color:#888;margin-top:3px">Pérdida típica por manejo</div>
      </div>
      <div>
        <div style="background:var(--blue);color:#fff;border-radius:4px;padding:10px 14px;height:100%">
          <div style="font-size:10px;opacity:.8;text-transform:uppercase;letter-spacing:.4px">Costo Parcial (preview)</div>
          <div id="aiCpPreview" style="font-size:22px;font-weight:700;font-family:'Barlow Condensed',sans-serif;color:#FDB338;margin-top:4px">L 0.00</div>
          <div style="font-size:10px;opacity:.7;margin-top:4px">= (Cant ÷ Rendto) × (1+Desp%) × Precio</div>
        </div>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-orange" onclick="guardarInsumoAct(${idActividad})">Agregar al APU</button>
    </div>`);
  calcApuPreview();
}

function onInsumoModalSelect() {
  const sel = document.getElementById('aiInsumo');
  const opt = sel?.options[sel.selectedIndex];
  if (!opt) return;
  const precio = parseFloat(opt.dataset.precio)||0;
  const unidad = opt.dataset.unidad||'';
  const info = document.getElementById('aiPrecioInfo');
  if (info) info.textContent = `Precio: L ${fmt(precio)} / ${unidad}`;
  calcApuPreview();
}

function calcApuPreview() {
  const sel  = document.getElementById('aiInsumo');
  const opt  = sel?.options[sel?.selectedIndex];
  const precio = parseFloat(opt?.dataset?.precio||'0')||0;
  const cant = parseFloat(document.getElementById('aiCantidad')?.value)||1;
  const rend = parseFloat(document.getElementById('aiRendimiento')?.value)||1;
  const desp = parseFloat(document.getElementById('aiDesperdicio')?.value)||0;
  const cp = (cant/rend)*(1+desp/100)*precio;
  const el = document.getElementById('aiCpPreview');
  if (el) el.textContent = `L ${fmt(cp)}`;
}

function filtrarInsumosModal() {
  const q = (document.getElementById('aiSearch')?.value || '').toLowerCase();
  const sel = document.getElementById('aiInsumo');
  if (!sel || !window._insumosModal) return;
  const filtered = window._insumosModal.filter(i =>
    i.descripcion.toLowerCase().includes(q) || (i.codigo||'').toLowerCase().includes(q)).slice(0,200);
  sel.innerHTML = filtered.map(i =>
    `<option value="${i.id_insumo}" data-precio="${i.precio_unitario}" data-unidad="${i.unidad||''}">[${i.categoria||''}] ${sanitize(i.descripcion)} — L ${fmt(i.precio_unitario)}/${i.unidad}</option>`
  ).join('');
  calcApuPreview();
}

async function guardarInsumoAct(idActividad) {
  const id_insumo = document.getElementById('aiInsumo').value;
  if (!id_insumo) { toast('Selecciona un insumo', 'error'); return; }
  try {
    await api.post(`/api/actividades/${idActividad}/insumos`, {
      id_insumo,
      cantidad:    parseFloat(document.getElementById('aiCantidad').value) || 1,
      rendimiento: parseFloat(document.getElementById('aiRendimiento').value) || 1,
      desperdicio: parseFloat(document.getElementById('aiDesperdicio').value) || 0
    });
    hideModal(); toast('Insumo agregado al APU');
    await buscarActividades(); seleccionarActividad(idActividad);
  } catch (e) { toast(e.error || 'Error', 'error'); }
}

async function modalEditarInsumoAPU(idActividad, idDetalle) {
  const d = _actInsumos.find(x => x.id_detalle === idDetalle);
  if (!d) return;
  let ins = await api.get('/api/insumos?limit=3000');
  const lista = Array.isArray(ins) ? ins : (ins.rows || []);
  window._insumosModal = lista;
  showModal('EDITAR INSUMO DEL APU', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div style="grid-column:span 2">
        <label class="form-label">Insumo</label>
        <div style="background:#f0f5fb;padding:8px 12px;border-radius:4px;margin-bottom:6px">
          <strong>${sanitize(d.descripcion)}</strong> — L ${fmt(d.precio_unitario)}/${d.unidad}
        </div>
        <label class="form-label">Cambiar insumo (opcional)</label>
        <input type="text" id="aiSearch" placeholder="Buscar otro insumo..."
          oninput="filtrarInsumosModal()" style="width:100%;margin-bottom:4px" autocomplete="off">
        <select id="aiInsumo" size="5" style="width:100%;font-size:12px;border:1px solid var(--gray-mid)" onchange="onInsumoModalSelect()">
          <option value="${d.id_insumo}" data-precio="${d.precio_unitario}" data-unidad="${d.unidad}" selected>
            [Actual] ${sanitize(d.descripcion)} — L ${fmt(d.precio_unitario)}/${d.unidad}
          </option>
          ${lista.filter(i=>i.id_insumo!==d.id_insumo).slice(0,100).map(i =>
            `<option value="${i.id_insumo}" data-precio="${i.precio_unitario}" data-unidad="${i.unidad||''}">[${i.categoria||''}] ${sanitize(i.descripcion)} — L ${fmt(i.precio_unitario)}/${i.unidad}</option>`
          ).join('')}
        </select>
      </div>
      <div>
        <label class="form-label">Cantidad</label>
        <input type="number" id="aiCantidad" value="${d.cantidad}" step="0.0001" min="0.0001" oninput="calcApuPreview()">
      </div>
      <div>
        <label class="form-label">Rendimiento</label>
        <input type="number" id="aiRendimiento" value="${d.rendimiento||1}" step="0.0001" min="0.0001" oninput="calcApuPreview()">
      </div>
      <div>
        <label class="form-label">Desperdicio (%)</label>
        <input type="number" id="aiDesperdicio" value="${d.desperdicio||0}" step="0.5" min="0" oninput="calcApuPreview()">
      </div>
      <div>
        <div style="background:var(--blue);color:#fff;border-radius:4px;padding:10px 14px">
          <div style="font-size:10px;opacity:.8">Costo Parcial (preview)</div>
          <div id="aiCpPreview" style="font-size:22px;font-weight:700;font-family:'Barlow Condensed',sans-serif;color:#FDB338">L ${fmt(d.costo_parcial)}</div>
        </div>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="actualizarInsumoAPU(${idActividad},${idDetalle})">Guardar cambios</button>
    </div>`);
  calcApuPreview();
}

async function actualizarInsumoAPU(idActividad, idDetalle) {
  const id_insumo = document.getElementById('aiInsumo').value;
  if (!id_insumo) { toast('Selecciona un insumo', 'error'); return; }
  try {
    await api.put(`/api/actividades/${idActividad}/insumos/${idDetalle}`, {
      id_insumo: parseInt(id_insumo),
      cantidad:    parseFloat(document.getElementById('aiCantidad').value)||1,
      rendimiento: parseFloat(document.getElementById('aiRendimiento').value)||1,
      desperdicio: parseFloat(document.getElementById('aiDesperdicio').value)||0
    });
    hideModal(); toast('Insumo actualizado');
    await buscarActividades(); seleccionarActividad(idActividad);
  } catch (e) { toast(e.error || 'Error', 'error'); }
}

async function eliminarInsumoAct(idActividad, idDetalle) {
  try {
    await api.del(`/api/actividades/${idActividad}/insumos/${idDetalle}`);
    toast('Insumo removido');
    await buscarActividades(); seleccionarActividad(idActividad);
  } catch (e) { toast(e.error || 'Error', 'error'); }
}
