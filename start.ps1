# MatteTrening - Oppstartsscript
# Kjør dette i PowerShell: .\start.ps1

$serverPath = Join-Path $PSScriptRoot "server"
$clientPath = Join-Path $PSScriptRoot "client"

Write-Host "Installerer avhengigheter..." -ForegroundColor Cyan

Set-Location $serverPath
npm install
if ($LASTEXITCODE -ne 0) { Write-Error "Server npm install feilet"; exit 1 }

Set-Location $clientPath
npm install
if ($LASTEXITCODE -ne 0) { Write-Error "Client npm install feilet"; exit 1 }

Set-Location $PSScriptRoot
Write-Host "`nAvhengigheter installert!" -ForegroundColor Green
Write-Host "Starter server og klient..." -ForegroundColor Cyan

# Start server i eget vindu
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$serverPath'; npm run dev"

# Start klient i eget vindu
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$clientPath'; npm run dev"

Write-Host "`nApplikasjonen kjorer pa http://localhost:5173" -ForegroundColor Green
Write-Host "Server kjorer pa http://localhost:3001" -ForegroundColor Yellow
