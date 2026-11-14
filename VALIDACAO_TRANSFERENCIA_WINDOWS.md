# Transferência privada para Windows — 13/11/2026

Preparado na branch `feature/ficha-cliente-base`, sem commit, push, merge ou
publicação. O pacote inclui o código atual, inclusive as alterações locais,
um backup PostgreSQL custom e os originais da importação em uma pasta privada.
Não contém credenciais do Codex, `.git`, dependências ou código gerado.

## Arquivos desta etapa

- `INICIAR-WINDOWS.bat`: entrada pelo Windows PowerShell.
- `scripts/windows/Configurar-Windows.ps1`: configuração e restauração segura.
- `scripts/windows/estado-banco.sql`: identifica a instância local e banco vazio.
- `scripts/windows/validar-dados.sql`: quantidade e SHA-256 das dez tabelas.
- `scripts/preparar-pacote-windows.py`: empacota o código atual, os dados
  explicitamente selecionados, os checksums e a identificação da versão.
- `LEIA-ME-WINDOWS.md` e `README.md`: instalação e operação local.
- `.gitignore` e `.dockerignore`: excluem a pasta privada `dados/`.
- `compose.yaml`: verificações de saúde consomem a resposta HTTP completa.

Nenhuma funcionalidade, regra de negócio ou tela foi alterada nesta etapa.

## Verificações executadas

O instalador foi executado com PowerShell 7.5.4 e Docker/Linux em uma pasta
extraída do ZIP, usando o projeto separado
`controle-notas-transferencia-validacao`, as portas 3003/5177 e um volume novo.
O banco original e o banco do Confere não foram alterados.

| Verificação | Resultado |
| --- | --- |
| Sintaxe do PowerShell | Sem erros |
| Backup consistente | Conteúdo das dez tabelas igual antes e depois da exportação |
| Restauração em banco vazio | Concluída em uma transação, sem limpeza ou remoção de dados |
| Conteúdo restaurado | Quantidades e hashes das dez tabelas iguais aos da origem |
| Cadastros e contabilidades | 492 clientes, sendo 491 importados, e 86 contabilidades |
| Fichas e apelidos importados | 491 fichas consultadas; 396 nomes alternativos importados preservados |
| Migrações | Seis existentes; banco atualizado, sem migrações pendentes |
| Backend | Prisma Client gerado; TypeScript aprovado; API saudável |
| Frontend | Build aprovado; Vite saudável e apontando para a porta correta da API |
| Comunicação | Raiz da API, clientes, contabilidades e fichas responderam; CORS validado |
| Segunda execução | Reconheceu a restauração e preservou todas as tabelas, inclusive uma edição em cadastro sintético na cópia de testes |
| Banco preenchido sem comprovante | Operação recusada; conteúdo das tabelas permaneceu igual |
| Checksum de backup divergente | Operação recusada antes de restaurar; conteúdo das tabelas permaneceu igual |

Durante a validação, a contagem exibida pela consulta da API foi corrigida:
o PowerShell tratava o resultado JSON como um único item do pipeline. A mensagem
passou a mostrar os 492 clientes retornados. Os dados estavam corretos.

Na checagem final, a API original respondeu normalmente, mas seu healthcheck
excedeu cinco segundos: a resposta de `/clientes` não era consumida pelo processo
Node. A consulta com leitura completa terminou em 108 ms. Os healthchecks do
backend e do frontend passaram a consumir a resposta antes de sair, evitando
que uma resposta maior mantenha o processo aberto. A configuração foi aplicada
e verificada nos serviços locais; o conteúdo do banco permaneceu inalterado.

Os testes anteriores de funcionalidades continuam documentados em
`VALIDACAO_PR1.md` e `VALIDACAO_DOCKER.md`; não houve mudança no código da
aplicação nesta etapa. O teste de transferência consultou todas as fichas
importadas, sem editar clientes reais. A única edição foi no cadastro sintético
da cópia restaurada, para verificar a preservação na segunda execução.

## Limites e execução no Windows

A execução nativa do BAT, Windows PowerShell 5.1, Docker Desktop e WSL 2 depende
do computador do usuário e ainda precisa ser confirmada nele. O script evita
recursos específicos do PowerShell 7, mas o teste realizado usou PowerShell 7
no Linux. A seleção do Docker Desktop por named pipe foi revisada; esse caminho
é exclusivo do Windows e não foi executado no Codex.

Extraia o pacote completo, inicie o Docker Desktop em Linux containers e execute
`INICIAR-WINDOWS.bat`. O guia `LEIA-ME-WINDOWS.md` descreve portas, reinício e
preservação do volume. O pacote contém dados reais e deve ficar em local privado.

Os registros antigos da visualização Excel mantidos no localStorage dependem
do navegador em que foram usados e não fazem parte do backup PostgreSQL.
