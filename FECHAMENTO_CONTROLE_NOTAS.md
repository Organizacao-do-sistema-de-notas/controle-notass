# Fechamento da versão básica do controle-notass

**Publicada: 0.0.1; preparada: 0.1.0, em desenvolvimento.** A regra atual do usuário autoriza
publicar patches após validação, sem nova pergunta, fornecendo os comandos de
atualização. Minors acrescentam funcionalidades e exigem autorização antes de
publicar. Ver [VERSIONAMENTO.md](VERSIONAMENTO.md). Essa regra substitui as
anotações históricas abaixo que pediam aprovação para qualquer publicação.

A prioridade atual é concluir e validar o controle de notas. Base de conhecimento,
integrações de IA e automação de instalações ficam para uma etapa futura.

Em 25/11/2026, o usuário pediu para retomar os testes e atualizar o servidor Linux.
O lote foi reunido na branch `teste/controle-basico-linux`, mantendo a main
separada. Ele contém cadastro único (`61e230a`), proteção dos formulários do
Excel (`34b729a`), exclusão de clientes (`1ec9820`) e proteção do Painel (`e48bee5`).
As menções de “sem publicação” nos relatórios dessas etapas descrevem sua
preparação anterior à distribuição deste lote de testes.

O procedimento com backup está em [ATUALIZACAO_LINUX.md](ATUALIZACAO_LINUX.md).
Resultados do lote: [VALIDACAO_ATUALIZACAO_LINUX.md](VALIDACAO_ATUALIZACAO_LINUX.md).
O usuário confirmou em 25/11/2026 que o sistema está funcionando no Linux.
O ajuste visual seguinte engrossa ligeiramente as linhas e reduz os ornamentos
dos botões. A atualização da instalação Windows existente está em
[ATUALIZACAO_WINDOWS.md](ATUALIZACAO_WINDOWS.md), preservando configuração e banco.
O teste físico desse ajuste no Windows continua pendente. Novas alterações
seguem sem publicação automática.

Em 26/11/2026, a atualização Windows foi interrompida na identificação do banco,
antes das migrações. A consulta do backup foi corrigida para os argumentos
nativos do Windows PowerShell; nove testes de backup passaram, incluindo o modo
`Legacy` e a recusa de tabelas ausentes. A retomada no Windows e seus resultados
ainda precisam de confirmação do usuário. Detalhes em
[VALIDACAO_BACKUP_SERVIDOR.md](VALIDACAO_BACKUP_SERVIDOR.md).

O usuário confirmou a atualização Windows em `c89798e`, com schema atualizado
e os três serviços saudáveis. Nos testes seguintes, definiu que apenas clientes
mensais devem aparecer automaticamente todo mês; os demais exigem inclusão por
competência de um cadastro existente. Essa correção e os ajustes de indicadores,
cards e tabela de exclusão foram preparados na branch
`feature/lista-mensal-ajustes-painel`. O usuário autorizou a distribuição deste
lote na branch `teste/controle-basico-linux`, mantendo a main separada. Detalhes
em [LISTA_MENSAL_E_PAINEL.md](LISTA_MENSAL_E_PAINEL.md).

Relatórios de implementação: [cadastro único](VALIDACAO_CADASTRO_UNICO.md),
[formulários do Excel](REVISAO_FORMULARIOS_BASICOS.md),
[exclusão](EXCLUSAO_CLIENTES.md) e [formulários do Painel](REVISAO_FORMULARIOS_PAINEL.md).

## Escopo da versão básica

| Fluxo | O que conferir |
| --- | --- |
| Instalação e atualização | Docker inicia PostgreSQL, API e frontend; configuração e volume existentes são preservados |
| Clientes e contabilidades | Criar, pesquisar, editar, ativar/inativar, excluir preservando histórico e vincular/desvincular contabilidade |
| Ficha individual | Salvar apelidos, frequência, anotações permanentes, modelo de mensagem e procedimentos |
| Excel por mês | Pesquisar por nome/apelido, alterar status e observação; cada mês conserva seus registros |
| Informações adicionais | Consultar no botão ?, editar, salvar e reler em outro navegador |
| Avisos e prioridades | Xaxim Gás permanente; Bom dia filial, Bom dia Matriz e Compre bem preservados |
| Painel | Criar pendência, alterar status, consultar histórico e salvar/copiar mensagem |
| Compartilhamento | Dois computadores acessam a mesma API e recebem os dados salvos, com revisão de conflitos |
| Persistência e backup | Reiniciar serviços conserva o banco; gerar cópia em pasta privada e guardar em outro dispositivo |

