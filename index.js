import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import fs from "fs";
import XLSX from "xlsx";

dotenv.config();

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const MY_PHONE = process.env.MY_PHONE || "998973040660";

if (!TOKEN) {
  console.error("❌ BOT_TOKEN .env faylida yo‘q");
  process.exit(1);
}
if (!ADMIN_CHAT_ID) {
  console.error("❌ ADMIN_CHAT_ID .env faylida yo‘q");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

// === Excelni o‘qish ===
const filePath = "./data.xlsx";
let rows = [];

if (!fs.existsSync(filePath)) {
  console.error("❌ Excel fayl topilmadi:", filePath);
  process.exit(1);
}

try {
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  console.log(`✅ Excel fayl o‘qildi. ${rows.length} ta yozuv topildi.`);
} catch (err) {
  console.error("❌ Excel faylni o‘qishda xato:", err);
  process.exit(1);
}

let currentIndex = 0;

function isAdmin(chatId) {
  return String(chatId) === String(ADMIN_CHAT_ID);
}

// === Summani chiroyli formatlash ===
function formatSumma(sum) {
  if (!sum) return "";
  const num = parseFloat(String(sum).replace(/[^0-9.,]/g, "").replace(",", "."));
  if (isNaN(num)) return sum;
  return num.toLocaleString("ru-RU");
}

// === Xabar yuborish funksiyasi ===
async function sendCurrent(chatId) {
  const total = rows.length;
  const debtor = rows[currentIndex];

  const fullName = debtor["Имя Фамилия"] || "";
  const tel = debtor["Телефон"] || "";
  const kun = debtor["Просрочено дней"] || "";
  const summa = formatSumma(debtor["Суммарная задолженность"] || "");

  const text1 = `Фуқаро ${fullName}.
СИЗ томонингиздан "Uzum Nasiya" платформаси орқали электрон расмийлаштирилган шартнома бўйича ${summa} сўм миқдорида ${kun} кунлик муддати ўтган қарздорлигингиз мавжуд.
Қарздорлик суммасини мажбурий ундирув тартибда ундирув ишлари амалга оширилади.
Жумладан, МИБ томонидан ойлик иш ҳақига қаратилади, руйхатда турган уй-жойингиздаги мол-мулк хатланади ҳамда ЙҲҲБ (ГАИ) томонидан шахсий автомашинангиз жарима майдончасига жойлаштирилади, шунингдек Ўзбекистон Республикасидан чиқиш ҳуқуқингиз чекланиши ҳақида огоҳлантирамиз.
Маълумот учун +${MY_PHONE} рақамига қўнғироқ қилиш тавсия этилади.
ЗУДЛИК БИЛАН ҚАРЗДОРЛИКНИ ТЎЛАНГ!`;

  const text2 = `📱 Фойдаланувчи рақами: +${tel}`;
  const text3 = `➡️ ${currentIndex + 1}/${total} — /next yoki /prev, yoki istalgan raqamni yozing (masalan: 15)`;

  await bot.sendMessage(chatId, text1);
  await bot.sendMessage(chatId, text2);
  await bot.sendMessage(chatId, text3);
}

// === Next/Prev funksiyalari ===
function sendNextCircular(chatId) {
  const total = rows.length;
  currentIndex = (currentIndex + 1) % total;
  sendCurrent(chatId);
}

function sendPrevCircular(chatId) {
  const total = rows.length;
  currentIndex = (currentIndex - 1 + total) % total;
  sendCurrent(chatId);
}

// === /start ===
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (!isAdmin(chatId)) return bot.sendMessage(chatId, "❌ Siz admin emassiz.");

  currentIndex = 0;
  bot.sendMessage(
    chatId,
    `✅ Bot ishga tushdi. ${rows.length} ta yozuv tayyor.\nOldinga: /next\nOrqaga: /prev\nIstalgan raqamni yozing (masalan: 22)`
  );
});

// === /next va /prev ===
bot.onText(/\/next/, (msg) => {
  const chatId = msg.chat.id;
  if (!isAdmin(chatId)) return bot.sendMessage(chatId, "❌ Siz admin emassiz.");
  sendNextCircular(chatId);
});

bot.onText(/\/prev/, (msg) => {
  const chatId = msg.chat.id;
  if (!isAdmin(chatId)) return bot.sendMessage(chatId, "❌ Siz admin emassiz.");
  sendPrevCircular(chatId);
});

// === Raqam yuborilganda ===
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  if (!isAdmin(chatId)) return;

  // faqat raqam yozilganda
  if (/^\d+$/.test(text)) {
    const num = parseInt(text, 10);
    if (num >= 1 && num <= rows.length) {
      currentIndex = num - 1;
      sendCurrent(chatId);
    } else {
      bot.sendMessage(chatId, `❌ Noto‘g‘ri raqam. 1 dan ${rows.length} gacha bo‘lishi kerak.`);
    }
  }
});

console.log("✅ Bot ishga tushdi.");
