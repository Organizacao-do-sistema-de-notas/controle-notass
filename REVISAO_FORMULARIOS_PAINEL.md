# Proteção dos formulários do Painel

Data: 25/11/2026. Branch local: `feature/protecao-formularios-painel`.
Base: `feature/exclusao-clientes`, commit `1ec9820`.

Esta branch inclui o cadastro único, a proteção anterior dos formulários do Excel
e a exclusão de clientes. A última versão publicada permanece `61e230a`, na
branch `feature/cadastro-unico-clientes`. As alterações posteriores continuam
**sem publicação** até nova autorização do usuário.

## Problemas corrigidos

No Painel, fechar **Novo cliente**, **Nova contabilidade**, **Nova pendência** ou
a mensagem do contador descartava alterações sem confirmação. Os campos e o
fechamento também ficavam disponíveis durante gravações. Um erro de salvamento
podia aparecer somente na página atrás da janela e ficar escondido.

Os quatro formulários agora:

- Conferem alterações antes de fechar pelo X, Cancelar, Escape ou fundo da
  janela. Recusar o descarte conserva os campos. Dados iniciais e modelos
  preenchidos automaticamente não são tratados como edições do usuário.
- Participam da proteção de recarga/saída do navegador e da troca para o Excel.
- Bloqueiam campos, fechamento, envio simultâneo e troca de visualização durante
  gravações. Leituras iniciais também bloqueiam a abertura de outro formulário.
- Mostram o erro dentro da janela, conservando o conteúdo para nova tentativa.
- Mantêm Tab/Shift+Tab dentro do formulário e devolvem o foco ao botão de abertura.

A mensagem reconhece o texto devolvido pelo servidor como a versão salva. Assim,
fechar após salvar não pede descarte indevidamente. Se o salvamento falhar, o
texto continua pendente e protegido.

A criação de uma pendência fecha o formulário assim que o servidor confirma a
gravação. Se a leitura seguinte das competências falhar, a página informa o
erro, sem deixar um formulário de criação já concluído pronto para novo envio.

Os botões de cadastrar/salvar continuam necessários. Esta proteção não transforma
os formulários em salvamento automático.

## Arquivos

| Arquivo | Alteração |
| --- | --- |
| `frontend/src/App.tsx` | Estado de rascunhos, bloqueio de gravação, confirmação, teclado/foco e erros nos quatro formulários |
| `frontend/src/RootApp.tsx` | Considera rascunhos e gravações do Painel ao trocar de visualização |
| `frontend/tests/rascunhos-painel.spec.ts` | Seis cenários de navegador com API simulada |
| `FECHAMENTO_CONTROLE_NOTAS.md` | Situação atual e roteiro do próximo lote de testes |
| Este relatório | Decisões, verificações e pendências desta etapa |

Não houve alteração no backend, banco, migrações, dependências, lockfiles ou CSS.
O aviso Xaxim Gás, os mercados prioritários e o cadastro único continuam com a
implementação anterior. A exclusão de clientes da etapa anterior está preservada.

## Verificações executadas

| Verificação | Resultado |
| --- | --- |
| `npm run build` no frontend | TypeScript e Vite aprovados |
| Cenários de interface desta revisão | 6 aprovados no Chromium |
| `git diff --check` | Aprovado |
| Backend/PostgreSQL | Não utilizados nesta etapa |
| Publicação no GitHub | Não executada |

Três cenários conferem separadamente os cadastros de cliente, contabilidade e
pendência: abertura sem edição, recusa de descarte pelo X/Escape/fundo, descarte
confirmado, reabertura limpa e restauração de foco. O quarto confere a mensagem:
modelo inicial, recarga cancelada, troca de visualização recusada, erro de API,
rascunho preservado e fechamento após salvar. O quinto simula gravação lenta e
envio repetido; o sexto simula criação concluída seguida de falha na consulta.

Todos os endpoints da API foram interceptados pelo teste com dados fictícios.
A configuração temporária iniciou somente o Vite e o navegador, sem backend
ou PostgreSQL. Na suíte normal, o arquivo também pode ser executado junto dos
demais testes; os outros arquivos continuam usando o banco descartável protegido.

Na execução intermediária, o teste de recarga aguardava uma navegação que havia
sido cancelada corretamente. Ele foi ajustado para disparar a recarga e observar
o aviso, seguindo o padrão já usado nos testes de ficha. A execução final dos
seis casos passou. Log: `/tmp/controle-notas-painel-rascunhos-final.log`.
Configuração local: `/tmp/controle-notas-painel-playwright.config.mjs`.

## Próximo lote de validação

A suíte completa de regressão e os testes manuais continuam pendentes. Nenhum
comando foi executado no Windows do usuário. Quando ele puder atualizar, reunir:

1. Backup e atualização conjunta de backend/frontend, com configuração e volume
   existentes preservados, após autorização para publicar o lote.
2. Cadastro único, nomes/apelidos, contabilidade e ficha do mesmo ID nas telas.
3. Status e observações de meses distintos, informações adicionais e avisos fixos.
4. Rascunhos dos formulários do Excel e do Painel, inclusive falha de rede e recarga.
5. Exclusão por ambas as visualizações, confirmação, atualização dos totais e
   rascunho pendente em outro navegador.
6. Uso pelos dois computadores, reinicialização e conferência dos dados salvos.
7. Suítes completas e teste de recuperação de backup em ambiente separado.

O roteiro detalhado permanece em [FECHAMENTO_CONTROLE_NOTAS.md](FECHAMENTO_CONTROLE_NOTAS.md),
com os relatórios anteriores vinculados. A prioridade é concluir essa validação
no Windows em `D:\Projetos\controle-notass`, antes de retomar Xubuntu ou IA.
