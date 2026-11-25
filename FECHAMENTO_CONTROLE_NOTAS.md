# Fechamento da versão básica do controle-notass

A prioridade atual é concluir e validar o controle de notas. Base de conhecimento,
integrações de IA e automação de instalações ficam para uma etapa futura.

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

## Vínculo manual entre Excel e fichas

Em 25/11/2026, o usuário escolheu permitir o vínculo manual de cada linha do Excel
com uma ficha central. A escolha é feita em **Excel → Alterar Cliente** e salva
junto das alterações da linha. O atalho **Abrir ficha #…** consulta a ficha pelo ID.
Empresas com nomes iguais são identificadas pelo código do cadastro.

Vincular, trocar e desvincular preserva os campos dos dois cadastros, os registros
mensais e os históricos. Não há associação automática por nome, importação de
clientes reais ou acesso ao banco do Confere. Veja [VINCULO_FICHAS.md](VINCULO_FICHAS.md).

## Roteiro de validação manual

Use registros fictícios identificados como teste. A confirmação da versão recente
no notebook e no computador principal ainda depende do retorno do usuário.

1. Na versão atualizada do servidor, abrir **⋯ → Contabilidades** e cadastrar uma
   contabilidade fictícia. Criar um cliente fictício em **⋯ → Clientes** e vinculá-lo.
2. Editar esse cliente, trocar sua contabilidade e conferir o histórico. Os demais
   campos e vínculos devem permanecer. Testar os filtros de situação e contabilidade.
3. Em **Excel → Fichas dos Clientes**, buscar o cliente e cadastrar um apelido,
   uma anotação e um procedimento. Salvar, fechar e reabrir para conferir.
4. Em **Excel → Alterar Cliente**, selecionar a linha fictícia e escolher a ficha
   correta em **Ficha vinculada**. Salvar, abrir a ficha pelo atalho da linha e
   conferir os dados. Desvincular selecionando **Sem ficha vinculada** e confirmar
   que os meses, observações e a ficha permanecem intactos.
5. Digitar uma alteração sem salvar na ficha. Ao trocar de cliente, fechar ou usar Escape,
   cancelar a confirmação deve conservar o texto. Descartar deve exigir confirmação.
6. Na lista Excel, incluir um cliente fictício próprio dessa visão. Usar seu apelido
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
dos fluxos acima, incluindo o vínculo manual, nos dois
computadores. Até esse retorno, a validação em uso permanece pendente.
Autenticação e publicação na Internet não fazem parte desta versão local.
