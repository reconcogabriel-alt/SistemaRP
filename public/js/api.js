let isAuthenticated = false;

// Construye un Error real a partir de una respuesta fetch no-ok, con ambas
// propiedades .message y .error pobladas (compatibilidad con los dos patrones
// usados en public/js/pages/*.js: unos hacen toast(e.message,...) y otros
// toast(e.error,...) — antes de este fix, throw await r.json() lanzaba un
// objeto plano {error:"..."} sin .message, por lo que toast(e.message)
// siempre mostraba literalmente "undefined" en cualquier endpoint que fallara).
async function throwApiError(r) {
  let data = {};
  try { data = await r.json(); } catch (_) { /* respuesta sin JSON válido */ }
  const msg = data.error || data.message || `Error ${r.status}`;
  const err = new Error(msg);
  err.error = msg;
  err.status = r.status;
  err.data = data;
  throw err;
}

const api = {
  async get(url) {
    const r = await fetch(url, { credentials: 'include' });
    if (r.status === 401) {
      if (isAuthenticated) { isAuthenticated = false; showLogin(); }
      const err = new Error('No autorizado');
      err.error = 'No autorizado';
      err.status = 401;
      throw err;
    }
    if (!r.ok) await throwApiError(r);
    return r.json();
  },
  async post(url, data) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    if (!r.ok) await throwApiError(r);
    return r.json();
  },
  async put(url, data) {
    const r = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    if (!r.ok) await throwApiError(r);
    return r.json();
  },
  async del(url) {
    const r = await fetch(url, { method: 'DELETE', credentials: 'include' });
    if (!r.ok) await throwApiError(r);
    return r.json();
  },
  async patch(url, data) {
    const r = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    if (!r.ok) await throwApiError(r);
    return r.json();
  },
  async delete(url) {
    const r = await fetch(url, { method: 'DELETE', credentials: 'include' });
    if (!r.ok) await throwApiError(r);
    return r.json();
  }
};

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${icons[type]}</span> ${msg}`;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function showModal(titleOrId, html, cls = '') {
  // Sistema "por ID": módulos (OC, Cuentas por Pagar, Proveedores, Tareo) tienen su
  // propio <div id="..." class="modal-overlay hidden"> ya en el DOM y solo pasan el ID.
  if (html === undefined) {
    const el = document.getElementById(titleOrId);
    if (el && el.classList.contains('modal-overlay')) {
      el.classList.remove('hidden');
      return;
    }
  }
  // Sistema genérico (viejo): un solo modal compartido con título + html dinámico.
  document.getElementById('modalTitle').textContent = titleOrId;
  document.getElementById('modalBody').innerHTML = html;
  document.getElementById('modalBox').className = `modal ${cls}`;
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function hideModal(id) {
  if (id) {
    const el = document.getElementById(id);
    if (el && el.classList.contains('modal-overlay')) {
      el.classList.add('hidden');
      return;
    }
  }
  document.getElementById('modalOverlay').classList.add('hidden');
}

function fmt(n, decimals = 2) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('es-HN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtCurrency(n, moneda = 'L') {
  return `${moneda} ${fmt(n)}`;
}

function sanitize(str) {
  if (!str) return '';
  return str.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function catClass(cat) {
  return 'cat-' + (cat || '').replace(/\s/g, '');
}
