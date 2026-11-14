# Validação do PR #1 — ficha de clientes

## Escopo e isolamento

- Branch local: `feature/ficha-cliente-base`.
- PR e branch remotos conferidos por Git: ambos em `8b69dcf1cbff982ffbedb016eb72c02b4d4e07a3`.
- Diff original inspecionado contra `origin/main` (`354759005c86268cbd032266d50c7247a5291b84`): 11 arquivos.
- Trabalho anterior de Docker preservado em `stash@{0}`, identificado por
  `preservar Docker Compose antes de validar PR 1`; não foi aplicado nesta branch.
- PostgreSQL do Codex confirmado em `127.0.0.1:5433`, dados em
  `/workspace/.cloud-setup/pgdata`. Foram criados bancos exclusivos
  `controle_notas_pr1_test_20261113` e `controle_notas_pr1_test_repro_20261113`.
- Nenhuma conexão com o banco da empresa, de produção ou do Confere Cópias.
  Nenhum reset, drop, importação de clientes reais ou exclusão de dados preexistentes.
  Os dados fictícios de teste foram mantidos.

## Erros encontrados e correções

1. `npm ci` falhava: backend com lockfile divergente do manifest e frontend sem
   lockfile. Lockfile backend sincronizado e frontend versionado, incluindo
   Playwright para os testes de interface. Instalações limpas passaram nos dois.
2. IDs maiores que o `INTEGER` do PostgreSQL e vínculos inválidos retornavam 500.
   Validações compartilhadas agora rejeitam IDs fora de 1 a 2147483647,
   corpos inválidos e campos inválidos com 400; referências ausentes retornam 404.
3. O frontend salvava ficha e contabilidade em duas requisições, permitindo
   gravação parcial. `PATCH /clientes/:id/ficha` agora aceita também
   `contabilidadeId` e `autor`, gravando ficha, apelidos e histórico numa transação.
   A rota antiga de atualização de clientes continua funcionando.
4. Trocas simultâneas liam o mesmo vínculo anterior e duplicavam o histórico.
   Ambas as rotas de atualização bloqueiam a linha do cliente durante a transação.
   O histórico guarda os nomes anteriores mesmo após renomear a contabilidade;
   repetir o mesmo vínculo não produz um novo evento. A data do evento corresponde
   à alteração após adquirir o bloqueio, com desempate por ID na leitura.
5. Durante uma gravação era possível trocar o cliente ou editar campos, deixando
   a resposta de um cliente sobrescrever a tela de outro. Controles de edição,
   seleção e fechamento ficam bloqueados enquanto a gravação está em andamento.
   O formulário é atualizado com a resposta normalizada do servidor.
6. Após erro de leitura, selecionar novamente o mesmo cliente não refazia a
   consulta. A seleção agora permite repetir a leitura. Respostas atrasadas
   continuam sendo descartadas quando outro cliente está selecionado.
7. Modal sem navegação completa por teclado: foco contido no diálogo,
   fechamento por Escape e retorno do foco ao botão de origem. Limites de texto
   na interface correspondem aos limites da API.
8. Documentação anterior dizia que não havia frontend: corrigida.

Na reprodução contra os controllers originais do PR, quatro dos oito cenários
iniciais falharam (IDs, vínculo fora do limite, salvamento parcial e concorrência).
As suítes finais passaram com as correções.

## Resultados

| Verificação | Resultado |
| --- | --- |
| `npm ci` backend e frontend | Passou |
| `prisma validate --config prisma7.config.ts` | Schema válido |
| Upgrade com quatro migrações antigas, dados fictícios legados e a nova migração | Passou; cliente e pendência preservados |
| `20261112220000_ficha_cliente` | Aplicada sem alteração do SQL ou schema versionados |
| `prisma migrate status --config prisma7.config.ts` | Cinco migrações aplicadas |
| Segunda execução de `migrate deploy` | Nenhuma migração pendente |
| `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --config prisma7.config.ts --exit-code` | Sem diferenças |
| `prisma generate --config prisma7.config.ts` | Prisma Client gerado |
| Backend `tsc --noEmit` | Passou |
| Frontend `npm run build` | Passou, TypeScript e Vite |
| Backend `npm test` | 10 testes passaram, zero falhas/ignorados |
| Frontend `npm run test:e2e` | 6 testes Chromium passaram, zero falhas/ignorados |
| `git diff --check` | Passou |

