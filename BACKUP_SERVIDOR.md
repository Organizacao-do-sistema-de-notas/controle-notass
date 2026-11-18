# Backup dos dados do servidor

Execute o backup no computador que hospeda o PostgreSQL do projeto. No uso com
notebook como servidor e computador principal por túnel SSH, o comando roda no
notebook. A cópia não depende de abrir o navegador nem interrompe a API.

## Gerar a cópia

Na pasta do projeto no Linux/Xubuntu:

```bash
bash ./BACKUP-LINUX.sh
```

Usa o `pwsh` já instalado para iniciar o projeto. Se o próprio Windows hospeda
os containers, execute **BACKUP-WINDOWS.bat**, ou no PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Backup-Banco.ps1
```

O PostgreSQL precisa estar rodando. O comando lê `.env.docker`, usa somente o
Docker local, confere o projeto, o volume e o destino `db:5432/controle_notas`.
Não cria configuração, inicia serviços, executa migrações ou restaura dados.
Uma variável `DOCKER_HOST` apontando a outro daemon não muda esse destino.

Cada execução cria uma pasta nova, sem substituir cópias anteriores:

```text
backups/controle-notas-AAAAMMDD-HHMMSSZ-identificador/
  controle_notas.dump
  backup.json
```

A data do nome é UTC, indicada por `Z`. `controle_notas.dump` usa o formato custom
do PostgreSQL 17. `backup.json` registra banco, projeto, instância, data, tamanho
e SHA-256, sem senha ou URL de conexão. Os arquivos de configuração e o código
do projeto não são incluídos.

## Destino alternativo

Para copiar diretamente a um disco privado no Linux:

```bash
bash ./BACKUP-LINUX.sh --destino "/caminho/para/disco/Backups Controle Notas"
```

No Windows, substitua pelo caminho real:

```powershell
.\BACKUP-WINDOWS.bat -Destino "D:\Backups Controle Notas"
```

Dentro do checkout, somente `backups/` e suas subpastas são aceitos como destino.
Essa pasta é ignorada pelo Git e pelo contexto Docker; o empacotador também recusa
incluí-la acidentalmente. No Linux, a pasta de cada cópia fica com permissão 700 e
os arquivos com 600. No Windows, valem as permissões de acesso da pasta escolhida.

## Conteúdo e verificações

O `pg_dump` captura um estado consistente do banco, mesmo com a aplicação ativa.
Inclui cadastros, contabilidades, fichas, nomes alternativos, procedimentos,
históricos, migrações e os dados do Excel compartilhado. Alterações posteriores
ao início da cópia entram no próximo backup.

Registros antigos ainda presentes somente no navegador precisam ser importados
para o compartilhamento antes de entrarem no backup PostgreSQL. Preferências
individuais de visualização não fazem parte dele.

O comando verifica o índice do arquivo com `pg_restore --list` e compara o hash
da origem no container com a cópia local. Isso confere o índice e a transferência;
o campo `restauracaoTestada: false` deixa claro que a execução não fez uma
restauração completa. Teste a recuperação periodicamente em uma instância separada.

Somente a mensagem **Backup concluido** confirma essas verificações. Se houver
falha depois de começar a cópia, a pasta mantém o sufixo `.incompleto`; ela não é
um backup concluído. Os backups anteriores permanecem preservados.

## Guardar e recuperar

Copie a pasta inteira para outro dispositivo privado. O arquivo contém os dados
do sistema e não é criptografado por este comando. Não envie os backups ao GitHub.
Guardar somente no mesmo disco do servidor não protege contra perda desse disco.
Mantenha também a configuração local em um local privado apropriado.

Para recuperar, confira o SHA-256 de `controle_notas.dump` com `backup.json`,
prepare um projeto e banco vazios separados, restaure com PostgreSQL 17 e valide
o conteúdo antes de trocar o servidor em uso. A pasta gerada é um backup de dados;
não é o pacote portátil de instalação com `dados/manifesto_backup.json`.
Não restaure sobre o banco atual nem use reset ou remoção de volumes para isso.

## Testar o comando

Em Linux com Docker, `pwsh` e Python 3:

```bash
python3 scripts/testar-backup-servidor.py
```

O teste cria um projeto Docker novo com dados fictícios, verifica a cópia e a
restauração das 11 tabelas, simula falha de transferência e confere as recusas
para URL externa, destino dentro do código, configuração ausente e banco parado.
O projeto de trabalho e seus dados não são usados. Os containers de teste são
encerrados; o volume e os diagnósticos fictícios são preservados para inspeção.
