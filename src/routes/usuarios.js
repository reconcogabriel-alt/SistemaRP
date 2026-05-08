const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { getDb, saveDb } = require('../db/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Todos los endpoints requieren autenticación
router.use(requireAuth);

// ── GET /api/usuarios — lista todos (solo admin) ──
router.get('/', requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const result = db.exec(`
      SELECT id_usuario, nombre, correo, rol, activo, fecha_creacion
      FROM usuarios
      ORDER BY fecha_creacion DESC
    `);
    if (!result.length) return res.json([]);
    const [{ columns, values }] = result;
    const usuarios = values.map(row => {
      const obj = {};
      columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    });
    res.json(usuarios);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/usuarios — crear usuario (solo admin) ──
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { nombre, correo, contrasena, rol } = req.body;
    if (!nombre || !correo || !contrasena) {
      return res.status(400).json({ error: 'Nombre, correo y contraseña son requeridos' });
    }
    const rolesValidos = ['admin', 'ingeniero', 'consulta'];
    if (rol && !rolesValidos.includes(rol)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }
    const db = await getDb();
    const existe = db.exec(`SELECT id_usuario FROM usuarios WHERE correo = ?`, [correo]);
    if (existe.length && existe[0].values.length) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
    }
    const hash = await bcrypt.hash(contrasena, 10);
    db.run(
      `INSERT INTO usuarios (nombre, correo, contrasena_hash, rol, activo) VALUES (?, ?, ?, ?, 1)`,
      [nombre.trim(), correo.trim().toLowerCase(), hash, rol || 'ingeniero']
    );
    saveDb();
    const nuevo = db.exec(
      `SELECT id_usuario, nombre, correo, rol, activo, fecha_creacion FROM usuarios WHERE correo = ?`,
      [correo.trim().toLowerCase()]
    );
    const [{ columns, values }] = nuevo;
    const obj = {};
    columns.forEach((col, i) => obj[col] = values[0][i]);
    res.status(201).json(obj);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/usuarios/me/password — cambiar propia contraseña ──
// IMPORTANTE: esta ruta debe ir ANTES de /:id para que no sea capturada por ella
router.put('/me/password', async (req, res) => {
  try {
    const { actual, nueva } = req.body;
    if (!actual || !nueva) return res.status(400).json({ error: 'Se requieren ambas contraseñas' });
    if (nueva.length < 6) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    const db = await getDb();
    const result = db.exec(`SELECT contrasena_hash FROM usuarios WHERE id_usuario = ?`, [req.session.userId]);
    if (!result.length || !result[0].values.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    const hash = result[0].values[0][0];
    const valid = await bcrypt.compare(actual, hash);
    if (!valid) return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    const nuevoHash = await bcrypt.hash(nueva, 10);
    db.run(`UPDATE usuarios SET contrasena_hash = ? WHERE id_usuario = ?`, [nuevoHash, req.session.userId]);
    saveDb();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/usuarios/:id — editar usuario (solo admin) ──
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, correo, rol, contrasena } = req.body;
    const db = await getDb();
    const existe = db.exec(`SELECT id_usuario, rol FROM usuarios WHERE id_usuario = ?`, [id]);
    if (!existe.length || !existe[0].values.length) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const rolActual = existe[0].values[0][1];
    if (rolActual === 'admin' && rol && rol !== 'admin') {
      const admins = db.exec(`SELECT COUNT(*) as c FROM usuarios WHERE rol = 'admin' AND activo = 1`);
      if (admins[0].values[0][0] <= 1) {
        return res.status(400).json({ error: 'No se puede cambiar el rol del único administrador activo' });
      }
    }
    if (correo) {
      const dup = db.exec(`SELECT id_usuario FROM usuarios WHERE correo = ? AND id_usuario != ?`, [correo.trim().toLowerCase(), id]);
      if (dup.length && dup[0].values.length) {
        return res.status(409).json({ error: 'Ese correo ya está en uso por otro usuario' });
      }
    }
    const sets = [];
    const params = [];
    if (nombre)     { sets.push('nombre = ?');  params.push(nombre.trim()); }
    if (correo)     { sets.push('correo = ?');  params.push(correo.trim().toLowerCase()); }
    if (rol)        { sets.push('rol = ?');     params.push(rol); }
    if (contrasena) {
      if (contrasena.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
      const hash = await bcrypt.hash(contrasena, 10);
      sets.push('contrasena_hash = ?');
      params.push(hash);
    }
    if (!sets.length) return res.status(400).json({ error: 'Sin datos para actualizar' });
    params.push(id);
    db.run(`UPDATE usuarios SET ${sets.join(', ')} WHERE id_usuario = ?`, params);
    saveDb();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PATCH /api/usuarios/:id/activo — activar/desactivar (solo admin) ──
router.patch('/:id/activo', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { activo } = req.body;
    const db = await getDb();
    if (!activo) {
      const usuario = db.exec(`SELECT rol FROM usuarios WHERE id_usuario = ?`, [id]);
      if (usuario.length && usuario[0].values.length) {
        if (usuario[0].values[0][0] === 'admin') {
          const admins = db.exec(`SELECT COUNT(*) FROM usuarios WHERE rol = 'admin' AND activo = 1`);
          if (admins[0].values[0][0] <= 1) {
            return res.status(400).json({ error: 'No se puede desactivar el único administrador activo' });
          }
        }
      }
    }
    db.run(`UPDATE usuarios SET activo = ? WHERE id_usuario = ?`, [activo ? 1 : 0, id]);
    saveDb();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/usuarios/:id — eliminar (solo admin) ──
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (parseInt(id) === req.session.userId) {
      return res.status(400).json({ error: 'No puede eliminar su propia cuenta' });
    }
    const db = await getDb();
    const usuario = db.exec(`SELECT rol FROM usuarios WHERE id_usuario = ?`, [id]);
    if (usuario.length && usuario[0].values.length) {
      if (usuario[0].values[0][0] === 'admin') {
        const admins = db.exec(`SELECT COUNT(*) FROM usuarios WHERE rol = 'admin'`);
        if (admins[0].values[0][0] <= 1) {
          return res.status(400).json({ error: 'No se puede eliminar el único administrador del sistema' });
        }
      }
    }
    db.run(`DELETE FROM usuarios WHERE id_usuario = ?`, [id]);
    saveDb();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