Backend: leitura/atualização parcial da ficha; aliases com deduplicação, limites e
limpeza explícita; corpos ausentes/arrays; IDs inválidos; cliente inexistente;
procedimentos com criação, edição, desativação, reativação e isolamento entre
clientes; troca/desvinculação de contabilidade; snapshots de nomes; autor;
rollback de vínculo inválido; trocas simultâneas pelas duas rotas; manutenção do
histórico de pendências; rotas básicas de Painel e pendências.

Interface: preenchimento, salvamento, releitura e pesquisa por apelidos sem
acentos; procedimentos; troca de contabilidade; bloqueio durante gravação; erro
simulado e nova tentativa; cadastro pelo Painel e leitura na ficha; cadastro local
Excel separado; retorno ao Painel; respostas de leitura fora de ordem; nova
consulta após erro; viewport móvel e navegação por teclado.

O aviso permanente **Xaxim Gás** e as prioridades **Bom dia filial**, **Bom dia
Matriz** e **Compre bem** foram verificados no navegador. Os arquivos de Excel,
Painel e seleção de visualização não receberam alterações nesta revisão. O teste
também confere que abrir/fechar fichas não altera os registros locais do Excel.

## Reproduzir diretamente no Codex (alternativa ao Compose)

Use somente o PostgreSQL local já provisionado. Não reutilize uma URL de empresa
ou de produção. Para executar do zero, escolha um nome novo com o prefixo abaixo.
A suíte prepara as quatro migrações antigas, cria os dados legados fictícios e
aplica a quinta migração quando encontra um banco vazio. Não limpa bancos.

```bash
cd /workspace/controle-notass/backend
npm ci
export DATABASE_URL=postgresql://agent@127.0.0.1:5433/controle_notas_pr1_test_nova_validacao
/workspace/.cloud-setup/postgres/usr/lib/postgresql/17/bin/createdb -h 127.0.0.1 -p 5433 -U agent controle_notas_pr1_test_nova_validacao
./node_modules/.bin/prisma generate --config prisma7.config.ts
npm test
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/prisma migrate status --config prisma7.config.ts

cd ../frontend
npm ci
npm run build
# Use um Chromium instalado ou execute: npx playwright install chromium
export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
npm run test:e2e
```

As duas suítes recusam URLs fora de `127.0.0.1:5433/controle_notas_pr1_test_*` antes
de carregar a aplicação ou iniciar serviços. A suíte de navegador inicia seus
próprios serviços nas portas 3010 e 5175 e recusa reutilizar processos existentes.
O banco usado deve ter sido preparado pela suíte backend. Para repetir a suíte
no mesmo banco preparado, omita apenas o comando `createdb`.

## Limites e pendências

- Validação de navegador em Chromium/Linux, incluindo viewport móvel; não foi
  executada em dispositivo móvel físico ou Windows nativo.
- A autenticação/autorização permanece fora desta etapa, como já previsto no PR.
- O driver Prisma/pg emite um aviso de depreciação sobre consultas concorrentes
  numa conexão, para mudança futura no pg 9; as operações e testes passaram com
  a versão instalada. Não foram feitas atualizações de dependências fora do escopo.
- Não houve push, merge, publicação ou alteração remota do PR. As correções estão
  locais na branch solicitada, para revisão.

## Continuidade com Docker

O fluxo padrão passou a ser Docker Compose; veja [README.md](README.md) e
[VALIDACAO_DOCKER.md](VALIDACAO_DOCKER.md). As proteções das suítes continuam
restritas a loopback e a bancos com prefixo de teste, inclusive em containers.
