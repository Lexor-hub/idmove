import type { UserRole } from '@/integrations/supabase/types';

export const normalizeRole = (role?: string | null): UserRole => {
  const map: Record<string, UserRole> = {
    MASTER: 'MASTER',
    ADMIN: 'ADMIN',
    SUPERVISOR: 'SUPERVISOR',
    OPERATOR: 'OPERATOR',
    DRIVER: 'DRIVER',
    CLIENT: 'CLIENT',
    ADMINISTRADOR: 'ADMIN',
    MOTORISTA: 'DRIVER',
    OPERADOR: 'OPERATOR',
    CLIENTE: 'CLIENT',
  };
  return map[String(role || '').toUpperCase()] || 'CLIENT';
};
