const express = require('express');
const router = express.Router();
const pool = require('../db');
const verificarToken = require('../middleware/auth');

// Ruta protegida: cupones del usuario autenticado
router.get('/mis-cupones', verificarToken, async (req, res) => {
  try {
    const [cupones] = await pool.query(`
      SELECT 
        cupones_usuarios.id,
        cupones.titulo,
        cupones.descripcion,
        cupones.descuento,
        cupones.fecha_expiracion,
        cupones_usuarios.utilizado,
        cupones_usuarios.fecha_compra,
        comercios.nombre AS comercio
      FROM cupones_usuarios
      JOIN cupones ON cupones_usuarios.cupon_id = cupones.id
      JOIN usuarios AS comercios ON cupones.comercio_id = comercios.id
      WHERE cupones_usuarios.usuario_id = ?
    `, [req.user.id]);

    res.json(cupones);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener cupones del usuario' });
  }
});

// Eliminar un cupón utilizado manualmente
router.delete('/cupon-usuario/:id', verificarToken, async (req, res) => {
  const usuarioId = req.user.id;
  const cuponUsuarioId = req.params.id;

  try {
    const [result] = await pool.query(
      'DELETE FROM cupones_usuarios WHERE id = ? AND usuario_id = ? AND utilizado = 1',
      [cuponUsuarioId, usuarioId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Cupón no encontrado o no puede eliminarse' });
    }

    res.json({ mensaje: 'Cupón eliminado correctamente' });
  } catch (error) {
    console.error("❌ Error al eliminar cupón:", error);
    res.status(500).json({ error: 'Error del servidor al eliminar el cupón' });
  }
});

router.post('/canjear-codigo', verificarToken, async (req, res) => {
  const { codigo } = req.body;
  const usuarioId = req.user.id;

  try {
    // Verificar si el código existe y no ha sido usado
    const [rows] = await pool.query('SELECT * FROM codigos WHERE codigo = ? AND usado = 0', [codigo]);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Código inválido o ya usado' });
    }

    const codigoData = rows[0];
    const grupoId = codigoData.grupo_id;

    // Obtener cupones de ese grupo
    const [cupones] = await pool.query('SELECT * FROM cupones WHERE grupo_id = ?', [grupoId]);

    // Asignar cupones al usuario
    for (let cupon of cupones) {
      await pool.query(
        'INSERT INTO cupones_usuarios (cupon_id, usuario_id, utilizado) VALUES (?, ?, 0)',
        [cupon.id, usuarioId]
      );
    }

    // Marcar el código como usado
    await pool.query('UPDATE codigos SET usado = 1, usado_por = ? WHERE id = ?', [usuarioId, codigoData.id]);

    res.json({ message: 'Cupones asignados correctamente', cupones: cupones.length });
  } catch (err) {
    console.error('Error al canjear código:', err);
    res.status(500).json({ error: 'Error interno al canjear código' });
  }
});




// ✅ Esto es lo que faltaba
module.exports = router;

