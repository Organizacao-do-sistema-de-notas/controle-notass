# Atualizar o servidor Linux existente

Distribuição de desenvolvimento na branch `teste/controle-basico-linux`, nome
histórico mantido pelos atualizadores. A versão inicial é 0.0.1. Patches têm
publicação autorizada após validação; minors exigem autorização antes de
publicar, conforme [VERSIONAMENTO.md](VERSIONAMENTO.md). A main permanece separada.

Esta branch reúne o cadastro único, a exclusão de clientes nas duas telas e a
proteção dos formulários do Excel/Painel, incluindo o commit de aplicação
`e48bee5`. As descrições de “ainda não publicado” nos relatórios anteriores se
referem à etapa de preparação desses commits.

## Preparação

Usar a pasta **já instalada** no Linux, conservando `.env.docker`, o arquivo
privado de identificação em `backend/importacoes` e o projeto/volume Docker.
Não clonar uma segunda instalação para atualizar o banco existente.
Git, Docker Compose e `pwsh` são as ferramentas da instalação original.

Salvar os formulários abertos antes de atualizar. A API e o frontend ficarão
parados durante a reconstrução. O PostgreSQL permanece no volume existente.

O clone original usava `--single-branch`. O bloco abaixo busca a referência nova
explicitamente; não depende de o clone já conhecer essa branch ou ter upstream.
Ele recusa alterações locais ou uma branch de testes divergente, sem descartá-las.

## Comandos

Abrir o terminal dentro da pasta atual do projeto e executar o bloco completo:

```bash
git fetch origin refs/heads/teste/controle-basico-linux:refs/remotes/origin/teste/controle-basico-linux &&
bash <(git show refs/remotes/origin/teste/controle-basico-linux:ATUALIZAR-LINUX.sh)
```

O script `ATUALIZAR-LINUX.sh` é lido diretamente da referência buscada no Git,
permitindo iniciar a atualização antes de ele existir no checkout antigo. Ele
confere o repositório, arquivos locais, configuração e branch, para somente a
API/frontend, troca os arquivos com fast-forward e executa o backup.

O backup é executado após a troca dos arquivos, com a aplicação parada e **antes
de qualquer migração**. Isso permite usar o comando de backup mesmo em uma
instalação antiga que ainda não o possuía. Ele verifica o Docker local, o nome do
projeto, o container, o volume e o PostgreSQL `controle_notas`. A mensagem
**Backup concluido** confirma o índice e o checksum da cópia privada. Uma falha
interrompe a sequência antes da inicialização do backend novo.

O comando do backend aplica as migrações no banco local configurado, usando
`migrate deploy`. Ao final, são esperadas **nove migrações aplicadas**, schema
atualizado e serviços `healthy`. Nenhum reset, db push ou remoção de volume é
necessário. As imagens do backend e frontend são atualizadas juntas.

O bloco preserva as portas existentes. Abrir o mesmo endereço que já funcionava
no Linux, ou usar o túnel existente no outro computador. Não compartilhar
`.env.docker` nem os backups; eles são privados.

Se houver interrupção, guardar a mensagem de erro e a pasta do backup antes de
planejar a recuperação. O formato novo do Excel e a exclusão exigem o backend
correspondente; trocar somente para código antigo não é um rollback completo.

## Testar depois da atualização

1. Conferir os cadastros e os dados anteriores, incluindo Xaxim Gás e mercados.
2. Criar um cliente fictício e conferir o mesmo ID no Excel e na ficha.
3. Alterar nome, apelidos, contabilidade e informações adicionais; conferir nas
   outras telas. O estado deve coincidir no Excel e no Painel da mesma competência;
   os registros de meses diferentes devem continuar separados.
4. No Painel, criar uma pendência e uma mensagem; testar salvamento e histórico.
5. Digitar sem salvar e recusar o descarte ao fechar. Testar também Escape,
   recarga e fechamento durante salvamento, nas duas visualizações.
6. Excluir somente um cadastro fictício: conferir nome e ID, cancelar uma vez e
   depois confirmar. Ele deve sair das telas, com registros guardados no banco.

Se aparecer **Importar dados deste navegador**, seguir
[COMPARTILHAMENTO_EXCEL.md](COMPARTILHAMENTO_EXCEL.md) no navegador que contém os
registros antigos. Não limpar o armazenamento para contornar a atualização.
Um backup PostgreSQL não inclui dados ainda guardados somente no navegador.

O roteiro completo e as verificações anteriores ficam em
[FECHAMENTO_CONTROLE_NOTAS.md](FECHAMENTO_CONTROLE_NOTAS.md). A confirmação da
atualização física no servidor do usuário depende da saída dos comandos acima.
