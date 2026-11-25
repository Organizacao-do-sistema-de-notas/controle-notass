# Fechamento da versão básica do controle-notass

A prioridade atual é concluir e validar o controle de notas. Base de conhecimento,
integrações de IA e automação de instalações ficam para uma etapa futura.

Em 25/11/2026, o cadastro único foi publicado na branch
`feature/cadastro-unico-clientes`, commit `61e230a`. A revisão seguinte dos
rascunhos de formulários está somente na branch local
`feature/revisao-formularios-basicos`, sem publicação, e aguarda o próximo lote
de testes. Veja [REVISAO_FORMULARIOS_BASICOS.md](REVISAO_FORMULARIOS_BASICOS.md).

## Escopo da versão básica

| Fluxo | O que conferir |
| --- | --- |
| Instalação e atualização | Docker inicia PostgreSQL, API e frontend; configuração e volume existentes são preservados |
| Clientes e contabilidades | Criar, pesquisar, editar, ativar/inativar, vincular/desvincular contabilidade e consultar histórico |
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

Se um navegador ainda tiver registros antigos, seguir a importação explícita em
[COMPARTILHAMENTO_EXCEL.md](COMPARTILHAMENTO_EXCEL.md), guardando os originais e
revisando divergências. Não limpar o armazenamento do navegador para contornar erros.

## Critério de conclusão

Concluir a revisão automatizada, corrigir falhas encontradas e obter a validação
dos fluxos acima, incluindo o cadastro único, nos dois
computadores. Até esse retorno, a validação em uso permanece pendente.
Autenticação e publicação na Internet não fazem parte desta versão local.
