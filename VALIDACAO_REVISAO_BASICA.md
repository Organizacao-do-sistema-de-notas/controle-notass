# Validação — revisão do controle básico

Data: 21/11/2026. Branch: `fix/revisao-controle-basico`.
Base: `feature/backup-servidor`, commit `6f0413a`.

## Problema reproduzido e correção

Na ficha individual era possível digitar anotações ou procedimentos, trocar
de cliente ou fechar a janela e perder o rascunho sem confirmação. Um teste novo
falhou na versão anterior ao verificar que o primeiro cliente deveria continuar
selecionado após cancelar a troca.

`FichasClientes.tsx` agora identifica alterações na ficha e no procedimento
separadamente. Trocar de cliente, fechar pelo X ou usar Escape pede confirmação
antes de descartar. Cancelar a confirmação conserva os campos; aceitar permite
sair, sem gravar o conteúdo descartado no banco.

Editar outro procedimento ou cancelar uma edição também verifica o rascunho do
procedimento. Salvar a ficha mantém intacto um procedimento ainda não salvo.
O navegador recebe `beforeunload` enquanto há alterações ou gravação em andamento;
o aviso deixa de ser solicitado após salvar ou descartar os rascunhos.

As alterações consideram a normalização já existente dos campos, evitando tratar
espaços nas bordas e a ordem dos apelidos como mudanças de conteúdo.

## Verificações

| Verificação | Resultado final |
| --- | --- |
| Geração do Prisma Client | Aprovada |
| TypeScript do backend | Aprovado |
| `npm test` backend | 27 aprovados |
| `npm run build` frontend, TypeScript e Vite | Aprovado |
| `npm run test:e2e` frontend, Chromium | 30 aprovados |
| Três cenários novos de proteção de rascunhos | Aprovados |
| `git diff --check` | Aprovado |

Total: **57 testes aprovados**, sem falhas na execução final. Os cenários novos
cobrem troca/fechamento/Escape, cancelamento e substituição de edição de procedimento,
salvamento independente das duas seções e recarregamento da página antes/depois de salvar.
O teste de recarregamento foi ajustado para solicitar a atualização pelo navegador:
uma atualização cancelada não gera navegação a ser aguardada por `page.reload()`.

A suíte completa mantém cobertura de cadastros, histórico, nomes alternativos,
Excel mensal, informações adicionais, dois navegadores, conflitos de edição,
Painel, erros de rede, Xaxim Gás e os três mercados prioritários.

## Isolamento e pendências

Os testes usaram apenas `controle_notas_pr1_test_docker`, em loopback e namespace
Docker privado, com dados fictícios. Não foram acessados os bancos existentes
do projeto ou da empresa/Confere. Backend, schema, migrações, lockfiles e scripts
de backup não receberam alterações. A validação usou as dependências das imagens
existentes, com fontes e testes atuais montados; não houve novo build completo
de imagem Docker. Os testes de backup não foram repetidos nesta revisão.

O escopo da versão básica e o roteiro de validação manual estão em
[FECHAMENTO_CONTROLE_NOTAS.md](FECHAMENTO_CONTROLE_NOTAS.md). Continuam pendentes
o retorno dos testes no notebook/computador principal e a decisão funcional sobre
o vínculo entre os dois cadastros. Nenhum vínculo foi criado por suposição.
A etapa de base de conhecimento e IA fica adiada até concluir o controle básico.
