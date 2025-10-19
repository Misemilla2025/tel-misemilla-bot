// ================== SERVIDOR UNIVERSAL (Render + Local) ==================
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

// Variables desde Render (.env)
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8244545665:AAG7zy9RZenl-fOVgXxpQ1vRe2LKgMZPPMo";
const SUPABASE_URL   = process.env.SUPABASE_URL   || "https://hybozykbfehfjldhaxpp.supabase.co";
const SUPABASE_KEY   = process.env.SUPABASE_KEY   || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5Ym96eWtiZmVoZmpsZGhheHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMjU0OTMsImV4cCI6MjA3NDkwMTQ5M30.Bj1Jl3-g0gyp1UwsiK-cwjS8Cm2z7Il4_jZ-tCQhbwM";
const TABLE          = process.env.SUPABASE_TABLE || "registros_miembros";

// Inicializamos Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Variable global para el bot
let bot;

// ================== Detectamos entorno ==================
if (process.env.RENDER_EXTERNAL_URL) {
  // --- Modo WEBHOOK (Render) ---
  const app = express();
  app.use(express.json());

  const URL = process.env.RENDER_EXTERNAL_URL || "https://tel-misemilla-bot.onrender.com";

  bot = new TelegramBot(TELEGRAM_TOKEN, { webHook: true });
  bot.setWebHook(`${URL}/webhook`);

  // Endpoint para recibir mensajes de Telegram
  app.post("/webhook", (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });

  // Render necesita escuchar un puerto
  const PORT = process.env.PORT || 10000;
  app.listen(PORT, () => {
    console.log(`🚀 Bot Mi Semilla en Render activo en puerto ${PORT}`);
    console.log(`🌐 Webhook configurado en: ${URL}/webhook`);
  });
} else {
  // --- Modo POLLING (local/Termux) ---
  bot = new TelegramBot(TELEGRAM_TOKEN, {
    polling: {
      interval: 1000,
      autoStart: true,
      params: { timeout: 60 },
      request: { agentOptions: { keepAlive: true, family: 4, timeout: 30000 } },
    },
  });
  console.log("🤖 Bot Mi Semilla ejecutándose en modo Polling (local)");
}

// ===============================================================
//  Mi Semilla – Bot de Telegram (versión estable + comentada)
//  Diseñado para: node-telegram-bot-api + @supabase/supabase-js
//  Funciones clave: /misdatos /actualizacion /restaurar /glosario
// ===============================================================

// =============== [0] Auto-limpieza y dependencias (opcional) ===============
console.clear();
console.log("🧹 Limpiando archivos de estado…");
["misdatos_tg.json", "pendiente_tg.json", "restaurar_tg.json"].forEach(f => {
  try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
});
console.log("✅ Estado limpio.");

// =============== [1] Inicialización universal del cliente ===============
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// Monitoreo de errores de Telegram
bot.on("polling_error", (err) => console.error("⚠️ polling_error:", err.message));

console.log("🤖 Iniciando bot de Mi Semilla…");
console.log("⏳ Conectando con Telegram…");

// Aquí continúa toda tu lógica de comandos, mensajes y funciones personalizadas.

// =============== [4] Utilidades y constantes ===============

// Campos sensibles que NO pueden duplicarse
const SENSITIVE = new Set(["email","documento","celular","usuario_telegram"]);

// Campos que NO se convierten a mayúsculas
const NO_UPPER = new Set(["email","usuario_telegram","ref_telegram"]);

// Normaliza el username para DB: agrega @ sólo a nombres de usuario.
// (NUNCA agrega @ a números)
function normUserForDB(u){
  if(!u) return null;
  const clean = u.replace(/^@+/, "").trim();
  // si son solo dígitos → es número, no le pongas @
  if (/^\d+$/.test(clean)) return clean;
  return "@"+clean;
}

// Devuelve sólo el username crudo de Telegram (sin @)
function tUser(msg){ return msg.from?.username || null; }

