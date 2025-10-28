// === MI SEMILLA BOT – Versión Final (Blindaje Total + Reintento) ===
// Autor: Ale (Total Business)
// Fecha: Octubre 2025
// Descripción: versión estable 100% funcional con blindaje, reintento Supabase,
// y actualización sensible/no sensible totalmente operativa.
// Compatible con Node.js v22+ (modo local y Render).

// === Limpieza opcional de sesión anterior ===
import fs from "fs";
if (fs.existsSync("./auth_info_full")) {
  fs.rmSync("./auth_info_full", { recursive: true, force: true });
  console.log("🧹 Carpeta auth_info_full eliminada correctamente");
}

try { require('dotenv').config(); } catch (_) {}

// === DEPENDENCIAS Y CONFIGURACIÓN ===
import fs from "fs";
import path from "path";
import express from "express";
import QRCode from "qrcode";
import qrcodeTerminal from "qrcode-terminal";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";

// === CONFIGURACIÓN DE ENTORNO ===
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sessionPath = path.join(__dirname, "auth_info_full");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const BOT_DISPLAY_NAME = process.env.BOT_DISPLAY_NAME || "Mi Semilla Bot";

// === FUNCIÓN: GUARDAR SESIÓN EN SUPABASE ===
async function guardarSesionSupabase(nombre, sessionData) {
  try {
    const { data, error } = await supabase
      .from("sesion_whatsapp")
      .upsert({
        nombre,
        datos: sessionData,
        updated_at: new Date(),
      });

    if (error) console.error("❌ Error guardando sesión:", error);
    else console.log("✅ Sesión guardada correctamente en Supabase.");
  } catch (err) {
    console.error("⚠️ Error inesperado guardando sesión:", err);
  }
}

// === FUNCIÓN: CARGAR SESIÓN DESDE SUPABASE ===
async function cargarSesionSupabase(nombre) {
  const { data, error } = await supabase
    .from("sesion_whatsapp")
    .select("datos")
    .eq("nombre", nombre)
    .maybeSingle();

  if (error) {
    console.error("❌ Error cargando sesión:", error);
    return null;
  }

  if (data && data.datos) {
    console.log("📦 Sesión encontrada en Supabase.");
    fs.mkdirSync(sessionPath, { recursive: true });
    fs.writeFileSync(
      path.join(sessionPath, "creds.json"),
      JSON.stringify(data.datos, null, 2)
    );
    return data.datos;
  } else {
    console.log("⚠️ No se encontró sesión previa en Supabase.");
    return null;
  }
}

// === FUNCIÓN PRINCIPAL: INICIAR BOT ===
async function iniciarBot() {
  const nombreSesion = "mi_sesion";
  await cargarSesionSupabase(nombreSesion);

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: [BOT_DISPLAY_NAME, "Chrome", "1.0.0"],
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  sock.ev.on("creds.update", async () => {
    await guardarSesionSupabase(nombreSesion, state.creds);
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "open") console.log("✅ Bot conectado a WhatsApp.");
    else if (connection === "close") console.log("❌ Desconectado:", lastDisconnect?.error);
  });
}

// === SERVIDOR EXPRESS PARA UPTIME ===
const app = express();
app.get("/", (req, res) => {
  res.send("🌱 Bot Mi Semilla – WhatsApp conectado");
});

app.get("/qr", async (req, res) => {
  try {
    const qrFile = path.join(sessionPath, "creds.json");
    if (!fs.existsSync(qrFile)) return res.send("⚠️ No hay QR activo todavía.");

    const qrData = fs.readFileSync(qrFile, "utf8");
    const dataUrl = await QRCode.toDataURL(qrData);
    res.send(`<h2>Escanea este código con WhatsApp</h2><img src="${dataUrl}" />`);
  } catch (err) {
    res.send("❌ Error QR: " + err.message);
  }
});

// === INICIAR SERVIDOR ===
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Servidor web activo en puerto ${PORT}`);
});

// === ARRANCAR BOT ===
iniciarBot();

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

// === Arranque inicial del bot ===
iniciarBot().catch(e => console.error('❌ Error al iniciar el bot:', e));

// === Reintento programado cada 15 minutos (mantener conexión activa) ===
setInterval(() => {
  iniciarBot().catch(err => console.error('⏳ Reinicio automático forzado:', err));
}, 1000 * 60 * 15);

// === Servidor Express + Ruta /health para Render/UptimeRobot ===
const express = require('express');
const fetch = require('node-fetch');
const app = express();

// Ruta principal (para verificar que el bot esté activo)
app.get('/', (req, res) => {
  res.send('🤖 Bot Mi Semilla activo y operativo 🌱');
});

// Endpoint de salud (Render o UptimeRobot harán ping aquí)
app.get('/health', (req, res) => {
  console.log('👀 Ping recibido desde Render o UptimeRobot');
  res.status(200).send('OK');
});

// Puerto del servidor
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🌐 Servidor web activo en puerto ${PORT}`);
});

// === Auto-ping interno cada 4 minutos (mantener Render despierto) ===
setInterval(() => {
  fetch('https://bot-whatsapp-misemilla.onrender.com/health')
    .then(r => r.text())
    .then(t => console.log('💗 Ping exitoso →', t))
    .catch(e => console.warn('⚠️ Falló el ping keep-alive:', e.message));
}, 1000 * 60 * 4);

// === Guardado de sesión en Supabase (ajuste estable y sin duplicados) ===
async function guardarSesionSupabase(payload) {
  try {
    const { error } = await supabase
      .from('sesion_whatsapp')
      .upsert(
        {
          nombre: 'mi_sesion',
          datos: payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'nombre' }
      );

    if (error) console.error('⚠️ Error guardando sesión en Supabase:', error.message);
    else console.log('✅ Sesión guardada o actualizada correctamente en Supabase.');
  } catch (e) {
    console.error('❌ Excepción en guardarSesionSupabase:', e.message);
  }
}



