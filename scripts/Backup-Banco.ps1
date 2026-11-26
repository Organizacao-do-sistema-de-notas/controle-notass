[CmdletBinding()]
param([string]$Destino)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$EnvPath = Join-Path $ProjectRoot '.env.docker'
$SavedEnvironment = @{}
$Succeeded = $false
$ContainerId = $null
$TemporaryPath = $null
$TemporaryCreated = $false
$IncompletePath = $null
$WindowsHost = [Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT

function Invoke-Docker {
    param([Parameter(Mandatory = $true)][string[]]$DockerArguments)
    & docker @script:DockerPrefix @DockerArguments
    if ($LASTEXITCODE -ne 0) { throw 'Docker nao concluiu a operacao. Confira a mensagem acima.' }
}
function Invoke-Compose {
    param([Parameter(Mandatory = $true)][string[]]$ComposeArguments)
    Invoke-Docker -DockerArguments ($script:ComposePrefix + $ComposeArguments)
}
function Protect-LocalPath {
    param([string]$Path, [string]$Mode)
    if (!$WindowsHost) {
        & chmod $Mode -- $Path
        if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel restringir as permissoes da copia local.' }
    }
}

Push-Location $ProjectRoot
try {
    if (!(Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker nao encontrado.' }
    if (!(Test-Path -LiteralPath $EnvPath -PathType Leaf)) { throw 'Configuracao .env.docker ausente. Execute a instalacao antes de fazer backup.' }
    $projectLines = @(Get-Content -LiteralPath $EnvPath | Where-Object { $_ -match '^\s*COMPOSE_PROJECT_NAME\s*=' })
    if ($projectLines.Count -ne 1 -or $projectLines[0] -notmatch '^\s*COMPOSE_PROJECT_NAME\s*=\s*([a-z0-9][a-z0-9_-]{0,62})\s*$') {
        throw 'Defina COMPOSE_PROJECT_NAME em .env.docker com o mesmo nome usado na instalacao.'
    }
    $projectName = $Matches[1]
    foreach ($key in @('DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH')) {
        $SavedEnvironment[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
        [Environment]::SetEnvironmentVariable($key, $null, 'Process')
    }
    $script:DockerPrefix = @('--host', 'unix:///var/run/docker.sock')
    if ($WindowsHost) {
        $script:DockerPrefix = @()
        $contexts = @(Invoke-Docker -DockerArguments @('context', 'ls', '--format', '{{.Name}}'))
        if ($contexts -contains 'desktop-linux') { $localContext = 'desktop-linux' } else { $localContext = 'default' }
        $endpoint = ((Invoke-Docker -DockerArguments @('context', 'inspect', $localContext, '--format', '{{.Endpoints.docker.Host}}')) -join '').Trim()
        if ($endpoint -notmatch '^npipe:////\./pipe/(dockerDesktopLinuxEngine|docker_engine)$') { throw 'Use o Docker Desktop local; nenhum daemon remoto sera acessado.' }
        $script:DockerPrefix = @('--context', $localContext)
    }
    $script:ComposePrefix = @('compose', '--project-directory', $ProjectRoot, '--env-file', $EnvPath, '-f', (Join-Path $ProjectRoot 'compose.yaml'), '-p', $projectName)
    # Resolved configuration stays in memory because it includes credentials.
    $config = ((Invoke-Compose -ComposeArguments @('config', '--format', 'json')) -join "`n") | ConvertFrom-Json
    $databaseUri = $null
    try { $databaseUri = [Uri]([string]$config.services.backend.environment.DATABASE_URL) } catch { throw 'DATABASE_URL local invalida.' }
    if ($databaseUri.Scheme -ne 'postgresql' -or $databaseUri.Host -ne 'db' -or $databaseUri.Port -ne 5432 -or $databaseUri.AbsolutePath -ne '/controle_notas' -or $databaseUri.Query -or $databaseUri.Fragment) {
        throw 'Destino recusado: DATABASE_URL deve apontar exclusivamente para db:5432/controle_notas.'
    }
    if ($config.services.backend.environment.CONTROLE_NOTAS_AMBIENTE -ne 'docker-local' -or $config.services.db.environment.POSTGRES_DB -ne 'controle_notas' -or $config.services.db.environment.POSTGRES_USER -ne 'controle_notas' -or $config.services.db.image -notmatch '^postgres:17[-.]') {
        throw 'Configuracao diferente do PostgreSQL local esperado.'
    }
    $mounts = @($config.services.db.volumes | Where-Object { $_.target -eq '/var/lib/postgresql/data' })
    if ($mounts.Count -ne 1 -or $mounts[0].type -ne 'volume') { throw 'O banco deve usar o volume nomeado da instalacao.' }
    $volume = $config.volumes.PSObject.Properties[$mounts[0].source].Value
    if ($volume.PSObject.Properties['external'] -and $volume.external) { throw 'Volume externo recusado.' }
    $ids = @(Invoke-Compose -ComposeArguments @('ps', '--status', 'running', '--quiet', 'db'))
    if ($ids.Count -ne 1) { throw 'O PostgreSQL deste projeto precisa estar em execucao. Nenhum servico foi iniciado ou alterado.' }
    $ContainerId = ([string]$ids[0]).Trim()
    $container = @(((Invoke-Docker -DockerArguments @('inspect', $ContainerId)) -join "`n") | ConvertFrom-Json)[0]
    if ($container.Config.Labels.'com.docker.compose.project' -ne $projectName -or $container.Config.Labels.'com.docker.compose.service' -ne 'db') { throw 'Container nao pertence ao banco deste projeto.' }
    $actualMount = @($container.Mounts | Where-Object { $_.Destination -eq '/var/lib/postgresql/data' })
    if ($actualMount.Count -ne 1 -or $actualMount[0].Type -ne 'volume' -or $actualMount[0].Name -ne $volume.name) { throw 'Volume em execucao diferente da configuracao local.' }
    $volumeInfo = @(((Invoke-Docker -DockerArguments @('volume', 'inspect', $volume.name)) -join "`n") | ConvertFrom-Json)[0]
    if ($volumeInfo.Labels.'com.docker.compose.project' -ne $projectName) { throw 'O volume nao pertence ao projeto local.' }
    $connection = @('-h', '/var/run/postgresql', '-p', '5432', '-U', 'controle_notas', '-d', 'controle_notas')
    # Build quoted SQL identifiers on PostgreSQL: Windows PowerShell 5.1 removes
    # embedded double quotes when passing native command arguments to docker.exe.
    $sql = @'
WITH tabelas AS (
    SELECT nome, to_regclass(format('public.%I', nome)) AS relacao
    FROM (VALUES ('Cliente'), ('Contabilidade'), ('_prisma_migrations')) AS esperadas(nome)
)
SELECT jsonb_build_object(
    'banco', current_database(),
    'instancia', (SELECT system_identifier::text FROM pg_control_system()),
    'postgresMajor', current_setting('server_version_num')::int / 10000,
    'aplicacao', bool_and(relacao IS NOT NULL),
    'tabelasAusentes', COALESCE(jsonb_agg(nome) FILTER (WHERE relacao IS NULL), '[]'::jsonb)
)
FROM tabelas;
'@
    $state = ((Invoke-Docker -DockerArguments (@('exec', $ContainerId, 'psql') + $connection + @('-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', $sql))) -join "`n") | ConvertFrom-Json
    if ($state.banco -ne 'controle_notas' -or $state.postgresMajor -ne 17 -or !$state.aplicacao) {
        $missingTables = @($state.tabelasAusentes) -join ', '
        if (!$missingTables) { $missingTables = 'nenhuma' }
        throw ('Banco nao reconhecido como uma instalacao local do Controle de Notas. Banco: {0}; PostgreSQL: {1}; tabelas ausentes: {2}.' -f $state.banco, $state.postgresMajor, $missingTables)
    }

    $defaultDestination = Join-Path $ProjectRoot 'backups'
    if (!$Destino) { $Destino = $defaultDestination }
    $destinationPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Destino)
    $separator = [IO.Path]::DirectorySeparatorChar
    $comparison = [StringComparison]::Ordinal
    if ($WindowsHost) { $comparison = [StringComparison]::OrdinalIgnoreCase }
    $insideProject = $destinationPath.Equals($ProjectRoot, $comparison) -or $destinationPath.StartsWith($ProjectRoot + $separator, $comparison)
    $insideBackups = $destinationPath.Equals($defaultDestination, $comparison) -or $destinationPath.StartsWith($defaultDestination + $separator, $comparison)
    if ($insideProject -and !$insideBackups) { throw 'Dentro do repositorio, use somente a pasta backups, excluida do Git.' }
    if ($insideBackups) { $destinationPath = $defaultDestination + $destinationPath.Substring($defaultDestination.Length) }
    if (!(Test-Path -LiteralPath $destinationPath)) { New-Item -ItemType Directory -Path $destinationPath | Out-Null }
    $suffix = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmssZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
    $folderName = 'controle-notas-' + $suffix
    $IncompletePath = Join-Path $destinationPath ($folderName + '.incompleto')
    New-Item -ItemType Directory -Path $IncompletePath | Out-Null
    Protect-LocalPath -Path $IncompletePath -Mode '700'
    $TemporaryPath = '/tmp/' + $folderName
    Invoke-Docker -DockerArguments @('exec', $ContainerId, 'mkdir', '-m', '700', '--', $TemporaryPath) | Out-Host
    $TemporaryCreated = $true
    Write-Host 'Gerando copia consistente do PostgreSQL local, sem interromper o sistema...'
    Invoke-Docker -DockerArguments (@('exec', $ContainerId, 'pg_dump') + $connection + @('--format=custom', '--lock-wait-timeout=10000', ('--file=' + $TemporaryPath + '/controle_notas.dump'))) | Out-Host
    # Index validation is distinct from a complete restore test.
    $null = Invoke-Docker -DockerArguments @('exec', $ContainerId, 'pg_restore', '--list', ($TemporaryPath + '/controle_notas.dump'))
    $sourceHash = ((Invoke-Docker -DockerArguments @('exec', $ContainerId, 'sha256sum', ($TemporaryPath + '/controle_notas.dump'))) -join '').Split(' ')[0]
    if ($sourceHash -notmatch '^[a-f0-9]{64}$') { throw 'Checksum do arquivo de origem invalido.' }
    $dumpPath = Join-Path $IncompletePath 'controle_notas.dump'
    Invoke-Docker -DockerArguments @('cp', ($ContainerId + ':' + $TemporaryPath + '/controle_notas.dump'), $dumpPath) | Out-Host
    Protect-LocalPath -Path $dumpPath -Mode '600'
    $copiedHash = (Get-FileHash -LiteralPath $dumpPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($sourceHash -ne $copiedHash) { throw 'A copia local difere do arquivo original. Backup nao concluido.' }
    $manifest = [ordered]@{
        versao = 1; tipo = 'backup-servidor'; banco = 'controle_notas'; postgresMajor = 17
        projeto = $projectName; instancia = $state.instancia
        criadoEm = [DateTimeOffset]::UtcNow.ToString('o'); formato = 'PostgreSQL custom'
        arquivo = 'controle_notas.dump'; bytes = (Get-Item -LiteralPath $dumpPath).Length
        sha256 = $copiedHash; indiceVerificado = $true; restauracaoTestada = $false
    }
    $manifestPath = Join-Path $IncompletePath 'backup.json'
    [IO.File]::WriteAllText($manifestPath, (($manifest | ConvertTo-Json -Depth 5) + [Environment]::NewLine), (New-Object System.Text.UTF8Encoding($false)))
    Protect-LocalPath -Path $manifestPath -Mode '600'
    Rename-Item -LiteralPath $IncompletePath -NewName $folderName
    $Succeeded = $true
    Write-Host ('Backup concluido: ' + (Join-Path $destinationPath $folderName))
    Write-Host 'Indice e checksum conferidos. Guarde a pasta completa em outro dispositivo privado.'
    Write-Host 'A restauracao completa deve ser testada em um banco separado; este comando nao restaura dados.'
} catch {
    Write-Host ('ERRO: ' + $_.Exception.Message) -ForegroundColor Red
    if ($IncompletePath -and (Test-Path -LiteralPath $IncompletePath)) { Write-Host ('Copia incompleta preservada para diagnostico: ' + $IncompletePath) }
} finally {
    if ($TemporaryCreated) {
        try { Invoke-Docker -DockerArguments @('exec', $ContainerId, 'rm', '-rf', '--', $TemporaryPath) | Out-Null }
        catch { Write-Warning 'Nao foi possivel remover somente a pasta temporaria criada por este backup no container.' }
    }
    foreach ($key in $SavedEnvironment.Keys) { [Environment]::SetEnvironmentVariable($key, $SavedEnvironment[$key], 'Process') }
    Pop-Location
}
if (!$Succeeded) { exit 1 }
exit 0
