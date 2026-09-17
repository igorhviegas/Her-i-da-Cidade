import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../lib/router';
import { getAuthErrorMessage } from '../../services/authService';
import { Shield, Lock, Mail, ArrowLeft, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';

export const AdminLogin: React.FC = () => {
  const { login, status } = useAuth();
  const { navigate } = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Se já estiver logado e autorizado, redireciona direto para o dashboard
  useEffect(() => {
    if (status === 'authenticated_admin') {
      navigate('/admin/dashboard');
    }
  }, [status, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Por favor, informe seu endereço de e-mail.');
      return;
    }

    if (!password) {
      setErrorMessage('Por favor, informe sua senha.');
      return;
    }

    setIsSubmitting(true);

    try {
      await login(email.trim(), password);
      // Redirecionamento é tratado pelo observer ou manualmente
      navigate('/admin/dashboard');
    } catch (error: any) {
      console.error('[AdminLogin] Erro ao autenticar:', error);
      const code = error?.code || 'auth/unknown';
      setErrorMessage(getAuthErrorMessage(code));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070B14] flex flex-col items-center justify-center p-4 sm:p-6 text-white selection:bg-blue-600 selection:text-white relative overflow-hidden">
      {/* Detalhes de iluminação sutil de fundo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-64 h-64 bg-red-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Card Principal de Login */}
      <div className="w-full max-w-md bg-[#0F172A] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10">
        
        {/* Cabeçalho do Card */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-blue-400 text-white shadow-lg shadow-blue-500/25 mb-4 border border-white/20">
            <Shield className="w-8 h-8" />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-400 mb-1.5">
            O Herói da Cidade
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Área Administrativa
          </h1>
          <p className="text-sm text-white/50 mt-1.5 font-light">
            Acesso exclusivo para administradores autorizados
          </p>
        </div>

        {/* Mensagem de Erro */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-300 text-sm animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-2" htmlFor="admin-email">
              E-mail Administrativo
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                autoComplete="email"
                disabled={isSubmitting}
                className="w-full pl-10 pr-4 py-3 bg-[#0A101D] border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-2" htmlFor="admin-password">
              Senha de Acesso
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={isSubmitting}
                className="w-full pl-10 pr-11 py-3 bg-[#0A101D] border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-white/40 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-blue-500/40 active:scale-[0.99]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Autenticando...</span>
              </>
            ) : (
              <span>Entrar no Painel</span>
            )}
          </button>
        </form>

        {/* Rodapé do Card com Link de Retorno */}
        <div className="mt-8 pt-6 border-t border-white/10 text-center">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao site público</span>
          </button>
        </div>

      </div>

      <div className="mt-6 text-center text-xs text-white/30">
        Ambiente protegido com Firebase Authentication e Firestore Security Rules
      </div>
    </div>
  );
};
