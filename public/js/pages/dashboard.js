async function renderDashboard() {
  const el = document.getElementById('pageContent');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">DASHBOARD</div>
        <div class="page-subtitle">Resumen del sistema — ${new Date().toLocaleDateString('es-HN', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}</div>
      </div>
    </div>
    <div class="page-body">
      <div class="loading"><div class="spinner"></div> Cargando datos...</div>
    </div>`;

  try {
    const data = await api.get('/api/reportes/dashboard');
    const { stats, presupuestosRecientes, cambiosPrecios } = data;

    el.querySelector('.page-body').innerHTML = `
      <div class="stat-grid">
        <div class="stat-card orange">
          <div class="stat-label">Actividades / CU</div>
          <div class="stat-value">${stats.actividades}</div>
          <div class="stat-bg-icon">◎</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Insumos en Catálogo</div>
          <div class="stat-value">${stats.insumos}</div>
          <div class="stat-bg-icon">◇</div>
        </div>
        <div class="stat-card green">
          <div class="stat-label">Presupuestos</div>
          <div class="stat-value">${stats.presupuestos}</div>
          <div class="stat-bg-icon">▤</div>
        </div>
        <div class="stat-card orange" style="grid-column: span 1">
          <div class="stat-label">Monto Total Presupuestado</div>
          <div class="stat-value" style="font-size:22px">L ${fmt(stats.totalPresup)}</div>
          <div class="stat-bg-icon">₲</div>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Presupuestos Recientes</span>
            <button class="btn btn-primary btn-sm" onclick="navigateTo('presupuestos')">Ver todos</button>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>Presupuesto</th><th>Cliente</th>
                <th>Ubicación</th><th>Monto Total</th><th>Estado</th>
              </tr></thead>
              <tbody>
                ${presupuestosRecientes.length ? presupuestosRecientes.map(p => `
                  <tr>
                    <td><strong>${sanitize(p.nombre)}</strong></td>
                    <td>${sanitize(p.cliente || '—')}</td>
                    <td>${sanitize(p.ubicacion || '—')}</td>
                    <td class="td-monto">L ${fmt(p.monto_total)}</td>
                    <td><span class="badge badge-${p.estado}">${p.estado}</span></td>
                  </tr>`).join('') : 
                  `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">◻</div><div class="empty-title">Sin presupuestos</div></div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">Últimos cambios de precios</span>
          </div>
          <div class="card-body" style="padding: 0">
            ${cambiosPrecios.length ? cambiosPrecios.map(c => {
              const diff = c.precio_nuevo - c.precio_anterior;
              const pct = c.precio_anterior ? ((diff / c.precio_anterior) * 100).toFixed(1) : 0;
              const cls = diff > 0 ? 'price-up' : 'price-down';
              const arrow = diff > 0 ? '↑' : '↓';
              return `
                <div style="padding: 12px 16px; border-bottom: 1px solid var(--gray-light);">
                  <div style="font-size:12px; color:var(--text-muted); margin-bottom:4px">${c.fecha_cambio?.substring(0,10)}</div>
                  <div style="font-weight:600; margin-bottom:4px; font-size:13px">${sanitize(c.descripcion)}</div>
                  <div style="display:flex; align-items:center; gap:10px">
                    <span style="font-size:12px; color:var(--text-muted)">L ${fmt(c.precio_anterior)}</span>
                    <span class="${cls}" style="font-weight:700">${arrow} L ${fmt(c.precio_nuevo)}</span>
                    <span class="${cls}" style="font-size:11px">(${diff > 0 ? '+' : ''}${pct}%)</span>
                  </div>
                </div>`;
            }).join('') : `<div style="padding:24px; text-align:center; color:var(--text-muted); font-size:13px">Sin cambios registrados</div>`}
          </div>
        </div>
      </div>
    `;
  } catch (e) {
    el.querySelector('.page-body').innerHTML = `<div class="empty-state"><div class="empty-icon">✕</div><div class="empty-title">Error cargando dashboard</div><div>${e.error || e}</div></div>`;
  }
}
