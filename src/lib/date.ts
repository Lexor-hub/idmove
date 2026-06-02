// Helpers de data sensíveis a fuso. Operação roda madrugada adentro;
// usar `toISOString()` direto grava em UTC e quebra o filtro "hoje" para o motorista.

const BRT_TZ = 'America/Sao_Paulo';

// Retorna a data YYYY-MM-DD em America/Sao_Paulo para uma data específica (default: agora).
export const toBrtIsoDate = (date: Date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: BRT_TZ }).format(date);

// Atalho: data de hoje em BRT no formato YYYY-MM-DD.
export const todayBrt = () => toBrtIsoDate(new Date());
