import React from 'react';
import { Shield, ExternalLink, Menu, X, LogOut } from 'lucide-react';
import { NotificationsBell } from '../NotificationsBell';
import { FinanceRevenueBadge } from '../FinanceRevenueBadge';
import { ProfileMenu } from '../ProfileMenu';

interface DashboardDesktopSidebarProps {
  onOpenPublicSite: () => void;
  nav: React.ReactNode;
}

// 1. SIDEBAR DESKTOP
export const DashboardDesktopSidebar: React.FC<DashboardDesktopSidebarProps> = ({ onOpenPublicSite, nav }) => (
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

    {/* Link to Public Site */}
    <div className="p-4 pb-0">
      <button
        onClick={onOpenPublicSite}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/5"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        <span>Ver Site Público</span>
      </button>
    </div>

    {/* Navigation Items */}
    <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
      <div className="px-3 py-2 text-[10px] font-semibold text-white/40 uppercase tracking-widest">
        Navegação Principal
      </div>
      {nav}
    </nav>
  </aside>
);

interface DashboardMobileDrawerProps {
  onClose: () => void;
  onOpenPublicSite: () => void;
  onLogout: () => void;
  isLoggingOut: boolean;
  nav: React.ReactNode;
}

// 2. SIDEBAR MOBILE (DRAWER)
export const DashboardMobileDrawer: React.FC<DashboardMobileDrawerProps> = ({ onClose, onOpenPublicSite, onLogout, isLoggingOut, nav }) => (
  <div className="fixed inset-0 z-50 lg:hidden flex">
    {/* Backdrop */}
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
      onClick={onClose}
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
          onClick={onClose}
          className="p-1.5 text-white/60 hover:text-white rounded-lg hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 pb-0">
        <button
          onClick={onOpenPublicSite}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white/70 hover:text-white bg-white/5 rounded-xl"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Ver Site Público</span>
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {nav}
      </nav>

      <div className="p-4 border-t border-white/10 space-y-2">
        <button
          onClick={onLogout}
          disabled={isLoggingOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 rounded-xl"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sair do Painel</span>
        </button>
      </div>
    </div>
  </div>
);

interface DashboardTopbarProps {
  onOpenMenu: () => void;
  onOpenMissions: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  isLoggingOut: boolean;
}

// TOPBAR
export const DashboardTopbar: React.FC<DashboardTopbarProps> = ({ onOpenMenu, onOpenMissions, onOpenProfile, onLogout, isLoggingOut }) => (
  <header className="h-16 bg-[#0B1120]/80 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
    <div className="flex min-w-0 items-center gap-3">
      {/* Mobile Hamburger */}
      <button
        onClick={onOpenMenu}
        className="lg:hidden p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex min-w-0 items-center gap-2">
        <h1 className="hidden min-[420px]:block truncate text-base sm:text-lg font-bold text-white tracking-tight">
          Painel Administrativo
        </h1>
        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Online
        </span>
      </div>
    </div>

    {/* User Status & Logout */}
    <div className="flex shrink-0 items-center gap-2 sm:gap-4">
      <FinanceRevenueBadge />
      <NotificationsBell onOpenMissions={onOpenMissions} />
      <ProfileMenu onOpenProfile={onOpenProfile} onLogout={onLogout} loggingOut={isLoggingOut} />
    </div>
  </header>
);
