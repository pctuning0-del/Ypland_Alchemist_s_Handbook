"""
Минимальный Telegram-бот для «Справочника алхимика».
Запуск после установки зависимостей и переменной TELEGRAM_BOT_TOKEN.

Токен берётся у @BotFather в Telegram.
"""

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


def load_recipes():
    """Загружает те же рецепты, что и сайт (файл recipes.json рядом с bot.py)."""
    try:
        with open(RECIPES_PATH, encoding="utf-8") as f:
            data = json.load(f)
    except OSError as e:
        raise SystemExit(f"Не удалось открыть {RECIPES_PATH}: {e}") from e
    recipes = data.get("recipes")
    if not recipes or not isinstance(recipes, list):
        raise SystemExit(f"В {RECIPES_PATH.name} нужен объект с ключом recipes (массив).")
    return recipes


def format_top_lines(recipes, limit=3):
    lines = []
    for i, r in enumerate(recipes[:limit], 1):
        name = r.get("name", "?")
        hint = r.get("profitHint", "")
        t = r.get("time", "")
        lines.append(f"{i}) {name} — {hint}, {t}")
    return "\n".join(lines)


RECIPES = load_recipes()
TOP_RECIPES = format_top_lines(RECIPES)

bot = telebot.TeleBot(TOKEN)


@bot.message_handler(commands=["start", "help"])
def cmd_start(message):
    text = (
        "Саша, книга шепчет тихо: не торопись, но и не зевай — профит любит готовых.\n\n"
        "Три зелья, с которых начинают день:\n"
        f"{TOP_RECIPES}"
    )
    markup = types.InlineKeyboardMarkup()
    if SITE_URL:
        markup.add(
            types.InlineKeyboardButton("Открыть книгу", url=SITE_URL)
        )
    else:
        text += (
            "\n\n(Чтобы появилась кнопка «Открыть книгу», задай адрес сайта в переменной "
            "окружения SITE_URL — например, ссылку на GitHub Pages после деплоя.)"
        )
    bot.send_message(message.chat.id, text, reply_markup=markup)


@bot.message_handler(func=lambda _: True)
def echo_hint(message):
    bot.send_message(
        message.chat.id,
        "Напиши /start — откроется приветствие и список зелий. "
        "Или нажми кнопку «Открыть книгу», если задан SITE_URL.",
    )


def main():
    if not TOKEN:
        print(
            "Ошибка: не задан TELEGRAM_BOT_TOKEN.\n"
            "Пример в PowerShell:\n"
            '  $env:TELEGRAM_BOT_TOKEN="СЮДА_ТОКЕН_ОТ_BOTFATHER"\n'
            "  py bot.py\n",
            file=sys.stderr,
        )
        sys.exit(1)
    print("Бот запущен. Остановить: Ctrl+C.")
    bot.infinity_polling(skip_pending=True)


if __name__ == "__main__":
    main()
