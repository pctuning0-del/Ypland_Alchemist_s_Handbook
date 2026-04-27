@echo off
REM Запуск бота без смены политики скриптов для всей системы.
REM Сначала в этом же окне задай токен:
REM   set TELEGRAM_BOT_TOKEN=твой_токен
REM Затем: run_bot.bat

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run_bot.ps1"
