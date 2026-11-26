# Atualizar a instalação existente no Windows

Usar a pasta existente `D:\Projetos\controle-notass`, com Docker Desktop iniciado
e Linux containers. Salvar os formulários abertos antes de atualizar.

O lote fica na branch `teste/controle-basico-linux`, compartilhada com os testes
do Linux. Além do ajuste das bordas, ela inclui o cadastro único, exclusão e
proteção dos formulários. O Windows pode estar numa versão anterior; por isso
backend e frontend são reconstruídos juntos.

## Comando no PowerShell

Copiar o bloco inteiro. Ele busca o atualizador pelo Git e executa uma cópia
temporária, permitindo atualizar mesmo se o arquivo ainda não existir no checkout.
Nenhum arquivo de código é reescrito manualmente.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    Set-Location 'D:\Projetos\controle-notass'
    $referencia = 'refs/remotes/origin/teste/controle-basico-linux'
    git fetch origin "refs/heads/teste/controle-basico-linux:$referencia"
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao buscar a atualizacao.' }
    $conteudo = @(git show "${referencia}:ATUALIZAR-WINDOWS.ps1")
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao obter o atualizador.' }
    $temporario = Join-Path ([IO.Path]::GetTempPath()) ('controle-notass-atualizar-' + [Guid]::NewGuid().ToString('N') + '.ps1')
    try {
        [IO.File]::WriteAllText($temporario, ($conteudo -join [Environment]::NewLine), (New-Object System.Text.UTF8Encoding($true)))
        & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $temporario
        if ($LASTEXITCODE -ne 0) { throw 'Atualizacao interrompida. Envie a mensagem de erro.' }
    } finally {
        Remove-Item -LiteralPath $temporario -ErrorAction SilentlyContinue
    }
}
```

O script confere o repositório, alterações locais, nome do projeto e Docker
Desktop local. Ele usa o mesmo `.env.docker`, portas e volume. Arquivos locais
alterados ou uma branch divergente interrompem a operação sem descarte.

A API e o frontend são parados antes da troca dos arquivos para impedir
recarregamento parcial. O comando de backup da versão nova verifica o banco
local e o volume, cria uma cópia com índice e checksum e só então permite
iniciar o backend com as migrações existentes. Não cria configuração, importa
clientes ou remove o volume.

Ao final, conferir **Backup concluido**, schema atualizado com **nove migrações**
e os três serviços `healthy`. Abrir o endereço que já era usado no Windows;
as portas são preservadas. O backup fica na pasta privada `backups/`, ignorada
pelo Git. Se houver erro, conservar a saída para diagnóstico.

O atualizador atende também a clones com uma única branch, buscando a referência
explicitamente e usando fast-forward. A main não participa da atualização.
A instalação física no Windows ainda depende da execução pelo usuário.

## Interrupção na identificação do banco

A consulta do backup foi corrigida em 26/11/2026 para o tratamento de argumentos
do Windows PowerShell 5.1. As aspas dos nomes das tabelas agora são construídas
no PostgreSQL; antes, o PowerShell podia removê-las e fazer uma instalação válida
ser recusada como banco desconhecido.

Se a atualização anterior parou nessa verificação, as migrações não foram
executadas e o backend e frontend permanecem parados. Execute novamente o bloco
acima para buscar a correção e refazer o backup, usando o mesmo banco e volume.
Se a recusa persistir, a mensagem agora informa banco, versão principal do
PostgreSQL e tabelas ausentes, sem mostrar credenciais. Preserve essa saída para
diagnóstico antes de qualquer migração; não recrie o banco nem remova volumes.
