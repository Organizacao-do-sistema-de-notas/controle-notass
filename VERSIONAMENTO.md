# Versões e publicação

A versão inicial do Controle de Notas é **0.0.1**, conforme definido pelo usuário.
O produto está em desenvolvimento, em uma versão preliminar/beta. Não há release
estável nem fase de homologação concluída. Os testes automatizados fazem parte
do desenvolvimento e não alteram essa classificação.

`VERSION` contém a versão do sistema. Os manifests de frontend e backend e os
metadados de raiz dos respectivos lockfiles devem refletir a mesma versão.
As versões das dependências são independentes.

| Tipo | Critério | Exemplo | Publicação |
| --- | --- | --- | --- |
| Patch | Corrigir comportamento existente ou ajustar sua usabilidade, sem acrescentar funcionalidade | 0.0.1 → 0.0.2 | Autorizada pelo usuário sem nova pergunta, após validação adequada |
| Minor | Acrescentar funcionalidade ao sistema | 0.0.1 → 0.1.0 | Preparar e validar; pedir autorização antes de publicar |

Uma minor inicia seu contador de patch em zero. Mudanças incompatíveis ou a
passagem para uma versão estável serão combinadas quando forem necessárias.

## Fluxo

1. Identificar se o pedido é patch ou minor. Separar correções de funcionalidades
   novas quando estiverem no mesmo lote.
2. Implementar em branch própria e executar as verificações adequadas à mudança.
3. Atualizar a versão e o changelog para a entrega correspondente.
4. Para patches, publicar diretamente. Para minors, apresentar o resultado e
   perguntar se pode publicar; a aprovação se refere à entrega preparada.
5. Publicar na branch `teste/controle-basico-linux`, por fast-forward e push normal.
   Confirmar o commit no GitHub e informar os comandos dos atualizadores.

O nome da branch é histórico; o projeto continua em desenvolvimento. O assistente
publica o código no GitHub, e a instalação é atualizada quando o usuário executa
o comando em seu computador. Os scripts existentes conservam configuração,
portas e volume e fazem backup antes de iniciar a versão nova.

A política e as ferramentas de segurança de atualização serão revistas quando
o projeto avançar, conforme combinado. As proteções existentes de preservação
de dados e backup continuam em uso.

## Primeira versão e lote separado

Esta entrega estabelece a numeração **0.0.1** para a base atual e incorpora o
patch de Salvar ficha sempre visível no rodapé. A documentação foi atualizada
para a situação real do projeto.

O arrasto dos clientes no Excel é uma funcionalidade nova, classificada como
minor. A implementação está preparada na branch
`minor/0-1-0-ordem-excel` e depende de autorização para publicação
como **0.1.0**. O patch do botão não depende dessa funcionalidade.
