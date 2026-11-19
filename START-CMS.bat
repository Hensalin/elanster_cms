@echo off
title Elanster CMS - starter
cd /d "%~dp0"

where node >nul 2>nul || (echo Node.js is not installed. Install it from https://nodejs.org and run this again. & pause & exit /b 1)

if not exist "backend\.env.local" (echo backend\.env.local is missing. & pause & exit /b 1)
if not exist "frontend\.env.local" (echo BACKEND_URL=http://localhost:3001> "frontend\.env.local")

if not exist "backend\node_modules" (
  echo Installing backend packages, first time only...
  pushd backend & call npm install & popd
)
if not exist "frontend\node_modules" (
  echo Installing frontend packages, first time only...
  pushd frontend & call npm install & popd
)

echo Updating the database (safe to repeat)...
pushd backend & call npm run db:update & popd

start "Elanster CMS - BACKEND (port 3001)" cmd /k "cd /d %~dp0backend && npm run dev"
start "Elanster CMS - FRONTEND (port 3000)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Waiting for the CMS to start...
timeout /t 15 /nobreak >nul
start "" http://localhost:3000
echo.
echo Elanster CMS is running at http://localhost:3000
echo To stop it, close the BACKEND and FRONTEND windows.
timeout /t 5 >nul
