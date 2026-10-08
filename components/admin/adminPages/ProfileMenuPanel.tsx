import React from 'react';
import { LogOut, UserRound } from 'lucide-react';
import type { useXp } from '../../../context/XpContext';

interface ProfileMenuPanelProps {
  name: string;
  email: string | null | undefined;
  level: ReturnType<typeof useXp>['level'];
  loggingOut: boolean;
  onOpenProfile: () => void;
  onLogout: () => void;
}

const item = 'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors';

export const ProfileMenuPanel: React.FC<ProfileMenuPanelProps> = ({ name, email, level, loggingOut, onOpenProfile, onLogout }) => (
  <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-64 rounded-2xl border border-white/10 bg-[#0D1527] p-2 shadow-2xl shadow-black/50 animate-in fade-in duration-150">
    <div className="px-3 py-2">
      <p className="truncate text-sm font-bold text-white">{name}</p>
      <p className="truncate text-xs text-white/50">@{email?.split('@')[0]}</p>
      <p className="truncate font-mono text-[11px] text-white/40">{email}</p>
    </div>
    <div className="my-1 border-t border-white/10" />
    <button type="button" role="menuitem" onClick={onOpenProfile} className={`${item} text-white/80 hover:bg-white/10 hover:text-white`}>
      <UserRound className="h-4 w-4" aria-hidden />Meu perfil{level && <span className="ml-auto text-xs font-bold text-amber-300">Nv {level.level}</span>}
    </button>
    <button type="button" role="menuitem" onClick={onLogout} disabled={loggingOut} className={`${item} text-red-300 hover:bg-red-500/15 disabled:opacity-50`}>
      <LogOut className="h-4 w-4" aria-hidden />Sair do painel
    </button>
  </div>
);
