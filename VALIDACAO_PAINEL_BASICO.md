# Validação — histórico e entradas do Painel

Data: 22/11/2026. Branch: `fix/revisao-controle-basico`.
Base desta etapa: `b573948`, que já contém a proteção de rascunhos das fichas.

## Problemas encontrados

1. Atualização de pendência e mensagem liam o valor anterior antes de iniciar a
   transação. Duas gravações simultâneas podiam gerar eventos duplicados ou
   atribuir um valor anterior incorreto. Um teste reproduziu duas entradas de
   status quando deveria existir somente uma.
2. Duas criações simultâneas da mesma pendência podiam passar pela consulta prévia
   e uma delas retornar erro 500 pela restrição única, em vez do conflito 409.
3. Alguns IDs fora do limite INTEGER do PostgreSQL e corpos ausentes chegavam à
   consulta ou à desestruturação do controller, em vez de serem recusados com 400.

## Correções

- Pendências e mensagens usam bloqueio parametrizado da linha dentro da transação.
  O valor anterior é lido depois de obter o bloqueio. Alteração e histórico são
  gravados juntos, e a resposta é consultada na mesma transação.
- Repetir o mesmo valor não gera um evento novo. Atualizações de campos diferentes
  mantêm os demais valores. No Painel, mudanças no mesmo campo continuam sendo
  aplicadas na ordem de gravação, com histórico do valor anterior efetivo.
- Datas de eventos são atribuídas após obter o bloqueio. Consultas de histórico
  desempataram por ID, além da data, para manter uma ordem estável.
- A data de conclusão é preservada nas repetições e removida na reabertura.
- A restrição única de cliente/competência retorna 409 com o ID existente também
  na disputa entre requisições concorrentes.
- Validação compartilhada de IDs Int32 e de corpos de requisição nas rotas de
  pendências e mensagens. Tipos inválidos não alteram dados nem histórico.

## Testes e resultados

| Verificação | Resultado |
| --- | --- |
| Teste de reprodução na versão anterior | Falhou como esperado: dois eventos de status, quando somente um era devido |
| Prisma Client e TypeScript do backend | Aprovados |
| Backend `npm test` | 33 aprovados |
| Frontend `npm run build`, TypeScript e Vite | Aprovado |
| Frontend `npm run test:e2e`, Chromium | 30 aprovados |
| `git diff --check` | Aprovado |

Total final: **63 testes aprovados**, sem falhas ou testes ignorados.

Seis novos testes de integração cobrem IDs/corpos inválidos e ausência de alteração,
quatro criações paralelas com um único cadastro, status repetido/conclusão,
sequência de alterações simultâneas e preservação de campos, mensagens concorrentes,
normalização/limpeza e histórico. A concorrência é coordenada por um bloqueio de
uma linha fictícia e conferida pela espera real das requisições no PostgreSQL.

## Isolamento e limites

Foi usado somente PostgreSQL descartável `controle_notas_pr1_test_docker`, em
`127.0.0.1:5433` no namespace privado do projeto Docker de testes. A proteção de URL
é aplicada antes de carregar a aplicação. As migrações existentes são aplicadas
apenas nesse banco vazio, e todos os registros de teste são fictícios.

Schema, migrações, dependências, telas e scripts de backup não mudaram nesta etapa.
Os bancos existentes do projeto e o banco da empresa/Confere não foram acessados.
Nenhum reset, db push, remoção de volumes ou importação real foi executado.
As dependências vieram da imagem de testes já disponível, com os fontes atuais
montados; não foi reconstruída uma imagem completa nem repetida a suíte de backup.

O frontend mantém seus 30 testes, incluindo a proteção de rascunhos da etapa
anterior, Excel mensal, compartilhamento, conflitos, cadastros, Xaxim Gás e os
três mercados prioritários. Continua pendente a validação no notebook e computador
principal e a decisão sobre vínculo manual entre cadastros centrais e linhas Excel.
Nada nesta correção cria esse vínculo ou implementa base de conhecimento/IA.

Roteiro para concluir a versão: [FECHAMENTO_CONTROLE_NOTAS.md](FECHAMENTO_CONTROLE_NOTAS.md).