// Lista real de campos en DB
function fieldList(){ return [
  "email",
  "nombre_completo",
  "documento",
  "fecha_nacimiento",
  "edad",
  "celular",
  "pais",
  "departamento",
  "ciudad",
  "barrio",
  "direccion",
  "escolaridad",
  "genero",
  "usuario_telegram",
  "vivienda_propia",
  "zona",
  "estrato",
  "personas_en_hogar",
  "personas_trabajan",
  "adultos_mayores",
  "menores",
  "servicios",
  "discapacidad",
  "detalle_discapacidad",
  "hobbies",
  "emprendimiento",
  "ref_nombre",
  "ref_telegram",
  "ref_whatsapp"
];}

// Enviar con Markdown preservando el diseño
async function send(id, txt){ return bot.sendMessage(id, txt, { parse_mode: "Markdown" }); }

// Fecha dd/mm/aaaa
function fechaCorta(d = new Date()){
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

// Archivos de estado para flujos
const MISDATOS_STATE  = "misdatos_tg.json";
const PENDIENTE_STATE = "pendiente_tg.json";
const RESTAURAR_STATE = "restaurar_tg.json";

// ======================= BLOQUE DE CHAT_ID AUTOMÁTICO =======================
bot.on("message", async (msg) => {
  const chatId = msg.chat.id.toString();
  const tgUser = msg.from.username ? "@" + msg.from.username.toLowerCase() : null;
  const texto = msg.text ? msg.text.trim() : "";
  const numero = texto.replace(/\D/g, ""); // Limpia y deja solo números

  try {
    // Buscar coincidencia por usuario_telegram o número celular
    const { data, error } = await supabase
      .from("registros_miembros")
      .select("id, chat_id, usuario_telegram, celular")
      .or(`usuario_telegram.eq.${tgUser},celular.eq.${numero}`)
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      console.log(`❌ No se encontró coincidencia para chatId ${chatId}`);
      return;
    }

    // Si encuentra coincidencia pero aún no tiene chat_id → lo guarda
    if (!data.chat_id) {
      await supabase
        .from("registros_miembros")
        .update({ chat_id: chatId })
        .eq("id", data.id);

      console.log(`✅ chat_id ${chatId} guardado para el registro ID ${data.id}`);
    } else {
      console.log(`🔹 Usuario ya tiene chat_id registrado (${data.chat_id})`);
    }
  } catch (err) {
    console.error("⚠️ Error en gestión de chat_id:", err);
  }
});

// =============== [5] Comandos base ===============

// /start
bot.onText(/^\/start\b/i, async (msg) => {
  const c = msg.chat.id;
  const u = tUser(msg);
  await send(c,
`🌱 *Hola, bienvenido al bot de Mi Semilla.*
Usa /ayuda para ver los comandos disponibles.

${u ? `Tu usuario: *@${u}*` : `*No tienes username en Telegram.* Configúralo o usa */restaurar* con documento/email.`}`);
});

// /info
bot.onText(/^\/info\b/i, async (msg) => {
  await send(msg.chat.id,
"ℹ️ *Mi Semilla* es un programa de apoyo comunitario y humanitario.\n" +
"📌 A través de este bot puedes consultar, actualizar y validar tu registro.\n" +
"🌍 Nuestro objetivo es mantener tu información al día y fortalecer la red de ayuda.");
});

// /ayuda
bot.onText(/^\/ayuda\b/i, async (msg) => {
  await send(msg.chat.id,
"📖 *Comandos disponibles:*\n\n" +
"🟢 /start – Saludo inicial\n" +
"ℹ️ /info – Información general\n" +
"❓ /ayuda – Este menú\n" +
"📋 /misdatos – Consulta tus datos registrados\n" +
"🧩 /glosario – Campos que puedes actualizar\n" +
"✏️ /actualizacion – Modifica tu información\n" +
"♻️ /restaurar – Vincula tu cuenta si perdiste acceso");
});