## Cadastro único de clientes

Excel, fichas e menu Clientes usam os mesmos clientes e IDs. Criar um cliente
em qualquer ponto de cadastro o disponibiliza nas outras telas automaticamente.
Nome, apelidos e informações adicionais são compartilhados; o atalho **Abrir
ficha #…** consulta diretamente a ficha do cliente. Não existe etapa de vínculo.

A transição preserva os registros mensais, históricos e uma cópia do estado
antigo. Identidades não são fundidas pela posição na lista ou pelo nome. Veja
[CADASTRO_UNICO.md](CADASTRO_UNICO.md).

## Roteiro de validação manual

Use registros fictícios identificados como teste. A confirmação da versão recente
no notebook e no computador principal ainda depende do retorno do usuário.

1. Na versão atualizada do servidor, abrir **⋯ → Contabilidades** e cadastrar uma
   contabilidade fictícia. Criar um cliente fictício em **⋯ → Clientes** e vinculá-lo.
2. Editar esse cliente, trocar sua contabilidade e conferir o histórico. Os demais
   campos e vínculos devem permanecer. Testar os filtros de situação e contabilidade.
3. Em **Excel → Fichas dos Clientes**, buscar o cliente e cadastrar um apelido,
   uma anotação e um procedimento. Salvar, fechar e reabrir para conferir.
4. Criar um cliente fictício em **⋯ → Clientes**, incluí-lo no mês do Excel e
   conferir sua presença na ficha, com o mesmo ID. Alterar nome e apelidos em **Alterar Cliente** e
   informações adicionais na ficha; conferir as alterações na outra tela.
   Renomear deve manter os registros mensais e a ficha do mesmo cliente.
5. Digitar uma alteração sem salvar na ficha. Ao trocar de cliente, fechar ou usar Escape,
   cancelar a confirmação deve conservar o texto. Descartar deve exigir confirmação.
6. Na lista Excel, incluir um cliente fictício. Usar seu apelido
   na pesquisa, mudar status e observação, trocar o mês e retornar. O mês original
   deve conservar os valores e o outro mês manter os seus próprios registros.
7. Abrir **?**, clicar em **Alterar**, salvar informações adicionais e reler.
   As informações permanentes devem continuar separadas da observação mensal.
8. No computador principal, acessar o mesmo servidor pelo túnel já configurado.
   Conferir o texto salvo e alterá-lo. O notebook deve receber a atualização.
   Uma edição concorrente do mesmo campo deve pedir revisão e preservar o rascunho.
9. No Painel, criar uma pendência fictícia, mudar seu status, conferir o histórico
   e salvar uma mensagem. Repetir o mesmo valor não deve duplicar eventos no histórico.
   Alterações feitas pelos dois computadores devem registrar o valor anterior
   efetivo. Confirmar que abrir/fechar cadastros mantém o fluxo.
10. Reiniciar os serviços pelo Compose, preservando o projeto e o volume. Reabrir
   o sistema e conferir os registros salvos.
11. Executar o comando de backup no servidor e conferir **Backup concluido**.
    Copiar a pasta inteira para um dispositivo privado separado. Recuperação deve
    ser testada em ambiente separado, nunca sobre o banco de uso.
12. Excluir um cliente fictício pelo Excel e outro pelo Painel, conferindo ID e
    nome antes de confirmar. Cancelar deve mantê-lo. Confirmar deve retirá-lo das
    listas e totais nas duas visualizações. Testar também uma falha de conexão
    e uma observação pendente no outro computador, conforme o relatório da exclusão.
13. No Painel, digitar nos formulários de novo cliente, contabilidade, pendência
    e mensagem. Recusar o descarte pelo X, Escape ou recarga deve preservar o
    texto. Durante gravação, conferir bloqueio de fechamento e de troca para o
    Excel. Falha deve mostrar o erro na janela e permitir uma nova tentativa.
