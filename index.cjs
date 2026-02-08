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

// Variable global para el bot
let bot;

// ================== CONFIGURACIÓN RAIL ==================
const app = express();
app.use(express.json());

const URL = process.env.RAIL_URL; // URL pública de Rail que usaremos como webhook

bot = new TelegramBot(TELEGRAM_TOKEN, { webHook: true });
bot.setWebHook(`${URL}/webhook`);

// Endpoint para recibir actualizaciones de Telegram
app.post("/webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Rail usa PORT definido por la plataforma
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Bot Mi Semilla en Rail activo en puerto ${PORT}`);
  console.log(`🌐 Webhook configurado en: ${URL}/webhook`);
});

// ================== LÓGICA UNIVERSAL DEL BOT ==================

// Limpieza de archivos de estado
["misdatos_tg.json", "pendiente_tg.json", "restaurar_tg.json"].forEach(f => {
  try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
});

// Funciones auxiliares
function normUserForDB(u){
  if(!u) return null;
  const clean = u.replace(/^@+/, "").trim();
  if (/^\d+$/.test(clean)) return clean;
  return "@"+clean;
}

function tUser(msg){ return msg.from?.username || null; }

function fechaCorta(d = new Date()){
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

async function send(id, txt){ return bot.sendMessage(id, txt, { parse_mode: "Markdown" }); }

const MISDATOS_STATE  = "misdatos_tg.json";
const PENDIENTE_STATE = "pendiente_tg.json";
const RESTAURAR_STATE = "restaurar_tg.json";

const SENSITIVE = new Set(["email","documento","celular","usuario_telegram"]);
const NO_UPPER = new Set(["email","usuario_telegram"]);

function fieldList(){ return [
  "email","nombre_completo","documento","fecha_nacimiento","edad","celular","pais","departamento","ciudad","barrio","direccion",
  "escolaridad","genero","usuario_telegram","vivienda_propia","zona","estrato","personas_en_hogar","personas_trabajan",
  "adultos_mayores","menores","servicios","discapacidad","detalle_discapacidad","hobbies","emprendimiento",
  "ref_nombre","ref_telegram","ref_whatsapp"
];}

// ================== COMANDOS ==================

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

// /glosario
bot.onText(/\/glosario/i, async (msg) => {
  const chatId = msg.chat.id;
  const texto = `
📘 *Glosario de actualización de datos*

╔💠 *DATOS PERSONALES:*
• email  
• nombre_completo  
• documento  
• fecha_nacimiento  
• edad  
• genero  
• escolaridad  

╠📞 *CONTACTO:*
• celular  
• usuario_telegram  

╠📍 *UBICACIÓN:*
• pais  
• departamento  
• ciudad  
• barrio  
• direccion  

╠🏠 *HOGAR:*
• vivienda_propia  
• zona  
• estrato  
• personas_en_hogar  
• personas_trabajan  
• adultos_mayores  
• menores  

╠🧩 *SERVICIOS:*
• servicios  
• discapacidad  
• detalle_discapacidad  

╠🧠 *INTERESES:*
• hobbies  
• emprendimiento  

╠🤝 *REFERENCIAS:*
• ref_nombre  
• ref_telegram  
• ref_whatsapp  

╚🚫 *No se pueden duplicar:*
• email  
• documento  
• celular  
• usuario_telegram  

📝 *Ejemplo de uso:*  
\`/actualizacion ciudad Bogotá\`  
\`/actualizacion nombre_completo Juan Pérez\`
`;
  await bot.sendMessage(chatId, texto, { parse_mode: "MarkdownV2" });
});

// ================== /misdatos ==================
bot.onText(/^\/misdatos(?:\s+(\S+))?/, async (msg, match) => {
  const chatId = msg.chat.id.toString();
  const username = msg.from.username ? '@' + msg.from.username.toLowerCase() : null;
  await bot.sendMessage(chatId, "🔍 Consultando tus datos, por favor espera...");

  try {
    if (!username) {
      await bot.sendMessage(chatId,
        "⚠️ No tienes un *nombre de usuario* en Telegram.\n" +
        "Para poder consultar tus datos debes crear uno y registrarlo en tu tabla.\n" +
        "🔹 Usa `/restaurar` para vincular tu usuario."
      , { parse_mode: "Markdown" });
      return;
    }

    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("usuario_telegram", username)
      .maybeSingle();
    if (error) throw error;

    if (!data) {
      await bot.sendMessage(chatId,
        "⚠️ No se encontró ningún registro vinculado a tu usuario " + username + ".\n" +
        "Usa `/actualizacion usuario_telegram " + username + "` para vincular tu registro."
      , { parse_mode: "Markdown" });
      return;
    }

    await enviarFichaDatos(chatId, data);

  } catch (err) {
    console.error("❌ Error en /misdatos:", err);
    await bot.sendMessage(chatId, "⚠️ Ocurrió un error al consultar tus datos. Intenta nuevamente.");
  }
});

