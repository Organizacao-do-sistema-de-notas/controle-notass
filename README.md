# Controle de Notas — desenvolvimento com Docker

O ambiente padrão de desenvolvimento usa **Node 24**, **React/Vite**, **Express/Prisma**
e **PostgreSQL 17**, todos em containers. As fichas individuais de clientes já estão
incluídas. Não é necessário instalar Node, PostgreSQL ou Chromium no Windows.

Para instalar no **Xubuntu por comandos**, clonando a branch de instalação com
um banco local vazio, siga [LEIA-ME-LINUX.md](LEIA-ME-LINUX.md).

O escopo atual e o roteiro para concluir a versão básica estão em
[FECHAMENTO_CONTROLE_NOTAS.md](FECHAMENTO_CONTROLE_NOTAS.md).

A etapa em revisão unifica o estado mensal de Excel e Painel e acrescenta
**⋯ → Consultar meses antigos**, mantendo a seleção rápida com 13 meses.
Comportamento e validação em
[ESTADO_UNICO_E_CONSULTA_MENSAL.md](ESTADO_UNICO_E_CONSULTA_MENSAL.md).

O lote da branch `teste/controle-basico-linux` reúne cadastro único, **Excluir
cliente** nas duas visualizações e proteção de formulários. Para atualizar uma
instalação Linux existente com backup, seguir
[ATUALIZACAO_LINUX.md](ATUALIZACAO_LINUX.md). A validação do lote está em
[VALIDACAO_ATUALIZACAO_LINUX.md](VALIDACAO_ATUALIZACAO_LINUX.md).
Para atualizar a instalação existente em `D:\Projetos\controle-notass`, usar
[ATUALIZACAO_WINDOWS.md](ATUALIZACAO_WINDOWS.md), com backup e Docker Desktop local.

Se recebeu o pacote privado com backup do Codex, siga
[LEIA-ME-WINDOWS.md](LEIA-ME-WINDOWS.md) e execute `INICIAR-WINDOWS.bat`.
Esse caminho restaura os dados em um banco local vazio e gera a configuração
local automaticamente. As instruções abaixo também permitem começar com um
checkout e banco novos, sem os dados do pacote.

## Primeira configuração no Windows

Instale Git e Docker Desktop, ative o backend WSL 2 e use **Linux containers**.
Com o Docker Desktop iniciado, abra o PowerShell na raiz do repositório:

```powershell
if (!(Test-Path .env.docker)) { Copy-Item .env.docker.example .env.docker }
# Edite .env.docker e escolha uma senha exclusiva para o banco local.
docker compose --env-file .env.docker config --quiet
```

O `.env.docker.example` contém apenas valores fictícios. `.env.docker` não vai para
o Git nem para as imagens. Use letras, números, `_` e `-` na senha local, pois ela
é interpolada em uma URL. Não use credenciais da empresa ou de produção.

## Iniciar ou atualizar o projeto

```powershell
docker compose --env-file .env.docker up --build -d --wait
```

Abra http://localhost:5173. A API responde em http://localhost:3000.
Se as portas estiverem ocupadas, altere `FRONTEND_PORT` e `API_PORT` em `.env.docker`
e execute novamente o comando. O endereço da API usado pelo navegador acompanha
`API_PORT` automaticamente.

O Compose espera o PostgreSQL ficar disponível, aplica as migrações existentes
com `prisma migrate deploy --config prisma7.config.ts` e inicia o backend. O
frontend só inicia depois que a API consegue consultar clientes no banco. As migrações incluem
`20261112220000_ficha_cliente`, `20261113090000_importacao_confere` e
`20261114180000_excel_compartilhado`.
Não são executados `migrate reset` ou `db push`.

| Componente | Endereço e persistência |
| --- | --- |
| Frontend | Publicado apenas em loopback, porta 5173 por padrão |
| Backend | Publicado apenas em loopback, porta 3000 por padrão |
| Banco de desenvolvimento | `db:5432/controle_notas`, sem porta publicada no Windows; volume `postgres_data` |
| Banco de testes | Processo separado, descartável e sem portas publicadas; nunca usa o volume de desenvolvimento |

A `DATABASE_URL` do backend é montada pelo Compose com o host `db`. O `.env` da
raiz e suas URLs não são copiados ou reutilizados dentro dos containers.
`VITE_API_URL` usa `http://localhost:<API_PORT>`: quem acessa a API é o navegador do
Windows, que não resolve o nome interno `backend` do Docker.

## Desenvolvimento diário

Edite normalmente `backend/src` e `frontend/src`. Os fontes são montados em modo
somente leitura nos containers; tsx e Vite recarregam as alterações. Polling fica
habilitado para detectar edições pelo Windows. `node_modules` e Prisma Client são
Linux e permanecem nas imagens, separados dos arquivos locais do Windows.

