# Ficha individual de clientes — primeira etapa

Esta implementação amplia o cadastro existente sem apagar clientes ou pendências.

## Estrutura adicionada

- `Cliente.frequenciaAcesso`: `NAO_DEFINIDA` (padrão), `MENSAL`, `EVENTUAL`. A frequência **não é inferida** das planilhas antigas.
- `Cliente.observacoesPermanentes`: orientações gerais da ficha (não guardar senhas).
- `Cliente.modeloMensagem`: modelo manual reutilizável; não envia mensagens automaticamente.
- `ClienteNomeAlternativo`: nomes usados na pesquisa, vinculados ao mesmo cliente.
- `ProcedimentoCliente`: instruções específicas, com título, descrição e campo `ativo`; procedimentos antigos podem ser desativados.
- `HistoricoContabilidadeCliente`: armazena snapshots dos nomes anterior e novo e autor informado pela chamada, quando a contabilidade muda via PATCH /clientes/:id.

## Rotas REST adicionadas

- `GET /clientes/:id/ficha` — ficha, contabilidade, apelidos, procedimentos e histórico de contabilidade.
- `PATCH /clientes/:id/ficha` — aceita campos opcionais `frequenciaAcesso`, `observacoesPermanentes`, `modeloMensagem` e `nomesAlternativos` (array de strings). Também aceita `contabilidadeId` e `autor`: ficha, apelidos, vínculo e histórico são salvos na mesma transação; um vínculo inválido não grava parte da ficha. O array **substitui** a lista anterior quando informado; omiti-lo preserva a lista.
- `POST /clientes/:id/procedimentos` — cria procedimento com `titulo` e `descricao`.
- `PATCH /clientes/:id/procedimentos/:procedimentoId` — altera `titulo`, `descricao` ou `ativo`.
- `PATCH /clientes/:id` — já existia; ao trocar `contabilidadeId`, agora registra a mudança em histórico. O campo opcional `autor` identifica quem fez a alteração, mas **não é autenticação**.

### Exemplo de atualização de ficha

```json
{
  "frequenciaAcesso": "MENSAL",
  "nomesAlternativos": ["Mercado Exemplo", "Exemplo Matriz"],
  "observacoesPermanentes": "Acessar o caixa 4 para realizar a conferência.",
  "modeloMensagem": "Primeira NF-e do mês: [preencher]\nÚltima NF-e do mês anterior: [preencher]"
}
```

## Migração e cuidados

A migração `20261112220000_ficha_cliente` cria colunas opcionais, tabelas adicionais e um enum, sem excluir dados existentes. Os clientes existentes recebem a classificação `NAO_DEFINIDA`.

**Não executar uma migração em produção sem backup verificado.** No ambiente de testes e com banco configurado na raiz do projeto:

```bash
cd backend
npx prisma migrate deploy --config prisma7.config.ts
npx prisma generate --config prisma7.config.ts
npx tsc --noEmit
```

Os comandos acima são para execução após aprovação, não foram rodados no banco real neste trabalho.

## Restrições desta etapa

- Não realiza importação do Confere Cópias ou das listas Excel.
- A interface **Fichas dos Clientes** é aberta pela visualização Excel e consulta o PostgreSQL. O cadastro de clientes pelo Painel continua disponível; a tabela Excel mantém seu cadastro local separado, sem importar esses nomes para o banco.
- **Não armazenar senhas ou segredos em observações/procedimentos**: essas rotas ainda precisam de autenticação e autorização antes de hospedar fora de uma rede de testes protegida.
- O histórico de contabilidades começa a ser registrado **a partir das futuras alterações**. Não recria retroativamente trocas antigas.
- Testes de integração e de navegador estão descritos em `../VALIDACAO_PR1.md`. Alterações de contabilidade são serializadas por cliente para preservar os snapshots em requisições simultâneas.
