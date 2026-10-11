# Otevření nativního projektu v Android Studiu
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Caffeechko - Otevření Android Studia" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
Set-Location -Path "$PSScriptRoot/frontend"

Write-Host "`n[1/2] Sestavení frontendu a synchronizace..." -ForegroundColor Yellow
npm.cmd run build
npx.cmd cap sync android

Write-Host "`n[2/2] Spouštění Android Studia..." -ForegroundColor Yellow
npx.cmd cap open android
