# Validação — backup do servidor

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
