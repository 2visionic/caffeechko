@echo off
chcp 65001 >nul
echo ========================================================
echo   Spousteni aplikace caffeechko (instance magicware)
echo ========================================================
echo.
echo 1. Spoustim .NET Backend na http://localhost:5000 ...
start "caffeechko Backend (:5000)" cmd /k "cd backend && set DOTNET_WATCH_RESTART_ON_RUDE_EDIT=1 && dotnet watch --no-hot-reload --non-interactive run --urls http://localhost:5000"

echo 2. Spoustim React/Vite Frontend na http://localhost:5200 ...
start "caffeechko Frontend (:5200)" cmd /k "cd frontend && npm run dev"

echo.
echo Vse bezi!
echo - Webova aplikace: http://localhost:5200
echo - Backend API & Scalar UI: http://localhost:5000/scalar/v1
echo.
pause