Depois de mudar dependências, schema, migrações ou configuração de build, execute
novamente `up --build -d --wait`. Os builds instalam com `npm ci`, geram o Prisma
Client, verificam o TypeScript do backend e compilam o frontend. Mantenha os dois
`package-lock.json` atualizados junto com seus manifests.

Ao ampliar o schema, acrescente uma migration versionada e revise o SQL antes de
aplicar. Não edite migrações já aplicadas. Valide a atualização no perfil de testes
e faça backup antes de atualizar um banco com dados que precisam ser preservados.
A suíte atual cobre a atualização da base anterior à ficha; ao acrescentar novas
migrações, atualize também as expectativas de migração dos testes.

## Backup do servidor

No notebook/servidor Linux, execute `bash ./BACKUP-LINUX.sh`. Se o banco estiver
no Windows, execute `BACKUP-WINDOWS.bat`. O PostgreSQL precisa estar em execução.
Cada cópia gera uma pasta privada em `backups/`, com arquivo PostgreSQL custom e
checksum, sem interromper a API. Essa pasta é excluída do Git e das imagens.
Guarde uma cópia externa. Veja [BACKUP_SERVIDOR.md](BACKUP_SERVIDOR.md) para uso,
verificações, destino alternativo e cuidados na recuperação.

## Testar tudo em containers

Execute em outro terminal, usando um nome de projeto separado:

```powershell
docker compose --env-file .env.docker -p controle-notas-tests --profile test up --build --abort-on-container-exit --exit-code-from tests test-db tests
```

O código de saída representa o resultado dos testes. Este comando executa apenas
`tests` e sua dependência `test-db`, sem iniciar ou alterar os serviços de trabalho:

1. Cria PostgreSQL separado em memória (`tmpfs`), com credenciais fictícias.
2. Aplica as quatro migrações antigas, cria dados fictícios e aplica as migrações da ficha, de importação e do Excel compartilhado.
3. Executa a suíte de integração do backend.
4. Inicia backend e Vite próprios e executa a suíte de interface no Chromium.
5. Encerra os serviços de teste quando o executor termina.

O Chromium é instalado na imagem de testes a partir dos pacotes verificados do
Debian. Não depende de navegador instalado no Windows nem faz download de um
navegador durante a execução dos testes. Os serviços compartilham um namespace
privado: o PostgreSQL de testes escuta apenas em `127.0.0.1:5433`, preservando as
proteções existentes das suítes. A rede de testes é interna e não publica portas.
Não é necessário flexibilizar as proteções para aceitar URLs externas.

O banco descartável perde seu conteúdo ao parar; o volume do banco de trabalho
permanece separado. Para remover os containers de teste após a execução:

```powershell
docker compose --env-file .env.docker -p controle-notas-tests --profile test down
```

Os testes incluem fichas, apelidos, procedimentos, histórico de contabilidade,
concorrência, entradas inválidas, erros de rede, navegação, cadastro pelo Painel,
visualização Excel, Xaxim Gás e os três mercados prioritários. Veja também
[VALIDACAO_PR1.md](VALIDACAO_PR1.md) e [VALIDACAO_DOCKER.md](VALIDACAO_DOCKER.md).

As gravações de status, responsável, observação e mensagem no Painel registram o
valor anterior efetivo dentro da transação. Repetir o mesmo valor não duplica o
histórico; duas criações da mesma pendência retornam uma criação e o conflito 409
com o ID já existente. Leituras de histórico usam data e ID para desempatar eventos.
Veja [VALIDACAO_PAINEL_BASICO.md](VALIDACAO_PAINEL_BASICO.md).

## Builds no ambiente Codex

No Codex, o proxy HTTPS fornece uma CA própria. Use o override opcional para
montá-la somente durante o build, sem copiá-la para as imagens:

```bash
docker compose --env-file .env.docker -f compose.yaml -f compose.codex.yaml up --build -d --wait
docker compose --env-file .env.docker -p controle-notas-tests -f compose.yaml -f compose.codex.yaml --profile test up --build --abort-on-container-exit --exit-code-from tests test-db tests
```

O override usa `CODEX_PROXY_CERT`, fornecido pelo ambiente. Ele não é necessário
no Docker Desktop comum. TLS e verificações de assinatura/checksum continuam
habilitados. O arquivo de CA não é versionado nem fica nas camadas das imagens.

## Preparar importação do Confere

O importador é uma CLI de simulação por padrão, usando os códigos de origem para
não duplicar cadastros. Arquivos reais ficam em `backend/importacoes/`, fora do
Git e das imagens. A aplicação exige `--aplicar` e só aceita os destinos locais
previstos pelo projeto. Veja [backend/IMPORTACAO_CONFERE.md](backend/IMPORTACAO_CONFERE.md)
para regras, prévia, mapeamentos e os cuidados para preservar fichas existentes.

## Encontrar clientes por apelido

