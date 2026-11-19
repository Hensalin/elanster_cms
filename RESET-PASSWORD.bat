@echo off
title Elanster CMS - set password
cd /d "%~dp0backend"
if not exist "node_modules" (echo Run START-CMS.bat once first. & pause & exit /b 1)
call npm run --silent db:set-password
echo.
pause
