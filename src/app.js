const express = require('express');
const session = require('express-session');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'costos-unitarios-hn-2025',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 8 * 60 * 60 * 1000,
    sameSite: 'lax',
    secure: false   // false = funciona con HTTP y HTTPS detrás de proxy Coolify
  }
}));

// ── Rutas API (ANTES del static para que no sean interceptadas) ──
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/insumos',     require('./routes/insumos'));
app.use('/api/actividades', require('./routes/actividades'));
app.use('/api/proyectos',   require('./routes/proyectos'));
app.use('/api/presupuestos',require('./routes/presupuestos'));
app.use('/api/centros',      require('./routes/centros'));
app.use('/api/reportes',    require('./routes/reportes'));
app.use('/api/catalogos',        require('./routes/catalogos'));
app.use('/api/especificaciones',        require('./routes/especificaciones'));
app.use('/api/actualizacion-precios',  require('./routes/actualizacion_precios'));
app.use('/api/plantillas',            require('./routes/plantillas'));
app.use('/api/bodega',                require('./routes/bodega'));
app.use('/api/usuarios',              require('./routes/usuarios'));

// 404 explícito para /api/* no registradas
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Ruta API no encontrada: ${req.method} ${req.path}` });
});

// ── Archivos estáticos ─────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// ── SPA fallback para rutas del cliente ───────────────────
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Iniciar
const { getDb } = require('./db/database');
getDb().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Sistema de Costos Unitarios corriendo en http://localhost:${PORT}`);
    console.log(`   Usuario: admin@costos.hn | Clave: admin123`);
  });
}).catch(e => { console.error('Error iniciando BD:', e); process.exit(1); });
