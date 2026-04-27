@echo off
REM Если в терминале не находится npm — этот файл подставляет стандартный путь Node.js.

set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"

echo Проверка Node:
where node
node -v
echo.
echo Запуск: npm start
echo.

npm start
