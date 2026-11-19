@echo off
title Elanster CMS - upload update
setlocal
cd /d "%~dp0"
echo ============================================================
echo  1/3  Install packages
echo ============================================================
cd backend
call npm install --no-audit --no-fund || goto :fail
echo ============================================================
echo  2/3  Update the database (adds new columns, safe to repeat)
echo ============================================================
call npm run db:update || goto :fail
cd ..
echo ============================================================
echo  3/3  Upload the CMS code to GitHub (Vercel redeploys it)
echo ============================================================
git add -A
git commit -m "CMS update: every text found, page review workflow, polish"
git push || goto :fail
echo.
echo  Done. Wait about one minute for Vercel, then reload the CMS.
pause
exit /b 0
:fail
echo.
echo  Something failed. Read the red message above and send a screenshot.
pause
exit /b 1
