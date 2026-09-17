@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title Instalador - Controle de Notas

set "REPO_URL=https://github.com/Organizacao-do-sistema-de-notas/controle-notass.git"
set "DB_NAME=controle_notas"
set "API_PORT=3000"

cls
echo ============================================================
echo           CONTROLE DE NOTAS - INSTALACAO COMPLETA
echo ============================================================
echo.
echo Este instalador prepara uma maquina Windows para desenvolvimento
echo ou reinstalacao local do sistema.
echo.

:: Winget e instalacoes de sistema normalmente precisam de administrador.
net session >nul 2>&1
if not "%errorlevel%"=="0" (
    echo Solicitando permissao de administrador...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

:: ------------------------------------------------------------
:: 1. WINGET
:: ------------------------------------------------------------
where winget >nul 2>&1
if errorlevel 1 (
    echo [ERRO] O Windows Package Manager ^(winget^) nao foi encontrado.
    echo Instale o App Installer da Microsoft e execute este arquivo novamente.
    pause
    exit /b 1
)

echo [1/8] Verificando Git...
where git >nul 2>&1
if errorlevel 1 (
    echo Git nao encontrado. Instalando...
    winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements
    if errorlevel 1 goto :erro_instalacao
    set "PATH=%PATH%;%ProgramFiles%\Git\cmd"
)
where git >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Git foi instalado, mas ainda nao esta disponivel no PATH.
    echo Reinicie o Windows e execute este instalador novamente.
    pause
    exit /b 1
)

echo [2/8] Verificando Node.js e npm...
where node >nul 2>&1
if errorlevel 1 (
    echo Node.js LTS nao encontrado. Instalando...
    winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
    if errorlevel 1 goto :erro_instalacao
    set "PATH=%PATH%;%ProgramFiles%\nodejs"
)
where npm >nul 2>&1
if errorlevel 1 (
    set "PATH=%PATH%;%ProgramFiles%\nodejs"
)
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERRO] npm nao ficou disponivel no PATH.
    echo Reinicie o Windows e execute este instalador novamente.
    pause
    exit /b 1
)

echo [3/8] Verificando PostgreSQL 17...
call :localizar_psql
if not defined PSQL (
    echo PostgreSQL 17 nao encontrado.
    echo O instalador oficial sera aberto. Durante a instalacao, anote:
    echo   - a senha do usuario postgres
    echo   - a porta escolhida ^(normalmente 5432^)
    echo.
    winget install --id PostgreSQL.PostgreSQL.17 -e --accept-package-agreements --accept-source-agreements
    if errorlevel 1 goto :erro_instalacao
    call :localizar_psql
)
if not defined PSQL (
    echo [ERRO] Nao foi possivel localizar psql.exe apos a instalacao.
    echo Reinicie o Windows e execute este instalador novamente.
    pause
    exit /b 1
)

echo PostgreSQL localizado em:
echo %PSQL%
echo.

:: ------------------------------------------------------------
:: 2. PROJETO
:: ------------------------------------------------------------
echo [4/8] Preparando o codigo do sistema...
set "SCRIPT_DIR=%~dp0"
if exist "%SCRIPT_DIR%.git" (
    set "PROJECT_DIR=%SCRIPT_DIR:~0,-1%"
    echo Repositorio detectado na mesma pasta do instalador.
    git -C "%PROJECT_DIR%" pull
    if errorlevel 1 goto :erro_git
) else (
    set "DEFAULT_PROJECT_DIR=%USERPROFILE%\Desktop\Trabalho-controle"
    echo.
    echo Pasta padrao:
    echo %DEFAULT_PROJECT_DIR%
    set /p "PROJECT_DIR=Pressione ENTER para usar a pasta padrao ou informe outra pasta: "
    if not defined PROJECT_DIR set "PROJECT_DIR=%DEFAULT_PROJECT_DIR%"

    if exist "%PROJECT_DIR%\.git" (
        echo Repositorio ja existe. Atualizando...
        git -C "%PROJECT_DIR%" pull
        if errorlevel 1 goto :erro_git
    ) else (
        if exist "%PROJECT_DIR%" (
            echo [ERRO] A pasta escolhida ja existe, mas nao e um repositorio Git:
            echo %PROJECT_DIR%
            echo Escolha uma pasta vazia ou remova/renomeie a pasta existente.
            pause
            exit /b 1
        )

        git clone "%REPO_URL%" "%PROJECT_DIR%"
        if errorlevel 1 goto :erro_git
    )
)

echo.
echo Projeto em: %PROJECT_DIR%
echo.

:: ------------------------------------------------------------
:: 3. DEPENDENCIAS NODE
:: ------------------------------------------------------------
echo [5/8] Instalando dependencias do backend...
pushd "%PROJECT_DIR%\backend"
call npm install
if errorlevel 1 (
    popd
    goto :erro_npm
)
popd

echo.
echo Instalando dependencias do frontend...
pushd "%PROJECT_DIR%\frontend"
call npm install
if errorlevel 1 (
    popd
    goto :erro_npm
)
popd

:: ------------------------------------------------------------
:: 4. BANCO / .ENV
:: ------------------------------------------------------------
echo.
echo [6/8] Configurando banco de dados...
if exist "%PROJECT_DIR%\.env" (
    echo Ja existe um arquivo .env nesta instalacao.
    choice /C SN /N /M "Deseja manter o .env atual? [S/N]: "
    if errorlevel 2 goto :configurar_env
    goto :depois_env
)

:configurar_env
set "DB_HOST=localhost"
set "DB_PORT=5432"
set "DB_USER=postgres"

