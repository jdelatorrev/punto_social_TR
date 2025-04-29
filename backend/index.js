const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const pool = require('./db');

// Middlewares base
app.use(express.json());
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://localhost:3000',
      'https://miapp.netlify.app',
      'https://api.miapp.com'
    ];
    if (!origin || allowed.includes(origin)) return callback(null, true);
    return callback(new Error('CORS no autorizado'));
  },
  credentials: true
}));

// Rutas básicas
app.get("/api/vendedores-activos", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, nombre, email FROM vendedores WHERE activo = 1
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener vendedores" });
  }
});

app.get("/api/grupos", async (req, res) => {
  try {
    const [grupos] = await pool.query(`
      SELECT id, nombre, descripcion, precio, 
             DATE_FORMAT(fecha_fin, '%Y-%m-%d') AS fecha_fin
      FROM grupos
    `);

    const [cupones] = await pool.query(`
      SELECT c.id, c.titulo, c.descripcion, c.descuento, 
             c.fecha_expiracion, c.grupo_id, u.nombre AS comercio
      FROM cupones c
      JOIN usuarios u ON c.comercio_id = u.id
      WHERE u.tipo = 'comercio'
    `);

    const gruposConDatos = grupos.map(grupo => {
      const cuponesDelGrupo = cupones.filter(c => c.grupo_id === grupo.id);
      const comerciosUnicos = [...new Set(cuponesDelGrupo.map(c => c.comercio))];

      return {
        ...grupo,
        cupones: cuponesDelGrupo.map(c => ({ titulo: c.titulo, comercio: c.comercio })),
        comercios: comerciosUnicos,
        vigencia: grupo.fecha_fin ? `🔥 Hasta el ${grupo.fecha_fin}` : "❌ Sin definir"
      };
    });

    res.json(gruposConDatos);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener grupos" });
  }
});

// Otras rutas
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/cliente'));
app.use('/api', require('./routes/comercio'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/public'));
app.use('/api', require('./routes/pagos'));

// Ruta test de DB
app.get('/api/test-db', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT NOW() AS ahora');
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Error en conexión con la base de datos' });
  }
});

const PORT = process.env.PORT || 3000;
app
