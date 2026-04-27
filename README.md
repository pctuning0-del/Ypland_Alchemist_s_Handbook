# Справочник алхимика — Алхимическая Книга Юпленд

Тёплый сказочный мини-сайт со списком рецептов и страницей деталей + простой Telegram-бот. Рецепты хранятся в одном файле **`recipes.json`** — его читают и браузер, и бот.

Репозиторий: **https://github.com/pctuning0-del/Ypland_Alchemist_s_Handbook**

## Возможности

- главная в виде «разворота книги»: список рецептов и подсказка;
- клик по рецепту открывает детали, кнопка «Назад» или клавиша **Esc**;
- данные только в **`recipes.json`** — правишь один файл;
- **`bot.py`**: `/start`, `/help`, `/recipes`, `/recipe id`, кнопки по каждому рецепту и «Открыть книгу» при заданном `SITE_URL`.

В первой версии **нет** подключения Near-кошелька.

## Запуск сайта локально (рекомендуется)

Рецепты подгружаются через `fetch("recipes.json")`. При открытии **`index.html` как файла** (`file://`) браузер часто **не даёт** загрузить JSON — список будет пустым. Поэтому проще всего поднять маленький сервер:

```powershell
cd путь\к\Ypland_Alchemist_s_Handbook
py -m http.server 8000
```

В браузере открой: **http://127.0.0.1:8000** (или `http://localhost:8000`). Обновление после правок: **Ctrl+F5**.

На macOS/Linux вместо `py` часто используют `python3 -m http.server 8000`.

## Структура проекта

| Файл | Назначение |
|------|------------|
| `index.html` | Разметка страницы |
| `styles.css` | Оформление «книги» |
| `main.js` | Загрузка `recipes.json`, список и детали рецепта |
| `recipes.json` | Все рецепты (редактируй здесь) |
| `bot.py` | Telegram-бот |
| `run_bot.ps1` | Запуск бота с уже прописанным `SITE_URL` (GitHub Pages) |
| `run_bot.bat` | То же, если PowerShell блокирует `.ps1` (политика выполнения) |
| `index.js`, `package.json` | Минимальный бот на **Node.js** (grammY), токен `BOT_TOKEN` в `.env` |
| `requirements.txt` | Зависимости Python для бота |
| `.gitignore` | Исключает служебное (`__pycache__`, `.env` и т.п.) |

После изменения **`recipes.json`**: обнови сайт в браузере; если запущен бот — перезапусти **`py bot.py`**.

## Telegram-бот

1. В Telegram создай бота через [@BotFather](https://t.me/BotFather), получи **токен**.
2. Установи зависимости:

```powershell
py -m pip install -r requirements.txt
```

3. Задай **только токен** (он не должен попадать в Git и в чаты). Адрес сайта уже прописан в **`run_bot.ps1`** (`SITE_URL`).

**Вариант А — проще всего (обходит блокировку скриптов Windows):**

```powershell
$env:TELEGRAM_BOT_TOKEN="вставь_токен_от_BotFather"
powershell -NoProfile -ExecutionPolicy Bypass -File .\run_bot.ps1
```

**Вариант Б — через `cmd`:**

```bat
set TELEGRAM_BOT_TOKEN=вставь_токен_от_BotFather
run_bot.bat
```

**Вариант В — вручную:**

```powershell
$env:TELEGRAM_BOT_TOKEN="вставь_токен_от_BotFather"
$env:SITE_URL="https://pctuning0-del.github.io/Ypland_Alchemist_s_Handbook/"
py bot.py
```

Остановка бота: **Ctrl+C**.

Если при `.\run_bot.ps1` ошибка про **Execution Policy**, используй вариант А или Б — менять политику для всей системы не обязательно.

## Публикация на GitHub Pages

1. Репозиторий на GitHub → **Settings** → **Pages**.
2. **Build and deployment**: ветка **`main`**, папка **`/(root)`**, сохранить.
3. Через 1–2 минуты сайт будет доступен по вида  
   `https://pctuning0-del.github.io/Ypland_Alchemist_s_Handbook/`  
   (точный URL смотри в настройках Pages.)

Убедись, что в репозитории лежат **`index.html`** и **`recipes.json`** в корне — иначе список не загрузится.

## Бот 24/7 (хостинг, не твой ПК)

Сайт может жить на **GitHub Pages**, а бот — крутиться **на сервере** (в фоне), тогда он отвечает, даже когда компьютер выключен.

В репозитории есть **`Dockerfile`**: в контейнер копируются `bot.py`, `recipes.json` и `requirements.txt`, команда запуска — `python bot.py`.

**Переменные на хостинге (обязательно задать в панели, не в коде):**

| Имя | Значение |
|-----|----------|
| `TELEGRAM_BOT_TOKEN` | Токен от [@BotFather](https://t.me/BotFather) |
| `SITE_URL` | Публичный URL сайта, например `https://pctuning0-del.github.io/Ypland_Alchemist_s_Handbook/` |

**Упрощённый сценарий (Railway / Render / Fly и т.п.):**

1. Зарегистрируйся на сервисе и подключи свой репозиторий GitHub.
2. Выбери деплой **из Dockerfile** (или образ Python + команда запуска `python bot.py` из корня репозитория).
3. Добавь переменные `TELEGRAM_BOT_TOKEN` и `SITE_URL` в разделе **Variables / Environment**.
4. Запусти деплой. В логах должно быть «Бот запущен» без ошибки про отсутствие токена.

Тарифы у сервисов меняются — есть бесплатные пробные периоды или небольшая ежемесячная плата; карточку часто просят даже для триала.

## Telegram-бот на Node.js (grammY)

Альтернатива Python: в корне есть **`index.js`** и **`package.json`** — минимальный бот на библиотеке [grammY](https://grammy.dev/).

**Что нужно:** установленный [Node.js](https://nodejs.org/) (лучше LTS, версия 18+).

**Шаги:**

1. Установи зависимости в папке проекта:

```powershell
npm install
```

2. Создай файл **`.env`** рядом с `index.js` (можно скопировать `.env.example`):

```powershell
copy .env.example .env
```

Открой `.env` и впиши токен после `BOT_TOKEN=` (от [@BotFather](https://t.me/BotFather)). Без пробелов и кавычек вокруг токена.

3. Запуск бота:

```powershell
npm start
```

Остановка: **Ctrl+C**.

Переменная **`BOT_TOKEN`** может задаваться и на хостинге без файла `.env` — главное, чтобы она была в окружении перед `node index.js`.

## Лицензия

По желанию добавь файл лицензии или оставь права за собой.
