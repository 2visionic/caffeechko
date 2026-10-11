@echo off
chcp 65001 > nul
echo ========================================================
echo   Caffeechko - Otevření Android Studia
echo ========================================================
cd frontend
echo [1/2] Sestavení a synchronizace změn...
call npm run build
call npx cap sync android
echo [2/2] Spouštění Android Studia...
call npx cap open android
