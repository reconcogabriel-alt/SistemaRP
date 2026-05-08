function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  // Siempre JSON para rutas /api/
  return res.status(401).json({ error: 'No autorizado — inicia sesión' });
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.rol === 'admin') return next();
  return res.status(403).json({ error: 'Acceso denegado' });
}

module.exports = { requireAuth, requireAdmin };