// ===============================================================
// [GLOSARIO] Campos disponibles para actualización y consulta
// ===============================================================
bot.onText(/\/glosario/i, async (msg) => {
  const chatId = msg.chat.id;

  const texto = `
📘 *Glosario de actualización de datos*

╔💠 *DATOS PERSONALES:*
• email  
• nombre\\_completo  
• documento  
• fecha\\_nacimiento  
• edad  
• genero  
• escolaridad  

╠📞 *CONTACTO:*
• celular  
• usuario\\_telegram  

╠📍 *UBICACIÓN:*
• pais  
• departamento  
• ciudad  
• barrio  
• direccion  

╠🏠 *HOGAR:*
• vivienda\\_propia  
• zona  
• estrato  
• personas\\_en\\_hogar  
• personas\\_trabajan  
• adultos\\_mayores  
• menores  

╠🧩 *SERVICIOS:*
• servicios  
• discapacidad  
• detalle\\_discapacidad  

╠🧠 *INTERESES:*
• hobbies  
• emprendimiento  

╠🤝 *REFERENCIAS:*
• ref\\_nombre  
• ref\\_telegram  
• ref\\_whatsapp  

╚🚫 *No se pueden duplicar:*
• email  
• documento  
• celular  
• usuario\\_telegram  

📝 *Ejemplo de uso:*  
\`/actualizacion ciudad Bogotá\`  
\`/actualizacion nombre_completo Juan Pérez\`
`;

  await bot.sendMessage(chatId, texto, { parse_mode: "MarkdownV2" });
});

// ======================= /MISDATOS (búsqueda segura y robusta) =======================
bot.onText(/^\/misdatos(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = msg.chat.id.toString();
  const entrada = (match[1] || "").trim();
  const tgUsername = msg.from.username ? ("@" + msg.from.username.toLowerCase()) : null;

  const normalizarNumero = (s = "") =>
    (s + "").replace(/\D/g, ""); // solo dígitos

  const variantesNumero = (s = "") => {
    const d = normalizarNumero(s);
    if (!d) return [];
    // si viene con 57 al inicio, también generar sin 57 (por si la base guarda local)
    if (d.startsWith("57") && d.length === 12) {
      const sin = d.slice(2);
      return [d, sin, "+57" + sin];
    }
    // si viene local 10 dígitos, generar con 57 y +57
    if (d.length === 10) return [d, "57" + d, "+57" + d];
    // cualquier otro largo: igual probar tal cual
    return [d];
  };

  const esUsuarioVacio = (u) => !u || !String(u).trim();

  await bot.sendMessage(chatId, "🔍 Consultando tus datos, por favor espera...");

  try {
    let registro = null;

    // 1) Si tengo @usuario en Telegram → buscar por usuario_telegram exacto
    if (tgUsername) {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("usuario_telegram", tgUsername)
        .maybeSingle();
      if (error) throw error;
      if (data) registro = data;
    }

    // 2) Si no se halló por usuario, probar por chat_id (para registros sin usuario_telegram)
    if (!registro) {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("chat_id", chatId)
        .maybeSingle();
      if (error) throw error;
      if (data) registro = data;
    }

    // 3) Si vino un número en el comando, probar por celular con variantes
    //    Esto permite a quienes NO tienen usuario_telegram validar por celular
    if (!registro && entrada) {
      const dig = normalizarNumero(entrada);
      if (dig) {
        // intentamos traer candidatos por OR (todas las variantes)
        const ors = variantesNumero(entrada)
          .map(v => `celular.eq.${v}`)
          .join(",");
        if (ors) {
          const { data, error } = await supabase
            .from(TABLE)
            .select("*")
            .or(ors)
            .limit(1);
          if (error) throw error;
          if (data && data.length) registro = data[0];
        }
      }
    }

    // 4) Si no hay nada, salida directa
    if (!registro) {
      await bot.sendMessage(chatId, "⚠️ No se encontró ningún registro asociado.");
      return;
    }

    // 5) Validaciones de acceso
    const tieneUsuario = !esUsuarioVacio(registro.usuario_telegram);
    const coincideUsuario = tgUsername && (registro.usuario_telegram || "").toLowerCase() === tgUsername.toLowerCase();
    const coincideChatId = (registro.chat_id || "").toString() === chatId;

    // si el registro TIENE usuario_telegram, solo el mismo @ puede ver
    if (tieneUsuario && !coincideUsuario) {
      await bot.sendMessage(chatId, "🚫 Este registro está vinculado a otro usuario de Telegram.");
      return;
    }

    // si NO tiene usuario_telegram, debe coincidir chat_id o el celular exacto del comando
    if (!tieneUsuario && !coincideChatId) {
      if (entrada) {
        const ent = normalizarNumero(entrada);
        const cel = normalizarNumero(registro.celular || "");
        const okNumero = variantesNumero(cel).includes(ent) || variantesNumero(ent).includes(cel);
        if (!okNumero) {
          await bot.sendMessage(chatId, "⚠️ No se encontró coincidencia exacta con tu cuenta o número.");
          return;
        }
      } else {
        await bot.sendMessage(chatId, "⚠️ No se encontró coincidencia exacta con tu cuenta o número.");
        return;
      }
    }

    // 6) Vincular chat_id si estaba vacío (mejora futura coincidencia)
    if (!registro.chat_id) {
      await supabase.from(TABLE).update({ chat_id: chatId }).eq("id", registro.id);
    }

    // 7) Mostrar ficha (usas tu función actual, que ya arma toda la tabla)
    await enviarFichaDatos(chatId, registro);

  } catch (err) {
    console.error("❌ Error en /misdatos:", err);
    await bot.sendMessage(chatId, "⚠️ Error al consultar tus datos. Intenta nuevamente.");
  }
});

