# Validação — Excel compartilhado e janela de informações

Data: 14/11/2026. Branch: `feature/excel-compartilhado`.
Base: `feature/informacoes-adicionais`, commit `ba7b585`.

## Resultado implementado

- Janela do botão **?** com caixa de texto em consulta, **Alterar**, edição,
  **X vermelho** e **Salvar** verde com bordas chanfradas. Falhas preservam o texto;
  fechar uma edição não salva exige confirmação.
- Clientes da visão Excel, nomes/apelidos, informações adicionais, avisos e
  status/observações por mês persistidos no PostgreSQL. Navegadores consultam
  alterações a cada dois segundos e ao recuperar o foco.
- Importação explícita dos registros antigos de cada navegador, sem apagar
  originais nem substituir silenciosamente valores diferentes já existentes.
  Exportação dos originais em JSON e apresentação das divergências.
- Gravações com comparação do valor anterior por campo, transação e bloqueio
  da linha compartilhada. Edições concorrentes do mesmo campo exigem revisão.
  Alterações de campos diferentes podem ser combinadas.
- Observações mensais com gravação após uma pausa, rascunhos preservados durante
  falhas e mudança de mês, indicação de pendências e proteção ao sair da página.
- Xaxim Gás, três mercados prioritários, Painel, fichas e cadastros centrais
  preservados. O Excel continua independente do cadastro central; nomes iguais
  não provocam associação automática.

## Banco e migração

A migração `20261114180000_excel_compartilhado` contém somente `CREATE TABLE`
para `ExcelCompartilhado`. Nenhuma tabela anterior é modificada ou removida.

Os testes usam exclusivamente PostgreSQL descartável em
`127.0.0.1:5433/controle_notas_pr1_test_docker`, em namespace privado do Docker,
com dados fictícios. As fixtures recusam outros destinos. Exercitam atualização
das quatro migrações iniciais até as sete atuais, preservando dados legados.

A prévia usou um projeto separado, `controle-notas-excel-shared-preview`, com
volume próprio e banco confirmado vazio antes das migrações. As sete migrações
foram aplicadas e os três serviços ficaram saudáveis. Continha somente uma
empresa fictícia de demonstração no Excel; o cadastro central permaneceu vazio.
O banco anteriormente importado e o banco da empresa/Confere não foram acessados
nem alterados nesta validação. Não foram usados reset, db push ou exclusão de volumes.

## Verificações executadas

| Verificação | Resultado |
| --- | --- |
| Prisma Client 7.10: `prisma generate --config prisma7.config.ts` | Aprovado |
| Backend: `tsc --noEmit` | Aprovado |
| Backend: `npm test` | 27 testes aprovados |
| Frontend: `npm run build` (TypeScript e Vite) | Aprovado |
| Frontend: `npm run test:e2e`, Chromium | 27 testes aprovados |
| Dois contextos independentes de navegador | Dados compartilhados e originais locais preservados |
| Edição concorrente, tentativa repetida e lote atômico | Sem sobrescrita silenciosa ou aplicação parcial |
| Falhas de API/rede e entradas inválidas | Erros apresentados e rascunhos mantidos |
| Observação pendente durante mudança de mês | Gravação no mês original |
| Inspeção visual em 1440 px e 390 px | Janela, caixa, X e botão verde visíveis |
| Exportação real do JSON local pelo navegador | Conteúdo original conferido; sem erro JavaScript |
| `pg_dump -Fc` e restauração em nova cópia local | Quantidades e hashes iguais nas 11 tabelas |
| Validador com esquema antigo de 10 tabelas | Compatível |
| Empacotamento de manifests de 10 e 11 tabelas | Ambos aprovados |

Total automatizado: **54 testes aprovados**, sem falhas na execução final.
Dependências/lockfiles não foram alterados nesta etapa; os testes usaram as
dependências das imagens existentes instaladas com `npm ci`, montando os fontes
e testes atuais. Não se reconstruiu uma nova imagem completa nesta execução.

## Problemas encontrados e corrigidos

1. A primeira gravação concorrente podia causar `P2002` no upsert da linha
   compartilhada. A criação usa INSERT parametrizado com `ON CONFLICT DO NOTHING`,
   seguido de bloqueio transacional. O teste de primeiros escritores passou.
2. Comparações por serialização identificavam diferenças falsas após o JSONB
   reordenar chaves. A comparação estrutural evita conflitos e revisões falsas
   ao repetir uma importação ou salvar conteúdo equivalente.
3. Os validadores antigos de backup esperavam exatamente dez tabelas. Agora
   incluem a tabela compartilhada quando presente, preservando compatibilidade
   com os backups anteriores; restauração e empacotamento foram verificados.

## Arquivos e próximos passos

Alterações principais: schema/migração Prisma, domínio e rotas de Excel,
`ExcelViewV2`, janela `InformacoesCliente`, hooks de sincronização/rascunhos,
leitor de dados antigos, testes, scripts de backup e documentação.

Guia operacional: [COMPARTILHAMENTO_EXCEL.md](COMPARTILHAMENTO_EXCEL.md).
Após aprovação para publicar a branch, atualizar somente o servidor do notebook,
mantendo `.env.docker`, nome do projeto e volume existentes. Depois, abrir o
sistema em cada navegador que tenha dados antigos e executar a importação,
revisando divergências. Ambos os computadores precisam acessar a mesma API;
o notebook deve permanecer ligado. A etapa de teste manual nos equipamentos
do usuário continua pendente até essa atualização.
