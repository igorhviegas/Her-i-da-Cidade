import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useXp } from '../../context/XpContext';

/** Avatar do topo: mostra o nível; nome, e-mail e "Sair" só aparecem ao abrir o menu. */
export const ProfileMenu: React.FC<{ onOpenProfile: () => void; onLogout: () => void; loggingOut: boolean }> = ({ onOpenProfile, onLogout, loggingOut }) => {
  const { user, adminData } = useAuth();
  const { level } = useXp();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  const name = user?.displayName || adminData?.displayName || user?.email?.split('@')[0] || 'Administrador';
  const item = 'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors';

  return (
    <div ref={root} className="relative pl-3 border-l border-white/10">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label="Abrir menu do perfil"
        className="flex items-center gap-2.5 rounded-xl p-1 hover:bg-white/5 transition-colors">
        {level && (
          <div className="hidden md:block w-24 text-right">
            <p className="text-xs font-bold text-amber-300 leading-none">Nível {level.level}</p>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${Math.min(100, level.percent)}%` }} /></div>
          </div>
        )}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-inner ring-2 ring-white/10">
          {name[0].toUpperCase()}
        </div>
        <ChevronDown className={`hidden sm:block h-3.5 w-3.5 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-64 rounded-2xl border border-white/10 bg-[#0D1527] p-2 shadow-2xl shadow-black/50 animate-in fade-in duration-150">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-bold text-white">{name}</p>
            <p className="truncate text-xs text-white/50">@{user?.email?.split('@')[0]}</p>
            <p className="truncate font-mono text-[11px] text-white/40">{user?.email}</p>
          </div>
          <div className="my-1 border-t border-white/10" />
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onOpenProfile(); }} className={`${item} text-white/80 hover:bg-white/10 hover:text-white`}>
            <UserRound className="h-4 w-4" aria-hidden />Meu perfil{level && <span className="ml-auto text-xs font-bold text-amber-300">Nv {level.level}</span>}
          </button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onLogout(); }} disabled={loggingOut} className={`${item} text-red-300 hover:bg-red-500/15 disabled:opacity-50`}>
            <LogOut className="h-4 w-4" aria-hidden />Sair do painel
          </button>
        </div>
      )}
    </div>
  );
};
