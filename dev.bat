@echo off
cd /d "%~dp0"
echo Starting Smartdok dev server...
node scripts\dev.cjs
if errorlevel 1 (
  echo.
  echo Dev server exited with an error.
  echo If port 3000 is busy, stop other Node processes and delete .next\dev\lock
  pause
)
