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
  const [grupos] = await pool.query('SELECT id, nombre, descripcion, precio, fecha_inicio, fecha_fin FROM grupos');
  res.json(grupos);
});

// 🔹 Crear un nuevo grupo
router.post('/grupos', verificarToken, soloAdmin, async (req, res) => {
  const { nombre, descripcion, precio, fecha_inicio, fecha_fin } = req.body;
  if (!nombre || isNaN(precio) || !fecha_inicio || !fecha_fin) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  try {
    const [resultado] = await pool.query(
      'INSERT INTO grupos (nombre, descripcion, precio, fecha_inicio, fecha_fin) VALUES (?, ?, ?, ?, ?)',
      [nombre, descripcion || '', precio, fecha_inicio, fecha_fin]
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
      clientes.nombre AS cliente,
      clientes.telefono,
      v.nombre AS vendedor,
      comercios.nombre AS comercio
    FROM cupones_usuarios
    JOIN cupones ON cupones_usuarios.cupon_id = cupones.id
    JOIN usuarios AS clientes ON cupones_usuarios.usuario_id = clientes.id
    JOIN usuarios AS comercios ON cupones.comercio_id = comercios.id
    LEFT JOIN vendedores v ON clientes.vendedor_id = v.id
    `);
    res.json(reporte);
  } catch (err) {
    console.error('Error al obtener el reporte:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 🔄 Actualizar descripción de grupo
router.put('/grupos/:id', verificarToken, soloAdmin, async (req, res) => {
  const { descripcion, precio, fecha_inicio, fecha_fin } = req.body;
  const { id } = req.params;

  if (!descripcion || isNaN(precio)) {
    return res.status(400).json({ error: "Descripción y precio son obligatorios" });
  }

  try {
    await pool.query(`
      UPDATE grupos 
      SET descripcion = ?, precio = ?, fecha_inicio = ?, fecha_fin = ?
      WHERE id = ?
    `, [descripcion, precio, fecha_inicio, fecha_fin, id]);
    res.json({ message: "Grupo actualizado correctamente" });
  } catch (err) {
    console.error("❌ Error al actualizar grupo:", err);
    res.status(500).json({ error: "Error al actualizar grupo" });
  }
});

// 🔹 Obtener todos los vendedores
router.get('/vendedores', verificarToken, soloAdmin, async (req, res) => {
  const [vendedores] = await pool.query('SELECT * FROM vendedores');
  res.json(vendedores);
});

// 🔹 Crear nuevo vendedor
router.post('/vendedores', verificarToken, soloAdmin, async (req, res) => {
  const { nombre, email, telefono } = req.body;
  if (!nombre || !email) return res.status(400).json({ error: "Faltan datos" });

  try {
    const [result] = await pool.query(`
      INSERT INTO vendedores (nombre, email, telefono)
      VALUES (?, ?, ?)`, [nombre, email, telefono]);
      res.json({ message: "Vendedor creado", id: result.insertId });
  } catch (err) {
    console.error("❌ Error al crear vendedor:", err);
    res.status(500).json({ error: "Error al crear vendedor" });
  }
});

// 🔹 Cambiar estado activo/inactivo
router.put('/vendedores/:id/estado', verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;
  const { activo } = req.body;

  try {
    await pool.query("UPDATE vendedores SET activo = ? WHERE id = ?", [activo, id]);
    res.json({ message: "Estado actualizado" });
  } catch (err) {
    console.error("❌ Error al cambiar estado:", err);
    res.status(500).json({ error: "Error al actualizar" });
  }
});

// 🔹 Cambiar vendedor asignado a un cliente
router.put('/clientes/:id/telefono', verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;
  const { telefono } = req.body;

  if (!telefono) {
    return res.status(400).json({ error: 'Teléfono requerido' });
  }

  try {
    await pool.query("UPDATE usuarios SET telefono = ? WHERE id = ?", [telefono, id]);
    res.json({ message: "Teléfono actualizado" });
  } catch (err) {
    console.error("❌ Error al actualizar teléfono:", err);
    res.status(500).json({ error: "Error al actualizar teléfono" });
  }
});

router.put('/vendedores/:id/actualizar', verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;
  const { campo, valor } = req.body;

  const camposPermitidos = ['nombre', 'email', 'telefono'];
  if (!camposPermitidos.includes(campo)) {
    return res.status(400).json({ error: 'Campo no permitido' });
  }

  try {
    await pool.query(`UPDATE vendedores SET ${campo} = ? WHERE id = ?`, [valor, id]);
    res.json({ message: 'Vendedor actualizado' });
  } catch (err) {
    console.error("❌ Error al actualizar vendedor:", err);
    res.status(500).json({ error: 'Error al actualizar vendedor' });
  }
});

// 🔍 Obtener clientes de un vendedor específico
router.get('/vendedores/:id/clientes', verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [clientes] = await pool.query(`
      SELECT id, nombre, email, telefono FROM usuarios
      WHERE tipo = 'cliente' AND vendedor_id = ?
    `, [id]);

    res.json(clientes);
  } catch (err) {
    console.error("❌ Error al obtener clientes:", err);
    res.status(500).json({ error: "Error al obtener clientes del vendedor" });
  }
});


module.exports = router;
