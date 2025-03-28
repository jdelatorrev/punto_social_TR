const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,       
    pass: process.env.GMAIL_APP_PASS    
  }
});

async function enviarCorreo(to, asunto, html) {
  const info = await transporter.sendMail({
    from: `"Cuponera" <${process.env.GMAIL_USER}>`,
    to,
    subject: asunto,
    html
  });

  console.log('📤 Correo enviado:', info.messageId);
}

module.exports = { enviarCorreo };

require('dotenv').config();
