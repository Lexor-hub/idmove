export type UserRole = 'MASTER' | 'ADMIN' | 'SUPERVISOR' | 'OPERATOR' | 'DRIVER' | 'CLIENT';
export type DeliveryStatus = 'PENDING' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
export type ReceiptStatus = 'PENDING' | 'UPLOADED' | 'VALIDATED' | 'REJECTED';
export type DriverStatus = 'offline' | 'online' | 'idle' | 'active';

export type ProfileRow = {
  id: string;
  auth_user_id: string | null;
  company_id: string | null;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  cpf: string | null;
  status: 'ATIVO' | 'INATIVO';
  is_active: boolean;
  view_company_data: boolean;
  created_at: string;
  updated_at: string;
};

export type CompanyRow = {
  id: string;
  name: string;
  cnpj: string | null;
  domain: string | null;
  email: string | null;
  logo: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  subscription_plan: string | null;
  max_users: number | null;
  max_drivers: number | null;
  created_at: string;
  updated_at: string;
};
