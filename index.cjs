// ================== BOT TELEGRAM – MI SEMILLA (Rail-ready) ==================
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

// ================== VARIABLES DE ENTORNO ==================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const SUPABASE_URL   = process.env.SUPABASE_URL;
const SUPABASE_KEY   = process.env.SUPABASE_KEY;
const TABLE          = process.env.SUPABASE_TABLE || "registros_miembros";

// Inicializamos Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ================== CONFIGURACIÓN RAIL ==================
const app = express();
app.use(express.json());

const URL = process.env.RAIL_URL;

const bot = new TelegramBot(TELEGRAM_TOKEN, { webHook: true });
bot.setWebHook(`${URL}/webhook`);

app.post("/webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Bot Mi Semilla activo en puerto ${PORT}`);
  console.log(`🌐 Webhook: ${URL}/webhook`);
});

// ================== UTILIDADES ==================
async function send(id, txt){
  return bot.sendMessage(id, txt, { parse_mode: "Markdown" });
}

const SENSITIVE = ["email","documento","celular","usuario_telegram"];

// ================== COMANDOS ==================

// /start
bot.onText(/^\/start\b/i, async (msg) => {
  await send(msg.chat.id,
`🌱 *Bienvenido al bot de Mi Semilla*

📋 Consulta tus datos con /misdatos  
✏️ Actualiza información con /actualizacion  
📘 Campos disponibles con /glosario  
♻️ Recupera acceso con /restaurar`
  );
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
`📖 *Comandos disponibles*
• /start
• /info
• /misdatos
• /actualizacion
• /glosario
• /restaurar`
  );
});

// ================== GLOSARIO ==================
bot.onText(/\/glosario/i, async (msg) => {
  const texto = `
📘 *Glosario de actualización*

╔💠 *DATOS PERSONALES*
• email
• primer\\_nombre
• segundo\\_nombre
• apellidos
• tipo\\_documento
• documento
• fecha\\_nacimiento
• edad
• genero
• escolaridad

╠📞 *CONTACTO*
• indicativo
• celular
• usuario\\_telegram
• codigo\\_postal

╠📍 *UBICACIÓN*
• pais
• departamento
• ciudad
• barrio
• direccion

╠🏠 *HOGAR*
• vivienda\\_propia
• zona
• estrato
• personas\\_en\\_hogar
• personas\\_trabajan
• adultos\\_mayores
• menores

╠🧩 *SERVICIOS*
• servicios
• discapacidad
• detalle\\_discapacidad

╠🧠 *INTERESES*
• hobbies
• emprendimiento

╠🤝 *REFERENCIAS*
• ref\\_nombre
• ref\\_telegram
• ref\\_whatsapp

╚🚫 *No duplicables*
• email
• documento
• celular
• usuario\\_telegram
`;
  await bot.sendMessage(msg.chat.id, texto, { parse_mode: "Markdown" });
});

// ================== /misdatos ==================
bot.onText(/^\/misdatos\b/i, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  await send(chatId, "🔍 Consultando tus datos...");

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (error || !data) {
    await send(chatId,
`⚠️ No se encontró un registro vinculado a este Telegram.
Usa /restaurar si cambiaste de cuenta.`);
    return;
  }

  await enviarFichaDatos(chatId, data);
});

