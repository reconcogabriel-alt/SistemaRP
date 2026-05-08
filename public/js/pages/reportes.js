async function renderReportes() {
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">REPORTES</div>
        <div class="page-subtitle">Generación de documentos — Excel con formato PAU</div>
      </div>
    </div>
    <div class="page-body">
      <div class="loading"><div class="spinner"></div> Cargando proyectos...</div>
    </div>`;

  try {
    const proyectos = await api.get('/api/proyectos');
    const presupuestos_all = await Promise.all(
      proyectos.map(p => api.get(`/api/presupuestos/proyecto/${p.id_proyecto}`)
        .then(prs => prs.map(pr => ({ ...pr, proyecto_nombre: p.nombre })))
        .catch(() => []))
    );
    const allPres = presupuestos_all.flat();

    el.querySelector('.page-body').innerHTML = `
      <div class="tabs">
        <div class="tab active" onclick="switchRptTab('fichas', this)">📊 Fichas de Costos</div>
        <div class="tab" onclick="switchRptTab('insumos', this)">🔧 Listado Insumos</div>
        <div class="tab" onclick="switchRptTab('presupuesto', this)">📋 Presupuesto</div>
        <div class="tab" onclick="switchRptTab('eett_gen', this)">📄 EETT Generales</div>
        <div class="tab" onclick="switchRptTab('eett_act', this)">📝 EETT por Actividad</div>
        <div class="tab" onclick="switchRptTab('cotizacion', this)">💰 Lista Cotización</div>
      </div>

      <!-- Tab: FICHAS DE COSTOS -->
      <div id="rpt-fichas" class="rpt-panel">
        <div class="card">
          <div class="card-header">
            <span class="card-title">FICHAS DE COSTOS UNITARIOS</span>
          </div>
          <div class="card-body">
            <p style="margin-bottom:16px; color:var(--text-muted); font-size:13px">
              Genera una ficha detallada para cada actividad usada en el proyecto, con composición de insumos, rendimientos, desperdicios y costos parciales. Incluye precios de referencia de mercado Honduras 2025-2026.
            </p>
            <div class="form-grid form-grid-2">
              <div class="form-group">
                <label class="form-label">Seleccionar Proyecto *</label>
                <select id="rpt1-proy" style="width:100%">
                  <option value="">-- Seleccionar proyecto --</option>
                  ${proyectos.map(p => `<option value="${p.id_proyecto}">${p.nombre} (${p.ubicacion||'—'})</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-actions">
              <button class="btn btn-orange" onclick="descargarReporte('/api/reportes/proyecto/' + document.getElementById('rpt1-proy').value + '/fichas', 'rpt1-proy', 'Fichas_Costos.xlsx')">
                📥 Descargar Excel
              </button>
              <button class="btn btn-secondary" onclick="imprimirFichasPDF(document.getElementById('rpt1-proy').value)">
                🖨️ Imprimir PDF
              </button>
            </div>
            <div style="margin-top:16px; padding:12px; background:var(--gray-light); border-radius:4px; font-size:12px; color:var(--text-muted)">
              <strong>Contenido:</strong> Una ficha por cada actividad del proyecto con código, descripción, unidad, composición detallada por categoría (Materiales / Mano de Obra / Equipo) y costo total. Precios actualizados con datos CHICO y Larach y Cía 2025-2026.
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: LISTADO INSUMOS -->
      <div id="rpt-insumos" class="rpt-panel hidden">
        <div class="card">
          <div class="card-header">
            <span class="card-title">LISTADO DE INSUMOS DEL PROYECTO</span>
          </div>
          <div class="card-body">
            <p style="margin-bottom:16px; color:var(--text-muted); font-size:13px">
              Consolida todos los insumos requeridos para el proyecto, agrupados por categoría, con cantidades totales y costos.
            </p>
            <div class="form-grid form-grid-2">
              <div class="form-group">
                <label class="form-label">Seleccionar Proyecto *</label>
                <select id="rpt2-proy" style="width:100%">
                  <option value="">-- Seleccionar proyecto --</option>
                  ${proyectos.map(p => `<option value="${p.id_proyecto}">${p.nombre} (${p.ubicacion||'—'})</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-actions">
              <button class="btn btn-orange" onclick="descargarReporte('/api/reportes/proyecto/' + document.getElementById('rpt2-proy').value + '/insumos', 'rpt2-proy', 'Insumos_Proyecto.xlsx')">
                📥 Descargar Excel
              </button>
              <button class="btn btn-secondary" onclick="imprimirInsumosPDF(document.getElementById('rpt2-proy').value)">
                🖨️ Imprimir PDF
              </button>
            </div>
            <div style="margin-top:16px; padding:12px; background:var(--gray-light); border-radius:4px; font-size:12px; color:var(--text-muted)">
              <strong>Contenido:</strong> Listado consolidado de todos los insumos necesarios para el proyecto, agrupados por categoría (Materiales, Mano de Obra, Equipo, Herramientas), con precio unitario de referencia, cantidad total y costo total. Útil para gestión de compras y licitaciones.
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: PRESUPUESTO -->
      <div id="rpt-presupuesto" class="rpt-panel hidden">
        <div class="card">
          <div class="card-header">
            <span class="card-title">PRESUPUESTO DE OBRA</span>
          </div>
          <div class="card-body">
            <p style="margin-bottom:16px; color:var(--text-muted); font-size:13px">
              Reporte detallado del presupuesto con capítulos, partidas, subtotales por capítulo y resumen de costos directos + indirectos.
            </p>
            <div class="form-grid form-grid-2">
              <div class="form-group">
                <label class="form-label">Seleccionar Presupuesto *</label>
                <select id="rpt3-pres" style="width:100%">
                  <option value="">-- Seleccionar presupuesto --</option>
                  ${allPres.map(pr => `<option value="${pr.id_presupuesto}">${pr.proyecto_nombre} — ${pr.nombre||'Presupuesto'} (L ${fmt(pr.total_general)})</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-actions">
              <button class="btn btn-orange" onclick="descargarReporte('/api/reportes/presupuesto/' + document.getElementById('rpt3-pres').value + '/excel', 'rpt3-pres', 'Presupuesto.xlsx')">
                📥 Descargar Excel
              </button>
              <button class="btn btn-secondary" onclick="imprimirPresupuestoPDF(document.getElementById('rpt3-pres').value)">
                🖨️ Imprimir PDF
              </button>
            </div>
            <div style="margin-top:16px; padding:12px; background:var(--gray-light); border-radius:4px; font-size:12px; color:var(--text-muted)">
              <strong>Contenido:</strong> Presupuesto completo con número de ítem, código de actividad, descripción, unidad, cantidad, precio unitario y subtotal por partida. Subtotales por capítulo. Resumen de costos directos, indirectos, utilidad, imprevistos y total general.
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: EETT GENERALES -->
      <div id="rpt-eett_gen" class="rpt-panel hidden">
        <div class="card">
          <div class="card-header">
            <span class="card-title">ESPECIFICACIONES TÉCNICAS GENERALES</span>
          </div>
          <div class="card-body">
            <p style="margin-bottom:16px; color:var(--text-muted); font-size:13px">
              Documento de especificaciones técnicas generales para proyectos de construcción en Honduras, conforme a normas SOPTRAVI/INSEP, SANAA, CICH, ACI y ASTM.
            </p>
            <div style="padding:16px; background:var(--gray-light); border-radius:4px; margin-bottom:16px">
              <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px"><strong>Secciones incluidas:</strong></div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:12px">
                <div>✓ Normativa Aplicable (Decreto 134-90, ACI, ASTM, AWWA)</div>
                <div>✓ Especificaciones de Materiales (cemento, acero, agregados, PVC)</div>
                <div>✓ Procedimientos de Ejecución</div>
                <div>✓ Control de Calidad y Ensayos</div>
                <div>✓ Seguridad e Higiene Ocupacional</div>
                <div>✓ Precios de referencia Honduras 2025-2026</div>
              </div>
            </div>
            <div class="form-actions">
              <button class="btn btn-orange" onclick="window.open('/api/reportes/especificaciones/generales', '_blank'); toast('Generando EETT Generales...', 'info')">
                📥 Descargar Excel
              </button>
              <button class="btn btn-secondary" onclick="imprimirEETTGeneralesPDF()">
                🖨️ Imprimir PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: COTIZACIÓN DE INSUMOS -->
      <div id="rpt-cotizacion" class="rpt-panel hidden">
        <div class="card">
          <div class="card-header">
            <span class="card-title">LISTA DE COTIZACIÓN DE INSUMOS</span>
          </div>
          <div class="card-body">
            <p style="margin-bottom:16px; color:var(--text-muted); font-size:13px">
              Genera un archivo Excel listo para enviar a ferreterías o proveedores.
              Incluye columnas editables para que el proveedor llene el precio cotizado y su nombre.
              Al recibir los precios, actualizás el catálogo desde el módulo <strong>Insumos</strong>.
            </p>

            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-bottom:20px">

              <!-- Opción 1: Solo sin precio -->
              <div style="border:2px solid var(--red,#e53e3e); border-radius:6px; padding:16px; text-align:center; background:rgba(229,62,62,0.03)">
                <div style="font-size:28px; margin-bottom:8px">⚠️</div>
                <div style="font-weight:700; font-size:14px; color:var(--red,#e53e3e); margin-bottom:6px">SIN PRECIO</div>
                <div style="font-size:12px; color:var(--text-muted); margin-bottom:14px">
                  Solo los insumos con precio = 0.<br>
                  <strong>Prioridad urgente</strong> — afectan los costos unitarios del catálogo.
                </div>
                <div id="cntSinPrecio" style="font-family:'Barlow Condensed',sans-serif; font-size:22px; font-weight:700; color:var(--red,#e53e3e); margin-bottom:10px">…</div>
                <div style="display:flex;flex-direction:column;gap:6px">
                  <button class="btn btn-orange" style="width:100%" onclick="descargarCotizacion('sin_precio')">📥 Excel</button>
                  <button class="btn btn-secondary" style="width:100%" onclick="imprimirCotizacionPDF('sin_precio')">🖨️ PDF</button>
                </div>
              </div>

              <!-- Opción 2: Con precio (para actualizar) -->
              <div style="border:2px solid var(--blue); border-radius:6px; padding:16px; text-align:center; background:rgba(2,81,150,0.03)">
                <div style="font-size:28px; margin-bottom:8px">🔄</div>
                <div style="font-weight:700; font-size:14px; color:var(--blue); margin-bottom:6px">ACTUALIZACIÓN</div>
                <div style="font-size:12px; color:var(--text-muted); margin-bottom:14px">
                  Insumos que ya tienen precio.<br>
                  Para comparar y actualizar con cotización nueva.
                </div>
                <div id="cntConPrecio" style="font-family:'Barlow Condensed',sans-serif; font-size:22px; font-weight:700; color:var(--blue); margin-bottom:10px">…</div>
                <div style="display:flex;flex-direction:column;gap:6px">
                  <button class="btn btn-primary" style="width:100%" onclick="descargarCotizacion('con_precio')">📥 Excel</button>
                  <button class="btn btn-secondary" style="width:100%" onclick="imprimirCotizacionPDF('con_precio')">🖨️ PDF</button>
                </div>
              </div>

              <!-- Opción 3: Catálogo completo -->
              <div style="border:2px solid var(--gray-mid); border-radius:6px; padding:16px; text-align:center; background:var(--gray-light)">
                <div style="font-size:28px; margin-bottom:8px">📋</div>
                <div style="font-weight:700; font-size:14px; color:var(--text-dark,#333); margin-bottom:6px">CATÁLOGO COMPLETO</div>
                <div style="font-size:12px; color:var(--text-muted); margin-bottom:14px">
                  Todos los insumos (con y sin precio).<br>
                  Para cotización general con proveedor.
                </div>
                <div id="cntTodos" style="font-family:'Barlow Condensed',sans-serif; font-size:22px; font-weight:700; color:var(--text-dark,#333); margin-bottom:10px">…</div>
                <div style="display:flex;flex-direction:column;gap:6px">
                  <button class="btn btn-secondary" style="width:100%" onclick="descargarCotizacion('todos')">📥 Excel</button>
                  <button class="btn btn-secondary" style="width:100%" onclick="imprimirCotizacionPDF('todos')">🖨️ PDF</button>
                </div>
              </div>

            </div>

            <div style="background:#e8f4fd; border-left:4px solid var(--blue); padding:14px 16px; border-radius:0 4px 4px 0; font-size:12px">
              <div style="font-weight:700; color:var(--blue); margin-bottom:6px">📌 ¿Cómo usar esta lista?</div>
              <ol style="margin:0; padding-left:18px; color:var(--text-muted); line-height:1.8">
                <li>Descarga el Excel según lo que necesites (sin precio / actualización / completo)</li>
                <li>Envía el archivo al proveedor o ferretería (Larach y Cía, EPA, etc.)</li>
                <li>El proveedor llena las columnas amarillas: <strong>"PRECIO COTIZADO"</strong> y <strong>"Proveedor"</strong></li>
                <li>Al recibir el archivo lleno, actualizás cada precio en <strong>Módulo Insumos → editar ✎</strong></li>
                <li>El sistema recalcula automáticamente todos los costos unitarios afectados</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: EETT POR ACTIVIDAD -->
      <div id="rpt-eett_act" class="rpt-panel hidden">
        <div class="card">
          <div class="card-header">
            <span class="card-title">ESPECIFICACIONES TÉCNICAS POR ACTIVIDAD</span>
          </div>
          <div class="card-body">
            <p style="margin-bottom:16px; color:var(--text-muted); font-size:13px">
              Especificaciones técnicas individuales para cada actividad del proyecto, con normas, materiales, procedimiento de ejecución y composición de insumos.
            </p>
            <div class="form-grid form-grid-2">
              <div class="form-group">
                <label class="form-label">Seleccionar Proyecto *</label>
                <select id="rpt5-proy" style="width:100%">
                  <option value="">-- Seleccionar proyecto --</option>
                  ${proyectos.map(p => `<option value="${p.id_proyecto}">${p.nombre} (${p.ubicacion||'—'})</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-actions">
              <button class="btn btn-orange" onclick="descargarReporte('/api/reportes/proyecto/' + document.getElementById('rpt5-proy').value + '/especificaciones', 'rpt5-proy', 'EETT_Actividades.xlsx')">
                📥 Descargar Excel
              </button>
              <button class="btn btn-secondary" onclick="imprimirEETTPDF(document.getElementById('rpt5-proy').value)">
                🖨️ Imprimir PDF
              </button>
            </div>
            <div style="margin-top:16px; padding:12px; background:var(--gray-light); border-radius:4px; font-size:12px; color:var(--text-muted)">
              <strong>Contenido:</strong> Una sección por cada actividad del proyecto con: norma aplicable, alcance, materiales requeridos, procedimiento de ejecución, composición de insumos y costos. Agrupado por código de actividad.
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (e) {
    el.querySelector('.page-body').innerHTML = `<div class="empty-state"><div>Error: ${e.error || e}</div></div>`;
  }
}

function switchRptTab(tab, el) {
  document.querySelectorAll('.rpt-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`rpt-${tab}`)?.classList.remove('hidden');
  el.classList.add('active');
  if (tab === 'cotizacion') cargarContadoresCotizacion();
}

async function cargarContadoresCotizacion() {
  // Solo cargar una vez
  if (document.getElementById('cntSinPrecio')?.dataset.loaded) return;
  try {
    const data = await api.get('/api/insumos/sin-precio');
    const sinP = data.total_sin_precio || 0;
    const conP = (data.total_insumos || 0) - sinP;
    const tot  = data.total_insumos || 0;
    const el1 = document.getElementById('cntSinPrecio');
    const el2 = document.getElementById('cntConPrecio');
    const el3 = document.getElementById('cntTodos');
    if (el1) { el1.textContent = sinP.toLocaleString() + ' insumos'; el1.dataset.loaded = '1'; }
    if (el2) el2.textContent = conP.toLocaleString() + ' insumos';
    if (el3) el3.textContent = tot.toLocaleString() + ' insumos';
  } catch(e) {
    ['cntSinPrecio','cntConPrecio','cntTodos'].forEach(id => {
      const e2 = document.getElementById(id); if(e2) e2.textContent = '—';
    });
  }
}

function descargarCotizacion(filtro) {
  const labels = { sin_precio:'insumos sin precio', con_precio:'insumos con precio', todos:'catálogo completo' };
  window.open(`/api/reportes/insumos/cotizacion?filtro=${filtro}`, '_blank');
  toast(`Generando lista de ${labels[filtro] || filtro}...`, 'info');
}

function descargarReporte(url, selectId, filename) {
  const val = document.getElementById(selectId)?.value;
  if (!val) { toast('Selecciona un proyecto o presupuesto', 'error'); return; }
  window.open(url, '_blank');
  toast(`Generando ${filename}...`, 'info');
}

// ═══════════════════════════════════════════════════════════
//  MOTOR PDF — funciones compartidas
// ═══════════════════════════════════════════════════════════
const PDF = {
  fmt: n => 'L ' + (n||0).toLocaleString('es-HN', {minimumFractionDigits:2, maximumFractionDigits:2}),
  num: (n,d=2) => (n||0).toLocaleString('es-HN', {minimumFractionDigits:d, maximumFractionDigits:d}),

  css: `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;font-size:11px;color:#222;background:#fff}
    @page{margin:12mm;size:letter}
    @media print{body{padding:0}.no-print{display:none!important}}
    @media screen{body{padding:16px;max-width:960px;margin:auto}}
    .logo-bar{background:#025196;color:#fff;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
    .logo-bar h1{font-size:13px;font-weight:700;letter-spacing:.3px}
    .logo-bar small{font-size:10px;opacity:.8}
    .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;border:1px solid #025196;padding:10px 14px;border-radius:4px;margin-bottom:14px;background:#f0f5fb}
    .meta-item{font-size:11px}.meta-label{font-weight:700;color:#025196}
    table{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:10.5px}
    thead th{background:#025196;color:#fff;padding:6px 7px;text-align:left;font-size:10px;white-space:nowrap}
    tbody td{padding:5px 7px;border-bottom:1px solid #e8e8e8}
    tbody tr:nth-child(even) td{background:#f7f9fc}
    .cat-header td{background:#FDB338!important;font-weight:700;font-size:11px;color:#333;padding:6px 7px}
    .subtotal td{background:#dce8f5!important;font-weight:700;color:#025196}
    .grand-total td{background:#025196!important;color:#fff!important;font-weight:700;font-size:12px}
    .section-title{font-size:11px;font-weight:700;color:#025196;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid #025196;padding-bottom:3px;margin:14px 0 8px}
    .ficha-box{border:1px solid #ddd;border-radius:4px;margin-bottom:16px;page-break-inside:avoid}
    .ficha-header{background:#025196;color:#fff;padding:8px 12px;display:flex;justify-content:space-between;align-items:center}
    .ficha-header .code{font-family:monospace;font-size:13px;font-weight:700}
    .ficha-header .name{font-size:11px;flex:1;margin:0 12px}
    .ficha-header .unit{background:#FDB338;color:#333;padding:3px 10px;border-radius:3px;font-weight:700;font-size:11px}
    .ficha-body{padding:10px 12px}
    .ficha-section{margin-bottom:10px}
    .ficha-section h4{font-size:10px;font-weight:700;color:#025196;text-transform:uppercase;margin-bottom:5px}
    .ficha-section p{font-size:10.5px;line-height:1.6;text-align:justify}
    .insumos-table{width:100%;border-collapse:collapse;font-size:10px;margin-top:8px}
    .insumos-table th{background:#8C9BAD;color:#fff;padding:4px 6px}
    .insumos-table td{padding:3px 6px;border-bottom:1px solid #eee}
    .insumos-table tr:nth-child(even) td{background:#f9f9f9}
    .totales-box{max-width:320px;margin-left:auto;border:1px solid #025196;border-radius:4px;overflow:hidden;margin-bottom:14px}
    .total-row{display:flex;justify-content:space-between;padding:5px 12px;font-size:11px}
    .total-row.highlight{background:#f0f5fb}
    .total-row.grand{background:#025196;color:#fff;font-weight:700;font-size:13px;padding:8px 12px}
    .footer{margin-top:16px;border-top:1px solid #ccc;padding-top:8px;font-size:9px;color:#888;display:flex;justify-content:space-between}
    .print-btn{position:fixed;bottom:20px;right:20px;background:#025196;color:#fff;border:none;padding:12px 20px;border-radius:6px;font-size:13px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.25)}
    .print-btn:hover{background:#FDB338;color:#333}`,

  header: (titulo, subtitulo='') => `
    <div class="logo-bar">
      <div>
        <h1>${titulo}</h1>
        ${subtitulo ? `<small>${subtitulo}</small>` : ''}
      </div>
      <small>Servicios y Construcciones RP &nbsp;|&nbsp; ${new Date().toLocaleDateString('es-HN')}</small>
    </div>`,

  metaGrid: (campos) => `
    <div class="meta-grid">${campos.map(([k,v]) =>
      `<div class="meta-item"><span class="meta-label">${k}:</span> ${v||'—'}</div>`).join('')}
    </div>`,

  footer: () => `
    <div class="footer">
      <span>Generado por Sistema de Costos Unitarios — Servicios y Construcciones RP</span>
      <span>${new Date().toLocaleString('es-HN')}</span>
    </div>`,

  wrap: (body, titulo) => `<!DOCTYPE html><html lang="es"><head>
    <meta charset="UTF-8"><title>${titulo}</title>
    <style>${PDF.css}</style></head><body>
    ${body}
    <button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
    <script>window.onload=function(){window.print();}<\/script>
    </body></html>`,

  abrir: (html, titulo) => {
    const win = window.open('', '_blank', 'width=1000,height=750');
    if (!win) { toast('Active ventanas emergentes para imprimir PDF', 'error'); return; }
    win.document.write(html);
    win.document.close();
  }
};

// ═══════════════════════════════════════════════════════════
//  PDF 1 — FICHAS DE COSTOS
// ═══════════════════════════════════════════════════════════
async function imprimirFichasPDF(id_proyecto) {
  if (!id_proyecto) { toast('Selecciona un proyecto', 'error'); return; }
  toast('Generando PDF de fichas...', 'info');
  try {
    const d = await api.get(`/api/reportes/proyecto/${id_proyecto}/fichas/pdf-data`);
    let fichasHTML = '';
    for (const act of d.actividades) {
      // Agrupar insumos por categoría
      const cats = {};
      for (const ins of act.insumos) {
        if (!cats[ins.categoria]) cats[ins.categoria] = [];
        cats[ins.categoria].push(ins);
      }
      let insumosHTML = '';
      if (act.insumos.length) {
        insumosHTML = `<table class="insumos-table">
          <thead><tr><th>Código</th><th>Descripción</th><th>Unid</th>
            <th style="text-align:right">Cant.</th><th style="text-align:right">Rendto</th>
            <th style="text-align:right">P.Unit.</th><th style="text-align:right">C.Parcial</th></tr></thead>
          <tbody>`;
        for (const [cat, items] of Object.entries(cats)) {
          const sub = items.reduce((s,i) => s+Number(i.costo_parcial||0), 0);
          insumosHTML += `<tr><td colspan="7" style="background:#dce8f5;font-weight:700;color:#025196;font-size:10px">▸ ${cat}</td></tr>`;
          items.forEach(i => {
            insumosHTML += `<tr><td style="font-family:monospace;color:#025196">${i.codigo}</td>
              <td>${i.descripcion}</td><td>${i.unidad}</td>
              <td style="text-align:right">${PDF.num(i.cantidad,4)}</td>
              <td style="text-align:right">${PDF.num(i.rendimiento,4)}</td>
              <td style="text-align:right">${PDF.fmt(i.precio_unitario)}</td>
              <td style="text-align:right">${PDF.fmt(i.costo_parcial)}</td></tr>`;
          });
          insumosHTML += `<tr><td colspan="6" style="text-align:right;font-weight:700;color:#025196;font-size:10px">Subtotal ${cat}</td>
            <td style="text-align:right;font-weight:700;color:#025196">${PDF.fmt(sub)}</td></tr>`;
        }
        insumosHTML += `<tr style="background:#025196"><td colspan="6" style="color:#fff;font-weight:700;text-align:right">COSTO TOTAL</td>
          <td style="color:#fff;font-weight:700;text-align:right">${PDF.fmt(act.costo_total)}</td></tr>`;
        insumosHTML += '</tbody></table>';
      } else {
        insumosHTML = '<p style="color:#888;font-size:10px;font-style:italic">Sin insumos registrados</p>';
      }
      fichasHTML += `
        <div class="ficha-box">
          <div class="ficha-header">
            <span class="code">${act.codigo}</span>
            <span class="name">${act.descripcion}</span>
            <span class="unit">${act.unidad}</span>
          </div>
          <div class="ficha-body">${insumosHTML}</div>
        </div>`;
    }
    const body = `
      ${PDF.header('FICHAS DE COSTOS UNITARIOS', d.proyecto)}
      ${PDF.metaGrid([['Proyecto',d.proyecto],['Cliente',d.cliente],['Ubicación',d.ubicacion],['Moneda',d.moneda]])}
      ${fichasHTML}
      ${PDF.footer()}`;
    PDF.abrir(PDF.wrap(body, `Fichas — ${d.proyecto}`));
  } catch(e) { toast('Error generando PDF: ' + (e.error||e), 'error'); }
}

// ═══════════════════════════════════════════════════════════
//  PDF 2 — LISTADO DE INSUMOS
// ═══════════════════════════════════════════════════════════
async function imprimirInsumosPDF(id_proyecto) {
  if (!id_proyecto) { toast('Selecciona un proyecto', 'error'); return; }
  toast('Generando PDF de insumos...', 'info');
  try {
    const d = await api.get(`/api/reportes/proyecto/${id_proyecto}/insumos/pdf-data`);
    // Agrupar por categoría
    const cats = {};
    for (const ins of d.insumos) {
      if (!cats[ins.categoria]) cats[ins.categoria] = [];
      cats[ins.categoria].push(ins);
    }
    let filas = '';
    for (const [cat, items] of Object.entries(cats)) {
      const sub = items.reduce((s,i) => s+Number(i.costo_total||0), 0);
      filas += `<tr class="cat-header"><td colspan="6">${cat}</td></tr>`;
      items.forEach((i,idx) => {
        filas += `<tr>
          <td style="font-family:monospace;color:#025196;font-size:10px">${i.codigo}</td>
          <td>${i.descripcion}</td><td style="text-align:center">${i.unidad}</td>
          <td style="text-align:right">${PDF.fmt(i.precio_unitario)}</td>
          <td style="text-align:right">${PDF.num(i.cantidad,4)}</td>
          <td style="text-align:right">${PDF.fmt(i.costo_total)}</td></tr>`;
      });
      filas += `<tr class="subtotal"><td colspan="5" style="text-align:right">Subtotal ${cat}</td>
        <td style="text-align:right">${PDF.fmt(sub)}</td></tr>`;
    }
    filas += `<tr class="grand-total"><td colspan="5" style="text-align:right">COSTO TOTAL DE INSUMOS</td>
      <td style="text-align:right">${PDF.fmt(d.gran_total)}</td></tr>`;

    const body = `
      ${PDF.header('LISTADO DE INSUMOS DEL PROYECTO', d.proyecto)}
      ${PDF.metaGrid([['Proyecto',d.proyecto],['Cliente',d.cliente],['Ubicación',d.ubicacion],['Fecha',new Date().toLocaleDateString('es-HN')]])}
      <table>
        <thead><tr><th>Código</th><th>Descripción</th><th>Unidad</th>
          <th style="text-align:right">P. Unitario</th>
          <th style="text-align:right">Cantidad Total</th>
          <th style="text-align:right">Costo Total</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
      ${(() => {
        const cero = d.insumos.filter(i => !i.precio_unitario || Number(i.precio_unitario) === 0);
        if (cero.length > 0) {
          const lista = cero.slice(0,5).map(i => '• ' + i.descripcion + ' (' + i.unidad + ')').join('<br>');
          const extra = cero.length > 5 ? '<br>... y ' + (cero.length-5) + ' más' : '';
          return '<div style="background:#fff8e1;border:1.5px solid #f59e0b;border-radius:6px;padding:10px 14px;margin-bottom:14px">'
            + '<div style="font-weight:700;color:#92400e;font-size:10px;margin-bottom:4px">⚠ ADVERTENCIA — ' + cero.length + ' insumo' + (cero.length>1?'s':'') + ' con precio L 0.00</div>'
            + '<div style="font-size:9px;color:#b45309;line-height:1.6">' + lista + extra + '</div>'
            + '<div style="font-size:9px;color:#92400e;margin-top:4px;font-style:italic">Actualice precios en Catálogos → Insumos y presione Recalcular.</div>'
            + '</div>';
        }
        return '<p style="font-size:9px;color:#888;font-style:italic;margin-bottom:14px">Todos los insumos tienen precio. Precios de referencia Honduras 2025-2026.</p>';
      })()}
      ${PDF.footer()}`;
    PDF.abrir(PDF.wrap(body, `Insumos — ${d.proyecto}`));
  } catch(e) { toast('Error generando PDF: ' + (e.error||e), 'error'); }
}

// ═══════════════════════════════════════════════════════════
//  PDF 3 — PRESUPUESTO
// ═══════════════════════════════════════════════════════════
async function imprimirPresupuestoPDF(id_presupuesto) {
  if (!id_presupuesto) { toast('Selecciona un presupuesto', 'error'); return; }
  toast('Generando PDF de presupuesto...', 'info');
  try {
    const d = await api.get(`/api/reportes/presupuesto/${id_presupuesto}/pdf-data`);
    // Agrupar por capítulo
    const caps = {};
    for (const p of d.partidas) {
      const cap = p.capitulo || 'General';
      if (!caps[cap]) caps[cap] = [];
      caps[cap].push(p);
    }
    let filas = '', item = 0;
    for (const [cap, parts] of Object.entries(caps)) {
      const subCap = parts.reduce((s,p) => s+Number(p.subtotal||0), 0);
      if (Object.keys(caps).length > 1) {
        filas += `<tr class="cat-header"><td colspan="6">${cap}</td></tr>`;
      }
      parts.forEach(p => {
        item++;
        filas += `<tr>
          <td style="text-align:center">${item}</td>
          <td style="font-family:monospace;color:#025196;font-size:10px">${p.codigo||''}</td>
          <td>${p.descripcion}</td><td style="text-align:center">${p.unidad}</td>
          <td style="text-align:right">${PDF.num(p.cantidad)}</td>
          <td style="text-align:right">${PDF.fmt(p.precio_unitario)}</td>
          <td style="text-align:right">${PDF.fmt(p.subtotal)}</td></tr>`;
      });
      if (Object.keys(caps).length > 1) {
        filas += `<tr class="subtotal">
          <td colspan="6" style="text-align:right">Subtotal ${cap}</td>
          <td style="text-align:right">${PDF.fmt(subCap)}</td></tr>`;
      }
    }
    const body = `
      ${PDF.header('PRESUPUESTO DE OBRA', d.proyecto)}
      ${PDF.metaGrid([['Proyecto',d.proyecto],['Presupuesto',d.nombre_presupuesto],['Cliente',d.cliente],['Ubicación',d.ubicacion]])}
      <table>
        <thead><tr><th style="text-align:center">N°</th><th>Código</th><th>Descripción</th>
          <th style="text-align:center">Unidad</th><th style="text-align:right">Cantidad</th>
          <th style="text-align:right">P. Unitario</th><th style="text-align:right">Subtotal</th></tr></thead>
        <tbody>${filas}
          <tr class="grand-total"><td colspan="6" style="text-align:right">COSTOS DIRECTOS</td>
            <td style="text-align:right">${PDF.fmt(d.costos_directos)}</td></tr>
        </tbody>
      </table>
      <div class="totales-box">
        <div class="total-row highlight"><span>Costos Directos</span><span>${PDF.fmt(d.costos_directos)}</span></div>
        <div class="total-row"><span>Costos Indirectos (${d.porcentaje_indirectos||0}%)</span><span>${PDF.fmt(d.costos_indirectos)}</span></div>
        <div class="total-row highlight"><span>Utilidad (${d.porcentaje_utilidad||0}%)</span><span>${PDF.fmt(d.utilidad)}</span></div>
        <div class="total-row"><span>Imprevistos (${d.porcentaje_imprevistos||0}%)</span><span>${PDF.fmt(d.imprevistos)}</span></div>
        <div class="total-row grand"><span>TOTAL GENERAL</span><span>${PDF.fmt(d.total_general)}</span></div>
      </div>
      ${PDF.footer()}`;
    PDF.abrir(PDF.wrap(body, `Presupuesto — ${d.proyecto}`));
  } catch(e) { toast('Error generando PDF: ' + (e.error||e), 'error'); }
}

// ═══════════════════════════════════════════════════════════
//  PDF 4 — EETT POR ACTIVIDAD
// ═══════════════════════════════════════════════════════════
async function imprimirEETTPDF(id_proyecto) {
  if (!id_proyecto) { toast('Selecciona un proyecto', 'error'); return; }
  toast('Generando PDF de especificaciones técnicas...', 'info');
  try {
    const d = await api.get(`/api/reportes/proyecto/${id_proyecto}/especificaciones/pdf-data`);
    let eettHTML = '';
    for (const act of d.actividades) {
      const s = act.spec;
      eettHTML += `
        <div class="ficha-box">
          <div class="ficha-header">
            <span class="code">${act.codigo}</span>
            <span class="name">${act.descripcion}</span>
            <span class="unit">${act.unidad}</span>
          </div>
          <div class="ficha-body">
            ${s ? `
              <div class="ficha-section">
                <h4>Descripción de la actividad</h4>
                <p>${s.descripcion||'—'}</p>
              </div>
              <div class="ficha-section">
                <h4>Consideraciones del análisis de costo</h4>
                <p>${s.consideraciones||'—'}</p>
              </div>
              <div class="ficha-section">
                <h4>Criterios de medición y pago</h4>
                <p>${s.criterios_pago||'—'}</p>
              </div>` :
              `<p style="color:#888;font-size:10px;font-style:italic">
                Especificación técnica no disponible para código ${act.codigo}.<br>
                Descripción del sistema: ${act.descripcion}
              </p>`
            }
          </div>
        </div>`;
    }
    const body = `
      ${PDF.header('ESPECIFICACIONES TÉCNICAS POR ACTIVIDAD', d.proyecto)}
      ${PDF.metaGrid([['Proyecto',d.proyecto],['Cliente',d.cliente],['Ubicación',d.ubicacion],['Fuente','Especificaciones Técnicas de Actividades — agosto 2007']])}
      ${eettHTML}
      ${PDF.footer()}`;
    PDF.abrir(PDF.wrap(body, `EETT — ${d.proyecto}`));
  } catch(e) { toast('Error generando PDF: ' + (e.error||e), 'error'); }
}

// ═══════════════════════════════════════════════════════════
//  PDF 5 — LISTA DE COTIZACIÓN
// ═══════════════════════════════════════════════════════════
async function imprimirCotizacionPDF(filtro) {
  toast('Generando PDF de cotización...', 'info');
  try {
    const d = await api.get(`/api/reportes/insumos/cotizacion/pdf-data?filtro=${filtro}`);
    const labels = { sin_precio:'Insumos sin precio (prioritario)', con_precio:'Insumos con precio (actualización)', todos:'Catálogo completo de insumos' };
    const cats = {};
    for (const ins of d.insumos) {
      if (!cats[ins.categoria]) cats[ins.categoria] = [];
      cats[ins.categoria].push(ins);
    }
    let filas = '';
    let n = 0;
    for (const [cat, items] of Object.entries(cats)) {
      filas += `<tr class="cat-header"><td colspan="6">${cat}</td></tr>`;
      items.forEach(i => {
        n++;
        filas += `<tr>
          <td style="text-align:center;color:#888">${n}</td>
          <td style="font-family:monospace;color:#025196;font-size:10px">${i.codigo}</td>
          <td>${i.descripcion}</td>
          <td style="text-align:center">${i.unidad}</td>
          <td style="text-align:right">${i.precio_unitario > 0 ? PDF.fmt(i.precio_unitario) : '<span style="color:#c00">Sin precio</span>'}</td>
          <td style="background:#fffbe6;text-align:center;color:#888;font-style:italic">Anotar aquí</td></tr>`;
      });
    }
    const body = `
      ${PDF.header('LISTA DE COTIZACIÓN DE INSUMOS', labels[filtro]||'')}
      ${PDF.metaGrid([['Tipo',labels[filtro]||filtro],['Total insumos',d.insumos.length.toLocaleString()],['Fecha emisión',d.fecha],['Instrucción','Complete la columna "Precio cotizado" y devuelva']])}
      <table>
        <thead><tr><th style="text-align:center">N°</th><th>Código</th><th>Descripción</th>
          <th style="text-align:center">Unidad</th>
          <th style="text-align:right">Precio actual</th>
          <th style="background:#fffbe6;color:#333;text-align:center">Precio cotizado (L)</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <div style="background:#e8f4fd;border-left:4px solid #025196;padding:10px 14px;border-radius:0 4px 4px 0;font-size:10px;margin-bottom:14px">
        <strong style="color:#025196">Instrucciones para el proveedor:</strong>
        Complete la columna <strong>"Precio cotizado"</strong> con el precio en Lempiras (L) incluyendo IVA.
        Indique también el nombre de su empresa/ferretería. Devuelva este documento al solicitante.
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;font-size:11px">
        <div style="border-top:1px solid #333;padding-top:8px;text-align:center">Firma del proveedor / Sello</div>
        <div style="border-top:1px solid #333;padding-top:8px;text-align:center">Nombre del proveedor / Ferretería</div>
      </div>
      ${PDF.footer()}`;
    PDF.abrir(PDF.wrap(body, `Cotización — ${labels[filtro]||filtro}`));
  } catch(e) { toast('Error generando PDF: ' + (e.error||e), 'error'); }
}

// ═══════════════════════════════════════════════════════════
//  PDF 6 — EETT GENERALES (sin datos de BD, texto estático)
// ═══════════════════════════════════════════════════════════
function imprimirEETTGeneralesPDF() {
  toast('Generando PDF de EETT Generales...', 'info');
  const secciones = [
    ['1. NORMATIVA APLICABLE',
     'Las presentes especificaciones técnicas se rigen por: Ley de Contratación del Estado (Decreto 74-2001), Reglamento General de la Ley de Municipalidades (Decreto 134-90), normas ACI 318 para concreto estructural, normas ASTM para materiales de construcción, normas AWWA para sistemas de agua potable, Normas Técnicas de SANAA para sistemas de agua y saneamiento en Honduras, y Manual de Especificaciones Técnicas de Actividades (agosto 2007).'],
    ['2. ESPECIFICACIONES DE MATERIALES',
     'CEMENTO: Se utilizará cemento Portland Tipo I o Tipo II, conforme a ASTM C-150. El cemento debe almacenarse en bodegas secas sobre tarimas. No se aceptará cemento con grumos o parcialmente fraguado. ACERO DE REFUERZO: Varilla corrugada grado 40 (Fy=2,800 kg/cm²) o grado 60 (Fy=4,200 kg/cm²) según diseño, conforme a ASTM A-615. AGREGADOS: Arena de río limpia, libre de arcillas y materia orgánica. Grava o piedra triturada de granulometría uniforme. Tamaño máximo del agregado grueso no mayor a 1/3 del espesor del elemento estructural. AGUA: Potable, libre de aceites, ácidos, álcalis o materias orgánicas. TUBERÍAS PVC: Conforme a ASTM D-1785 (presión) y ASTM D-3034 (drenaje). Las tuberías de agua potable deben cumplir NSF/ANSI 61.'],
    ['3. PROCEDIMIENTOS DE EJECUCIÓN',
     'TRAZO Y REPLANTEO: Toda obra civil iniciará con replanteo topográfico por Ingeniero o Topógrafo calificado, dejando referencias permanentes para control de niveles y alineamientos. EXCAVACIONES: Las excavaciones se ejecutarán conforme a los planos aprobados. En suelos inestables se requerirá entibado o taludes adecuados. Se prohíbe circular equipo pesado a menos de 1.0 m del borde de excavación. CONCRETO: El concreto se producirá con mezcladoras mecánicas. La mezcla manual solo se permite para concreto no estructural. El vaciado debe ser continuo sin interrupciones que causen juntas frías. El curado mínimo es de 7 días con agua. MAMPOSTERÍA: Los bloques de concreto deben tener resistencia mínima de 55 kg/cm². La mezcla de pega será proporción 1:4 (cemento:arena). El espesor de juntas horizontales y verticales será de 10-15 mm. INSTALACIONES HIDRÁULICAS: Las tuberías de PVC se instalarán con accesorios del mismo material y fabricante. Las uniones solventadas requieren limpieza previa con primer. El relleno sobre tuberías se ejecutará en capas de 15 cm compactadas manualmente.'],
    ['4. CONTROL DE CALIDAD',
     'CONCRETO: Se realizarán ensayos de resistencia a la compresión conforme a ASTM C-39. Mínimo un juego de 3 cilindros por cada 10 m³ vaciados. La resistencia de diseño debe alcanzarse a los 28 días. COMPACTACIÓN: El control de compactación de rellenos se verificará por ensayo Proctor Estándar (ASTM D-698). La compactación mínima será del 95% del Proctor en áreas exteriores y 98% bajo estructuras. TUBERÍAS: Prueba hidrostática a 1.5 veces la presión de trabajo durante 2 horas sin pérdidas.'],
    ['5. SEGURIDAD E HIGIENE OCUPACIONAL',
     'El Contratista es responsable de la seguridad del personal según la Ley del IHSS y el Reglamento General de Medidas Preventivas de Accidentes de Trabajo y Enfermedades Profesionales. Todo el personal usará equipo de protección personal (EPP): casco, botas punta de acero, guantes y chaleco reflectivo. Las excavaciones mayores de 1.5 m de profundidad requieren sistemas de protección contra derrumbes. Se mantendrá señalización perimetral y luminaria nocturna en toda la obra.'],
    ['6. MEDICIÓN Y PAGO',
     'Los trabajos se medirán y pagarán conforme a las unidades establecidas en el catálogo de precios del contrato. No se reconocerá trabajo adicional sin orden de cambio escrita y aprobada por la supervisión. Los precios unitarios son fijos durante la vigencia del contrato. Las demasías de materiales por desperdicio no justificado son a cargo del Contratista.']
  ];
  const seccionesHTML = secciones.map(([titulo, contenido]) => `
    <div style="margin-bottom:18px;page-break-inside:avoid">
      <div class="section-title">${titulo}</div>
      <p style="font-size:11px;line-height:1.75;text-align:justify">${contenido}</p>
    </div>`).join('');

  const body = `
    ${PDF.header('ESPECIFICACIONES TÉCNICAS GENERALES', 'Proyectos de Construcción — Honduras')}
    ${PDF.metaGrid([
      ['Normas de referencia','SOPTRAVI/INSEP, SANAA, ACI, ASTM, AWWA'],
      ['Aplicación','Proyectos de infraestructura y edificaciones'],
      ['Fecha emisión', new Date().toLocaleDateString('es-HN')],
      ['Vigencia','Verificar actualización normativa antes de aplicar']
    ])}
    ${seccionesHTML}
    <div style="margin-top:20px;padding:12px 14px;background:#fff3cd;border:1px solid #FDB338;border-radius:4px;font-size:10px;color:#555">
      <strong style="color:#025196">Nota:</strong> Las presentes especificaciones son de carácter general.
      Las especificaciones particulares de cada actividad del catálogo prevalecen sobre estas.
      La revisión técnica por el Ingeniero responsable del proyecto es obligatoria antes de su aplicación.
    </div>
    ${PDF.footer()}`;
  PDF.abrir(PDF.wrap(body, 'EETT Generales — Servicios y Construcciones RP'));
}
