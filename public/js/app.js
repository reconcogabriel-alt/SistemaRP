// ============ APP ROUTER ============

// Mapa de páginas — lazy lookup para evitar errores si una función no carga
const pageMap = {
  dashboard:            () => renderDashboard,
  proyectos:            () => renderProyectos,
  presupuestos:         () => renderPresupuestos,
  centros:              () => renderCentros,
  actividades:          () => renderActividades,
  insumos:              () => renderInsumos,
  reportes:             () => renderReportes,
  catalogos:            () => renderCatalogos,
  especificaciones:     () => renderEspecificaciones,
  actualizacion_precios:() => renderActualizacionPrecios,
  plantillas:           () => renderPlantillas,
  bodega:               () => renderBodega,
};

let currentPage = 'dashboard';

function navigateTo(page, ctx = {}) {
  currentPage = page;

  // Marcar activo en nav
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // Resolver función en tiempo de ejecución (lazy)
  const getFn = pageMap[page];
  if (!getFn) { console.warn('Página no registrada:', page); return; }
  try {
    const fn = getFn();
    if (typeof fn === 'function') fn(ctx);
    else console.error('renderFn no es función para página:', page, fn);
  } catch(e) {
    console.error('Error al navegar a', page, e);
  }
}

// ============ AUTH ============

async function checkAuth() {
  try {
    const user = await api.get('/api/auth/me');
    showApp(user);
  } catch {
    showLogin();
  }
}

function showLogin() {
  isAuthenticated = false;
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('appShell').classList.add('hidden');
}

function showApp(user) {
  isAuthenticated = true;
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  document.getElementById('userName').textContent = user.nombre;
  document.getElementById('userRole').textContent = user.rol;
  document.getElementById('userAvatar').textContent = user.nombre[0].toUpperCase();
  navigateTo('dashboard');
}

// ============ EVENT LISTENERS ============

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.textContent = 'Ingresando...';
  btn.disabled = true;
  try {
    const res = await api.post('/api/auth/login', {
      correo: document.getElementById('loginEmail').value,
      contrasena: document.getElementById('loginPass').value
    });
    showApp(res);
  } catch (err) {
    toast(err.error || 'Credenciales incorrectas', 'error');
    btn.textContent = 'INGRESAR AL SISTEMA';
    btn.disabled = false;
  }
});

document.getElementById('btnLogout').addEventListener('click', async () => {
  await api.post('/api/auth/logout', {});
  showLogin();
  toast('Sesión cerrada', 'info');
});

// Delegación dinámica — captura items del nav sin importar cuándo fueron creados
document.addEventListener('click', (e) => {
  const navItem = e.target.closest('.nav-item');
  if (!navItem) return;
  e.preventDefault();
  const page = navItem.dataset.page;
  if (page) navigateTo(page);
});

document.getElementById('modalClose').addEventListener('click', hideModal);
document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modalOverlay')) hideModal();
});

// ============ INIT ============
checkAuth();