// ======================= FUNCIÓN DE ENVÍO DE DATOS =======================
async function enviarFichaDatos(chatId, r) {
  let texto = "📋 *TUS DATOS REGISTRADOS*\n\n";

  texto += "╔💠 *DATOS PERSONALES:*\n";
  texto += `• Nombre: ${r.nombre_completo?.toUpperCase() || "—"}\n`;
  texto += `• Documento: ${r.documento?.toUpperCase() || "—"}\n`;
  texto += `• Fecha Nac.: ${r.fecha_nacimiento || "—"}\n`;
  texto += `• Edad: ${r.edad || "—"}\n`;
  texto += `• Género: ${r.genero?.toUpperCase() || "—"}\n`;
  texto += `• Escolaridad: ${r.escolaridad?.toUpperCase() || "—"}\n\n`;

  texto += "╠📞 *CONTACTO:*\n";
  texto += `• Celular: ${r.celular || "—"}\n`;
  texto += `• Usuario Telegram: ${r.usuario_telegram || "—"}\n`;
  texto += `• Email: ${r.email || "—"}\n\n`;

  texto += "╠📍 *UBICACIÓN:*\n";
  texto += `• País: ${r.pais?.toUpperCase() || "—"}\n`;
  texto += `• Departamento: ${r.departamento?.toUpperCase() || "—"}\n`;
  texto += `• Ciudad: ${r.ciudad?.toUpperCase() || "—"}\n`;
  texto += `• Barrio: ${r.barrio?.toUpperCase() || "—"}\n`;
  texto += `• Dirección: ${r.direccion?.toUpperCase() || "—"}\n\n`;

  texto += "╠🏠 *HOGAR:*\n";
  texto += `• Vivienda Propia: ${r.vivienda_propia?.toUpperCase() || "—"}\n`;
  texto += `• Zona: ${r.zona?.toUpperCase() || "—"}\n`;
  texto += `• Estrato: ${r.estrato || "—"}\n`;
  texto += `• Personas en Hogar: ${r.personas_en_hogar || "—"}\n`;
  texto += `• Personas que Trabajan: ${r.personas_trabajan || "—"}\n`;
  texto += `• Adultos Mayores: ${r.adultos_mayores || "—"}\n`;
  texto += `• Menores: ${r.menores || "—"}\n\n`;

  texto += "╠🧩 *SERVICIOS:*\n";
  texto += `• Servicios: ${r.servicios?.toUpperCase() || "—"}\n`;
  texto += `• Discapacidad: ${r.discapacidad?.toUpperCase() || "—"}\n`;
  texto += `• Detalle Discapacidad: ${r.detalle_discapacidad?.toUpperCase() || "—"}\n\n`;

  texto += "╠🧠 *INTERESES:*\n";
  texto += `• Hobbies: ${r.hobbies?.toUpperCase() || "—"}\n`;
  texto += `• Emprendimiento: ${r.emprendimiento?.toUpperCase() || "—"}\n\n`;

  texto += "╚🤝 *REFERENCIAS:*\n";
  texto += `• Nombre Ref.: ${r.ref_nombre?.toUpperCase() || "—"}\n`;
  texto += `• Telegram Ref.: ${r.ref_telegram || "—"}\n`;
  texto += `• WhatsApp Ref.: ${r.ref_whatsapp || "—"}\n\n`;

  texto += "📝 *Para actualizar tus datos usa:* `/actualizacion campo valor`\n";
  texto += "📘 *Para conocer los nombres de los campos usa:* `/glosario`";

  await bot.sendMessage(chatId, texto, { parse_mode: "Markdown" });
}

