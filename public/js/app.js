// ============ APP ROUTER ============

// Mapa de páginas — lazy lookup para evitar errores si una función no carga
const pageMap = {
  dashboard:            () => renderDashboard,
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
  requisiciones:        () => renderRequisiciones,
  movimientos:          () => renderMovimientos,
  clientes:             () => renderClientes,
  usuarios:             () => renderUsuarios,
  seguimiento:          () => renderSeguimiento,
  licitacion:           () => renderLicitacion,
  documentacion:        () => renderDocumentacion,
  bitacora:             () => renderBitacora,
  configuracion:        () => renderConfiguracion,
  valuaciones:          () => renderValuaciones,
  planilla:             () => renderPlanilla,
  adm_dashboard:        () => renderAdmDashboard,
  proveedores:          () => renderProveedores,
  ordenes_compra:       () => renderOrdenesCompra,
  cuentas_pagar:        () => renderCuentasPagar,
  tareo:                () => renderTareo,
};

// Mapa página → grupo al que pertenece
const pageGroupMap = {
  dashboard:            'costos_ppto',
  presupuestos:         'costos_ppto',
  centros:              'costos_ppto',
  licitacion:           'costos_ppto',
  actividades:         'costos_ppto',
  insumos:             'costos_ppto',
  catalogos:           'costos_ppto',
  especificaciones:    'costos_ppto',
  actualizacion_precios:'costos_ppto',
  reportes:            'costos_ppto',
  seguimiento:         'costos_ppto',
  clientes:             'admin',
  usuarios:             'admin',
  configuracion:        'admin',
  valuaciones:             'costos_ppto',
  planilla:             'costos_ppto',
  adm_dashboard:        'adm_fin',
  proveedores:          'adm_fin',
  ordenes_compra:       'adm_fin',
  bodega:               'adm_fin',
  requisiciones:        'adm_fin',
  movimientos:          'adm_fin',
  cuentas_pagar:        'adm_fin',
  tareo:                'adm_fin',
  documentacion:             'costos_ppto',
  bitacora:             'costos_ppto',
};

let currentPage = 'dashboard';

// ============ GRUPOS DESPLEGABLES ============

function toggleGroup(groupId, forceOpen) {
  const header = document.querySelector(`.nav-group-header[data-group="${groupId}"]`);
  const body   = document.getElementById(`group-${groupId}`);
  if (!header || !body) return;

  const shouldOpen = forceOpen !== undefined ? forceOpen : !header.classList.contains('open');
  header.classList.toggle('open', shouldOpen);
  body.classList.toggle('open', shouldOpen);
}

// Mapa página → sub-grupo colapsable
const pageSubgroupMap = {
  presupuestos:          'gestion',
  centros:               'gestion',
  licitacion:            'gestion',
  actividades:           'catalogos_precios',
  insumos:               'catalogos_precios',
  catalogos:             'catalogos_precios',
  especificaciones:      'catalogos_precios',
  actualizacion_precios: 'catalogos_precios',
  valuaciones:           'ejecucion',
  seguimiento:           'ejecucion',
  bitacora:              'ejecucion',
  documentacion:         'ejecucion',
  reportes:              'reportes_cp',
};

function toggleSubgroup(subId, forceOpen) {
  const header = document.querySelector(`.nav-subgroup-header[data-subgroup="${subId}"]`);
  const body   = document.getElementById(`subgroup-${subId}`);
  if (!header || !body) return;
  const shouldOpen = forceOpen !== undefined ? forceOpen : !header.classList.contains('open');
  header.classList.toggle('open', shouldOpen);
  body.classList.toggle('open', shouldOpen);
}

function openGroupForPage(page) {
  const group = pageGroupMap[page];
  if (group) toggleGroup(group, true);
  const sub = pageSubgroupMap[page];
  if (sub) toggleSubgroup(sub, true);
}

// ============ NAVEGACIÓN ============

function navigateTo(page, ctx = {}) {
  currentPage = page;

  // Marcar activo en nav
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // Abrir el grupo correspondiente si aplica
  openGroupForPage(page);

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
  // Mostrar sección Administración solo para admin
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = user.rol === 'admin' ? '' : 'none';
  });
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

// Delegación dinámica — nav-item (páginas)
document.addEventListener('click', (e) => {
  // Toggle de grupo desplegable
  const groupHeader = e.target.closest('.nav-group-header');
  if (groupHeader) {
    e.preventDefault();
    toggleGroup(groupHeader.dataset.group);
    return;
  }

  // Toggle de sub-grupo colapsable
  const subHeader = e.target.closest('.nav-subgroup-header');
  if (subHeader) {
    e.preventDefault();
    toggleSubgroup(subHeader.dataset.subgroup);
    return;
  }

  // Navegación a página
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
