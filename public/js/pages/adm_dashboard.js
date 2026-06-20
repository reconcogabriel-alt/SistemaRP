/* ============================================================
   PANEL FINANCIERO — Administración / Financiero
   ============================================================ */

async function renderAdmDashboard() {
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">🏦 Panel Financiero</h2>
        <p class="page-sub">Resumen ejecutivo de compras, cuentas y nómina</p>
      </div>
      <button class="btn btn-secondary" onclick="renderAdmDashboard()">🔄 Actualizar</button>
    </div>
    <div id="admKpis" class="dashboard-grid" style="margin-bottom:24px">
      <div class="kpi-card"><div class="kpi-label">Cargando...</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card">
        <div class="card-header"><h3 class="card-title">📋 Órdenes de Compra por Estado</h3></div>
        <div id="admOcEstado" class="card-body"></div>
      </div>
      <div class="card">
        <div class="card-header"><h3 class="card-title">💰 Gastos por Categoría</h3></div>
        <div id="admGasCat" class="card-body"></div>
      </div>
    </div>`;

  try {
    const d = await api.get('/api/admin-financiero/dashboard');
    const cp = d.cuentas_pagar || {};

    // KPIs
    const kpis = [
      { icon:'💸', label:'Por Pagar (Saldo)', valor: fmtL(cp.total_saldo||0), color:'var(--danger)' },
      { icon:'✅', label:'Total Pagado', valor: fmtL(cp.total_pagado||0), color:'var(--success)' },
      { icon:'⚠️', label:'Facturas Vencidas', valor: cp.vencidas||0, color: (cp.vencidas||0)>0?'var(--danger)':'var(--success)' },
      { icon:'🤝', label:'Proveedores Activos', valor: d.proveedores_activos||0, color:'var(--primary)' },
      { icon:'👷', label:'Trabajadores', valor: d.trabajadores_activos||0, color:'var(--primary)' },
      { icon:'📅', label:'Nómina Mes Actual', valor: fmtL(d.nomina_mes_actual||0), color:'var(--orange)' },
    ];

    document.getElementById('admKpis').innerHTML = kpis.map(k => `
      <div class="kpi-card">
        <div class="kpi-icon" style="font-size:1.6rem">${k.icon}</div>
        <div class="kpi-valor" style="color:${k.color}">${typeof k.valor==='number'?k.valor:k.valor}</div>
        <div class="kpi-label">${k.label}</div>
      </div>`).join('');

    // OC por estado
    const estados = { borrador:'📝', pendiente:'⏳', aprobada:'✅', recibida_parcial:'📦', recibida_total:'✔️', anulada:'❌' };
    const ocHtml = (d.oc_por_estado||[]).length
      ? `<table class="data-table">
          <thead><tr><th>Estado</th><th class="num">OCs</th><th class="num">Monto Total (L)</th></tr></thead>
          <tbody>${(d.oc_por_estado||[]).map(r => `
            <tr>
              <td>${estados[r.estado]||''} ${r.estado}</td>
              <td class="num">${r.count}</td>
              <td class="num">${fmtL(r.monto)}</td>
            </tr>`).join('')}
          </tbody></table>`
      : '<p class="empty-msg">Sin órdenes de compra registradas.</p>';
    document.getElementById('admOcEstado').innerHTML = ocHtml;

    // Gastos por categoría
    const cats = { materiales:'🧱', mano_obra:'👷', subcontrato:'🔧', equipo:'🚜', administrativo:'📋', otro:'📌' };
    const gasHtml = (d.gastos_por_categoria||[]).length
      ? `<table class="data-table">
          <thead><tr><th>Categoría</th><th class="num">Total Facturado (L)</th></tr></thead>
          <tbody>${(d.gastos_por_categoria||[]).map(r => `
            <tr>
              <td>${cats[r.categoria]||''} ${r.categoria.replace('_',' ')}</td>
              <td class="num"><strong>${fmtL(r.total)}</strong></td>
            </tr>`).join('')}
          </tbody></table>`
      : '<p class="empty-msg">Sin cuentas registradas.</p>';
    document.getElementById('admGasCat').innerHTML = gasHtml;

  } catch(e) {
    document.getElementById('admKpis').innerHTML = `<p class="error-msg">Error: ${e.message}</p>`;
  }
}

function fmtL(n) {
  return 'L ' + (parseFloat(n)||0).toLocaleString('es-HN', {minimumFractionDigits:2, maximumFractionDigits:2});
}