// ======================= COMANDO /ACTUALIZACION =======================
bot.onText(/^\/actualizacion(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const texto = match[1]?.trim();

  if (!texto) {
    await bot.sendMessage(
      chatId,
      "🧩 *Guía de actualización de datos*\n\n" +
      "Usa el formato:\n`/actualizacion campo valor`\n" +
      "Ejemplo:\n`/actualizacion ciudad Bogotá`\n\n" +
      "Si no recuerdas los campos disponibles, usa 👉 /glosario 📘",
      { parse_mode: "Markdown" }
    );
    return;
  }

  const partes = texto.split(" ");
  const campo = partes.shift()?.trim();
  const valor = partes.join(" ").trim();

  const usuario = msg.from.username
    ? '@' + msg.from.username.toLowerCase()
    : msg.from.id.toString();

  try {
    const { data: registros, error: errBuscar } = await supabase
      .from(TABLE)
      .select("*")
      .or(`usuario_telegram.eq.${usuario},celular.eq.${usuario},email.eq.${usuario},documento.eq.${usuario}`);

    if (errBuscar) throw errBuscar;

    if (!registros || registros.length === 0) {
      await bot.sendMessage(chatId, "⚠️ No encontré tu registro asociado a este Telegram. Usa /restaurar.");
      return;
    }

    if (registros.length > 1) {
      await bot.sendMessage(chatId, "⚠️ Se encontraron duplicados. Contacta al administrador para resolverlo.");
      return;
    }

    const id = registros[0].id;
    const registroActual = registros[0];
    const camposProtegidos = ["email", "documento", "celular", "usuario_telegram"];
    const camposMinuscula = ["email", "usuario_telegram"];

    // ✅ Verificar si el nuevo valor es igual al actual
    if (registroActual[campo] && registroActual[campo].toString().toLowerCase() === valor.toLowerCase()) {
      await bot.sendMessage(chatId, `⚠️ No se realizaron cambios. El valor ingresado ya está registrado en ${campo}.`);
      return;
    }

    // 🚫 Evitar duplicación de campos críticos
    if (camposProtegidos.includes(campo)) {
      const { data: existe, error: errDup } = await supabase
        .from(TABLE)
        .select("id")
        .eq(campo, valor);

      if (errDup) throw errDup;
      if (existe && existe.length > 0 && existe[0].id !== id) {
        await bot.sendMessage(chatId, `🚫 Ese ${campo} ya está en uso. No se puede actualizar.`);
        return;
      }
    }

    // ⚠️ Confirmación para campos sensibles
    if (camposProtegidos.includes(campo)) {
      await bot.sendMessage(
        chatId,
        `⚠️ *Alerta:* El campo *${campo}* es un dato sensible.\n` +
        "Este cambio puede afectar tu acceso.\n" +
        "¿Deseas continuar con la actualización? Responde *sí* o *no*.",
        { parse_mode: "Markdown" }
      );

      // Guardamos temporalmente los datos en memoria
      global.confirmacionPendiente = {
        chatId,
        id,
        campo,
        valor,
        campoMinuscula: camposMinuscula.includes(campo)
      };
      return;
    }

    // 🧩 Si no es sensible, actualizar directamente
    const valorFinal = camposMinuscula.includes(campo) ? valor : valor.toUpperCase();

    const { error: errUpdate } = await supabase
      .from(TABLE)
      .update({ [campo]: valorFinal })
      .eq("id", id);

    if (errUpdate) throw errUpdate;

    await bot.sendMessage(
      chatId,
      `✅ *${campo}* actualizado correctamente a *${valorFinal}*.`,
      { parse_mode: "Markdown" }
    );

  } catch (err) {
    console.error("❌ Error en /actualizacion:", err);
    await bot.sendMessage(chatId, "❌ Error al procesar tu actualización. Intenta más tarde.");
  }
});


