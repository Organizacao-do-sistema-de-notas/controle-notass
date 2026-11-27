# Meses rápidos e ordem dos avisos

Branch: `feature/meses-rapidos-ordem-avisos`. Base: `e3be32b`.
O usuário confirmou o funcionamento da versão anterior e autorizou a publicação
desta etapa na branch `teste/controle-basico-linux`, usada pelos atualizadores.
A execução nos computadores do usuário ainda depende da atualização local.

## Alterações

- Excel e Painel usam um seletor compacto com 13 opções: mês atual, seis meses
  anteriores e seis posteriores. Mudar a seleção não desloca essa janela.
- **−1**, à esquerda, volta um mês; **+1**, à direita, avança um mês. A passagem
  de dezembro para janeiro e de janeiro para dezembro considera o ano.
- Nos extremos, o botão correspondente fica desabilitado. Uma preferência antiga
  do navegador fora da janela abre no mês atual, sem alterar dados salvos.
- O Painel permite consultar meses sem pendências, sem exigir um cadastro
  prévio de competência nem selecionar automaticamente um registro antigo.
- A seleção rápida não remove meses, registros, pendências ou históricos do
  banco. A criação de pendências mantém a possibilidade de informar outra data.
- Os avisos podem ser arrastados pelo puxador **⋮⋮**, com mouse ou toque.
  As setas para cima e para baixo do teclado também mudam a posição.
- A ordem fica no banco compartilhado e reaparece após recarregar ou acessar
  por outro computador. Novos avisos entram ao final da ordem já escolhida.
- Xaxim Gás pode mudar de posição, permanecendo sempre presente. O controle
  fixo dos três mercados continua acima dos avisos; a ajuda de uso fica abaixo.
- Uma ordem concorrente exige revisão; uma falha não substitui a ordem salva.
  O conteúdo dos avisos e os registros mensais são preservados.

## Pendências anotadas a pedido do usuário

1. **O usuário ainda enviará o layout definitivo dos botões −1 e +1.** O estilo
   atual é provisório, tanto no Excel quanto no Painel.
2. Preparar, em uma etapa futura, um local separado para pesquisar competências
   fora da seleção rápida. Os registros antigos continuam no banco e nas APIs.
3. Validar esta etapa no Windows e no Xubuntu depois de executar o atualizador.

## Implementação

O componente `SeletorMes.tsx` é compartilhado pelas duas visualizações, com
utilitários de data em `meses.ts` e estilos em `seletor-mes.css`.
`AvisosOrdenaveis.tsx` usa eventos de ponteiro e teclado, sem nova dependência.

O estado compartilhado admite a propriedade opcional `ordemAvisos`. Estados
antigos recebem a ordem padrão sem perder conteúdo. A operação `ordenarAvisos`
valida os identificadores completos e a ordem anterior, usando a transação e
o controle de revisão existentes. Uma repetição da ordem já aplicada é segura.
Não há alteração de schema, nova migração ou mudança de credenciais.

Os testes usam exclusivamente PostgreSQL novo em `127.0.0.1:5433`, banco
`controle_notas_pr1_test_meses_avisos_*` e dados fictícios. Os bancos de uso e
o Confere não são acessados.

## Validação concluída

| Verificação | Resultado |
| --- | --- |
| `npm --prefix backend test` | 55 testes aprovados |
| `npm --prefix frontend run test:e2e` | 56 testes aprovados em Chromium |
| TypeScript do backend (`tsc --noEmit`) | Aprovado |
| `npm --prefix frontend run build` | TypeScript e Vite aprovados |
| Conferência visual em 1440 px e 390 px | Aprovada, sem erros JavaScript ou rolagem horizontal |
| `git diff --check` | Aprovado |

Os cenários novos verificam 13 opções em cada tela, descarte de uma preferência
antiga apenas na navegação, preservação de registros de 2020, meses vazios,
botões nos dois lados, limites e virada de ano. A ordenação foi testada com
mouse, toque real simulado pelo Chromium e teclado, após recarregar, em outro
navegador, com falha de rede, repetição da operação e conflitos simultâneos.
O backend recusa ordens que omitem Xaxim Gás, repetem IDs ou inventam cartões.

Os testes de navegador fixam a data de referência em novembro de 2026, mantendo
os temporizadores reais, para que os limites rápidos não dependam do dia em que
a suíte for executada. O teste de exclusão calcula a redução em relação ao
total anterior, preservando os demais registros fictícios já presentes no mês.

As capturas demonstrativas, com conteúdo fictício, estão em
`/workspace/entregas/meses-rapidos-avisos/`. O seletor central mede 116 × 32 px;
os botões têm 28 × 28 px e permanecem com layout provisório.

## Arquivos alterados

- Meses: `frontend/src/meses.ts`, `SeletorMes.tsx`, `seletor-mes.css`,
  `RootApp.tsx` e `App.tsx`.
- Avisos: `frontend/src/AvisosOrdenaveis.tsx`, `avisos-ordenaveis.css`,
  `ExcelViewV2.tsx`, `excel-compartilhado.ts` e `botoes-ornamentados.css`.
- Persistência e validação: `backend/src/excel/estado.ts` e `cadastro-unico.ts`.
- Testes: `backend/test/excel.integration.test.ts` e, em `frontend/tests/`,
  `meses-avisos.spec.ts`, `exclusao-clientes.spec.ts`, `fixtures.ts` e
  `rascunhos-painel.spec.ts`.
- Continuidade: este relatório e `FECHAMENTO_CONTROLE_NOTAS.md`.
