# Validação do cadastro único de clientes

Data: 25/11/2026. Branch: `feature/cadastro-unico-clientes`.
Base: `feature/vinculo-manual-fichas`, commit `651c131`.

## Resultado

Excel, fichas e menu Clientes usam o mesmo cadastro, identificado pelo ID de
`Cliente`. Criar na visão Excel ou no menu disponibiliza o cliente nas outras
telas automaticamente. A seleção manual de vínculo foi removida. As listas
usam nome e ID para ordenação; posição e nomes iguais não definem a identidade.

Nome, apelidos e informações adicionais são compartilhados. A ficha recebe o
campo de informações adicionais já exibido no botão ? do Excel. As anotações
permanentes anteriores permanecem separadas, assim como os registros mensais.
Os históricos, procedimentos, contabilidade, aviso Xaxim Gás e três prioridades
são preservados. O fluxo mensal do Painel mantém seu comportamento.

As fichas abertas e o Excel verificam atualizações, conservando rascunhos e
gravações em andamento. Informações e apelidos usam comparação do valor anterior
para detectar edição concorrente. A ficha envia somente os campos alterados.
A criação pelo Excel usa uma identidade de solicitação para evitar duplicar
clientes quando a resposta se perde e o usuário tenta novamente.

## Persistência e transição

- Migração aditiva `20261125090000_cadastro_unico`: uma coluna `TEXT` opcional,
  `Cliente.informacoesAdicionais`. As outras sete migrações não foram modificadas.
- `Cliente` e seus nomes alternativos são a origem dos dados cadastrais. O JSON
  do Excel guarda uma projeção atualizável, referências por ID, meses e avisos.
- O armazenamento versão 2 conserva uma cópia integral do JSON anterior em
  `legado`. A consolidação ocorre em uma transação, inclusive ao abrir Clientes
  antes de visitar Excel.
- Vínculos antigos confirmados são reutilizados. Linhas antigas salvas sem uma
  identidade confirmada geram cadastros próprios, sem fusão por nome ou posição.
- Duas linhas antigas do mesmo ID só são consolidadas se seus meses forem
  compatíveis. Uma diferença de status/observação interrompe a transição e
  conserva o JSON original, sem aplicação parcial.
- A lista fixa de exemplos da interface foi retirada. Os clientes efetivamente
  salvos no banco formam a lista comum; não há importação de empresas reais.

O formato consolidado exige o backend e frontend desta versão. O retorno a uma
versão anterior deve ser planejado com uma cópia anterior do banco, conforme
[CADASTRO_UNICO.md](CADASTRO_UNICO.md).

## Verificações

| Verificação | Resultado |
| --- | --- |
| Geração do Prisma Client | Aprovada |
| `prisma migrate status --config prisma7.config.ts` | Oito migrações aplicadas, sem pendências |
| TypeScript do backend | Aprovado |
| `npm test` no backend | 42 aprovados |
| `npm run build` no frontend | TypeScript e Vite aprovados |
| `npm run test:e2e`, Chromium | 36 aprovados |
| Revisão visual | Cadastro, Excel e ficha com dados fictícios conferidos |
| `git diff --check` | Aprovado |

Total final: **78 testes aprovados**, em execução completa sobre banco novo.
Os testes de vínculo manual foram substituídos pelos cenários de cadastro único.
As expectativas antigas de cadastros separados passaram a verificar a mesma
identidade nos dois lugares. Os testes de meses, histórico, procedimentos,
avisos, prioridades, navegação, foco e recuperação de falhas foram preservados.

Os cenários novos cobrem criação em ambas as telas, ordenação, homônimos,
renomeação, situação inativa, compartilhamento de apelidos/informações,
concorrência nos dois sentidos, proteção de rascunhos, resposta perdida na
criação, transição de dados antigos, cópia de origem e transição ambígua.

Na execução intermediária, o teste de conteúdo HTML em texto encontrou remoção
de um espaço final durante a importação de informações antigas. A consolidação
passou a conservar o texto integral e o cenário passou na execução final.
Outras expectativas antigas foram atualizadas para o contrato do cadastro único,
mantendo verificações de preservação e de rejeição de lotes parciais.

As fixtures do navegador guardam os IDs iniciais e removem somente os clientes
criados pelo próprio caso, mantendo a base fictícia anterior. Essa limpeza é
restrita por verificação de host, porta e nome do banco de testes.

## Ambiente e pendências

Foram usados exclusivamente bancos descartáveis `controle_notas_pr1_test_unico_*`
em `127.0.0.1:5433`, com dados fictícios. A execução completa final utilizou
`controle_notas_pr1_test_unico_entrega_1795583842`. O helper confirma o destino
e aplica as oito migrações, começando pela atualização de uma base fictícia
com as quatro migrações antigas. Não houve acesso ao banco da empresa/Confere,
importação de clientes reais, reset, db push ou remoção de volumes.

Dependências, lockfiles, Compose e scripts de instalação não foram alterados.
Não foi executado um novo build completo das imagens Docker nem uma restauração
de backup nesta etapa. A publicação depende de autorização; a validação física
no Windows e, depois, no Xubuntu continua pendente.
O usuário confirmou que a instalação Windows contém apenas dados de teste;
nenhum comando foi executado nessa máquina a partir do ambiente Codex.
