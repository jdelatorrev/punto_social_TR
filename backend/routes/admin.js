const express = require('express');
const router = express.Router();
const pool = require('../db');
const verificarToken = require('../middleware/verificarToken');

// Middleware para restringir solo a admins
function soloAdmin(req, res, next) {
  if (!req.user || req.user.tipo !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
}

// ---- USUARIOS ----

router.get('/usuarios', verificarToken, soloAdmin, async (req, res) => {
  const [usuarios] = await pool.query('SELECT id, nombre, email, tipo FROM usuarios');
  res.json(usuarios);
});

// ---- GRUPOS ----

router.get('/grupos', verificarToken, soloAdmin, async (req, res) => {
  const [grupos] = await pool.query('SELECT id, nombre, descripcion, precio, fecha_fin FROM grupos');
  res.json(grupos);
});

router.post('/grupos', verificarToken, soloAdmin, async (req, res) => {
  const { nombre, descripcion, precio, fecha_fin } = req.body;
  if (!nombre || isNaN(precio) || !fecha_fin) return res.status(400).json({ error: 'Faltan datos' });

  try {
    const [resultado] = await pool.query('INSERT INTO grupos (nombre, descripcion, precio, fecha_fin) VALUES (?, ?, ?, ?)', [nombre, descripcion || '', precio, fecha_fin]);
    res.json({ message: 'Grupo creado', id: resultado.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno al crear grupo' });
  }
});

router.put('/grupos/:id', verificarToken, soloAdmin, async (req, res) => {
  const { descripcion, precio, fecha_fin } = req.body;
  const { id } = req.params;

  if (!descripcion || isNaN(precio)) return res.status(400).json({ error: "Descripción y precio obligatorios" });

  try {
    await pool.query('UPDATE grupos SET descripcion = ?, precio = ?, fecha_fin = ? WHERE id = ?', [descripcion, precio, fecha_fin, id]);
    res.json({ message: "Grupo actualizado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar grupo" });
  }
});

// 🔹 Eliminar grupo (con limpieza de cupones y cupones_usuarios)
router.delete('/grupos/:id', verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Eliminar los cupones asociados al grupo (primero relaciones con cupones_usuarios)
    const [cupones] = await pool.query('SELECT id FROM cupones WHERE grupo_id = ?', [id]);

    for (let cupon of cupones) {
      // Eliminar de cupones_usuarios
      await pool.query('DELETE FROM cupones_usuarios WHERE cupon_id = ?', [cupon.id]);
    }

    // 2. Eliminar cupones del grupo
    await pool.query('DELETE FROM cupones WHERE grupo_id = ?', [id]);

    // 3. Eliminar el grupo
    const [resultado] = await pool.query('DELETE FROM grupos WHERE id = ?', [id]);

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: "Grupo no encontrado" });
    }

    res.json({ message: "Grupo eliminado correctamente" });
  } catch (err) {
    console.error("Error al eliminar grupo:", err);
    res.status(500).json({ error: "Error al eliminar grupo" });
  }
});

router.delete('/grupos/:id', verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM cupones WHERE grupo_id = ?', [id]);
    await pool.query('DELETE FROM grupos WHERE id = ?', [id]);
    res.json({ message: "Grupo eliminado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar grupo" });
  }
});

// ---- CUPONES ----

router.get('/cupones', verificarToken, soloAdmin, async (req, res) => {
  const [cupones] = await pool.query(`
    SELECT c.id, c.titulo, c.descripcion, c.descuento, c.fecha_expiracion, u.nombre AS comercio, c.comercio_id, g.nombre AS grupo, g.id AS grupo_id
    FROM cupones c
    JOIN usuarios u ON c.comercio_id = u.id
    LEFT JOIN grupos g ON c.grupo_id = g.id
    ORDER BY c.grupo_id ASC, c.fecha_expiracion DESC
  `);
  res.json(cupones);
});

router.post('/cupones', verificarToken, soloAdmin, async (req, res) => {
  const { titulo, descripcion, descuento, fecha_expiracion, comercio_id, grupo_id } = req.body;
  if (!titulo || !descripcion || !descuento || !fecha_expiracion || !comercio_id || !grupo_id) return res.status(400).json({ error: 'Todos los campos son obligatorios' });

  try {
    await pool.query('INSERT INTO cupones (titulo, descripcion, descuento, fecha_expiracion, comercio_id, grupo_id) VALUES (?, ?, ?, ?, ?, ?)', [titulo, descripcion, descuento, fecha_expiracion, comercio_id, grupo_id]);
    res.json({ message: 'Cupón creado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno al crear cupón' });
  }
});

router.put('/cupones/:id', verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;
  const { titulo, descripcion, descuento, fecha_expiracion, comercio_id, grupo_id } = req.body;

  if (!titulo || !descripcion || !descuento || !fecha_expiracion || !comercio_id || !grupo_id) return res.status(400).json({ error: 'Faltan datos' });

  try {
    const [resultado] = await pool.query('UPDATE cupones SET titulo = ?, descripcion = ?, descuento = ?, fecha_expiracion = ?, comercio_id = ?, grupo_id = ? WHERE id = ?', [titulo, descripcion, descuento, fecha_expiracion, comercio_id, grupo_id, id]);
    if (resultado.affectedRows === 0) return res.status(404).json({ error: 'Cupón no encontrado' });

    res.json({ message: 'Cupón actualizado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar cupón' });
  }
});

