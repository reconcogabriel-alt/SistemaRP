const express = require('express');
const router  = express.Router();
const { getDb, saveDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

// GET /api/configuracion — devuelve todas las claves como objeto { clave: valor }
router.get('/', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const r  = db.exec('SELECT clave, valor, descripcion FROM configuracion_sistema ORDER BY clave');
    const cfg = {};
    if (r.length && r[0].values.length) {
      r[0].values.forEach(([clave, valor, desc]) => {
        cfg[clave] = { valor, descripcion: desc };
      });
    }
    res.json(cfg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/configuracion — actualiza múltiples claves { clave: valor, ... }
router.put('/', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const updates = req.body; // { empresa_nombre: "...", reporte_mostrar_fecha: "0", ... }
    for (const [clave, valor] of Object.entries(updates)) {
      db.run(
        `INSERT INTO configuracion_sistema (clave, valor, fecha_modificacion)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor, fecha_modificacion=excluded.fecha_modificacion`,
        [clave, String(valor)]
      );
    }
    saveDb();
    res.json({ ok: true, actualizadas: Object.keys(updates).length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
