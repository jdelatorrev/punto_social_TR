const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { enviarCorreo } = require('../mailer'); // <- Agregado
require('dotenv').config();

// 🔐 Registro
router.post('/register', async (req, res) => {
  const { nombre, email, password, tipo } = req.body;

  if (!nombre || !email || !password || !tipo) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  const tiposPermitidos = ['cliente', 'comercio', 'admin'];
  if (!tiposPermitidos.includes(tipo)) {
    return res.status(400).json({ error: 'Tipo de usuario no válido' });
  }

  try {
    const [usuarioExistente] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (usuarioExistente.length > 0) {
      return res.status(409).json({ error: 'El correo ya está registrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO usuarios (nombre, email, password, tipo, telefono, vendedor_id) VALUES (?, ?, ?, ?, ?, ?)',
      [nombre, email, hashedPassword, tipo, req.body.telefono, req.body.vendedor_id]
    );

    res.status(201).json({ message: 'Usuario registrado con éxito' });
  } catch (err) {
    console.error('Error al registrar:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 🔑 Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Datos incompletos' });

  try {
    const [usuarios] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (usuarios.length === 0) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const usuario = usuarios[0];
    const coincide = await bcrypt.compare(password, usuario.password);
    if (!coincide) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const token = jwt.sign({
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      tipo: usuario.tipo
    }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.json({ token });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno al iniciar sesión' });
  }
});

// 🧠 Olvidé contraseña
router.post('/olvide-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido' });

  try {
    const [usuarios] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (usuarios.length === 0) {
      return res.status(404).json({ error: 'No se encontró una cuenta con ese correo' });
    }

    const usuario = usuarios[0];
    const token = crypto.randomBytes(32).toString('hex');

    // ✅ Fecha de expiración en formato MySQL DATETIME
    const ahora = new Date();
    const expiracionDate = new Date(ahora.getTime() + 15 * 60 * 1000); // +15 minutos
    const expiracion = expiracionDate.toISOString().slice(0, 19).replace('T', ' ');

    console.log('🧪 Guardando expiración:', expiracion);

    await pool.query(`
      UPDATE usuarios SET reset_token = ?, reset_expira = ? WHERE id = ?
    `, [token, expiracion, usuario.id]);

    const link = `http://localhost:5500/frontend/reestablecer.html?token=${token}`;

    await enviarCorreo(
      email,
      'Restablecer tu contraseña',
      `
        <p>Hola ${usuario.nombre},</p>
        <p>Recibimos una solicitud para restablecer tu contraseña.</p>
        <p><a href="${link}">Hacé clic acá para restablecerla</a></p>
        <p>Este enlace expirará en 15 minutos.</p>
      `
    );

    res.json({ message: 'Enlace enviado. Revisá tu correo.' });
  } catch (err) {
    console.error('❌ Error en olvide-password:', err);
    res.status(500).json({ error: 'Error interno al generar enlace de recuperación' });
  }
});


// 🔐 Restablecer contraseña
router.post('/reestablecer-password/:token', async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Contraseña requerida' });
  }

  try {
    const [usuarios] = await pool.query(`
      SELECT * FROM usuarios WHERE reset_token = ? AND reset_expira > NOW()
    `, [token]);

    if (usuarios.length === 0) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(`
      UPDATE usuarios SET password = ?, reset_token = NULL, reset_expira = NULL WHERE id = ?
    `, [hashedPassword, usuarios[0].id]);

    res.json({ message: 'Contraseña restablecida correctamente' });
  } catch (err) {
    console.error('Error al restablecer contraseña:', err);
    res.status(500).json({ error: 'Error interno al actualizar la contraseña' });
  }
});


module.exports = router;
