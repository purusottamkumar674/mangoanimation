@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Opening the direct HTML preview instead.
  start "" "%~dp0index.html"
  pause
  exit /b
)
echo Starting Frooti at http://127.0.0.1:3000
start "FROOTI local server" cmd /k node server.js
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:3000"
echo Close the server terminal or press Ctrl+C in it to stop the server.
