# Docker integrado à ficha de clientes

## Resultado

Configuração integrada localmente na branch `feature/ficha-cliente-base`, sem
sobrescrever as correções do PR #1 ou seus lockfiles atuais. Os arquivos Docker
anteriores foram recuperados seletivamente do stash e atualizados para a versão
com fichas. O stash original foi preservado.

O fluxo padrão e os comandos para Windows estão em [README.md](README.md).
Não houve commit, push, merge ou publicação de imagens/configurações remotas.

## Arquivos desta etapa

- `compose.yaml`: frontend, backend, PostgreSQL persistente e perfil isolado de testes.
- `backend/Dockerfile`: Node 24 slim, OpenSSL, npm ci, Prisma Client e TypeScript.
- `frontend/Dockerfile`: Node 24 slim, npm ci e build TypeScript/Vite.
- `Dockerfile.test`: Node 24 slim, Chromium do Debian e as duas suítes completas.
- `.dockerignore`, `backend/.dockerignore`, `frontend/.dockerignore`: excluem
  dependências do host, código gerado, `.env`, logs e resultados de testes.
- `.env.docker.example` e `.gitignore`: exemplo fictício versionado e configuração
  local real ignorada.
- `compose.codex.yaml`: override opcional para montar a CA do proxy em builds
  do Codex, sem copiá-la para as imagens.
- `README.md`, `VALIDACAO_PR1.md`, `VALIDACAO_DOCKER.md`: operação e resultados.

## Evidências da validação

| Verificação | Resultado |
| --- | --- |
| Configuração Compose, com/sem perfil test e com override Codex | Válida |
| Build das imagens backend, frontend e testes | Passou |
| npm ci nas imagens, usando lockfiles atuais | Passou |
| Prisma Client e TypeScript backend durante build | Passaram |
| Build TypeScript/Vite frontend durante build | Passou |
| Inicialização dos três serviços de desenvolvimento | Todos saudáveis |
| Migrações do banco de desenvolvimento | Cinco aplicadas; schema atualizado |
| Leitura e gravação de ficha pela API do container | Passaram, somente dados fictícios |
| Testes backend em container | 10 passaram; zero falhas/ignorados |
| Testes Chromium em container | 6 passaram; zero falhas/ignorados |
| Saída do executor e encerramento do PostgreSQL de testes | Código 0 para ambos |
| Recarregamento automático | Vite recarregou o navegador; tsx reiniciou a API |
| Persistência após down/up | Cliente, apelido, frequência e observações preservados |
| `.env` do host ausente nos containers dos aplicativos | Confirmado |
| Backend usa banco interno `db`; frontend usa API no endereço do navegador | Confirmado |
| `git diff --check` | Passou |

O teste de recarregamento usou comentários temporários nos fontes, restaurados
integralmente após o teste. Não deixou alterações nos arquivos da aplicação.
Os testes de interface incluem o aviso Xaxim Gás e os três mercados prioritários.

## Isolamento dos bancos

O desenvolvimento usa o volume nomeado `postgres_data` e a URL montada pelo
Compose para `db:5432/controle_notas`. Não há porta de banco publicada no host e
não é reutilizada a DATABASE_URL do `.env` da raiz.

O perfil `test` usa outro PostgreSQL, em `tmpfs`, e uma rede interna separada. O
executor compartilha apenas o namespace desse banco: suas suítes continuam
exigindo `127.0.0.1:5433/controle_notas_pr1_test_*`. Ele inicia a API e o Vite de
navegador dentro desse namespace, sem portas publicadas. O banco de testes não
monta o volume de desenvolvimento.

Na validação, o comando inclui explicitamente `test-db tests` para que
`--abort-on-container-exit` pare os dois serviços. Selecionar apenas `tests`
executava as suítes, mas deixava sua dependência ligada; o comando documentado
foi corrigido e verificado novamente.

O banco da empresa, produção e Confere Cópias não foram acessados. Não foram
executados reset, db push, drop, importações reais ou remoção de volumes.

## Particularidades do Codex

- Projeto de desenvolvimento desta instância: `controle-notas-fichas-validation`.
  O `.env.docker` local, ignorado, conserva esse nome em `COMPOSE_PROJECT_NAME`,
  para que o comando padrão reutilize os mesmos serviços e volume.
- Portas locais usadas nesta instância: API 3002 e frontend 5176, evitando serviços
  já existentes. O exemplo para Windows mantém os padrões 3000 e 5173.
- Projeto de testes: `controle-notas-tests`. Executor e banco terminaram parados,
  com código 0, após o comando documentado.
- O download inicial da imagem Microsoft/Playwright foi negado pela política de
  rede em um domínio de distribuição. A solução final usa Chromium dos repositórios
  oficiais do Debian, preservando assinaturas e verificação TLS.
- O driver de armazenamento VFS do Codex esgotou o disco com as imagens Node
  completas e camadas de build. Foram liberados caches sem uso e removidas somente
  as imagens intermediárias desta tentativa ainda sem containers. Os bancos e
  volumes foram preservados. As imagens finais slim são menores: aproximadamente
  780 MB para o backend e 380 MB para o frontend.
- Os aplicativos de uma validação Docker anterior desta sessão foram parados;
  seu PostgreSQL e volume foram mantidos.

## Limites e próximas etapas

A execução foi verificada em Docker/Linux no Codex. Os comandos PowerShell estão
documentados, mas Docker Desktop no Windows físico ainda precisa de validação.
O override `compose.codex.yaml` usa somente a CA fornecida pela plataforma;
Windows comum não precisa dele.

Os avisos de auditoria de dependências do backend e o aviso de depreciação do
driver Prisma/pg já conhecidos continuam pendentes. Não foi executado npm audit
fix nem feita atualização de dependências fora do escopo desta integração.
Autenticação, permissões e implantação de produção continuam fora desta etapa.
Antes de integrar à main, revisar o diff completo do PR #1 junto com os arquivos
Docker e validar o fluxo no Windows. Nada será enviado automaticamente ao GitHub.
