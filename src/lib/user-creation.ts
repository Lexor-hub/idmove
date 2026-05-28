import type { UserRole } from '@/integrations/supabase/types';

const normalizeDocument = (value?: string | null) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits || null;
};

export const isStrongPassword = (password?: string | null) => {
  if (!password || password.length < 8) return false;
  return /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
};

type BuildProfilePayloadInput = {
  authUserId: string;
  companyId?: string | null;
  email: string;
  fullName: string;
  role: UserRole;
  username?: string | null;
  document?: string | null;
  status?: string | null;
  isActive?: boolean | null;
};

export const buildProfilePayload = ({
  authUserId,
  companyId,
  email,
  fullName,
  role,
  username,
  document,
  status,
  isActive,
}: BuildProfilePayloadInput) => ({
  auth_user_id: authUserId,
  company_id: companyId || null,
  email,
  username: username || email,
  full_name: fullName,
  role,
  cpf: normalizeDocument(document),
  status: status || 'ATIVO',
  is_active: isActive ?? true,
});
