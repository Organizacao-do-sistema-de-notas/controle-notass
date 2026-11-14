# Importação local do cadastro do Confere

O importador consome somente o CSV/TSV de sete campos da prévia aprovada. Não se
conecta ao Confere e não executa consultas em sua base. Não modifica Excel, Painel
ou a interface das fichas.

## Destino e identificadores

A migração `20261113090000_importacao_confere` acrescenta duas tabelas, sem alterar
clientes existentes: `ClienteConfere` e `ContabilidadeConfere`. Os códigos do
Confere ficam separados dos IDs internos; repetir um arquivo não duplica os
clientes já vinculados. O arquivo aprovado é identificado por SHA-256.

A CLI recusa qualquer destino fora de:

- `db:5432/controle_notas`, com `CONTROLE_NOTAS_AMBIENTE=docker-local` fornecido
  pelo Compose deste projeto;
- `127.0.0.1:5433/controle_notas_pr1_test_*`, nos testes isolados.

A simulação usa transação PostgreSQL `READ ONLY`. A aplicação, quando solicitada
explicitamente com `--aplicar`, revalida o plano numa única transação, serializa
importadores concorrentes e aborta o lote inteiro quando encontra conflitos.
Não usa `reset`, `db push`, exclusão de clientes ou limpeza de tabelas.

## Preparar arquivos locais

Coloque os arquivos em `backend/importacoes/`, que é ignorado pelo Git e pelos
contextos Docker. O Compose monta essa pasta como somente leitura no backend.
Nunca adicione exportações reais ou regras com dados reais a fixtures de teste
ou ao Git. Os testes versionados usam exclusivamente dados fictícios.

Os sete campos são:

```text
codigo_confere;nome;razao_social;contabilidade;situacao_contabilidade;id_contabilidade_cadastro;id_contabilidade_individual
```

São aceitos CSV com `;` ou `,` e TSV, UTF-8 com ou sem BOM, aspas escapadas,
até 10000 registros e 10 MiB. Campos extras são recusados; não inclua senhas,
CSC, certificados ou observações livres. A frequência de acesso inicia como
`NAO_DEFINIDA`, sem inferências a partir do nome ou da contabilidade.

O arquivo opcional de regras é JSON UTF-8 sem BOM. Exemplo **fictício**:

```json
{
  "equivalencias": {
    "901": { "grupo": "exemplo", "nome": "Contabilidade Fictícia" },
    "902": { "grupo": "exemplo", "nome": "Contabilidade Fictícia" }
  },
  "confirmacoes": { "8001": "901", "8002": "902" },
  "clientesExistentes": {},
  "contabilidadesExistentes": {}
}
```

`equivalencias` reúne somente IDs cuja equivalência foi conferida manualmente.
`confirmacoes` autoriza as linhas com situação `CONFIRMADA_MANUALMENTE`. As regras
reais confirmadas nesta conversa foram salvas apenas na pasta local ignorada.

Possíveis correspondências com clientes/contabilidades cadastrados manualmente
bloqueiam a aplicação. Não são unidos automaticamente por nome. Após conferir a
prévia, `clientesExistentes` pode mapear código externo para ID interno; vincular
um cliente existente preserva integralmente sua ficha. `contabilidadesExistentes`
permite o mesmo vínculo explícito para uma contabilidade de origem.

## Simular no banco de desenvolvimento Docker

Primeiro gere a imagem e aplique a migração **somente no Docker local**, pelo
comando padrão do projeto. No Codex, use também `-f compose.codex.yaml`, conforme
README. Depois, no PowerShell:

```powershell
docker compose --env-file .env.docker up --build -d --wait
docker compose --env-file .env.docker exec -T backend npm run importar:confere -- --arquivo importacoes/clientes_confere.csv --regras importacoes/regras_confere.json --relatorio /tmp/previa_confere.json
docker compose --env-file .env.docker cp backend:/tmp/previa_confere.json ./backend/importacoes/previa_confere.json
```

Sem `--aplicar`, nenhum registro é gravado. O resumo não imprime nomes de clientes
nem credenciais. O relatório completo contém informações cadastrais: mantenha-o
local. Relatórios existentes não são sobrescritos; escolha outro caminho numa
nova execução. Os códigos de saída são 0 para sucesso, 2 para correspondências
pendentes e 1 para erro de arquivo, destino ou operação.

Antes de aplicar, revise o relatório contra o banco de destino e preserve um
backup se houver dados importantes. A prévia foi conferida primeiro no banco de testes e novamente no banco de
desenvolvimento antes da aplicação autorizada.

## Aplicação explícita, após revisão e autorização

Para uma gravação deliberada no Docker local, a mesma CLI oferece `--aplicar`:

```powershell
docker compose --env-file .env.docker exec -T backend npm run importar:confere -- --arquivo importacoes/clientes_confere.csv --regras importacoes/regras_confere.json --relatorio /tmp/aplicacao_confere.json --aplicar
```

Em 13/11/2026, após autorização explícita na conversa, este comando foi executado
com os 491 clientes somente no banco local do Docker. O cadastro local anterior
foi preservado, e os backups antes/depois ficam na pasta ignorada `importacoes/backups/`.

Novos clientes recebem o nome, contabilidade resolvida e razão social como nome
alternativo quando diferente. Os pendentes ficam com `contabilidadeId = null` e
os dados de origem são mantidos para revisão. O vínculo inicial não representa
uma troca e não inventa histórico retroativo.

Clientes já importados são preservados, incluindo notas, procedimentos, apelidos,
frequência, modelos de mensagem, contabilidade e histórico. Mudanças posteriores
no arquivo são sinalizadas em `origemAlterada`, sem sobrescrever edições locais.
Clientes ausentes num arquivo posterior não são apagados nem inativados. A CLI é
uma importação inicial/incremental de cadastros novos, não uma sincronização
automática do Confere.

## Validação realizada

- `npm ci`, geração do Prisma Client, schema válido e TypeScript backend passaram.
- Migração aplicada somente ao PostgreSQL descartável de testes; sem drift.
- Build do frontend passou na imagem Docker.
- 21 testes backend e 7 de interface passaram em Docker, sem falhas ou ignorados.
- Cobertura de separadores/BOM, dados inválidos, códigos duplicados, confirmação
  manual, simulação sem gravação, homônimos, equivalências, repetição, preservação
  de edições/histórico, mapeamentos explícitos e execução concorrente.
- Uma falha fictícia disparada por trigger durante a segunda inserção validou o
  rollback de clientes, aliases e vínculos. Trigger e função pertenciam ao teste
  isolado e foram removidos no encerramento desse caso.
- Simulação do arquivo real: 491 clientes, 86 contabilidades, 396 apelidos,
  39 clientes sem contabilidade e zero conflitos na base de teste.
- Contagens de clientes, contabilidades, aliases e vínculos de origem antes/depois
  da simulação real foram idênticas. Nenhum dos 491 clientes foi inserido.

A prévia e as regras reais ficam em `backend/importacoes/`, fora do Git e das
imagens. Antes de gravar no banco persistente, repita a simulação nesse destino
após aplicar a migração e obtenha autorização explícita para importar dados reais.
A lista de fichas exibe o código de origem para distinguir homônimos e permite
pesquisar por nome e apelidos, somente nome ou somente apelidos. Os apelidos são
editados em Outros nomes para pesquisa e persistidos pela API. A tabela Excel
continua local, sem importação automática dos 491 clientes para aquela visão.
