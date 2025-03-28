const express = require('express');
const router = express.Router();
const pool = require('../db');
const verificarToken = require('../middleware/verificarToken');

// Middleware para restringir solo a admins
function soloAdmin(req, res, next) {
  if (req.user.tipo !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
}

// 🔹 Obtener todos los usuarios (para seleccionar comercios)
router.get('/usuarios', verificarToken, soloAdmin, async (req, res) => {
  const [usuarios] = await pool.query('SELECT id, nombre, email, tipo FROM usuarios');
  res.json(usuarios);
});

// 🔹 Obtener todos los grupos de cupones
router.get('/grupos', verificarToken, soloAdmin, async (req, res) => {
  const [grupos] = await pool.query('SELECT id, nombre, descripcion, precio FROM grupos');
  res.json(grupos);
});

// 🔹 Crear un nuevo grupo
router.post('/grupos', verificarToken, soloAdmin, async (req, res) => {
  const { nombre, descripcion, precio } = req.body;
  if (!nombre || isNaN(precio)) return res.status(400).json({ error: 'Faltan datos' });

  try {
    const [resultado] = await pool.query(
      'INSERT INTO grupos (nombre, descripcion, precio) VALUES (?, ?, ?)',
      [nombre, descripcion || '', precio]
    );
    res.json({ message: 'Grupo creado', id: resultado.insertId });
  } catch (err) {
    console.error('Error al crear grupo:', err);
    res.status(500).json({ error: 'Error interno al crear grupo' });
  }
});

// 🔹 Obtener todos los cupones
router.get('/cupones', verificarToken, soloAdmin, async (req, res) => {
  const [cupones] = await pool.query(`
    SELECT c.id, c.titulo, c.descripcion, c.descuento, c.fecha_expiracion,
           u.nombre AS comercio, c.comercio_id,
           g.nombre AS grupo, g.descripcion AS grupo_descripcion, c.grupo_id
    FROM cupones c
    JOIN usuarios u ON c.comercio_id = u.id
    LEFT JOIN grupos g ON c.grupo_id = g.id
    ORDER BY c.grupo_id ASC, c.fecha_expiracion DESC
  `);
  res.json(cupones);
});

// 🔹 Crear un nuevo cupón
router.post('/crear-cupon', verificarToken, soloAdmin, async (req, res) => {
  const { titulo, descripcion, descuento, fecha_expiracion, comercio_id, grupo_id } = req.body;

  if (!titulo || !descripcion || !descuento || !fecha_expiracion || !comercio_id || !grupo_id) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  try {
    await pool.query(
      `INSERT INTO cupones (titulo, descripcion, descuento, fecha_expiracion, comercio_id, grupo_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [titulo, descripcion, descuento, fecha_expiracion, comercio_id, grupo_id]
    );
    res.json({ message: 'Cupón creado correctamente' });
  } catch (err) {
    console.error('Error al crear cupón:', err);
    res.status(500).json({ error: 'Error interno al crear cupón' });
  }
});

// 🔹 Editar cupón
router.put('/cupones/:id', verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;
  const { titulo, descripcion, descuento, fecha_expiracion, comercio_id, grupo_id } = req.body;

  if (!titulo || !descripcion || !descuento || !fecha_expiracion || !comercio_id || !grupo_id) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  try {
    const [resultado] = await pool.query(
      `UPDATE cupones
       SET titulo = ?, descripcion = ?, descuento = ?, fecha_expiracion = ?, comercio_id = ?, grupo_id = ?
       WHERE id = ?`,
      [titulo, descripcion, descuento, fecha_expiracion, comercio_id, grupo_id, id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Cupón no encontrado' });
    }

    res.json({ message: 'Cupón actualizado correctamente' });
  } catch (err) {
    console.error('Error al editar cupón:', err);
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

// 🔹 Eliminar cupón
router.delete('/cupones/:id', verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [resultado] = await pool.query(`DELETE FROM cupones WHERE id = ?`, [id]);
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Cupón no encontrado' });
    }
    res.json({ message: 'Cupón eliminado' });
  } catch (err) {
    console.error('Error al eliminar cupón:', err);
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

// 🔹 Marcar cupón como utilizado
router.post('/marcar-utilizado/:id', verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [resultado] = await pool.query(`
      UPDATE cupones_usuarios SET utilizado = true WHERE id = ?
    `, [id]);

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Cupón no encontrado o ya usado' });
    }

    res.json({ message: 'Cupón marcado como utilizado' });
  } catch (err) {
    console.error('Error al marcar cupón como usado:', err);
    res.status(500).json({ error: 'Error interno al marcar como utilizado' });
  }
});

// 🔹 Habilitar cupón utilizado
router.post('/habilitar-cupon/:id', verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const [resultado] = await pool.query(`
      UPDATE cupones_usuarios SET utilizado = false WHERE id = ?
    `, [id]);

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Cupón no encontrado' });
    }

    res.json({ message: 'Cupón reactivado' });
  } catch (err) {
    console.error('Error al habilitar cupón:', err);
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

// 🔹 Reporte de cupones vendidos
router.get('/reporte-cupones', verificarToken, soloAdmin, async (req, res) => {
  try {
    const [reporte] = await pool.query(`
      SELECT 
        cupones_usuarios.id,
        cupones.titulo AS cupon,
        cupones.descripcion,
        cupones.descuento,
        cupones_usuarios.utilizado,
        cupones_usuarios.fecha_compra,
        usuarios.nombre AS cliente,
        comercios.nombre AS comercio
      FROM cupones_usuarios
      JOIN cupones ON cupones_usuarios.cupon_id = cupones.id
      JOIN usuarios ON cupones_usuarios.usuario_id = usuarios.id
      JOIN usuarios AS comercios ON cupones.comercio_id = comercios.id
    `);
    res.json(reporte);
  } catch (err) {
    console.error('Error al obtener el reporte:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 🔄 Actualizar descripción de grupo
router.put('/grupos/:id', verificarToken, soloAdmin, async (req, res) => {
  const { descripcion, precio } = req.body;
  const { id } = req.params;

  if (!descripcion || isNaN(precio)) {
    return res.status(400).json({ error: "Descripción y precio son obligatorios" });
  }

  try {
    await pool.query("UPDATE grupos SET descripcion = ?, precio = ? WHERE id = ?", [descripcion, precio, id]);
    res.json({ message: "Grupo actualizado correctamente" });
  } catch (err) {
    console.error("❌ Error al actualizar grupo:", err);
    res.status(500).json({ error: "Error al actualizar grupo" });
  }
});

module.exports = router;
