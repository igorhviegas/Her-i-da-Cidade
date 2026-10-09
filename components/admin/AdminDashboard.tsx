import { logger } from '../../lib/logger.js';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../lib/router';
import { AdminHomePage } from './AdminHomePage';
import { AdminNav, useNavOrder, type NavItem, type NavGroup } from './AdminNav';
import { useServicesSync } from './videoAdmin/useServicesSync';
import { useNavBadges } from './videoAdmin/useNavBadges';
import { DashboardDesktopSidebar, DashboardMobileDrawer, DashboardTopbar } from './videoAdmin/DashboardChrome';
import { DashboardTab } from './videoAdmin/DashboardTab';
import { AdminTabContentPrimary, AdminTabContentSecondary } from './videoAdmin/AdminTabContent';
import type { AdminTab } from './videoAdmin/dashboardTypes';
import {
  LayoutDashboard,
  Sparkles,
  Video,
  FileText,
  Settings,
  Layers,
  UserCheck,
  ClipboardList,
  BookOpen,
  Target,
  Wallet,
  Camera,
  House,
  CalendarDays,
  CalendarCheck,
  Briefcase,
  Tv,
  SlidersHorizontal,
  Headset,
  HeartPulse,
  Activity,
  ClipboardCheck,
  Dumbbell,
  Flag
} from 'lucide-react';

// Módulos reorganizáveis (ordem padrão). "Principal" é fixo no topo e fica fora desta lista.
const NAV_ITEMS: NavItem<AdminTab>[] = [
  { id: 'orders', label: 'Pedidos', icon: ClipboardList },
  { id: 'missions', label: 'Missões', icon: Target },
  { id: 'finance', label: 'Financeiro', icon: Wallet },
  { id: 'instagram', label: 'Instagram', icon: Camera },
  { id: 'scripts', label: 'Roteiros', icon: BookOpen },
  { id: 'clients', label: 'Clientes', icon: UserCheck },
  { id: 'videos', label: 'Vídeos', icon: Video },
  { id: 'categories', label: 'Categorias', icon: Layers },
  { id: 'services', label: 'Serviços', icon: Sparkles },
  { id: 'content', label: 'Conteúdo', icon: FileText },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'settings', label: 'Configurações', icon: Settings },
  { id: 'agent', label: 'Agente', icon: Headset },
  { id: 'fit', label: 'Fit', icon: HeartPulse },
  { id: 'fitcheckins', label: 'Check-ins', icon: ClipboardCheck },
  { id: 'fittreinos', label: 'Treinos', icon: Dumbbell },
  { id: 'kart', label: 'Kart', icon: Flag },
];
const NAV_GROUPS: NavGroup<AdminTab>[] = [
  { key: 'crm', label: 'CRM', icon: Briefcase, ids: ['orders', 'missions', 'finance', 'instagram', 'scripts', 'clients'] },
  { key: 'streaming', label: 'Streaming', icon: Tv, ids: ['videos', 'categories'] },
  { key: 'pessoal', label: 'Pessoal', icon: Activity, ids: ['fit', 'fitcheckins', 'fittreinos', 'kart'] },
  { key: 'ajustes', label: 'Ajustes', icon: SlidersHorizontal, ids: ['services', 'content', 'dashboard', 'settings', 'agent'] },
];
const NAV_ORDER = NAV_ITEMS.map((item) => item.id);

// Sincronização inicial da aba com a URL
const tabFromPath = (path: string): AdminTab =>
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
      : path === '/admin/pedidos'
      ? 'orders'
      : path === '/admin/roteiros'
      ? 'scripts'
      : path === '/admin/clientes'
      ? 'clients'
      : path === '/admin/missoes'
      ? 'missions'
      : path === '/admin/instagram'
      ? 'instagram'
      : path === '/admin/financeiro'
      ? 'finance'
      : path === '/admin/calendario'
      ? 'calendar'
      : path === '/admin/agendamento-chamadas'
      ? 'videocalls'
      : path === '/admin/agente'
      ? 'agent'
      : path === '/admin/fit'
      ? 'fit'
      : path === '/admin/fit/checkins'
      ? 'fitcheckins'
      : path === '/admin/fit/treinos'
      ? 'fittreinos'
      : path === '/admin/kart'
      ? 'kart'
      : path === '/admin/dashboard'
      ? 'dashboard'
      : path === '/admin/perfil'
      ? 'profile'
      : 'home';

// Monitora alterações na URL para refletir na aba
const syncTabFromPath = (path: string, setCurrentTab: (tab: AdminTab) => void) => {
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
    } else if (path === '/admin/pedidos') {
      setCurrentTab('orders');
    } else if (path === '/admin/roteiros') {
      setCurrentTab('scripts');
    } else if (path === '/admin/clientes') {
      setCurrentTab('clients');
    } else if (path === '/admin/missoes') {
      setCurrentTab('missions');
    } else if (path === '/admin/instagram') {
      setCurrentTab('instagram');
    } else if (path === '/admin/financeiro') {
      setCurrentTab('finance');
    } else if (path === '/admin/calendario') {
      setCurrentTab('calendar');
    } else if (path === '/admin/agendamento-chamadas') {
      setCurrentTab('videocalls');
    } else if (path === '/admin/agente') {
      setCurrentTab('agent');
    } else if (path === '/admin/fit') {
      setCurrentTab('fit');
    } else if (path === '/admin/fit/checkins') {
      setCurrentTab('fitcheckins');
    } else if (path === '/admin/fit/treinos') {
      setCurrentTab('fittreinos');
    } else if (path === '/admin/kart') {
      setCurrentTab('kart');
    } else if (path === '/admin/dashboard') {
      setCurrentTab('dashboard');
    } else if (path === '/admin/perfil') {
      setCurrentTab('profile');
    } else if (path === '/admin') {
      setCurrentTab('home');
    }
};

