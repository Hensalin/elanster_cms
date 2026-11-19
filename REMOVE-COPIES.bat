@echo off
title Elanster CMS - remove copied articles
cd /d "%~dp0backend"
echo Looking for copied articles on demooo (nothing is changed yet)...
echo.
call npx tsx --env-file=.env.local scripts/remove-copies.ts demooo
echo.
set /p OK=Hide these copies and remove their files from GitHub? Type Y and press Enter: 
if /i not "%OK%"=="Y" (echo Nothing was changed. & pause & exit /b)
call npx tsx --env-file=.env.local scripts/remove-copies.ts demooo --yes
echo.
echo (Saved to backend\remove-copies-log.txt)
pause