Em **Excel → Fichas dos Clientes**, digite a pesquisa e escolha **Nome e apelidos**,
**Somente nome** ou **Somente apelidos**. Para adicionar os nomes usados pela equipe,
abra a ficha, preencha **Outros nomes para pesquisa**, um por linha, e salve. A busca
ignora maiúsculas, acentos e espaços repetidos. Os códigos do Confere aparecem na
lista para diferenciar cadastros com nomes iguais.

## Gerenciar clientes e contabilidades

Abra o botão **⋯** no canto superior direito e escolha **Clientes** ou
**Contabilidades**. A lista de clientes inclui ativos e inativos, com pesquisa
por nome, apelido ou código do Confere e filtros por situação e contabilidade.

Selecione um cliente para editar seu nome, situação ou contabilidade. Também
é possível criar uma contabilidade no próprio formulário e selecioná-la antes
de salvar o cliente. Trocas e remoções de contabilidade ficam no histórico;
as anotações, apelidos, procedimentos e pendências existentes são preservados.

Em **Contabilidades**, cadastre ou edite o nome de um escritório mantendo os
clientes vinculados. Os nomes já registrados nos históricos são preservados.
Excel, fichas e menu Clientes utilizam um único cadastro. Criar ou alterar um
cliente em uma tela disponibiliza o mesmo cliente nas outras, com o mesmo ID.
Nome, apelidos e informações adicionais são compartilhados automaticamente.
Veja [CADASTRO_UNICO.md](CADASTRO_UNICO.md).

Na ficha individual, fechar, trocar de cliente ou substituir uma edição de
procedimento pede confirmação quando há texto não salvo. Cancelar a confirmação
mantém o rascunho; salvar a ficha e salvar o procedimento continuam ações separadas.
O navegador também é avisado de alterações pendentes ao tentar recarregar a página.

## Informações adicionais e controle compartilhado

O botão **?**, à direita da observação mensal, abre a caixa com as particularidades
do cliente. Use **Alterar** para editar e o botão verde **Salvar** para confirmar.
O **X vermelho** fecha a janela e pede confirmação se houver texto não salvo.
As informações também continuam disponíveis nos formulários Incluir/Alterar Cliente.

Os dados da visão Excel agora ficam no PostgreSQL: clientes incluídos, nomes,
apelidos, informações adicionais, avisos, status e observações de todos os meses.
Os computadores conectados à mesma instância recebem as atualizações automaticamente.
A edição concorrente do mesmo campo exige revisão, sem sobrescrita silenciosa.

Na primeira abertura após atualizar, use **Importar dados deste navegador** para
trazer os registros locais antigos. A importação copia somente dados ausentes:
se o banco já tiver um valor diferente, ele é mantido e a divergência é mostrada.
Os originais do navegador não são apagados nem atualizados por essa operação.
Faça isso nos navegadores que tenham registros próprios, revisando as divergências.
O botão **Baixar cópia dos dados locais** exporta os originais para um JSON privado.

Preferências de visualização/mês e a identificação da importação permanecem locais.
Cada cliente cadastrado tem automaticamente uma linha no Excel e uma ficha,
identificadas pelo mesmo ID. A ordem da lista e o nome não definem a identidade
de uma empresa. Xaxim Gás e os três mercados
prioritários mantêm o comportamento anterior.

A nova migração apenas cria `ExcelCompartilhado`; não modifica linhas das tabelas
existentes. O backup PostgreSQL passa a incluir também o controle Excel compartilhado.
Veja [COMPARTILHAMENTO_EXCEL.md](COMPARTILHAMENTO_EXCEL.md) para instalação,
importação e acesso entre o notebook e o computador principal.

## Diagnosticar

```powershell
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs --tail 100 backend frontend db
docker compose --env-file .env.docker exec backend ./node_modules/.bin/prisma migrate status --config prisma7.config.ts
docker compose --env-file .env.docker exec backend ./node_modules/.bin/tsc --noEmit
docker compose --env-file .env.docker exec frontend npm run build
docker compose --env-file .env.docker exec db psql -U controle_notas -d controle_notas
```

Comandos como `docker compose config` sem `--quiet` podem mostrar a senha resolvida;
não compartilhe essa saída. Se mudar `POSTGRES_PASSWORD` em um volume já existente,
o PostgreSQL não altera a senha automaticamente. Mantenha a senha original ou
altere-a explicitamente no banco; não remova o volume para contornar o erro.

## Parar e preservar os dados

```powershell
docker compose --env-file .env.docker down
docker compose --env-file .env.docker up -d --wait
```

O volume nomeado `postgres_data` mantém os dados após recriar os containers. Não
use `down --volumes` se quiser manter o banco. Mantenha o mesmo nome de projeto
Compose para reutilizar seu volume. Persistência em volume não substitui backup.

Esta configuração é para desenvolvimento local; autenticação e implantação em
produção continuam fora desta etapa. Não aponta para Confere Cópias ou bancos
externos e não publica código ou imagens em registros remotos.