// ======================= CONFIRMACIÓN DE CAMPOS SENSIBLES =======================
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const texto = msg.text?.toLowerCase().trim();

  if (!global.confirmacionPendiente) return;
  const pendiente = global.confirmacionPendiente;
  if (chatId !== pendiente.chatId) return;

  // Acepta “sí”, “si” y “no”
  if (!["sí", "si", "no"].includes(texto)) return;

  if (texto === "no") {
    await bot.sendMessage(chatId, "❌ Actualización cancelada por el usuario.");
    global.confirmacionPendiente = null;
    return;
  }

  try {
    const valorFinal = pendiente.campoMinuscula ? pendiente.valor : pendiente.valor.toUpperCase();

    const { error: errUpdate } = await supabase
      .from(TABLE)
      .update({ [pendiente.campo]: valorFinal })
      .eq("id", pendiente.id);

    if (errUpdate) throw errUpdate;

    const fecha = new Date().toLocaleDateString("es-CO");
    await bot.sendMessage(
      chatId,
      `✅ Tu campo *${pendiente.campo}* fue actualizado correctamente a *${valorFinal}*.\n📅 Actualizado el ${fecha}`,
      { parse_mode: "Markdown" }
    );

    global.confirmacionPendiente = null;
  } catch (err) {
    console.error("❌ Error en confirmación:", err);
    await bot.sendMessage(chatId, "❌ Error al confirmar la actualización.");
    global.confirmacionPendiente = null;
  }
});
// =============== [8] /restaurar (documento/email → elegir qué vincular → confirmar) ===============
bot.onText(/^\/restaurar\b/i, async (msg) => {
  const c = msg.chat.id;
  await send(c,
`♻️ *Restauración de cuenta*

Puedes restaurar con tu *documento* o con tu *email*.
Escribe: \`documento\` o \`email\`.`);

  fs.writeFileSync(RESTAURAR_STATE, JSON.stringify({ estado: "elige_modo", chatId: c }));
});

