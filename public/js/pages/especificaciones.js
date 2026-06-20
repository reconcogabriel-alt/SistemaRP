// ══════════════════════════════════════════════════════════
//  MÓDULO: ESPECIFICACIONES TÉCNICAS
// ══════════════════════════════════════════════════════════

let _eettCodigoActual = null;
let _busqEettTimer    = null;
let _busqActTimer     = null;

// Estilos de inputs — igual que el resto de la app
const EETT_INPUT  = 'width:100%;padding:10px 12px;border:1.5px solid #d4dbe3;border-radius:4px;font-size:13px;background:#fff;color:#1a2332;font-family:Barlow,sans-serif;box-sizing:border-box;';
const EETT_RO     = 'width:100%;padding:10px 12px;border:1.5px solid #d4dbe3;border-radius:4px;font-size:13px;background:#f0f3f6;color:#025196;font-family:monospace;font-weight:700;box-sizing:border-box;';
const EETT_TA     = 'width:100%;padding:10px 12px;border:1.5px solid #d4dbe3;border-radius:4px;font-size:13px;background:#fff;color:#1a2332;resize:vertical;min-height:80px;font-family:Barlow,sans-serif;box-sizing:border-box;';

// ─────────────────────────────────────────────────────────
//  RENDER PRINCIPAL
// ─────────────────────────────────────────────────────────
async function renderEspecificaciones(ctx = {}) {
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">ESPECIFICACIONES TÉCNICAS</div>
        <div class="page-subtitle" id="eettSubtitle">Cargando catálogo…</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn btn-primary" onclick="modalNuevaEett()">＋ Nueva ficha</button>
        <button class="btn btn-orange" id="btnImprimirFicha" style="display:none" onclick="imprimirFichaActual()">
          🖨️ Imprimir ficha
        </button>
      </div>
    </div>

    <div class="page-body">
      <div class="card" style="margin-bottom:16px">
        <div class="card-body" style="padding:12px 16px">
          <div style="display:flex;gap:10px;align-items:center">
            <input type="text" id="busqEett"
              placeholder="Buscar por código, nombre o descripción…"
              style="flex:1" oninput="triggerBusqEett()" />
            <button class="btn btn-secondary" onclick="limpiarBusqEett()">✕ Limpiar</button>
          </div>
          <div id="eettContador" style="margin-top:8px;font-size:12px;color:var(--text-muted)"></div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:300px 1fr;gap:16px;min-height:520px">
        <div class="card" style="overflow:hidden;display:flex;flex-direction:column">
          <div class="card-header" style="padding:8px 14px;flex-shrink:0">
            <span class="card-title" style="font-size:11px">LISTADO DE FICHAS</span>
          </div>
          <div id="eettLista" style="overflow-y:auto;flex:1;max-height:580px">
            <div class="loading"><div class="spinner"></div></div>
          </div>
        </div>

        <div class="card" id="eettDetalle">
          <div class="card-body" style="display:flex;flex-direction:column;align-items:center;
               justify-content:center;min-height:300px;color:var(--text-muted)">
            <div style="font-size:48px;margin-bottom:12px">📄</div>
            <div style="font-weight:600">Seleccione una ficha de la lista</div>
            <div style="font-size:12px;margin-top:6px">Haga clic en cualquier ítem para ver el detalle</div>
          </div>
        </div>
      </div>
    </div>`;

  await cargarListaEett();
}

// ─────────────────────────────────────────────────────────
//  LISTA PRINCIPAL
// ─────────────────────────────────────────────────────────
function triggerBusqEett() {
  clearTimeout(_busqEettTimer);
  _busqEettTimer = setTimeout(cargarListaEett, 350);
}
function limpiarBusqEett() {
  const inp = document.getElementById('busqEett');
  if (inp) inp.value = '';
  cargarListaEett();
}
async function cargarListaEett() {
  const q     = (document.getElementById('busqEett')?.value || '').trim();
  const lista = document.getElementById('eettLista');
  if (!lista) return;
  lista.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const params = new URLSearchParams({ limit: 100, offset: 0 });
    if (q) params.set('q', q);
    const data = await api.get('/api/especificaciones?' + params);
    const cnt = document.getElementById('eettContador');
    if (cnt) cnt.textContent = `Mostrando ${data.rows.length} de ${data.total.toLocaleString()} fichas`;
    const sub = document.getElementById('eettSubtitle');
    if (sub) sub.textContent = `${data.total.toLocaleString()} fichas técnicas en el catálogo`;
    if (!data.rows.length) {
      lista.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px">Sin resultados</div>';
      return;
    }
    lista.innerHTML = data.rows.map(f => `
      <div class="eett-item" id="eett-item-${f.codigo}"
           onclick="verFichaEett('${f.codigo}')"
           style="padding:10px 14px;border-bottom:1px solid #d4dbe3;cursor:pointer;transition:background .12s"
           onmouseenter="this.style.background='#e8f4fd'"
           onmouseleave="eettItemLeave(this,'${f.codigo}')">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
          <span style="font-size:11px;font-weight:700;color:#025196;font-family:monospace">${sanitize(f.codigo)}</span>
          <span style="font-size:10px;background:#d4dbe3;padding:1px 6px;border-radius:3px;color:#5a6878;white-space:nowrap">${sanitize(f.unidad)}</span>
        </div>
        <div style="font-size:12px;margin-top:3px;line-height:1.3;color:#1a2332">${sanitize(f.nombre)}</div>
      </div>`).join('');
  } catch(e) {
    lista.innerHTML = `<div style="padding:16px;color:red;font-size:12px">Error: ${e.error || e}</div>`;
  }
}
function eettItemLeave(el, codigo) {
  if (_eettCodigoActual !== codigo) el.style.background = '';
}

// ─────────────────────────────────────────────────────────
//  DETALLE DE FICHA
// ─────────────────────────────────────────────────────────
async function verFichaEett(codigo) {
  document.querySelectorAll('.eett-item').forEach(i => i.style.background = '');
  const sel = document.getElementById(`eett-item-${codigo}`);
  if (sel) sel.style.background = '#e8f4fd';
  _eettCodigoActual = codigo;
  const detalle = document.getElementById('eettDetalle');
  detalle.innerHTML = '<div class="card-body loading"><div class="spinner"></div></div>';
  try {
    const f = await api.get(`/api/especificaciones/${encodeURIComponent(codigo)}`);
    const btnImpr = document.getElementById('btnImprimirFicha');
    if (btnImpr) btnImpr.style.display = 'inline-flex';
    detalle.dataset.fichaActual = JSON.stringify(f);
    detalle.innerHTML = `
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
        <span class="card-title">${sanitize(f.codigo)} — ${sanitize(f.nombre)}</span>
        <div style="display:flex;gap:8px;align-items:center">
          <span style="font-size:11px;background:#FDB338;color:#013a6e;padding:3px 10px;border-radius:3px;font-weight:700">${sanitize(f.unidad)}</span>
          <button class="btn btn-secondary btn-sm" onclick="modalEditarEett('${sanitize(f.codigo)}')">✏️ Editar</button>
        </div>
      </div>
      <div class="card-body">
        <div style="margin-bottom:20px">
          <div style="font-size:11px;font-weight:700;color:#025196;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #025196;padding-bottom:4px;margin-bottom:10px">Descripción de la actividad</div>
          <p style="font-size:13px;line-height:1.7;color:#1a2332;text-align:justify">${sanitize(f.descripcion) || '—'}</p>
        </div>
        <div style="margin-bottom:20px">
          <div style="font-size:11px;font-weight:700;color:#025196;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #025196;padding-bottom:4px;margin-bottom:10px">Consideraciones del cálculo del análisis de costo</div>
          <p style="font-size:13px;line-height:1.7;color:#1a2332;text-align:justify">${sanitize(f.consideraciones) || '—'}</p>
        </div>
        <div style="margin-bottom:16px">
          <div style="font-size:11px;font-weight:700;color:#025196;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #025196;padding-bottom:4px;margin-bottom:10px">Criterios de medición y pago</div>
          <p style="font-size:13px;line-height:1.7;color:#1a2332;text-align:justify">${sanitize(f.criterios_pago) || '—'}</p>
        </div>
        <div style="margin-top:12px;padding-top:10px;border-top:1px solid #d4dbe3;font-size:11px;color:#5a6878;display:flex;justify-content:space-between">
          <span>Especificaciones Técnicas de Actividades</span><span>Código: ${sanitize(f.codigo)}</span>
        </div>
      </div>`;
  } catch(e) {
    detalle.innerHTML = `<div class="card-body" style="color:red">Error cargando ficha: ${e.error || e}</div>`;
  }
}

// ─────────────────────────────────────────────────────────
//  MODAL — NUEVA ESPECIFICACIÓN
// ─────────────────────────────────────────────────────────
function modalNuevaEett() {
  showModal('NUEVA ESPECIFICACIÓN TÉCNICA', `
    <div style="margin-bottom:16px;padding:10px 14px;background:#eef4fb;border-left:4px solid #025196;border-radius:3px;font-size:12px;color:#1a2332;line-height:1.5">
      ℹ️ Solo puede crear una especificación técnica para actividades que ya existan en el sistema y que aún no tengan ficha técnica asignada.
    </div>

    <div class="form-group" style="margin-bottom:4px">
      <label class="form-label">Buscar actividad *</label>
      <input type="text" id="busqActNuevaEett"
        placeholder="Escriba el código o nombre de la actividad…"
        style="${EETT_INPUT}" />
    </div>
    <div id="resultadosActNuevaEett"
      style="border:1.5px solid #d4dbe3;border-top:none;border-radius:0 0 4px 4px;
             max-height:170px;overflow-y:auto;background:#fff;font-size:12px;
             display:none;margin-bottom:12px;box-shadow:0 4px 8px rgba(0,0,0,.08)"></div>
    <div id="actEettSeleccionada"
      style="display:none;margin-bottom:14px;padding:8px 12px;background:#e8f4fd;
             border:1px solid #025196;border-radius:4px;font-size:12px">
      ✅ Actividad seleccionada:
      <span style="font-weight:700;color:#025196;margin-left:6px" id="actEettSelCod"></span>
      <span style="margin-left:6px;color:#1a2332" id="actEettSelDesc"></span>
      <span style="margin-left:8px;background:#FDB338;color:#013a6e;padding:1px 8px;border-radius:3px;font-size:11px;font-weight:700" id="actEettSelUnid"></span>
    </div>

    <div class="form-grid form-grid-2" style="margin-bottom:12px">
      <div class="form-group">
        <label class="form-label">Código</label>
        <input type="text" id="eettFormCodigo" readonly
          placeholder="— seleccione una actividad —"
          style="${EETT_RO}" />
      </div>
      <div class="form-group">
        <label class="form-label">Unidad</label>
        <input type="text" id="eettFormUnidad" readonly
          placeholder="— se llena automático —"
          style="${EETT_RO}" />
      </div>
    </div>

    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label">Nombre de la actividad *</label>
      <input type="text" id="eettFormNombre"
        placeholder="Nombre completo de la actividad"
        style="${EETT_INPUT}" />
    </div>

    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label">Descripción de la actividad</label>
      <textarea id="eettFormDesc"
        placeholder="Descripción detallada de la actividad a realizar…"
        style="${EETT_TA}"></textarea>
    </div>

    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label">Consideraciones del análisis de costo</label>
      <textarea id="eettFormConsid"
        placeholder="Notas sobre el cálculo del costo unitario…"
        style="${EETT_TA}"></textarea>
    </div>

    <div class="form-group" style="margin-bottom:20px">
      <label class="form-label">Criterios de medición y pago</label>
      <textarea id="eettFormCrit"
        placeholder="Forma de medir y pagar la actividad…"
        style="${EETT_TA}"></textarea>
    </div>

    <div class="form-actions">
      <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
      <button class="btn btn-orange" onclick="guardarNuevaEett()">💾 Guardar ficha</button>
    </div>
  `, 'modal-lg');

  // Adjuntar listener DESPUÉS de que showModal inyecta el DOM
  setTimeout(() => {
    const inp = document.getElementById('busqActNuevaEett');
    if (inp) {
      inp.addEventListener('input', () => {
        clearTimeout(_busqActTimer);
        _busqActTimer = setTimeout(ejecutarBusqActEett, 300);
      });
      inp.focus();
    }
  }, 0);
}

// ─────────────────────────────────────────────────────────
//  BÚSQUEDA DE ACTIVIDAD DENTRO DEL MODAL
// ─────────────────────────────────────────────────────────
async function ejecutarBusqActEett() {
  const inp = document.getElementById('busqActNuevaEett');
  const box = document.getElementById('resultadosActNuevaEett');
  if (!inp || !box) return;

  const q = inp.value.trim();
  if (!q) { box.style.display = 'none'; return; }

  box.style.display = 'block';
  box.innerHTML = '<div style="padding:10px 14px;color:#5a6878;font-size:12px">Buscando…</div>';

  try {
    const data = await api.get('/api/actividades/sin-eett?q=' + encodeURIComponent(q));
    if (!data.rows || !data.rows.length) {
      box.innerHTML = `<div style="padding:12px 14px;color:#5a6878;font-size:12px">
        Sin resultados. Verifique que la actividad exista y no tenga ya una ficha técnica.
      </div>`;
      return;
    }
    box.innerHTML = data.rows.map(a => {
      const cod  = sanitize(a.codigo);
      const desc = sanitize(a.descripcion);
      const unid = sanitize(a.unidad);
      // Escapado seguro para el onclick
      const codE  = a.codigo.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      const descE = (a.descripcion||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      const unidE = (a.unidad||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      return `<div onclick="seleccionarActividadEett('${codE}','${descE}','${unidE}')"
        style="padding:9px 14px;border-bottom:1px solid #d4dbe3;cursor:pointer;transition:background .1s"
        onmouseenter="this.style.background='#e8f4fd'" onmouseleave="this.style.background=''">
        <span style="font-size:11px;font-weight:700;color:#025196;font-family:monospace">${cod}</span>
        <span style="font-size:12px;margin-left:10px;color:#1a2332">${desc}</span>
        <span style="float:right;font-size:10px;background:#d4dbe3;padding:1px 6px;border-radius:3px;color:#5a6878">${unid}</span>
      </div>`;
    }).join('');
  } catch(e) {
    box.innerHTML = `<div style="padding:12px 14px;color:red;font-size:12px">Error: ${e.error || e.message || e}</div>`;
  }
}

function seleccionarActividadEett(codigo, descripcion, unidad) {
  // Rellenar campos de solo lectura
  const fCodigo = document.getElementById('eettFormCodigo');
  const fUnidad = document.getElementById('eettFormUnidad');
  const fNombre = document.getElementById('eettFormNombre');
  if (fCodigo) fCodigo.value = codigo;
  if (fUnidad) fUnidad.value = unidad;      // unidad de la actividad, no editable
  if (fNombre) fNombre.value = descripcion; // pre-rellenar nombre (editable)

  // Badge de confirmación
  const badge = document.getElementById('actEettSeleccionada');
  if (badge) badge.style.display = 'block';
  const sCod = document.getElementById('actEettSelCod');
  const sDesc = document.getElementById('actEettSelDesc');
  const sUnid = document.getElementById('actEettSelUnid');
  if (sCod)  sCod.textContent  = codigo;
  if (sDesc) sDesc.textContent = descripcion;
  if (sUnid) sUnid.textContent = unidad;

  // Ocultar dropdown y limpiar input de búsqueda
  const box = document.getElementById('resultadosActNuevaEett');
  if (box) box.style.display = 'none';
  const inp = document.getElementById('busqActNuevaEett');
  if (inp) inp.value = '';

  // Foco en nombre para que el usuario pueda editarlo
  if (fNombre) setTimeout(() => fNombre.focus(), 50);
}

// ─────────────────────────────────────────────────────────
//  GUARDAR NUEVA FICHA
// ─────────────────────────────────────────────────────────
async function guardarNuevaEett() {
  const codigo = (document.getElementById('eettFormCodigo')?.value || '').trim();
  const nombre = (document.getElementById('eettFormNombre')?.value || '').trim();
  const unidad = (document.getElementById('eettFormUnidad')?.value || '').trim();

  if (!codigo) { toast('Seleccione una actividad de la lista primero', 'error'); return; }
  if (!nombre) { toast('El nombre de la actividad es obligatorio', 'error'); return; }
  if (!unidad) { toast('La unidad no se pudo obtener de la actividad', 'error'); return; }

  try {
    await api.post('/api/especificaciones', {
      codigo, nombre, unidad,
      descripcion:     (document.getElementById('eettFormDesc')?.value   || '').trim(),
      consideraciones: (document.getElementById('eettFormConsid')?.value || '').trim(),
      criterios_pago:  (document.getElementById('eettFormCrit')?.value   || '').trim()
    });
    hideModal();
    toast('Especificación técnica creada correctamente');
    await cargarListaEett();
    verFichaEett(codigo);
  } catch(e) {
    toast(e.error || 'Error al guardar', 'error');
  }
}

// ─────────────────────────────────────────────────────────
//  MODAL — EDITAR
// ─────────────────────────────────────────────────────────
async function modalEditarEett(codigo) {
  try {
    const f = await api.get(`/api/especificaciones/${encodeURIComponent(codigo)}`);
    showModal('EDITAR ESPECIFICACIÓN — ' + sanitize(f.codigo), `
      <div class="form-grid form-grid-2" style="margin-bottom:12px">
        <div class="form-group">
          <label class="form-label">Código</label>
          <input type="text" value="${sanitize(f.codigo)}" readonly style="${EETT_RO}" />
        </div>
        <div class="form-group">
          <label class="form-label">Unidad</label>
          <input type="text" value="${sanitize(f.unidad)}" readonly style="${EETT_RO}" />
        </div>
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">Nombre de la actividad *</label>
        <input type="text" id="eettEditNombre" value="${sanitize(f.nombre)}" style="${EETT_INPUT}" />
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">Descripción de la actividad</label>
        <textarea id="eettEditDesc" style="${EETT_TA}">${sanitize(f.descripcion) || ''}</textarea>
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">Consideraciones del análisis de costo</label>
        <textarea id="eettEditConsid" style="${EETT_TA}">${sanitize(f.consideraciones) || ''}</textarea>
      </div>
      <div class="form-group" style="margin-bottom:20px">
        <label class="form-label">Criterios de medición y pago</label>
        <textarea id="eettEditCrit" style="${EETT_TA}">${sanitize(f.criterios_pago) || ''}</textarea>
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="hideModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="guardarEdicionEett('${sanitize(f.codigo)}')">💾 Actualizar ficha</button>
      </div>
    `, 'modal-lg');
  } catch(e) {
    toast(e.error || 'Error cargando ficha', 'error');
  }
}

async function guardarEdicionEett(codigo) {
  const nombre = (document.getElementById('eettEditNombre')?.value || '').trim();
  if (!nombre) { toast('El nombre es obligatorio', 'error'); return; }
  // Recuperar la unidad del detalle actual (no editable en edición)
  const fichaRaw = document.getElementById('eettDetalle')?.dataset?.fichaActual;
  const unidad   = fichaRaw ? JSON.parse(fichaRaw).unidad : '';
  try {
    await api.put(`/api/especificaciones/${encodeURIComponent(codigo)}`, {
      nombre,
      unidad,
      descripcion:     (document.getElementById('eettEditDesc')?.value    || '').trim(),
      consideraciones: (document.getElementById('eettEditConsid')?.value  || '').trim(),
      criterios_pago:  (document.getElementById('eettEditCrit')?.value    || '').trim()
    });
    hideModal();
    toast('Especificación actualizada');
    await cargarListaEett();
    verFichaEett(codigo);
  } catch(e) {
    toast(e.error || 'Error al actualizar', 'error');
  }
}

// ─────────────────────────────────────────────────────────
//  IMPRIMIR
// ─────────────────────────────────────────────────────────
function imprimirFichaActual() {
  const detalle = document.getElementById('eettDetalle');
  const raw = detalle?.dataset?.fichaActual;
  if (!raw) return;
  imprimirFichaTecnica(JSON.parse(raw));
}

function imprimirFichaTecnica(f) {
  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`<!DOCTYPE html><html lang="es"><head>
  <meta charset="UTF-8"><title>Ficha ${f.codigo}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;font-size:12px;color:#222;padding:20px}
    .header{text-align:center;border-bottom:3px solid #025196;padding-bottom:10px;margin-bottom:14px}
    .header h1{font-size:14px;color:#025196;font-weight:700}
    .header h2{font-size:11px;color:#555;margin-top:2px;font-weight:400}
    .meta{display:grid;grid-template-columns:1fr auto;gap:10px;background:#f0f5fb;
          border:1px solid #025196;padding:10px 14px;border-radius:4px;margin-bottom:14px}
    .meta-codigo{font-size:15px;font-weight:700;color:#025196;font-family:monospace}
    .meta-nombre{font-size:13px;font-weight:700;margin-top:2px}
    .meta-unidad{background:#FDB338;color:#013a6e;font-weight:700;padding:4px 12px;border-radius:4px;font-size:13px;align-self:center}
    .seccion{margin-bottom:14px}
    .seccion-titulo{font-size:10px;font-weight:700;color:#025196;text-transform:uppercase;
                    letter-spacing:.5px;border-bottom:2px solid #025196;padding-bottom:3px;margin-bottom:8px}
    .seccion p{font-size:11.5px;line-height:1.65;text-align:justify}
    .footer{margin-top:20px;border-top:1px solid #ccc;padding-top:8px;
            display:flex;justify-content:space-between;font-size:10px;color:#888}
    @media print{body{padding:10mm}@page{margin:15mm;size:letter}}
  </style></head><body>
  <div class="header">
    <h1>ESPECIFICACIÓN TÉCNICA DE ACTIVIDAD</h1>
    <h2>Catálogo de Especificaciones Técnicas</h2>
  </div>
  <div class="meta">
    <div><div class="meta-codigo">${f.codigo}</div><div class="meta-nombre">${f.nombre}</div></div>
    <div class="meta-unidad">${f.unidad}</div>
  </div>
  <div class="seccion"><div class="seccion-titulo">Descripción de la actividad a realizar</div><p>${f.descripcion||'—'}</p></div>
  <div class="seccion"><div class="seccion-titulo">Consideraciones del cálculo del análisis de costo</div><p>${f.consideraciones||'—'}</p></div>
  <div class="seccion"><div class="seccion-titulo">Criterios de medición y pago</div><p>${f.criterios_pago||'—'}</p></div>
  <div class="footer"><span>Especificaciones Técnicas de Actividades</span><span>Código: ${f.codigo} | Unidad: ${f.unidad}</span></div>
  <script>window.onload=function(){window.print();}<\/script>
  </body></html>`);
  win.document.close();
}
