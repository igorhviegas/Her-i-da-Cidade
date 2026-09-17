import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../lib/router';
import { ShieldAlert, LogOut, ArrowLeft, Loader2 } from 'lucide-react';

interface ProtectedAdminRouteProps {
  children: React.ReactNode;
}

export const ProtectedAdminRoute: React.FC<ProtectedAdminRouteProps> = ({ children }) => {
  const { user, status, loading, logout } = useAuth();
  const { navigate } = useRouter();

  useEffect(() => {
    if (!loading && status === 'unauthenticated') {
      navigate('/admin/login');
    }
  }, [loading, status, navigate]);

  // 1. Estado de Carregamento Inicial
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A101D] flex flex-col items-center justify-center text-white px-4">
        <div className="flex flex-col items-center gap-4 bg-[#111B2E] border border-white/10 p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Verificando Credenciais</h3>
            <p className="text-sm text-white/50 mt-1">Aguarde enquanto validamos suas permissões de acesso...</p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Não autenticado (o useEffect faz o redirecionamento, mas renderizamos tela limpa)
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-[#0A101D] flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  // 3. Usuário autenticado, mas NÃO autorizado (sem documento na coleção 'admins')
  if (status === 'authenticated_unauthorized') {
    return (
      <div className="min-h-screen bg-[#0A101D] flex items-center justify-center p-4 text-white">
        <div className="max-w-md w-full bg-[#111B2E] border border-red-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5 text-red-400">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Acesso Negado</h2>
          <p className="text-sm text-white/60 mb-6 leading-relaxed">
            A conta conectada (<span className="text-white font-medium">{user?.email}</span>) não possui privilégios de administrador cadastrados no sistema.
          </p>

          <div className="p-4 bg-red-950/30 border border-red-800/40 rounded-xl mb-6 text-xs text-red-200 text-left">
            <p className="font-semibold mb-1">Motivo da Restrição:</p>
            <p className="text-white/70">
              O seu usuário está autenticado no Firebase, porém não possui um registro ativo na coleção <code className="bg-black/40 px-1.5 py-0.5 rounded text-red-300 font-mono">admins</code> do Firestore.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={async () => {
                await logout();
                navigate('/admin/login');
              }}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-white/10 hover:bg-white/20 text-white font-medium text-sm rounded-xl transition-all border border-white/10"
            >
              <LogOut className="w-4 h-4" />
              Trocar de Conta
            </button>

            <button
              onClick={() => navigate('/')}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm rounded-xl transition-all shadow-lg shadow-blue-600/30"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Site
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Usuário autenticado e autorizado como Administrador
  return <>{children}</>;
};
