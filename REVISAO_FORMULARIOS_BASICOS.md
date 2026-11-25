# Revisão dos formulários básicos — trabalho local

Data: 25/11/2026. Branch local: `feature/revisao-formularios-basicos`.
Base publicada: `feature/cadastro-unico-clientes`, commit `61e230a`.

## Publicação e continuidade

O cadastro único foi enviado ao GitHub com autorização do usuário. A referência
remota foi conferida e aponta para `61e230a6534e08a690e95cedcf3272236ab34f2f`.
Os 78 testes registrados em [VALIDACAO_CADASTRO_UNICO.md](VALIDACAO_CADASTRO_UNICO.md)
correspondem a essa versão anterior, não às mudanças locais descritas abaixo.

O usuário não pode atualizar o Windows neste momento e pediu que as próximas
alterações permaneçam **sem publicação**, com testes de uso agrupados para
depois. Esta branch foi criada sem upstream e não foi enviada ao GitHub.
Uma nova publicação exige nova autorização. O ambiente principal de teste
continua sendo Windows em `D:\Projetos\controle-notass`; Xubuntu fica para depois.

## Problema e ajuste local

Os formulários **Incluir/Alterar Cliente** e **Incluir/Alterar Aviso**, no Excel,
fechavam pelo X, Cancelar ou fundo da janela sem conferir o texto pendente.
Selecionar outro cliente ou aviso também substituía os campos imediatamente.
A proteção de saída da página cobria somente as observações mensais.

Agora esses quatro formulários:

- Comparam os campos com o conteúdo inicial e pedem confirmação para descartar
  alterações ao fechar ou selecionar outro registro. Recusar conserva os campos.
- Incluem seus rascunhos no aviso do navegador ao recarregar/sair e na proteção
  existente de troca da visualização Excel para Painel.
- Permitem fechar com Escape, usando a mesma confirmação e bloqueio durante
  gravação. Tab permanece no formulário e o foco retorna ao botão de abertura.
- Limpam um novo formulário quando seu descarte é confirmado. O caminho de
  salvamento bem-sucedido continua fechando sem pedir descarte; uma falha
  continua exibindo o erro e mantendo os campos para nova tentativa.

Os arquivos de implementação são `frontend/src/ExcelViewV2.tsx` e
`frontend/src/RootApp.tsx`. Não houve mudança no CSS, backend, schema ou migrações,
nem acesso a bancos nesta etapa. O aviso Xaxim Gás e os mercados prioritários
continuam com os valores anteriores.

## Verificação desta etapa

| Verificação | Resultado |
| --- | --- |
| `npm run build` no frontend | TypeScript e Vite aprovados |
| `git diff --check` | Aprovado |
| Suítes de backend e navegador | Adiadas por solicitação do usuário |
| Teste manual no Windows e entre computadores | Pendente |
| Publicação desta revisão | Retida; somente trabalho local |

## Roteiro para o próximo lote de testes

Usar somente registros fictícios e preservar os dados existentes.

1. Abrir os quatro formulários sem editar e fechar; não deve pedir descarte.
2. Digitar em cada campo e tentar X, Cancelar, clique no fundo e Escape.
   Recusar deve manter o texto; confirmar deve fechar sem gravá-lo.
3. Em inclusão, confirmar descarte e reabrir: os campos devem estar vazios.
4. Em alteração, editar e selecionar outro registro. Recusar deve conservar
   seleção e texto; confirmar deve carregar o registro escolhido.
5. Recarregar com rascunho e cancelar o aviso do navegador. Conferir o texto.
   Conferir também a proteção de saída do Excel quando aplicável.
6. Salvar com sucesso e reabrir para conferir os valores, sem aviso indevido.
7. Simular falha e gravação lenta: falha conserva os campos; uma gravação em
   andamento bloqueia fechamento. Repetir após recuperar a conexão.
8. Conferir foco, Tab/Shift+Tab, Escape, observações de meses diferentes, ficha
   do mesmo ID, aviso Xaxim Gás e os três mercados. Rodar as suítes de regressão.

O build aprovado não substitui esses testes funcionais. Atualização do Windows
e nova publicação ficam para quando o usuário puder revisar o lote.
