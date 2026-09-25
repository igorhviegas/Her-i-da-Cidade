import React from 'react';
import { RouterProvider, useRouter } from './lib/router';
import { AuthProvider } from './context/AuthContext';
import { PublicSite } from './components/PublicSite';
import { AdminApp } from './components/admin/AdminApp';
import { VideoCatalog } from './components/VideoCatalog';

const AppContent: React.FC = () => {
  const { path } = useRouter();

  if (path.startsWith('/admin')) {
    return <AdminApp />;
  }

  // Rota dedicada para o catálogo de vídeos estilo Netflix
  if (path === '/videos' || path.startsWith('/videos/')) {
    return <VideoCatalog />;
  }

  return <PublicSite />;
};

export const App: React.FC = () => {
  return (
    <RouterProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </RouterProvider>
  );
};
