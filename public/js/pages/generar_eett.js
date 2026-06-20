// ══════════════════════════════════════════════════════════
//  MÓDULO: GENERADOR AUTOMÁTICO DE ESPECIFICACIONES TÉCNICAS
// ══════════════════════════════════════════════════════════

let _genCorriendo  = false;
let _genTotal      = 0;
let _genOk         = 0;
let _genErr        = 0;
let _genOffset     = 0;
const _GEN_LOTE    = 8;

async function renderGenerarEett(ctx = {}) {
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">GENERADOR DE ESPECIFICACIONES TÉCNICAS</div>
        <div class="page-subtitle">Crea automáticamente fichas técnicas para actividades sin especificación</div>
      </div>
    </div>

    <div class="page-body">

      <!-- API Key -->
      <div class="card" style="margin-bottom:16px;border-left:4px solid var(--orange)">
        <div class="card-body" style="padding:14px 18px">
          <div style="font-size:12px;font-weight:700;color:var(--blue);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">
            🔑 API Key de Anthropic (requerida)
          </div>
          <div style="display:flex;gap:10px;align-items:center">
            <input type="password" id="genApiKey"
              placeholder="sk-ant-api03-..."
              style="flex:1;padding:9px 12px;border:1.5px solid #d4dbe3;border-radius:4px;font-size:13px;font-family:monospace" />
            <button class="btn btn-secondary btn-sm" onclick="toggleApiKeyVis()">👁</button>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:6px">
            La API key se usa solo localmente y nunca se almacena. Obténgala en
            <a href="https://console.anthropic.com" target="_blank" style="color:var(--blue)">console.anthropic.com</a>
          </div>
        </div>
      </div>

      <!-- Stats -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
        <div class="stat-card">
          <div class="stat-value" id="genStatTotal" style="color:var(--blue)">—</div>
          <div class="stat-label">Pendientes</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="genStatOk" style="color:#1A7A3C">0</div>
          <div class="stat-label">Generadas</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="genStatErr" style="color:var(--red)">0</div>
          <div class="stat-label">Errores</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="genStatPct" style="color:var(--orange)">0%</div>
          <div class="stat-label">Progreso</div>
        </div>
      </div>

      <!-- Barra de progreso -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-body" style="padding:12px 18px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-size:12px;font-weight:600;color:var(--blue)" id="genStatusMsg">Listo para iniciar</span>
            <span style="font-size:11px;color:var(--text-muted)" id="genLoteMsg"></span>
          </div>
          <div style="background:#e8ecf0;border-radius:4px;height:10px;overflow:hidden">
            <div id="genBarra" style="background:var(--blue);height:100%;width:0%;transition:width .3s;border-radius:4px"></div>
          </div>
        </div>
      </div>

      <!-- Botones -->
      <div style="display:flex;gap:10px;margin-bottom:16px">
        <button class="btn btn-primary" id="btnGenIniciar" onclick="genIniciar()">▶ Iniciar generación</button>
        <button class="btn btn-secondary" id="btnGenStop" style="display:none" onclick="genDetener()">⏸ Detener</button>
        <button class="btn btn-secondary" onclick="cargarStatsPendientes()">↺ Actualizar conteo</button>
        <button class="btn btn-secondary" onclick="navigateTo('especificaciones')">← Ver especificaciones</button>
      </div>

      <!-- Log -->
      <div class="card">
        <div class="card-header" style="padding:8px 16px;display:flex;justify-content:space-between;align-items:center">
          <span class="card-title" style="font-size:11px">REGISTRO DE ACTIVIDAD</span>
          <button class="btn btn-secondary btn-sm" onclick="limpiarLog()">Limpiar</button>
        </div>
        <div id="genLog"
          style="font-family:monospace;font-size:12px;padding:12px 16px;max-height:400px;overflow-y:auto;background:#fafafa;line-height:1.7">
          <span style="color:var(--text-muted)">Presione "Iniciar generación" para comenzar...</span>
        </div>
      </div>

    </div>`;

  await cargarStatsPendientes();
}

async function cargarStatsPendientes() {
  try {
    const data = await api.get('/api/generar-eett/pendientes?limit=1&offset=0');
    _genTotal = data.total;
    document.getElementById('genStatTotal').textContent = _genTotal.toLocaleString();
  } catch(e) {
    logGen('Error cargando pendientes: ' + (e.error || e), 'error');
  }
}

function toggleApiKeyVis() {
  const inp = document.getElementById('genApiKey');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function logGen(msg, tipo = 'info') {
  const log = document.getElementById('genLog');
  if (!log) return;
  const colores = { info: '#025196', ok: '#1A7A3C', error: '#c0392b', warn: '#e09820' };
  const prefijos = { info: 'ℹ', ok: '✓', error: '✗', warn: '⚠' };
  const hora = new Date().toLocaleTimeString('es-HN');
  log.innerHTML += `<div style="color:${colores[tipo]||'#333'};border-bottom:1px solid #eee;padding:2px 0">
    <span style="color:#aaa">${hora}</span>  ${prefijos[tipo]||''} ${msg}
  </div>`;
  log.scrollTop = log.scrollHeight;
}

function limpiarLog() {
  const log = document.getElementById('genLog');
  if (log) log.innerHTML = '';
}

function actualizarUI() {
  const procesadas = _genOk + _genErr;
  const pct = _genTotal ? Math.round((procesadas / _genTotal) * 100) : 0;
  document.getElementById('genStatOk').textContent  = _genOk.toLocaleString();
  document.getElementById('genStatErr').textContent = _genErr.toLocaleString();
  document.getElementById('genStatPct').textContent = pct + '%';
  document.getElementById('genBarra').style.width   = pct + '%';
  const pend = Math.max(0, _genTotal - procesadas);
  document.getElementById('genStatTotal').textContent = pend.toLocaleString();
}

function genDetener() {
  _genCorriendo = false;
  logGen('Generación detenida por el usuario.', 'warn');
}

async function genIniciar() {
  const apiKey = document.getElementById('genApiKey')?.value?.trim();
  if (!apiKey) { toast('Ingrese su API key de Anthropic primero', 'error'); return; }
  if (!apiKey.startsWith('sk-ant')) { toast('La API key debe comenzar con "sk-ant-..."', 'error'); return; }
  if (_genCorriendo) return;

  _genCorriendo = true;
  _genOk  = 0;
  _genErr = 0;
  _genOffset = 0;

  document.getElementById('btnGenIniciar').style.display = 'none';
  document.getElementById('btnGenStop').style.display    = '';
  limpiarLog();
  logGen(`Iniciando generación. Total pendientes: ${_genTotal.toLocaleString()}`, 'info');

  while (_genCorriendo) {
    // Obtener lote de actividades pendientes
    let lote;
    try {
      const data = await api.get(`/api/generar-eett/pendientes?limit=${_GEN_LOTE}&offset=0`);
      lote = data.rows;
      if (!lote || lote.length === 0) {
        logGen('✅ No quedan actividades pendientes. ¡Generación completada!', 'ok');
        break;
      }
    } catch(e) {
      logGen('Error obteniendo pendientes: ' + (e.error || e), 'error');
      break;
    }

    const codigos = lote.map(a => a.codigo).join(', ');
    document.getElementById('genLoteMsg').textContent = `Procesando: ${codigos}`;
    logGen(`Lote: ${codigos}`, 'info');

    try {
      const resp = await api.post('/api/generar-eett/generar-lote', {
        actividades: lote,
        apiKey
      });
      _genOk += resp.insertadas || 0;
      logGen(`  ✓ ${resp.insertadas}/${lote.length} fichas insertadas correctamente`, 'ok');
      if (resp.fichas) {
        resp.fichas.slice(0,3).forEach(f => {
          logGen(`    → ${f.codigo}: ${f.nombre.substring(0,60)}`, 'info');
        });
      }
    } catch(e) {
      _genErr += lote.length;
      logGen(`  ✗ Error: ${e.error || e.message || e}`, 'error');
      // Si es error de API key, detener
      if ((e.error || '').includes('api') || (e.error || '').includes('auth')) {
        logGen('API key inválida o sin créditos. Deteniendo.', 'error');
        break;
      }
    }

    actualizarUI();
    await cargarStatsPendientes();

    // Pausa entre lotes
    await new Promise(r => setTimeout(r, 500));
  }

  _genCorriendo = false;
  document.getElementById('btnGenIniciar').style.display = '';
  document.getElementById('btnGenStop').style.display    = 'none';
  document.getElementById('genLoteMsg').textContent      = '';
  document.getElementById('genStatusMsg').textContent    = `Completado: ${_genOk} generadas, ${_genErr} errores`;
  actualizarUI();
  await cargarStatsPendientes();
  logGen(`Proceso finalizado. Generadas: ${_genOk} | Errores: ${_genErr}`, _genErr > 0 ? 'warn' : 'ok');
}
