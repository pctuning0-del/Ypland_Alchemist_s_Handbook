/**
 * Простой Telegram-бот на grammY.
 * Токен читается из переменной BOT_TOKEN (файл .env или окружение хостинга).
 */

import "dotenv/config";
import { Bot } from "grammy";

const token = process.env.BOT_TOKEN?.trim();

if (!token) {
  console.error(
    "Не задан BOT_TOKEN. Создай файл .env по образцу .env.example и впиши туда токен от @BotFather."
  );
  process.exit(1);
}

const bot = new Bot(token);

bot.command("start", (ctx) => {
  return ctx.reply(
    [
      "Саша, книга уже ждёт тебя.",
      "",
      "Тёплый совет на сегодня: не торопись сливать профит — сначала прислушайся к рынку.",
      "",
      "Если нужна памятка по командам — напиши /help.",
    ].join("\n")
  );
});

bot.command("help", (ctx) => {
  return ctx.reply(
    [
      "Что я умею:",
      "",
      "/start — приветствие от книги",
      "/help — этот список",
      "",
      "Токен бота берётся из переменной BOT_TOKEN (например из файла .env на компьютере).",
    ].join("\n")
  );
});

console.log("Бот запущен (grammY). Остановить: Ctrl+C.");
await bot.start();
