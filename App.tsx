
import React from 'react';
import { RouterProvider, useRouter } from './lib/router';
import { AuthProvider } from './context/AuthContext';
import { PublicSite } from './components/PublicSite';
import { AdminApp } from './components/admin/AdminApp';

const AppContent: React.FC = () => {
  const { path } = useRouter();

  if (path.startsWith('/admin')) {
    return <AdminApp />;
  }

  return <PublicSite />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <RouterProvider>
        <AppContent />
      </RouterProvider>
    </AuthProvider>
  );
};

export default App;

