const express = require('express');
const router = express.Router();
const pool = require('../db');
const verificarToken = require('../middleware/auth');

// ✅ GET: Cupones disponibles (autenticado)
router.get('/cupones', verificarToken, async (req, res) => {
  try {
    const [cupones] = await pool.query(
      `SELECT cupones.id, cupones.titulo, cupones.descripcion, cupones.descuento, cupones.fecha_expiracion, comercios.nombre AS comercio
       FROM cupones
       JOIN comercios ON cupones.comercio_id = comercios.id
       WHERE cupones.fecha_expiracion > CURDATE()`
    );
    res.json(cupones);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener cupones' });
  }
});

// ✅ POST: Comprar un cupón (cliente autenticado)
router.post('/comprar/:id', verificarToken, async (req, res) => {
  const cuponId = req.params.id;
  const usuarioId = req.user.id;

  try {
    // Verifica si ya lo compró
    const [yaComprado] = await pool.query(
      'SELECT * FROM cupones_usuarios WHERE usuario_id = ? AND cupon_id = ?',
      [usuarioId, cuponId]
    );

    if (yaComprado.length > 0) {
      return res.status(400).json({ error: 'Ya compraste este cupón' });
    }

    // Insertar compra
    await pool.query(
      'INSERT INTO cupones_usuarios (usuario_id, cupon_id) VALUES (?, ?)',
      [usuarioId, cuponId]
    );

    res.json({ message: 'Cupón comprado exitosamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al comprar cupón' });
  }
});

module.exports = router;
