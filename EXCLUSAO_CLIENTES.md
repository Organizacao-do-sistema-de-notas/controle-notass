# Exclusão de clientes no Excel e no Painel

Data: 25/11/2026. Branch local: `feature/exclusao-clientes`.
Base: `feature/revisao-formularios-basicos`, commit `34b729a`.
A última versão publicada continua sendo o cadastro único, commit `61e230a`.
Esta revisão e a proteção anterior de formulários permanecem **sem publicação**,
conforme solicitado. Uma nova publicação depende de autorização do usuário.

## Como funciona

1. No **Excel** ou no **Painel**, clicar em **Excluir cliente**.
2. Pesquisar pelo nome, apelido ou número do cadastro e selecionar o cliente.
   A lista mostra o ID para distinguir empresas de mesmo nome.
3. Clicar no botão vermelho **Excluir cliente** e conferir o nome e ID na
   confirmação. Cancelar não grava nenhuma exclusão.

A ação vale para o cadastro único: o cliente deixa de aparecer no Excel, nas
fichas, no menu Clientes, nas seleções de cadastro e nos meses/totais do Painel.
O botão do Painel também permite excluir clientes que não têm pendências.
Uma nova leitura das telas recebe a exclusão; o Excel faz sua consulta periódica
e o Painel pode ser atualizado pelo botão Atualizar ou ao reabrir a visualização.

A exclusão é lógica, distinta de inativar: registra uma data e conserva o
cliente, seus apelidos, informações, procedimentos, vínculos, pendências e
históricos no banco e nos backups. Os registros mensais antigos do Excel e
seus avisos também são preservados. Não existe botão de recuperação nesta etapa.

O aviso Xaxim Gás e as três posições de mercados continuam presentes. Se o
cadastro de um mercado prioritário for excluído, sua posição fixa mostra
**Cliente excluído**, sem tratar o cadastro como uma pendência ativa.

## Proteções

- O servidor exige o ID e o nome confirmado. Se alguém renomear o cliente antes
  da confirmação, a exclusão é recusada para que a lista seja atualizada.
- Repetir a mesma exclusão é seguro e mantém a primeira data, inclusive se uma
  resposta se perder. Homônimos com outros IDs permanecem disponíveis.
- A exclusão e a atualização do Excel são uma transação. Alterações atrasadas,
  importações de linhas antigas e repetições de criação não reativam o cliente.
- Gravações de cadastro, ficha, procedimentos, novas pendências, status e
  mensagens conferem se o cliente continua disponível. Bloqueios coordenados
  evitam gravar sobre um cliente já excluído.
- A janela bloqueia fechamento e nova confirmação durante a solicitação. Falha
  conserva a seleção para uma tentativa posterior; a lista pode ser recarregada.
- O Excel bloqueia o início da exclusão enquanto existem observações locais
  pendentes. Se outro computador excluir o cliente, uma observação ainda não
  salva aparece em uma área para consulta/cópia e descarte explícito. Campos
  abertos em Alterar Cliente também são conservados e o salvamento é bloqueado.
- Uma ficha aberta sem rascunho deixa a seleção indisponível quando recebe a
  exclusão. Rascunhos existentes não são descartados por atualização remota.
- O Painel retira o cartão e recalcula totais após a exclusão, mesmo se a leitura
  seguinte falhar. Respostas antigas de consulta não repõem o cartão excluído.

## Arquivos alterados

