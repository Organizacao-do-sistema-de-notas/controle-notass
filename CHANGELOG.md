# Histórico de versões

## 0.1.3 — patch em desenvolvimento

- Melhora a seleção de clientes na inclusão mensal do Painel com barra de pesquisa
  e resultados filtrados durante a digitação por nome, apelido e número do cadastro,
  ignorando acentos e maiúsculas. Exibe número, cliente e contabilidade na tabela.
- Exige escolher explicitamente o cadastro; mudar a pesquisa limpa a seleção
  anterior sem apagar competência, status, responsável ou observação.
- Altera o exemplo de Observação interna para
  “EX: esse cliente precisa se fazer tal coisa especifica”.

## 0.1.2 — patch em desenvolvimento

- Corrige a piscada e o salto de rolagem ao alterar estados no Painel: os cartões
  permanecem montados durante a atualização do mês aberto, inclusive em Atualizar.
- Ao mudar de competência, oculta cartões e totais do mês anterior, inclusive se
  a consulta falhar, preservando os avisos de erro e a possibilidade de repetir.
- Acrescenta regressões de rolagem, ordem, atualização lenta, falhas e troca de mês
  em dados fictícios, com validação em computador e celular.

## 0.1.1 — patch em desenvolvimento

- Remove os indicadores laterais de arrasto no Excel, no Painel e nos avisos,
  preservando o movimento pelo quadro, por toque no nome/título e pelo teclado.
- Renomeia Nova pendência para Incluir cliente +, com seleção de cliente existente.
  Novos clientes e contabilidades ficam no menu superior ⋯, sem atalhos duplicados.
- Reforça as cores de Aguardando cliente, Em atendimento e Concluído; o filtro
  Status acompanha a cor escolhida e o cartão concluído recebe contorno verde.
- Atualiza o README e os metadados de versão, sem alteração de schema ou dependências.

## 0.1.0 — minor em desenvolvimento

- Arrastar as linhas de clientes do Excel, com ordem própria salva para todos
  os meses e computadores, incluindo filtros, teclado e proteção de rascunhos.
- Publicação autorizada pelo usuário na branch de distribuição
  `teste/controle-basico-linux`.

## 0.0.1 — versão inicial em desenvolvimento

- Define a numeração inicial e a política: patches com publicação autorizada;
  minors com autorização antes de publicar.
- Corrige a posição de Salvar ficha: o botão e o resultado da gravação ficam
  sempre visíveis no rodapé, inclusive no celular.
- Atualiza o README para a fase e as funcionalidades atuais.
- Consolida a base já existente: cadastro único, lista mensal do Excel,
  sincronização dos estados com o Painel, fichas, mensagens e históricos,
  avisos selecionáveis e arrastáveis, exclusão com confirmação, controle fixo
  dos mercados, consulta de meses antigos e atualizadores com backup.

Os commits anteriores à adoção desta numeração continuam no Git. As versões
antigas dos manifests eram metadados de criação dos pacotes e não representavam
releases estáveis do produto.
