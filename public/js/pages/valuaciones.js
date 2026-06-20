// ═══════════════════════════════════════════════════════════════
// VALUACIONES — Estimaciones de pago por avance físico
// ═══════════════════════════════════════════════════════════════
let _valCtx = { idPresupuesto: null, nombrePresupuesto: null };

async function renderValuaciones(ctx = {}) {
  if (ctx.idPresupuesto) { _valCtx.idPresupuesto = ctx.idPresupuesto; _valCtx.nombrePresupuesto = ctx.nombre; }
  const el = document.getElementById('pageContent');

  // Cargar lista de presupuestos para selector
  let presupuestos = [];
  try { presupuestos = await api.get('/api/seguimiento/presupuestos'); } catch(e){}

  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">VALUACIONES DE OBRA</div>
        <div class="page-subtitle">Estimaciones de pago por avance físico — Documento de cobro al cliente</div>
      </div>
      <button class="btn btn-orange" onclick="modalNuevaValuacion()">+ Nueva Valuación</button>
    </div>
    <div class="page-body">
      <!-- Selector de presupuesto -->
      <div class="card" style="margin-bottom:16px;padding:14px 18px">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <label style="font-size:13px;font-weight:600;color:var(--blue);white-space:nowrap">Filtrar por presupuesto:</label>
          <select id="valPresSelect" onchange="onValPresChange()" style="flex:1;min-width:220px;max-width:400px">
            <option value="">— Todos los presupuestos —</option>
            ${presupuestos.map(p => `<option value="${p.id_presupuesto}" ${_valCtx.idPresupuesto==p.id_presupuesto?'selected':''}>${sanitize(p.nombre)}</option>`).join('')}
          </select>
          <button class="btn btn-secondary btn-sm" onclick="loadValuaciones()">🔄 Actualizar</button>
        </div>
      </div>

      <div id="valListado"><div class="loading"><div class="spinner"></div></div></div>
    </div>`;

  await loadValuaciones();
}

async function onValPresChange() {
  const sel = document.getElementById('valPresSelect');
  _valCtx.idPresupuesto = sel.value ? parseInt(sel.value) : null;
  await loadValuaciones();
}

async function loadValuaciones() {
  const el = document.getElementById('valListado');
  if (!el) return;
  el.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
  try {
    const url = _valCtx.idPresupuesto ? `/api/valuaciones?id_presupuesto=${_valCtx.idPresupuesto}` : '/api/valuaciones';
    const lista = await api.get(url);
    if (!lista.length) {
      el.innerHTML = `<div class="empty-state" style="background:var(--white);border:1px solid var(--gray-mid);border-radius:4px;padding:60px">
        <div class="empty-icon" style="font-size:48px">📋</div>
        <div class="empty-title">Sin valuaciones</div>
        <div class="empty-desc">Crea una valuación para registrar el avance físico del período y generar el documento de cobro.</div>
        <button class="btn btn-orange" style="margin-top:16px" onclick="modalNuevaValuacion()">+ Nueva Valuación</button>
      </div>`; return;
    }

    const estadoConfig = {
      borrador: {color:'#888',bg:'#f5f5f5',label:'Borrador'},
      enviada:  {color:'#0057A8',bg:'#e8f0fb',label:'Enviada'},
      aprobada: {color:'#1A7A3C',bg:'#e8f5eb',label:'Aprobada'},
      pagada:   {color:'#5B4FBE',bg:'#eeecfb',label:'Pagada'}
    };

    el.innerHTML = `
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>N°</th><th>Descripción</th><th>Presupuesto</th>
              <th>Fecha</th><th>Período</th>
              <th style="text-align:right">Monto Bruto</th>
              <th style="text-align:right">Retención</th>
              <th style="text-align:right">Monto Neto</th>
              <th style="text-align:center">Estado</th>
              <th></th>
            </tr></thead>
            <tbody>
              ${lista.map(v => {
                const ec = estadoConfig[v.estado]||estadoConfig.borrador;
                return `<tr>
                  <td class="td-code">Val-${String(v.numero).padStart(3,'0')}</td>
                  <td style="max-width:200px;font-size:12px">${sanitize(v.descripcion||'')}</td>
                  <td style="font-size:11px;color:#555">${sanitize(v.presupuesto_nombre||'')}</td>
                  <td style="font-size:11px">${v.fecha||'—'}</td>
                  <td style="font-size:10px;color:#888">${v.fecha_desde?v.fecha_desde+' → '+v.fecha_hasta:'—'}</td>
                  <td class="td-monto">L ${fmt(v.monto_bruto)}</td>
                  <td style="text-align:right;font-size:12px;color:#c0392b">L ${fmt(v.monto_retencion)}</td>
                  <td class="td-monto" style="color:var(--blue);font-weight:700">L ${fmt(v.monto_neto)}</td>
                  <td style="text-align:center">
                    <span style="background:${ec.bg};color:${ec.color};padding:3px 10px;border-radius:12px;font-size:10px;font-weight:700">${ec.label}</span>
                  </td>
                  <td style="white-space:nowrap">
                    <button class="btn btn-secondary btn-sm" onclick="abrirValuacion(${v.id_valuacion})">✎ Editar</button>
                    <button class="btn btn-secondary btn-sm" onclick="window.open('/api/valuaciones/${v.id_valuacion}/html','_blank')" title="Imprimir">🖨</button>
                    ${v.estado!=='pagada'?`<button class="btn btn-danger btn-sm btn-icon" onclick="eliminarValuacion(${v.id_valuacion})" title="Eliminar">✕</button>`:''}
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch(e) { el.innerHTML = `<div class="empty-state">Error al cargar: ${e.error||e.message||''}</div>`; }
}

function modalNuevaValuacion() {
  showModal('NUEVA VALUACIÓN DE OBRA', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div style="grid-column:span 2">
        <label class="form-label">Presupuesto *</label>
        <select id="valPres" style="width:100%">
          <option value="">Seleccionar presupuesto...</option>
        </select>
      </div>
      <div>
        <label class="form-label">Fecha de valuación *</label>
        <input type="date" id="valFecha" value="${new Date().toISOString().slice(0,10)}">
      </div>
      <div>
        <label class="form-label">% Retención</label>
        <input type="number" id="valRetencion" value="10" min="0" max="100" step="0.5">
        <div style="font-size:10px;color:#888;margin-top:3px">Típico: 10% retención de garantía</div>
      </div>
      <div>
        <label class="form-label">Fecha inicio período</label>
        <input type="date" id="valDesde">
      </div>
      <div>
        <label class="form-label">Fecha fin período</label>
        <input type="date" id="valHasta">
      </div>
      <div style="grid-column:span 2">
        <label class="form-label">Descripción</label>
        <input type="text" id="valDesc" placeholder="Ej: Estimación N°1 — Julio 2025">
      </div>
      <div>
        <label class="form-label">Elaborado por</label>
        <input type="text" id="valElab" placeholder="Nombre del Ingeniero Residente">
      </div>
      <div>
        <label class="form-label">Notas</label>
        <input type="text" id="valNotas" placeholder="Observaciones generales">
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-orange" onclick="crearValuacion()">Crear Valuación</button>
    </div>`, 'modal-lg');

  // Cargar presupuestos en el select
  api.get('/api/seguimiento/presupuestos').then(lista => {
    const sel = document.getElementById('valPres');
    if (!sel) return;
    lista.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id_presupuesto;
      opt.textContent = `${p.nombre} — L ${fmt(p.total_general)}`;
      if (_valCtx.idPresupuesto == p.id_presupuesto) opt.selected = true;
      sel.appendChild(opt);
    });
  });
}

