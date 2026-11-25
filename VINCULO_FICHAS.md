# Vincular uma linha do Excel à ficha de um cliente

1. Cadastre o cliente em **⋯ → Clientes**, se ele ainda não existir no cadastro.
2. Na visão **Excel**, abra **Alterar Cliente** e selecione a linha desejada.
3. Em **Buscar ficha para vincular**, procure por nome, apelido, código do cadastro
   ou código do Confere já registrado na ficha.
4. Escolha a opção correta em **Ficha vinculada**. Cada opção mostra o código
   interno do cadastro; os nomes iguais permanecem separados.
5. Clique em **Salvar alteração**. A seleção não é gravada antes de salvar.
6. Na linha, use **Abrir ficha #…** para consultar ou editar a ficha escolhida.

Para trocar a ficha, escolha outra opção e salve. Para desvincular, escolha
**Sem ficha vinculada** e salve. Nenhuma dessas ações apaga a ficha ou seus dados.

O vínculo permanece ao renomear o cliente ou a linha, pois utiliza o ID do cadastro,
e é compartilhado pelos computadores que acessam a mesma API. Cada linha conserva
seus nomes, apelidos, informações adicionais, status e observações de cada mês.
A ficha conserva seus procedimentos, contabilidade, anotações e históricos.
Não há cópia automática de campos entre esses cadastros nem sincronização do
status mensal do Excel com as pendências do Painel.

Se outra pessoa alterar o mesmo vínculo antes de você salvar, a aplicação mostra
um conflito e conserva sua escolha. Confira o vínculo salvo, escolha **Usar vínculo
salvo** ou **Manter minha escolha após revisar** e salve novamente. Uma falha de
rede também conserva a seleção para nova tentativa.

O vínculo só pode apontar para um cliente existente. A importação de dados antigos
do navegador não importa identificadores de fichas de outro banco e conserva
os vínculos que já existem no servidor.

O recurso usa o estado compartilhado já existente no PostgreSQL. Não acrescenta
migrações ou modifica as tabelas de clientes e históricos. Os backups completos
do banco preservam os vínculos junto dos outros dados do Excel.
