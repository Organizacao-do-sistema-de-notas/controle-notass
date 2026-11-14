# Instalar no Xubuntu por comandos

Esta instalação usa Docker Engine com Compose e PowerShell (`pwsh`). Node,
PostgreSQL e as dependências do projeto ficam nos containers. O usuário atual
precisa conseguir acessar o Docker local por `/var/run/docker.sock`.

## Clonar e iniciar com banco vazio

Confira as ferramentas:

```bash
git --version
docker info --format '{{.ServerVersion}}'
docker compose version
pwsh --version
```

Se Git ainda não estiver instalado, instale-o com o gerenciador do Xubuntu:

```bash
sudo apt update
sudo apt install git
```

Clone em uma pasta nova. O comando não sobrescreve pastas existentes:

```bash
git clone --branch instalacao/xubuntu-docker --single-branch https://github.com/Organizacao-do-sistema-de-notas/controle-notass.git controle-notas-xubuntu
cd controle-notas-xubuntu
bash ./INICIAR-LINUX.sh --banco-vazio
```

Se o GitHub solicitar autenticação, use uma conta com acesso ao repositório.
A senha comum da conta não funciona como senha Git por HTTPS; use o fluxo de
autenticação do GitHub ou GitHub CLI. Não coloque tokens na URL nem compartilhe
credenciais neste chat.

O instalador cria `.env.docker` com senha aleatória, confirma o banco local,
aplica as seis migrações, gera o Prisma Client, verifica o TypeScript, compila
o frontend e inicia os três serviços. Na primeira instalação a Internet é
necessária para baixar imagens e dependências.

Quando aparecer **Sistema pronto**, abra <http://localhost:5173>.

O banco começa **sem clientes e contabilidades**. Use cadastros fictícios nos
testes. Os registros reais importados continuam no ambiente Codex; esta branch
não inclui backups, CSVs, senhas locais ou dados de clientes. A visualização
Excel antiga pode mostrar os exemplos locais que já fazem parte da aplicação;
eles não indicam uma importação no PostgreSQL.

## Reiniciar e preservar os testes

```bash
bash ./INICIAR-LINUX.sh --banco-vazio
```

O parâmetro escolhe o modo inicial; não esvazia o banco nas próximas execuções.
O instalador reconhece o volume pelo projeto, pela identidade da instância e
pelo arquivo privado `backend/importacoes/restauracao_windows.json`. Preserve
esse arquivo, `.env.docker` e o nome do projeto. Um banco preenchido que não
tenha a identificação esperada é recusado sem sobrescrita.

Para parar:

```bash
docker compose --env-file .env.docker down
```

Para retomar sem reconstruir:

```bash
docker compose --env-file .env.docker up -d --wait
```

Os dados permanecem no volume. Não use `down --volumes`, `migrate reset` ou
`db push` para uma parada ou atualização normal.

## Portas ocupadas

Antes da primeira execução, escolha portas e um projeto próprios:

```bash
bash ./INICIAR-LINUX.sh --banco-vazio -NomeProjeto controle-notas-xubuntu -PortaApi 3003 -PortaFrontend 5177
```

Se `.env.docker` já existe, ele é preservado. Para mudar uma instalação existente,
edite somente as portas nesse arquivo e mantenha o nome original do projeto.

## Backup e diagnóstico

Para uma futura instalação com backup, use uma pasta/projeto separado e os
arquivos privados do pacote, conforme `LEIA-ME-WINDOWS.md`. Execute então
`bash ./INICIAR-LINUX.sh` sem `--banco-vazio`. O modo vazio recusa um pacote que
já contenha backup, para evitar uma inicialização diferente da pretendida.

Se houver erro, guarde a mensagem e o resultado de:

```bash
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs --tail 80 backend frontend db
```

Não compartilhe `.env.docker` nem a saída de `docker compose config` sem
`--quiet`, pois podem conter a senha local. Os status e observações antigos do
Excel continuam no armazenamento do navegador e não fazem parte do PostgreSQL.
