# Bot Mi Semilla (Render – modo Webhook)

Servicio Node.js para Telegram que usa servidor activo (Express o HTTP) conectado a Supabase.

## Archivos clave
- `index.js` → archivo principal del bot (usa webhook / servidor activo)
- `package.json` → dependencias y comando `start`
- `.env.example` → plantilla de variables de entorno

## Variables de entorno
Debes crear las siguientes en Render o localmente:
TELEGRAM_TOKEN=
SUPABASE_URL=
SUPABASE_KEY=
SUPABASE_TABLE=registros_miembros
## Deploy en Render (modo Web Service)
1. Crea un nuevo servicio **Web Service (Node)**.
2. En el paso “Source”, selecciona este repositorio (`tel_misemilla`).
3. **Build Command:** `npm install`
4. **Start Command:** `node index.js`
5. Configura las variables en **Environment** (las del bloque anterior).
6. Render te dará una URL pública; esa URL funcionará como webhook del bot.

> **No usa polling.** El bot se mantiene activo mediante un servidor Express o HTTP.

## Notas
- No subas tus llaves reales (.env) a GitHub.
- Puedes probar el bot localmente con `node index.js`.
- Supabase almacena los registros en la tabla `registros_miembros`.