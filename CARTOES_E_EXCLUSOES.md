# Cartões livres, exclusão de avisos e estados do Painel

Branch de trabalho: `feature/cartoes-livres-exclusao-status`. Base: `68b3309`.
O usuário autorizou a publicação desta etapa na branch
`teste/controle-basico-linux`, usada pelos atualizadores existentes.

## Comportamento solicitado

- Removido o quadro **Como funciona / Controle por mês** da lateral do Excel.
- Com mouse, os avisos e cards do Painel podem ser arrastados pelo texto ou
  espaço livre do cartão. O cartão inteiro acompanha o ponteiro, com sombra e
  marcação do destino. Escape cancela e as bordas da tela permitem rolagem.
- Os controles internos mantêm sua função: clicar no status ou em um botão não
  inicia arrasto. No toque, o puxador continua disponível para preservar a
  rolagem normal da página; as setas do teclado também reordenam pelo puxador.
- Um clique seleciona o aviso e mostra uma borda azul. **Excluir Aviso** usa
  essa seleção. Xaxim Gás continua permanente: pode ser movido, sem exclusão.
- A exclusão de clientes e avisos abre a mesma confirmação central, com
  **Excluir** em vermelho forte e **Cancelar** ao lado. O foco começa em Cancelar.
  Durante a gravação, os botões e Escape não interrompem a exclusão; falhas
  mantêm a confirmação aberta e permitem tentar novamente.
- O controle dos três mercados alterna apenas entre **Pendente** e **Concluído**.
  A correção posterior separa a gravação dos clientes comuns, mantendo o estado
  por mês. Ver [CORRECAO_MERCADOS_E_INCLUSAO.md](CORRECAO_MERCADOS_E_INCLUSAO.md).
- No Painel, o estado fica destacado no topo direito do card. **Pendente**
  recebe vermelho forte, próximo ao Excel. O seletor inferior foi removido;
  **Histórico** fica à esquerda e **Criar/Editar mensagem** à direita.
- A ordem inicial do Painel segue o número de cadastro dos clientes. Alterar
  estado, mensagem ou data de atualização não muda essa ordem.
- **O usuário confirmou que a ordem manual deve valer para todos os meses.**
  Arrastar um card salva essa ordem global, inclusive ao usar filtros de estado,
  preservando a posição relativa dos clientes ocultos.

## Persistência e preservação

O estado compartilhado possui as propriedades opcionais `ordemClientesPainel`
e `avisosExcluidos`. Estados anteriores continuam aceitos. A ordenação global
mantém todos os IDs válidos, acrescenta novos cadastros ao final e usa o controle
de concorrência existente. Uma ordem antiga não sobrescreve outra mais recente.

A exclusão de aviso remove o cartão da lista ativa e preserva sua cópia interna.
Repetir a exclusão é seguro; confirmar um aviso alterado por outra pessoa exige
revisão. Uma importação antiga não recria o aviso excluído. Registros mensais,
históricos de pendências e dados dos clientes não são apagados pela ordenação.
Os três mercados prioritários e o conteúdo permanente de Xaxim Gás permanecem.

Não há mudança de schema, migração nova, dependência ou credencial. A confirmação
compartilha o controle de rolagem entre janelas, evitando deixar a página travada
após fechar a exclusão de cliente.

Os testes usam exclusivamente um PostgreSQL recém-criado em `127.0.0.1:5433`,
banco `controle_notas_pr1_test_cartoes_*`, com dados fictícios. O banco de uso do
usuário, da empresa e do Confere não é acessado. A instalação física permanece
na versão anterior até a execução do atualizador no computador correspondente.

## Pendências mantidas

- Aguardar o layout definitivo dos botões −1/+1 a ser enviado pelo usuário.
- Criar posteriormente a consulta separada aos meses fora da seleção rápida.
- Validar esta etapa nos computadores do usuário depois da publicação autorizada.

## Validação concluída

| Verificação | Resultado |
| --- | --- |
| `npm --prefix backend test` | 60 testes aprovados |
| `npm --prefix frontend run test:e2e` | 62 testes aprovados em Chromium |
| TypeScript do backend (`tsc --noEmit`) | Aprovado |
| `npm --prefix frontend run build` | TypeScript e Vite aprovados |
| Conferência visual em 1440 px e 390 px | Sem erros JavaScript ou rolagem horizontal |
| `git diff --check` | Aprovado |

Os cenários novos medem o deslocamento real do cartão durante o arrasto pelo
texto, verificam o cancelamento por Escape, seleção azul, centralização e cor
da confirmação, cancelamento sem exclusão, bloqueio durante resposta lenta e
recuperação após falha de rede. A exclusão de cliente também confere que a
rolagem da página é devolvida ao fechar as duas janelas.

O Painel foi testado em ordem de cadastro com estados diferentes, após arrasto,
troca de estado, recarga e outro mês, inclusive com filtros ativos. Os históricos
e totais permanecem preservados pela ordenação. O controle dos mercados foi
testado nos dois estados e em competências independentes.

O teste de homônimos passou a escolher um par pelo nome completo em vez de
assumir que só existem dois registros de todas as execuções anteriores. Isso
permite repetir a suíte sem apagar dados fictícios preservados no banco de teste.

Prévia e capturas fictícias: `/workspace/entregas/cartoes-livres/`, incluindo
`painel.png`, `arrastando-aviso.png`, `confirmacao-aviso.png`,
`confirmacao-cliente.png`, `confirmacao-celular.png` e `painel-celular.png`.

## Arquivos alterados

- Backend: `backend/src/controllers/painel.controller.ts`,
  `backend/src/excel/cadastro-unico.ts` e `estado.ts`.
- Interface em `frontend/src/`: `App.tsx`, `AvisosOrdenaveis.tsx`,
  `ExcelViewV2.tsx`, `ExcluirCliente.tsx`, `ConfirmarExclusao.tsx`,
  `useArrastoCartoes.ts`, `bloquear-rolagem.ts`, `excel-compartilhado.ts`
  e `types.ts`.
- Estilos em `frontend/src/`: `arrasto-cartoes.css`, `confirmar-exclusao.css`,
  `avisos-ordenaveis.css`, `botoes-ornamentados.css`, `excel-view.css` e `styles.css`.
- Testes: `backend/test/zz-cartoes.integration.test.ts`,
  `frontend/tests/cartoes.spec.ts`, `exclusao-clientes.spec.ts` e `fichas.spec.ts`.
- Continuidade e relatório: `FECHAMENTO_CONTROLE_NOTAS.md` e este documento.
