import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import fs from "fs";
import XLSX from "xlsx";
import express from "express";

dotenv.config();

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
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

// === Excel fayl ===
const filePath = "./data.xlsx";
if (!fs.existsSync(filePath)) {
  console.error("❌ Excel fayl topilmadi:", filePath);
  process.exit(1);
}

// === Excel o‘qish ===
let workbook;
try {
  const buffer = fs.readFileSync(filePath);
  workbook = XLSX.read(buffer, { type: "buffer" });
  console.log(`✅ Excel o‘qildi. ${workbook.SheetNames.length} ta sheet topildi.`);
} catch (err) {
  console.error("❌ Excelni o‘qishda xato:", err);
  process.exit(1);
}

// === USERLAR ===
const USERS = [
  { telegramId: "7192862445", sheetName: "7192862445", phone: "998973040660", count: 0 },
  { telegramId: "761360760", sheetName: "761360760", phone: "998974861757", count: 0 },
  { telegramId: "8187159301", sheetName: "8187159301", phone: "998958900676", count: 0 },
  { telegramId: "5120511173", sheetName: "5120511173", phone: "998974886677", count: 0 },
  { telegramId: "6742042771", sheetName: "6742042771", phone: "998971820077", count: 0 },
  { telegramId: "6187229844", sheetName: "6187229844", phone: "998919800997", count: 0 },
  // { telegramId: "1479835681", sheetName: "1479835681", phone: "998987740784", count: 0 },
];

// === DISABLED_USERS ===
const rawDisabled = process.env.DISABLED_USERS || "";
const DISABLED_SET = new Set(
  rawDisabled.split(",").map(s => s.trim()).filter(Boolean)
);
for (const u of USERS) {
  u.enabled = !DISABLED_SET.has(String(u.telegramId));
}

function findUser(chatId) {
  return USERS.find(u => String(u.telegramId) === String(chatId));
}

function isAllowed(chatId) {
  if (String(chatId) === String(ADMIN_CHAT_ID)) return true;
  const u = findUser(chatId);
  return u && u.enabled;
}

function formatSumma(sum) {
  if (!sum) return "";
  const num = parseFloat(String(sum).replace(/[^0-9.,]/g, "").replace(",", "."));
  if (isNaN(num)) return sum;
  return num.toLocaleString("ru-RU");
}

// === Xabar yuborish va 60 sekdan keyin o‘chirish ===
async function sendAndDelete(chatId, text) {
  try {
    const sent = await bot.sendMessage(chatId, text);
    setTimeout(async () => {
      try {
        await bot.deleteMessage(chatId, sent.message_id);
      } catch {}
    }, 60000);
  } catch (err) {
    console.log("⚠️ Yuborishda xato:", err.message);
  }
}

// === LOG funksiyasi ===

// Universal mask funksiyasi — faqat oxirgi 4 ta belgini ko‘rsatadi
function maskString(value) {
  if (!value) return "";
  const str = String(value);
  if (str.length <= 4) return str; // Juda qisqa bo‘lsa, mask qilinmaydi
  const visible = str.slice(-4);
  const hidden = "*".repeat(str.length - 4);
  return hidden + visible;
}
function maskName(fullName) {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/);
  const lastName = parts[0] || "";
  const firstName = parts[1] || "";
  const maskedFirst =
    firstName.length > 1
      ? firstName[0] + "*".repeat(firstName.length - 1)
      : firstName;
  return `${lastName} ${maskedFirst}`;
}



async function logAction(user, action, debtorName) {
  
  if (!LOG_CHANNEL_ID) return;
  user.count++;
  const now = new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" });

    // Ismni masklash
    const maskedDebtor = maskName(debtorName);

  const logText = `
🧾 [User Activity Log]

👤 User ID: ${maskString(user.telegramId)}  
📱 Phone: ${maskString(user.phone)}
📄 Sheet: ${maskString(user.sheetName)}  
🕒 Time: ${now}  
💬 Action: foydalanuvchi “${action}” tugmasini bosdi  
📊 Command Count: ${user.count}  
📋 Result: Qarzdor — "${maskedDebtor}"
  `;
  try {
    await bot.sendMessage(LOG_CHANNEL_ID, logText.trim());
  } catch (err) {
    console.log("⚠️ Log kanalga yozishda xato:", err.message);
  }
}

