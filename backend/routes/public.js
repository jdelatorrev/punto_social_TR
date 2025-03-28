const express = require('express');
const router = express.Router();
const pool = require('../db');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const verificarToken = require('../middleware/verificarToken');

// 🔐 Instancia Mercado Pago con Access Token
const mercadopago = new MercadoPagoConfig({
  accessToken: 'APP_USR-7380436693766290-032718-68a41ab427251729ed4836c2b88f8102-292199469'
});

// 🔍 Obtener grupos con sus cupones y comercios
router.get('/grupos', async (req, res) => {
  try {
    const [grupos] = await pool.query(`
      SELECT g.id AS grupo_id, g.nombre AS grupo_nombre, g.descripcion, g.precio,
             c.id AS cupon_id, c.titulo AS cupon_titulo,
             u.nombre AS comercio
      FROM grupos g
      LEFT JOIN cupones c ON c.grupo_id = g.id
      LEFT JOIN usuarios u ON c.comercio_id = u.id
      ORDER BY g.id, u.nombre
    `);

    const resultado = [];
    const mapa = new Map();

    for (const row of grupos) {
      if (!mapa.has(row.grupo_id)) {
        mapa.set(row.grupo_id, {
          id: row.grupo_id,
          nombre: row.grupo_nombre,
          descripcion: row.descripcion,
          precio: parseFloat(row.precio),
          cupones: []
        });
      }

      if (row.cupon_id) {
        mapa.get(row.grupo_id).cupones.push({
          titulo: row.cupon_titulo,
          comercio: row.comercio
        });
      }
    }

    res.json(Array.from(mapa.values()));
  } catch (err) {
    console.error("❌ Error al obtener los grupos:", err);
    res.status(500).json({ error: "Error al obtener los grupos" });
  }
});


// 🛒 Crear preferencia de pago para un grupo
router.post('/crear-preferencia/:grupoId', verificarToken, async (req, res) => {
  const { grupoId } = req.params;
  const userId = req.user.id;

  try {
    const [grupos] = await pool.query(`
      SELECT id, nombre, descripcion, precio FROM grupos WHERE id = ?
    `, [grupoId]);

    const grupo = grupos[0];
    if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado' });

    const preference = await new Preference(mercadopago).create({
      body: {
        items: [{
          title: grupo.nombre,
          description: grupo.descripcion,
          unit_price: parseFloat(grupo.precio),
          quantity: 1
        }],
        back_urls: {
          success: `http://localhost:5500/frontend/gracias.html`,
          failure: `http://localhost:5500/frontend/error.html`,
          pending: `http://localhost:5500/frontend/pendiente.html`
        },
        auto_return: "approved",
        external_reference: `${userId}|${grupoId}`
      }
    });

    res.json({ init_point: preference.init_point });

  } catch (error) {
    console.error("Error al crear preferencia:", error);
    res.status(500).json({ error: 'Error al generar pago' });
  }
});


// ✅ Confirmar compra desde frontend
router.get('/confirmar-compra', verificarToken, async (req, res) => {
  const { payment_id } = req.query;

  try {
    const mpResponse = await new Payment(mercadopago).get({ id: payment_id });
    const payment = mpResponse;

    if (payment.status !== "approved") {
      return res.status(400).json({ error: "Pago no aprobado" });
    }

    const [userId, grupoId] = payment.external_reference.split("|");

    // Obtener cupones asociados al grupo
    const [cupones] = await pool.query(`SELECT id FROM cupones WHERE grupo_id = ?`, [grupoId]);
    const cuponIds = cupones.map(c => c.id);

    // Asignar cupones al usuario
    for (const cuponId of cuponIds) {
      await pool.query(`
        INSERT INTO cupones_usuarios (usuario_id, cupon_id, utilizado, fecha_compra)
        VALUES (?, ?, false, NOW())
      `, [userId, cuponId]);
    }

    res.json({ message: "Cupones asignados correctamente" });
  } catch (err) {
    console.error("❌ Error al confirmar compra:", err);
    res.status(500).json({ error: "Error al confirmar compra" });
  }
});

module.exports = router;
