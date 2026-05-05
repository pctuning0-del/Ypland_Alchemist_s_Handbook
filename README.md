# Справочник алхимика — Алхимическая Книга Юпленд

Тёплый сказочный мини-сайт со списком рецептов и страницей деталей + простой Telegram-бот. Рецепты хранятся в одном файле **`recipes.json`** — его читают и браузер, и бот.

Репозиторий: **https://github.com/pctuning0-del/Ypland_Alchemist_s_Handbook**

## Возможности

- главная в виде «разворота книги»: **слева список**, **справа страница рецепта**;
- клик по рецепту слева обновляет правую страницу; **Esc** или кнопка «Очистить страницу» очищают правую страницу;
- фильтр по **разделам** (`section`) в списке;
- данные только в **`recipes.json`** — правишь один файл (или пересобираешь импортом, см. ниже);
- на странице рецепта **состав** выводится:
  - либо **построчно** из `ingredients` (старый формат);
  - либо **блоками** из `ingredientsBlocks` (как в игре: “ВЫБЕРИ ОДИН” / “ВСЕ ОБЯЗАТЕЛЬНЫ”);
  - если название компонента **точно совпадает** с `name` другого рецепта в книге, по клику открывается **его** карточка;
- для токенов/валют в составе показываются круглые иконки (NEAR/BEES/MED/Golden DarAi) из `assets/*.png`;
- при наличии полей **`imageUrl`** / **`wikiUrl`** в карточке показываются картинка и ссылка на страницу вики YupLand;
- **`bot.py`**: `/start`, `/help`, `/recipes`, `/recipe id`, кнопки по каждому рецепту и «Открыть книгу» при заданном `SITE_URL`.

В первой версии **нет** подключения Near-кошелька.

## Формат `recipes.json`

Каждый объект в массиве `recipes` может содержать:

| Поле | Описание |
|------|-----------|
| `id` | Уникальный идентификатор (латиница `kebab-case`, для `/recipe` в боте). |
| `section` | Раздел книги (подзаголовок в списке и в шапке деталей). |
| `name` | Название рецепта. |
| `profitHint` | Короткая метка (например `Результат: 1`) — **без дублирования** текста из `section`. |
| `time` | Время (может быть пустой строкой). |
| `ingredients` | Состав: части через **`; `** (точка с запятой и пробел). На сайте каждая часть — отдельная строка; первый токен вида числа (`2`, `0.1`) считается количеством. |
| `ingredientsBlocks` | Состав блоками (опционально). Если есть — сайт/боты показывают блоки вместо `ingredients`. |
| `story` | Дополнительный текст под составом (может быть пустым). Импортёр с вики оставляет пустым. |
| `wikiUrl` | Ссылка на страницу YupLand wiki (опционально). |
| `imageUrl` | URL картинки рецепта (опционально). |

### `ingredientsBlocks` (блоки состава)

`ingredientsBlocks` — массив блоков:

- `type`: `"chooseOne"` или `"allRequired"`
- `items`: массив `{ qty, name }`

Пример:

```json
{
  "ingredientsBlocks": [
    { "type": "chooseOne", "items": [{ "qty": "1", "name": "BEES" }, { "qty": "3", "name": "MED" }] },
    { "type": "allRequired", "items": [{ "qty": "0.1", "name": "NEAR" }] }
  ]
}
```

Проверка целостности: `node tools/check_recipes.js` (из папки проекта).

## Импорт рецептов с вики YupLand

Страницы вики рендерятся в браузере; скрипт открывает их через **Playwright** с каналом **Microsoft Edge** (`channel: "msedge"`) и читает контент из `article.wiki-book-content`.

1. Список URL и разделов задаётся в **`tools/yupland_import_manifest.json`**.
2. Пересборка **`recipes.json`** (перезапишет файл целиком):

```powershell
cd путь\к\Ypland_Alchemist_s_Handbook
npm install
npm run import:yupland
```

Требуется установленный **Node.js 18+** и доступный **Edge** на машине, где запускаешь импорт. После импорта при необходимости перезапусти бота, если он уже был запущен.

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
| `main.js` | Загрузка `recipes.json`, список, детали, кликабельные ингредиенты |
| `recipes.json` | Все рецепты (редактируй здесь или импортируй скриптом) |
| `assets/` | Иконки для ингредиентов (NEAR/BEES/MED/Golden DarAi) |
| `tools/yupland_import_manifest.json` | Манифест URL вики для импорта |
| `tools/build_recipes_from_yupland.mjs` | Импорт страниц вики → `recipes.json` |
| `tools/check_recipes.js` | Проверка `recipes.json` (кол-во полей, уникальность `id`) |
| `CLAUDE.md` | Сводка продукта и правил для ассистента |
| `bot.py` | Telegram-бот |
| `run_bot.ps1` | Запуск бота с уже прописанным `SITE_URL` (GitHub Pages) |
| `run_bot.bat` | То же, если PowerShell блокирует `.ps1` (политика выполнения) |
| `index.js`, `package.json` | Минимальный бот на **Node.js** (grammY), токен `BOT_TOKEN` в `.env`, скрипт `import:yupland` |
| `start_node_bot.cmd` | Запуск `npm start`, если в терминале не видно `npm` (PATH) |
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

Альтернатива Python: в корне **`index.js`** и **`package.json`** — бот на [grammY](https://grammy.dev/) читает **`recipes.json`**, команды `/start`, `/help`, `/recipes`, `/recipe`, кнопки рецептов и (по желанию) **«Открыть книгу»** при заданном **`SITE_URL`** в `.env`. В карточке рецепта состав выводится **построчно**, количество жирным (HTML); пример команды: `/recipe retsepty-alhimii-hope-water-pump-uncommon2` (актуальный `id` смотри в ответе `/help`).

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

Открой `.env` и впиши токен после `BOT_TOKEN=` (от [@BotFather](https://t.me/BotFather)). Без пробелов и кавычек. При необходимости раскомментируй и задай **`SITE_URL`** (как в `bot.py` с кнопкой на GitHub Pages).

3. Запуск бота:

```powershell
npm start
```

Остановка: **Ctrl+C**.

**Если пишет, что `npm` / `node` «не распознано»** — терминал не видит Node в `PATH`. Сначала **полностью закрой и снова открой Cursor** (или ПК), либо в **этом** окне PowerShell выполни:

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

либо запусти в папке проекта двойным кликом / из cmd: **`start_node_bot.cmd`** — он подставляет путь `C:\Program Files\nodejs` и вызывает `npm start`.

Переменная **`BOT_TOKEN`** может задаваться и на хостинге без файла `.env` — главное, чтобы она была в окружении перед `node index.js`.

## Лицензия

По желанию добавь файл лицензии или оставь права за собой.
