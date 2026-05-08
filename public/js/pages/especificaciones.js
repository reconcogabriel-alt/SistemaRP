// ── MÓDULO: ESPECIFICACIONES TÉCNICAS ─────────────────────
async function renderEspecificaciones(ctx = {}) {
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">ESPECIFICACIONES TÉCNICAS</div>
        <div class="page-subtitle">Catálogo oficial — 1,912 fichas técnicas</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn btn-orange" onclick="imprimirFichaActual()" id="btnImprimirFicha" style="display:none">
          🖨️ Imprimir ficha
        </button>
      </div>
    </div>
    <div class="page-body">
      <div class="card" style="margin-bottom:16px">
        <div class="card-body" style="padding:14px 16px">
          <div style="display:flex;gap:10px;align-items:center">
            <input type="text" id="busqEett" placeholder="Buscar por código, nombre o descripción..."
              style="flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:4px;font-size:13px"
              oninput="buscarEett()" />
            <button class="btn btn-secondary" onclick="document.getElementById('busqEett').value='';buscarEett()">
              ✕ Limpiar
            </button>
          </div>
          <div id="eettContador" style="margin-top:8px;font-size:12px;color:var(--text-muted)">
            Mostrando las primeras 50 fichas. Use el buscador para filtrar.
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:320px 1fr;gap:16px;min-height:500px">
        <!-- Lista -->
        <div class="card" style="overflow:hidden">
          <div class="card-header" style="padding:10px 14px">
            <span class="card-title" style="font-size:12px">LISTADO DE FICHAS</span>
          </div>
          <div id="eettLista" style="overflow-y:auto;max-height:620px">
            <div class="loading"><div class="spinner"></div></div>
          </div>
        </div>

        <!-- Detalle -->
        <div class="card" id="eettDetalle">
          <div class="card-body" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:300px;color:var(--text-muted)">
            <div style="font-size:48px;margin-bottom:12px">📄</div>
            <div style="font-weight:600">Seleccione una ficha de la lista</div>
            <div style="font-size:12px;margin-top:6px">Haga clic en cualquier ítem para ver el detalle completo</div>
          </div>
        </div>
      </div>
    </div>`;

  await cargarEett();
}

let _eettTimeout = null;
function buscarEett() {
  clearTimeout(_eettTimeout);
  _eettTimeout = setTimeout(cargarEett, 350);
}

async function cargarEett() {
  const q = document.getElementById('busqEett')?.value?.trim() || '';
  const lista = document.getElementById('eettLista');
  if (!lista) return;
  lista.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const params = new URLSearchParams({ limit: 100, offset: 0 });
    if (q) params.set('q', q);
    const data = await api.get('/api/especificaciones?' + params);
    const cnt = document.getElementById('eettContador');
    if (cnt) cnt.textContent = `Mostrando ${data.rows.length} de ${data.total.toLocaleString()} fichas`;

    if (!data.rows.length) {
      lista.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px">Sin resultados para la búsqueda</div>';
      return;
    }

    lista.innerHTML = data.rows.map(f => `
      <div class="eett-item" onclick="verFicha('${f.codigo}')" id="item-${f.codigo}"
        style="padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <span style="font-size:11px;font-weight:700;color:var(--blue);font-family:monospace">${f.codigo}</span>
          <span style="font-size:10px;background:var(--gray-light);padding:1px 6px;border-radius:3px;color:var(--text-muted)">${f.unidad}</span>
        </div>
        <div style="font-size:12px;margin-top:3px;line-height:1.3;color:var(--text)">${f.nombre}</div>
      </div>`).join('');

    // Hover effect
    lista.querySelectorAll('.eett-item').forEach(item => {
      item.addEventListener('mouseenter', () => item.style.background = 'var(--gray-light)');
      item.addEventListener('mouseleave', () => { if (!item.classList.contains('selected')) item.style.background = ''; });
    });
  } catch(e) {
    lista.innerHTML = `<div style="padding:16px;color:red;font-size:12px">Error: ${e.error || e}</div>`;
  }
}

async function verFicha(codigo) {
  // Highlight seleccionado
  document.querySelectorAll('.eett-item').forEach(i => {
    i.classList.remove('selected');
    i.style.background = '';
  });
  const sel = document.getElementById(`item-${codigo}`);
  if (sel) { sel.classList.add('selected'); sel.style.background = '#e8f4fd'; }

  const detalle = document.getElementById('eettDetalle');
  detalle.innerHTML = '<div class="card-body loading"><div class="spinner"></div></div>';

  try {
    const f = await api.get(`/api/especificaciones/${codigo}`);
    document.getElementById('btnImprimirFicha')?.style.setProperty('display', 'inline-flex');

    detalle.innerHTML = `
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
        <span class="card-title">${f.codigo} — ${f.nombre}</span>
        <span style="font-size:11px;background:var(--orange);color:#fff;padding:3px 10px;border-radius:3px;font-weight:700">${f.unidad}</span>
      </div>
      <div class="card-body" id="fichaContenido">

        <div style="margin-bottom:20px">
          <div style="font-size:11px;font-weight:700;color:var(--blue);text-transform:uppercase;
                      letter-spacing:.5px;border-bottom:2px solid var(--blue);padding-bottom:4px;margin-bottom:10px">
            Descripción de la actividad
          </div>
          <p style="font-size:13px;line-height:1.7;color:var(--text);text-align:justify">${f.descripcion || '—'}</p>
        </div>

        <div style="margin-bottom:20px">
          <div style="font-size:11px;font-weight:700;color:var(--blue);text-transform:uppercase;
                      letter-spacing:.5px;border-bottom:2px solid var(--blue);padding-bottom:4px;margin-bottom:10px">
            Consideraciones del cálculo del análisis de costo
          </div>
          <p style="font-size:13px;line-height:1.7;color:var(--text);text-align:justify">${f.consideraciones || '—'}</p>
        </div>

        <div>
          <div style="font-size:11px;font-weight:700;color:var(--blue);text-transform:uppercase;
                      letter-spacing:.5px;border-bottom:2px solid var(--blue);padding-bottom:4px;margin-bottom:10px">
            Criterios de medición y pago
          </div>
          <p style="font-size:13px;line-height:1.7;color:var(--text);text-align:justify">${f.criterios_pago || '—'}</p>
        </div>

        <div style="margin-top:20px;padding-top:12px;border-top:1px solid var(--border);
                    font-size:11px;color:var(--text-muted);display:flex;justify-content:space-between">
          <span>Especificaciones Técnicas de Actividades — agosto 2007</span>
          <span>Código: ${f.codigo}</span>
        </div>
      </div>`;

    // Guardar datos para impresión
    detalle.dataset.fichaActual = JSON.stringify(f);
  } catch(e) {
    detalle.innerHTML = `<div class="card-body" style="color:red">Error cargando ficha: ${e.error || e}</div>`;
  }
}

function imprimirFichaActual() {
  const detalle = document.getElementById('eettDetalle');
  const raw = detalle?.dataset?.fichaActual;
  if (!raw) return;
  const f = JSON.parse(raw);
  imprimirFichaTecnica(f);
}

function imprimirFichaTecnica(f) {
  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`<!DOCTYPE html><html lang="es"><head>
  <meta charset="UTF-8">
  <title>Ficha ${f.codigo}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #222; padding: 20px; }
    .header { text-align:center; border-bottom: 3px solid #025196; padding-bottom: 10px; margin-bottom: 14px; }
    .header h1 { font-size: 14px; color: #025196; font-weight: 700; }
    .header h2 { font-size: 11px; color: #555; margin-top: 2px; font-weight: 400; }
    .meta { display: grid; grid-template-columns: 1fr auto; gap: 10px; background: #f0f5fb;
            border: 1px solid #025196; padding: 10px 14px; border-radius: 4px; margin-bottom: 14px; }
    .meta-codigo { font-size: 15px; font-weight: 700; color: #025196; font-family: monospace; }
    .meta-nombre { font-size: 13px; font-weight: 700; margin-top: 2px; }
    .meta-unidad { background: #FDB338; color: #fff; font-weight: 700; padding: 4px 12px;
                   border-radius: 4px; font-size: 13px; align-self: center; }
    .seccion { margin-bottom: 14px; }
    .seccion-titulo { font-size: 10px; font-weight: 700; color: #025196; text-transform: uppercase;
                      letter-spacing: 0.5px; border-bottom: 2px solid #025196; padding-bottom: 3px;
                      margin-bottom: 8px; }
    .seccion p { font-size: 11.5px; line-height: 1.65; text-align: justify; }
    .footer { margin-top: 20px; border-top: 1px solid #ccc; padding-top: 8px;
              display: flex; justify-content: space-between; font-size: 10px; color: #888; }
    @media print {
      body { padding: 10mm; }
      @page { margin: 15mm; size: letter; }
    }
  </style>
  </head><body>
  <div class="header">
    <h1>ESPECIFICACIÓN TÉCNICA DE ACTIVIDAD</h1>
    <h2>Fondo Hondureño de Inversión Social — Catálogo de Especificaciones agosto 2007</h2>
  </div>
  <div class="meta">
    <div>
      <div class="meta-codigo">${f.codigo}</div>
      <div class="meta-nombre">${f.nombre}</div>
    </div>
    <div class="meta-unidad">${f.unidad}</div>
  </div>
  <div class="seccion">
    <div class="seccion-titulo">Descripción de la actividad a realizar</div>
    <p>${f.descripcion || '—'}</p>
  </div>
  <div class="seccion">
    <div class="seccion-titulo">Consideraciones del cálculo del análisis de costo</div>
    <p>${f.consideraciones || '—'}</p>
  </div>
  <div class="seccion">
    <div class="seccion-titulo">Criterios de medición y pago</div>
    <p>${f.criterios_pago || '—'}</p>
  </div>
  <div class="footer">
    <span>Especificaciones Técnicas de Actividades — agosto 2007</span>
    <span>Código: ${f.codigo} | Unidad: ${f.unidad}</span>
  </div>
  <script>window.onload = function(){ window.print(); }<\/script>
  </body></html>`);
  win.document.close();
}
