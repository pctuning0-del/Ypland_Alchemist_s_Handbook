"""
Telegram-бот «Справочник алхимика»: recipes.json, кнопка на сайт, рецепты кнопками и командами.

Переменные окружения:
  TELEGRAM_BOT_TOKEN — от @BotFather
  SITE_URL — публичный URL сайта (опционально, для кнопки «Открыть книгу»)
"""

from __future__ import annotations

import html
import json
import os
import sys
from pathlib import Path

try:
    import telebot
    from telebot import types
except ImportError:
    print("Установи зависимости: py -m pip install -r requirements.txt", file=sys.stderr)
    sys.exit(1)

TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
SITE_URL = os.environ.get("SITE_URL", "").strip()

RECIPES_PATH = Path(__file__).resolve().with_name("recipes.json")
# callback_data в Telegram — не длиннее 64 байт
CB_PREFIX = "recipe:"


def load_recipes():
    """Те же рецепты, что на сайте (recipes.json рядом с bot.py)."""
    try:
        with open(RECIPES_PATH, encoding="utf-8") as f:
            data = json.load(f)
    except OSError as e:
        raise SystemExit(f"Не удалось открыть {RECIPES_PATH}: {e}") from e
    recipes = data.get("recipes")
    if not recipes or not isinstance(recipes, list):
        raise SystemExit(f"В {RECIPES_PATH.name} нужен ключ recipes (массив).")
    return recipes


RECIPES = load_recipes()
_IDS = ", ".join(r.get("id", "?") for r in RECIPES)


def format_top_lines(recipes, limit: int | None = 3) -> str:
    lines = []
    items = recipes if limit is None else recipes[:limit]
    for i, r in enumerate(items, 1):
        name = r.get("name", "?")
        hint = r.get("profitHint", "")
        t = r.get("time", "")
        lines.append(f"{i}) {name} — {hint}, {t}")
    return "\n".join(lines)


def find_recipe(recipe_id: str):
    for r in RECIPES:
        if str(r.get("id")) == recipe_id:
            return r
    return None


def format_recipe_card(r: dict) -> str:
    """Карточка рецепта в HTML."""
    name = html.escape(str(r.get("name", "?")))
    hint = html.escape(str(r.get("profitHint", "")))
    tm = html.escape(str(r.get("time", "")))
    ing = html.escape(str(r.get("ingredients", "")))
    story = html.escape(str(r.get("story", "")))
    return (
        f"<b>{name}</b>\n"
        f"{hint} • {tm}\n\n"
        f"<b>Состав:</b> {ing}\n\n"
        f"<i>{story}</i>"
    )


def markup_start() -> types.InlineKeyboardMarkup:
    markup = types.InlineKeyboardMarkup()
    if SITE_URL:
        markup.row(types.InlineKeyboardButton("Открыть книгу", url=SITE_URL))
    for r in RECIPES:
        rid = r.get("id", "")
        name = r.get("name", "?")
        cb = f"{CB_PREFIX}{rid}"
        if len(cb.encode("utf-8")) > 64:
            print(
                f"Внимание: id слишком длинный для кнопки: {rid}",
                file=sys.stderr,
            )
            continue
        markup.row(types.InlineKeyboardButton(f"Рецепт: {name}", callback_data=cb))
    return markup


bot = telebot.TeleBot(TOKEN)


@bot.message_handler(commands=["start"])
def cmd_start(message):
    text = (
        "Саша, книга шепчет тихо: не торопись, но и не зевай — профит любит готовых.\n\n"
        "Зелья для старта дня:\n"
        f"{format_top_lines(RECIPES)}\n\n"
        "Жми на рецепт ниже — пришлю состав и совет. "
        "Команды: /help, /recipes, /recipe"
    )
    if not SITE_URL:
        text += (
            "\n\nПодсказка: задай SITE_URL — появится кнопка «Открыть книгу»."
        )
    bot.send_message(message.chat.id, text, reply_markup=markup_start())


@bot.message_handler(commands=["help"])
def cmd_help(message):
    if SITE_URL:
        site_line = f"Сайт: {html.escape(SITE_URL)}\n"
    else:
        site_line = "Сайт: задай SITE_URL — появится кнопка «Открыть книгу».\n"
    bot.send_message(
        message.chat.id,
        "Команды:\n"
        "/start — приветствие и кнопки\n"
        "/recipes — все рецепты кратко\n"
        "/recipe id — полный текст\n\n"
        f"{site_line}\n"
        f"Доступные id: {html.escape(_IDS)}\n\n"
        "Пример: <code>/recipe gold-leaf</code>",
        parse_mode="HTML",
    )


@bot.message_handler(commands=["recipes"])
def cmd_recipes(message):
    bot.send_message(
        message.chat.id,
        "Все рецепты в книге:\n" + format_top_lines(RECIPES, limit=None),
    )


@bot.message_handler(commands=["recipe"])
def cmd_recipe(message):
    parts = (message.text or "").split(maxsplit=1)
    if len(parts) < 2:
        bot.reply_to(
            message,
            f"Укажи id.\nПример: /recipe gold-leaf\n\nДоступные id: {_IDS}",
        )
        return
    rid = parts[1].strip()
    r = find_recipe(rid)
    if not r:
        bot.reply_to(message, f"Не нашёл «{rid}». Id: {_IDS}")
        return
    bot.send_message(message.chat.id, format_recipe_card(r), parse_mode="HTML")


@bot.callback_query_handler(func=lambda q: q.data and q.data.startswith(CB_PREFIX))
def on_recipe_callback(query):
    rid = query.data[len(CB_PREFIX) :]
    r = find_recipe(rid)
    bot.answer_callback_query(query.id)
    if not r:
        bot.send_message(
            query.message.chat.id,
            "Рецепт не найден — проверь recipes.json на сервере.",
        )
        return
    bot.send_message(
        query.message.chat.id,
        format_recipe_card(r),
        parse_mode="HTML",
    )


@bot.message_handler(content_types=["text"])
def fallback_text(message):
    if message.text and message.text.startswith("/"):
        bot.reply_to(message, "Неизвестная команда. Напиши /help или /start.")
        return
    bot.reply_to(
        message,
        "Напиши /start — там кнопки. Команды: /help, /recipes, /recipe",
    )


def main():
    if not TOKEN:
        print(
            "Не задан TELEGRAM_BOT_TOKEN.\n"
            '  $env:TELEGRAM_BOT_TOKEN="токен"\n'
            "  py bot.py\n",
            file=sys.stderr,
        )
        sys.exit(1)
    print("Бот запущен. Ctrl+C — стоп.")
    bot.infinity_polling(skip_pending=True)


if __name__ == "__main__":
    main()
