// === MI SEMILLA BOT – Versión Final (Blindaje Total + Reintento) ===
// Autor: Ale (Total Business)
// Fecha: Octubre 2025
// Descripción: versión estable 100% funcional con blindaje, reintento Supabase,
// y actualización sensible/no sensible totalmente operativa.
// Compatible con Node.js v22+ (modo local y Render).

try { require('dotenv').config(); } catch (_) {}

const fs = require('fs');
const path = require('path');
const express = require('express');
const QRCode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const { createClient } = require('@supabase/supabase-js');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

// === Config Supabase (modo local con llaves incluidas) ===
// Si luego subes a Render, puedes mover estas llaves a variables de entorno.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hybozykbfehfjldhaxpp.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5Ym96eWtiZmVoZmpsZGhheHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMjU0OTMsImV4cCI6MjA3NDkwMTQ5M30.Bj1Jl3-g0gyp1UwsiK-cwjS8Cm2z7Il4_jZ-tCQhbwM';
const TABLE        = process.env.TABLE || 'registros_miembros';
const BOT_DISPLAY_NAME = process.env.BOT_DISPLAY_NAME || 'Mi Semilla';

// === Cargar sesión desde Supabase ===
async function loadSessionFromSupabase() {
  try {
    console.log("📦 Restaurando sesión desde Supabase...");
    const fs = require("fs");
    const path = require("path");
    const dir = "./auth_info_full";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    // ✅ Tomar siempre la sesión más reciente
    const { data, error } = await supabase
      .from("sesion_whatsapp")
      .select("*")
      .eq("nombre", "mi_sesion")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data || !data.datos) {
      console.log("⚠️ No hay sesión guardada en Supabase.");
      return;
    }

    // ✅ Decodificar los archivos guardados en base64
    for (const [f, content] of Object.entries(data.datos)) {
      const filePath = path.join(dir, f);
      fs.writeFileSync(filePath, Buffer.from(content, 'base64'));
    }

    console.log("✅ Sesión restaurada desde Supabase en ./auth_info_full");
  } catch (err) {
    console.error("❌ Error al restaurar sesión desde Supabase:", err.message || err);
  }
}

// === Directorio de autenticación de WhatsApp (Baileys) ===
const AUTH_DIR = process.env.AUTH_DIR || './auth_info_full';
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  console.log("📂 Carpeta de autenticación creada:", AUTH_DIR);
} else {
  console.log("🔐 Carpeta de autenticación detectada:", AUTH_DIR);
}
const QR_FILE = path.join(AUTH_DIR, 'qr_code.png');

// === Persistencia de sesión en Supabase ===
async function saveSessionToSupabase() {
  try {
    // Recopilar archivos del AUTH_DIR como mapa nombre->base64
    const files = fs.readdirSync(AUTH_DIR).filter(f => fs.statSync(path.join(AUTH_DIR, f)).isFile());
    const payload = {};
    for (const f of files) {
      const p = path.join(AUTH_DIR, f);
      const buf = fs.readFileSync(p);
      payload[f] = buf.toString('base64');
    }
    const { error } = await supabase
      .from('sesion_whatsapp')
      .upsert({ nombre: 'mi_sesion', datos: payload, updated_at: new Date().toISOString() }, { onConflict: 'nombre' });
    if (error) console.error('Supabase saveSession error:', error);
    else console.log('Sesión guardada en Supabase (sesion_whatsapp).');
  } catch (e) {
    console.error('saveSessionToSupabase fallo:', e);
  }
}

async function loadSessionFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('sesion_whatsapp')
      .select('datos')
      .eq('nombre', 'mi_sesion')
      .maybeSingle();
    if (error) { console.error('Supabase loadSession error:', error); return; }
    if (!data || !data.datos) { console.log('No se encontró sesión previa en Supabase.'); return; }
    // Escribir archivos en AUTH_DIR
    if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
    for (const [fname, b64] of Object.entries(data.datos)) {
      const p = path.join(AUTH_DIR, fname);
      fs.writeFileSync(p, Buffer.from(b64, 'base64'));
    }
    console.log('Sesión restaurada desde Supabase en', AUTH_DIR);
  } catch (e) {
    console.error('loadSessionFromSupabase fallo:', e);
  }
}


