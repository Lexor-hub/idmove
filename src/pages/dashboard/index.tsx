import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AdminDashboard } from './AdminDashboard';
import { SupervisorDashboard } from './SupervisorDashboard';
import { DriverDashboard } from './DriverDashboard';
import { ClientDashboard } from './ClientDashboard';
import { MasterDashboard } from './MasterDashboard';
import { LiveTracking } from '@/components/tracking/LiveTracking';
import { ReceiptUpload } from '@/components/receipts/ReceiptUpload';
import { OccurrenceManager } from '@/components/occurrences/OccurrenceManager';

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

  switch (userRole) {
    case 'MASTER':
      return <MasterDashboard />;
    case 'ADMIN':
      return <AdminDashboard />;
    case 'SUPERVISOR':
      return <SupervisorDashboard />;
    case 'DRIVER':
      return <DriverDashboard />;
    case 'CLIENT':
      return <ClientDashboard />;
    case 'OPERATOR':
      return <SupervisorDashboard />;
    default:
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Perfil não reconhecido</h2>
            <p className="text-gray-600">Role: {userRole}</p>
            <p className="text-gray-600">Entre em contato com o administrador</p>
          </div>
        </div>
      );
  }
};