# Mercados separados e inclusão no Painel

Branch: `fix/mercados-separados-inclusao-painel`, baseada em `34e4e67`.
Etapa preparada para revisão, sem publicação automática.

## Comportamento corrigido

O controle fixo dos mercados usava a mesma operação das linhas mensais do
Excel. Ao salvar uma chave sem cadastro, a compatibilidade com versões antigas
podia criar um cliente. Agora os três controles gravam apenas seu próprio
estado mensal, Pendente ou Concluído, sem criar cliente ou pendência comum.
Requisições de navegadores antigos e importações locais também respeitam essa
separação.

O usuário autorizou deixar os mercados gerados pelo erro apenas no controle
fixo. A transição identifica esses cadastros pela origem reservada do controle,
retira seus IDs das listas comuns e conserva os cadastros físicos, registros
mensais e históricos. Um cadastro comum com o mesmo nome e origem própria
continua disponível. Estados mensais anteriores dos mercados são copiados para
o controle separado; nenhum registro antigo é apagado.

**Incluir Cliente** no Excel continua escolhendo um cadastro existente. A
inclusão agora salva também a pendência do Painel na mesma transação e competência.
Repetições e solicitações simultâneas não duplicam a pendência nem seu histórico.
Se ela já existir, seus dados, responsável, mensagem e histórico são mantidos.

Ao carregar os dados compartilhados, registros mensais comuns antigos que
ficaram sem pendência são completados automaticamente. A criação inicial usa
o estado e a observação do registro antigo. Pendências existentes não são
sobrescritas. A regra de frequência dos clientes e os controles de edição
existentes permanecem como estavam; esta etapa corrige a inclusão nas listas.

## Preservação e atualização

Não há mudança de schema, migração nova, dependência ou credencial. A aplicação
usa a transação e o bloqueio da base compartilhada, além do bloqueio por cliente,
para manter a inclusão atômica. Os dados do computador do usuário não foram
acessados. Os testes usam somente bancos PostgreSQL descartáveis, recém-criados
em `127.0.0.1:5433`, com nomes `controle_notas_pr1_test_mercados_*` e dados fictícios.

Depois de uma futura publicação autorizada, os atualizadores existentes devem
atualizar backend e frontend juntos, mantendo o backup e o volume. Não é
necessário excluir cadastros ou reincluir manualmente os clientes afetados.

## Validação

| Verificação | Resultado |
| --- | --- |
| `npm --prefix backend test` | 68 testes aprovados |
| Testes em Chromium | 63 cenários validados; arquivo mensal reexecutado com 6 aprovações |
| TypeScript do backend (`tsc --noEmit`) | Aprovado |
| `npm --prefix frontend run build` | TypeScript e Vite aprovados |
| `git diff --check` | Aprovado |

A execução geral do navegador aprovou 61 cenários e identificou duas premissas
incorretas nos testes do arquivo mensal: um script de inicialização forçava a
volta ao Excel após a recarga, e a medição do card compacto dependia da altura
dos vizinhos na grade. O cenário novo passou a alternar a visualização pela
interface, e a medição usa um mês separado. Os seis testes desse arquivo foram
reexecutados e passaram. Não houve alteração adicional no produto para esses
ajustes de teste.

Os cenários específicos cobrem controles sem criação de clientes, meses
independentes, transição dos mercados que apareceram por engano, preservação de
homônimos comuns, requisições antigas, importação, inclusão concorrente,
reparação dos quatro estados, preservação de mensagens e histórico e reversão
integral de um lote inválido. No navegador, o fluxo inclui um cadastro no Excel,
abre o Painel com o mesmo ID e mês, troca o mês e recarrega a página. O controle
fixo também é conferido em uma segunda sessão sem gerar linhas comuns.

## Conferência nos computadores

1. Atualizar pelos scripts com backup quando a publicação for autorizada.
2. Alternar os três mercados entre Pendente e Concluído e trocar de mês.
   Os mercados devem ficar somente no controle fixo.
3. Incluir um cliente eventual no Excel e abrir o Painel do mesmo mês.
   O mesmo cadastro deve aparecer uma única vez.
4. Conferir também as inclusões antigas e os históricos já existentes.

Continuam anotados o envio do layout definitivo dos botões −1/+1 pelo usuário
e a futura consulta separada aos meses fora da seleção rápida.
