let isAuthenticated = false;

const api = {
  async get(url) {
    const r = await fetch(url, { credentials: 'include' });
    if (r.status === 401) {
      if (isAuthenticated) { isAuthenticated = false; showLogin(); }
      throw {error:'No autorizado'};
    }
    if (!r.ok) throw await r.json();
    return r.json();
  },
  async post(url, data) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    if (!r.ok) throw await r.json();
    return r.json();
  },
  async put(url, data) {
    const r = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    if (!r.ok) throw await r.json();
    return r.json();
  },
  async del(url) {
    const r = await fetch(url, { method: 'DELETE', credentials: 'include' });
    if (!r.ok) throw await r.json();
    return r.json();
  },
  async patch(url, data) {
    const r = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    if (!r.ok) throw await r.json();
    return r.json();
  },
  async delete(url) {
    const r = await fetch(url, { method: 'DELETE', credentials: 'include' });
    if (!r.ok) throw await r.json();
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

function showModal(title, html, cls = '') {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = html;
  document.getElementById('modalBox').className = `modal ${cls}`;
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function hideModal() {
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
