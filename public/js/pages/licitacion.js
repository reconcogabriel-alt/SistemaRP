// ============================================================
//  IMPORTAR LICITACIÓN — Carga rápida de actividades
// ============================================================

async function renderLicitacion(ctx = {}) {
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Importar Licitación</h1>
        <p class="page-sub">Carga rápida de actividades desde cartel · Identifica faltantes en la base de datos</p>
      </div>
    </div>
    <div id="lic-content"></div>
  `;
  mostrarPaso1();
}

// ══════════════════════════════════════════════════════════════
//  PASO 1 — Ingresar lista
// ══════════════════════════════════════════════════════════════
function mostrarPaso1() {
  const box = document.getElementById('lic-content');
  box.innerHTML = `
    <div class="lic-pasos">
      <div class="lic-paso activo">1. Ingresar lista</div>
      <div class="lic-paso">2. Revisar y confirmar</div>
      <div class="lic-paso">3. Importar al presupuesto</div>
    </div>

    <!-- TABS entrada -->
    <div class="lic-tabs">
      <button class="lic-tab activo" id="tabPegar" onclick="licTab('pegar')">📋 Pegar texto</button>
      <button class="lic-tab" id="tabExcel" onclick="licTab('excel')">📂 Subir Excel</button>
    </div>

    <!-- PANEL PEGAR -->
    <div id="panelPegar" class="lic-panel">
      <div class="lic-hint">
        <strong>Formato libre.</strong> Pegue el listado tal como viene del cartel.
        El sistema detecta automáticamente módulos (líneas en mayúsculas o con número romano)
        y actividades. También puede usar columnas separadas por tabulador:
        <code>Código TAB Descripción TAB Unidad TAB Cantidad</code>
      </div>
      <textarea id="licTexto" class="lic-textarea"
        placeholder="Ejemplo:
I. PRELIMINARES
001  TRAZADO Y MARCADO DE CALLE  ML  500
002  EXCAVACION EN SUELO TIPO I  M3  120

II. CIMENTACIONES
003  CONCRETO CICLOPEO f'c=175 kg/cm2  M3  45
..."></textarea>
      <div style="display:flex;justify-content:flex-end;margin-top:10px">
        <button class="btn btn-orange" onclick="licAnalizarTexto()">Analizar lista →</button>
      </div>
    </div>

    <!-- PANEL EXCEL -->
    <div id="panelExcel" class="lic-panel" style="display:none">
      <div class="lic-hint">
        Suba el Excel del cartel. El sistema lee la primera hoja e identifica columnas de
        <strong>código, descripción, unidad y cantidad</strong> automáticamente.
        No importa el orden de las columnas.
      </div>
      <div class="lic-drop-zone" id="licDropZone">
        <div class="lic-drop-icon">📂</div>
        <p>Arrastre el archivo Excel aquí<br><small>o haga clic para seleccionar</small></p>
        <input type="file" id="licFileInput" accept=".xlsx,.xls,.csv" style="display:none"
          onchange="licLeerExcel(this.files[0])">
      </div>
      <div id="licExcelPreview" style="display:none"></div>
    </div>
  `;

  // Drag & drop
  const dz = document.getElementById('licDropZone');
  dz.addEventListener('click', () => document.getElementById('licFileInput').click());
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('dragover');
    const f = e.dataTransfer.files[0];
    if (f) licLeerExcel(f);
  });
}

function licTab(tab) {
  document.querySelectorAll('.lic-tab').forEach(b => b.classList.remove('activo'));
  document.getElementById('panelPegar').style.display  = tab==='pegar' ? '' : 'none';
  document.getElementById('panelExcel').style.display  = tab==='excel' ? '' : 'none';
  document.getElementById(`tab${tab.charAt(0).toUpperCase()+tab.slice(1)}`).classList.add('activo');
}

// ── PARSEAR TEXTO LIBRE ───────────────────────────────────────
function licAnalizarTexto() {
  const texto = document.getElementById('licTexto').value.trim();
  if (!texto) return toast('Ingrese el listado de actividades', 'error');
  const items = licParsearTexto(texto);
  if (!items.length) return toast('No se detectaron actividades en el texto', 'error');
  licEnviarAnalisis(items);
}

function licParsearTexto(texto) {
  const lineas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const items  = [];
  const reRomano = /^(I{1,3}|IV|V|VI{0,3}|IX|X{1,2}|XI{0,3}|XIV|XV|XVI{0,3}|XIX|XX)\s*[.\-:)]/i;
  const reNumCap = /^(\d{1,2})\s*[.\-:)]\s+[A-ZÁÉÍÓÚ]{4}/;  // 1. PRELIMINARES

  for (const linea of lineas) {
    if (!linea) continue;
    const tabs  = linea.split('\t');
    const upper = linea.toUpperCase();

    // Detectar módulo: romano, número punto + MAYUS, o línea toda mayúsculas sin números al inicio
    const esMódulo =
      reRomano.test(linea) ||
      reNumCap.test(linea) ||
      (linea === linea.toUpperCase() && linea.length > 5 && !/^\d/.test(linea) && !linea.includes('\t'));

    if (esMódulo) {
      items.push({tipo:'modulo', descripcion: linea.replace(/^[IVXivx\d]+\s*[.\-:)]\s*/, '').trim() || linea});
      continue;
    }

    // Parsear actividad — puede venir con tabs (código, desc, unidad, cantidad)
    if (tabs.length >= 2) {
      // Formato tabular
      let codigo='', descripcion='', unidad='', cantidad=1;
      // Detectar cuál columna es qué
      const cols = tabs.map(c=>c.trim()).filter(c=>c);
      // Heurísticas: código corto al inicio, cantidad numérica al final
      const posNum = cols.map((c,i)=>({v:c,i})).filter(x=>!isNaN(parseFloat(x.v)) && isFinite(x.v));
      const posCod = cols[0] && cols[0].length <= 10 && /^[A-Z0-9.\-]+$/i.test(cols[0]) ? 0 : -1;

      if (posCod >= 0) codigo = cols[0];
      if (posNum.length) cantidad = parseFloat(posNum[posNum.length-1].v);

      // Descripción = columna más larga que no sea número ni código
      const descCols = cols.filter((_,i)=> i !== posCod && isNaN(parseFloat(_)));
      descripcion = descCols.reduce((a,b)=>b.length>a.length?b:a, '');

      // Unidad: columna corta antes del número
      const antesNum = posNum.length ? cols.slice(0, posNum[posNum.length-1].i) : cols;
      const posUnid  = antesNum.findIndex(c => c.length<=5 && c.length>=1 && /^[A-Za-z\/]+$/.test(c) && c !== descripcion);
      if (posUnid >= 0) unidad = antesNum[posUnid];

      if (descripcion) items.push({tipo:'actividad', codigo, descripcion, unidad, cantidad});
    } else {
      // Texto libre sin tabs — toda la línea es descripción
      // Extraer posible código al inicio (ej: "001 EXCAVACION...")
      const mCod = linea.match(/^([A-Z0-9.\-]{2,10})\s+(.+)/i);
      if (mCod) {
        items.push({tipo:'actividad', codigo:mCod[1].trim(), descripcion:mCod[2].trim(), unidad:'', cantidad:1});
      } else {
        items.push({tipo:'actividad', codigo:'', descripcion:linea, unidad:'', cantidad:1});
      }
    }
  }
  return items;
}

// ── LEER EXCEL ────────────────────────────────────────────────
async function licLeerExcel(file) {
  if (!file) return;
  const prev = document.getElementById('licExcelPreview');
  prev.style.display = '';
  prev.innerHTML = '<div class="loading-msg">Leyendo Excel…</div>';

  try {
    const buffer = await file.arrayBuffer();
    const data   = new Uint8Array(buffer);

    // Usar SheetJS si disponible
    if (typeof XLSX !== 'undefined') {
      const wb  = XLSX.read(data, {type:'array'});
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
      licProcesarFilasExcel(raw);
    } else {
      // Fallback: leer CSV con coma o punto y coma
      const text = new TextDecoder('utf-8').decode(data);
      const sep  = text.includes('\t') ? '\t' : text.includes(';') ? ';' : ',';
      const rows = text.split('\n').map(r => r.split(sep).map(c => c.replace(/^"|"$/g,'').trim()));
      licProcesarFilasExcel(rows);
    }
  } catch(e) {
    prev.innerHTML = `<div class="error-msg">Error al leer el archivo: ${e.message}</div>`;
  }
}

function licProcesarFilasExcel(rows) {
  if (!rows.length) return;
  const prev = document.getElementById('licExcelPreview');

  // Detectar fila de encabezados (primera fila con texto)
  let headerRow = -1;
  const keywords = ['descripcion','actividad','item','codigo','unidad','cantidad','und'];
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const r = rows[i].map(c=>String(c).toLowerCase());
    if (keywords.some(k => r.some(c => c.includes(k)))) { headerRow = i; break; }
  }

  // Mapear columnas
  let colCod=-1, colDesc=-1, colUnid=-1, colCant=-1;
  if (headerRow >= 0) {
    rows[headerRow].forEach((h,i) => {
      const hh = String(h).toLowerCase();
      if (hh.includes('cod') || hh.includes('item') || hh==='no.' || hh==='#') colCod = i;
      if (hh.includes('desc') || hh.includes('actividad') || hh.includes('obra')) colDesc = i;
      if (hh.includes('unid') || hh==='und' || hh==='u') colUnid = i;
      if (hh.includes('cant') || hh.includes('metrado') || hh.includes('vol')) colCant = i;
    });
  }

  // Si no detectó columnas, usar heurística por ancho
  if (colDesc < 0) {
    const dataRow = rows[headerRow >= 0 ? headerRow+1 : 0] || [];
    colDesc = dataRow.reduce((maxI,c,i) => String(c).length > String(dataRow[maxI]||'').length ? i : maxI, 0);
  }

  // Parsear filas de datos
  const startRow = headerRow >= 0 ? headerRow+1 : 0;
  const items = [];
  const reRomano = /^(I{1,3}|IV|V|VI{0,3}|IX|X{1,2})\s*[.\-:)]/i;

  for (let i = startRow; i < rows.length; i++) {
    const row  = rows[i];
    const desc = String(colDesc >= 0 ? row[colDesc] : row.join(' ')).trim();
    if (!desc || desc.length < 2) continue;

    const esMódulo = reRomano.test(desc) ||
      (desc === desc.toUpperCase() && desc.length > 4 && !/^\d/.test(desc));

    if (esMódulo) {
      items.push({tipo:'modulo', descripcion: desc.replace(/^[IVXivx\d]+\s*[.\-:)]\s*/,'').trim()||desc});
    } else {
      items.push({
        tipo:        'actividad',
        codigo:      colCod >= 0 ? String(row[colCod]||'').trim() : '',
        descripcion: desc,
        unidad:      colUnid >= 0 ? String(row[colUnid]||'').trim() : '',
        cantidad:    colCant >= 0 ? parseFloat(row[colCant])||1 : 1,
      });
    }
  }

  const nActs = items.filter(x=>x.tipo==='actividad').length;
  const nCaps = items.filter(x=>x.tipo==='modulo').length;

  prev.innerHTML = `
    <div class="lic-excel-ok">
      ✅ Archivo leído: <strong>${nCaps} módulos</strong> y <strong>${nActs} actividades</strong> detectadas.
      <button class="btn btn-orange" style="margin-left:12px" onclick="licEnviarAnalisis(window._licItems)">
        Analizar lista →
      </button>
    </div>`;
  window._licItems = items;
}

// ── ENVIAR A BACKEND PARA ANÁLISIS ───────────────────────────
async function licEnviarAnalisis(items) {
  const box = document.getElementById('lic-content');
  box.innerHTML = '<div class="loading-msg">Analizando actividades contra la base de datos…</div>';
  try {
    const data = await api.post('/api/licitacion/analizar', {items});
    mostrarPaso2(data);
  } catch(e) {
    box.innerHTML = `<div class="error-msg">Error: ${e.error||e.message}</div>`;
  }
}

// ══════════════════════════════════════════════════════════════
//  PASO 2 — Revisión y confirmación
// ══════════════════════════════════════════════════════════════
function mostrarPaso2(data) {
  const box  = document.getElementById('lic-content');
  const {items, stats} = data;
  window._licResultado = items;

  const pctHall = stats.total > 0 ? Math.round(stats.halladas/stats.total*100) : 0;

  const filas = items.map((item, idx) => {
    if (item.tipo === 'modulo') {
      return `<tr class="lic-row-cap">
        <td colspan="7" class="lic-cap-cell">▸ ${item.descripcion}</td>
      </tr>`;
    }

    const estado = item.encontrada
      ? `<span class="lic-badge lic-ok">✅ En BD</span>`
      : item.similares?.length
        ? `<span class="lic-badge lic-warn">⚠ Similares</span>`
        : `<span class="lic-badge lic-no">❌ No existe</span>`;

    const selectSimilar = item.similares?.length && !item.encontrada ? `
      <select class="lic-similar-sel" data-idx="${idx}" onchange="licAsignarSimilar(${idx},this.value)" style="font-size:11px;max-width:220px">
        <option value="">— Seleccionar similar —</option>
        ${item.similares.map(s=>`<option value="${s.id_actividad}">[${s.codigo}] ${s.descripcion.slice(0,45)} (${s.unidad})</option>`).join('')}
      </select>` : '';

    const costoFmt = item.costo_total
      ? `L ${item.costo_total.toLocaleString('es-HN',{minimumFractionDigits:2})}`
      : '<span style="opacity:.4">—</span>';

    return `<tr data-idx="${idx}" class="${item.encontrada?'lic-row-ok':item.similares?.length?'lic-row-warn':'lic-row-no'}">
      <td style="text-align:center">
        <input type="checkbox" class="lic-chk" data-idx="${idx}"
          ${item.encontrada||item.id_actividad?'checked':''} onchange="licToggleItem(${idx},this.checked)">
      </td>
      <td style="font-size:11px;opacity:.6">${item.codigo||'—'}</td>
      <td style="font-size:12px">${item.descripcion}</td>
      <td style="text-align:center;font-size:12px">${item.unidad||'—'}</td>
      <td><input type="number" class="lic-cant-input" data-idx="${idx}" min="0" step="0.01"
        value="${item.cantidad||1}" style="width:72px" onchange="licActualizarCant(${idx},this.value)"></td>
      <td>${estado}${selectSimilar}</td>
      <td style="text-align:right;font-size:12px">${costoFmt}</td>
    </tr>`;
  }).join('');

  box.innerHTML = `
    <div class="lic-pasos">
      <div class="lic-paso done">1. Ingresar lista</div>
      <div class="lic-paso activo">2. Revisar y confirmar</div>
      <div class="lic-paso">3. Importar al presupuesto</div>
    </div>

    <!-- RESUMEN ESTADÍSTICO -->
    <div class="lic-stats-row">
      <div class="lic-stat lic-stat-total">
        <div class="lic-stat-num">${stats.total}</div>
        <div class="lic-stat-lbl">Actividades totales</div>
      </div>
      <div class="lic-stat lic-stat-ok">
        <div class="lic-stat-num">${stats.halladas}</div>
        <div class="lic-stat-lbl">✅ Encontradas en BD</div>
      </div>
      <div class="lic-stat lic-stat-no">
        <div class="lic-stat-num">${stats.faltantes}</div>
        <div class="lic-stat-lbl">❌ No existen en BD</div>
      </div>
      <div class="lic-stat lic-stat-pct">
        <div class="lic-stat-num">${pctHall}%</div>
        <div class="lic-stat-lbl">Cobertura</div>
        <div class="lic-pct-bar"><div class="lic-pct-fill" style="width:${pctHall}%"></div></div>
      </div>
    </div>

    <!-- TOOLBAR -->
    <div class="lic-toolbar">
      <div class="btn-group">
        <button class="btn btn-secondary" onclick="mostrarPaso1()">← Volver</button>
        <button class="btn btn-secondary" onclick="licSelTodos(true)">☑ Seleccionar todos</button>
        <button class="btn btn-secondary" onclick="licSelTodos(false)">☐ Deseleccionar faltantes</button>
        <button class="btn btn-secondary" onclick="licExportarFaltantes()">📥 Exportar faltantes</button>
      </div>
      <button class="btn btn-orange" onclick="mostrarPaso3()">Continuar → Importar al presupuesto</button>
    </div>

    <!-- TABLA DE REVISIÓN -->
    <div class="table-wrap">
      <table class="data-table lic-tabla">
        <thead><tr>
          <th style="width:36px;text-align:center">✓</th>
          <th style="width:80px">Código</th>
          <th>Descripción del cartel</th>
          <th style="width:60px;text-align:center">Unid.</th>
          <th style="width:80px">Cantidad</th>
          <th style="width:200px">Estado / Asignar</th>
          <th style="width:120px;text-align:right">Costo Unit. (L)</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>

    ${stats.faltantes > 0 ? `
    <div class="lic-faltantes-nota">
      <strong>⚠ ${stats.faltantes} actividades no encontradas.</strong>
      Use la columna "Asignar" para vincularlas a una actividad similar de la BD,
      o expórtelas para crearlas después en el módulo de Actividades.
    </div>` : ''}
  `;
}

function licToggleItem(idx, checked) {
  window._licResultado[idx]._incluir = checked;
}

function licActualizarCant(idx, val) {
  window._licResultado[idx].cantidad = parseFloat(val)||1;
}

function licAsignarSimilar(idx, idActividad) {
  if (!idActividad) return;
  const item = window._licResultado[idx];
  item.id_actividad = parseInt(idActividad);
  item.encontrada   = true;
  // Marcar checkbox
  const chk = document.querySelector(`.lic-chk[data-idx="${idx}"]`);
  if (chk) chk.checked = true;
  toast('Actividad asignada ✓','success');
}

function licSelTodos(todos) {
  document.querySelectorAll('.lic-chk').forEach(chk => {
    const idx  = parseInt(chk.dataset.idx);
    const item = window._licResultado[idx];
    if (!item) return;
    const marcar = todos ? true : !!item.encontrada;
    chk.checked = marcar;
    item._incluir = marcar;
  });
}

function licExportarFaltantes() {
  const items = window._licResultado || [];
  const falt  = items.filter(i => i.tipo==='actividad' && !i.encontrada && !i.id_actividad);
  if (!falt.length) { toast('No hay actividades faltantes','info'); return; }

  const lines = ['Código\tDescripción\tUnidad\tCantidad'];
  falt.forEach(i => lines.push(`${i.codigo||''}\t${i.descripcion}\t${i.unidad||''}\t${i.cantidad||1}`));

  const blob = new Blob(['\uFEFF'+lines.join('\n')], {type:'text/tab-separated-values;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download='Actividades_Faltantes.xls'; a.click();
  URL.revokeObjectURL(url);
  toast(`${falt.length} actividades exportadas`, 'success');
}

// ══════════════════════════════════════════════════════════════
//  PASO 3 — Seleccionar presupuesto e importar
// ══════════════════════════════════════════════════════════════
async function mostrarPaso3() {
  // Leer estado actual de checkboxes del DOM antes de avanzar
  document.querySelectorAll('.lic-chk').forEach(chk => {
    const idx = parseInt(chk.dataset.idx);
    if (window._licResultado[idx]) window._licResultado[idx]._incluir = chk.checked;
  });
  document.querySelectorAll('.lic-cant-input').forEach(inp => {
    const idx = parseInt(inp.dataset.idx);
    if (window._licResultado[idx]) window._licResultado[idx].cantidad = parseFloat(inp.value)||1;
  });

  const box = document.getElementById('lic-content');
  box.innerHTML = '<div class="loading-msg">Cargando presupuestos…</div>';

  try {
    const presupuestos = await api.get('/api/licitacion/presupuestos');
    const items        = window._licResultado || [];
    const incluidas    = items.filter(i => i.tipo==='actividad' && (i._incluir||i.encontrada||i.id_actividad));
    const faltantes    = items.filter(i => i.tipo==='actividad' && !i.encontrada && !i.id_actividad);

    const opts = presupuestos.map(p =>
      `<option value="${p.id_presupuesto}">${p.nombre}</option>`
    ).join('');

    box.innerHTML = `
      <div class="lic-pasos">
        <div class="lic-paso done">1. Ingresar lista</div>
        <div class="lic-paso done">2. Revisar y confirmar</div>
        <div class="lic-paso activo">3. Importar al presupuesto</div>
      </div>

      <div class="lic-resumen-final">
        <div class="lic-rf-item">
          <span class="lic-rf-num lic-ok-color">${incluidas.length}</span>
          <span>actividades a importar</span>
        </div>
        <div class="lic-rf-item">
          <span class="lic-rf-num lic-no-color">${faltantes.length}</span>
          <span>quedarán sin importar (no existen en BD)</span>
        </div>
      </div>

      <div class="seg-section" style="max-width:560px">
        <div class="seg-section-header"><span>Seleccionar presupuesto destino</span></div>
        <div style="padding:1.25rem">
          <div class="field-group">
            <label>Presupuesto existente</label>
            <select id="licPresDest" style="width:100%">${opts}</select>
          </div>
          <p style="font-size:12px;opacity:.5;margin:.5rem 0">
            Los módulos y actividades se agregarán al final del presupuesto seleccionado.
          </p>
        </div>
      </div>

      <div class="btn-group" style="margin-top:1rem">
        <button class="btn btn-secondary" onclick="mostrarPaso2(window._licDataPaso2)">← Volver</button>
        <button class="btn btn-orange" onclick="licEjecutarImport()">
          ✅ Importar ${incluidas.length} actividades al presupuesto
        </button>
      </div>

      ${faltantes.length ? `
      <div class="lic-faltantes-nota" style="margin-top:1rem">
        <strong>${faltantes.length} actividades no se importarán</strong> por no existir en la BD.
        Puede crearlas en <strong>Catálogos → Actividades / CU</strong> y luego importar nuevamente.
        <button class="btn btn-secondary" style="margin-left:12px;font-size:12px"
          onclick="licExportarFaltantes()">📥 Exportar lista de faltantes</button>
      </div>` : ''}
    `;

    // Guardar para poder volver al paso 2
    window._licDataPaso2 = {items, stats: window._licStatsCache};
  } catch(e) {
    box.innerHTML = `<div class="error-msg">Error: ${e.error||e.message}</div>`;
  }
}

async function licEjecutarImport() {
  const id_presupuesto = parseInt(document.getElementById('licPresDest').value);
  if (!id_presupuesto) return toast('Seleccione un presupuesto','error');

  const items = (window._licResultado||[]).map(item => ({
    tipo:         item.tipo,
    descripcion:  item.descripcion,
    id_actividad: item.id_actividad || null,
    cantidad:     item.cantidad || 1,
    incluir:      item.tipo==='modulo' ? true : !!(item._incluir !== false && (item.encontrada||item.id_actividad)),
  }));

  try {
    const r = await api.post('/api/licitacion/importar', {id_presupuesto, items});
    const box = document.getElementById('lic-content');
    box.innerHTML = `
      <div class="lic-exito">
        <div class="lic-exito-icon">✅</div>
        <h2>Importación completada</h2>
        <p><strong>${r.agregadas}</strong> actividades agregadas al presupuesto.</p>
        ${r.omitidas ? `<p style="opacity:.6">${r.omitidas} actividades omitidas (no encontradas en BD o deseleccionadas).</p>` : ''}
        <div class="btn-group" style="justify-content:center;margin-top:1.5rem">
          <button class="btn btn-secondary" onclick="renderLicitacion()">Nueva importación</button>
          <button class="btn btn-orange" onclick="navigateTo('presupuestos')">Ver presupuestos →</button>
        </div>
      </div>`;
    toast('Importación exitosa ✓','success');
  } catch(e) { toast(e.error||'Error al importar','error'); }
}
