type PageResult<T> = {
  data: T[] | null;
  error: unknown;
  count?: number | null;
};

/** Fetch every matching row, even when the API caps each response. */
export async function fetchAllPages<T>(
  getPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = 500,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error('Tamanho de página inválido.');
  const rows: T[] = [];
  let total: number | null = null;
  while (true) {
    const result = await getPage(rows.length, rows.length + pageSize - 1);
    if (result.error) throw result.error;
    if (total === null && result.count != null) total = result.count;
    const page = result.data || [];
    if (page.length === 0) {
      if (total !== null && rows.length < total) {
        throw new Error('O histórico mudou durante a consulta. Atualize para carregar todos os registros.');
      }
      break;
    }
    rows.push(...page);
    if (total !== null ? rows.length >= total : page.length < pageSize) break;
  }
  return rows;
}
