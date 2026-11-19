@echo off
title Elanster CMS - sync website
cd /d "%~dp0backend"
call npx tsx --env-file=.env.local scripts/sync-site.ts demooo
echo.
echo (Saved to backend\sync-log.txt)
pause