echo.
set /p "NOVO_HOST=Host do PostgreSQL [localhost]: "
if defined NOVO_HOST set "DB_HOST=%NOVO_HOST%"
set /p "NOVA_PORTA=Porta do PostgreSQL [5432]: "
if defined NOVA_PORTA set "DB_PORT=%NOVA_PORTA%"
set /p "NOVO_USUARIO=Usuario do PostgreSQL [postgres]: "
if defined NOVO_USUARIO set "DB_USER=%NOVO_USUARIO%"

echo.
echo Digite a senha do PostgreSQL. Ela nao sera exibida na tela.
for /f "usebackq delims=" %%P in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=Read-Host 'Senha do PostgreSQL' -AsSecureString; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try {[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}"`) do set "DB_PASSWORD=%%P"

if not defined DB_PASSWORD (
    echo [ERRO] Nenhuma senha foi informada.
    pause
    exit /b 1
)

set "PGPASSWORD=%DB_PASSWORD%"

"%PSQL%" -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d postgres -c "SELECT 1;" >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Nao foi possivel conectar ao PostgreSQL.
    echo Confira usuario, senha, host e porta.
    set "PGPASSWORD="
    set "DB_PASSWORD="
    pause
    exit /b 1
)

"%PSQL%" -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='%DB_NAME%';" | findstr /x "1" >nul
if errorlevel 1 (
    echo Criando banco %DB_NAME%...
    "%PSQL%" -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d postgres -c "CREATE DATABASE %DB_NAME%;"
    if errorlevel 1 (
        echo [ERRO] Nao foi possivel criar o banco %DB_NAME%.
        set "PGPASSWORD="
        set "DB_PASSWORD="
        pause
        exit /b 1
    )
) else (
    echo Banco %DB_NAME% ja existe.
)

:: Monta DATABASE_URL com a senha codificada para URL sem exibir a senha.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=[Uri]::EscapeDataString($env:DB_PASSWORD); $url='postgresql://'+$env:DB_USER+':'+$p+'@'+$env:DB_HOST+':'+$env:DB_PORT+'/'+$env:DB_NAME; Set-Content -LiteralPath (Join-Path $env:PROJECT_DIR '.env') -Value @('DATABASE_URL=\"'+$url+'\"','PORT='+$env:API_PORT) -Encoding utf8"
if errorlevel 1 (
    echo [ERRO] Nao foi possivel criar o arquivo .env.
    set "PGPASSWORD="
    set "DB_PASSWORD="
    pause
    exit /b 1
)

set "PGPASSWORD="
set "DB_PASSWORD="
echo Arquivo .env criado com sucesso.

:depois_env
:: ------------------------------------------------------------
:: 5. PRISMA / VALIDACOES
:: ------------------------------------------------------------
echo.
echo [7/8] Preparando Prisma e banco...
pushd "%PROJECT_DIR%\backend"
call npx prisma generate
if errorlevel 1 (
    popd
    goto :erro_prisma
)
call npx prisma migrate deploy
if errorlevel 1 (
    popd
    goto :erro_prisma
)
call npx tsc --noEmit
if errorlevel 1 (
    popd
    goto :erro_typescript
)
popd

:: ------------------------------------------------------------
:: 6. BUILD FRONTEND
:: ------------------------------------------------------------
echo.
echo [8/8] Validando frontend...
pushd "%PROJECT_DIR%\frontend"
call npm run build
if errorlevel 1 (
    popd
    goto :erro_frontend
)
popd

cls
echo ============================================================
echo             INSTALACAO CONCLUIDA COM SUCESSO
echo ============================================================
echo.
echo Projeto: %PROJECT_DIR%
echo Backend:  http://localhost:%API_PORT%
echo Frontend: http://localhost:5173
echo Banco:    %DB_NAME%
echo.
echo Para usar o sistema, mantenha duas janelas abertas:
echo   backend  - npm run dev
echo   frontend - npm run dev
echo.
choice /C SN /N /M "Deseja iniciar o sistema agora? [S/N]: "
if errorlevel 2 goto :fim

start "Controle de Notas - Backend" cmd /k "cd /d \"%PROJECT_DIR%\backend\" && npm run dev"
timeout /t 2 /nobreak >nul
start "Controle de Notas - Frontend" cmd /k "cd /d \"%PROJECT_DIR%\frontend\" && npm run dev"
timeout /t 3 /nobreak >nul
start "" "http://localhost:5173"

goto :fim

:localizar_psql
set "PSQL="
if exist "%ProgramFiles%\PostgreSQL\17\bin\psql.exe" set "PSQL=%ProgramFiles%\PostgreSQL\17\bin\psql.exe"
if defined PSQL exit /b 0
for /f "delims=" %%P in ('where psql 2^>nul') do if not defined PSQL set "PSQL=%%P"
exit /b 0

:erro_instalacao
echo.
echo [ERRO] Falha ao instalar um dos pre-requisitos pelo winget.
echo Corrija a instalacao indicada acima e execute o arquivo novamente.
pause
exit /b 1

:erro_git
echo.
echo [ERRO] O Git nao conseguiu baixar/atualizar o projeto.
echo Verifique a internet e o acesso ao repositorio.
pause
exit /b 1

:erro_npm
echo.
echo [ERRO] Falha ao instalar as dependencias Node.js.
pause
exit /b 1

:erro_prisma
echo.
echo [ERRO] Falha ao preparar o Prisma ou aplicar as migrations.
echo Confira o PostgreSQL e o arquivo .env.
pause
exit /b 1

:erro_typescript
echo.
echo [ERRO] O backend possui erros de TypeScript.
pause
exit /b 1

:erro_frontend
echo.
echo [ERRO] O build do frontend falhou.
pause
exit /b 1

:fim
echo.
echo Finalizado.
pause
endlocal
