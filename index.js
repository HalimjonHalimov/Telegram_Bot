import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import fs from "fs";
import XLSX from "xlsx";
import express from "express";

dotenv.config();

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

if (!TOKEN) {
  console.error("❌ BOT_TOKEN .env faylida yo‘q");
  process.exit(1);
}
if (!ADMIN_CHAT_ID) {
  console.error("❌ ADMIN_CHAT_ID .env faylida yo‘q");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

// === Excel fayl ===
const filePath = "./data.xlsx";
if (!fs.existsSync(filePath)) {
  console.error("❌ Excel fayl topilmadi:", filePath);
  process.exit(1);
}

// === Exceldagi barcha sheetlarni o‘qish ===
let workbook;
try {
  const buffer = fs.readFileSync(filePath);
  workbook = XLSX.read(buffer, { type: "buffer" });
  console.log(`✅ Excel o‘qildi. ${workbook.SheetNames.length} ta sheet topildi.`);
} catch (err) {
  console.error("❌ Excelni o‘qishda xato:", err);
  process.exit(1);
}

// === USERLAR RO‘YXATI ===
// Har bir foydalanuvchi uchun: TelegramID, Excel sheet nomi, telefon raqami
const USERS = [
  { telegramId: "7192862445", sheetName: "7192862445", phone: "998973040660" }, // User 1
  { telegramId: "761360760", sheetName: "761360760", phone: "998974861757" },   // User 2
  { telegramId: "8187159301", sheetName: "8187159301", phone: "9989958900676" },   // User 3
  // { telegramId: "1479835681", sheetName: "1479835681", phone: "998958900676" },   // User 3

];

function findUser(chatId) {
  return USERS.find(u => String(u.telegramId) === String(chatId));
}

// === Summani formatlash ===
function formatSumma(sum) {
  if (!sum) return "";
  const num = parseFloat(String(sum).replace(/[^0-9.,]/g, "").replace(",", "."));
  if (isNaN(num)) return sum;
  return num.toLocaleString("ru-RU");
}

// === User uchun malumot yuborish ===
async function sendCurrent(chatId, user, index) {
  const sheet = workbook.Sheets[user.sheetName];
  if (!sheet) return bot.sendMessage(chatId, `❌ Sizga tegishli ma’lumotlar topilmadi.`);

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const total = rows.length;
  const debtor = rows[index];

  if (!debtor) return bot.sendMessage(chatId, "⚠️ Ma’lumotlar tugadi.");

  const fullName = debtor["Имя Фамилия"] || "";
  const tel = debtor["Телефон"] || "";
  const kun = debtor["Просрочено дней"] || "";
  const summa = formatSumma(debtor["Суммарная задолженность"] || "");

  const text1 = `Фуқаро ${fullName}.
СИЗ томонингиздан "Uzum Nasiya" платформаси орқали электрон расмийлаштирилган шартнома бўйича ${summa} сўм миқдорида ${kun} кунлик муддати ўтган қарздорлигингиз мавжуд.
Қарздорлик суммасини мажбурий ундирув тартибда ундирув ишлари амалга оширилади.
Жумладан, МИБ томонидан ойлик иш ҳақига қаратилади, руйхатда турган уй-жойингиздаги мол-мулк хатланади ҳамда ЙҲҲБ (ГАИ) томонидан шахсий автомашинангиз жарима майдончасига жойлаштирилади, шунингдек Ўзбекистон Республикасидан чиқиш ҳуқуқингиз чекланиши ҳақида огоҳлантирамиз.
Маълумот учун +${user.phone} рақамига қўнғироқ қилиш тавсия этилади.
ЗУДЛИК БИЛАН ҚАРЗДОРЛИКНИ ТЎЛАНГ!`;

  const text2 = `📱 Фойдаланувчи рақами: +${tel}`;
  const text3 = `➡️ ${index + 1}/${total} — /next yoki /prev, yoki raqam yozing (masalan: 10)`;

  await bot.sendMessage(chatId, text1);
  await bot.sendMessage(chatId, text2);
  await bot.sendMessage(chatId, text3);
}

// === Har bir user uchun index saqlaymiz ===
const userIndexes = {}; // { telegramId: index }

// === /start ===
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const user = findUser(chatId);
// console.log(chatId);

  if (!user) {
    return bot.sendMessage(chatId, "❌ Siz bu botdan foydalanish huquqiga ega emassiz.");
  }

  userIndexes[chatId] = 0;
  const sheet = workbook.Sheets[user.sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  await bot.sendMessage(chatId, `✅ ${rows.length} ta yozuv topildi. /next yoki /prev bilan yurishingiz mumkin.`);
  sendCurrent(chatId, user, userIndexes[chatId]);
});

// === /next ===
bot.onText(/\/next/, (msg) => {
  const chatId = msg.chat.id;
  const user = findUser(chatId);
  if (!user) return bot.sendMessage(chatId, "❌ Sizga ruxsat yo‘q.");

  const sheet = workbook.Sheets[user.sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  userIndexes[chatId] = (userIndexes[chatId] + 1) % rows.length;
  sendCurrent(chatId, user, userIndexes[chatId]);
});

// === /prev ===
bot.onText(/\/prev/, (msg) => {
  const chatId = msg.chat.id;
  const user = findUser(chatId);
  if (!user) return bot.sendMessage(chatId, "❌ Sizga ruxsat yo‘q.");

  const sheet = workbook.Sheets[user.sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  userIndexes[chatId] = (userIndexes[chatId] - 1 + rows.length) % rows.length;
  sendCurrent(chatId, user, userIndexes[chatId]);
});

// === Raqam yuborilganda ===
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  const user = findUser(chatId);
  if (!user) return;

  if (/^\d+$/.test(text)) {
    const num = parseInt(text, 10);
    const sheet = workbook.Sheets[user.sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (num >= 1 && num <= rows.length) {
      userIndexes[chatId] = num - 1;
      sendCurrent(chatId, user, userIndexes[chatId]);
    } else {
      bot.sendMessage(chatId, `❌ Noto‘g‘ri raqam. 1 dan ${rows.length} gacha bo‘lishi kerak.`);
    }
  }
});

console.log("✅ Bot ishga tushdi.");

// === Web server (Render uchun) ===
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("✅ Telegram bot is running!");
});

app.listen(PORT, () => {
  console.log(`🌐 Server ishga tushdi: ${PORT}`);
});
