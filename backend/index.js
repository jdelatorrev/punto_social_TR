const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const pool = require('./db');

// Middlewares
app.use(cors());
app.use(express.json());

// Rutas
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/cliente'));
app.use('/api', require('./routes/comercio'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/public'));



// Ruta de prueba
app.get('/api/test-db', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT NOW() AS ahora');
    res.json(rows[0]);
  } catch (err) {
    console.error('Error al conectar con la DB:', err);
    res.status(500).json({ error: 'Error en la conexión con la base de datos' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
});
