const express = require('express');
const router = express.Router();
const { client } = require('../paypalClient');
const pool = require('../db');
const paypal = require('@paypal/checkout-server-sdk');
const verificarToken = require('../middleware/verificarToken');

// Crear orden de PayPal
router.post('/crear-orden-paypal/:grupoId', verificarToken, async (req, res) => {
    const { grupoId } = req.params;
  
    try {
      const [grupos] = await pool.query('SELECT * FROM grupos WHERE id = ?', [grupoId]);
      const grupo = grupos[0];
      if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado' });
  
      const request = new paypal.orders.OrdersCreateRequest();
      request.prefer('return=representation');
      request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'MXN',
            value: Number(grupo.precio).toFixed(2)
          },
          custom_id: `${grupo.id}`,
          description: `Compra del grupo ${grupo.nombre}`
        }],
        application_context: {
          return_url: 'http://localhost:3000/api/paypal/capturar-orden',
          cancel_url: 'http://localhost:5500/frontend/pago-cancelado.html',
          brand_name: 'Punto Social',
          landing_page: 'BILLING',     // 👈 Muestra directamente formulario de tarjeta
          user_action: 'PAY_NOW'       // 👈 Muestra botón "Pagar ahora"
        }
      });
  
      const response = await client().execute(request);
      const link = response.result.links.find(link => link.rel === 'approve');
  
      res.json({ url: link.href });
  
    } catch (err) {
      console.error('❌ Error al crear orden PayPal:', err);
      res.status(500).json({ error: 'Error al crear orden de PayPal' });
    }
  });

// Capturar orden PayPal
router.get('/paypal/capturar-orden', async (req, res) => {
  const { token } = req.query; // token = PayPal Order ID

  try {
    const request = new paypal.orders.OrdersCaptureRequest(token);
    request.requestBody({});
    
    const capture = await client().execute(request);
    
    console.log("📦 Captura completa:", JSON.stringify(capture.result, null, 2));

    if (capture.statusCode === 201 || capture.statusCode === 200) {
        const compra = capture.result.purchase_units[0];
        const grupoId = compra.payments.captures[0].custom_id;


      if (!grupoId) {
        return res.status(400).json({ error: 'ID de grupo no encontrado en la orden' });
      }
      
      const [grupos] = await pool.query('SELECT * FROM grupos WHERE id = ?', [grupoId]);
      
      const grupo = grupos[0];
      if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado' });

      const usuario_id = req.user?.id || 1; // ⚠️ asegúrate de tener el usuario si estás en modo de prueba

      const [cupones] = await pool.query('SELECT id FROM cupones WHERE grupo_id = ?', [grupo.id]);
      
      if (!cupones.length) return res.status(404).json({ error: 'No hay cupones en este grupo' });
      
      // Evita cupones con id indefinido
      const insertCupones = cupones.flatMap(c => {
        if (!c.id) return [];
        return Array(6).fill([usuario_id, c.id, new Date()]);
      });
      
      await pool.query(
        'INSERT INTO cupones_usuarios (usuario_id, cupon_id, fecha_compra) VALUES ?',
        [insertCupones]
      );

      return res.redirect('http://127.0.0.1:5500/frontend/pago-exitoso.html');
    }

    return res.status(400).json({ error: 'No se pudo capturar la orden' });

  } catch (err) {
    console.error("❌ Error al capturar orden:", err);
    res.status(500).json({ error: 'Error al capturar orden' });
  }
});

module.exports = router;
