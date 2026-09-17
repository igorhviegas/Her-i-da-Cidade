import React from 'react';
import { useRouter } from '../../lib/router';
import { AdminLogin } from './AdminLogin';
import { AdminDashboard } from './AdminDashboard';
import { ProtectedAdminRoute } from './ProtectedAdminRoute';

export const AdminApp: React.FC = () => {
  const { path } = useRouter();

  // Rota explícita de login
  if (path === '/admin/login') {
    return <AdminLogin />;
  }

  // Todas as demais rotas /admin e /admin/dashboard são protegidas
  return (
    <ProtectedAdminRoute>
      <AdminDashboard />
    </ProtectedAdminRoute>
  );
};
