const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const pool = require('./db');

// ✅ Lista blanca de orígenes permitidos
const allowedOrigins = [
  'http://localhost:5500',                   // Frontend local
  'http://127.0.0.1:5500',                   // Otra forma del local
  'http://localhost:3000',                   // Backend local
  'https://miapp.netlify.app',               // Frontend en producción (Netlify)
  'https://api.miapp.com'                    // Backend en producción (Render)
];

// Ruta pública para obtener vendedores activos
app.get("/api/vendedores-activos", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, nombre, email
      FROM vendedores
      WHERE activo = 1
    `);
    res.json(rows);
  } catch (err) {
    console.error("Error al obtener vendedores activos:", err);
    res.status(500).json({ error: "Error al obtener vendedores" });
  }
});

// 🛡 Middleware de CORS
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // permitir peticiones tipo Postman
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn("❌ CORS bloqueado para:", origin);
    return callback(new Error('No autorizado por CORS'));
  },
  credentials: true
}));

// Middlewares
app.use(express.json());

// Rutas
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/cliente'));
app.use('/api', require('./routes/comercio'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/public'));

// Ruta de prueba de conexión a DB
app.get('/api/test-db', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT NOW() AS ahora');
    res.json(rows[0]);
  } catch (err) {
    console.error('❌ Error al conectar con DB:', err);
    res.status(500).json({ error: 'Error en la conexión con la base de datos' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
});

