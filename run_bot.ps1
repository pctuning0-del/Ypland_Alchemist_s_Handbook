# Запуск Telegram-бота с привязкой к сайту на GitHub Pages.
# Токен НЕ хранится в файле — задай его перед запуском в этой же консоли:
#   $env:TELEGRAM_BOT_TOKEN="токен_от_BotFather"
# Затем:
#   .\run_bot.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$env:SITE_URL = "https://pctuning0-del.github.io/Ypland_Alchemist_s_Handbook/"

if (-not $env:TELEGRAM_BOT_TOKEN -or $env:TELEGRAM_BOT_TOKEN.Trim() -eq "") {
    Write-Host ""
    Write-Host "Сначала задай токен бота (одной строкой в PowerShell):" -ForegroundColor Yellow
    Write-Host '  $env:TELEGRAM_BOT_TOKEN="ВСТАВЬ_ТОКЕН_ОТ_BOTFATHER"' -ForegroundColor Cyan
    Write-Host "Потом снова запусти: .\run_bot.ps1" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "SITE_URL=$env:SITE_URL" -ForegroundColor Green
Write-Host "Запуск бота... (остановка: Ctrl+C)" -ForegroundColor Green
py bot.py
