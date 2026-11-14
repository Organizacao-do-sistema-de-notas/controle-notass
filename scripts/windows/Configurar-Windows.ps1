[CmdletBinding()]
param(
    [string]$NomeProjeto = 'controle-notas-dev',
    [ValidateRange(1, 65535)][int]$PortaApi = 3000,
    [ValidateRange(1, 65535)][int]$PortaFrontend = 5173,
    [switch]$BancoVazio,
    [switch]$SemAbrirNavegador
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$EnvPath = Join-Path $ProjectRoot '.env.docker'
$BackupPath = Join-Path $ProjectRoot 'dados/controle_notas.dump'
$ManifestPath = Join-Path $ProjectRoot 'dados/manifesto_backup.json'
$MarkerPath = Join-Path $ProjectRoot 'backend/importacoes/restauracao_windows.json'
$SavedEnvironment = @{}
$Succeeded = $false

function Invoke-Docker {
    param([Parameter(Mandatory = $true)][string[]]$DockerArguments)
    & docker @script:DockerPrefix @DockerArguments
    $dockerExit = $LASTEXITCODE
    if ($dockerExit -ne 0) { throw "Docker retornou codigo $dockerExit. Consulte a mensagem acima." }
}
function Invoke-Compose {
    param([Parameter(Mandatory = $true)][string[]]$ComposeArguments)
    Invoke-Docker -DockerArguments ($script:ComposePrefix + $ComposeArguments)
}
function Read-DatabaseJson {
    param([Parameter(Mandatory = $true)][string]$SqlName)
    $localFile = Join-Path $PSScriptRoot $SqlName
    Invoke-Compose -ComposeArguments @('cp', $localFile, ('db:/tmp/' + $SqlName)) | Out-Host
    $output = Invoke-Compose -ComposeArguments @('exec', '-T', 'db', 'psql', '-X', '-qAt', '-h', '/var/run/postgresql', '-p', '5432', '-U', 'controle_notas', '-d', 'controle_notas', '-v', 'ON_ERROR_STOP=1', '-f', ('/tmp/' + $SqlName))
    return (($output -join "`n") | ConvertFrom-Json)
}
function Write-LocalJson {
    param([string]$Path, [object]$Value)
    $parent = Split-Path -Parent $Path
    if (!(Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent | Out-Null }
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($Path, (($Value | ConvertTo-Json -Depth 15) + [Environment]::NewLine), $utf8)
}

Push-Location $ProjectRoot
try {
    if (!(Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Instale o Docker com o plugin Compose. No Windows, use Docker Desktop com WSL 2 e Linux containers.' }
    if ($NomeProjeto -notmatch '^[a-z0-9][a-z0-9_-]{0,62}$') { throw 'Nome de projeto invalido. Use letras minusculas, numeros, - ou _.' }
    if ($PortaApi -eq $PortaFrontend) { throw 'As portas da API e do frontend devem ser diferentes.' }
    foreach ($key in @('DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH')) {
        $SavedEnvironment[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
        [Environment]::SetEnvironmentVariable($key, $null, 'Process')
    }
    $script:DockerPrefix = @()
    if ([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT) {
        $contexts = @(Invoke-Docker -DockerArguments @('context', 'ls', '--format', '{{.Name}}'))
        if ($contexts -contains 'desktop-linux') { $localContext = 'desktop-linux' } else { $localContext = 'default' }
        $endpoint = ((Invoke-Docker -DockerArguments @('context', 'inspect', $localContext, '--format', '{{.Endpoints.docker.Host}}')) -join '').Trim()
        if ($endpoint -notmatch '^npipe:////\./pipe/(dockerDesktopLinuxEngine|docker_engine)$') { throw 'Este instalador exige o Docker Desktop local por named pipe. Nenhum daemon remoto sera usado.' }
        $script:DockerPrefix = @('--context', $localContext)
    } else {
        # Allows validation in Codex while fixing the endpoint to its local daemon.
        $script:DockerPrefix = @('--host', 'unix:///var/run/docker.sock')
    }
    $osType = ((Invoke-Docker -DockerArguments @('info', '--format', '{{.OSType}}')) -join '').Trim()
    if ($osType -ne 'linux') { throw 'Inicie o Docker Desktop no modo Linux containers.' }
    Invoke-Docker -DockerArguments @('compose', 'version') | Out-Host

    $manifest = $null
    $backupHash = $null
    if ($BancoVazio) {
        if ((Test-Path -LiteralPath $BackupPath) -or (Test-Path -LiteralPath $ManifestPath)) { throw 'Pacote com backup detectado. Execute sem -BancoVazio para restaurar; nenhum dado foi alterado.' }
        Write-Host 'Modo banco vazio: serao criadas somente as tabelas locais. Clientes reais nao serao importados.'
    } else {
        if (!(Test-Path -LiteralPath $BackupPath) -or !(Test-Path -LiteralPath $ManifestPath)) { throw 'Backup ou manifesto ausente. Extraia o pacote completo ou use -BancoVazio para iniciar um banco local novo, sem clientes.' }
        $manifest = Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $backupHash = (Get-FileHash -LiteralPath $BackupPath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($backupHash -ne $manifest.backupSha256 -or $manifest.banco -ne 'controle_notas' -or $manifest.postgresMajor -ne 17) { throw 'Backup diferente do manifesto ou formato nao suportado. Nenhuma restauracao foi iniciada.' }

        $allowedOriginFiles = @('clientes_confere.csv', 'regras_confere.json')
        foreach ($entry in $manifest.arquivosOrigem.PSObject.Properties) {
            if ($allowedOriginFiles -notcontains $entry.Name) { throw 'Arquivo de origem nao permitido no manifesto.' }
            $originPath = Join-Path (Join-Path $ProjectRoot 'dados/origem') $entry.Name
            if (!(Test-Path -LiteralPath $originPath) -or (Get-FileHash -LiteralPath $originPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.Value) { throw 'Arquivo de origem diferente do manifesto.' }
        }
    }

    if (!(Test-Path -LiteralPath $EnvPath)) {
        $randomBytes = New-Object byte[] 24
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($randomBytes) } finally { $rng.Dispose() }
        $localPassword = [BitConverter]::ToString($randomBytes).Replace('-', '').ToLowerInvariant()
        $lines = @("POSTGRES_PASSWORD=$localPassword", "API_PORT=$PortaApi", "FRONTEND_PORT=$PortaFrontend", "COMPOSE_PROJECT_NAME=$NomeProjeto")
        [IO.File]::WriteAllLines($EnvPath, $lines, (New-Object System.Text.UTF8Encoding($false)))
        Write-Host 'Configuracao local criada com senha aleatoria. O valor nao sera exibido.'
    } else {
        Write-Host 'Configuracao .env.docker existente preservada.'
    }
    $script:ComposePrefix = @('compose', '--project-directory', $ProjectRoot, '--env-file', $EnvPath, '-f', (Join-Path $ProjectRoot 'compose.yaml'))
    if ($env:CODEX_PROXY_CERT -and (Test-Path -LiteralPath $env:CODEX_PROXY_CERT)) {
        $script:ComposePrefix += @('-f', (Join-Path $ProjectRoot 'compose.codex.yaml'))
    }
    # Keep secrets in memory only; never print the resolved Compose config.
    $configOutput = Invoke-Compose -ComposeArguments @('config', '--format', 'json')
    $config = (($configOutput -join "`n") | ConvertFrom-Json)
    if ($config.name -ne $NomeProjeto) { throw 'O nome do projeto difere do .env.docker existente. Use -NomeProjeto com o mesmo nome, sem trocar de volume.' }
    $script:ComposePrefix += @('-p', $NomeProjeto)
    $databaseUri = $null
    try { $databaseUri = [Uri]([string]$config.services.backend.environment.DATABASE_URL) } catch { throw 'DATABASE_URL local invalida.' }
    if ($databaseUri.Scheme -ne 'postgresql' -or $databaseUri.Host -ne 'db' -or $databaseUri.Port -ne 5432 -or $databaseUri.AbsolutePath -ne '/controle_notas' -or $databaseUri.Query -or $databaseUri.Fragment) { throw 'Destino recusado: a aplicacao deve usar exclusivamente db:5432/controle_notas.' }
    if ($config.services.backend.environment.CONTROLE_NOTAS_AMBIENTE -ne 'docker-local' -or $config.services.db.environment.POSTGRES_DB -ne 'controle_notas' -or $config.services.db.environment.POSTGRES_USER -ne 'controle_notas' -or $config.services.db.image -notmatch '^postgres:17[-.]') { throw 'Configuracao do banco diferente do Docker local esperado.' }
    if ($config.services.db.PSObject.Properties['ports'] -and @($config.services.db.ports).Count -gt 0) { throw 'O PostgreSQL deste pacote nao deve publicar portas no host.' }
    if ($config.services.db.PSObject.Properties['network_mode']) { throw 'Modo de rede do banco nao permitido.' }
    $mount = @($config.services.db.volumes | Where-Object { $_.target -eq '/var/lib/postgresql/data' })
    if ($mount.Count -ne 1 -or $mount[0].type -ne 'volume') { throw 'O banco exige um volume nomeado do Docker.' }
    $volume = $config.volumes.PSObject.Properties[$mount[0].source].Value
    if ($volume.PSObject.Properties['external'] -and $volume.external) { throw 'Nao sera usado um volume externo existente.' }

    Write-Host 'Iniciando somente o PostgreSQL local...'
    Invoke-Compose -ComposeArguments @('up', '-d', '--wait', '--wait-timeout', '180', 'db') | Out-Host
    $state = Read-DatabaseJson -SqlName 'estado-banco.sql'
    if ($state.banco -ne 'controle_notas') { throw 'Banco conectado diferente de controle_notas.' }
    if ([long]$state.objetosUsuario -gt 0) {
        $knownRestore = $false
        if (Test-Path -LiteralPath $MarkerPath) {
            $marker = Get-Content -LiteralPath $MarkerPath -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($BancoVazio) {
                $knownRestore = $marker.PSObject.Properties['modo'] -and $marker.modo -eq 'banco-vazio' -and $marker.projeto -eq $NomeProjeto -and $marker.instancia -eq $state.instancia
            } else {
                $knownRestore = $marker.backupSha256 -eq $backupHash -and $marker.projeto -eq $NomeProjeto -and $marker.instancia -eq $state.instancia
            }
        }
        if (!$knownRestore) { throw 'Banco ja preenchido e sem comprovante desta restauracao. Operacao interrompida; nenhum dado foi sobrescrito. Use outro projeto vazio ou revise o destino.' }
        Write-Host 'Banco ja preparado neste projeto. Dados e alteracoes locais serao preservados.'
    } elseif ($BancoVazio) {
        Write-LocalJson -Path $MarkerPath -Value @{ modo = 'banco-vazio'; backupSha256 = $null; projeto = $NomeProjeto; instancia = $state.instancia; preparadoEm = [DateTimeOffset]::Now.ToString('o') }
        Write-Host 'Banco vazio confirmado. As migracoes criarao as tabelas locais.'
    } else {
        Write-Host 'Banco vazio confirmado. Restaurando o backup em uma unica transacao...'
        Invoke-Compose -ComposeArguments @('cp', $BackupPath, 'db:/tmp/controle_notas_transferencia.dump') | Out-Host
        Invoke-Compose -ComposeArguments @('exec', '-T', 'db', 'pg_restore', '-h', '/var/run/postgresql', '-p', '5432', '-U', 'controle_notas', '-d', 'controle_notas', '--no-owner', '--no-privileges', '--exit-on-error', '--single-transaction', '/tmp/controle_notas_transferencia.dump') | Out-Host
        $actual = Read-DatabaseJson -SqlName 'validar-dados.sql'
        foreach ($table in $manifest.verificacao.tabelas.PSObject.Properties) {
            $restored = $actual.tabelas.PSObject.Properties[$table.Name]
            if (!$restored -or $restored.Value.quantidade -ne $table.Value.quantidade -or $restored.Value.sha256 -ne $table.Value.sha256) { throw ('Dados restaurados diferem do backup na tabela ' + $table.Name + '. Nao sera iniciada a aplicacao.') }
        }
        Write-LocalJson -Path $MarkerPath -Value @{ backupSha256 = $backupHash; projeto = $NomeProjeto; instancia = $state.instancia; restauradoEm = [DateTimeOffset]::Now.ToString('o') }
        Write-Host ('Restauracao validada: ' + $actual.tabelas.Cliente.quantidade + ' clientes; ' + $actual.tabelas.ClienteConfere.quantidade + ' vinculados ao Confere.')
    }
    if (!$BancoVazio) {
        foreach ($entry in $manifest.arquivosOrigem.PSObject.Properties) {
            $originPath = Join-Path (Join-Path $ProjectRoot 'dados/origem') $entry.Name
            $targetPath = Join-Path (Join-Path $ProjectRoot 'backend/importacoes') $entry.Name
            if (!(Test-Path -LiteralPath $targetPath)) { Copy-Item -LiteralPath $originPath -Destination $targetPath }
        }
    }
    Write-Host 'Construindo e iniciando backend e frontend...'
    Invoke-Compose -ComposeArguments @('up', '--build', '-d', '--wait', '--wait-timeout', '180', 'backend', 'frontend') | Out-Host
    Invoke-Compose -ComposeArguments @('exec', '-T', 'backend', './node_modules/.bin/prisma', 'migrate', 'status', '--config', 'prisma7.config.ts') | Out-Host
    $apiPort = $config.services.backend.ports[0].published
    $frontPort = $config.services.frontend.ports[0].published
    $apiUrl = 'http://localhost:' + $apiPort
    $frontUrl = 'http://localhost:' + $frontPort
    $null = Invoke-RestMethod -Uri ($apiUrl + '/') -TimeoutSec 20
    $customers = Invoke-RestMethod -Uri ($apiUrl + '/clientes') -TimeoutSec 20
    Write-Host ('API validada: ' + @($customers).Count + ' clientes disponiveis.')
    Write-Host ('Sistema pronto: ' + $frontUrl)
    Write-Host 'Abra Excel > Fichas dos Clientes para pesquisar nomes e apelidos.'
    if (!$SemAbrirNavegador) { Start-Process $frontUrl | Out-Null }
    $Succeeded = $true
} catch {
    Write-Host ('ERRO: ' + $_.Exception.Message) -ForegroundColor Red
} finally {
    foreach ($key in $SavedEnvironment.Keys) { [Environment]::SetEnvironmentVariable($key, $SavedEnvironment[$key], 'Process') }
    Pop-Location
}
if (!$Succeeded) { exit 1 }
exit 0
