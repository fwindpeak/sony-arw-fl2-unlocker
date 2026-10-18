@echo off
setlocal
cd /d "%~dp0"
echo [Sony ARW Unlocker] Starting Windows Installation...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-skill.ps1"
if %errorlevel% neq 0 (
    echo.
    echo [!] PowerShell installer encountered an issue. Falling back to Python installer...
    python "%~dp0install_skill.py"
)
pause
