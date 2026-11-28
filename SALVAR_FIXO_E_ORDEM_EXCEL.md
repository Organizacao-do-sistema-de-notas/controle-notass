# Salvar ficha visível e ordenar clientes no Excel

Implementação original: `33a019f`, na branch `feature/salvar-ficha-fixo-ordem-excel`.
Depois da política de versões definida pelo usuário, o lote foi separado:
Salvar ficha fixo foi publicado como patch na versão inicial **0.0.1**; arrastar
clientes no Excel foi preparado como minor **0.1.0**, na branch
`minor/0-1-0-ordem-excel`. O usuário autorizou sua publicação na branch
`teste/controle-basico-linux`.

## Fichas

O botão Salvar ficha fica no canto inferior direito do rodapé da janela,
fora da área que rola. Permanece visível durante a consulta e edição dos campos,
procedimentos e históricos, inclusive no celular. O rodapé também apresenta o
resultado da gravação e os erros, permitindo tentar novamente sem procurar os
avisos no início do formulário.

Existe um único botão de salvar a ficha. Ele fica desabilitado sem ficha carregada
ou durante uma gravação. A gravação continua usando o cliente selecionado, com
os mesmos controles de conflito, proteção de rascunhos e bloqueio de navegação.
Os procedimentos mantêm seu próprio botão Salvar procedimento.

## Clientes do Excel

Com o mouse, segurar e arrastar pelo nome ou espaço livre move a linha inteira,
como nos avisos. Um puxador pequeno também permite mover pelo toque e pelas
setas do teclado. Escape cancela o arrasto. Status, observação, Abrir ficha e
informações adicionais mantêm sua função sem iniciar arrasto.

A ordem do Excel é própria, global para todos os meses e compartilhada entre
os computadores. A ordem do Painel permanece independente. A pesquisa e a
frequência continuam definindo quais clientes são visíveis; arrastar com filtro
mantém todos os outros cadastros na ordem salva. As observações em rascunho
permanecem associadas ao ID e ao mês originais.

A propriedade opcional `ordemClientesExcel` e a operação `ordenarExcel` usam
o mesmo controle de revisão e a transação já existentes. A ordem deve conter
todos os IDs válidos uma única vez. Uma solicitação antiga recebe conflito e
não sobrescreve uma ordem mais recente. Repetir a ordem aplicada é seguro.
Cadastros novos entram ao final; renomear mantém a posição e excluir retira
apenas o ID correspondente da ordem ativa.

Não há alteração de schema, dependência, credencial ou configuração do Docker.
A atualização futura deve incluir backend e frontend juntos. Mercados e avisos,
estados mensais, mensagens e históricos não são alterados pela ordenação.

## Validação

Os testes da implementação original usam bancos PostgreSQL novos e descartáveis em `127.0.0.1:5433`,
com nomes `controle_notas_pr1_test_ficha_ordem_*` e dados fictícios. Nenhum banco
do usuário, da empresa ou do Confere é acessado.

| Verificação | Resultado |
| --- | --- |
| `npm --prefix backend test` | 76 testes aprovados |
| Testes em Chromium | 73 cenários validados; arquivo novo reexecutado com 4 aprovações |
| TypeScript do backend (`tsc --noEmit`) | Aprovado |
| `npm --prefix frontend run build` | TypeScript e Vite aprovados |
| Conferência visual em 1440 px e 390 px | Aprovada, sem erros JavaScript |
| `git diff --check` | Aprovado |

A execução geral do navegador aprovou 72 cenários. O teste de filtro foi
ajustado para considerar a ordem global efetivamente carregada, incluindo a
posição dos clientes ocultos, sem presumir ordem de cadastro na lista inicial.
Os quatro cenários do arquivo novo foram reexecutados e passaram. A linha em
movimento também recebeu fundo opaco para manter a leitura ao passar sobre
as outras linhas.

Os cenários novos verificam o botão visível ao rolar até o fim em 1440 px e
390 px, gravação real, erro e nova tentativa no rodapé. A ordenação confere o
movimento da linha inteira, cancelamento, filtros, rascunhos, falhas de rede,
outro navegador, recarga, outro mês, dados antigos, IDs inválidos e concorrência.

Capturas com dados fictícios: `/workspace/entregas/ficha-fixa-ordem-excel/`,
incluindo `ficha-desktop-fim.png`, `ficha-celular-fim.png` e
`excel-arrastando.png`.

Após a separação em versões, o código de aplicação desta minor foi conferido
como idêntico ao lote original validado `33a019f`. A versão 0.1.0 está consistente
em VERSION, manifests e metadados dos lockfiles, sem mudança de dependências.
Os dois testes de Salvar ficha e os dois de arrasto foram reexecutados nos
arquivos separados e passaram, assim como o build. A publicação da minor foi
autorizada pelo usuário; o patch do rodapé permanece incluído desde a 0.0.1.
