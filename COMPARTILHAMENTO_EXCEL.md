# Controle Excel compartilhado entre os computadores

O notebook continua sendo o servidor: Docker mantém frontend, API e PostgreSQL.
O computador principal acessa essa mesma instância, por exemplo pelo túnel SSH
já utilizado. O notebook precisa estar ligado, com os serviços e a conexão ativos.

## O que é compartilhado

- Clientes incluídos na visão Excel e seus nomes/apelidos.
- Informações adicionais do botão **?**.
- Status e observações de cada mês.
- Avisos adicionais.

Esses dados ficam na tabela `ExcelCompartilhado`, incluída nos backups do
PostgreSQL. As preferências de visualização/mês são individuais de cada navegador.
O menu Clientes e as fichas centrais mantêm os próprios cadastros; o Excel não
associa empresas automaticamente por semelhança de nomes.

## Atualizar o servidor

Na pasta do projeto do notebook, depois de obter a branch de atualização aprovada,
reconstrua com a configuração local existente:

```bash
docker --host unix:///var/run/docker.sock compose --env-file .env.docker up --build -d --wait
```

O backend aplica a migração `20261114180000_excel_compartilhado`, que apenas cria
uma tabela. As tabelas e linhas existentes são preservadas. Mantenha `.env.docker`,
o nome do projeto e o volume atual. Não use reset, db push ou remoção de volumes.

## Importar os dados que estavam no navegador

1. Abra a visão **Excel** no navegador em que os registros antigos foram usados.
2. Quando o aviso aparecer, use **Baixar cópia dos dados locais** para guardar
   um JSON privado, se desejar uma cópia externa.
3. Clique em **Importar dados deste navegador**.
4. Confira o resultado. Dados ausentes entram no banco. Valores diferentes já
   existentes no banco permanecem, e a tela mostra as divergências para revisão.
5. Repita nos outros navegadores que tenham registros próprios.

Os originais permanecem nas chaves antigas de localStorage. O sistema não volta
a gravar dados de negócio nessas chaves depois da atualização. Se houver uma
divergência, confira as duas versões na tela e copie o conteúdo desejado para
o formulário ou observação correspondente; o JSON conserva os dados de origem.

## Usar o botão de informações

Clique no **?** ao lado da observação. A janela mostra uma caixa com o texto atual.
**Alterar** libera a edição; **Salvar**, em verde, grava no banco e volta à consulta.
O **X vermelho** fecha. Texto não salvo exige confirmação antes de descartar.

O outro computador recebe a atualização em poucos segundos, sem importar outra
vez. Se dois operadores alterarem o mesmo texto, a segunda gravação é recusada:
a tela mantém o rascunho e permite conferir o texto atual do banco antes de decidir.

Observações mensais são gravadas automaticamente após uma breve pausa na digitação.
O indicador informa se há algo pendente. Uma falha mantém o texto digitado e oferece
as ações **Salvar meu texto** e **Usar texto do banco**. Uma troca de mês não muda
o mês a que pertence uma gravação pendente. A saída da página é protegida enquanto
há alterações não concluídas.

## Acesso do computador principal

Mantenha o túnel aberto no computador principal, com usuário/IP do notebook:

```bash
ssh -N -o ExitOnForwardFailure=yes -L 5173:127.0.0.1:5173 -L 3000:127.0.0.1:3000 usuario@IP_DO_NOTEBOOK
```

Abra `http://localhost:5173` e atualize a página após a atualização do servidor.
Se foram escolhidas outras portas na instalação, ajuste os encaminhamentos de
acordo com `.env.docker`. O armazenamento compartilhado depende da mesma API e do
mesmo banco em ambos os computadores.

## Backup

O `pg_dump` do banco passa a guardar a visão Excel compartilhada. Os scripts de
validação e empacotamento verificam a tabela nova quando presente, mantendo a
compatibilidade com backups antigos de dez tabelas. Guarde os backups e as cópias
JSON em local privado. A persistência em volume não substitui backup externo.
