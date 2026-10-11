# Sestavení a synchronizace pro Android (Capacitor)
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Caffeechko - Sestavení aplikace pro Android (Capacitor)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
Set-Location -Path "$PSScriptRoot/frontend"

Write-Host "`n[1/2] Kompilace frontendu (TypeScript + Vite)..." -ForegroundColor Yellow
npm.cmd run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[CHYBA] Kompilace frontendu selhala!" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`n[2/2] Synchronizace aktiv do nativního Android projektu..." -ForegroundColor Yellow
npx.cmd cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Host "[CHYBA] Synchronizace Capacitoru selhala!" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`n[HOTOVO] Android projekt je připraven v adresáři frontend/android!" -ForegroundColor Green
