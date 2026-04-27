/**
 * Telegram-бот на grammY: те же рецепты, что на сайт (recipes.json).
 * Переменные: BOT_TOKEN, опционально SITE_URL (кнопка «Открыть книгу»).
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Bot, InlineKeyboard } from "grammy";

const __dirname = dirname(fileURLToPath(import.meta.url));

const token = process.env.BOT_TOKEN?.trim();
const SITE_URL = process.env.SITE_URL?.trim();

if (!token) {
  console.error(
    "Не задан BOT_TOKEN. Создай .env по образцу .env.example (токен от @BotFather)."
  );
  process.exit(1);
}

function loadRecipes() {
  const path = join(__dirname, "recipes.json");
  const data = JSON.parse(readFileSync(path, "utf-8"));
  if (!data.recipes || !Array.isArray(data.recipes)) {
    throw new Error("В recipes.json нужен ключ recipes (массив)");
  }
  return data.recipes;
}

const RECIPES = loadRecipes();
const IDS = RECIPES.map((r) => r.id).join(", ");
const CB_PREFIX = "recipe:";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatTopLines(recipes, limit = null) {
  const items = limit == null ? recipes : recipes.slice(0, limit);
  return items
    .map((r, i) => {
      const name = r.name ?? "?";
      const hint = r.profitHint ?? "";
      const t = r.time ?? "";
      return `${i + 1}) ${name} — ${hint}, ${t}`;
    })
    .join("\n");
}

function findRecipe(id) {
  return RECIPES.find((r) => r.id === id);
}

function formatRecipeCard(r) {
  const name = escapeHtml(r.name ?? "?");
  const hint = escapeHtml(r.profitHint ?? "");
  const tm = escapeHtml(r.time ?? "");
  const ing = escapeHtml(r.ingredients ?? "");
  const story = escapeHtml(r.story ?? "");
  return (
    `<b>${name}</b>\n` +
    `${hint} • ${tm}\n\n` +
    `<b>Состав:</b> ${ing}\n\n` +
    `<i>${story}</i>`
  );
}

function startKeyboard() {
  const kb = new InlineKeyboard();
  if (SITE_URL) {
    kb.url("Открыть книгу", SITE_URL).row();
  }
  for (const r of RECIPES) {
    const cb = `${CB_PREFIX}${r.id}`;
    if (Buffer.byteLength(cb, "utf8") > 64) {
      console.warn(`id слишком длинный для кнопки: ${r.id}`);
      continue;
    }
    kb.text(`Рецепт: ${r.name}`, cb).row();
  }
  return kb;
}

const bot = new Bot(token);

bot.command("start", async (ctx) => {
  let text =
    "Саша, книга шепчет тихо: не торопись, но и не зевай — профит любит готовых.\n\n" +
    "Зелья для старта дня:\n" +
    formatTopLines(RECIPES) +
    "\n\n" +
    "Жми на рецепт ниже — пришлю состав и совет. Команды: /help, /recipes, /recipe";
  if (!SITE_URL) {
    text +=
      "\n\nПодсказка: добавь в .env переменную SITE_URL — появится кнопка «Открыть книгу».";
  }
  await ctx.reply(text, { reply_markup: startKeyboard() });
});

bot.command("help", async (ctx) => {
  const siteLine = SITE_URL
    ? `Сайт: ${escapeHtml(SITE_URL)}\n`
    : "Сайт: задай SITE_URL в .env — появится кнопка «Открыть книгу».\n";
  await ctx.reply(
    "Команды:\n" +
      "/start — приветствие и кнопки\n" +
      "/recipes — все рецепты кратко\n" +
      "/recipe id — полный текст рецепта\n\n" +
      siteLine +
      "\n" +
      `Доступные id: ${escapeHtml(IDS)}\n\n` +
      "Пример: <code>/recipe gold-leaf</code>",
    { parse_mode: "HTML" }
  );
});

bot.command("recipes", async (ctx) => {
  await ctx.reply("Все рецепты в книге:\n" + formatTopLines(RECIPES, null));
});

bot.command("recipe", async (ctx) => {
  const text = ctx.message?.text ?? "";
  const parts = text.split(/\s+/);
  if (parts.length < 2) {
    await ctx.reply(`Укажи id.\nПример: /recipe gold-leaf\n\nДоступные id: ${IDS}`);
    return;
  }
  const rid = parts[1].trim();
  const r = findRecipe(rid);
  if (!r) {
    await ctx.reply(`Не нашёл «${rid}». Id: ${IDS}`);
    return;
  }
  await ctx.reply(formatRecipeCard(r), { parse_mode: "HTML" });
});

bot.callbackQuery(new RegExp(`^${CB_PREFIX}`), async (ctx) => {
  const rid = ctx.callbackQuery.data.slice(CB_PREFIX.length);
  const r = findRecipe(rid);
  await ctx.answerCallbackQuery();
  if (!r) {
    await ctx.reply("Рецепт не найден — проверь recipes.json.");
    return;
  }
  await ctx.reply(formatRecipeCard(r), { parse_mode: "HTML" });
});

// Обычный текст (не команда с /), чтобы не дублировать ответы на /start и т.д.
bot
  .filter((ctx) => {
    const t = ctx.message?.text;
    return typeof t === "string" && !t.startsWith("/");
  })
  .on("message:text", async (ctx) => {
    await ctx.reply(
      "Напиши /start — там кнопки. Команды: /help, /recipes, /recipe"
    );
  });

console.log("Бот запущен (grammY + recipes.json). Остановить: Ctrl+C.");
await bot.start();
