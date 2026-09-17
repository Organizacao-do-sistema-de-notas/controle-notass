@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Iniciar Controle de Notas

set "PROJECT_DIR=%~dp0"
set "BACKEND_DIR=%PROJECT_DIR%backend"
set "FRONTEND_DIR=%PROJECT_DIR%frontend"
set "FRONTEND_URL=http://localhost:5173"

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

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERRO] npm nao foi encontrado no PATH.
    echo Instale o Node.js ou execute instalar-controle-notas.bat.
    echo.
    pause
    exit /b 1
)

echo Iniciando backend...
start "Controle de Notas - Backend" cmd /k "cd /d ""%BACKEND_DIR%"" && npm run dev"

timeout /t 2 /nobreak >nul

echo Iniciando frontend...
start "Controle de Notas - Frontend" cmd /k "cd /d ""%FRONTEND_DIR%"" && npm run dev"

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
