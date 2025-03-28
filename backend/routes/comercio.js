const express = require('express');
const router = express.Router();
const pool = require('../db');
const verificarToken = require('../middleware/auth');

// Ver cupones vendidos de este comercio
router.get('/cupones-vendidos', verificarToken, async (req, res) => {
  try {
    if (req.user.tipo !== 'comercio') {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    const [cupones] = await pool.query(`
      SELECT 
        cupones_usuarios.id,
        cupones.titulo,
        cupones.descripcion,
        cupones.descuento,
        cupones_usuarios.utilizado,
        usuarios.nombre AS cliente
      FROM cupones_usuarios
      JOIN cupones ON cupones_usuarios.cupon_id = cupones.id
      JOIN usuarios ON cupones_usuarios.usuario_id = usuarios.id
      WHERE cupones.comercio_id = ?
    `, [req.user.id]);

    res.json(cupones);
  } catch (err) {
    console.error('Error al obtener cupones vendidos:', err);
    res.status(500).json({ error: 'Error al obtener cupones vendidos' });
  }
});

// Marcar un cupón como usado (comercio)
router.post('/marcar-cupon-usado/:id', verificarToken, async (req, res) => {
  try {
    if (req.user.tipo !== 'comercio') {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    const cuponId = req.params.id;

    // Confirmar que ese cupón pertenece a este comercio
    const [result] = await pool.query(`
      SELECT cupones.id, cupones.comercio_id
      FROM cupones_usuarios
      JOIN cupones ON cupones_usuarios.cupon_id = cupones.id
      WHERE cupones_usuarios.id = ?
    `, [cuponId]);

    if (result.length === 0 || result[0].comercio_id !== req.user.id) {
      return res.status(403).json({ error: 'No autorizado para modificar este cupón' });
    }

    await pool.query(`
      UPDATE cupones_usuarios SET utilizado = true WHERE id = ?
    `, [cuponId]);

    res.json({ message: 'Cupón marcado como usado' });

  } catch (err) {
    console.error('Error al marcar cupón como usado:', err);
    res.status(500).json({ error: 'Error al actualizar cupón' });
  }
});

module.exports = router;