// Función para mostrar ficha de datos
async function enviarFichaDatos(chatId, r){
  let texto = "📋 *TUS DATOS REGISTRADOS*\n\n";

  texto += "╔💠 *DATOS PERSONALES:*\n";
  texto += `• Nombre: ${r.nombre_completo?.toUpperCase()||"—"}\n`;
  texto += `• Documento: ${r.documento?.toUpperCase()||"—"}\n`;
  texto += `• Fecha Nac.: ${r.fecha_nacimiento||"—"}\n`;
  texto += `• Edad: ${r.edad||"—"}\n`;
  texto += `• Género: ${r.genero?.toUpperCase()||"—"}\n`;
  texto += `• Escolaridad: ${r.escolaridad?.toUpperCase()||"—"}\n\n`;

  texto += "╠📞 *CONTACTO:*\n";
  texto += `• Celular: ${r.celular||"—"}\n`;
  texto += `• Usuario Telegram: ${r.usuario_telegram||"—"}\n`;
  texto += `• Email: ${r.email||"—"}\n\n`;

  texto += "╠📍 *UBICACIÓN:*\n";
  texto += `• País: ${r.pais?.toUpperCase()||"—"}\n`;
  texto += `• Departamento: ${r.departamento?.toUpperCase()||"—"}\n`;
  texto += `• Ciudad: ${r.ciudad?.toUpperCase()||"—"}\n`;
  texto += `• Barrio: ${r.barrio?.toUpperCase()||"—"}\n`;
  texto += `• Dirección: ${r.direccion?.toUpperCase()||"—"}\n\n`;

  texto += "╠🏠 *HOGAR:*\n";
  texto += `• Vivienda Propia: ${r.vivienda_propia?.toUpperCase()||"—"}\n`;
  texto += `• Zona: ${r.zona?.toUpperCase()||"—"}\n`;
  texto += `• Estrato: ${r.estrato||"—"}\n`;
  texto += `• Personas en Hogar: ${r.personas_en_hogar||"—"}\n`;
  texto += `• Personas que Trabajan: ${r.personas_trabajan||"—"}\n`;
  texto += `• Adultos Mayores: ${r.adultos_mayores||"—"}\n`;
  texto += `• Menores: ${r.menores||"—"}\n\n`;

  texto += "╠🧩 *SERVICIOS:*\n";
  texto += `• Servicios: ${r.servicios?.toUpperCase()||"—"}\n`;
  texto += `• Discapacidad: ${r.discapacidad?.toUpperCase()||"—"}\n`;
  texto += `• Detalle Discapacidad: ${r.detalle_discapacidad?.toUpperCase()||"—"}\n\n`;

  texto += "╠🧠 *INTERESES:*\n";
  texto += `• Hobbies: ${r.hobbies?.toUpperCase()||"—"}\n`;
  texto += `• Emprendimiento: ${r.emprendimiento?.toUpperCase()||"—"}\n\n`;

  texto += "╚🤝 *REFERENCIAS:*\n";
  texto += `• Nombre Ref.: ${r.ref_nombre?.toUpperCase()||"—"}\n`;
  texto += `• Telegram Ref.: ${r.ref_telegram||"—"}\n`;
  texto += `• WhatsApp Ref.: ${r.ref_whatsapp||"—"}\n\n`;

  texto += "📝 *Para actualizar tus datos usa:* `/actualizacion campo valor`\n";
  texto += "📘 *Para conocer los nombres de los campos usa:* `/glosario`";

  await bot.sendMessage(chatId, texto, { parse_mode: "Markdown" });
}

