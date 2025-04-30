const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const pool = require('./db');

console.log("🟢 Servidor iniciado y esperando peticiones...");

// ✅ Lista blanca de orígenes permitidos
const allowedOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'https://miapp.netlify.app',
  'https://api.miapp.com',
  'https://puntosocialtr-production.up.railway.app',
  'https://punto-social-frontend.vercel.app'
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

// ✅ Middleware para JSON
app.use(express.json());

// ✅ Servir archivos estáticos desde carpeta "frontend"
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ✅ Ruta raíz para servir index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// ✅ Ruta test de conexión a la base de datos
app.get('/api/test-db', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT NOW() AS ahora');
    res.json(rows[0]);
  } catch (err) {
    console.error('❌ Error al conectar con DB:', err);
    res.status(500).json({ error: 'Error en la conexión con la base de datos' });
  }
});

// ✅ Ruta pública para obtener vendedores activos
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

// ✅ Ruta pública para obtener grupos
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

// ✅ Rutas organizadas
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/cliente'));
app.use('/api', require('./routes/comercio'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/public'));
app.use('/api', require('./routes/pagos'));

// ✅ Iniciar servidor tras conexión exitosa
const PORT = process.env.PORT || 3000;
(async () => {
  try {
    const [result] = await pool.query('SELECT 1');
    console.log("✅ Conexión con DB exitosa:", result);

    app.listen(PORT, () => {
      console.log(`✅ Servidor corriendo en puerto ${PORT}`);
    });

  } catch (err) {
    console.error("❌ Error de conexión inicial con la DB:", err);
    process.exit(1);
  }
})();
