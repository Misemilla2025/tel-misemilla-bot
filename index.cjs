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

// ==================== COMANDO /MISDATOS ====================
bot.onText(/^\/misdatos(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const arg = (match[1] || "").trim();

  const normalizarNumero = (num = "") =>
    num.replace(/\D/g, "").replace(/^57/, "").trim();

  const tgUsername = msg.from.username
    ? "@" + msg.from.username.toLowerCase().trim()
    : null;

  await bot.sendMessage(chatId, "🔍 Consultando tus datos, por favor espera...");

  try {
    let registro = null;

    // 1️⃣ Buscar por usuario Telegram
    if (tgUsername) {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("usuario_telegram", tgUsername);
      if (error) throw error;
      if (data?.length > 0) registro = data[0];
    }

    // 2️⃣ Buscar por número (coincidencias flexibles)
    if (!registro) {
      const numero = normalizarNumero(arg);
      if (numero) {
        const { data, error } = await supabase.from(TABLE).select("*");
        if (error) throw error;

        registro = data.find((r) => {
          if (!r.usuario_telegram) return false;
          const guardado = normalizarNumero(r.usuario_telegram);
          return (
            guardado === numero ||
            "57" + guardado === numero ||
            "+57" + guardado === numero
          );
        });
      }
    }

    // 3️⃣ Si no encontró nada
    if (!registro) {
      await bot.sendMessage(
        chatId,
        "⚠️ No se encontró un registro asociado a este usuario o número.\n" +
          "Si perdiste acceso a tu cuenta o cambiaste tu usuario, usa /restaurar."
      );
      return;
    }

    // 4️⃣ Mostrar ficha
    await new Promise((res) => setTimeout(res, 700));
    await enviarFichaDatos(chatId, registro);
  } catch (err) {
    console.error("❌ Error en /misdatos:", err);
    await bot.sendMessage(
      chatId,
      "❌ Ocurrió un error al consultar tus datos. Intenta más tarde."
    );
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

// ==================== COMANDO /ACTUALIZACION ====================
bot.onText(/^\/actualizacion(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const args = (match[1] || "").trim();

  if (!args) {
    let texto = "👉 Para actualizar un campo, escribe:\n";
    texto += "`/actualizacion campo valor`\n\n";
    texto += "🧾 Ejemplos:\n";
    texto += "`/actualizacion ciudad Bogotá`\n";
    texto += "`/actualizacion nombre_completo Juan Pérez`\n";
    texto += "\nUsa /glosario para ver la lista de campos disponibles.";
    await bot.sendMessage(chatId, texto, { parse_mode: "Markdown" });
    return;
  }

  try {
    const partes = args.split(" ");
    const campo = partes.shift()?.trim().toLowerCase();
    const valorOriginal = partes.join(" ").trim();

    if (!campo || !valorOriginal) {
      await bot.sendMessage(
        chatId,
        "⚠️ Formato inválido. Usa `/actualizacion campo valor`.",
        { parse_mode: "Markdown" }
      );
      return;
    }

    // 🚫 Campos sensibles que no se pueden modificar
    const camposRestringidos = [
      "email",
      "documento",
      "celular",
      "usuario_telegram",
      "ref_telegram",
      "ref_whatsapp"
    ];

    if (camposRestringidos.includes(campo)) {
      await bot.sendMessage(
        chatId,
        `🚫 El campo *${campo}* no puede modificarse directamente por motivos de seguridad.\n` +
          "Si necesitas cambiarlo, usa /restaurar o comunícate con soporte.",
        { parse_mode: "Markdown" }
      );
      return;
    }

    // 🔠 Normaliza valor: MAYÚSCULAS excepto si es correo o similar
    const noMayus = ["email", "usuario_telegram", "ref_telegram"];
    const valor = noMayus.includes(campo)
      ? valorOriginal.trim()
      : valorOriginal.toUpperCase().trim();

    // 🔎 Buscar por usuario Telegram
    const tgUsername = msg.from.username
      ? "@" + msg.from.username.toLowerCase().trim()
      : null;

    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("usuario_telegram", tgUsername);

    if (error) throw error;
    if (!data || data.length === 0) {
      await bot.sendMessage(
        chatId,
        "⚠️ No se encontró tu registro. Verifica tu usuario o usa /restaurar."
      );
      return;
    }

    const registro = data[0];

    // 🧩 Actualiza valor
    const payload = {};
    payload[campo] = valor;
    payload["ultima_actualizacion"] = new Date().toISOString();
    payload["origen"] = "actualizacion_tg";

    const { error: e } = await supabase
      .from(TABLE)
      .update(payload)
      .eq("id", registro.id);

    if (e) throw e;

    await bot.sendMessage(
      chatId,
      `✅ Tu dato *${campo.toUpperCase()}* ha sido actualizado correctamente.`,
      { parse_mode: "Markdown" }
    );
  } catch (err) {
    console.error("❌ Error en /actualizacion:", err);
    await bot.sendMessage(
      chatId,
      "❌ Hubo un error al actualizar tus datos. Intenta más tarde."
    );
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

  // Ignorar comandos
  if (text.startsWith("/")) return;

  // Ejemplos de respuestas automáticas
  if (text.includes("hola")) {
    await bot.sendMessage(
      chatId,
      "🤖 Hola 👋\n¿Deseas consultar o actualizar tu información?\n\n" +
        "• /misdatos para ver tu registro\n" +
        "• /actualizacion para cambiar un dato\n" +
        "• /glosario para ver los campos\n" +
        "• /restaurar si perdiste acceso"
    );
  } else if (text.includes("gracias")) {
    await bot.sendMessage(chatId, "😊 ¡Con gusto! Me alegra poder ayudarte.");
  } else if (text.includes("ayuda")) {
    await bot.sendMessage(
      chatId,
      "🧭 Puedo ayudarte con estos comandos:\n" +
        "• /misdatos → Ver tu información\n" +
        "• /actualizacion → Modificar un dato\n" +
        "• /glosario → Ver los campos disponibles\n" +
        "• /restaurar → Recuperar tu cuenta"
    );
  }
});

// =============== [10] Confirmación de arranque ===============
bot.getMe()
  .then(info => console.log(`✅ Bot conectado como: @${info.username}`))
  .catch(err  => console.error("❌ Error iniciando el bot:", err.message));

setInterval(() => {}, 10000); // Evita que Render cierre el proceso