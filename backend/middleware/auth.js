const jwt = require('jsonwebtoken');

function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log("🟡 Encabezado Authorization:", authHeader);
  console.log("🟡 Token recibido:", token);

  if (!token) {
    console.log("🔴 Token no proporcionado");
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error('❌ Error al verificar token:', err.message);
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }

    console.log("✅ Token válido:", user);
    req.user = user;
    next();
  });
}

// ✅ Esto es lo importante:
module.exports = verificarToken;
