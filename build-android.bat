@echo off
chcp 65001 > nul
echo ========================================================
echo   Caffeechko - Sestavení mobilní aplikace Android (Capacitor)
echo ========================================================
cd frontend
echo [1/2] Kompilace frontendu...
call npm run build
if %errorlevel% neq 0 (
    echo [CHYBA] Kompilace frontendu selhala.
    pause
    exit /b %errorlevel%
)
echo [2/2] Synchronizace do nativního Android projektu...
call npx cap sync android
if %errorlevel% neq 0 (
    echo [CHYBA] Synchronizace Capacitoru selhala.
    pause
    exit /b %errorlevel%
)
echo ========================================================
echo   Android projekt je aktualizován a připraven ke kompilaci!
echo ========================================================
pause
