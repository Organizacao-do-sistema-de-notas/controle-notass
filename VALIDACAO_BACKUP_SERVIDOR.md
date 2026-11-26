# Validação — backup do servidor

## Correção de compatibilidade com Windows PowerShell — 26/11/2026

O usuário relatou que a atualização Windows recusou o banco durante o backup,
antes das migrações. A consulta antiga foi executada com o modo de argumentos
nativos `Legacy` do PowerShell 7.4.13, em Linux: as aspas duplas dos identificadores
foram removidas e um banco válido retornou exatamente a mesma recusa.

A consulta agora usa `format('%I', ...)` no PostgreSQL para preservar os nomes
das tabelas. Permanecem as verificações do daemon local, projeto, volume,
DATABASE_URL, banco, PostgreSQL 17 e presença das três tabelas base. Em caso de
recusa, a mensagem informa banco, versão principal e tabelas ausentes, sem senha.

Comando: `python3 scripts/testar-backup-servidor.py`, com Docker local,
PostgreSQL 17 e PowerShell 7.4.13. Resultado: **9 testes aprovados**. Incluem:

- Backup e restauração em outro banco fictício, com quantidades e hashes iguais
  nas 11 tabelas; preservação da configuração e dos backups anteriores.
- Backup bem-sucedido no modo nativo `Legacy`, que falhava com a consulta antiga.
- Recusa quando cada uma das três tabelas base está ausente, também em `Legacy`;
  nenhum backup é marcado como concluído e a mensagem identifica a tabela.
- Recusas por URL externa, configuração ausente, banco parado, destino no código
  e tentativa de empacotar backup privado, além da falha simulada de cópia.

Os testes criaram projetos Docker novos e usaram somente registros fictícios.
A simulação de tabelas ausentes renomeou e devolveu os nomes apenas no banco
isolado de teste, conferindo a preservação dos registros após cada caso. Os
containers foram encerrados; volumes e diagnósticos fictícios foram preservados.
Também passaram o parser PowerShell, a sintaxe Python e `git diff --check`.

Não houve mudanças em frontend, backend, schema ou migrações. O PowerShell 5.1
e o Docker Desktop físicos do usuário ainda precisam confirmar a execução;
o modo `Legacy` reproduziu o problema e validou a correção neste ambiente Linux.

## Validação original

Data: 18/11/2026. Branch: `feature/backup-servidor`.
Base: `feature/excel-compartilhado`, commit `0d593a7`.

## Entrega

- `BACKUP-LINUX.sh` e `BACKUP-WINDOWS.bat`, usando `scripts/Backup-Banco.ps1`.
- Cópia consistente PostgreSQL custom, enquanto a aplicação pode continuar ativa.
- Conferência do Docker local, projeto, container, volume e banco da aplicação;
  nenhuma URL externa é aceita e nenhum serviço é iniciado pelo backup.
- Verificação do índice com `pg_restore --list` e comparação SHA-256 entre arquivo
  original e cópia. O manifesto distingue essas verificações de restauração completa.
- Pastas únicas, preservação de backups anteriores e sufixo `.incompleto` em falhas.
- Permissões restritas no Linux, exclusão de `backups/` do Git/contexto Docker e
  recusa dessa pasta pelo empacotador, inclusive se adicionada à força ao Git.
- Guia [BACKUP_SERVIDOR.md](BACKUP_SERVIDOR.md) e links nas instruções existentes.

## Testes executados

Comando: `python3 scripts/testar-backup-servidor.py`, em Linux, com PowerShell
7.5.4, Docker local e PostgreSQL 17. Resultado: **7 testes aprovados**.

| Cenário | Resultado |
| --- | --- |
| Cópia binária, índice, manifesto e SHA-256 | Aprovado; arquivo custom preservado sem redirecionamento de bytes pelo PowerShell |
| Restauração real em novo banco de teste | Quantidades e hashes iguais nas 11 tabelas, incluindo Excel e históricos |
| Cópias repetidas e destinos com espaços/relativos | Pastas distintas, cópia anterior e `.env.docker` preservados |
| Falha simulada no `docker cp` | Saída de erro, pasta incompleta e nenhum novo manifesto concluído |
| Destino dentro do código, inclusive variação de maiúsculas | Recusado no Linux |
| DATABASE_URL externa | Recusada antes da cópia, sem conexão ao endereço externo |
| Configuração ausente | Recusada, sem criar nova configuração |
| PostgreSQL parado | Recusado, sem iniciar o serviço |
| Variáveis DOCKER_HOST/COMPOSE_PROJECT_NAME conflitantes | Backup permaneceu no projeto e daemon locais configurados |
| Backup adicionado à força ao Git em checkout fictício | Empacotador interrompido, sem gerar ZIP |
| Permissões no Linux e limpeza temporária | Pastas 700, arquivos 600; temporários próprios removidos do container |

Também passaram `bash -n`, parser do PowerShell, compilação sintática dos dois
scripts Python e `git diff --check`. Os testes Docker criaram projetos novos e
aplicaram o SQL existente apenas em bancos comprovadamente vazios, com registros
fictícios. Os bancos existentes do projeto e o Confere não foram acessados.
Os containers de teste foram encerrados, preservando volumes e diagnósticos.

Não houve alterações de frontend, backend, schema, migrações ou dependências.
A suíte anterior de 54 testes da aplicação não foi repetida nesta etapa.

## Limites e próximos passos

O Windows não foi executado em uma máquina Windows nesta validação. O código usa
construções compatíveis com Windows PowerShell 5.1 e o mesmo mecanismo de seleção
do Docker Desktop local do instalador existente; ainda falta o teste manual nele.
O fluxo real Linux/PowerShell foi executado, incluindo restauração e falhas.

Cada uso normal do comando confere índice e transferência; não restaura em outro
banco automaticamente. Os testes desta entrega fizeram essa restauração completa
com dados fictícios. Backups de uso devem ter recuperação verificada periodicamente.
O arquivo não é criptografado e exige armazenamento privado fora do disco do servidor.

Após aprovação de publicação, atualizar a branch no servidor e executar o backup
no notebook. Esta etapa não modifica o sistema já instalado no computador do usuário.