14. No Excel e no Painel, conferir as 13 opções da seleção rápida e usar −1/+1
    para voltar/avançar um mês, inclusive na virada do ano. Nos extremos, o botão
    correspondente deve ficar desabilitado. Registros antigos permanecem salvos.
15. Arrastar avisos pelo corpo do cartão com o mouse, recarregar e conferir a mesma ordem no outro
    computador. Testar também as setas do teclado. Xaxim Gás deve continuar
    presente e os três mercados prioritários devem permanecer no controle fixo.
16. Selecionar um aviso, conferir sua borda azul e abrir **Excluir Aviso**.
    Cancelar deve mantê-lo. A confirmação central com Excluir em vermelho deve
    retirá-lo da lista. A exclusão de cliente usa a mesma confirmação.
17. Reordenar os cards do Painel, trocar o estado no topo e alternar entre meses:
    a ordem manual deve permanecer. Conferir Histórico à esquerda e mensagem à
    direita. No controle dos mercados, testar apenas Pendente e Concluído.

Se um navegador ainda tiver registros antigos, seguir a importação explícita em
[COMPARTILHAMENTO_EXCEL.md](COMPARTILHAMENTO_EXCEL.md), guardando os originais e
revisando divergências. Não limpar o armazenamento do navegador para contornar erros.

## Critério de conclusão

Concluir a revisão automatizada, corrigir falhas encontradas e obter a validação
dos fluxos acima, incluindo o cadastro único, nos dois
computadores. Até esse retorno, a validação em uso permanece pendente.
Autenticação e publicação na Internet não fazem parte desta versão local.

## Meses rápidos e avisos — entrega autorizada

O usuário confirmou a atualização da etapa `e3be32b`. A implementação preparada
na branch `feature/meses-rapidos-ordem-avisos` tem publicação autorizada na branch
`teste/controle-basico-linux`: seletores compactos com seis meses anteriores e
seis posteriores, botões −1/+1 nas duas visualizações e ordenação compartilhada
dos avisos por arrasto. A validação nos computadores permanece pendente até a
execução dos atualizadores existentes.

**Pendência do usuário: enviar o layout definitivo dos botões −1 e +1.**
O estilo desses controles é provisório no Excel e no Painel. Também ficou
anotada uma futura consulta separada para meses fora da seleção rápida,
preservando todos os registros existentes. Detalhes em
[MESES_RAPIDOS_E_AVISOS.md](MESES_RAPIDOS_E_AVISOS.md).

## Cartões livres e confirmação de exclusões — entrega autorizada

A implementação da branch `feature/cartoes-livres-exclusao-status` tem publicação
autorizada na branch `teste/controle-basico-linux`: arrasto pelo corpo do cartão,
seleção azul e exclusão de avisos, confirmação central para exclusões, alternância
simples dos mercados e estados destacados no topo do Painel. A ordem padrão segue
o cadastro e a ordem manual vale em todos os meses, conforme confirmado pelo
usuário. A atualização e validação nos computadores ainda dependem da execução
dos atualizadores com backup. Detalhes em
[CARTOES_E_EXCLUSOES.md](CARTOES_E_EXCLUSOES.md).

## Mercados e inclusão no Painel — publicação autorizada

O usuário confirmou o funcionamento da última publicação e identificou dois
erros: alternar os mercados criava clientes comuns, e incluir no Excel não
criava a pendência no Painel. A correção está na branch
`fix/mercados-separados-inclusao-painel`, com publicação autorizada pelo usuário
em 27/11/2026 na branch `teste/controle-basico-linux`. O usuário
autorizou deixar os mercados gerados pelo erro apenas no controle fixo,
preservando seus cadastros e registros antigos. A inclusão mensal passa a
contemplar o Painel na mesma transação, com reparação das inclusões antigas
incompletas e sem sobrescrever pendências existentes. Detalhes em
[CORRECAO_MERCADOS_E_INCLUSAO.md](CORRECAO_MERCADOS_E_INCLUSAO.md).

## Estado único e consulta histórica — publicação autorizada

