const mysql = require('mysql2/promise');

async function testConnection() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'cuponera_user',
      password: 'cuponera123',
      database: 'cuponera'
    });

    const [rows] = await connection.execute('SELECT NOW() AS ahora');
    console.log('✅ Conexión exitosa:', rows[0]);
    await connection.end();
  } catch (err) {
    console.error('❌ Error en la conexión:', err);
  }
}

testConnection();
