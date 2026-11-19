@echo off
title Elanster CMS - merge websites into demooo
cd /d "%~dp0backend"
if not exist "node_modules" (echo Run START-CMS.bat once first. & pause & exit /b 1)
echo This keeps ONE website ("demooo") with one copy of every article and page,
echo and removes every other website: Elanster Technologies, elanster-demo,
echo elanster-deo, main-elansyer, Indzara and We Are Zion.
echo Removed websites are hidden, not erased, so they can be restored if needed.
echo.
pause
node --env-file=.env.local scripts/merge-websites.mjs demooo elanster,elanster-demo,elanster-deo,main-elansyer,indzara,we-are-zion
echo.
pause