async function crearValuacion() {
  const id_presupuesto = document.getElementById('valPres').value;
  const fecha = document.getElementById('valFecha').value;
  if (!id_presupuesto || !fecha) { toast('Presupuesto y fecha son requeridos', 'error'); return; }
  try {
    const r = await api.post('/api/valuaciones', {
      id_presupuesto: parseInt(id_presupuesto),
      fecha,
      fecha_desde: document.getElementById('valDesde').value || null,
      fecha_hasta: document.getElementById('valHasta').value || null,
      descripcion: document.getElementById('valDesc').value || null,
      pct_retencion: parseFloat(document.getElementById('valRetencion').value) || 0,
      elaborado_por: document.getElementById('valElab').value || null,
      notas: document.getElementById('valNotas').value || null,
    });
    hideModal();
    toast(`Valuación N°${r.numero} creada`);
    _valCtx.idPresupuesto = parseInt(id_presupuesto);
    await loadValuaciones();
    abrirValuacion(r.id);
  } catch(e) { toast(e.error || 'Error al crear', 'error'); }
}

async function abrirValuacion(id) {
  try {
    const { valuacion: v, items } = await api.get(`/api/valuaciones/${id}`);

    const estadoOpts = ['borrador','enviada','aprobada','pagada']
      .map(s => `<option value="${s}" ${v.estado===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('');

    // Agrupar items por módulo
    const grupos = {};
    items.forEach(it => { const k = it.modulo||'General'; if(!grupos[k]) grupos[k]=[]; grupos[k].push(it); });

    let filasPorModulo = '';
    let totalPeriodo = 0;
    for (const [mod, rows] of Object.entries(grupos)) {
      filasPorModulo += `
        <tr style="background:var(--blue);color:#fff">
          <td colspan="9" style="padding:6px 12px;font-weight:700;font-size:12px">${sanitize(mod)}</td>
        </tr>`;
      rows.forEach(it => {
        const avAnt = Number(it.avance_anterior||0);
        const avPer = Number(it.avance_periodo||0);
        const avAcum = avAnt + avPer;
        const maxDisp = 100 - avAnt;
        totalPeriodo += (it.monto_periodo||0);
        const pctBar = avAcum;
        filasPorModulo += `
          <tr id="valRow-${it.id_partida}">
            <td class="td-code" style="font-size:10px">${sanitize(it.codigo)}</td>
            <td style="font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${sanitize(it.descripcion)}">${sanitize(it.descripcion)}</td>
            <td style="text-align:center">${sanitize(it.unidad)}</td>
            <td style="text-align:right">${Number(it.cant_presup||0).toFixed(2)}</td>
            <td style="text-align:right;font-size:12px">L ${fmt(it.precio_unitario)}</td>
            <td style="text-align:right;color:#888">${avAnt.toFixed(1)}%</td>
            <td style="text-align:center;padding:4px 6px">
              <div style="display:flex;align-items:center;gap:6px">
                <input type="number" class="val-av-input" data-partida="${it.id_partida}"
                  value="${avPer.toFixed(1)}" min="0" max="${maxDisp.toFixed(1)}" step="0.1"
                  style="width:60px;text-align:right;font-size:12px;padding:3px 5px;border:1px solid #ddd;border-radius:3px"
                  oninput="valRecalcRow(${it.id_partida},${avAnt},${it.precio_unitario},${it.cant_presup||0},this)">
                <span style="font-size:10px;color:#888">%</span>
              </div>
            </td>
            <td style="text-align:right;color:#555;font-size:11px">${avAcum.toFixed(1)}%</td>
            <td id="valMonto-${it.id_partida}" style="text-align:right;font-weight:700;color:var(--green)">L ${fmt(it.monto_periodo)}</td>
          </tr>
          <tr>
            <td colspan="9" style="padding:0 8px 4px">
              <div style="display:flex;align-items:center;gap:6px;height:6px">
                <div style="flex:1;background:#eee;border-radius:2px;overflow:hidden;height:6px">
                  <div style="width:${Math.min(avAcum,100)}%;background:${avAcum>=100?'var(--blue)':'var(--orange)'};height:100%;border-radius:2px;transition:width 0.3s"></div>
                </div>
                <span style="font-size:9px;color:#888;width:30px;text-align:right">${avAcum.toFixed(0)}%</span>
              </div>
            </td>
          </tr>`;
      });
    }

    showModal(`VALUACIÓN N°${v.numero} — ${sanitize(v.presupuesto_nombre||'')}`, `
      <div style="margin-bottom:14px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        <div style="background:#f0f5fb;border-radius:4px;padding:10px 14px;border-left:3px solid var(--blue)">
          <div style="font-size:10px;color:#888">Contrato</div>
          <div style="font-size:14px;font-weight:700;color:var(--blue)">L ${fmt(v.monto_contrato)}</div>
        </div>
        <div style="background:#f0faf3;border-radius:4px;padding:10px 14px;border-left:3px solid var(--green)">
          <div style="font-size:10px;color:#888">Monto período</div>
          <div id="valTotalMonto" style="font-size:14px;font-weight:700;color:var(--green)">L ${fmt(v.monto_bruto||totalPeriodo)}</div>
        </div>
        <div style="background:#fef0f0;border-radius:4px;padding:10px 14px;border-left:3px solid var(--red)">
          <div style="font-size:10px;color:#888">Monto neto (después ret.)</div>
          <div id="valNetoDisplay" style="font-size:14px;font-weight:700;color:var(--red)">L ${fmt(v.monto_neto)}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div class="form-group" style="margin:0">
          <label class="form-label">Estado</label>
          <select id="valEstado" style="width:100%">${estadoOpts}</select>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">% Retención</label>
          <input type="number" id="valRetPct" value="${v.pct_retencion||0}" min="0" max="100" step="0.5">
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">Aprobado por</label>
          <input type="text" id="valAprobado" value="${sanitize(v.aprobado_por||'')}">
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">Notas</label>
          <input type="text" id="valNotasEdit" value="${sanitize(v.notas||'')}">
        </div>
      </div>

      <div style="max-height:340px;overflow-y:auto;border:1px solid var(--gray-light);border-radius:4px">
        <table style="font-size:11px;width:100%;border-collapse:collapse">
          <thead style="position:sticky;top:0;z-index:1">
            <tr style="background:var(--blue);color:#fff">
              <th style="padding:6px 8px;text-align:left">Cód.</th>
              <th style="padding:6px 8px;text-align:left">Actividad</th>
              <th style="padding:6px 8px;text-align:center">Unid</th>
              <th style="padding:6px 8px;text-align:right">Cant.</th>
              <th style="padding:6px 8px;text-align:right">P.Unit.</th>
              <th style="padding:6px 8px;text-align:right">Av.Ant.%</th>
              <th style="padding:6px 8px;text-align:center">Av.Per.%</th>
              <th style="padding:6px 8px;text-align:right">Av.Acum.%</th>
              <th style="padding:6px 8px;text-align:right">Monto Per.</th>
            </tr>
          </thead>
          <tbody>${filasPorModulo}</tbody>
        </table>
      </div>

      <div style="margin-top:10px;font-size:11px;color:#888;background:#fffbe6;padding:8px 12px;border-radius:4px;border:1px solid #FDB338">
        💡 Ingresa el <strong>% de avance del período</strong> para cada actividad. El sistema calcula el monto automáticamente.
      </div>

      <div class="form-actions">
        <button class="btn btn-secondary" onclick="hideModal()">Cerrar</button>
        <button class="btn btn-secondary" onclick="window.open('/api/valuaciones/${id}/html','_blank')">🖨 Imprimir</button>
        <button class="btn btn-primary" onclick="guardarValuacion(${id})">💾 Guardar Valuación</button>
      </div>`, 'modal-xl');

    // Guardar items para usarlos en guardarValuacion
    window._valItems = items;
    window._valRetencion = v.pct_retencion || 0;

  } catch(e) { toast(e.error || 'Error al cargar', 'error'); }
}

function valRecalcRow(idPartida, avAnt, precio, cantPresup, input) {
  const avPer = Math.max(0, Math.min(parseFloat(input.value)||0, 100-avAnt));
  const cantPer = cantPresup * avPer / 100;
  const monto = cantPer * precio;
  const montoEl = document.getElementById(`valMonto-${idPartida}`);
  if (montoEl) montoEl.textContent = `L ${fmt(monto)}`;

  // Recalcular total
  let total = 0;
  document.querySelectorAll('.val-av-input').forEach(inp => {
    const pid = parseInt(inp.dataset.partida);
    const item = (window._valItems||[]).find(i=>i.id_partida===pid);
    if (!item) return;
    const avP = parseFloat(inp.value)||0;
    const cP = (item.cant_presup||0) * avP / 100;
    total += cP * (item.precio_unitario||0);
  });
  const retPct = parseFloat(document.getElementById('valRetPct')?.value)||0;
  const neto = total - total*retPct/100;
  const totalEl = document.getElementById('valTotalMonto');
  const netoEl  = document.getElementById('valNetoDisplay');
  if (totalEl) totalEl.textContent = `L ${fmt(total)}`;
  if (netoEl)  netoEl.textContent  = `L ${fmt(neto)}`;
}

async function guardarValuacion(id) {
  try {
    // 1. Guardar avances
    const avances = [];
    document.querySelectorAll('.val-av-input').forEach(inp => {
      avances.push({ id_partida: parseInt(inp.dataset.partida), avance_periodo: parseFloat(inp.value)||0 });
    });
    await api.put(`/api/valuaciones/${id}/items`, { items: avances });

    // 2. Guardar datos generales
    await api.put(`/api/valuaciones/${id}`, {
      estado:         document.getElementById('valEstado').value,
      pct_retencion:  parseFloat(document.getElementById('valRetPct').value)||0,
      aprobado_por:   document.getElementById('valAprobado').value||null,
      notas:          document.getElementById('valNotasEdit').value||null,
    });

    hideModal();
    toast('Valuación guardada correctamente');
    await loadValuaciones();
  } catch(e) { toast(e.error || 'Error al guardar', 'error'); }
}

async function eliminarValuacion(id) {
  if (!confirm('¿Eliminar esta valuación?')) return;
  try {
    await api.del(`/api/valuaciones/${id}`);
    toast('Valuación eliminada');
    await loadValuaciones();
  } catch(e) { toast(e.error || 'Error', 'error'); }
}