const navigateToTab = (tabId: AdminTab, navigate: (to: string) => void) => {
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
    } else if (tabId === 'orders') {
      navigate('/admin/pedidos');
    } else if (tabId === 'scripts') {
      navigate('/admin/roteiros');
    } else if (tabId === 'clients') {
      navigate('/admin/clientes');
    } else if (tabId === 'missions') {
      navigate('/admin/missoes');
    } else if (tabId === 'instagram') {
      navigate('/admin/instagram');
    } else if (tabId === 'finance') {
      navigate('/admin/financeiro');
    } else if (tabId === 'calendar') {
      navigate('/admin/calendario');
    } else if (tabId === 'videocalls') {
      navigate('/admin/agendamento-chamadas');
    } else if (tabId === 'agent') {
      navigate('/admin/agente');
    } else if (tabId === 'fit') {
      navigate('/admin/fit');
    } else if (tabId === 'fitcheckins') {
      navigate('/admin/fit/checkins');
    } else if (tabId === 'fittreinos') {
      navigate('/admin/fit/treinos');
    } else if (tabId === 'kart') {
      navigate('/admin/kart');
    } else if (tabId === 'dashboard') {
      navigate('/admin/dashboard');
    } else if (tabId === 'profile') {
      navigate('/admin/perfil');
    } else if (tabId === 'home') {
      navigate('/admin');
    }
};

export const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const { path, navigate } = useRouter();

  const initialTab: AdminTab = tabFromPath(path);

  const [currentTab, setCurrentTab] = useState<AdminTab>(initialTab);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Ícone do iOS ("Adicionar à Tela de Início") acompanha o módulo aberto
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
    if (!link) return;
    const original = link.getAttribute('href') ?? '';
    const slug = ({ '/admin': 'principal', '/admin/services': 'servicos', '/admin/settings': 'configuracoes', '/admin/agendamento-chamadas': 'calendario', '/admin/perfil': 'principal', '/admin/fit': 'principal', '/admin/fit/checkins': 'principal', '/admin/fit/treinos': 'principal' } as Record<string, string>)[path] ?? path.split('/')[2];
    if (slug) link.setAttribute('href', `/images/modules/${slug}.png`);
    return () => link.setAttribute('href', original);
  }, [path]);

  useEffect(() => {
    syncTabFromPath(path, setCurrentTab);
  }, [path]);

  const handleTabChange = (tabId: AdminTab) => {
    setCurrentTab(tabId);
    navigateToTab(tabId, navigate);
  };

  const { servicesCount, isSyncing, syncFeedback, checkAndSyncServices } = useServicesSync();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/admin/login');
    } catch (error) {
      logger.error('[AdminDashboard] Erro ao deslogar:', error);
      setIsLoggingOut(false);
    }
  };

  const pinnedItems: NavItem<AdminTab>[] = [{ id: 'home', label: 'Principal', icon: House }, { id: 'calendar', label: 'Calendário', icon: CalendarDays, children: [{ id: 'videocalls', label: 'Agendamento de chamadas', icon: CalendarCheck }] }];
  const navItems: NavItem<AdminTab>[] = NAV_ITEMS;
  const { order: navOrder, setOrder: setNavOrder, reset: resetNavOrder, customized: navCustomized } = useNavOrder<AdminTab>(user?.uid, NAV_ORDER);

  const navBadges = useNavBadges();

  const renderNav = (variant: 'desktop' | 'mobile', afterSelect?: () => void) => (
    <AdminNav<AdminTab>
      pinned={pinnedItems}
      items={navItems}
      groups={NAV_GROUPS}
      order={navOrder}
      onReorder={setNavOrder}
      onReset={resetNavOrder}
      customized={navCustomized}
      current={currentTab}
      onSelect={(id) => { handleTabChange(id); afterSelect?.(); }}
      badges={navBadges}
      variant={variant}
    />
  );

  return (
    <div className="min-h-screen bg-[#070B14] text-white flex flex-col lg:flex-row antialiased selection:bg-blue-600 selection:text-white">

      <DashboardDesktopSidebar onOpenPublicSite={() => navigate('/')} nav={renderNav('desktop')} />

      {mobileMenuOpen && (
        <DashboardMobileDrawer
          onClose={() => setMobileMenuOpen(false)}
          onOpenPublicSite={() => {
            setMobileMenuOpen(false);
            navigate('/');
          }}
          onLogout={handleLogout}
          isLoggingOut={isLoggingOut}
          nav={renderNav('mobile', () => setMobileMenuOpen(false))}
        />
      )}

      {/* 3. MAIN AREA */}
      <div className="flex-1 flex flex-col min-w-0">

        <DashboardTopbar
          onOpenMenu={() => setMobileMenuOpen(true)}
          onOpenMissions={() => handleTabChange('missions')}
          onOpenProfile={() => handleTabChange('profile')}
          onLogout={handleLogout}
          isLoggingOut={isLoggingOut}
        />

        {/* CONTENT VIEWPORT */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">

          {currentTab === 'home' && <AdminHomePage onNavigate={handleTabChange} />}

          {currentTab === 'dashboard' && (
            <DashboardTab
              user={user}
              servicesCount={servicesCount}
              isSyncing={isSyncing}
              syncFeedback={syncFeedback}
              onSync={() => checkAndSyncServices(false)}
              onNavigate={handleTabChange}
              onOpenVideos={() => setCurrentTab('videos')}
            />
          )}

          <AdminTabContentPrimary currentTab={currentTab} />
          <AdminTabContentSecondary currentTab={currentTab} />

        </main>
      </div>

    </div>
  );
};
