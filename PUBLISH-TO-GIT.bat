@echo off
title Elanster CMS - publish to Git now
cd /d "%~dp0backend"
call npx tsx --env-file=.env.local scripts/git-publish.ts demooo
echo.
echo (Saved to backend\git-publish-log.txt)
pause
