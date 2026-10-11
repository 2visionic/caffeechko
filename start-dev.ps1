# Spousteci skript pro caffeechko
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   Spousteni aplikace caffeechko (instance magicware)   " -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan

Write-Host "1. Spoustim .NET 9 Backend (:5000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User'); cd '$PSScriptRoot\backend'; Write-Host 'caffeechko Backend bezi na http://localhost:5000' -ForegroundColor Cyan; dotnet run --urls 'http://localhost:5000'"

Write-Host "2. Spoustim Vite Frontend (:5200)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User'); cd '$PSScriptRoot\frontend'; Write-Host 'caffeechko Frontend bezi na http://localhost:5200' -ForegroundColor Cyan; npm.cmd run dev"

Write-Host ""
Write-Host "Hotovo!" -ForegroundColor Green
Write-Host "-> Aplikace: http://localhost:5200" -ForegroundColor White
Write-Host "-> API Docs (Scalar): http://localhost:5000/scalar/v1" -ForegroundColor White