// ================== TABLA BONITA ==================
async function enviarFichaDatos(chatId, r){
  let t = "📋 *TUS DATOS REGISTRADOS*\n\n";

  t += "╔💠 *DATOS PERSONALES*\n";
  t += `• Primer Nombre: ${r.primer_nombre||"—"}\n`;
  t += `• Segundo Nombre: ${r.segundo_nombre||"—"}\n`;
  t += `• Apellidos: ${r.apellidos||"—"}\n`;
  t += `• Tipo Documento: ${r.tipo_documento||"—"}\n`;
  t += `• Documento: ${r.documento||"—"}\n`;
  t += `• Fecha Nac.: ${r.fecha_nacimiento||"—"}\n`;
  t += `• Edad: ${r.edad||"—"}\n`;
  t += `• Género: ${r.genero||"—"}\n`;
  t += `• Escolaridad: ${r.escolaridad||"—"}\n\n`;

  t += "╠📞 *CONTACTO*\n";
  t += `• Indicativo: ${r.indicativo||"—"}\n`;
  t += `• Celular: ${r.celular||"—"}\n`;
  t += `• Email: ${r.email||"—"}\n`;
  t += `• Usuario Telegram: ${r.usuario_telegram||"—"}\n`;
  t += `• Código Postal: ${r.codigo_postal||"—"}\n\n`;

  t += "╠📍 *UBICACIÓN*\n";
  t += `• País: ${r.pais||"—"}\n`;
  t += `• Departamento: ${r.departamento||"—"}\n`;
  t += `• Ciudad: ${r.ciudad||"—"}\n`;
  t += `• Barrio: ${r.barrio||"—"}\n`;
  t += `• Dirección: ${r.direccion||"—"}\n\n`;

  t += "╠🏠 *HOGAR*\n";
  t += `• Vivienda Propia: ${r.vivienda_propia||"—"}\n`;
  t += `• Zona: ${r.zona||"—"}\n`;
  t += `• Estrato: ${r.estrato||"—"}\n`;
  t += `• Personas Hogar: ${r.personas_en_hogar||"—"}\n`;
  t += `• Personas Trabajan: ${r.personas_trabajan||"—"}\n`;
  t += `• Adultos Mayores: ${r.adultos_mayores||"—"}\n`;
  t += `• Menores: ${r.menores||"—"}\n\n`;

  t += "╠🧩 *SERVICIOS*\n";
  t += `• Servicios: ${r.servicios||"—"}\n`;
  t += `• Discapacidad: ${r.discapacidad||"—"}\n`;
  t += `• Detalle: ${r.detalle_discapacidad||"—"}\n\n`;

  t += "╠🧠 *INTERESES*\n";
  t += `• Hobbies: ${r.hobbies||"—"}\n`;
  t += `• Emprendimiento: ${r.emprendimiento||"—"}\n\n`;

  t += "╚🤝 *REFERENCIAS*\n";
  t += `• Nombre: ${r.ref_nombre||"—"}\n`;
  t += `• Telegram: ${r.ref_telegram||"—"}\n`;
  t += `• WhatsApp: ${r.ref_whatsapp||"—"}\n\n`;

  t += "✏️ Usa `/actualizacion campo valor`\n📘 Usa `/glosario`";

  await bot.sendMessage(chatId, t, { parse_mode: "Markdown" });
}

// ================== /actualizacion ==================
bot.onText(/^\/actualizacion(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const texto = match[1]?.trim();

  if (!texto) {
    await send(chatId,
"Usa:\n`/actualizacion campo valor`\nConsulta campos con /glosario");
    return;
  }

  const partes = texto.split(" ");
  const campo = partes.shift();
  const valor = partes.join(" ").trim();

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (!data) {
    await send(chatId,"⚠️ No se encontró tu registro. Usa /restaurar.");
    return;
  }

  if (SENSITIVE.includes(campo)) {
    const { data: existe } = await supabase
      .from(TABLE)
      .select("id")
      .eq(campo, valor)
      .maybeSingle();

    if (existe && existe.id !== data.id) {
      await send(chatId, `🚫 El ${campo} ya está en uso.`);
      return;
    }
  }

  await supabase
    .from(TABLE)
    .update({ [campo]: valor })
    .eq("telegram_id", telegramId);

  await send(chatId, `✅ *${campo}* actualizado correctamente.`);
});

// ================== /restaurar ==================
bot.onText(/^\/restaurar\b/i, async (msg) => {
  await send(msg.chat.id,
"♻️ *Restaurar cuenta*\nEscribe tu *documento* o *email*.");
});

// ================== RESPUESTAS INTELIGENTES ==================
bot.on("message", async (msg) => {
  const text = (msg.text||"").toLowerCase();
  const chatId = msg.chat.id;

  if (text.startsWith("/")) return;

  if (["hola","buenas","saludos"].some(w=>text.includes(w))){
    await send(chatId,"👋 ¡Hola! Usa /ayuda para comenzar.");
    return;
  }

  if (["gracias","muchas gracias"].some(w=>text.includes(w))){
    await send(chatId,"😊 Con gusto, estoy para ayudarte.");
    return;
  }

  await send(chatId,"🤔 No entendí tu mensaje. Usa /ayuda.");
});