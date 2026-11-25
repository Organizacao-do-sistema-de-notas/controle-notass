# Um cadastro de cliente para todas as telas

Cadastre a empresa uma única vez em **Excel → Incluir Cliente**, **⋯ → Clientes**
ou **Painel → Novo cliente**. O mesmo cliente aparece automaticamente no Excel,
nas fichas e no menu Clientes. Cada cliente tem um ID próprio; ordenar ou filtrar
a lista não muda sua identidade.

Em **Excel → Alterar Cliente**, nome, apelidos e informações adicionais alteram
o próprio cadastro. O botão **?** e o campo **Informações adicionais** da ficha
mostram o mesmo conteúdo. O atalho **Abrir ficha #…** abre diretamente a ficha
correta. Não é necessário escolher, vincular ou desvincular uma ficha.

A revisão local permite **Excluir cliente** tanto no Excel quanto no Painel.
A ação retira o mesmo ID das telas e conserva os registros no banco, conforme
[EXCLUSAO_CLIENTES.md](EXCLUSAO_CLIENTES.md). Essa revisão ainda não foi publicada.

As informações adicionais permanecem separadas das anotações permanentes já
existentes e das observações de cada mês. Procedimentos, contabilidade e seus
históricos são preservados. O acompanhamento mensal e o comportamento do Painel
continuam os mesmos.

## Atualização entre computadores

O Excel verifica atualizações a cada dois segundos. A lista e a ficha aberta
também se atualizam quando não há rascunho ou gravação em andamento. Enquanto
alguém edita, os campos não são substituídos por uma atualização remota.
Uma tentativa de salvar informações ou apelidos que mudaram em outro computador
solicita revisão e conserva o rascunho. Recarregar a ficha pede confirmação antes
de descartar alterações não salvas.

## Dados da versão anterior

A transição é automática e acontece em uma transação do PostgreSQL:

- Reutiliza os IDs de vínculos já confirmados na versão anterior.
- Converte linhas antigas efetivamente salvas em clientes do cadastro único.
- Preserva meses, observações, informações, procedimentos e históricos.
- Guarda uma cópia integral do estado anterior do Excel junto do estado atual.
- Mantém as três prioridades fixas e o aviso Xaxim Gás.

Os exemplos que existiam apenas na lista fixa da interface não são importados
como empresas reais. A lista agora reflete os clientes salvos no banco.

Cadastros antigos independentes com nomes iguais são preservados como registros
distintos. A transição não presume que sejam a mesma empresa. Se duas linhas já
ligadas ao mesmo ID tiverem registros mensais diferentes, a operação é interrompida
para revisão, preservando os dados originais. Não escolhe um status ou descarta uma
observação para resolver a diferença.

## Instalação da atualização

Atualize backend e frontend juntos. A migração `20261125090000_cadastro_unico`
acrescenta apenas a coluna opcional de informações adicionais em `Cliente`.
O banco, o projeto Compose, o volume e `.env.docker` existentes são preservados.

O estado do Excel consolidado usa a versão 2 do formato de armazenamento. Para
retornar a uma versão antiga da aplicação depois da consolidação, é necessário
planejar a recuperação com uma cópia anterior do banco; trocar apenas a branch
não restaura o formato antigo. O backup completo inclui o estado atual e sua
cópia de origem. Nenhum comando de reset ou remoção de volume é necessário.
