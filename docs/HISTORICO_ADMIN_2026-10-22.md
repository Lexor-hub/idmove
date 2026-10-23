# Histórico administrativo completo

A consulta anterior recebia somente 1.000 linhas do Supabase, mesmo com 3.862 entregas e 3.565 canhotos cadastrados. As notas anteriores a esse corte ficavam fora das buscas e exportações.

As consultas agora recuperam o conjunto completo em lotes de até 500 registros, mantendo os filtros e o escopo de acesso. A ordenação inclui o ID como desempate e a consulta fixa o instante inicial para evitar deslocamentos por novos cadastros durante a leitura. Se um lote falhar, a API informa erro em vez de apresentar um histórico parcial como completo.

As telas de entregas, canhotos, NF-es e comprovantes oferecem 50 registros por página inicialmente, com opções de 10, 50, 100, 250 e 500, além de primeira e última página. Buscas e CSV usam todo o conjunto carregado. O painel administrativo possui acesso direto pelo botão “Histórico de Notas”. A tela de entregas do dia também permite alternar para todo o histórico.

O filtro final de data dos canhotos inclui o dia inteiro em Brasília. Os relatórios de desempenho também leem todos os registros; o relatório com ocorrências divide listas de IDs para evitar URLs excessivas.

Validação: cinco testes automatizados de paginação; fluxo de navegador com ADMIN, comparando contagens com o banco, última página, pesquisa de NF antiga, CSV de 3.862 entregas, 3.565 canhotos e filtro por dia. A API também foi conferida quanto a IDs duplicados e escopo da empresa. Somente leitura das notas existentes, com conta QA temporária.

Build aprovado. ESLint permanece com pendências anteriores (127 erros, 22 avisos; revisão-base: 129 erros, 22 avisos).

Reexecutar os testes: `node --experimental-strip-types --test tests/history-pagination.test.mjs`.
