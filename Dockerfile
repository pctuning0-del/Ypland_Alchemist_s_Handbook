# Образ только для Telegram-бота (24/7). Сайт по-прежнему на GitHub Pages.
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt bot.py recipes.json ./

RUN pip install --no-cache-dir -r requirements.txt

ENV PYTHONUNBUFFERED=1

CMD ["python", "bot.py"]
