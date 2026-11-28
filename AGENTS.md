# Instruções do projeto

O sistema está em desenvolvimento. A versão inicial definida pelo usuário é
`0.0.1`; consulte `VERSION`, `VERSIONAMENTO.md` e `CHANGELOG.md`.

- O usuário autorizou implementar, validar e publicar **patches** (correções e
  ajustes de usabilidade sem funcionalidade nova) sem perguntar novamente.
  Depois, fornecer os comandos para atualizar Windows e Linux.
- Para **minors** (funcionalidades novas), preparar a implementação e validá-la
  em branch separada; apresentar a entrega concreta e pedir autorização antes
  de publicar na branch de distribuição.
- Separar lotes mistos: publicar o patch autorizado e manter a funcionalidade
  nova pendente da autorização de minor.
- A distribuição atual usa `teste/controle-basico-linux`, nome histórico usado
  pelos atualizadores. Ele não indica a fase do produto. Não fazer merge na main
  nem force push.
- Preservar dados, `.env.docker`, projeto e volume Docker. Continuar usando os
  atualizadores com backup; não adicionar novas etapas de segurança de releases
  sem necessidade da tarefa. Os testes devem usar dados fictícios em banco isolado.

Essas regras registram instruções do usuário e substituem anotações antigas
que exigiam autorização para publicar qualquer alteração.
