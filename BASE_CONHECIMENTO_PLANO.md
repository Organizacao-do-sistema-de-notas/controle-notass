# Próxima etapa: base de conhecimento

Este documento organiza a implementação seguinte ao controle básico. A base
de conhecimento e o assistente de IA ainda não são funcionalidades disponíveis.

## Primeira entrega

Criar uma área própria no menu do sistema para consultar, cadastrar e revisar
procedimentos, instruções de instalação e respostas a dúvidas. Cada conteúdo
deve registrar título, descrição, etapas ordenadas, sistema, versão aplicável,
contexto de cliente e autor da revisão. Capturas de tela devem ser anexadas ao
procedimento correspondente, com descrição e armazenamento no ambiente local.

O conteúdo deve declarar se é geral ou específico de um cliente. A consulta
deve filtrar por sistema, versão e cliente antes de apresentar as instruções.
Quando a versão não for conhecida, deve pedir essa informação, sem escolher
automaticamente uma orientação de outra versão.

Separar rascunhos de conteúdos revisados. Edições devem conservar as revisões
anteriores e detectar alterações concorrentes. A remoção da lista deve preservar
o conteúdo no histórico e usar a confirmação central existente do sistema.

## Persistência e configuração

Usar tabelas próprias no PostgreSQL para documentos, revisões e anexos. A ficha
do cliente deve referenciar o mesmo ID de Cliente, sem criar outro cadastro ou
copiar informações confidenciais automaticamente. A estrutura compartilhada do
Excel permanece dedicada ao controle de notas e aos avisos.

A migração deve ser aditiva. A entrega deve incluir atualização das verificações
de backup e recuperação para abranger as tabelas e anexos novos antes de uso real.
O ambiente segue React/TypeScript, Node/Express, PostgreSQL e Docker, com imagens
e limites de anexos documentados e verificados em ambiente fictício.

## Entrega seguinte: assistente

Integrar somente conteúdos revisados e compatíveis com o contexto selecionado.
Cada resposta deve indicar os documentos e revisões consultados. Sem conteúdo
suficiente, o assistente deve explicar o que falta e pedir esclarecimentos.
Ele não deve alterar clientes, executar instalações ou enviar dados a outros
sistemas como efeito de uma consulta.

O provedor, modelo e forma de acesso à IA ainda precisam ser definidos. Chaves
devem existir somente no backend, fornecidas fora do Git e da interface pública.
Nenhuma configuração de IA ativa ou envio de dados externos é criado pelo plano.

## Validação prevista

- Cadastrar e revisar conteúdo fictício; recarregar e consultar em outro navegador.
- Distinguir instruções de clientes, sistemas e versões diferentes.
- Conferir conflito de revisão e preservação de anexos e históricos.
- Recuperar documentos e anexos de um backup em banco separado.
- Na fase de IA, verificar a correspondência entre resposta, contexto e fontes,
  além dos casos em que o conteúdo disponível é insuficiente.
