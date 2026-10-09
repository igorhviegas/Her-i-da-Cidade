import { logger } from '../../lib/logger.js';
import React, { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useRouter } from '../../lib/router';
import { dismissAllNotifications, dismissNotification, previousDaysNotifications, runClientSync, subscribeNotifications, type AppNotification } from '../../services/missionsService';

const SYNC_INTERVAL_MS = 10 * 60 * 1000;

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
              {items.map((n) => (
                <li key={n.id} className="flex items-start gap-2 rounded-xl bg-white/5 p-2.5">
                  <button type="button" onClick={() => { setOpen(false); if (n.refType === 'instagram') navigate('/admin/instagram'); else onOpenMissions(); }} className="min-w-0 flex-1 text-left">
                    <span className="block text-xs font-semibold text-white">{n.title}</span>
                    <span className="block truncate text-[11px] text-white/60">{n.body}</span>
                  </button>
                  <button type="button" title="Descartar" onClick={() => void dismissNotification(n.id)} className="text-white/40 hover:text-white"><X className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