// ================== /actualizacion ==================
bot.onText(/^\/actualizacion(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const texto = match[1]?.trim();

  if (!texto) {
    await bot.sendMessage(chatId,
      "🧩 *Guía de actualización de datos*\nUsa el formato:\n`/actualizacion campo valor`\nEjemplo:\n`/actualizacion ciudad Bogotá`\n\nSi no recuerdas los campos disponibles, usa 👉 /glosario 📘",
      { parse_mode: "Markdown" }
    );
    return;
  }

  const partes = texto.split(" ");
  const campo = partes.shift()?.trim();
  const valor = partes.join(" ").trim();

  const usuario = msg.from.username ? '@'+msg.from.username.toLowerCase() : msg.from.id.toString();

  try {
    const { data: registros, error } = await supabase
      .from(TABLE)
      .select("*")
      .or(`usuario_telegram.eq.${usuario},celular.eq.${usuario},email.eq.${usuario},documento.eq.${usuario}`);

    if (error) throw error;
    if (!registros || registros.length===0) { await send(chatId,"⚠️ No encontré tu registro asociado a este Telegram. Usa /restaurar."); return; }
    if (registros.length>1) { await send(chatId,"⚠️ Se encontraron duplicados. Contacta al administrador."); return; }

    const id = registros[0].id;
    const registroActual = registros[0];
    const camposProtegidos = ["email","documento","celular","usuario_telegram"];
    const camposMinuscula = ["email","usuario_telegram"];

    if (registroActual[campo] && registroActual[campo].toString().toLowerCase()===valor.toLowerCase()){
      await send(chatId, `⚠️ No se realizaron cambios. El valor ingresado ya está registrado en ${campo}.`);
      return;
    }

    if (camposProtegidos.includes(campo)){
      const { data: existe } = await supabase.from(TABLE).select("id").eq(campo, valor).maybeSingle();
      if (existe && existe.id !== id) { await send(chatId, `🚫 Ese ${campo} ya está en uso.`); return; }
      await send(chatId, `⚠️ Campo sensible. Confirma con sí/no antes de actualizar.`);
      global.confirmacionPendiente = { chatId,id,campo,valor,campoMinuscula: camposMinuscula.includes(campo) };
      return;
    }

    const valorFinal = camposMinuscula.includes(campo) ? valor : valor.toUpperCase();
    const { error: errUpdate } = await supabase.from(TABLE).update({ [campo]: valorFinal }).eq("id", id);
    if (errUpdate) throw errUpdate;
    await send(chatId, `✅ *${campo}* actualizado correctamente a *${valorFinal}*.`, { parse_mode: "Markdown" });

  } catch(err){
    console.error("❌ Error en /actualizacion:",err);
    await send(chatId,"❌ Error al procesar tu actualización. Intenta más tarde.");
  }
});

// ================== CONFIRMACIÓN CAMPOS SENSIBLES ==================
bot.on("message", async (msg)=>{
  const chatId = msg.chat.id;
  const texto = msg.text?.toLowerCase().trim();
  if (!global.confirmacionPendiente) return;
  const p = global.confirmacionPendiente;
  if (chatId!==p.chatId) return;

  if (!["sí","si","no"].includes(texto)) return;

  if (texto==="no"){ await send(chatId,"❌ Actualización cancelada."); global.confirmacionPendiente=null; return; }

  try{
    const valorFinal = p.campoMinuscula?p.valor:p.valor.toUpperCase();
    const { error } = await supabase.from(TABLE).update({ [p.campo]: valorFinal }).eq("id", p.id);
    if (error) throw error;
    await send(chatId, `✅ Tu campo *${p.campo}* fue actualizado correctamente a *${valorFinal}*.`, { parse_mode: "Markdown" });
    global.confirmacionPendiente = null;
  } catch(e){ console.error(e); await send(chatId,"❌ Error al confirmar la actualización."); global.confirmacionPendiente=null; }
});

// ================== /restaurar ==================
bot.onText(/^\/restaurar\b/i, async (msg)=>{
  const c = msg.chat.id;
  await send(c, "♻️ *Restauración de cuenta*\nEscribe: `documento` o `email`.");
  fs.writeFileSync(RESTAURAR_STATE, JSON.stringify({ estado:"elige_modo", chatId:c }));
});

// ================== RESPUESTAS INTELIGENTES ==================
bot.on("message", async (msg)=>{
  const chatId = msg.chat.id;
  const text = (msg.text||"").trim().toLowerCase();
  if (fs.existsSync(RESTAURAR_STATE)){
    const st = JSON.parse(fs.readFileSync(RESTAURAR_STATE,"utf8"));
    if (st.chatId===chatId) return;
  }
  if (text.startsWith("/")) return;
  if (["sí","si","no","s"].includes(text)) return;

  if (["hola","buenas","saludos"].some(w=>text.includes(w))){
    await send(chatId,"🤖 ¡Hola! Bienvenido(a) al asistente de *Mi Semilla* 🌱\nComandos:\n• /misdatos\n• /actualizacion\n• /glosario\n• /restaurar");
    return;
  }

  if (["ayuda","orienta","cómo empiezo","qué debo hacer","necesito actualizar","consultar","información","actualizar"].some(w=>text.includes(w))){
    await send(chatId,"🧭 Comandos disponibles:\n• /misdatos\n• /actualizacion\n• /glosario\n• /restaurar");
    return;
  }

  if (["gracias","te agradezco","muy amable"].some(w=>text.includes(w))){ await send(chatId,"😊 ¡Con gusto! Siempre estoy aquí para ayudarte 🌻"); return; }
  if (["adiós","chao","nos vemos","hasta luego"].some(w=>text.includes(w))){ await send(chatId,"👋 ¡Hasta pronto! Que tengas un excelente día 🌿"); return; }

  await send(chatId, "🤔 No entendí tu mensaje. Por favor escribe una opción válida.");