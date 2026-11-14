# Instalação por Git no Xubuntu — 14/11/2026

Branch de entrega: `instalacao/xubuntu-docker`, baseada em
`8b69dcf1cbff982ffbedb016eb72c02b4d4e07a3`, com o código local já validado
do projeto. A branch `feature/ficha-cliente-base`, seu PR #1 e a `main` foram
preservados. O envio desta branch atende ao pedido de disponibilizar o projeto
para clonagem, após falhas no download de arquivos pelo chat.

O usuário escolheu iniciar com banco vazio para testes. Nenhum backup, CSV,
cadastro real ou credencial local foi incluído na entrega. Os dados importados
continuam no PostgreSQL de desenvolvimento do Codex.

## Alterações desta etapa

- `INICIAR-LINUX.sh`: entrada Bash que chama o instalador pelo PowerShell.
- `scripts/windows/Configurar-Windows.ps1`: opção explícita `-BancoVazio`,
  sem dependência de backup; mantém a confirmação do destino local e a proteção
  contra sobrescrita de um banco já preenchido.
- `LEIA-ME-LINUX.md` e `README.md`: clonagem, instalação, reinício e diagnóstico.

Os demais arquivos de Docker, importação, ficha e apelidos vieram das alterações
locais já testadas e são necessários para entregar o estado atual do projeto.
O backend e o frontend não foram modificados nesta etapa. Os testes anteriores
estão registrados em `VALIDACAO_DOCKER.md` e `VALIDACAO_PR1.md`.

## Validação executada

PowerShell 7.5.4 e Bash foram usados no Docker/Linux do Codex, em um checkout
separado, projeto Compose `controle-notas-xubuntu-validacao`, portas 3004/5178
e um volume novo, sem conexão com o banco da empresa.

| Verificação | Resultado |
| --- | --- |
| Sintaxe Bash/PowerShell e diff | Sem erros |
| Clone sem backup e sem opção explícita | Recusado antes de criar configuração ou banco |
| Instalação com `--banco-vazio` | Configuração local gerada; PostgreSQL, API e Vite saudáveis |
| Banco inicial | Zero clientes e zero contabilidades |
| Prisma | Seis migrações aplicadas; nenhuma pendente; Client gerado |
| Compilação | TypeScript do backend e build do frontend aprovados |
| API | Cadastro fictício, apelido, procedimento, troca de contabilidade e histórico validados; entrada inválida recusada sem alterações |
| Navegador Chromium/Playwright | Excel e Painel acessíveis; busca por apelido, edição, salvamento e leitura após recarregar aprovados; nenhum erro de página |
| Avisos | Xaxim Gás e os três mercados prioritários preservados |
| Segunda execução | Conteúdo das dez tabelas preservado integralmente, comparado por quantidade e SHA-256 |
| Banco preenchido sem identificação | Recusado; nenhuma alteração nas tabelas |
| Modo vazio com pacote de backup presente | Recusado antes de restaurar ou alterar dados |
| Banco original do Codex | As dez tabelas permanecem iguais ao snapshot de 492 clientes |

O modo vazio identifica a instância e mantém um comprovante privado. A opção
não apaga cadastros em execuções posteriores. As senhas são geradas localmente;
`.env.docker`, `backend/importacoes/` e `dados/` permanecem ignorados pelo Git.

## Próximo passo no notebook

Executar os comandos de `LEIA-ME-LINUX.md`, criar um cliente fictício pelo
Painel e validar a navegação no navegador do Xubuntu. O teste desta etapa
foi feito em Linux no Codex; a combinação específica de Xubuntu, permissões
do Docker e navegador do notebook ainda depende da execução local.

A transferência dos dados reais fica para uma etapa posterior, conforme a
escolha de iniciar com banco vazio. A persistência em volume não substitui backup.
