import React from 'react';
import { useRouter } from '../../lib/router';
import { AuthProvider } from '../../context/AuthContext';
import { AdminLogin } from './AdminLogin';
import { AdminDashboard } from './AdminDashboard';
import { ProtectedAdminRoute } from './ProtectedAdminRoute';
import { XpProvider } from '../../context/XpContext';

// O AuthProvider fica aqui (e não no App) para o Firebase Auth só carregar no painel, fora do pacote do site público.
export const AdminApp: React.FC = () => {
  const { path } = useRouter();

  return (
    <AuthProvider>
      {/* Rota explícita de login; todas as demais rotas /admin e /admin/dashboard são protegidas */}
      {path === '/admin/login' ? (
        <AdminLogin />
      ) : (
        <ProtectedAdminRoute>
          <XpProvider>
            <AdminDashboard />
          </XpProvider>
        </ProtectedAdminRoute>
      )}
    </AuthProvider>
  );
};
