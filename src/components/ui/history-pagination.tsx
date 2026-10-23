import { Button } from '@/components/ui/button';

interface HistoryPaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export const HistoryPagination = ({ total, page, pageSize, onPageChange, onPageSizeChange }: HistoryPaginationProps) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const format = (value: number) => value.toLocaleString('pt-BR');
  return (
    <nav aria-label="Navegação do histórico" className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>{format(total ? (page - 1) * pageSize + 1 : 0)}–{format(Math.min(page * pageSize, total))} de {format(total)} registros</span>
        <label className="flex items-center gap-2">
          Por página
          <select aria-label="Registros por página" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="h-9 rounded-md border border-input bg-background px-2 text-foreground">
            {[10, 50, 100, 250, 500].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(1)}>Primeira</Button>
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Anterior</Button>
        <span className="text-sm">Página {format(page)} de {format(pages)}</span>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>Próxima</Button>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPageChange(pages)}>Última</Button>
      </div>
    </nav>
  );
};
