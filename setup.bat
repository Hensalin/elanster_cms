@echo off
setlocal
cd /d "%~dp0"
echo.
echo === Elanster CMS first-time setup ===
echo.
where node >nul 2>&1 || (echo Node.js was not found. Install Node.js 22 from https://nodejs.org then run this again. & pause & exit /b 1)
set "PGBIN="
for /d %%D in ("C:\Program Files\PostgreSQL\*") do if exist "%%D\bin\psql.exe" set "PGBIN=%%D\bin"
if not defined PGBIN (echo PostgreSQL was not found. Install PostgreSQL 16 from https://www.postgresql.org/download/windows/ then run this again. & pause & exit /b 1)

if exist .env goto have_env
set /p PGPASS=Enter the PostgreSQL password you chose for user "postgres": 
set /p ADMINPASS=Choose a password for your CMS admin login (10+ characters, use only letters, numbers, - _ .): 
set "PGPASSWORD=%PGPASS%"
"%PGBIN%\psql.exe" -U postgres -h localhost -tAc "SELECT 1 FROM pg_database WHERE datname='elanster_cms'" | find "1" >nul
if errorlevel 1 (
  echo Creating database elanster_cms ...
  "%PGBIN%\psql.exe" -U postgres -h localhost -c "CREATE DATABASE elanster_cms" || (echo Could not connect. Check the PostgreSQL password. & pause & exit /b 1)
)
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
echo (Close this window to stop the CMS. Next time, run start.bat)
start "" http://localhost:3000
call npm run dev