router.delete('/cupones/:id', verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM cupones_usuarios WHERE cupon_id = ?', [id]);
    const [resultado] = await pool.query('DELETE FROM cupones WHERE id = ?', [id]);

    if (resultado.affectedRows === 0) return res.status(404).json({ error: 'Cupón no encontrado' });

    res.json({ message: 'Cupón eliminado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar cupón' });
  }
});

// ---- REPORTE CUPONES ----

router.get('/reporte-cupones', verificarToken, soloAdmin, async (req, res) => {
  try {
    const [reporte] = await pool.query(`
      SELECT cupones_usuarios.id, cupones.titulo AS cupon, cupones.descripcion, cupones.descuento, cupones_usuarios.utilizado, cupones_usuarios.fecha_compra, clientes.nombre AS cliente, clientes.telefono, comercios.nombre AS comercio
      FROM cupones_usuarios
      JOIN cupones ON cupones_usuarios.cupon_id = cupones.id
      JOIN usuarios AS clientes ON cupones_usuarios.usuario_id = clientes.id
      JOIN usuarios AS comercios ON cupones.comercio_id = comercios.id
    `);
    res.json(reporte);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener reporte' });
  }
});

// ---- ASIGNAR CUPONES MANUAL ----

router.post('/asignar-cupones-manual', verificarToken, soloAdmin, async (req, res) => {
  const { cliente_id, grupo_id, vendedor_id, monto } = req.body;

  try {
    const [cupones] = await pool.query('SELECT id FROM cupones WHERE grupo_id = ?', [grupo_id]);
    for (let cupon of cupones) {
      await pool.query('INSERT INTO cupones_usuarios (cupon_id, usuario_id, utilizado) VALUES (?, ?, 0)', [cupon.id, cliente_id]);
    }
    await pool.query('INSERT INTO ordenes (usuario_id, grupo_id, vendedor_id, monto, tipo_pago) VALUES (?, ?, ?, ?, "efectivo")', [cliente_id, grupo_id, vendedor_id, monto]);

    res.json({ message: "Cupones asignados exitosamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ---- VENDEDORES ----

router.get('/vendedores', verificarToken, soloAdmin, async (req, res) => {
  const [vendedores] = await pool.query('SELECT * FROM vendedores');
  res.json(vendedores);
});

router.post('/vendedores', verificarToken, soloAdmin, async (req, res) => {
  const { nombre, email, telefono } = req.body;
  if (!nombre || !email) return res.status(400).json({ error: "Faltan datos" });

  try {
    const [result] = await pool.query('INSERT INTO vendedores (nombre, email, telefono) VALUES (?, ?, ?)', [nombre, email, telefono]);
    res.json({ message: "Vendedor creado", id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear vendedor" });
  }
});

router.put('/vendedores/:id/estado', verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;
  const { activo } = req.body;

  try {
    await pool.query('UPDATE vendedores SET activo = ? WHERE id = ?', [activo, id]);
    res.json({ message: "Estado actualizado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar estado" });
  }
});

router.put('/vendedores/:id/actualizar', verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;
  const { campo, valor } = req.body;

  const camposPermitidos = ['nombre', 'email', 'telefono'];
  if (!camposPermitidos.includes(campo)) return res.status(400).json({ error: 'Campo no permitido' });

  try {
    await pool.query(`UPDATE vendedores SET ${campo} = ? WHERE id = ?`, [valor, id]);
    res.json({ message: 'Vendedor actualizado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar vendedor' });
  }
});

router.get('/vendedores/:id/clientes', verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const [clientes] = await pool.query('SELECT id, nombre, email, telefono FROM usuarios WHERE tipo = "cliente" AND vendedor_id = ?', [id]);
    res.json(clientes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

// ---- CLIENTES ----

router.put('/clientes/:id/vendedor', verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;
  const { vendedor_id } = req.body;

  if (!vendedor_id) return res.status(400).json({ error: 'Vendedor requerido' });

  try {
    await pool.query('UPDATE usuarios SET vendedor_id = ? WHERE id = ?', [vendedor_id, id]);
    const [rows] = await pool.query('SELECT id, nombre, vendedor_id FROM usuarios WHERE id = ?', [id]);
    res.json({ message: "Vendedor asignado", cliente: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al asignar vendedor" });
  }
});

router.put('/clientes/:id/telefono', verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;
  const { telefono } = req.body;

  if (!telefono) return res.status(400).json({ error: 'Teléfono requerido' });

  try {
    await pool.query('UPDATE usuarios SET telefono = ? WHERE id = ?', [telefono, id]);
    res.json({ message: "Teléfono actualizado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar teléfono" });
  }
});

// ---- CÓDIGOS ----

const generarCodigoUnico = () => Math.random().toString(36).substr(2, 8).toUpperCase();

router.post('/codigos', verificarToken, soloAdmin, async (req, res) => {
  const { grupo_id, cantidad } = req.body;
  if (!grupo_id || !cantidad || isNaN(cantidad)) return res.status(400).json({ error: 'Datos inválidos' });

  try {
    const codigos = [];
    for (let i = 0; i < cantidad; i++) {
      const codigo = generarCodigoUnico();
      await pool.query('INSERT INTO codigos (codigo, grupo_id) VALUES (?, ?)', [codigo, grupo_id]);
      codigos.push(codigo);
    }
    res.json({ message: 'Códigos generados', codigos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar códigos' });
  }
});

module.exports = router;
