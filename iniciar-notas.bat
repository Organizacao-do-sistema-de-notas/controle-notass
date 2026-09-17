@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title Iniciar Controle de Notas

set "PROJECT_DIR=%~dp0"
set "BACKEND_DIR=%PROJECT_DIR%backend"
set "FRONTEND_DIR=%PROJECT_DIR%frontend"
set "FRONTEND_URL=http://localhost:5173"
set "NPM_CMD="

cls
echo ============================================================
echo              CONTROLE DE NOTAS - INICIAR SISTEMA
echo ============================================================
echo.

if not exist "%BACKEND_DIR%\package.json" (
    echo [ERRO] Backend nao encontrado em:
    echo %BACKEND_DIR%
    echo.
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
    echo [ERRO] Frontend nao encontrado em:
    echo %FRONTEND_DIR%
    echo.
    pause
    exit /b 1
)

if not exist "%PROJECT_DIR%.env" (
    echo [ERRO] O arquivo .env nao foi encontrado na raiz do projeto.
    echo Execute primeiro instalar-controle-notas.bat ou configure o .env.
    echo.
    pause
    exit /b 1
)

:: Procura o npm de forma mais robusta do que apenas depender do PATH atual.
for /f "delims=" %%P in ('where.exe npm.cmd 2^>nul') do if not defined NPM_CMD set "NPM_CMD=%%P"
if not defined NPM_CMD if exist "%ProgramFiles%\nodejs\npm.cmd" set "NPM_CMD=%ProgramFiles%\nodejs\npm.cmd"
if not defined NPM_CMD if defined ProgramFiles(x86) if exist "%ProgramFiles(x86)%\nodejs\npm.cmd" set "NPM_CMD=%ProgramFiles(x86)%\nodejs\npm.cmd"
if not defined NPM_CMD if exist "%LOCALAPPDATA%\Programs\nodejs\npm.cmd" set "NPM_CMD=%LOCALAPPDATA%\Programs\nodejs\npm.cmd"

if not defined NPM_CMD (
    echo [ERRO] npm nao foi encontrado.
    echo.
    echo Se o Node.js ja estiver instalado, feche e abra novamente o VS Code
    echo ou o terminal para atualizar o PATH do Windows.
    echo.
    echo Caso ainda nao funcione, execute instalar-controle-notas.bat.
    echo.
    pause
    exit /b 1
)

echo npm localizado em:
echo %NPM_CMD%
echo.

echo Iniciando backend...
start "Controle de Notas - Backend" cmd /k "cd /d ""%BACKEND_DIR%"" && ""%NPM_CMD%"" run dev"

timeout /t 2 /nobreak >nul

echo Iniciando frontend...
start "Controle de Notas - Frontend" cmd /k "cd /d ""%FRONTEND_DIR%"" && ""%NPM_CMD%"" run dev"

echo.
echo Aguardando os servidores iniciarem...
timeout /t 3 /nobreak >nul

echo Abrindo sistema no navegador...
start "" "%FRONTEND_URL%"

echo.
echo ============================================================
echo Sistema iniciado.
echo.
echo Backend:  http://localhost:3000
echo Frontend: %FRONTEND_URL%
echo.
echo Foram abertas duas janelas de terminal:
echo   - Controle de Notas - Backend
echo   - Controle de Notas - Frontend
echo.
echo Para encerrar o sistema, feche essas duas janelas
echo ou pressione Ctrl+C dentro de cada uma.
echo ============================================================
echo.

timeout /t 4 /nobreak >nul
endlocal
exit /b 0
