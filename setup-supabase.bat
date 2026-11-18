@echo off
setlocal
cd /d "%~dp0"
echo.
echo === Elanster CMS setup with Supabase ===
echo.
where node >nul 2>&1 || (echo Node.js was not found. Install Node.js 22 from https://nodejs.org then run this again. & pause & exit /b 1)
if exist .env goto have_env
echo In Supabase click Connect, copy the "Session pooler" connection string,
echo replace [YOUR-PASSWORD] with your database password, then paste it here.
set /p DBURL=Connection string: 
set /p ADMINPASS=Choose a password for your CMS admin login (10+ characters, use only letters, numbers, - _ .): 
node scripts\setup-env.mjs || (pause & exit /b 1)
:have_env
echo Installing packages (a few minutes the first time) ...
call npm install || (pause & exit /b 1)
echo Creating database tables ...
call npm run db:migrate || (pause & exit /b 1)
echo Creating your admin user and websites ...
call npm run db:seed || (pause & exit /b 1)
echo.
echo Setup done. Starting the CMS at http://localhost:3000
echo Sign in with admin@elanster.com and the admin password you chose.
echo (Next time, run start.bat)
start "" http://localhost:3000
call npm run dev
