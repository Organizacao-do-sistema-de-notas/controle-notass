# Informações adicionais ao lado das observações — 14/11/2026

Branch de implementação: `feature/informacoes-adicionais`, baseada em
`618b036afc9052e19e299868a90b1febb1a28bac`.

## Resultado

Na visão Excel, cada cliente recebe um botão **?** quadrado de 26 × 26 px à
direita do campo de observação. Ele abre uma consulta compacta, somente leitura,
com as particularidades específicas do cliente. O botão ganha um destaque
discreto quando há conteúdo, e a consulta vazia informa como cadastrá-lo.

O novo campo **Informações adicionais** fica nos formulários **Incluir Cliente**
e **Alterar Cliente** da visão Excel. As observações e os status de cada mês
continuam independentes. Nenhuma regra de caixa ou outra especificação real
foi preenchida automaticamente; o usuário esclareceu que se tratava de exemplo.

As informações usam a chave interna estável do cadastro Excel. Renomear o
cliente ou ter dois nomes exibidos iguais não transfere nem mescla os textos.
Salvar o cadastro grava nome, apelidos e informações antes de atualizar a tela;
uma falha de armazenamento tenta restaurar os valores anteriores e mantém os
campos digitados para nova tentativa ou cópia.

## Persistência e limites

O Excel já mantém cadastros e observações em localStorage. O campo novo segue
esse armazenamento, na chave `controle-notas-excel-clientes-informacoes`, com
até 20.000 caracteres por cliente. O aviso de persistência aparece nos
formulários e na consulta: o texto fica **neste navegador**, em todos os meses.

Não há sincronização com outros navegadores ou inclusão desse texto no backup
PostgreSQL. A integração do Excel com os cadastros centrais continua separada;
não foi criado um vínculo automático por nome, nem modificados backend, Prisma,
migrations ou dados do banco importado e da empresa.

## Arquivos

- `frontend/src/ExcelViewV2.tsx`: botão na linha, campo nos formulários e
  salvamento associado à identidade estável do cliente local.
- `frontend/src/InformacoesCliente.tsx`: consulta sem edição, com Escape,
  clique externo, ciclo de Tab e retorno do foco ao botão de origem.
- `frontend/src/informacoes-cliente.css`: botão pequeno e consulta responsiva.
- `frontend/src/informacoes-cliente-storage.ts`: leitura validada e gravação
  com restauração dos valores anteriores quando há falha.
- `frontend/tests/informacoes.spec.ts`: seis novos testes de interface.
- `README.md`: instruções de uso e limites de persistência.

## Verificação

Executada em Docker/Linux, com Chromium/Playwright. Foi reutilizada a imagem
de dependências já validada, montando os fontes e testes em modo somente
leitura; o build do frontend foi executado antes das suítes. A base das suítes
é o PostgreSQL temporário do perfil `test`, restrito a `127.0.0.1:5433`, com
dados fictícios e sem acesso ao banco importado de desenvolvimento.

| Verificação | Resultado |
| --- | --- |
| TypeScript e build de produção do frontend | Aprovados |
| Testes de integração do backend | 21 aprovados |
| Testes de interface | 20 aprovados: 14 existentes e seis novos |
| Posição e tamanho do botão | Quadrado, à direita da observação; consulta vazia sem alterar o mês |
| Cadastro, recarregamento e troca de mês | Informações preservadas; observações e status mensais permanecem independentes |
| Renomeação, nomes iguais e limpeza do texto | Identidades preservadas, sem mesclar informações entre clientes |
| Falha simulada de gravação | Texto digitado mantido; alterações parciais de nome e apelidos revertidas; repetição bem-sucedida |
| Consulta em tela de 390px | Sem transbordamento horizontal; Tab e Escape funcionam e o foco retorna ao botão |
| Conteúdo com HTML | Renderizado como texto, sem executar marcação |
| Dados antigos ausentes ou inválidos | A lista continua funcionando |
| Excel, Painel, menu de cadastros e fichas | Testes anteriores preservados |
| Xaxim Gás e mercados prioritários | Preservados |

O uso no notebook dependerá do envio aprovado da branch e da atualização dos
containers. Não é necessária migração de banco para esta alteração.
