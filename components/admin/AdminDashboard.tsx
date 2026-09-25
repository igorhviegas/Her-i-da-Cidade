import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../lib/router';
import { getServices, seedServicesIfEmpty } from '../../services/servicesService';
import { AdminServices } from './AdminServices';
import { AdminSettings } from './AdminSettings';
import { AdminVideosPage } from './AdminVideosPage';
import { AdminCategoriesPage } from './AdminCategoriesPage';
import { AdminContentPage } from './AdminContentPage';
import { 
  Shield, 
  LayoutDashboard, 
  Sparkles, 
  Video, 
  FileText, 
  Settings, 
  LogOut, 
  ExternalLink, 
  Menu, 
  X, 
  CheckCircle2, 
  Database, 
  Layers, 
  Clock, 
  ArrowRight,
  UserCheck,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

type AdminTab = 'dashboard' | 'services' | 'videos' | 'categories' | 'content' | 'settings';

export const AdminDashboard: React.FC = () => {
  const { user, adminData, logout } = useAuth();
  const { path, navigate } = useRouter();

  // Sincronização inicial da aba com a URL
  const initialTab: AdminTab = 
    path === '/admin/servicos' || path === '/admin/services'
      ? 'services'
      : path === '/admin/configuracoes' || path === '/admin/settings'
      ? 'settings'
      : path === '/admin/categorias'
      ? 'categories'
      : path === '/admin/videos'
      ? 'videos'
      : path === '/admin/conteudo'
      ? 'content'
      : 'dashboard';

  const [currentTab, setCurrentTab] = useState<AdminTab>(initialTab);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Monitora alterações na URL para refletir na aba
  useEffect(() => {
    if (path === '/admin/servicos' || path === '/admin/services') {
      setCurrentTab('services');
    } else if (path === '/admin/configuracoes' || path === '/admin/settings') {
      setCurrentTab('settings');
    } else if (path === '/admin/categorias') {
      setCurrentTab('categories');
    } else if (path === '/admin/videos') {
      setCurrentTab('videos');
    } else if (path === '/admin/conteudo') {
      setCurrentTab('content');
    } else if (path === '/admin' || path === '/admin/dashboard') {
      setCurrentTab('dashboard');
    }
  }, [path]);

  const handleTabChange = (tabId: AdminTab) => {
    setCurrentTab(tabId);
    if (tabId === 'services') {
      navigate('/admin/servicos');
    } else if (tabId === 'videos') {
      navigate('/admin/videos');
    } else if (tabId === 'categories') {
      navigate('/admin/categorias');
    } else if (tabId === 'settings') {
      navigate('/admin/configuracoes');
    } else if (tabId === 'content') {
      navigate('/admin/conteudo');
    } else if (tabId === 'dashboard') {
      navigate('/admin');
    }
  };

  // Estado da sincronização dos serviços
  const [servicesCount, setServicesCount] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const checkAndSyncServices = async (auto = false) => {
    try {
      if (!auto) setIsSyncing(true);
      const currentList = await getServices();
      setServicesCount(currentList.length);

      // Se ainda não houver nenhum serviço no Firestore, executa o seed seguro
      if (currentList.length === 0) {
        const result = await seedServicesIfEmpty();
        const updated = await getServices();
        setServicesCount(updated.length);
        if (!auto) {
          setSyncFeedback({
            type: 'success',
            message: result.message,
          });
        }
      } else if (!auto) {
        setSyncFeedback({
          type: 'success',
          message: `${currentList.length} serviços já sincronizados no Firestore. Nenhuma duplicata criada.`,
        });
      }
    } catch (err: any) {
      console.error('[AdminDashboard] Erro ao sincronizar serviços:', err);
      if (!auto) {
        setSyncFeedback({
          type: 'error',
          message: 'Falha ao sincronizar serviços no Firestore. Verifique as permissões de administrador.',
        });
      }
    } finally {
      if (!auto) setIsSyncing(false);
    }
  };

  useEffect(() => {
    checkAndSyncServices(true);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/admin/login');
    } catch (error) {
      console.error('[AdminDashboard] Erro ao deslogar:', error);
      setIsLoggingOut(false);
    }
  };

  const navItems = [
    { id: 'dashboard' as AdminTab, label: 'Dashboard', icon: LayoutDashboard, status: 'active' },
    { id: 'services' as AdminTab, label: 'Serviços', icon: Sparkles, status: 'active' },
    { id: 'videos' as AdminTab, label: 'Vídeos', icon: Video, status: 'active', hint: 'Etapa 5' },
    { id: 'categories' as AdminTab, label: 'Categorias', icon: Layers, status: 'active' },
    { id: 'content' as AdminTab, label: 'Conteúdo', icon: FileText, status: 'active' },
    { id: 'settings' as AdminTab, label: 'Configurações', icon: Settings, status: 'active' },
  ];

  return (
    <div className="min-h-screen bg-[#070B14] text-white flex flex-col lg:flex-row antialiased selection:bg-blue-600 selection:text-white">
      
      {/* 1. SIDEBAR DESKTOP */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-[#0B1120] border-r border-white/10 shrink-0">
        {/* Brand Header */}
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-blue-400 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">
              Herói da Cidade
            </span>
            <span className="text-base font-bold text-white tracking-tight">
              Painel Admin
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <div className="px-3 py-2 text-[10px] font-semibold text-white/40 uppercase tracking-widest">
            Navegação Principal
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  handleTabChange(item.id);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-white/50'}`} />
                  <span>{item.label}</span>
                </div>
                {item.status === 'soon' && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                    isActive 
                      ? 'bg-blue-800/60 text-blue-100' 
                      : 'bg-white/10 text-white/50'
                  }`}>
                    {item.hint || 'Em breve'}
                  </span>
                )}
                {(item.id === 'services' || item.id === 'settings' || item.id === 'content') && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Ativo
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer Link to Public Site */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Ver Site Público</span>
          </button>
        </div>
      </aside>

      {/* 2. SIDEBAR MOBILE (DRAWER) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative w-72 max-w-[85vw] bg-[#0B1120] border-r border-white/10 flex flex-col h-full z-10">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-[10px] font-black uppercase tracking-widest text-blue-400">
                    Herói da Cidade
                  </span>
                  <span className="text-sm font-bold text-white">
                    Painel Admin
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-white/60 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      handleTabChange(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-white/70 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                    {item.status === 'soon' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 font-medium">
                        {item.hint || 'Em breve'}
                      </span>
                    )}
                      {(item.id === 'services' || item.id === 'settings' || item.id === 'content') && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                        Ativo
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-white/10 space-y-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/');
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white/70 hover:text-white bg-white/5 rounded-xl"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Ver Site Público</span>
              </button>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 rounded-xl"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sair do Painel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MAIN AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* TOPBAR */}
        <header className="h-16 bg-[#0B1120]/80 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Painel Administrativo
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Online
              </span>
            </div>
          </div>

          {/* User Status & Logout */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2.5 pl-3 border-l border-white/10 text-right">
              <div className="hidden md:block">
                <p className="text-xs font-semibold text-white leading-none">
                  {adminData?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Administrador'}
                </p>
                <p className="text-[11px] text-white/40 mt-1 font-mono leading-none truncate max-w-[180px]">
                  {user?.email}
                </p>
              </div>

              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-inner ring-2 ring-white/10">
                {(user?.email?.[0] || 'A').toUpperCase()}
              </div>
            </div>

            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              title="Sair do painel"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white/70 hover:text-white bg-white/5 hover:bg-red-500/20 hover:border-red-500/30 border border-white/10 transition-all active:scale-95"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </header>

        {/* CONTENT VIEWPORT */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          
          {/* TAB: DASHBOARD */}
          {currentTab === 'dashboard' && (
            <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
              
              {/* Welcome Hero Card */}
              <div className="bg-gradient-to-r from-blue-950/50 via-[#0E1626] to-[#0A101D] border border-blue-500/20 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
                <div className="max-w-2xl relative z-10">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-3">
                    <UserCheck className="w-3.5 h-3.5" />
                    Sessão Administrativa Ativa
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
                    Bem-vindo, {user?.displayName || user?.email?.split('@')[0] || 'Administrador'}!
                  </h2>
                  <p className="text-sm sm:text-base text-white/70 leading-relaxed font-light">
                    A fundação da área administrativa do <strong className="text-white font-medium">Herói da Cidade</strong> está configurada e integrada com autenticação protegida e Firestore Security Rules.
                  </p>
                </div>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                
                <div className="bg-[#0D1527] border border-white/10 rounded-2xl p-5 shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                      Projeto Firebase
                    </span>
                    <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
                      <Database className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-lg font-bold text-white tracking-tight">heroi-da-cidade</p>
                  <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Conectado ao Cloud Firestore (default)
                  </p>
                </div>

                <div className="bg-[#0D1527] border border-white/10 rounded-2xl p-5 shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                      Autenticação & Regras
                    </span>
                    <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
                      <Shield className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-lg font-bold text-white tracking-tight">Permissões de Admin</p>
                  <p className="text-xs text-white/60 flex items-center gap-1 mt-1">
                    <span className="text-emerald-400 font-semibold">Regras ativas:</span> Coleção admins/{'{uid}'}
                  </p>
                </div>

                <div className="bg-[#0D1527] border border-white/10 rounded-2xl p-5 shadow-lg sm:col-span-2 lg:col-span-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                        Coleção de Serviços
                      </span>
                      <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
                        <Layers className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="text-lg font-bold text-white tracking-tight">
                      {servicesCount !== null ? `${servicesCount} Serviços no Firestore` : 'Consultando Firestore...'}
                    </p>
                    <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      IDs 1 a 6 mapeados com active: true
                    </p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                    <button
                      onClick={() => checkAndSyncServices(false)}
                      disabled={isSyncing}
                      className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSyncing ? 'Sincronizando...' : 'Verificar / Sincronizar'}</span>
                    </button>
                    <span className="text-[10px] text-white/40">Idempotente</span>
                  </div>
                </div>

              </div>

              {/* Feedback de Sincronização */}
              {syncFeedback && (
                <div className={`p-4 rounded-xl border text-xs flex items-center gap-2.5 transition-all ${
                  syncFeedback.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}>
                  {syncFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  )}
                  <span className="flex-1 font-medium">{syncFeedback.message}</span>
                </div>
              )}

              {/* Module Cards (Roadmap / Futuros Módulos) */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white/60">
                    Módulos Administrativos
                  </h3>
                  <span className="text-xs text-white/40">
                    Estrutura preparada para expansão modular
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  
                  {/* Card Serviços */}
                  <div 
                    onClick={() => handleTabChange('services')}
                    className="group bg-[#0D1527] hover:bg-[#111B30] border border-white/10 hover:border-blue-500/40 rounded-2xl p-6 transition-all cursor-pointer shadow-lg"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        Ativo • Gerenciável
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors mb-2">
                      Serviços e Preços
                    </h4>
                    <p className="text-sm text-white/60 leading-relaxed font-light mb-4">
                      Gerenciamento completo: criar novos serviços, editar preços, alterar status ativo/inativo, reordenar e excluir.
                    </p>
                    <div className="flex items-center gap-1 text-xs font-semibold text-blue-400 group-hover:translate-x-1 transition-transform">
                      <span>Acessar gerenciador de serviços</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Card Vídeos */}
                  <div 
                    onClick={() => setCurrentTab('videos')}
                    className="group bg-[#0D1527] hover:bg-[#111B30] border border-white/10 hover:border-purple-500/40 rounded-2xl p-6 transition-all cursor-pointer shadow-lg"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
                        <Video className="w-6 h-6" />
                      </div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        <Clock className="w-3 h-3" />
                        Em breve • Etapa 4
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors mb-2">
                      Plataforma de vídeos
                    </h4>
                    <p className="text-sm text-white/60 leading-relaxed font-light mb-4">
                      Catálogo e indexação de conteúdos educativos e divertidos do Instagram, categorizados por temas e faixa etária.
                    </p>
                    <div className="flex items-center gap-1 text-xs font-semibold text-purple-400 group-hover:translate-x-1 transition-transform">
                      <span>Ver detalhes do módulo</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Card Conteúdo */}
                  <div 
                    onClick={() => handleTabChange('content')}
                    className="group bg-[#0D1527] hover:bg-[#111B30] border border-white/10 hover:border-emerald-500/40 rounded-2xl p-6 transition-all cursor-pointer shadow-lg"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                        <FileText className="w-6 h-6" />
                      </div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        Ativo
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors mb-2">
                      Textos & Conteúdo
                    </h4>
                    <p className="text-sm text-white/60 leading-relaxed font-light mb-4">
                      Edição de textos estratégicos do site, frases de impacto, seção Sobre e links de agendamento.
                    </p>
                    <div className="flex items-center gap-1 text-xs font-semibold text-emerald-400 group-hover:translate-x-1 transition-transform">
                      <span>Ver detalhes do módulo</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Card Configurações */}
                  <div 
                    onClick={() => handleTabChange('settings')}
                    className="group bg-[#0D1527] hover:bg-[#111B30] border border-white/10 hover:border-slate-400 rounded-2xl p-6 transition-all cursor-pointer shadow-lg"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center text-slate-400 group-hover:scale-105 transition-transform">
                        <Settings className="w-6 h-6" />
                      </div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        Ativo • Gerenciável
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-white group-hover:text-slate-300 transition-colors mb-2">
                      Configurações Gerais
                    </h4>
                    <p className="text-sm text-white/60 leading-relaxed font-light mb-4">
                      Gerenciamento de canais de conversão (WhatsApp), parâmetros do sistema e dados públicos do site.
                    </p>
                    <div className="flex items-center gap-1 text-xs font-semibold text-slate-400 group-hover:translate-x-1 transition-transform">
                      <span>Acessar configurações</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* TAB: SERVIÇOS (ETAPA 4) */}
          {currentTab === 'services' && (
            <AdminServices />
          )}

            {/* TAB: CONFIGURAÇÕES */}
            {currentTab === 'content' && <AdminContentPage />}
            {currentTab === 'settings' && (
            <AdminSettings />
          )}
          {currentTab === 'videos' && (
            <AdminVideosPage />
          )}
          {currentTab === 'categories' && (
            <AdminCategoriesPage />
          )}

          {/* TAB: SUBMÓDULOS EM BREVE */}
            {currentTab !== 'dashboard' && currentTab !== 'services' && currentTab !== 'settings' && currentTab !== 'videos' && currentTab !== 'categories' && currentTab !== 'content' && (
            <div className="max-w-2xl mx-auto py-12 text-center animate-in fade-in duration-200">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 border border-white/10 mb-4 text-blue-400">
                <Clock className="w-8 h-8" />
              </div>
              <div className="mb-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Módulo em Preparação
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-3">
                {navItems.find(i => i.id === currentTab)?.label}
              </h2>
              <p className="text-sm text-white/60 leading-relaxed max-w-lg mx-auto mb-8 font-light">
                A estrutura de navegação e as rotas administrativas já estão preparadas. 
                A lógica operacional deste módulo será implementada nas etapas seguintes.
              </p>
              
              <button
                onClick={() => handleTabChange('dashboard')}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-600/30 transition-all"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Voltar ao Dashboard Principal</span>
              </button>
            </div>
          )}

        </main>
      </div>

    </div>
  );
};
