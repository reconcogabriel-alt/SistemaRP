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
      <div class="loading"><div class="spinner"></div> Cargando presupuestos...</div>
    </div>`;

  try {
    const allPres = await api.get('/api/presupuestos');

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
              Genera una ficha detallada para cada actividad usada en el presupuesto, con composición de insumos, rendimientos, desperdicios y costos parciales. Incluye precios de referencia de mercado Honduras 2025-2026.
            </p>
            <div class="form-grid form-grid-2">
              <div class="form-group">
                <label class="form-label">Seleccionar Presupuesto *</label>
                <select id="rpt1-pres" style="width:100%">
                  <option value="">-- Seleccionar presupuesto --</option>
                  ${allPres.map(pr => `<option value="${pr.id_presupuesto}">${pr.nombre||'Presupuesto'} (L ${fmt(pr.total_general)})</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-actions">
              <button class="btn btn-orange" onclick="descargarReporte('/api/reportes/presupuesto/' + document.getElementById('rpt1-pres').value + '/fichas', 'rpt1-pres', 'Fichas_Costos.xlsx')">
                📥 Descargar Excel
              </button>
              <button class="btn btn-secondary" onclick="imprimirFichasPDF(document.getElementById('rpt1-pres').value)">
                🖨️ Imprimir PDF
              </button>
            </div>
            <div style="margin-top:16px; padding:12px; background:var(--gray-light); border-radius:4px; font-size:12px; color:var(--text-muted)">
              <strong>Contenido:</strong> Una ficha por cada actividad del presupuesto con código, descripción, unidad, composición detallada por categoría (Materiales / Mano de Obra / Equipo) y costo total. Precios actualizados con datos CHICO y Larach y Cía 2025-2026.
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: LISTADO INSUMOS -->
      <div id="rpt-insumos" class="rpt-panel hidden">
        <div class="card">
          <div class="card-header">
            <span class="card-title">LISTADO DE INSUMOS DEL PRESUPUESTO</span>
          </div>
          <div class="card-body">
            <p style="margin-bottom:16px; color:var(--text-muted); font-size:13px">
              Consolida todos los insumos requeridos para el presupuesto, agrupados por categoría, con cantidades totales y costos.
            </p>
            <div class="form-grid form-grid-2">
              <div class="form-group">
                <label class="form-label">Seleccionar Presupuesto *</label>
                <select id="rpt2-pres" style="width:100%">
                  <option value="">-- Seleccionar presupuesto --</option>
                  ${allPres.map(pr => `<option value="${pr.id_presupuesto}">${pr.nombre||'Presupuesto'} (L ${fmt(pr.total_general)})</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-actions">
              <button class="btn btn-orange" onclick="descargarReporte('/api/reportes/presupuesto/' + document.getElementById('rpt2-pres').value + '/insumos', 'rpt2-pres', 'Insumos_Presupuesto.xlsx')">
                📥 Descargar Excel
              </button>
              <button class="btn btn-secondary" onclick="imprimirInsumosPDF(document.getElementById('rpt2-pres').value)">
                🖨️ Imprimir PDF
              </button>
            </div>
            <div style="margin-top:16px; padding:12px; background:var(--gray-light); border-radius:4px; font-size:12px; color:var(--text-muted)">
              <strong>Contenido:</strong> Listado consolidado de todos los insumos necesarios para el presupuesto, agrupados por categoría (Materiales, Mano de Obra, Equipo, Herramientas), con precio unitario de referencia, cantidad total y costo total. Útil para gestión de compras y licitaciones.
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
              Reporte detallado del presupuesto con módulos, actividades, subtotales por módulo y resumen de costos directos + indirectos.
            </p>
            <div class="form-grid form-grid-2">
              <div class="form-group">
                <label class="form-label">Seleccionar Presupuesto *</label>
                <select id="rpt3-pres" style="width:100%">
                  <option value="">-- Seleccionar presupuesto --</option>
                  ${allPres.map(pr => `<option value="${pr.id_presupuesto}">${pr.nombre||'Presupuesto'} (L ${fmt(pr.total_general)})</option>`).join('')}
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
              <strong>Contenido:</strong> Presupuesto completo con número de ítem, código de actividad, descripción, unidad, cantidad, precio unitario y subtotal por actividad. Subtotales por módulo. Resumen de costos directos, indirectos, utilidad, imprevistos y total general.
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
              Especificaciones técnicas individuales para cada actividad del presupuesto, con normas, materiales, procedimiento de ejecución y composición de insumos.
            </p>
            <div class="form-grid form-grid-2">
              <div class="form-group">
                <label class="form-label">Seleccionar Presupuesto *</label>
                <select id="rpt5-pres" style="width:100%">
                  <option value="">-- Seleccionar presupuesto --</option>
                  ${allPres.map(pr => `<option value="${pr.id_presupuesto}">${pr.nombre||'Presupuesto'} (L ${fmt(pr.total_general)})</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-actions">
              <button class="btn btn-orange" onclick="descargarReporte('/api/reportes/presupuesto/' + document.getElementById('rpt5-pres').value + '/especificaciones', 'rpt5-pres', 'EETT_Actividades.xlsx')">
                📥 Descargar Excel
              </button>
              <button class="btn btn-secondary" onclick="imprimirEETTPDF(document.getElementById('rpt5-pres').value)">
                🖨️ Imprimir PDF
              </button>
            </div>
            <div style="margin-top:16px; padding:12px; background:var(--gray-light); border-radius:4px; font-size:12px; color:var(--text-muted)">
              <strong>Contenido:</strong> Una sección por cada actividad del presupuesto con: norma aplicable, alcance, materiales requeridos, procedimiento de ejecución, composición de insumos y costos. Agrupado por código de actividad.
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
  if (!val) { toast('Selecciona un presupuesto', 'error'); return; }
  window.open(url, '_blank');
  toast(`Generando ${filename}...`, 'info');
}

// ═══════════════════════════════════════════════════════════
//  MOTOR PDF — funciones comactividades
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

  // Configuración de empresa (se carga antes de imprimir con PDF.cargarConfig())
  _cfg: { empresa_nombre: '', reporte_mostrar_fecha: '1' }, // Se sobreescribe con cargarConfig()

  cargarConfig: async function() {
    try {
      const cfg = await api.get('/api/configuracion');
      if (cfg.empresa_nombre && cfg.empresa_nombre.valor)
        PDF._cfg.empresa_nombre = cfg.empresa_nombre.valor;
      if (cfg.reporte_mostrar_fecha && cfg.reporte_mostrar_fecha.valor !== undefined)
        PDF._cfg.reporte_mostrar_fecha = cfg.reporte_mostrar_fecha.valor;
    } catch(e) {
      // Si la BD aún no tiene la tabla (primera vez), usa el valor de la BD original
      if (!PDF._cfg.empresa_nombre) PDF._cfg.empresa_nombre = 'Servicios y Construcciones RP';
    }
  },

  header: (titulo, subtitulo='') => {
    const empresa = PDF._cfg.empresa_nombre;
    const mostrarFecha = PDF._cfg.reporte_mostrar_fecha !== '0';
    const fechaStr = mostrarFecha ? `&nbsp;|&nbsp; ${new Date().toLocaleDateString('es-HN')}` : '';
    return `
    <div class="logo-bar">
      <div>
        <h1>${titulo}</h1>
        ${subtitulo ? `<small>${subtitulo}</small>` : ''}
      </div>
      <small>${empresa}${fechaStr}</small>
    </div>`;
  },

  metaGrid: (campos) => `
    <div class="meta-grid">${campos.map(([k,v]) =>
      `<div class="meta-item"><span class="meta-label">${k}:</span> ${v||'—'}</div>`).join('')}
    </div>`,

  footer: () => {
    const empresa = PDF._cfg.empresa_nombre;
    const mostrarFecha = PDF._cfg.reporte_mostrar_fecha !== '0';
    const fechaStr = mostrarFecha ? `<span>${new Date().toLocaleString('es-HN')}</span>` : '';
    return `
    <div class="footer">
      <span>Generado por Sistema de Costos Unitarios — ${empresa}</span>
      ${fechaStr}
    </div>`;
  },

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
async function imprimirFichasPDF(id_presupuesto) {
  if (!id_presupuesto) { toast('Selecciona un presupuesto', 'error'); return; }
  window.open(`/api/reportes/presupuesto/${id_presupuesto}/fichas/html`, '_blank');
  toast('Generando fichas...', 'info');
}
// ═══════════════════════════════════════════════════════════
//  PDF 2 — LISTADO DE INSUMOS
// ═══════════════════════════════════════════════════════════
async function imprimirInsumosPDF(id_presupuesto) {
  if (!id_presupuesto) { toast('Selecciona un presupuesto', 'error'); return; }
  window.open(`/api/reportes/presupuesto/${id_presupuesto}/insumos/html`, '_blank');
  toast('Generando insumos...', 'info');
}
// ═══════════════════════════════════════════════════════════
//  PDF 3 — PRESUPUESTO
// ═══════════════════════════════════════════════════════════
async function imprimirPresupuestoPDF(id_presupuesto) {
  if (!id_presupuesto) { toast('Selecciona un presupuesto', 'error'); return; }
  window.open(`/api/reportes/presupuesto/${id_presupuesto}/html`, '_blank');
  toast('Generando presupuesto...', 'info');
}
// ═══════════════════════════════════════════════════════════
//  PDF 4 — EETT POR ACTIVIDAD
// ═══════════════════════════════════════════════════════════
async function imprimirEETTPDF(id_presupuesto) {
  if (!id_presupuesto) { toast('Selecciona un presupuesto', 'error'); return; }
  window.open(`/api/reportes/presupuesto/${id_presupuesto}/especificaciones/html`, '_blank');
  toast('Generando especificaciones técnicas...', 'info');
}
// ═══════════════════════════════════════════════════════════
//  PDF 5 — LISTA DE COTIZACIÓN
// ═══════════════════════════════════════════════════════════
async function imprimirCotizacionPDF(filtro) {
  window.open(`/api/reportes/insumos/cotizacion/html?filtro=${filtro}`, '_blank');
  toast('Generando lista de cotización...', 'info');
}
// ═══════════════════════════════════════════════════════════
//  PDF 6 — EETT GENERALES (sin datos de BD, texto estático)
// ═══════════════════════════════════════════════════════════
async function imprimirEETTGeneralesPDF() {
  window.open('/api/reportes/especificaciones/generales/html', '_blank');
  toast('Generando EETT Generales...', 'info');
}