O usuário identificou que os estados ainda divergiam entre Excel e Painel e
pediu a correção seguida das próximas etapas e configurações. A implementação
na branch `fix/estado-unico-consulta-mensal` usa a pendência mensal como referência
única, protege o histórico e adiciona atualização automática do Painel.
O usuário autorizou em 27/11/2026 a publicação desta etapa na branch
`teste/controle-basico-linux`, usada pelos atualizadores com backup.
Também foi preparada a consulta separada **⋯ → Consultar meses antigos**, sem
ampliar a seleção rápida. A referência final dos botões −1/+1 continua pendente.
Detalhes e validação em
[ESTADO_UNICO_E_CONSULTA_MENSAL.md](ESTADO_UNICO_E_CONSULTA_MENSAL.md).
As próximas entregas da base de conhecimento e IA estão organizadas em
[BASE_CONHECIMENTO_PLANO.md](BASE_CONHECIMENTO_PLANO.md), ainda sem funcionalidades
de IA ativas. Novas alterações permanecem sem publicação automática.

## Seleção de aviso e atalho da ficha — publicação autorizada

Na branch `fix/aviso-selecionado-atalho-ficha`, Alterar Aviso abre o cartão
selecionado pela borda azul, usando seu ID, em vez do primeiro aviso da lista.
Sem seleção de um aviso editável, o botão fica desabilitado. Trocar o aviso no
formulário também atualiza a seleção do cartão; cancelar não grava alterações.
O atalho Abrir ficha mantém sua função e identificação do cliente, com texto
menor, fundo transparente e sem moldura. Apenas o frontend foi alterado, sem
mudanças no banco, na API ou nas configurações. O usuário autorizou em
27/11/2026 a publicação na branch `teste/controle-basico-linux`, usada pelos
atualizadores existentes com backup.

Validação: TypeScript/Vite aprovados e 14 cenários de navegador conferidos
(12 existentes de fichas, cartões, arrasto e exclusão; duas regressões novas
de edição do aviso selecionado). Os dois cenários novos foram reexecutados
depois do ajuste do nome do diálogo usado pelo teste. Todos os dados são fictícios,
em PostgreSQL descartável criado em `127.0.0.1:5433`; nenhum banco de uso foi acessado.

## Versão inicial 0.0.1 e separação do lote

O usuário definiu a versão atual como 0.0.1, ainda em desenvolvimento, e pediu
a revisão do README e a política de patches/minors. A branch `patch/versao-0-0-1`
registra essa base e inclui somente a correção de Salvar ficha fixo no rodapé,
com sucesso/erro visíveis, extraída do lote validado `33a019f`. A publicação
desse patch está autorizada pela nova regra. Os manifests e metadados de raiz
dos lockfiles passam a refletir a mesma versão, sem trocar dependências.

A funcionalidade de arrastar clientes no Excel continua preparada na branch
`minor/0-1-0-ordem-excel` e aguarda autorização como minor 0.1.0.
A base de conhecimento e IA continuam futuras. A fase do produto segue sendo
desenvolvimento, mesmo com verificações automatizadas e a branch de distribuição
com nome histórico `teste/controle-basico-linux`.

Validação da 0.0.1: 73 testes de backend aprovados, 18 cenários de fichas e
cadastro único verificados no Chromium, TypeScript/Vite aprovados, versões dos
manifests e lockfiles consistentes e dependências preservadas. O cenário de
homônimos foi reexecutado após a suíte de backend preparar os dados fictícios
de importação necessários. O botão fixo foi conferido em 1440 px e 390 px, com
erro e nova tentativa. A preparação usa somente PostgreSQL descartável em
`127.0.0.1:5433`, sem acessar bancos do usuário ou da empresa.

## Minor 0.1.0 — preparada, aguardando autorização

Após separar e publicar o patch 0.0.1 (`9db1493`, tag `v0.0.1`), o arrasto das
linhas do Excel foi isolado na branch `minor/0-1-0-ordem-excel`. A implementação
de aplicação é idêntica à validada em `33a019f`; os testes do rodapé e da ordem
foram separados em arquivos próprios. VERSION, manifests e metadados de raiz
dos lockfiles indicam 0.1.0 somente nessa branch preparada. Não houve alteração
das dependências. A publicação dessa minor ainda depende da autorização do usuário.

Verificações após separar: código de aplicação igual ao lote original validado,
consistência da versão 0.1.0, dependências preservadas, quatro cenários de rodapé
e arrasto aprovados e TypeScript/Vite aprovados. A branch da minor não foi enviada
à distribuição nem ao GitHub.
