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
import re
import sys
from pathlib import Path
from urllib.parse import quote

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
        section = (r.get("section", "") or "").strip()
        if section:
            lines.append(f"{i}) {name} — {section}")
        else:
            lines.append(f"{i}) {name}")
    return "\n".join(lines)


def find_recipe(recipe_id: str):
    for r in RECIPES:
        if str(r.get("id")) == recipe_id:
            return r
    return None


def format_ingredients_telegram_html(raw: str) -> str:
    """Состав: строки из полей, разделённых ';', количество в начале — жирным (HTML для Telegram)."""
    s = (raw or "").strip()
    if not s or s == "—":
        return "<b>Состав:</b>\n—"
    parts = [p.strip() for p in s.split(";") if p.strip()]
    lines: list[str] = ["<b>Состав:</b>"]
    for p in parts:
        m = re.match(r"^(\d+(?:[.,]\d+)?)\s+(.+)$", p)
        if m:
            qty, rest = m.group(1), m.group(2)
            lines.append(f"<b>{html.escape(qty)}</b> {html.escape(rest)}")
        else:
            lines.append(html.escape(p))
    return "\n".join(lines)


def format_ingredients_blocks_telegram_html(blocks) -> str:
    """Состав блоками (chooseOne/allRequired) — если ingredientsBlocks есть в recipes.json."""
    if not isinstance(blocks, list) or not blocks:
        return "<b>Состав:</b>\n—"

    def label(t: str) -> str:
        if t == "chooseOne":
            return "ВЫБЕРИ ОДИН"
        if t == "allRequired":
            return "ВСЁ ОБЯЗАТЕЛЬНО"
        return "СОСТАВ"

    out: list[str] = ["<b>Состав:</b>"]
    for b in blocks:
        t = str((b or {}).get("type") or "").strip()
        out.append(f"\n<b>{label(t)}:</b>")
        items = (b or {}).get("items")
        if not isinstance(items, list) or not items:
            out.append("—")
            continue
        for it in items:
            qty = str((it or {}).get("qty") or "").strip()
            name = str((it or {}).get("name") or "").strip()
            if qty and name:
                out.append(f"<b>{html.escape(qty)}</b> {html.escape(name)}")
            elif name:
                out.append(html.escape(name))
            else:
                out.append("—")
    return "\n".join(out)

def format_recipe_card(r: dict) -> str:
    """Карточка рецепта в HTML."""
    name = html.escape(str(r.get("name", "?")))
    section = html.escape(str(r.get("section", "") or ""))
    boost = html.escape(str(r.get("boost", "") or "")).strip()
    rep_to = str(r.get("repTo", "") or "").strip()
    pl = str(r.get("pl", "") or "").strip()
    hint = html.escape(str(r.get("profitHint", "")))
    tm = html.escape(str(r.get("time", "")))
    story_raw = str(r.get("story", "") or "").strip()
    wiki_url = str(r.get("wikiUrl", "") or "").strip()
    ing_raw = str(r.get("ingredients", "") or "")
    ing_blocks = r.get("ingredientsBlocks")

    meta_bits = []
    if section:
        meta_bits.append(section)
    if rep_to:
        meta_bits.append(
            f"Репутация: {html.escape(rep_to)}"
            + (f" ({html.escape(pl)} PL)" if pl else "")
        )
    if boost:
        meta_bits.append(f"Boost {boost}")
    if hint:
        meta_bits.append(hint)
    if tm and str(tm).strip() and str(tm).strip() not in ("—", "-"):
        meta_bits.append(tm)
    meta_line = html.escape(" • ".join(meta_bits))

    wiki_line = ""
    if wiki_url.startswith("http://") or wiki_url.startswith("https://"):
        safe_url = quote(wiki_url, safe=":/?#[]@!$&'()*+,;=%")
        wiki_line = f'\n<a href="{safe_url}">Страница в вики YupLand</a>\n'

    if isinstance(ing_blocks, list) and ing_blocks:
        ing_block = format_ingredients_blocks_telegram_html(ing_blocks)
    else:
        ing_block = format_ingredients_telegram_html(ing_raw)
    story_block = (
        f"\n\n<i>{html.escape(story_raw)}</i>" if story_raw and story_raw != "—" else ""
    )

    return (
        f"<b>{name}</b>\n"
        f"{meta_line}\n"
        f"{wiki_line}\n"
        f"{ing_block}"
        f"{story_block}"
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
        "Книга шепчет тихо: не торопись, но и не зевай — в игре выгоду любят готовые.\n\n"
        "Рецепты для старта:\n"
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
        "Пример: <code>/recipe retsepty-alhimii-hope-water-pump-uncommon2</code>",
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
            "Укажи id.\n"
            "Пример: /recipe retsepty-alhimii-hope-water-pump-uncommon2\n\n"
            f"Доступные id: {_IDS}",
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
