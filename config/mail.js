/**
 * Formulario de contacto.
 * Los datos se leen del archivo .env (copia .env.example como .env y rellénalo).
 * La contraseña SMTP va SOLO en .env, nunca aquí.
 */
module.exports = {
  // correo que recibe los mensajes del formulario
  to: process.env.CONTACT_TO || '',

  // remitente que verá el destinatario (normalmente la misma cuenta SMTP)
  from: process.env.SMTP_FROM || process.env.SMTP_USER || '',

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true', // true para el puerto 465
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
};
