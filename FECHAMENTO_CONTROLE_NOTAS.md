# Fechamento da versão básica do controle-notass

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
4. Criar um cliente fictício no Excel e conferir sua presença no menu Clientes
   e na ficha, com o mesmo ID. Alterar nome e apelidos em **Alterar Cliente** e
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

Se um navegador ainda tiver registros antigos, seguir a importação explícita em
[COMPARTILHAMENTO_EXCEL.md](COMPARTILHAMENTO_EXCEL.md), guardando os originais e
revisando divergências. Não limpar o armazenamento do navegador para contornar erros.

## Critério de conclusão

Concluir a revisão automatizada, corrigir falhas encontradas e obter a validação
dos fluxos acima, incluindo o cadastro único, nos dois
computadores. Até esse retorno, a validação em uso permanece pendente.
Autenticação e publicação na Internet não fazem parte desta versão local.