// Flujo de restauración
bot.on("message", async (msg) => {
  if (!fs.existsSync(RESTAURAR_STATE)) return;

  const c   = msg.chat.id;
  const txt = (msg.text || "").trim();
  let st    = JSON.parse(fs.readFileSync(RESTAURAR_STATE, "utf8"));

  if (st.chatId !== c) return;
  if (txt.startsWith("/")) return; // no interferir con otros comandos

  // Paso 1: elegir modo (documento o email)
  if (st.estado === "elige_modo") {
    const low = txt.toLowerCase();
    if (low.includes("documento")) {
      st.campo = "documento";
      st.estado = "esperando_dato";
      await send(c, "📄 Escribe tu *número de documento*:");
    } else if (low.includes("email")) {
      st.campo = "email";
      st.estado = "esperando_dato";
      await send(c, "📧 Escribe tu *email*:");
    } else {
      await send(c, "❌ Opción inválida. Escribe *documento* o *email*.");
    }
    fs.writeFileSync(RESTAURAR_STATE, JSON.stringify(st));
    return;
  }

  // Paso 2: recibir documento/email y buscar
  if (st.estado === "esperando_dato") {
    const valor = txt;
    const { data, error } = await supabase
      .from(TABLE)
      .select("id,nombre_completo,email,usuario_telegram,celular")
      .or(`${st.campo}.eq.${valor},${st.campo}.ilike.%${valor}%`)
      .maybeSingle();

    if (error) { console.error(error); await send(c, "⚠️ Error al buscar tu información. Intenta nuevamente."); return; }
    if (!data) { await send(c, "❌ No se encontró ningún registro con ese dato."); return; }

    st.id = data.id;

    await send(c,
`✅ *Registro encontrado:*
👤 ${data.nombre_completo || "Sin nombre"}
📧 ${data.email || "Sin email"}

Ahora, *¿qué deseas vincular?*  
- Escribe tu *@usuario de Telegram* (con @), o  
- Escribe tu *número de celular* (solo dígitos, *sin +*).`);

    st.estado = "elige_vinculo";
    fs.writeFileSync(RESTAURAR_STATE, JSON.stringify(st));
    return;
  }

  // Paso 3: elegir qué vincular (usuario o celular), validar y confirmar
  if (st.estado === "elige_vinculo") {
    const val = txt.trim();

    // ¿Usuario de Telegram?
    if (val.startsWith("@")) {
      const nuevoUsuario = normUserForDB(val); // asegura @ y no números
      // Duplicado
      const { data: ex } = await supabase.from(TABLE).select("id").eq("usuario_telegram", nuevoUsuario).maybeSingle();
      if (ex) { await send(c, "🚫 Ese *usuario de Telegram* ya está en uso por otra cuenta."); return; }

      st.vinculo = "usuario_telegram";
      st.nuevo   = nuevoUsuario;
      await send(c, `🔗 Vincularás *usuario_telegram* = *${nuevoUsuario}*.\n¿Confirmas? Responde *sí* o *no*.`);
      st.estado = "confirmar";
      fs.writeFileSync(RESTAURAR_STATE, JSON.stringify(st));
      return;
    }

    // ¿Celular numérico?
    if (/^\d+$/.test(val)) {
      // Duplicado
      const { data: ex } = await supabase.from(TABLE).select("id").eq("celular", val).maybeSingle();
      if (ex) { await send(c, "🚫 Ese *número de celular* ya está en uso por otra cuenta."); return; }

      st.vinculo = "celular";
      st.nuevo   = val;
      await send(c, `🔗 Vincularás *celular* = *${val}*.\n¿Confirmas? Responde *sí* o *no*.`);
      st.estado = "confirmar";
      fs.writeFileSync(RESTAURAR_STATE, JSON.stringify(st));
      return;
    }

    await send(c, "❌ Formato inválido. Escribe *@usuario* (con @) o *celular* (solo dígitos, sin +).");
    return;
  }

  // Paso 4: confirmar y actualizar
  if (st.estado === "confirmar") {
    const low = txt.toLowerCase();
    if (low === "no") {
      await send(c, "❌ Restauración cancelada.");
      fs.unlinkSync(RESTAURAR_STATE);
      return;
    }
    if (low === "sí" || low === "si" || low === "s") {
      const payload = { [st.vinculo]: st.nuevo, ultima_actualizacion: new Date().toISOString(), origen: "restaurar_tg" };
      const { error: e } = await supabase.from(TABLE).update(payload).eq("id", st.id);
      if (e) { console.error(e); await send(c, "⚠️ Error al restaurar tu cuenta."); }
      else   { await send(c, "✅ *Restauración completada*.\nUsa */misdatos* para verificar.\n📅 *Actualizado el* " + fechaCorta()); }
      fs.unlinkSync(RESTAURAR_STATE);
      return;
    }
    // Si escribe otra cosa ≠ sí/no, no hacemos nada (esperamos respuesta válida)
  }
});

