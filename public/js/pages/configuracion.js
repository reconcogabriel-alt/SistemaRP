// ============================================================
//  CONFIGURACIÓN DEL SISTEMA — Sistema de Costos Unitarios v2.19
//  Identidad de empresa (nombre, subtítulo, RTN, teléfono, correo, dirección)
//  + Defaults de porcentajes para nuevos presupuestos
// ============================================================

async function renderConfiguracion() {
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">CONFIGURACIÓN DEL SISTEMA</div>
        <div class="page-subtitle">Datos de empresa y parámetros por defecto</div>
      </div>
    </div>
    <div class="page-body">
      <div class="loading"><div class="spinner"></div> Cargando configuración...</div>
    </div>`;

  try {
    const cfg = await api.get('/api/configuracion');
    const val = (clave, def = '') => (cfg[clave] && cfg[clave].valor !== undefined) ? cfg[clave].valor : def;

    el.querySelector('.page-body').innerHTML = `

      <!-- ── Bloque 1: Datos de empresa ── -->
      <div class="card" style="max-width:720px">
        <div class="card-header">
          <span class="card-title">🏢 Datos de la Empresa</span>
        </div>
        <div class="card-body">
          <p style="font-size:13px; color:var(--text-muted); margin-bottom:20px">
            Estos datos aparecen en el encabezado de todos los reportes PDF.
          </p>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px">
            <div class="form-group" style="grid-column:1/-1">
              <label class="form-label">Nombre de la empresa *</label>
              <input id="cfg-empresa-nombre" class="form-control" type="text"
                value="${escHtml(val('empresa_nombre'))}"
                placeholder="Ej: Constructora López S. de R.L.">
            </div>

            <div class="form-group" style="grid-column:1/-1">
              <label class="form-label">Subtítulo / Descripción (opcional)</label>
              <input id="cfg-empresa-subtitulo" class="form-control" type="text"
                value="${escHtml(val('empresa_subtitulo'))}"
                placeholder="Ej: Ingeniería Civil — Honduras">
            </div>

            <div class="form-group">
              <label class="form-label">RTN</label>
              <input id="cfg-empresa-rtn" class="form-control" type="text"
                value="${escHtml(val('empresa_rtn'))}"
                placeholder="Ej: 0501198012345"
                maxlength="14">
              <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Registro Tributario Nacional</div>
            </div>

            <div class="form-group">
              <label class="form-label">Teléfono</label>
              <input id="cfg-empresa-telefono" class="form-control" type="text"
                value="${escHtml(val('empresa_telefono'))}"
                placeholder="Ej: +504 2772-0000">
            </div>

            <div class="form-group">
              <label class="form-label">Correo electrónico</label>
              <input id="cfg-empresa-correo" class="form-control" type="email"
                value="${escHtml(val('empresa_correo'))}"
                placeholder="Ej: contacto@empresa.hn">
            </div>

            <div class="form-group">
              <label class="form-label">Ciudad / Dirección</label>
              <input id="cfg-empresa-direccion" class="form-control" type="text"
                value="${escHtml(val('empresa_direccion'))}"
                placeholder="Ej: Comayagua, Honduras">
            </div>
          </div>
        </div>
      </div>

      <!-- ── Bloque 2: Defaults de porcentajes ── -->
      <div class="card" style="max-width:720px; margin-top:20px">
        <div class="card-header">
          <span class="card-title">📐 Porcentajes por Defecto — Nuevos Presupuestos</span>
        </div>
        <div class="card-body">
          <p style="font-size:13px; color:var(--text-muted); margin-bottom:20px">
            Estos valores se aplicarán automáticamente al crear cada presupuesto nuevo.
            Se pueden ajustar individualmente por presupuesto en cualquier momento.
          </p>

          <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:16px">
            <div class="form-group">
              <label class="form-label">% Costos Indirectos</label>
              <div style="position:relative">
                <input id="cfg-default-indirectos" class="form-control" type="number"
                  min="0" max="100" step="0.5"
                  value="${escHtml(val('default_indirectos', '0'))}"
                  style="padding-right:32px">
                <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:13px">%</span>
              </div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Gastos generales, administración, supervisión</div>
            </div>

            <div class="form-group">
              <label class="form-label">% Utilidad</label>
              <div style="position:relative">
                <input id="cfg-default-utilidad" class="form-control" type="number"
                  min="0" max="100" step="0.5"
                  value="${escHtml(val('default_utilidad', '0'))}"
                  style="padding-right:32px">
                <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:13px">%</span>
              </div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Ganancia del contratista</div>
            </div>

            <div class="form-group">
              <label class="form-label">% Imprevistos</label>
              <div style="position:relative">
                <input id="cfg-default-imprevistos" class="form-control" type="number"
                  min="0" max="100" step="0.5"
                  value="${escHtml(val('default_imprevistos', '0'))}"
                  style="padding-right:32px">
                <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:13px">%</span>
              </div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Contingencias del proyecto</div>
            </div>
          </div>

          <!-- Vista previa del cálculo -->
          <div id="preview-porcentajes" style="
            margin-top:16px; padding:12px 16px;
            background:var(--bg-subtle,#f5f5f3); border-radius:6px;
            font-size:12px; color:var(--text-muted); display:flex; gap:24px; flex-wrap:wrap">
          </div>
        </div>
      </div>

      <!-- ── Bloque 3: Opciones de reportes ── -->
      <div class="card" style="max-width:720px; margin-top:20px">
        <div class="card-header">
          <span class="card-title">🖨️ Opciones de Reportes PDF</span>
        </div>
        <div class="card-body">
          <div class="form-group">
            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-size:13px">
              <input id="cfg-mostrar-fecha" type="checkbox"
                ${val('reporte_mostrar_fecha', '0') === '1' ? 'checked' : ''}
                style="width:16px; height:16px; cursor:pointer">
              <span>Mostrar fecha de generación en reportes PDF</span>
            </label>
          </div>
          <div class="form-group" style="margin-top:14px">
            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-size:13px">
              <input id="cfg-mostrar-precios-ref" type="checkbox"
                ${val('reporte_mostrar_precios_ref', '1') === '1' ? 'checked' : ''}
                style="width:16px; height:16px; cursor:pointer">
              <span>Incluir nota de precios de referencia (CHICO / Larach y Cía)</span>
            </label>
          </div>

          <div class="form-group" style="margin-top:14px">
            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-size:13px">
              <input id="cfg-ficha-mostrar-empresa" type="checkbox"
                ${val('ficha_mostrar_empresa', '1') === '1' ? 'checked' : ''}
                style="width:16px; height:16px; cursor:pointer">
              <span>Mostrar datos de empresa en encabezado de fichas de costos</span>
            </label>
            <div style="font-size:11px; color:var(--text-muted); margin-top:4px; margin-left:26px">
              Cuando está activo, el encabezado de cada ficha muestra nombre, RTN, teléfono y correo
              de la empresa en lugar de cliente/ubicación.
            </div>
          </div>
        </div>
      </div>

      <!-- ── Acciones ── -->
      <div style="margin-top:20px; display:flex; gap:12px">
        <button class="btn btn-primary" onclick="guardarConfiguracion()">
          💾 Guardar Configuración
        </button>
        <button class="btn btn-secondary" onclick="renderConfiguracion()">
          ↩ Restablecer
        </button>
      </div>

      <!-- ── Vista previa encabezado PDF ── -->
      <div class="card" style="max-width:720px; margin-top:24px">
        <div class="card-header">
          <span class="card-title">👁 Vista previa del encabezado de reporte</span>
        </div>
        <div class="card-body" style="padding:0">
          <div id="cfg-preview" style="
            background:#025196; color:#fff; padding:10px 16px;
            display:flex; justify-content:space-between; align-items:flex-start;
            font-family:Arial,sans-serif; font-size:12px; border-radius:0 0 4px 4px; gap:20px">
            <div>
              <strong>FICHAS DE COSTOS UNITARIOS</strong><br>
              <small style="opacity:.8">Nombre del Presupuesto</small>
            </div>
            <div id="prev-empresa-bloque" style="text-align:right; opacity:.9; font-size:11px; line-height:1.6"></div>
          </div>
        </div>
      </div>`;

    actualizarPreviewConfig();

    // Actualizar preview al escribir
    ['cfg-empresa-nombre','cfg-empresa-rtn','cfg-empresa-telefono',
     'cfg-empresa-correo','cfg-empresa-direccion','cfg-mostrar-fecha'].forEach(id => {
      const el2 = document.getElementById(id);
      if (el2) el2.addEventListener('input', actualizarPreviewConfig);
      if (el2) el2.addEventListener('change', actualizarPreviewConfig);
    });

    // Preview de porcentajes
    ['cfg-default-indirectos','cfg-default-utilidad','cfg-default-imprevistos'].forEach(id => {
      const el2 = document.getElementById(id);
      if (el2) el2.addEventListener('input', actualizarPreviewPorcentajes);
    });
    actualizarPreviewPorcentajes();

  } catch(e) {
    el.querySelector('.page-body').innerHTML = `<div class="empty-state"><div>Error: ${e.error || e}</div></div>`;
  }
}

function actualizarPreviewConfig() {
  const nombre    = document.getElementById('cfg-empresa-nombre')?.value    || '';
  const rtn       = document.getElementById('cfg-empresa-rtn')?.value       || '';
  const telefono  = document.getElementById('cfg-empresa-telefono')?.value  || '';
  const correo    = document.getElementById('cfg-empresa-correo')?.value    || '';
  const direccion = document.getElementById('cfg-empresa-direccion')?.value || '';
  const fecha     = document.getElementById('cfg-mostrar-fecha')?.checked;

  const bloque = document.getElementById('prev-empresa-bloque');
  if (!bloque) return;

  const lineas = [];
  if (nombre)    lineas.push(`<strong>${escHtml(nombre)}</strong>`);
  if (rtn)       lineas.push(`RTN: ${escHtml(rtn)}`);
  if (telefono)  lineas.push(escHtml(telefono));
  if (correo)    lineas.push(escHtml(correo));
  if (direccion) lineas.push(escHtml(direccion));
  if (fecha)     lineas.push(new Date().toLocaleDateString('es-HN'));

  bloque.innerHTML = lineas.join('<br>');
}

function actualizarPreviewPorcentajes() {
  const ind  = parseFloat(document.getElementById('cfg-default-indirectos')?.value)  || 0;
  const util = parseFloat(document.getElementById('cfg-default-utilidad')?.value)    || 0;
  const imp  = parseFloat(document.getElementById('cfg-default-imprevistos')?.value) || 0;
  const total = 100 + ind + util + imp;

  const prev = document.getElementById('preview-porcentajes');
  if (!prev) return;

  // Ejemplo sobre L 100,000 de costo directo
  const base = 100000;
  const fmt = v => 'L ' + v.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  prev.innerHTML = `
    <span>📋 Ejemplo sobre <strong>L 100,000</strong> de costo directo:</span>
    <span>Indirectos: <strong>${fmt(base * ind / 100)}</strong></span>
    <span>Utilidad: <strong>${fmt(base * util / 100)}</strong></span>
    <span>Imprevistos: <strong>${fmt(base * imp / 100)}</strong></span>
    <span style="border-left:1px solid var(--border-color);padding-left:16px">
      Total: <strong>${fmt(base * total / 100)}</strong>
      (factor ${(total / 100).toFixed(4)})
    </span>`;
}

async function guardarConfiguracion() {
  try {
    const nombre    = document.getElementById('cfg-empresa-nombre')?.value?.trim();
    const subtitulo = document.getElementById('cfg-empresa-subtitulo')?.value?.trim()  || '';
    const rtn       = document.getElementById('cfg-empresa-rtn')?.value?.trim()        || '';
    const telefono  = document.getElementById('cfg-empresa-telefono')?.value?.trim()   || '';
    const correo    = document.getElementById('cfg-empresa-correo')?.value?.trim()     || '';
    const direccion = document.getElementById('cfg-empresa-direccion')?.value?.trim()  || '';

    const indirectos  = parseFloat(document.getElementById('cfg-default-indirectos')?.value)  || 0;
    const utilidad    = parseFloat(document.getElementById('cfg-default-utilidad')?.value)    || 0;
    const imprevistos = parseFloat(document.getElementById('cfg-default-imprevistos')?.value) || 0;

    const mostrarFecha = document.getElementById('cfg-mostrar-fecha')?.checked   ? '1' : '0';
    const mostrarRef   = document.getElementById('cfg-mostrar-precios-ref')?.checked ? '1' : '0';

    if (!nombre) { toast('El nombre de empresa es requerido', 'error'); return; }

    await api.put('/api/configuracion', {
      empresa_nombre:            nombre,
      empresa_subtitulo:         subtitulo,
      empresa_rtn:               rtn,
      empresa_telefono:          telefono,
      empresa_correo:            correo,
      empresa_direccion:         direccion,
      default_indirectos:        String(indirectos),
      default_utilidad:          String(utilidad),
      default_imprevistos:       String(imprevistos),
      reporte_mostrar_fecha:       mostrarFecha,
      reporte_mostrar_precios_ref:   mostrarRef,
      ficha_mostrar_empresa:         document.getElementById('cfg-ficha-mostrar-empresa')?.checked ? '1' : '0',
    });

    toast('✅ Configuración guardada correctamente', 'success');
  } catch(e) {
    toast('Error al guardar: ' + (e.error || e), 'error');
  }
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
