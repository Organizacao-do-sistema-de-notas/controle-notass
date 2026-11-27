# Lista mensal do Excel e ajustes do Painel

Data: 26/11/2026. Branch de trabalho: `feature/lista-mensal-ajustes-painel`.
Base publicada: `c89798e`, confirmada pelo usuário com PostgreSQL, API e frontend
saudáveis no Windows. O usuário autorizou a publicação desta etapa na branch
`teste/controle-basico-linux`, usada pelos atualizadores existentes.

## Regra confirmada pelo usuário

- **Mensal:** aparece automaticamente no Excel em todos os meses.
- **Eventual ou Não definida:** aparece somente nos meses em que foi incluído.
- Registros mensais e pendências já existentes continuam contando como inclusão
  no respectivo mês. Nenhum registro anterior é apagado ao alterar a frequência.
- A frequência fica na ficha do cliente. A inclusão na lista é uma decisão por
  mês, usando o mesmo cadastro e ID, sem duplicar clientes.

O botão **Incluir Cliente** agora pesquisa cadastros existentes por nome, apelido
ou número e inclui a seleção somente no mês mostrado na janela. Clientes já
presentes ficam identificados na tabela. O cadastro de uma empresa nova continua
no menu **⋯ → Clientes** e no formulário existente do Painel.

Repetir uma inclusão não duplica cadastros e não substitui status ou observações
já salvos. Os dados permanecem compartilhados entre computadores. Um rascunho de
observação continua acessível se outra pessoa alterar a frequência enquanto a
gravação estiver pendente ou falhar.

## Painel e exclusão

Os cinco indicadores ficam ocultos inicialmente. O pequeno olho ao lado de
**Atualizar** mostra ou oculta o resumo, com rótulo acessível e estado expandido.
Os cards de pendências têm menos espaço interno e controles menores, mantendo
status, mensagem, histórico e as demais informações existentes.

Na exclusão, a caixa **Cliente para excluir** foi substituída por uma tabela com
rolagem e todos os clientes disponíveis, em ordem crescente do número real do
cadastro. A pesquisa por nome, apelido ou número filtra durante a digitação.
Alterar a pesquisa limpa a seleção, evitando excluir um cliente que ficou fora
do resultado. A confirmação final e a exclusão lógica continuam preservando os
históricos e registros do banco.

O aviso permanente **Xaxim Gás** e as prioridades **Bom dia filial**,
**Bom dia Matriz** e **Compre bem** foram preservados.

## Persistência e compatibilidade

Não há mudança no schema, nova migração ou dependência. A projeção compartilhada
passa a informar frequência e participação por competência; os estados antigos
continuam sendo aceitos. A nova operação `incluirClienteMes` exige ID existente e
mês válido e usa a transação atual do cadastro compartilhado. O caminho antigo
de criação permanece no backend para compatibilidade com clientes anteriores,
mas o novo formulário Excel não o utiliza.

As pendências existentes no Painel tornam o cliente visível na mesma competência
do Excel. O armazenamento e os fluxos de status, mensagens e histórico do Painel
continuam com o comportamento anterior.

Os testes desta etapa usam exclusivamente um PostgreSQL novo em
`127.0.0.1:5433`, com banco `controle_notas_pr1_test_mensal_*` e dados fictícios.
Os bancos do usuário, da empresa e do Confere não são acessados.

## Validação

| Verificação | Resultado |
| --- | --- |
| `npm --prefix backend test` | 52 testes aprovados |
| `npm --prefix frontend run test:e2e` | 51 testes aprovados em Chromium |
| TypeScript do backend (`tsc --noEmit`) | Aprovado |
| `npm --prefix frontend run build` | TypeScript e compilação Vite aprovados |
| Conferência visual com dados fictícios, 1440 px e 390 px | Sem erros JavaScript ou rolagem horizontal nas janelas |
| `git diff --check` | Aprovado |

Os cenários verificam frequências Mensal, Eventual e Não definida, inclusão
restrita à competência, preservação dos meses anteriores, atualização entre
navegadores, repetição após perda da resposta, rejeição de mês/ID inválidos e
cliente excluído, pesquisa por apelido, ordenação numérica e confirmação da
exclusão. Também passaram os testes existentes de fichas, contabilidades,
importação fictícia, mensagens e proteção de rascunhos.

Os testes antigos de cadastro e compartilhamento foram ajustados para definir
a frequência ou inclusão explicitamente. O cenário de cadastro pelo Painel
continua verificando que a ficha existe, e agora confirma que um cliente sem
frequência não aparece automaticamente na lista mensal.

Após retirar a borda padrão do pequeno olho, o teste específico desse controle
foi repetido e passou. As janelas de inclusão e exclusão mediram 350 e 352 px
em viewport de 390 px, sem conteúdo excedendo a largura. Na prévia desktop,
os cards de pendência mediram 239 px de altura com todas as ações presentes.
Capturas fictícias estão em `/workspace/entregas/lista-mensal-e-painel/`.

Não foram executadas atualizações no Windows ou no Xubuntu do usuário nesta
etapa. A publicação foi autorizada; a versão deve ser validada nesses
computadores usando o atualizador com backup já existente. Os comandos estão
em `ATUALIZACAO_WINDOWS.md` e `ATUALIZACAO_LINUX.md`.

## Arquivos alterados

- Backend: `backend/src/excel/cadastro-unico.ts` e `backend/src/excel/estado.ts`.
- Interface: `frontend/src/App.tsx`, `ExcelViewV2.tsx`, `ExcluirCliente.tsx` e
  `excel-compartilhado.ts`.
- Estilos em `frontend/src/`: `styles.css`, `cadastro-unico.css`,
  `excluir-cliente.css` e `botoes-ornamentados.css`.
- Testes: `backend/test/z-cadastro-unico.integration.test.ts` e, em
  `frontend/tests/`, `lista-mensal.spec.ts`, `cadastro-unico.spec.ts`,
  `compartilhamento.spec.ts`, `exclusao-clientes.spec.ts`, `fichas.spec.ts`
  e `informacoes.spec.ts`.
- Continuidade e relatório: `FECHAMENTO_CONTROLE_NOTAS.md` e este documento.
