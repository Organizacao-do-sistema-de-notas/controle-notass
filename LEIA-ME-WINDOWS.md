# Levar o Controle de Notas para o Windows

Este pacote privado contém o código atual do projeto, o backup completo do
PostgreSQL local do Codex e os arquivos de origem da importação. Os dados do
Confere foram trazidos por CSV; este instalador usa somente o PostgreSQL do
Docker Desktop local.

## Preparar o computador

1. Instale o [Docker Desktop](https://www.docker.com/products/docker-desktop/).
2. Ative o backend WSL 2 e o modo **Linux containers**. Reinicie o Windows se o
   instalador do Docker solicitar e aguarde o Docker Desktop ficar pronto.
3. Extraia o ZIP inteiro para uma pasta local, por exemplo
   `C:\Projetos\controle-notas`. Execute os arquivos extraídos, fora do ZIP.

Não precisa instalar Node, PostgreSQL, Python ou Git para iniciar este pacote.
A primeira construção precisa de Internet para baixar imagens e dependências.

## Iniciar

Dê dois cliques em **INICIAR-WINDOWS.bat**.

O instalador:

- verifica o Docker Desktop local e o checksum SHA-256 do backup;
- gera `.env.docker` com uma senha local aleatória, sem exibi-la;
- inicia o PostgreSQL e confirma que o banco está vazio;
- restaura em uma única transação, sem apagar tabelas ou dados existentes;
- compara quantidade e SHA-256 do conteúdo das dez tabelas com o manifesto;
- constrói e inicia backend e frontend, verifica as migrações e consulta a API;
- abre o sistema em `http://localhost:5173` por padrão.

Acesse **Excel → Fichas dos Clientes** para visualizar os clientes importados.
Em **Pesquisar por**, escolha **Nome e apelidos** ou **Somente apelidos**. Para
cadastrar apelidos da equipe, use **Outros nomes para pesquisa**, um por linha,
e salve a ficha. O código do Confere ajuda a distinguir nomes iguais.

O backup preserva o cadastro central, fichas, nomes alternativos, contabilidades,
procedimentos e históricos presentes no PostgreSQL. Os status e observações da
visão Excel antiga continuam no armazenamento do navegador em que foram usados.
Esses registros de navegador têm exportação separada e não fazem parte do backup
PostgreSQL.

## Reiniciar depois

Pode executar **INICIAR-WINDOWS.bat** novamente. O instalador reconhece a
restauração pelo arquivo local de controle e pela identidade da instância
PostgreSQL. Ele preserva as alterações feitas depois da primeira instalação.

Também pode usar o PowerShell na pasta do projeto:

```powershell
docker compose --env-file .env.docker up --build -d --wait
docker compose --env-file .env.docker down
```

O volume mantém os dados após parar/recriar os containers. Preserve `.env.docker`,
`backend/importacoes/restauracao_windows.json` e o volume. Não use
`down --volumes` para uma parada normal. Um volume persistente não substitui backup.

## Portas ocupadas ou outro projeto

Para a configuração inicial, abra o PowerShell na pasta extraída e execute:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\Configurar-Windows.ps1 -NomeProjeto controle-notas-local -PortaApi 3003 -PortaFrontend 5177
```

A opção de execução vale somente para esse processo do PowerShell, sem alterar a
política global do Windows. Políticas administrativas da empresa continuam se
aplicando. Os parâmetros de portas são usados ao gerar a configuração inicial;
se `.env.docker` já existe, seus valores são preservados. Edite as portas nele
para mudar uma instalação existente e mantenha seu nome de projeto.

Se houver um banco já preenchido sem o comprovante desta restauração, o script
interrompe a operação. Ele não usa `--clean`, reset, db push nem remove volumes.
Escolha uma pasta/configuração separada e outro nome de projeto para criar uma
cópia independente, em vez de sobrescrever um banco existente.

## Arquivos e versionamento

- Código e instruções: raiz do pacote, `backend/`, `frontend/` e `scripts/`.
- Backup: `dados/controle_notas.dump`.
- Manifesto/checksum e conteúdo esperado das tabelas: `dados/manifesto_backup.json`.
- Originais: `dados/origem/`; o instalador copia os arquivos ausentes para a pasta
  privada `backend/importacoes/` sem sobrescrever arquivos existentes.
- Identificação do código e hashes dos arquivos: `ORIGEM_DO_PACOTE.json`.

Este é um retrato do código que estava na branch `feature/ficha-cliente-base`,
incluindo alterações locais ainda não enviadas ao GitHub. Não inclui `.git`,
`node_modules`, código gerado ou senhas do Codex. A senha do Windows é criada
localmente. As pastas `dados/` e `backend/importacoes/` são ignoradas pelo Git e
pelos contextos Docker; mantenha o pacote de dados e seus backups em local privado.

A instalação foi validada em Docker/Linux com PowerShell. A execução nativa do
arquivo BAT e o Docker Desktop do seu Windows dependem desta etapa no seu
computador; envie a mensagem exibida se encontrar algum erro.
