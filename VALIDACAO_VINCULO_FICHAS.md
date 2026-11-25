# Validação do vínculo manual entre Excel e fichas

Data: 25/11/2026. Branch: `feature/vinculo-manual-fichas`.
Base: `feature/botoes-ornamentados`, commit `2e3e4c2`.

## Comportamento

Em **Excel → Alterar Cliente**, o usuário busca uma ficha por nome, apelido ou
código e escolhe explicitamente o cadastro. A seleção só é gravada em **Salvar
alteração**. O atalho **Abrir ficha #…** abre diretamente a ficha escolhida.
Nomes iguais são diferenciados pelo ID; renomear a linha ou o cadastro conserva
o vínculo. É possível trocar a ficha ou selecionar **Sem ficha vinculada**.

O vínculo não copia ou substitui campos entre os cadastros, não sincroniza os
status do Painel e do Excel e não altera históricos ou procedimentos. Duas
linhas podem apontar para a mesma ficha sem mesclar seus registros mensais.
Xaxim Gás e os três mercados prioritários mantêm seu comportamento.

## Implementação e compatibilidade

`vinculosClientes` guarda os IDs no JSON de `ExcelCompartilhado`, usando a
identidade estável já existente de cada linha. Estados antigos sem esse campo
são lidos como um mapa vazio, sem reescrever ou apagar os demais campos.
Não há alterações no schema, migrações, dependências ou lockfiles.

O backend valida o intervalo dos IDs e a existência do cadastro dentro da mesma
transação que salva o lote. IDs inválidos não permitem gravação parcial. O
controle de concorrência compara o vínculo anterior e devolve conflito quando
outra pessoa o altera. A interface conserva a escolha e oferece revisão explícita.

A importação do navegador recusa vínculos não vazios, pois um ID de outro banco
pode identificar outra empresa. Os vínculos já salvos no servidor são preservados.
O backup completo do PostgreSQL inclui os vínculos no estado compartilhado.

## Verificações executadas

| Verificação | Resultado |
| --- | --- |
| TypeScript do backend | Aprovado |
| `npm test` no backend | 36 aprovados: 33 existentes e 3 novos |
| `npm run build` no frontend | TypeScript e Vite aprovados |
| Cenários existentes da interface | 30 aprovados |
| Novos cenários de vínculo na interface | 3 aprovados na execução final direcionada |
| Revisão visual com dados simulados | Desktop e celular conferidos |
| `git diff --check` | Aprovado |

Total: **69 casos aprovados**, somando backend e interface. Os testes novos
cobrem escolha manual entre homônimos, pesquisa por apelido, abertura pelo ID,
persistência após recarregar, renomeação, troca/desvinculação, preservação de
meses/ficha/histórico, validação de entradas, importação e gravações concorrentes.
Também cobrem repetição após falha de leitura e gravação e preservação da escolha.

Na primeira execução, os três testes novos da interface não localizaram alguns
controles com rótulos implícitos contendo opções/valores. Seus seletores foram
corrigidos para usar o papel e o nome acessível do controle. Os 30 cenários
existentes passaram na execução completa; os três novos passaram na repetição
direcionada após a correção dos seletores, sem alterar o comportamento testado.
Na revisão móvel, o código colocado após um nome longo podia ficar cortado.
A identificação passou para o início da opção e o nome selecionado também é
exibido em texto que permite quebra de linha.

## Isolamento e pendências

Foi criado exclusivamente o banco descartável
`controle_notas_pr1_test_vinculos_1795576485`, em `127.0.0.1:5433`, com dados
fictícios. O helper confirma host, porta e prefixo antes de aplicar as sete
migrações existentes nesse banco vazio. Não foram acessados bancos do projeto
em uso, da empresa ou do Confere; não houve importação de clientes reais.

Continuam pendentes a publicação autorizada desta branch e a validação na
instalação Windows e, posteriormente, no Xubuntu. Não foi executado um novo
build completo das imagens Docker ou teste de restauração de backup nesta etapa.
O roteiro de uso está em [VINCULO_FICHAS.md](VINCULO_FICHAS.md).
