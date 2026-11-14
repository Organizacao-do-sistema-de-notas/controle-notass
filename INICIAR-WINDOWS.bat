@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\Configurar-Windows.ps1" %*
set "CONTROLE_NOTAS_EXIT=%ERRORLEVEL%"
if not "%CONTROLE_NOTAS_EXIT%"=="0" (
  echo.
  echo Nao foi possivel concluir. Confira a mensagem acima.
)
echo.
pause
exit /b %CONTROLE_NOTAS_EXIT%
