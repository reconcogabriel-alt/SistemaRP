const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { getDb, saveDb } = require('../db/database');

router.post('/login', async (req, res) => {
  try {
    const { correo, contrasena } = req.body;
    const db = await getDb();

    const result = db.exec(`SELECT id_usuario, nombre, correo, contrasena_hash, rol FROM usuarios WHERE correo = ?`, [correo]);
    
    if (!result.length || !result[0].values.length) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    
    const [id, nombre, email, hash, rol] = result[0].values[0];
    const valid = await bcrypt.compare(contrasena, hash);
    
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });
    
    req.session.userId = id;
    req.session.nombre = nombre;
    req.session.rol = rol;
    
    res.json({ ok: true, nombre, rol });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'No autenticado' });
  res.json({ id: req.session.userId, nombre: req.session.nombre, rol: req.session.rol });
});

module.exports = router;
