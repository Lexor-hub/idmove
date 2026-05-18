export type CsvCell = string | number | boolean | null | undefined;

const CSV_BOM = '\uFEFF';

export const escapeCsvCell = (value: CsvCell) => {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

export const buildCsv = (headers: string[], rows: CsvCell[][]) => [
  headers.map(escapeCsvCell).join(','),
  ...rows.map((row) => row.map(escapeCsvCell).join(',')),
].join('\n');

export const downloadCsv = (filename: string, headers: string[], rows: CsvCell[][]) => {
  const csv = buildCsv(headers, rows);
  const blob = new Blob([`${CSV_BOM}${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const formatCsvDateTime = (value?: string | null) => {
  if (!value) return '';
  return new Date(value).toLocaleString('pt-BR');
};

export const csvFilenameWithDate = (prefix: string) => `${prefix}_${new Date().toISOString().split('T')[0]}.csv`;
