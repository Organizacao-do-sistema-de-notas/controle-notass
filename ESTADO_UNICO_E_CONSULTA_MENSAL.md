# Estado único e consulta de meses antigos

Branch: `fix/estado-unico-consulta-mensal`, baseada na publicação `88df50a`.
Implementação local, sem publicação automática.

## Sincronização

Excel e Painel agora usam o estado da mesma pendência, identificado pelo cadastro
do cliente e pela competência. O Excel apresenta OK para Concluído e Aguardando
para Aguardando cliente; Pendente e Em atendimento têm correspondência direta.
Mudar o estado em uma tela altera o que é apresentado na outra, inclusive em
outra sessão aberta. Os mercados continuam separados no controle fixo.

A tabela Pendencia é a referência do estado. A representação compartilhada do
Excel é atualizada na leitura. Uma mudança pelo Excel grava a pendência e seu
histórico na mesma transação. Os dois fluxos usam o mesmo serviço de gravação
de estado; repetir o valor não duplica eventos ou altera a data de conclusão.
Reabrir uma pendência limpa a conclusão. A ordem manual dos clientes não muda.

Na primeira leitura, a transição mantém uma cópia dos registros anteriores no
campo interno `registrosAntesUnificarEstado`. Quando o estado antigo do Excel
diverge de uma pendência já existente, prevalece o estado desta, preservando o
conteúdo anterior nessa cópia. Não são inventados eventos para a simples leitura.
Observações já salvas no Excel não são sobrescritas pela atualização de estado.
Mensagens, responsáveis e históricos existentes permanecem preservados.

O Excel mantém o controle de concorrência: uma edição baseada em estado antigo
recebe conflito e nenhum outro campo do lote é aplicado parcialmente. Os
bloqueios de cliente e pendência coordenam as gravações. O Painel não adquire o
bloqueio do JSON depois do bloqueio de cliente, evitando inversão dessa ordem.

O Painel consulta atualizações a cada dois segundos, sem ocultar os cartões.
Pausa durante gravação, formulários e histórico abertos e arrasto, e consulta
novamente ao retornar à aba. Rascunhos de observações do Excel continuam
protegidos. Leituras antigas não substituem a competência recém-selecionada.

## Consulta de meses antigos

O menu **⋯ → Consultar meses antigos** abre uma consulta separada, acessível
pelo Excel e pelo Painel. Permite informar qualquer mês, escolher entre meses
com registros, pesquisar um cliente por nome ou número e ler seu histórico.
A tabela apresenta estado e observação do Excel. A consulta não envia operações
de gravação e não muda a competência das telas principais.

A seleção rápida continua com 13 opções: seis meses anteriores, o atual e seis
posteriores. O layout definitivo dos botões −1/+1 ainda será enviado pelo usuário.

## Configuração e validação

Não há nova dependência, migração de schema ou credencial. A configuração de
Docker, portas locais e scripts de atualização com backup permanece válida.
A atualização desta etapa precisa contemplar backend e frontend juntos.

Os testes usam exclusivamente PostgreSQL descartável recém-criado em
`127.0.0.1:5433`, com nome `controle_notas_pr1_test_estado_*` e dados fictícios.
Nenhum banco do usuário, da empresa ou do Confere é acessado.

| Verificação | Resultado |
| --- | --- |
| `npm --prefix backend test` | 73 testes aprovados |
| Testes em Chromium | 67 cenários validados; arquivo novo reexecutado com 4 aprovações |
| TypeScript do backend (`tsc --noEmit`) | Aprovado |
| `npm --prefix frontend run build` | TypeScript e Vite aprovados |
| Backup e recuperação em banco separado | 11 tabelas conferidas por quantidade e SHA-256 |
| `git diff --check` | Aprovado |

Na execução geral do navegador, 66 cenários passaram e a consulta nova revelou
uma falha de retorno do foco ao fechar por Escape. O fechamento passou a devolver
o foco ao botão Mais opções explicitamente. Os quatro testes novos foram
reexecutados e passaram, incluindo tela de 390 px, falha de rede, nova tentativa,
teclado, consulta sem gravações, sincronização remota e preservação de rascunho.

Os testes antigos de transição foram ajustados para conferir os registros
preservados sem exigir que pendências já existentes fiquem ausentes do Excel.
O teste de exclusão usa a observação efetivamente lida antes da edição, mantendo
a verificação de preservação completa das relações e históricos.

A recuperação usa `pg_dump` em formato customizado e `pg_restore` em transação
única, para um banco novo e vazio, sem apagar nem substituir a origem. Foram
conferidos dados fictícios de cliente, pendência concluída, aviso e a cópia
interna da transição, além dos demais registros das 11 tabelas. A verificação
não acessa o banco dos computadores do usuário e não substitui a cópia externa
do backup da instalação em uso. Evidência local:
`/tmp/controle-notas-estado-recuperacao-q2srhdwq/resultado.json`.

## Continuidade

1. Conferir os estados nos dois sentidos, nos dois computadores, com a mesma
   competência selecionada, depois da futura publicação autorizada.
2. Conferir mensagens, exclusões, históricos, observações e arrasto, incluindo
   persistência após reinício e cópia de backup em dispositivo separado.
3. Aplicar o layout definitivo de −1/+1 quando o usuário enviar a referência.
4. Desenvolver a base de conhecimento conforme o plano separado, com contexto
   de cliente/sistema/versão e revisão de conteúdo antes da integração de IA.

A validação física nos computadores depende do retorno do usuário; esta etapa
não instala serviços nem altera a configuração desses computadores à distância.
