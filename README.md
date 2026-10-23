# dream3d

Tienda online de figuras impresas en 3D. Node.js + Express, frontend en JavaScript sin compilar y SQLite.

## Requisitos

- Node.js 22.13 o superior (usa `node:sqlite`)
- npm

## Puesta en marcha

```bash
npm install
```

### Modo pruebas (recomendado para desarrollar)

Pagos y correos simulados, sin pedidos ni cobros reales. Usa `data/dev.db` y `data/dev-uploads/`.

```bash
npm run dev
```

- Tienda: http://localhost:3001
- Admin: http://localhost:3001/admin (contraseña por defecto `forma3d-admin`)
- Bandeja de correos simulados: http://localhost:3001/dev

### Modo normal

```bash
npm start
```

Usa el puerto 3000 y `data/forma3d.db`. Necesita un `.env` (ver abajo).

## Configuración

Copia `.env.example` a `.env` y rellena los valores. El archivo no se sube al repositorio.

| Variable | Para qué |
|---|---|
| `ADMIN_PASS` | Contraseña del panel de administración. Obligatoria en producción |
| `CONTACT_TO` | Correo que recibe los mensajes del formulario de contacto |
| `SMTP_*` | Servidor de correo para los correos de pedidos y contacto |
| `STRIPE_SECRET_KEY` | Clave de Stripe (pago con tarjeta) |
| `STRIPE_WEBHOOK_SECRET` | Secreto del webhook de Stripe |
| `PORT`, `HOST` | Puerto y dirección de escucha (por defecto 3000 y todas) |
| `SITE_URL` | URL pública, p. ej. `https://dream3d.es` |

Los textos, datos legales, IBAN y WhatsApp se editan desde el admin, en la sección **Web**.

## Pruebas

```bash
npm test
```

Usan una base de datos en memoria y no tocan `data/`.

## Estructura

```
server.js          Servidor Express: API pública, API admin y páginas
db/                Acceso a SQLite (la base de datos se inyecta por constructor)
payments.js        Precios del carrito, Stripe Checkout y webhook
mailer.js          Correos de pedido, pago y envío
dev.js             Modo pruebas: Stripe simulado y bandeja /dev
config/            Tema, calculadora de precios, correo
public/            Web (HTML, CSS, JS) y admin (public/admin/)
test/              Tests con node --test
deploy/            Configuración de nginx y systemd para producción
data/              Datos locales: bases de datos y subidas (no se suben)
```

## Despliegue

Los pasos completos para el servidor están en `deploy/`:

- `deploy/nginx-dream3d.es.conf`: proxy de nginx a `127.0.0.1:3000`, con HTTPS con certbot.
- `deploy/dream3d.service`: servicio de systemd, usuario `dream3d`, directorio `/opt/dream3d`.

Antes de abrir la tienda al público, revisa que los datos legales los firma un titular adulto o una empresa, y que los textos legales los ha revisado un profesional.

## Licencia

Privado. Todos los derechos reservados.