| Parte | Arquivos |
| --- | --- |
| Banco | `backend/prisma/schema.prisma`; nova migration `20261125120000_exclusao_logica_cliente/migration.sql` |
| API de clientes | `backend/src/controllers/clientes.controller.ts`; `backend/src/routes/clientes.routes.ts` |
| Cadastro compartilhado | `backend/src/excel/cadastro-unico.ts` |
| Consultas e gravações relacionadas | Controllers de contabilidades, fichas, mensagens, painel e pendências; services de histórico de contabilidade e pendência; `backend/src/importacao/importar-confere.ts` |
| Interface | Novo `frontend/src/ExcluirCliente.tsx` e `excluir-cliente.css`; `App.tsx`, `ExcelViewV2.tsx`, `FichasClientes.tsx`, `api.ts`, `excel-compartilhado.ts`, `useExcelCompartilhado.ts` |
| Testes | `backend/test/exclusao-clientes.integration.test.ts`; `frontend/tests/exclusao-clientes.spec.ts` |
| Documentação | Este relatório, README, CADASTRO_UNICO e FECHAMENTO_CONTROLE_NOTAS |

O endpoint novo é `DELETE /clientes/:id`, com corpo `{ "nomeConfirmado": "…" }`.
A migration acrescenta apenas `Cliente.excluidoEm`, opcional. As oito migrações
anteriores, dependências, lockfiles, Compose e scripts de instalação permanecem
como estavam. Ao disponibilizar esta versão, backend e frontend devem ser
atualizados juntos, com a nova migration. Um backend anterior não conhece o
filtro de exclusão e poderá voltar a mostrar os registros preservados.

## Verificações executadas

Foi conferido o destino **127.0.0.1:5433**, banco novo e descartável
`controle_notas_pr1_test_exclusao_1795613806639`, antes das migrações. Ele estava
vazio. O helper aplicou as quatro migrações de origem, inseriu dados fictícios e
aplicou as demais, incluindo a nova coluna. Nenhuma conexão foi feita ao banco
da empresa/Confere. Não houve reset, db push ou remoção de volumes.

| Verificação | Resultado |
| --- | --- |
| Geração do Prisma Client e validação do schema | Aprovadas |
| `prisma migrate status --config prisma7.config.ts` | Nove migrações aplicadas; schema atualizado |
| TypeScript do backend | Aprovado |
| `npm run build` no frontend | TypeScript e Vite aprovados |
| Testes focados de integração da exclusão | 7 aprovados |
| Testes focados de interface, Chromium | 4 aprovados |
| `git diff --check` | Aprovado |

As sete verificações da API cobrem preservação integral dos relacionamentos,
meses e avisos; validação de entrada e confirmação antiga; homônimos;
idempotência e concorrência; inativação distinta de exclusão; recusa de gravações
atrasadas e reimportação; rollback de lote; prioridades fixas.

As quatro verificações de interface cobrem confirmação/cancelamento no Excel,
exclusão pelo Painel sem pendências, erro de rede e repetição, rascunho em outro
computador e remoção do cartão/totais mesmo se a atualização posterior falhar.

Nas execuções intermediárias foram ajustados dois detalhes dos testes: o helper
passou a aceitar o HTTP 400 em HTML que o Express produz para um JSON escalar
inválido, e a seleção passou a usar o papel acessível do combobox. As execuções
finais dos dois arquivos passaram. O driver `pg` também emitiu um aviso de
depreciação de consultas concorrentes; não houve falha associada nesta execução.

Logs locais: `/tmp/controle-notas-exclusao-backend-final.log` e
`/tmp/controle-notas-exclusao-ui-final.log`. As fixtures do navegador só limpam
registros criados pelo próprio caso dentro do banco descartável, conservando
os IDs da base fictícia anterior. Não foram usadas informações reais de clientes.

## Pendências

Os **11 testes focados** não substituem a suíte completa de regressão, os testes
dos formulários anteriores ou a validação manual no Windows. Esses trabalhos
continuam no próximo lote, como combinado. Não foi feito um novo build das
imagens Docker nem teste de restauração de backup nesta etapa.

Nenhuma alteração foi enviada ao GitHub, mesclada na main ou aplicada no Windows
do usuário. O foco permanece Windows em `D:\Projetos\controle-notass`; Xubuntu,
base de conhecimento e IA ficam para depois da conclusão do controle básico.