// ================== RESPUESTAS INTELIGENTES ==================
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim().toLowerCase();

  // Ignorar comandos y respuestas de confirmación
  if (text.startsWith("/")) return;
  if (["sí", "si", "no", "s"].includes(text)) return;

  // ====== SALUDOS ======
  if (text.includes("hola") || text.includes("buenas") || text.includes("saludos")) {
    await bot.sendMessage(
      chatId,
      "🤖 ¡Hola! 👋\nBienvenido(a) al asistente de *Mi Semilla* 🌱\n\n" +
      "¿Qué deseas hacer hoy?\n\n" +
      "• /misdatos → Ver tu información\n" +
      "• /actualizacion → Modificar un dato\n" +
      "• /glosario → Ver los campos disponibles\n" +
      "• /restaurar → Recuperar tu cuenta"
    );
    return;
  }

  // ====== PALABRAS CLAVE DE AYUDA ======
  if (
    text.includes("ayuda") ||
    text.includes("orienta") ||
    text.includes("cómo empiezo") ||
    text.includes("qué debo hacer") ||
    text.includes("necesito actualizar") ||
    text.includes("consultar") ||
    text.includes("información") ||
    text.includes("actualizar")
  ) {
    await bot.sendMessage(
      chatId,
      "🧭 Puedo ayudarte con estos comandos:\n\n" +
      "• /misdatos → Ver tu información actual registrada.\n" +
      "• /actualizacion → Modificar un dato específico.\n" +
      "• /glosario → Ver los nombres de los campos disponibles.\n" +
      "• /restaurar → Recuperar tu cuenta si cambiaste usuario o celular.\n\n" +
      "✉️ Escribe por ejemplo:\n`/actualizacion ciudad Bogotá` o `/misdatos`"
    );
    return;
  }

  // ====== AGRADECIMIENTOS ======
  if (text.includes("gracias") || text.includes("te agradezco") || text.includes("muy amable")) {
    await bot.sendMessage(chatId, "😊 ¡Con gusto! Siempre estoy aquí para ayudarte 🌻");
    return;
  }

  // ====== DESPEDIDAS ======
  if (
    text.includes("adiós") ||
    text.includes("chao") ||
    text.includes("nos vemos") ||
    text.includes("hasta luego")
  ) {
    await bot.sendMessage(chatId, "👋 ¡Hasta pronto! Que tengas un excelente día 🌿");
    return;
  }

  // ====== PALABRAS DE ERROR O CONFUSIÓN ======
  if (
    text.includes("no entiendo") ||
    text.includes("no sé") ||
    text.includes("error") ||
    text.includes("ayúdame") ||
    text.includes("problema")
  ) {
    await bot.sendMessage(
      chatId,
      "⚙️ Parece que necesitas un poco de ayuda.\n\n" +
      "Prueba con alguno de estos comandos:\n" +
      "• /misdatos → Consultar tu información.\n" +
      "• /actualizacion → Modificar un dato.\n" +
      "• /restaurar → Si perdiste acceso o cambiaste tu usuario."
    );
    return;
  }

  // ====== RESPUESTA POR DEFECTO ======
  await bot.sendMessage(
    chatId,
    "🤔 No entendí tu mensaje, pero puedo ayudarte con:\n\n" +
      "• /misdatos → Ver tus datos\n" +
      "• /actualizacion → Modificar información\n" +
      "• /glosario → Ver los campos disponibles\n" +
      "• /restaurar → Recuperar tu cuenta"
  );
});
// =============== [10] Confirmación de arranque ===============
bot.getMe()
  .then(info => console.log(`✅ Bot conectado como: @${info.username}`))
  .catch(err  => console.error("❌ Error iniciando el bot:", err.message));

setInterval(() => {}, 10000); // Evita que Render cierre el proceso