// === User uchun ma'lumot yuborish ===
async function sendCurrent(chatId, user, index, action = "unknown") {
  const sheet = workbook.Sheets[user.sheetName];
  if (!sheet) return sendAndDelete(chatId, `❌ Sizga tegishli ma’lumotlar topilmadi.`);

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const total = rows.length;
  const debtor = rows[index];
  if (!debtor) return sendAndDelete(chatId, "⚠️ Ma’lumotlar tugadi.");

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

  await sendAndDelete(chatId, text1);
  await sendAndDelete(chatId, text2);
  await sendAndDelete(chatId, text3);

  // 🔥 log yozish
  await logAction(user, action, fullName);
}

// === User indekslari ===
const userIndexes = {};

// === /start ===
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  console.log(chatId);
  
  if (!isAllowed(chatId)) return sendAndDelete(chatId, "❌ Sizga ruxsat yo‘q.");

  const user = findUser(chatId);
  if (!user) return sendAndDelete(chatId, "❌ Sizga tegishli user topilmadi.");

  userIndexes[chatId] = 0;
  const sheet = workbook.Sheets[user.sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  await sendAndDelete(chatId, `✅ ${rows.length} ta yozuv topildi. /next yoki /prev bilan yurishingiz mumkin.`);
  sendCurrent(chatId, user, userIndexes[chatId], "start");
});

// === /next ===
bot.onText(/\/next/, (msg) => {
  const chatId = msg.chat.id;
  if (!isAllowed(chatId)) return sendAndDelete(chatId, "❌ Sizga ruxsat yo‘q.");
  const user = findUser(chatId);
  const sheet = workbook.Sheets[user.sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  userIndexes[chatId] = ((userIndexes[chatId] || 0) + 1) % rows.length;
  sendCurrent(chatId, user, userIndexes[chatId], "next");
});

// === /prev ===
bot.onText(/\/prev/, (msg) => {
  const chatId = msg.chat.id;
  if (!isAllowed(chatId)) return sendAndDelete(chatId, "❌ Sizga ruxsat yo‘q.");
  const user = findUser(chatId);
  const sheet = workbook.Sheets[user.sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  userIndexes[chatId] = ((userIndexes[chatId] || 0) - 1 + rows.length) % rows.length;
  sendCurrent(chatId, user, userIndexes[chatId], "prev");
});

// === Raqam yuborilganda ===
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  if (!isAllowed(chatId)) return;
  const user = findUser(chatId);
  if (!user) return;

  if (/^\d+$/.test(text)) {
    const num = parseInt(text, 10);
    const sheet = workbook.Sheets[user.sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    if (num >= 1 && num <= rows.length) {
      userIndexes[chatId] = num - 1;
      sendCurrent(chatId, user, userIndexes[chatId], `raqam: ${num}`);
    } else {
      sendAndDelete(chatId, `❌ Noto‘g‘ri raqam. 1 dan ${rows.length} gacha bo‘lishi kerak.`);
    }
  }
});

// === Admin buyruqlar ===
bot.onText(/\/disable (.+)/, (msg, match) => {
  const chatId = String(msg.chat.id);
  if (chatId !== String(ADMIN_CHAT_ID)) return sendAndDelete(chatId, "❌ Siz admin emassiz.");
  const target = String(match[1]).trim();
  DISABLED_SET.add(target);
  for (const u of USERS) if (String(u.telegramId) === target) u.enabled = false;
  sendAndDelete(chatId, `✅ ${target} endi disable qilindi.`);
});

bot.onText(/\/enable (.+)/, (msg, match) => {
  const chatId = String(msg.chat.id);
  if (chatId !== String(ADMIN_CHAT_ID)) return sendAndDelete(chatId, "❌ Siz admin emassiz.");
  const target = String(match[1]).trim();
  DISABLED_SET.delete(target);
  for (const u of USERS) if (String(u.telegramId) === target) u.enabled = true;
  sendAndDelete(chatId, `✅ ${target} endi enable qilindi.`);
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
