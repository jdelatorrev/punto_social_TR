const express = require('express');
const router = express.Router();
const pool = require('../db');
const verificarToken = require('../middleware/auth');

// Ruta protegida: cupones del usuario autenticado
router.get('/mis-cupones', verificarToken, async (req, res) => {
  try {
    const [cupones] = await pool.query(`
      SELECT cupones_usuarios.id, cupones.titulo, cupones.descripcion, cupones.descuento, cupones.fecha_expiracion
      FROM cupones_usuarios
      JOIN cupones ON cupones_usuarios.cupon_id = cupones.id
      WHERE cupones_usuarios.usuario_id = ? AND cupones_usuarios.utilizado = false
    `, [req.user.id]);

    res.json(cupones);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener cupones del usuario' });
  }
});

// ✅ Esto es lo que faltaba
module.exports = router;

