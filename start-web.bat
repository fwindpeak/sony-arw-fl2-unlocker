@echo off
setlocal
cd /d "%~dp0web"
echo [Sony ARW Web Unlocker] Starting Web Application...
if not exist node_modules (
    echo [*] Installing dependencies for first-time setup...
    call npm install
)
start http://localhost:5173
call npm run dev
