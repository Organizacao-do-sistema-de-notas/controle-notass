@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Backup-Banco.ps1" %*
set "CONTROLE_NOTAS_EXIT=%ERRORLEVEL%"
echo.
pause
exit /b %CONTROLE_NOTAS_EXIT%
