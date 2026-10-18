<#
.SYNOPSIS
    Sony ARW Creative Look Web Unlocker Launcher
#>
Set-Location -Path (Join-Path $PSScriptRoot "web")
Write-Host "⚡ [Sony ARW Web Unlocker] Starting Web Application..." -ForegroundColor Cyan

if (-not (Test-Path "node_modules")) {
    Write-Host "[*] Installing dependencies for first-time setup..." -ForegroundColor Yellow
    npm install
}

Start-Process "http://localhost:5173"
npm run dev
