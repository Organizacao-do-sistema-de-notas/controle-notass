# Validação do lote para o servidor Linux

Data: 25/11/2026. Branch: `teste/controle-basico-linux`.
Conteúdo de aplicação: `e48bee5`, que inclui cadastro único, exclusão e proteção
dos formulários. Este lote acrescenta o procedimento de atualização e ajusta
um auxiliar de teste de concorrência. Não altera funcionalidades da aplicação.

## Resultados

| Verificação | Resultado |
| --- | --- |
| Imagem de testes com `npm ci`, Prisma Client, TypeScript e build do frontend | Aprovada |
| Suíte completa da API, em Docker | 49 aprovados |
| Suíte completa de interface, Chromium em Docker | 46 aprovados |
| Imagens reais de backend e frontend | Construídas com sucesso |
| Inicialização de PostgreSQL, backend e frontend pelo Compose | Três serviços healthy |
| Banco novo da aplicação | Nove migrações aplicadas |
| Abertura HTTP do frontend | HTTP 200 |
| Cliente, contabilidade, ficha, apelido, procedimento, pendência e mensagem | Gravação/leitura aprovadas |
| Observação mensal do Excel | Gravação/leitura aprovadas |
| Reinício de banco, API e frontend | Mesma instância e conteúdo preservados |
| Backup custom, índice e restauração em banco separado | Aprovados |
| Comparação da restauração | Quantidade e SHA-256 idênticos nas 11 tabelas |
| Exclusão depois do reinício | Cliente retirado das telas; históricos preservados |
| Sintaxe Bash do atualizador e `git diff --check` | Aprovados |

Total da suíte completa: **95 testes aprovados**. Os testes de concorrência
continuam verificando que as gravações esperam de fato no banco e que o histórico
registra a sequência correta, sem eventos duplicados.

## Ambiente isolado

Os comandos usaram o Docker local em `/var/run/docker.sock` e o projeto novo
`controle-notas-linux-testes-8c3ad77b45`. A suíte usa o serviço `test-db`, sem porta
publicada, com banco descartável em memória e credenciais fictícias. O helper
verifica o destino e testa a atualização das quatro migrações de origem para
as nove atuais, preservando o registro legado fictício.

Depois da suíte, os três serviços reais foram iniciados no mesmo projeto de
validação, com um volume novo próprio e banco `controle_notas`. A API ficou
somente em `127.0.0.1:3028` e o frontend em `127.0.0.1:5188`, sem interferir nas
portas da instalação do usuário. Foram criados somente registros fictícios.

O banco foi reiniciado e sua identidade de instância conferida. As quantidades
e hashes das 11 tabelas permaneceram iguais. A cópia custom foi restaurada em
`controle_notas_pr1_test_linux_restore_d34f4972`, dentro do PostgreSQL de testes,
e comparada tabela a tabela; não foi restaurada sobre o banco original.
Em seguida, uma exclusão fictícia confirmou a retirada do cliente do Excel e
do Painel, mantendo as linhas de pendência, procedimento e históricos.

Não houve acesso ao banco da empresa/Confere, importação de clientes reais,
reset, db push ou remoção de volumes. Os serviços de validação são parados ao
final; o volume e o backup fictícios permanecem disponíveis para inspeção.

## Ajustes e limites

A primeira compilação normal encontrou `SELF_SIGNED_CERT_IN_CHAIN` no proxy do
Codex. A execução aprovada usou `compose.codex.yaml`, já existente, com o pacote
de certificados do ambiente montado como segredo de build. A verificação TLS
continuou ativa; o certificado não foi copiado para camadas das imagens.
Esse override não é utilizado pelo atualizador do servidor Linux comum.

A execução intermediária da API apontou três testes de concorrência que ainda
aguardavam somente o bloqueio de `Pendencia`. A exclusão segura já havia passado
a bloquear `Cliente` antes de `Pendencia`. O auxiliar de teste foi ajustado para
segurar o cliente fictício e observar as requisições esperando essa mesma entrada.
As verificações de histórico foram mantidas; os 49 testes passaram na execução
final completa. Nenhuma mudança de código de aplicação foi necessária.

O atualizador recusa execução quando `.env.docker` está ausente, antes de iniciar
qualquer ação no Docker; essa recusa foi conferida. O script possui sintaxe Bash
válida. O fluxo de atualização completo ainda deve ser executado no servidor do
usuário. O `pwsh` nativo e o comando `BACKUP-LINUX.sh` não foram executados neste
ensaio; a cópia e a restauração fictícias usaram diretamente as ferramentas do
PostgreSQL 17 no container. O comando de backup existente não foi modificado.

A confirmação física da atualização, dos dados e do acesso pelos computadores
do usuário continua pendente. Seguir [ATUALIZACAO_LINUX.md](ATUALIZACAO_LINUX.md).
Não houve merge na main. A distribuição é limitada à branch de testes pedida
para esta atualização; novas funcionalidades continuam sem publicação automática.

## Evidências locais

- `/tmp/controle-notas-linux-docker-testes-final.log`: build e suíte completa.
- `/tmp/controle-notas-linux-build-servicos.log`: imagens de aplicação.
- `/tmp/controle-notas-linux-stack.log`: inicialização dos três serviços.
- `/tmp/controle-notas-linux-smoke.log` e `.json`: persistência, restauração e exclusão.
- `/tmp/controle-notas-linux-ficticio.dump`: cópia privada com dados fictícios.

Os arquivos de configuração e os dados de teste ficam fora do Git. Os relatórios
de etapas anteriores registram resultados anteriores, não substituem este lote.
