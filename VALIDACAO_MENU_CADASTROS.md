# Menu de clientes e contabilidades — 14/11/2026

Implementado na branch `feature/menu-cadastros`, a partir da instalação
`8c5420d78221c7dea591301816fcd1b75f25cf6e`. A opção escolhida pelo usuário foi
um botão de três pontos no topo, com acesso a Clientes e Contabilidades.

## Comportamento

- Menu discreto junto aos botões Painel e Excel, com navegação por teclado.
- Lista de todos os clientes cadastrados no sistema, incluindo inativos,
  pesquisa por nome/apelido/código do Confere e filtros por situação e contabilidade.
- Cadastro e edição de nome, situação e contabilidade do cliente.
- Criação de contabilidade no próprio formulário, seguida de seleção e
  salvamento explícito do vínculo com o cliente.
- Lista, cadastro e edição de contabilidades, com quantidade de clientes vinculados.
- Histórico de trocas e remoções de contabilidade, com identificação opcional
  do responsável. As rotas e regras existentes do backend foram reutilizadas.
- Alterações refletidas no Painel sem reiniciar a tela nem perder a competência.
- Campos mantidos em caso de erro, repetição das leituras e confirmação antes
  de descartar alterações. A navegação fica bloqueada durante a gravação.

Não há exclusão de clientes ou contabilidades nessa tela. Os cadastros centrais
e os registros locais do Excel continuam independentes, conforme o comportamento
anterior. Nenhum schema, migration ou regra de negócio foi alterado.

## Arquivos

| Arquivo | Alteração |
| --- | --- |
| `frontend/src/MenuCadastros.tsx` | Menu de três pontos com itens Clientes e Contabilidades |
| `frontend/src/Cadastros.tsx` | Lista, filtros, formulários, histórico e estados de erro/salvamento |
| `frontend/src/cadastros.css` | Layout discreto, responsivo e estilos do modal |
| `frontend/src/RootApp.tsx` | Acesso pelo topo, abertura/fechamento e retorno do foco |
| `frontend/src/App.tsx` | Atualiza os dados do Painel após alterações de cadastro |
| `frontend/src/api.ts` | Funções para as rotas PATCH de cliente e contabilidade já existentes |
| `frontend/tests/cadastros.spec.ts` | Sete testes novos de interface integrados à API |
| `README.md` | Uso do menu e quantidade atual de testes |

## Verificação

Executados em Docker/Linux com Chromium/Playwright, somente em PostgreSQL local
de testes. A suíte usa `controle-notas-menu-tests`, PostgreSQL em memória, dados
fictícios e a proteção já existente de URL em `127.0.0.1:5433`.

| Verificação | Resultado |
| --- | --- |
| npm ci, Prisma Client e TypeScript do backend na imagem de testes | Aprovados |
| TypeScript e build de produção do frontend | Aprovados |
| Testes de integração do backend | 21 aprovados |
| Testes de interface | 14 aprovados: sete existentes e sete novos |
| Pesquisa, situação e filtro de contabilidade | Aprovados |
| Nome, ativação/inativação e vínculo de contabilidade | Persistem na API sem alterar ficha, apelidos ou procedimentos |
| Criação de contabilidade no formulário e renomeação | Vínculo preservado; nomes históricos não reescritos |
| Histórico de contabilidade | Associação e remoção preservam os registros e o responsável |
| Falhas de rede/leitura e respostas atrasadas | Dados digitados preservados; repetição disponível; resposta antiga não troca o cliente selecionado |
| Salvamento e descarte de alterações | Navegação bloqueada enquanto grava; descarte exige confirmação |
| Teclado e tela pequena de 390px | Foco mantido no modal, Escape fecha e retorna ao botão de três pontos; sem transbordamento horizontal |
| Excel e Painel | Navegação preservada; localStorage do Excel inalterado |
| Xaxim Gás e três mercados prioritários | Preservados |

A última execução reutilizou a imagem de dependências, montou os fontes e testes
do frontend em modo somente leitura e executou novamente o build antes das suítes.
As dependências não mudaram. O comando padrão de reprodução continua no README.

A revisão direta no navegador usou o projeto separado `controle-notas-menu-dev`,
portas 3006/5180 e somente quatro clientes fictícios. Foram capturadas imagens
da lista, do menu e da versão em tela pequena.

## Ajustes encontrados durante a validação

O modal passou a controlar o ciclo de Tab, o fechamento por Escape mesmo com
a pesquisa preenchida e o retorno do foco ao menu. O ícone usa SVG para aparecer
independentemente da disponibilidade do caractere de três pontos na fonte local.
Os testes também passaram a identificar os selects pelo nome acessível e a
manter a simulação de erro de leitura até a ação de tentar novamente.

## Entrega

As alterações estão em uma branch separada para revisão. A branch de instalação,
a `main` e a branch do PR #1 não foram alteradas por esta implementação. Nenhuma
migração foi executada no banco importado de 492 clientes ou no banco da empresa.
A atualização do notebook poderá ser feita após o envio aprovado desta branch,
reconstruindo os containers e preservando o volume PostgreSQL existente.
