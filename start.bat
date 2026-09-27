@echo off
rem Double-click to start Sports Live on http://localhost:3000 and open it in the browser.
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  node server.js --open
) else (
  echo Node.js was not found, using the built-in PowerShell server instead.
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\serve.ps1" -Open
)
pause
