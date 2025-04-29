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

// Ruta pública para obtener grupos con comercios únicos y cupones anidados
app.get("/api/grupos", async (req, res) => {
  try {
    const [grupos] = await pool.query(`
      SELECT id, nombre, descripcion, precio, 
             DATE_FORMAT(fecha_fin, '%Y-%m-%d') AS fecha_fin
      FROM grupos
    `);

    const [cupones] = await pool.query(`
      SELECT 
        c.id, c.titulo, c.descripcion, c.descuento, 
        c.fecha_expiracion, c.grupo_id, u.nombre AS comercio
      FROM cupones c
      JOIN usuarios u ON c.comercio_id = u.id
      WHERE u.tipo = 'comercio'
    `);

    const gruposConDatos = grupos.map(grupo => {
      const cuponesDelGrupo = cupones.filter(c => c.grupo_id === grupo.id);
      const comerciosUnicos = [...new Set(cuponesDelGrupo.map(c => c.comercio))];

      const vigencia = grupo.fecha_fin
        ? `🔥 Hasta el ${grupo.fecha_fin}`
        : "❌ Sin definir";

      return {
        id: grupo.id,
        nombre: grupo.nombre,
        descripcion: grupo.descripcion,
        precio: grupo.precio,
        cupones: cuponesDelGrupo.map(c => ({
          titulo: c.titulo,
          comercio: c.comercio
        })),
        comercios: comerciosUnicos,
        vigencia: vigencia,
        fecha_fin: grupo.fecha_fin
      };
    });

    res.json(gruposConDatos);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener grupos" });
  }
});

// Middlewares
app.use(express.json());

// Rutas
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/cliente'));
app.use('/api', require('./routes/comercio'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/public'));
app.use('/api', require('./routes/pagos'));


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