// === Cliente Supabase ===
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// === Archivos locales para gestionar estado simple ===
const PENDIENTE_FILE = path.resolve(process.cwd(), 'pendiente.json');
const SESION_FILE    = path.resolve(process.cwd(), 'sesion.json');
const RESTAURAR_FILE = path.resolve(process.cwd(), 'restaurar.json');

function escribirJSON(f, o) { try { fs.writeFileSync(f, JSON.stringify(o || {}, null, 2)); } catch {} }
function leerJSON(f) { try { if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8') || '{}'); } catch {}; return {}; }
function borrar(f) { try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {} }

// === Utilidades de número/normalización ===
const soloDigitos = (s = '') => String(s || '').replace(/\D/g, '');
function normalizarColombia(v) {
  let d = soloDigitos(v);
  if (d.startsWith('57') && d.length === 12) return d;
  if (d.startsWith('3') && d.length === 10) return '57' + d;
  if (d.length === 10) return '57' + d;
  if (d.startsWith('057') && d.length === 13) return d.slice(1);
  return d;
}
function numeroDesdeMsg(m, from) {
  try {
    let raw = m?.key?.senderPn || m?.key?.participant || m?.participant || from || '';
    if (raw.includes('@')) raw = raw.split('@')[0];
    if (raw.length > 12 && raw.startsWith('1')) {
      const ctx = m?.message?.extendedTextMessage?.contextInfo;
      const jid = ctx?.participant || ctx?.remoteJid || '';
      if (jid.includes('@')) raw = jid.split('@')[0];
    }
    return normalizarColombia(raw);
  } catch { return ''; }
}

// === Fingerprint de dispositivo (blindaje) ===
function fingerprint(meta) {
  try {
    const jid = meta?.key?.remoteJid || "";
    const user = meta?.pushName || "";
    const seed = `${jid}-${user}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    return `fp_${Math.abs(hash)}`;
  } catch {
    return "fp_desconocido";
  }
}

// === Envío de mensajes ===
async function enviar(sock, to, text) {
  try { await sock.sendMessage(to, { text }); }
  catch (e) { console.log('send err:', e?.message); }
}

// === Reintento automático para consultas Supabase (anti "fetch failed") ===
async function safeQuery(fn, label = 'query') {
  try {
    const res = await fn();
    return res;
  } catch (e) {
    console.warn(`⚠️ Supabase fallo en ${label}, reintentando...`, e?.message || e);
    await new Promise(r => setTimeout(r, 2000)); // espera 2 s
    return await fn();
  }
}

// === Servidor web simple para ver QR ===
const app = express();
let qrData = null;
app.get('/', (req, res) => {
  res.send("🌱 Bot Mi Semilla – WhatsApp activo ✅<br><a href='/qr'>📱 Escanear QR</a>");
});
app.get('/qr', async (req, res) => {
  if (!qrData) return res.send('⚠️ No hay QR disponible aún. Espera unos segundos o reinicia el bot.');
  try {
    const dataUrl = await QRCode.toDataURL(qrData);
    res.send(`<h2>Escanea con WhatsApp</h2><img src="${dataUrl}" /><p>Mi Semilla • whatsapp</p>`);
  } catch (err) { res.send('❌ Error QR: ' + err.message); }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('🌍 Servidor web activo en puerto', PORT));

// === Bot principal ===
async function iniciarBot() {
  await loadSessionFromSupabase();
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: [BOT_DISPLAY_NAME, 'Chrome', '10.0'],
    markOnlineOnConnect: false,
    syncFullHistory: false
  });

  sock.ev.on('connection.update', async ({ qr, connection, lastDisconnect }) => {
    if (qr) {
      qrData = qr;
      try { qrcodeTerminal.generate(qr, { small: true }); } catch {}
      try { await QRCode.toFile(QR_FILE, qr); } catch {}
      console.log('🔗 QR listo (también en /qr)');
    }
    if (connection === 'open') { console.log('🟢 Conectado a WhatsApp'); qrData = null; }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log('⚠️ Conexión cerrada:', code);
      if (code !== DisconnectReason.loggedOut) { setTimeout(iniciarBot, 3000); }
      else { console.log('🚫 Sesión cerrada. Borra', AUTH_DIR, 'para relogear.'); }
    }
  });
  
// === Guardar sesión también en Supabase ===
let isSaving = false;

sock.ev.on('creds.update', async () => {
  if (isSaving) return; // evita guardados simultáneos
  try {
    isSaving = true;
    await saveCreds();
    console.log("💾 Intentando guardar sesión en Supabase...");

    const fs = require("fs");
    const path = require("path");
    const dir = "./auth_info_full";
    const files = fs.readdirSync(dir);
    const dataToSave = {};

    // ✅ Codificar todos los archivos en base64
    for (const f of files) {
      const filePath = path.join(dir, f);
      const content = fs.readFileSync(filePath);
      dataToSave[f] = content.toString('base64');
    }

    const { error } = await supabase
      .from("sesion_whatsapp")
      .upsert({
        nombre: "mi_sesion",
        datos: dataToSave,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    console.log("✅ Sesión guardada correctamente en Supabase");
  } catch (err) {
    console.error("⚠️ Error guardando sesión en Supabase:", err.message || err);
  } finally {
    isSaving = false;
  }
});

  // ====== Listener de mensajes ======
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const m of messages) {
      try {
        // Anti-bucle
        if (m.key?.fromMe) continue;

        const texto = (m.message?.conversation || m.message?.extendedTextMessage?.text || '').trim();
        if (!texto) continue;
        const lower = texto.toLowerCase();
        const from = m.key?.remoteJid || '';
        const numero = numeroDesdeMsg(m, from);

        console.log('\n=== DEBUG WHATSAPP ===');
        console.log('Texto:', texto);
        console.log('JID:', from, '→ Número normalizado:', numero);

        // ----- Comandos básicos -----
        if (lower.startsWith('/start')) {
          await enviar(sock, from, '🌱 *Bienvenido al bot de Mi Semilla.*\nUsa /ayuda para ver los comandos.');
          continue;
        }

        if (lower.startsWith("/info")) {
          await enviar(
            sock, from,
            "ℹ️ *Mi Semilla* es un programa de apoyo comunitario y humanitario.\n\n" +
            "📌 A través de este bot puedes consultar, actualizar y validar tu registro.\n" +
            "🌍 Nuestro objetivo es mantener tu información al día y fortalecer la red de ayuda."
          );
          continue;
        }

        if (lower.startsWith('/ayuda')) {
          await enviar(sock, from,
            '🤖 *Ayuda bot Mi Semilla*\n\n' +
            '• /info → Breve descripcion de que trata el proyecto\n' +
            '• /misdatos → Consultar tus datos (verificación segura)\n' +
            '• /actualizacion campo valor → Actualizar un dato\n' +
            '• /restaurar → Recuperar acceso si cambiaste de número\n' +
            '• /glosario → Ver nombres de campos válidos\n'
          );
          continue;
        }

        if (lower.startsWith('/glosario')) {
          await enviar(sock, from,
            '🧩 *Glosario de actualización de datos*\n\n' +
            '📌 *1️⃣ DATOS PERSONALES:*\n' +
            'nombre_completo, documento, fecha_nacimiento, edad, genero, escolaridad\n\n' +
            '📞 *2️⃣ DATOS DE CONTACTO:*\n' +
            'email, celular\n\n' +
            '🏠 *3️⃣ DATOS DE UBICACIÓN:*\n' +
            'pais, departamento, ciudad, barrio, direccion\n\n' +
            '🏡 *4️⃣ INFORMACIÓN DEL HOGAR:*\n' +
            'vivienda_propia, zona, estrato, personas_en_hogar, personas_trabajan\n\n' +
            '👨👩👧👦 *5️⃣ GRUPO FAMILIAR:*\n' +
            'adultos_mayores, menores\n\n' +
            '⚙️ *6️⃣ CONDICIONES Y SERVICIOS:*\n' +
            'servicios, discapacidad, detalle_discapacidad\n\n' +
            '🎯 *7️⃣ INTERESES Y PROYECTOS:*\n' +
            'hobbies, emprendimiento\n\n' +
            '🤝 *8️⃣ REFERENCIAS PERSONALES:*\n' +
            'ref_nombre, ref_whatsapp, ref_telegram\n\n' +
            '🔒 *Recuerda:* solo puedes actualizar tus propios datos asociados a tu número de WhatsApp.'
          );
          continue;
        }

        // ====== /misdatos – Paso A: iniciar ======
        if (lower.startsWith('/misdatos')) {
          escribirJSON(PENDIENTE_FILE, { estado: 'solicitar_id', who: numero });
          await enviar(sock, from, '🪪 *Verificación de identidad*\nEnvíame tu *documento* o *email* para buscar tu registro.');
          continue;
        }

        // ====== /misdatos – Paso B: identificador ======
        const pend = leerJSON(PENDIENTE_FILE);
        if (pend?.estado === 'solicitar_id' && pend?.who === numero && !lower.startsWith('/')) {
          const idVal = texto.trim();
          const isEmail = /\S+@\S+\.\S+/.test(idVal);
          const isDoc   = /^\d{5,}$/.test(idVal.replace(/\D/g, ''));
          if (!isEmail && !isDoc) { await enviar(sock, from, '❌ Debes enviar un *email* válido o un *número de documento*.'); continue; }

          let q = supabase.from(TABLE).select('*').limit(1);
          if (isEmail) q = q.eq('email', idVal.toLowerCase());
          else q = q.eq('documento', idVal.replace(/\D/g, ''));

          let found = null, error = null;
          try {
            const res = await safeQuery(() => q.maybeSingle(), 'misdatos.buscar');
            found = res?.data; error = res?.error || null;
          } catch (e) { error = e; }

          if (error) { await enviar(sock, from, '⚠️ Error al consultar datos. Intenta más tarde.'); borrar(PENDIENTE_FILE); continue; }
          if (!found) { await enviar(sock, from, '❌ No encontré un registro con ese identificador.'); borrar(PENDIENTE_FILE); continue; }

          // === Seguridad de dispositivo (blindaje Fingerprint) ===
          const currentFP = fingerprint(m);
          const savedFP = (found.whatsapp_id || "").toString().trim();
          const sameDevice = savedFP &&
            (savedFP.includes(currentFP) || currentFP.includes(savedFP) || savedFP.split("-")[0] === currentFP.split("-")[0]);

          if (savedFP && !sameDevice) {
            await enviar(sock, from, "🚫 Este dato ya está registrado con otra cuenta.");
            borrar(PENDIENTE_FILE);
            continue;
          }

          if (!savedFP) {
            try { await safeQuery(() => supabase.from(TABLE).update({ whatsapp_id: currentFP }).eq("id", found.id), 'misdatos.vincular'); }
            catch {}
          }

          escribirJSON(PENDIENTE_FILE, { estado: 'solicitar_cel', id: found.id, who: numero });
          await enviar(sock, from, '📱 Ahora envía tu *número de celular* (57 + dígitos) para confirmar identidad.');
          continue;
        }

        // ====== /misdatos – Paso C: validar celular y MOSTRAR TABLA ======
        const pendCel = leerJSON(PENDIENTE_FILE);
        if (pendCel?.estado === 'solicitar_cel' && pendCel?.who === numero && !lower.startsWith('/')) {
          const n = normalizarColombia(texto);
          if (!/^\d{11,12}$/.test(n)) { await enviar(sock, from, '❌ Número inválido. Envía solo dígitos (57 + celular).'); continue; }

          let reg = null, err = null;
          try {
            const r = await safeQuery(() => supabase.from(TABLE).select('*').eq('id', pendCel.id).maybeSingle(), 'misdatos.leer_reg');
            reg = r?.data; err = r?.error || null;
          } catch (e) { err = e; }

          if (err || !reg) { await enviar(sock, from, '⚠️ Error al verificar. Intenta de nuevo.'); borrar(PENDIENTE_FILE); continue; }

          const celBase = normalizarColombia(reg.celular || '');
          const wappNum = normalizarColombia((reg.whatsapp_id || '').split('@')[0]);
          if (n !== celBase && n !== wappNum) { await enviar(sock, from, '❌ El número no coincide con el registro.'); borrar(PENDIENTE_FILE); continue; }

          // Guardar sesión verificada
          escribirJSON(SESION_FILE, { user_id: reg.id, who: numero, ts: Date.now() });
          borrar(PENDIENTE_FILE);

          // Construir TABLA bonita
          const d = reg;
          const tabla =
`✅ *Identidad verificada.*
📋 *Estos son tus datos de campo actuales:*

📌 *DATOS PERSONALES*
- 👤 *Nombre:* ${d.nombre_completo?.toUpperCase() || 'Sin registrar'}
- 🪪 *Documento:* ${d.documento || 'Sin registrar'}
- 🎂 *Fecha Nacimiento:* ${d.fecha_nacimiento || 'Sin registrar'}
- 🧮 *Edad:* ${d.edad || 'Sin registrar'}
- 🚻 *Género:* ${d.genero || 'Sin registrar'}
- 🎓 *Escolaridad:* ${d.escolaridad || 'Sin registrar'}

📞 *DATOS DE CONTACTO*
- ✉️ *Email:* ${d.email || 'Sin registrar'}
- 📱 *Celular:* ${d.celular || 'Sin registrar'}

🏠 *DATOS DE UBICACIÓN*
- 🌎 *País:* ${d.pais || 'Sin registrar'}
- 🗺️ *Departamento:* ${d.departamento || 'Sin registrar'}
- 🏙️ *Ciudad:* ${d.ciudad || 'Sin registrar'}
- 🏘️ *Barrio:* ${d.barrio || 'Sin registrar'}
- 🏡 *Dirección:* ${d.direccion || 'Sin registrar'}

🏡 *INFORMACIÓN DEL HOGAR*
- 🏠 *Vivienda Propia:* ${d.vivienda_propia || 'Sin registrar'}
- 🌄 *Zona:* ${d.zona || 'Sin registrar'}
- 🧱 *Estrato:* ${d.estrato || 'Sin registrar'}
- 👨👩👧👦 *Personas en Hogar:* ${d.personas_en_hogar || 'Sin registrar'}
- 👔 *Personas Trabajan:* ${d.personas_trabajan || 'Sin registrar'}

👨👩👧👦 *GRUPO FAMILIAR*
- 🧓 *Adultos Mayores:* ${d.adultos_mayores || 'Sin registrar'}
- 🧒 *Menores:* ${d.menores || 'Sin registrar'}

⚙️ *CONDICIONES Y SERVICIOS*
- 🔌 *Servicios:* ${d.servicios || 'Sin registrar'}
- ♿ *Discapacidad:* ${d.discapacidad || 'Sin registrar'}
- 🩺 *Detalle Discapacidad:* ${d.detalle_discapacidad || 'Sin registrar'}

🎯 *INTERESES Y PROYECTOS*
- 🎨 *Hobbies:* ${d.hobbies || 'Sin registrar'}
- 💼 *Emprendimiento:* ${d.emprendimiento || 'Sin registrar'}

🤝 *REFERENCIAS PERSONALES*
- 🙍♂️ *Ref Nombre:* ${d.ref_nombre || 'Sin registrar'}
- 📞 *Ref WhatsApp:* ${d.ref_whatsapp || 'Sin registrar'}
- 📣 *Ref Telegram:* ${d.ref_telegram || 'Sin registrar'}`;

          const instruccion =
`\n✏️ *Si necesitas cambiar algo, usa el comando:*
/actualizacion campo valor

📘 *Si no recuerdas el nombre exacto del campo, usa:* /glosario`;

          await enviar(sock, from, `${tabla}${instruccion}`);
          continue;
        }

// ====== /actualizacion (requiere sesión) ======
if (lower.startsWith('/actualizacion')) {
  const ses = leerJSON(SESION_FILE);
  if (!ses?.user_id || ses?.who !== numero) {
    await enviar(sock, from, '🔒 Primero verifica identidad con */misdatos*.');
    continue;
  }

  const parts = lower.split(' ').filter(Boolean);
  if (parts.length < 3) {
    await enviar(sock, from, '⚠️ Formato: */actualizacion campo valor*\nEj: */actualizacion ciudad Bogotá*');
    continue;
  }

  const campo = parts[1].trim().toLowerCase();
  const valorOriginal = texto.split(' ').slice(2).join(' ').trim();
  if (!valorOriginal) {
    await enviar(sock, from, '❌ Debes indicar un valor.');
    continue;
  }

  const camposValidos = [
    'nombre_completo','documento','fecha_nacimiento','edad','genero','escolaridad',
    'email','celular','pais','departamento','ciudad','barrio','direccion',
    'vivienda_propia','zona','estrato','personas_en_hogar','personas_trabajan',
    'adultos_mayores','menores','servicios','discapacidad','detalle_discapacidad',
    'hobbies','emprendimiento','ref_nombre','ref_whatsapp','ref_telegram'
  ];

  if (!camposValidos.includes(campo)) {
    await enviar(sock, from, '❌ Campo inválido. Usa */glosario* para ver los válidos.');
    continue;
  }

  // Intento robusto de consulta
  let registroActual = null;
  try {
    const { data, error } = await supabase.from(TABLE).select(campo).eq('id', ses.user_id).maybeSingle();
    if (error) throw error;
    registroActual = data;
  } catch (e) {
    console.error('⚠️ Error consultando campo:', e.message || e);
    await enviar(sock, from, '⚠️ No pude verificar tu información actual. Intenta más tarde.');
    continue;
  }

  let nuevo = valorOriginal;
  if (campo !== 'email') nuevo = nuevo.toUpperCase();
  if (campo === 'celular') nuevo = normalizarColombia(nuevo);

  const actual = (registroActual?.[campo] || '').toString().trim();
  if (actual && nuevo.toUpperCase() === actual.toUpperCase()) {
    await enviar(sock, from, `⚠️ El campo *${campo}* ya tiene el mismo valor registrado.`);
    continue;
  }

  const sensibles = ['email', 'documento', 'celular'];
  if (sensibles.includes(campo)) {
    let q = supabase.from(TABLE).select('id').neq('id', ses.user_id).limit(1);
    if (campo === 'email') q = q.eq('email', valorOriginal.toLowerCase());
    if (campo === 'documento') q = q.eq('documento', valorOriginal.replace(/\D/g, ''));
    if (campo === 'celular') q = q.eq('celular', normalizarColombia(valorOriginal));

    try {
      const { data: dup, error } = await q.maybeSingle();
      if (error) throw error;
      if (dup) {
        await enviar(sock, from, `🚫 No se puede actualizar. El *${campo}* ingresado ya existe en otro usuario.`);
        continue;
      }

      escribirJSON(PENDIENTE_FILE, {
        estado: 'confirmar_sensible',
        campo,
        nuevo,
        user_id: ses.user_id,
        who: numero
      });

      await enviar(sock, from, `⚠️ El campo *${campo}* es sensible. ¿Confirmas actualizarlo a *${valorOriginal}*?\nResponde: *sí* o *no*`);
      continue;
    } catch (e) {
      console.error('⚠️ Error al validar duplicados:', e.message || e);
      await enviar(sock, from, '⚠️ Error al validar duplicados. Intenta más tarde.');
      continue;
    }
  }

  // Actualización directa para no sensibles
  try {
    const { error: updErr } = await supabase.from(TABLE).update({ [campo]: nuevo }).eq('id', ses.user_id);
    if (updErr) throw updErr;
    await enviar(sock, from, `✅ El campo *${campo}* fue actualizado correctamente.`);
  } catch (e) {
    console.error('❌ Error al actualizar:', e.message || e);
    await enviar(sock, from, '❌ No se pudo actualizar. Intenta nuevamente.');
  }

  continue;
}

        // ====== Confirmación de sensibles ======
        const pend2 = leerJSON(PENDIENTE_FILE);
        if (pend2?.estado === 'confirmar_sensible' && pend2?.who === numero && !lower.startsWith('/')) {
          const affirm = ['si', 'sí', 'yes', 'y']; const deny = ['no', 'n'];
          if (affirm.includes(lower)) {
            const { error } = await supabase.from(TABLE).update({ [pend2.campo]: pend2.nuevo }).eq('id', pend2.user_id);
            if (error) await enviar(sock, from, '❌ No pude actualizar el dato sensible. Intenta luego.');
            else await enviar(sock, from, '✅ Actualizado correctamente.');
            borrar(PENDIENTE_FILE); continue;
          } else if (deny.includes(lower)) {
            await enviar(sock, from, '❎ Cambio cancelado.'); borrar(PENDIENTE_FILE); continue;
          } else {
            await enviar(sock, from, 'Responde *sí* o *no* para confirmar el cambio sensible.'); continue;
          }
        }
       
// ====== /restaurar (validado, coherente y seguro) ======
if (lower.startsWith('/restaurar')) {
  escribirJSON(RESTAURAR_FILE, { estado: 'pedir_id', who: numero });
  await enviar(sock, from,
    '🔧 *Restauración de cuenta*\nEnvía tu *documento* o *correo electrónico* para buscar tu registro.'
  );
  continue;
}

const rest = leerJSON(RESTAURAR_FILE);

// Paso 1: pedir documento o correo
if (rest?.estado === 'pedir_id' && rest?.who === numero && !lower.startsWith('/')) {
  const v = texto.trim();
  const isEmail = /\S+@\S+\.\S+/.test(v);
  const isDoc = /^\d{5,}$/.test(v.replace(/\D/g, ''));
  if (!isEmail && !isDoc) {
    await enviar(sock, from, '❌ Envía un *email válido* o *número de documento*.');
    continue;
  }

  let q = supabase.from(TABLE).select('*').limit(1);
  if (isEmail) q = q.eq('email', v.toLowerCase());
  else q = q.eq('documento', v.replace(/\D/g, ''));

  const { data: foundR, error: errR } = await q.maybeSingle();
  if (errR || !foundR) {
    await enviar(sock, from, '❌ No encontré ningún registro asociado.');
    borrar(RESTAURAR_FILE);
    continue;
  }

  escribirJSON(RESTAURAR_FILE, { estado: 'pedir_nuevo_cel', id: foundR.id, who: numero, actual: foundR.celular });
  await enviar(sock, from,
    '📱 Envía tu *nuevo número de celular* (57 + dígitos) para actualizar tu registro.'
  );
  continue;
}

// Paso 2: pedir nuevo número
if (rest?.estado === 'pedir_nuevo_cel' && rest?.who === numero && !lower.startsWith('/')) {
  const nuevoCel = normalizarColombia(texto);
  if (!/^\d{11,12}$/.test(nuevoCel)) {
    await enviar(sock, from, '❌ Número inválido. Envía un número válido (57 + dígitos).');
    continue;
  }

  // 🚫 Bloquear si el nuevo número es igual al actual
  if (nuevoCel === rest.actual) {
    await enviar(sock, from, 'ℹ️ Este número ya está asociado a tu cuenta. No necesitas restaurarlo.');
    borrar(RESTAURAR_FILE);
    continue;
  }

  // 🚫 Bloquear si el número pertenece a otra cuenta registrada
  const { data: otro, error: errDup } = await supabase
    .from(TABLE)
    .select('id')
    .eq('celular', nuevoCel)
    .maybeSingle();

  if (otro && otro.id !== rest.id) {
    await enviar(sock, from, '🚫 Este número ya pertenece a otra cuenta registrada. Intenta con un número distinto.');
    borrar(RESTAURAR_FILE);
    continue;
  }

  // Si pasa todas las validaciones, pedir confirmación
  escribirJSON(RESTAURAR_FILE, { ...rest, estado: 'confirmar', nuevo: nuevoCel });
  await enviar(sock, from,
    `⚠️ Estás a punto de restaurar tu cuenta con el número: *${nuevoCel}*\n¿Confirmas que deseas continuar?\nResponde con *sí* o *no*.`
  );
  continue;
}

// Paso 3: confirmar restauración
if (rest?.estado === 'confirmar' && rest?.who === numero && !lower.startsWith('/')) {
  if (['si', 'sí', 's'].includes(lower)) {
    try {
      const { error: errU } = await supabase
        .from(TABLE)
        .update({ celular: rest.nuevo })
        .eq('id', rest.id);

      if (errU) {
        console.error('Error actualización:', errU);
        await enviar(sock, from,
          '⚠️ Hubo un error al intentar actualizar tu número. Intenta nuevamente más tarde.'
        );
      } else {
        await enviar(sock, from,
          '✅ *Restauración completada.*\nTu número fue actualizado correctamente.\nYa puedes usar */misdatos* y */actualizacion*.'
        );
      }
    } catch (e) {
      console.error(e);
      await enviar(sock, from,
        '⚠️ Ocurrió un error inesperado al completar la restauración. Intenta nuevamente.'
      );
    }
  } else if (['no', 'n'].includes(lower)) {
    await enviar(sock, from, '❌ Restauración cancelada. Tus datos permanecen sin cambios.');
  } else {
    await enviar(sock, from, 'Por favor responde solo con *sí* o *no* para confirmar.');
    continue;
  }
  borrar(RESTAURAR_FILE);
  continue;
}

        // ========== RESPUESTAS INTELIGENTES ==========
        const restState = leerJSON(RESTAURAR_FILE);
        if (!lower.startsWith('/') &&
            !['si','sí','no','s'].includes(lower) &&
            !(restState?.who === numero)) {

          if (lower.includes('hola') || lower.includes('buenas') || lower.includes('saludos')) {
            await enviar(sock, from,
              "🤖 ¡Hola! 👋\nBienvenido(a) al asistente de *Mi Semilla* 🌱\n\n" +
              "¿Qué deseas hacer hoy?\n\n" +
              "• /misdatos → Ver tu información\n" +
              "• /actualizacion → Modificar un dato\n" +
              "• /glosario → Ver los campos disponibles\n" +
              "• /restaurar → Recuperar tu cuenta"
            ); continue;
          }

          if (lower.includes('ayuda') || lower.includes('orienta') || lower.includes('cómo empiezo') ||
              lower.includes('que debo hacer') || lower.includes('qué debo hacer') ||
              lower.includes('necesito actualizar') || lower.includes('consultar') ||
              lower.includes('información') || lower.includes('informacion') || lower.includes('actualizar')) {
            await enviar(sock, from,
              "🧭 Puedo ayudarte con estos comandos:\n\n" +
              "• /misdatos → Ver tu información actual registrada.\n" +
              "• /actualizacion → Modificar un dato específico.\n" +
              "• /glosario → Ver los nombres de los campos disponibles.\n" +
              "• /restaurar → Recuperar tu cuenta si cambiaste usuario o celular.\n\n" +
              "✉️ Escribe por ejemplo:\n`/actualizacion ciudad Bogotá` o `/misdatos`"
            ); continue;
          }

          if (lower.includes('gracias') || lower.includes('te agradezco') || lower.includes('muy amable')) {
            await enviar(sock, from, '😊 ¡Con gusto! Siempre estoy aquí para ayudarte 🌻'); continue;
          }

          if (lower.includes('adiós') || lower.includes('adios') || lower.includes('chao') || lower.includes('nos vemos') || lower.includes('hasta luego')) {
            await enviar(sock, from, '👋 ¡Hasta pronto! Que tengas un excelente día 🌿'); continue;
          }

          if (lower.includes('no entiendo') || lower.includes('no se') || lower.includes('no sé') ||
              lower.includes('error') || lower.includes('ayúdame') || lower.includes('ayudame') || lower.includes('problema')) {
            await enviar(sock, from,
              "⚙️ Parece que necesitas un poco de ayuda.\n\n" +
              "Prueba con alguno de estos comandos:\n" +
              "• /misdatos → Consultar tu información.\n" +
              "• /actualizacion → Modificar un dato.\n" +
              "• /restaurar → Si perdiste acceso o cambiaste tu usuario."
            ); continue;
          }

          await enviar(sock, from,
            "🤔 No entendí tu mensaje, pero puedo ayudarte con:\n\n" +
            "• /misdatos → Ver tus datos\n" +
            "• /actualizacion → Modificar información\n" +
            "• /glosario → Ver los campos disponibles\n" +
            "• /restaurar → Recuperar tu cuenta"
          ); continue;
        }

        // Comando desconocido
        if (lower.startsWith('/')) {
          await enviar(sock, from, '❔ Comando no reconocido. Usa */ayuda*.');
          continue;
        }

        // Mensaje normal
        await enviar(sock, from, '🤖 Hola 👋 Usa */misdatos* para consultar tus datos o */actualizacion* para modificarlos.');
      } catch (err) {
        console.error('⚠️ Error handler:', err);
        try { await enviar(sock, from, '⚠️ Hubo un problema procesando tu mensaje.'); } catch {}
      }
    }
  });
}

iniciarBot().catch((e) => console.error('❌ Fallo iniciarBot:', e));
