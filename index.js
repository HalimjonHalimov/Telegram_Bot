import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import fs from "fs";
import XLSX from "xlsx";
import express from "express"; // <-- express import

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
  rows = XLSX.utils.sheet_to_json(sheet, { defval: "" })
    .filter(row => Object.values(row).some(v => String(v).trim() !== ""));
  console.log(`✅ Excel fayl o‘qildi. ${rows.length} ta yozuv topildi.`);
} catch (err) {
  console.error("❌ Excel faylni o‘qishda xato:", err);
  process.exit(1);
}

let currentIndex = 0;

function isAdmin(chatId) {
  return String(chatId) === String(ADMIN_CHAT_ID);
}

// Summani chiroyli formatlash
function formatSumma(sum) {
  if (!sum) return "";
  const num = parseFloat(String(sum).replace(/[^0-9.,]/g, "").replace(",", "."));
  if (isNaN(num)) return sum;
  return num.toLocaleString("ru-RU");
}

// Xabar yuborish
async function sendCurrent(chatId) {
  const total = rows.length;
  const debtor = rows[currentIndex];

  const fullName = debtor["Имя Фамилия"] || "";
  const tel = debtor["Телефон"] || "";
  const kun = debtor["Просрочено дней"] || "";
  const summa = formatSumma(debtor["Суммарная задолженность"] || "");

  const text1 = `Фуқаро ${fullName}.
СИЗ томонингиздан "Uzum Nasiya" платформаси орқали электрон расмийлаштирилган шартнома бўйича ${summa} сўм миқдорида ${kun} кунлик муддати ўтган қарздорлигингиз мавжуд.
Маълумот учун +${MY_PHONE} рақамига қўнғироқ қилиш тавсия этилади.
ЗУДЛИК БИЛАН ҚАРЗДОРЛИКНИ ТЎЛАНГ!`;

  const text2 = `📱 Фойдаланувчи рақами: +${tel}`;
  const text3 = `➡️ ${currentIndex + 1}/${total} — /next yoki /prev, yoki istalgan raqamni yozing (masalan: 15)`;

  await bot.sendMessage(chatId, text1);
  await bot.sendMessage(chatId, text2);
  await bot.sendMessage(chatId, text3);
}

// Next/Prev
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

// /start, /next, /prev handlers
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (!isAdmin(chatId)) return bot.sendMessage(chatId, "❌ Siz admin emassiz.");

  currentIndex = 0;
  bot.sendMessage(chatId, `✅ Bot ishga tushdi. ${rows.length} ta yozuv tayyor.\nOldinga: /next\nOrqaga: /prev\nIstalgan raqamni yozing (masalan: 22)`);
});

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

// Raqam yozilganda
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  if (!isAdmin(chatId)) return;

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

console.log("✅ Telegram bot ishga tushdi.");

/* ============================
   EXPRESS SERVER (Port binding for Render)
   ============================ */
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("✅ Telegram bot is running.");
});

app.listen(PORT, () => {
  console.log(`🌐 Web server started on port ${PORT}`);
});
