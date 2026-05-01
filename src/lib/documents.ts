export const normalizeBrazilianDocument = (value?: string | null) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits || null;
};
