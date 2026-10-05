@echo off
cd /d "%~dp0" || exit /b 1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1" %*
exit /b %errorlevel%
