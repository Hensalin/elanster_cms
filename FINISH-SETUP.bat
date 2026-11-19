@echo off
title Elanster - finish setup
setlocal
set CMS=%~dp0
set SITE=D:\Website\landing-design\website_elanster-v1.0.2
echo ============================================================
echo  1/2  Upload the CMS code to GitHub (Vercel redeploys it)
echo ============================================================
cd /d "%CMS%"
git add -A
git commit -m "CMS update"
git push
echo.
echo ============================================================
echo  2/2  Upload the website to GitHub (Vercel redeploys it)
echo ============================================================
cd /d "%SITE%"
git remote get-url origin >nul 2>nul || git remote add origin https://github.com/Hensalin/elanster_website-demo.git
git fetch origin
git rev-parse --verify -q origin/main >nul && git reset --soft origin/main
git add -A
git reset -q -- .claude _site_check.tgz 2>nul
git commit -m "Website: CMS connection (demooo), any tagged page editable, privacy and 404 pages"
git push -u origin HEAD:main
echo.
echo ============================================================
echo  Finished. Check the messages above for any red errors.
echo ============================================================
pause
