import { logger } from '../../lib/logger.js';
import React, { useEffect, useState } from 'react';
import { Bell, Camera, CircleX, Clock, FileText, ListChecks, Target, Trophy, TriangleAlert, X, type LucideIcon } from 'lucide-react';
import { useRouter } from '../../lib/router';
import { dismissAllNotifications, dismissNotification, previousDaysNotifications, runClientSync, subscribeNotifications, type AppNotification } from '../../services/missionsService';

const SYNC_INTERVAL_MS = 10 * 60 * 1000;

type Look = { icon: LucideIcon; badge: string; card: string };
// Classes literais (o Tailwind só gera o que aparece escrito). Vermelho + alerta é reservado ao que é mais relevante.
const COLORS = {
  red: { badge: 'bg-red-500/20 text-red-400', card: 'border-red-500/30 bg-red-500/10' },
  amber: { badge: 'bg-amber-500/20 text-amber-300', card: 'border-transparent bg-white/5' },
  blue: { badge: 'bg-blue-500/20 text-blue-300', card: 'border-transparent bg-white/5' },
  violet: { badge: 'bg-violet-500/20 text-violet-300', card: 'border-transparent bg-white/5' },
  green: { badge: 'bg-emerald-500/20 text-emerald-300', card: 'border-transparent bg-white/5' },
} as const;
const look = (icon: LucideIcon, color: keyof typeof COLORS): Look => ({ icon, ...COLORS[color] });
/** Ícone e cor por tipo de aviso (tipos criados em functions/missions-core.js e functions/instagram-alerts.js). */
const LOOKS: Record<string, Look> = {
  mission_overdue: look(TriangleAlert, 'red'),
  instagram_token_invalid: look(TriangleAlert, 'red'),
  instagram_token_expiring: look(TriangleAlert, 'red'),
  mission_due_soon: look(Clock, 'amber'),
  task_missed: look(CircleX, 'amber'),
  instagram_stale: look(Camera, 'amber'),
  task_today: look(ListChecks, 'blue'),
  goal_near: look(Target, 'violet'),
  goal_completed: look(Trophy, 'green'),
  monthly_report: look(FileText, 'blue'),
};
const DEFAULT_LOOK: Look = { icon: Bell, badge: 'bg-white/10 text-white/60', card: 'border-transparent bg-white/5' };

/** Avisos internos do CRM. Também dispara a sincronização de tarefas/avisos ao abrir o painel e a cada 10 min. */
export const NotificationsBell: React.FC<{ onOpenMissions: () => void }> = ({ onOpenMissions }) => {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const { navigate } = useRouter();

  useEffect(() => {
    const sync = () => runClientSync().catch((error) => logger.error('[NotificationsBell] sincronização falhou', error));
    void sync();
    const timer = window.setInterval(sync, SYNC_INTERVAL_MS);
    const unsubscribe = subscribeNotifications(setItems);
    return () => { window.clearInterval(timer); unsubscribe(); };
  }, []);

  const previous = previousDaysNotifications(items);

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} title="Avisos" className="relative rounded-xl border border-white/10 bg-white/5 p-2 text-white/70 hover:text-white">
        <Bell className="h-4 w-4" />
        {items.length > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{items.length > 9 ? '9+' : items.length}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-[#0D1527] p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-white/60">Avisos</span>
            {items.length > 0 && (
              <span className="flex items-center gap-3">
                {previous.length > 0 && <button type="button" onClick={() => void dismissAllNotifications(previous)} className="text-[11px] font-semibold text-blue-400 hover:text-blue-300">Limpar anteriores</button>}
                <button type="button" onClick={() => void dismissAllNotifications(items)} className="text-[11px] font-semibold text-blue-400 hover:text-blue-300">Descartar todos</button>
              </span>
            )}
          </div>
          {items.length === 0 ? <p className="py-4 text-center text-xs text-white/40">Nenhum aviso.</p> : (
            <ul className="max-h-80 space-y-1.5 overflow-y-auto">
              {items.map((n) => {
                const { icon: Icon, badge, card } = LOOKS[n.type] ?? DEFAULT_LOOK;
                return (
                <li key={n.id} className={`flex items-start gap-2.5 rounded-xl border p-2.5 ${card}`}>
                  <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${badge}`}><Icon className="h-4 w-4" aria-hidden /></span>
                  <button type="button" onClick={() => { setOpen(false); if (n.refType === 'instagram') navigate('/admin/instagram'); else if (n.refType === 'report') navigate(`/admin/financeiro?relatorio=${n.refId}`); else onOpenMissions(); }} className="min-w-0 flex-1 text-left">
                    <span className="block text-xs font-semibold text-white">{n.title}</span>
                    <span className="line-clamp-3 text-[11px] text-white/60">{n.body}</span>
                  </button>
                  <button type="button" title="Descartar" onClick={() => void dismissNotification(n.id)} className="text-white/40 hover:text-white"><X className="h-3.5 w-3.5" /></button>
                </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
