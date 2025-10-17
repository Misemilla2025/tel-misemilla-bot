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

// ======================= COMANDO /MISDATOS =======================
bot.onText(/^\/misdatos/, async (msg) => {
  const chatId = msg.chat.id;
  const usuario = msg.from.username ? msg.from.username.toLowerCase() : msg.from.id.toString();

  await bot.sendMessage(chatId, "🔎 Consultando tus datos, por favor espera...");

  try {
    // Búsqueda flexible por Telegram, celular, email o documento
    const { data: registros, error } = await supabase
      .from(TABLE)
      .select("*")
      .or(`usuario_telegram.eq.${usuario},celular.eq.${usuario},email.eq.${usuario},documento.eq.${usuario}`);

    if (error) throw error;

    if (!registros || registros.length === 0) {
      await bot.sendMessage(chatId, "⚠️ No encontré tu registro asociado a este Telegram.\nUsa /restaurar para vincular tu cuenta.");
      return;
    }

    const r = registros[0];
    let texto = `📘 *TUS DATOS REGISTRADOS*\n\n`;

    texto += `╔💠 *DATOS PERSONALES:*\n`;
    texto += `• Nombre: ${r.nombre_completo || "—"}\n`;
    texto += `• Documento: ${r.documento || "—"}\n`;
    texto += `• Fecha Nac.: ${r.fecha_nacimiento || "—"}\n`;
    texto += `• Edad: ${r.edad || "—"}\n`;
    texto += `• Género: ${r.genero || "—"}\n`;
    texto += `• Escolaridad: ${r.escolaridad || "—"}\n\n`;

    texto += `╠📞 *CONTACTO:*\n`;
    texto += `• Celular: ${r.celular || "—"}\n`;
    texto += `• Usuario Telegram: ${r.usuario_telegram || "—"}\n\n`;

    texto += `╠📍 *UBICACIÓN:*\n`;
    texto += `• País: ${r.pais || "—"}\n`;
    texto += `• Departamento: ${r.departamento || "—"}\n`;
    texto += `• Ciudad: ${r.ciudad || "—"}\n`;
    texto += `• Barrio: ${r.barrio || "—"}\n`;
    texto += `• Dirección: ${r.direccion || "—"}\n\n`;

    texto += `╠🏠 *HOGAR:*\n`;
    texto += `• Vivienda Propia: ${r.vivienda_propia || "—"}\n`;
    texto += `• Zona: ${r.zona || "—"}\n`;
    texto += `• Estrato: ${r.estrato || "—"}\n`;
    texto += `• Personas en Hogar: ${r.personas_en_hogar || "—"}\n`;
    texto += `• Personas que Trabajan: ${r.personas_trabajan || "—"}\n`;
    texto += `• Adultos Mayores: ${r.adultos_mayores || "—"}\n`;
    texto += `• Menores: ${r.menores || "—"}\n\n`;

    texto += `╠🧩 *SERVICIOS:*\n`;
    texto += `• Servicios: ${r.servicios || "—"}\n`;
    texto += `• Discapacidad: ${r.discapacidad || "—"}\n`;
    texto += `• Detalle Discapacidad: ${r.detalle_discapacidad || "—"}\n\n`;

    texto += `╠🧠 *INTERESES:*\n`;
    texto += `• Hobbies: ${r.hobbies || "—"}\n`;
    texto += `• Emprendimiento: ${r.emprendimiento || "—"}\n\n`;

    texto += `╚🤝 *REFERENCIAS:*\n`;
    texto += `• Nombre Ref.: ${r.ref_nombre || "—"}\n`;
    texto += `• Telegram Ref.: ${r.ref_telegram || "—"}\n`;
    texto += `• WhatsApp Ref.: ${r.ref_whatsapp || "—"}\n\n`;

    texto += `📝 Usa /actualizacion para modificar algún dato.`;

    await bot.sendMessage(chatId, texto, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("❌ Error en /misdatos:", err);
    await bot.sendMessage(chatId, "⚠️ Error al consultar tus datos. Intenta de nuevo más tarde.");
  }
});

// ======================= COMANDO /ACTUALIZACION =======================
bot.onText(/^\/actualizacion (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const usuario = msg.from.username ? msg.from.username.toLowerCase() : msg.from.id.toString();
  const entrada = match[1].trim();

  // Detectar formato "campo valor"
  const [campo, ...valorArray] = entrada.split(" ");
  const valor = valorArray.join(" ").trim();

  if (!campo || !valor) {
    await bot.sendMessage(chatId, "⚠️ Usa el formato correcto:\n`/actualizacion campo valor`\n\nEjemplo: `/actualizacion ciudad Bogotá`", {
      parse_mode: "Markdown",
    });
    return;
  }

  await bot.sendMessage(chatId, `✏️ Actualizando *${campo}* a *${valor}*...`, { parse_mode: "Markdown" });

  try {
    // Verificar existencia del usuario
    const { data: registro, error: errBuscar } = await supabase
      .from(TABLE)
      .select("*")
      .or(`usuario_telegram.eq.${usuario},celular.eq.${usuario},email.eq.${usuario},documento.eq.${usuario}`);

    if (errBuscar) throw errBuscar;
    if (!registro || registro.length === 0) {
      await bot.sendMessage(chatId, "⚠️ No se encontró tu registro. Usa /restaurar para vincular tu cuenta.");
      return;
    }

    const id = registro[0].id;

    // Validar duplicados solo para campos clave
    const camposDuplicados = ["email", "documento", "celular", "usuario_telegram"];
    if (camposDuplicados.includes(campo)) {
      const { data: existe } = await supabase
        .from(TABLE)
        .select("id")
        .or(`email.eq.${valor},documento.eq.${valor},celular.eq.${valor},usuario_telegram.eq.${valor}`);

      if (existe && existe.length > 0 && existe[0].id !== id) {
        await bot.sendMessage(chatId, "🚫 Ese valor ya está asociado a otro registro. No se puede actualizar.");
        return;
      }
    }

    // Ejecutar la actualización
    const { error: errUpdate } = await supabase.from(TABLE).update({ [campo]: valor }).eq("id", id);

    if (errUpdate) throw errUpdate;

    await bot.sendMessage(chatId, `✅ *${campo}* actualizado correctamente a *${valor}*.`, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("❌ Error en /actualizacion:", err);
    await bot.sendMessage(chatId, "⚠️ Error al procesar la actualización. Intenta más tarde.");
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

// =============== [9] Respuestas inteligentes (no invaden flujos activos) ===============
bot.on("message", async (msg) => {
  const c = msg.chat.id;
  const txt = (msg.text || "").trim();
  if (!txt) return;

  // Si hay procesos guiados activos, no disparamos respuestas automáticas
  const hayFlujo = fs.existsSync(PENDIENTE_STATE) || fs.existsSync(RESTAURAR_STATE) || fs.existsSync(MISDATOS_STATE);
  if (hayFlujo && !txt.startsWith("/")) return;
  if (txt.startsWith("/")) return; // comandos ya tienen sus handlers

  const lower = txt.toLowerCase();

  if (/^(hola|buenas|saludos|buen día|buenas tardes|buenas noches)\b/.test(lower)) {
    await send(c, "👋 ¡Hola! Usa /ayuda para ver lo que puedo hacer.");
    return;
  }

  if (/(ayuda|soporte|problema|no entiendo|quien me ayuda)/.test(lower)) {
    await send(c,
"🤝 *Centro de ayuda de Mi Semilla*\n\n" +
"📄 `/misdatos` → consulta tu registro\n" +
"🛠️ `/actualizacion` → modifica tus datos\n" +
"📘 `/glosario` → ver campos\n" +
"♻️ `/restaurar` → vincular si perdiste acceso");
    return;
  }

  if (/(actualizar|cambiar|modificar|editar|necesito)/.test(lower)) {
    await send(c,
"✏️ Veo que deseas *actualizar tus datos*.\n\n" +
"Usa:\n`/actualizacion campo valor`\n" +
"Ejemplo:\n`/actualizacion ciudad Bogotá`\n\n" +
"Para ver los campos disponibles: `/glosario`");
    return;
  }

  if (/(gracias|ok|listo|perfecto)/.test(lower)) {
    await send(c, "✅ ¡Listo! Si necesitas algo más, aquí estoy. 🙌");
    return;
  }

  // Mensaje por defecto
  await send(c,
"🤖 Hola 👋\n\n" +
"¿Deseas consultar o actualizar tu información?\n\n" +
"• `/misdatos` para ver tu registro\n" +
"• `/actualizacion` para cambiar un dato\n" +
"• `/glosario` para ver los campos\n" +
"• `/restaurar` si perdiste acceso");
});

// =============== [10] Confirmación de arranque ===============
bot.getMe()
  .then(info => console.log(`✅ Bot conectado como: @${info.username}`))
  .catch(err  => console.error("❌ Error iniciando el bot:", err.message));