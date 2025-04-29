require('dotenv').config();
const mysql = require('mysql2/promise');

let pool;

try {
  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
    throw new Error("❌ Faltan variables de entorno de base de datos");
  }

  pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true
  });

  console.log("✅ Pool de MySQL creado");
} catch (err) {
  console.error("❌ Error al inicializar la conexión MySQL:", err.message);
}

module.exports = pool;
