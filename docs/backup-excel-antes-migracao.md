# Etapa preparatória — backup local do Excel

## Objetivo

Antes de centralizar a visualização Excel no PostgreSQL, permitir que cada navegador salve uma cópia fiel dos dados existentes no `localStorage`.

## Alterações desta branch

- `frontend/src/excel-backup.ts`: exportação de todas as chaves que começam com `controle-notas-excel-`, preservando **valores brutos em texto** (inclusive JSON), sem reinterpretar ou reformatar seus dados.
- `frontend/src/ExcelViewV2.tsx`: botão **Exportar Backup** na barra superior do Excel.
- `frontend/src/excel-search.css`: confirmação de exportação ou mensagem de erro.

O arquivo baixado usa o formato:

```json
{
  "formato": "controle-notass-excel-localstorage",
  "versao": 1,
  "criadoEm": "data e hora ISO",
  "itens": {
    "controle-notas-excel-clientes": "JSON original armazenado no navegador"
  }
}
```

A exportação **não altera nem exclui** valores do navegador, não modifica o PostgreSQL e não realiza solicitações HTTP. Não há importação automática nesta etapa.

## Antes da futura migração

1. Fazer o backup em **cada computador/perfil de navegador** onde houve uso da tela Excel, porque as informações não são compartilhadas ainda.
2. Guardar os arquivos em local corporativo apropriado e privado. Podem conter nomes, observações e outros dados internos; **não adicionar arquivos de backup ao repositório público**.
3. Depois de conferir o banco Confere Cópias, mapear clientes e identificar nomes alternativos, cadastros distintos de matriz/filial e pendências de competências anteriores.
4. Conciliar os dados locais com os cadastros PostgreSQL por identidade confirmada (não deduzir identidade apenas pelo nome).
5. Criar processo controlado de importação com pré-visualização, detecção de colisões e confirmação, fazendo backup do PostgreSQL antes.
6. Testar a migração com dados fictícios e só então disponibilizar aos usuários.

## Teste manual da interface (a executar)

1. Iniciar o site de desenvolvimento na branch desta proposta.
2. Abrir Excel e adicionar **dados fictícios**: cliente, apelido, observação mensal, status e aviso.
3. Selecionar **Exportar Backup** e verificar que um `.json` foi baixado.
4. Abrir o arquivo localmente e verificar as chaves e valores exportados.
5. Confirmar que a tela e as informações do navegador continuam exatamente como antes da exportação.
6. Mudar a competência e repetir a exportação; o arquivo deve conter todas as competências armazenadas naquele navegador, e não somente a selecionada.
7. Verificar que **Painel**, **Xaxim Gás** e os três mercados prioritários permanecem intactos.

## Validação pendente

Esta implementação foi revisada estaticamente via GitHub, mas ainda não foi executada no navegador nem compilada no Codex. Não mesclar até validar e revisar o fluxo de dados.
