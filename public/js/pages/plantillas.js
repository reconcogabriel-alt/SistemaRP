/* ============================================================
   PLANTILLAS POR FINANCIADOR
   Genera formatos Excel según el financiador del proyecto
   ============================================================ */

async function renderPlantillas() {
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Plantillas por Financiador</h2>
        <p class="page-sub">Genera formatos de presupuesto adaptados a cada organismo financiador</p>
      </div>
    </div>

    <div class="plantillas-grid">
      <!-- Panel izquierdo: Configuración -->
      <div class="card plantillas-config">
        <div class="card-header">
          <span class="card-icon">🏦</span>
          <h3>Configuración de Plantilla</h3>
        </div>
        <div class="card-body">

          <!-- Selección de presupuesto -->
          <div class="field-group">
            <label>Presupuesto de origen</label>
            <select id="plSelectPresupuesto">
              <option value="">— Cargando presupuestos... —</option>
            </select>
          </div>
          <div id="plInfoPresupuesto" class="info-box hidden"></div>

          <!-- Selección de financiador -->
          <div class="field-group">
            <label>Organismo Financiador</label>
            <div id="plFinanciadores" class="fin-grid">
              <!-- Tarjetas de financiadores -->
            </div>
          </div>

          <!-- Tipo de cambio (solo si aplica) -->
          <div id="plTcSection" class="field-group hidden">
            <label>Tipos de Cambio Referenciales</label>
            <div class="tc-row">
              <div>
                <label class="sub-label">L / USD</label>
                <input type="number" id="plTcUSD" value="25.00" step="0.01" min="1">
              </div>
              <div id="plTcEURDiv" class="hidden">
                <label class="sub-label">L / EUR</label>
                <input type="number" id="plTcEUR" value="27.50" step="0.01" min="1">
              </div>
            </div>
          </div>

          <!-- Opciones adicionales -->
          <div class="field-group">
            <label>Opciones</label>
            <label class="checkbox-label">
              <input type="checkbox" id="plIncluirDesglose" checked>
              Incluir hoja de desglose de insumos
            </label>
          </div>

          <button id="btnGenerarPlantilla" class="btn-primary btn-full" disabled>
            <span>📥 Generar Plantilla Excel</span>
          </button>
          <p id="plEstado" class="form-hint" style="text-align:center;margin-top:8px;"></p>
        </div>
      </div>

      <!-- Panel derecho: Información de financiadores -->
      <div class="card plantillas-info">
        <div class="card-header">
          <span class="card-icon">ℹ️</span>
          <h3>Características por Financiador</h3>
        </div>
        <div class="card-body">
          <div id="plFinInfo" class="fin-info-display">
            <p class="hint-center">← Selecciona un financiador para ver sus características</p>
          </div>
        </div>
      </div>
    </div>
  `;

  await plCargarDatos();
  plBindEvents();
}

let plFinanciadores = [];
let plPresupuestos  = [];
let plFinSeleccionado = null;

async function plCargarDatos() {
  try {
    [plFinanciadores, plPresupuestos] = await Promise.all([
      api.get('/api/plantillas/financiadores'),
      api.get('/api/plantillas/presupuestos')
    ]);

    // Poblar select de presupuestos
    const sel = document.getElementById('plSelectPresupuesto');
    sel.innerHTML = '<option value="">— Seleccione un presupuesto —</option>';
    plPresupuestos.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id_presupuesto;
      opt.textContent = `${p.proyecto_nombre} › ${p.nombre || 'Sin nombre'} — L ${fmtNum(p.total_general)}`;
      sel.appendChild(opt);
    });

    // Renderizar tarjetas de financiadores
    const grid = document.getElementById('plFinanciadores');
    grid.innerHTML = plFinanciadores.map(f => `
      <div class="fin-card" data-id="${f.id}" onclick="plSeleccionarFin('${f.id}')">
        <div class="fin-badge" style="background:${f.color};">${f.sigla}</div>
        <div class="fin-label">${f.sigla}</div>
      </div>
    `).join('');

  } catch(e) {
    toast('Error cargando datos de plantillas', 'error');
  }
}

const FIN_INFO = {
  FHIS: {
    desc: 'Fondo Hondureño de Inversión Social',
    color: '#003087',
    cols: 'N° | Código | Descripción | Unidad | Cantidad | P.Unitario | Monto Total',
    moneda: 'Lempiras (HNL)',
    notas: ['Formato estándar BID/FHIS para Honduras', 'Incluye sección de resumen de costos', 'Compatible con formularios de oferta FHIS']
  },
  BCIE: {
    desc: 'Banco Centroamericano de Integración Económica',
    color: '#00703C',
    cols: 'Item | Código | Descripción | Unidad | Cant. | P.U. (L) | P.U. (USD) | Total (L) | Total (USD)',
    moneda: 'Doble moneda: HNL y USD',
    notas: ['Requiere tipo de cambio L/USD', 'Columnas paralelas HNL/USD', 'Contrato BCIE con referencia BCH']
  },
  BID: {
    desc: 'Banco Interamericano de Desarrollo',
    color: '#0057A8',
    cols: 'No. | Código | Descripción | U/M | Metrado | P.Unit. | Parcial | % del Total',
    moneda: 'Lempiras (HNL)',
    notas: ['Incluye columna de porcentaje del total', 'Formato FOMIN/BID', 'Resumen completo con % indirectos y utilidad']
  },
  JICA: {
    desc: 'Japan International Cooperation Agency',
    color: '#8B0000',
    cols: 'No. | Code | Description | Unit | Quantity | Unit Price (L) | Amount (L) | Remarks',
    moneda: 'Lempiras (HNL) — encabezados en inglés',
    notas: ['Bill of Quantities (BOQ) en inglés', 'Compatible con Grant Aid JICA', 'Columna Remarks para observaciones']
  },
  KFW: {
    desc: 'Kreditanstalt für Wiederaufbau',
    color: '#004B87',
    cols: 'Pos. | Código | Descripción | Ud. | Cant. | P.U. (€) | P.U. (L) | Total (L) | Total (€)',
    moneda: 'Doble moneda: HNL y EUR',
    notas: ['Requiere tipo de cambio L/EUR', 'Formato Leistungsverzeichnis alemán', 'Resumen con equivalente en Euros']
  },
  SANAA: {
    desc: 'Servicio Autónomo Nacional de Acueductos y Alcantarillados',
    color: '#025196',
    cols: 'N° | Código | Descripción | Unidad | Cantidad | P.Unitario | Total',
    moneda: 'Lempiras (HNL)',
    notas: ['Formato estándar SANAA Honduras', 'Para proyectos de agua y saneamiento', 'Compatible con normativa técnica SANAA/CONASA']
  }
};

function plSeleccionarFin(id) {
  plFinSeleccionado = id;

  // Marcar activo
  document.querySelectorAll('.fin-card').forEach(c => {
    c.classList.toggle('active', c.dataset.id === id);
  });

  // Mostrar info
  const info = FIN_INFO[id];
  if (!info) return;

  const el = document.getElementById('plFinInfo');
  el.innerHTML = `
    <div class="fin-detail">
      <div class="fin-detail-header" style="background:${info.color};">
        <h4>${id} — ${info.desc}</h4>
      </div>
      <div class="fin-detail-body">
        <div class="fin-detail-row">
          <span class="fin-detail-label">Columnas:</span>
          <code class="fin-cols">${info.cols}</code>
        </div>
        <div class="fin-detail-row">
          <span class="fin-detail-label">Moneda:</span>
          <span>${info.moneda}</span>
        </div>
        <div class="fin-detail-row">
          <span class="fin-detail-label">Características:</span>
          <ul class="fin-notas">${info.notas.map(n=>`<li>✓ ${n}</li>`).join('')}</ul>
        </div>
      </div>
    </div>
  `;

  // Mostrar/ocultar tipo de cambio
  const dualMoneda = ['BCIE','KFW'].includes(id);
  const tcSec = document.getElementById('plTcSection');
  const tcEurDiv = document.getElementById('plTcEURDiv');
  tcSec.classList.toggle('hidden', !dualMoneda);
  tcEurDiv.classList.toggle('hidden', id !== 'KFW');

  plVerificarReady();
}

function plVerificarReady() {
  const presOk = document.getElementById('plSelectPresupuesto')?.value;
  const finOk  = plFinSeleccionado;
  const btn    = document.getElementById('btnGenerarPlantilla');
  if (btn) btn.disabled = !(presOk && finOk);
}

function plBindEvents() {
  document.getElementById('plSelectPresupuesto').addEventListener('change', (e) => {
    const id = e.target.value;
    const pres = plPresupuestos.find(p => p.id_presupuesto == id);
    const infoEl = document.getElementById('plInfoPresupuesto');
    if (pres) {
      infoEl.innerHTML = `
        <div class="info-row">
          <span>📁 Proyecto:</span><strong>${pres.proyecto_nombre}</strong>
        </div>
        <div class="info-row">
          <span>💰 Total:</span><strong>L ${fmtNum(pres.total_general)}</strong>
        </div>
        <div class="info-row">
          <span>📅 Fecha:</span><strong>${new Date(pres.fecha_creacion).toLocaleDateString('es-HN')}</strong>
        </div>
      `;
      infoEl.classList.remove('hidden');
    } else {
      infoEl.classList.add('hidden');
    }
    plVerificarReady();
  });

  document.getElementById('btnGenerarPlantilla').addEventListener('click', plGenerar);
}

async function plGenerar() {
  const idPres = document.getElementById('plSelectPresupuesto').value;
  if (!idPres || !plFinSeleccionado) return;

  const btn   = document.getElementById('btnGenerarPlantilla');
  const estado = document.getElementById('plEstado');
  btn.disabled = true;
  btn.innerHTML = '<span>⏳ Generando...</span>';
  estado.textContent = 'Preparando plantilla Excel...';

  try {
    const body = {
      id_presupuesto: parseInt(idPres),
      financiador: plFinSeleccionado,
      tipo_cambio_usd: parseFloat(document.getElementById('plTcUSD').value) || 25.0,
      tipo_cambio_eur: parseFloat(document.getElementById('plTcEUR').value) || 27.5,
      incluir_desglose: document.getElementById('plIncluirDesglose').checked
    };

    const response = await fetch('/api/plantillas/generar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Error generando plantilla');
    }

    const blob = await response.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const cd   = response.headers.get('Content-Disposition') || '';
    const fnMatch = cd.match(/filename="([^"]+)"/);
    a.href = url;
    a.download = fnMatch ? fnMatch[1] : `Plantilla_${plFinSeleccionado}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast(`Plantilla ${plFinSeleccionado} generada exitosamente`, 'success');
    estado.textContent = '✅ Descarga iniciada';
  } catch(e) {
    toast(e.message, 'error');
    estado.textContent = '❌ ' + e.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>📥 Generar Plantilla Excel</span>';
    plVerificarReady();
  }
}

function fmtNum(n) {
  return new Intl.NumberFormat('es-HN', { minimumFractionDigits:2, maximumFractionDigits:2 }).format(n || 0);
}
