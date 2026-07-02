import React, { Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const AdminDashboard = React.lazy(() => import('./AdminDashboard').then((module) => ({ default: module.AdminDashboard })));
const SupervisorDashboard = React.lazy(() => import('./SupervisorDashboard').then((module) => ({ default: module.SupervisorDashboard })));
const DriverDashboard = React.lazy(() => import('./DriverDashboard').then((module) => ({ default: module.DriverDashboard })));
const ClientDashboard = React.lazy(() => import('./ClientDashboard').then((module) => ({ default: module.ClientDashboard })));
const MasterDashboard = React.lazy(() => import('./MasterDashboard'));

const DashboardFallback = () => (
  <div className="flex items-center justify-center min-h-96">
    <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
  </div>
);

export const Dashboard: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Usuário não autenticado</h2>
          <p className="text-gray-600">Faça login para acessar o dashboard</p>
        </div>
      </div>
    );
  }

  // Mapeamento de roles antigas para novas
  const roleMapping: Record<string, string> = {
    'ADMINISTRADOR': 'ADMIN',
    'MOTORISTA': 'DRIVER',
    'OPERADOR': 'OPERATOR',
    'CLIENTE': 'CLIENT'
  };

  const userRole = roleMapping[user.role || user.user_type || ''] || user.role || user.user_type || '';

  let dashboard: React.ReactNode;
  switch (userRole) {
    case 'MASTER':
      dashboard = <MasterDashboard />;
      break;
    case 'ADMIN':
      dashboard = <AdminDashboard />;
      break;
    case 'SUPERVISOR':
    case 'OPERATOR':
      dashboard = <SupervisorDashboard />;
      break;
    case 'DRIVER':
      dashboard = <DriverDashboard />;
      break;
    case 'CLIENT':
      dashboard = <ClientDashboard />;
      break;
    default:
      dashboard = (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Perfil não reconhecido</h2>
            <p className="text-gray-600">Role: {userRole}</p>
            <p className="text-gray-600">Entre em contato com o administrador</p>
          </div>
        </div>
      );
  }

  return (
    <Suspense fallback={<DashboardFallback />}>
      {dashboard}
    </Suspense>
  );
};
