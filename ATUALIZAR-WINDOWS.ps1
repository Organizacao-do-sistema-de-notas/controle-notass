[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    throw 'Execute este atualizador no Windows com Docker Desktop.'
}
$rootOutput = @(& git rev-parse --show-toplevel)
if ($LASTEXITCODE -ne 0) { throw 'Abra o PowerShell dentro do repositorio existente.' }
$ProjectRoot = ($rootOutput -join '').Trim()
$EnvPath = Join-Path $ProjectRoot '.env.docker'
$Branch = 'teste/controle-basico-linux'
$RemoteRef = 'refs/remotes/origin/' + $Branch
$SavedEnvironment = @{}
$script:DockerPrefix = @()

function Invoke-Git {
    param([string[]]$Arguments)
    & git @Arguments
    if ($LASTEXITCODE -ne 0) { throw 'Git nao concluiu a operacao. Preserve os arquivos e confira a mensagem acima.' }
}
function Invoke-LocalDocker {
    param([string[]]$Arguments)
    & docker @script:DockerPrefix @Arguments
    if ($LASTEXITCODE -ne 0) { throw 'Docker nao concluiu a operacao. Confira a mensagem acima.' }
}
function Invoke-Compose {
    param([string[]]$Arguments)
    Invoke-LocalDocker -Arguments ($script:ComposePrefix + $Arguments)
}

Push-Location $ProjectRoot
try {
    $origin = ((Invoke-Git -Arguments @('remote', 'get-url', 'origin')) -join '').Trim()
    if ($origin -notin @(
        'https://github.com/Organizacao-do-sistema-de-notas/controle-notass',
        'https://github.com/Organizacao-do-sistema-de-notas/controle-notass.git',
        'git@github.com:Organizacao-do-sistema-de-notas/controle-notass.git'
    )) { throw 'Esta pasta nao aponta para o repositorio esperado.' }
    if (!(Test-Path -LiteralPath $EnvPath -PathType Leaf)) { throw '.env.docker ausente. Nenhuma configuracao nova sera criada.' }
    $changes = @(Invoke-Git -Arguments @('status', '--porcelain'))
    if ($changes.Count -gt 0) {
        Invoke-Git -Arguments @('status', '--short')
        throw 'Ha alteracoes locais. Preserve os arquivos e envie a saida antes de continuar.'
    }
    $projectLines = @(Get-Content -LiteralPath $EnvPath | Where-Object { $_ -match '^\s*COMPOSE_PROJECT_NAME\s*=' })
    if ($projectLines.Count -ne 1 -or $projectLines[0] -notmatch '^\s*COMPOSE_PROJECT_NAME\s*=\s*([a-z0-9][a-z0-9_-]{0,62})\s*$') {
        throw 'Nome original do projeto ausente ou invalido em .env.docker.'
    }
    $projectName = $Matches[1]
    foreach ($key in @('DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH')) {
        $SavedEnvironment[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
        [Environment]::SetEnvironmentVariable($key, $null, 'Process')
    }
    $contexts = @(Invoke-LocalDocker -Arguments @('context', 'ls', '--format', '{{.Name}}'))
    if ($contexts -contains 'desktop-linux') { $contextName = 'desktop-linux' } else { $contextName = 'default' }
    $endpoint = ((Invoke-LocalDocker -Arguments @('context', 'inspect', $contextName, '--format', '{{.Endpoints.docker.Host}}')) -join '').Trim()
    if ($endpoint -notmatch '^npipe:////\./pipe/(dockerDesktopLinuxEngine|docker_engine)$') {
        throw 'Use o Docker Desktop local com Linux containers. Nenhum daemon remoto sera acessado.'
    }
    $script:DockerPrefix = @('--context', $contextName)
    $script:ComposePrefix = @('compose', '--project-directory', $ProjectRoot, '--env-file', $EnvPath, '-f', (Join-Path $ProjectRoot 'compose.yaml'), '-p', $projectName)
    Invoke-Git -Arguments @('fetch', 'origin', ('refs/heads/' + $Branch + ':' + $RemoteRef))
    & git show-ref --verify --quiet ('refs/heads/' + $Branch)
    $branchExists = $LASTEXITCODE -eq 0
    if ($branchExists) {
        Invoke-Git -Arguments @('merge-base', '--is-ancestor', $Branch, $RemoteRef)
    }
    Invoke-Compose -Arguments @('config', '--quiet')
    Invoke-Compose -Arguments @('up', '-d', '--no-recreate', '--wait', 'db')
    Invoke-Compose -Arguments @('stop', 'backend', 'frontend')
    if ($branchExists) {
        Invoke-Git -Arguments @('switch', $Branch)
    } else {
        Invoke-Git -Arguments @('switch', '--no-track', '-c', $Branch, $RemoteRef)
    }
    Invoke-Git -Arguments @('merge', '--ff-only', $RemoteRef)
    & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ProjectRoot 'scripts/Backup-Banco.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'O backup nao foi concluido. A atualizacao foi interrompida antes das migracoes.' }
    Invoke-Compose -Arguments @('build', 'backend', 'frontend')
    Invoke-Compose -Arguments @('up', '-d', '--no-deps', '--wait', 'backend')
    Invoke-Compose -Arguments @('up', '-d', '--no-deps', '--wait', 'frontend')
    Invoke-Compose -Arguments @('exec', '-T', 'backend', './node_modules/.bin/prisma', 'migrate', 'status', '--config', 'prisma7.config.ts')
    Invoke-Compose -Arguments @('ps')
    Invoke-Git -Arguments @('log', '-1', '--oneline')
} finally {
    foreach ($key in $SavedEnvironment.Keys) { [Environment]::SetEnvironmentVariable($key, $SavedEnvironment[$key], 'Process') }
    Pop-Location
}
