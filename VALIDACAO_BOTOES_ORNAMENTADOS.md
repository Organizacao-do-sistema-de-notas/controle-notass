# Validação das bordas dos botões

## Correção visual posterior

A revisão substitui a moldura dupla por uma linha única com encaixes nos cantos.
Painel e Excel compartilham uma moldura, com junções no divisor central e a
seleção azul preservada. Alterações restritas ao frontend, sem mudanças de lógica.
Por solicitação do usuário, os testes não foram repetidos nesta revisão.
Os resultados abaixo pertencem à versão anterior, commit `e724e50`.

## Registro da versão anterior

Data: 24/11/2026. Branch: `feature/botoes-ornamentados`.
Base: `fix/revisao-controle-basico`, commit `7d377a2`.

## Alteração

Os botões recebem uma moldura dupla prateada, cantos chanfrados e pequenos
ornamentos, seguindo as referências visuais fornecidas. Um SVG local é usado
como borda em nove partes, preservando os cantos em botões largos e pequenos.
As cores das ações continuam distintas; Salvar permanece verde e o X vermelho.
A moldura é menor nos ícones e opções compactas. O foco de teclado fica visível
e o modo de cores forçadas usa uma borda sólida do sistema.

Foram adicionados `frontend/src/assets/moldura-botao.svg` e
`frontend/src/botoes-ornamentados.css`, com importação em `frontend/src/main.tsx`.
O botão do cartão de mercados prioritários conserva seu estilo próprio.
Não há alterações em lógica, API, schema, migrações ou lockfiles.

## Verificações

| Verificação | Resultado |
| --- | --- |
| `npm ci` no backend e frontend | Aprovado, sem alterar lockfiles |
| Geração do Prisma Client | Aprovada |
| TypeScript do backend | Aprovado |
| `npm test` no backend | 33 testes aprovados |
| `npm run build` no frontend | TypeScript e Vite aprovados |
| `npm run test:e2e` no frontend | 30 testes aprovados |
| Revisão visual em Chromium | Desktop 1440×1000 e celular 390×844 aprovados |
| Teclado, cores forçadas e erros JavaScript na revisão visual | Aprovados, sem erros JavaScript |

Total: **63 testes funcionais aprovados**, além da revisão visual. A suíte
existente cobre cadastros, fichas, histórico, apelidos, informações adicionais,
compartilhamento entre navegadores, conflitos, aviso Xaxim Gás e mercados
prioritários. A suíte da interface foi repetida após o ajuste final do CSS.

O primeiro `npm ci` encontrou um cache padrão sem permissão de escrita.
Executar com caches temporários em `/tmp` resolveu a instalação; não foi
necessário corrigir dependências ou lockfiles.

Ao repetir a suíte no mesmo banco de testes, um cenário de fichas encontrou
dois clientes pelo apelido fixo `Apelido Códex`, incluindo o cliente criado
pela execução anterior, e falhou na expectativa de um único resultado.
A execução isolada da interface em um banco novo também identificou que o teste
de clientes homônimos depende dos dados fictícios preparados pelos testes do
backend. A validação final segue a sequência completa: banco novo, testes do
backend e testes da interface. Nenhum banco anterior foi apagado. Melhorar o
isolamento e a preparação desses cenários fica como pendência separada, sem
alterar a pesquisa do sistema.

## Isolamento e limites

Os testes usaram um cluster PostgreSQL novo, acessível somente por loopback,
com bancos descartáveis de prefixo `controle_notas_pr1_test_bordas` em
`127.0.0.1:5433`, com dados fictícios. A execução final completa usa
`controle_notas_pr1_test_bordas_verificado`.
As sete migrações existentes foram aplicadas nesses bancos vazios.
Os bancos existentes do projeto, da empresa e do Confere não foram acessados.

As capturas visuais usam respostas simuladas com um cliente fictício. Os testes
funcionais usam a API e o PostgreSQL locais reais. Não foi executado um novo
build completo das imagens Docker nem um teste físico no Windows; a confirmação
visual na instalação em `D:\Projetos\controle-notass` continua pendente.
Esta alteração não inclui publicação no GitHub nem merge na main.
