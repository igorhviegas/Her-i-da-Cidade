import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { Zap } from 'lucide-react';
import { db } from '../lib/firebase';
import { BASELINE_PATH, eventReward, levelInfo, totalXp, type LevelInfo, type XpBaseline } from '../functions/xp.js';
import { ACTIVITY_LOG_COLLECTION } from '../services/activityLog';
import { formatMoney } from '../components/admin/financeFormat';

export interface XpContextType {
  /** Já recebeu a linha de base (ou soube que ela não existe). */
  ready: boolean;
  baseline: XpBaseline | null;
  total: number;
  fromEvents: number;
  /** null enquanto o XP não foi ativado. */
  level: LevelInfo | null;
}

const XpContext = createContext<XpContextType | undefined>(undefined);

const TOAST_MS = 7000;
const HIDDEN_KEY = 'hdc.finance.revenueHidden'; // mesma preferência de "ocultar valores" do topo e do Perfil
const readHidden = () => { try { return localStorage.getItem(HIDDEN_KEY) === '1'; } catch { return false; } };
const LABELS: Record<string, string> = {
  order_completed: 'Pedido concluído', mission: 'Missão concluída', task_occurrence: 'Tarefa concluída',
  goal_completed: 'Meta atingida', script_ready: 'Roteiro pronto', content_published: 'Conteúdo publicado',
};

interface Toast { id: string; label: string; xp: number; revenue: number; cost: number }

/**
 * XP ao vivo (linha de base + eventos do activityLog) para o topo e o Perfil, e as janelinhas de ganho: cada evento NOVO registrado
 * (pedido, missão, tarefa, meta, conteúdo) mostra o XP e, quando mexe no Financeiro, o faturado (verde) e o custo (vermelho).
 * O Instagram é automático e não gera janelinha. Só avisa depois do primeiro carregamento (o histórico não vira avisos).
 */
export const XpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [baseline, setBaseline] = useState<XpBaseline | null>(null);
  const [baselineReady, setBaselineReady] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const baselineRef = useRef<XpBaseline | null>(null);

  const dismiss = useCallback((id: string) => setToasts((list) => list.filter((toast) => toast.id !== id)), []);

  useEffect(() => {
    if (!db) return;
    return onSnapshot(doc(db, ...BASELINE_PATH), (snapshot) => {
      baselineRef.current = snapshot.exists() ? (snapshot.data() as XpBaseline) : null;
      setBaseline(baselineRef.current);
      setBaselineReady(true);
    }, (error) => { console.error('[XpContext] linha de base indisponível', error); setBaselineReady(true); });
  }, []);

  useEffect(() => {
    if (!db) return;
    let first = true;
    return onSnapshot(collection(db, ACTIVITY_LOG_COLLECTION), (snapshot) => {
      setEvents(snapshot.docs.map((item) => ({ ...item.data(), id: item.id })));
      if (first) { first = false; return; }
      for (const change of snapshot.docChanges()) {
        if (change.type !== 'added') continue;
        const event = change.doc.data();
        const reward = eventReward(baselineRef.current, { ...event, refId: event.refId ?? change.doc.id });
        if (!reward) continue;
        const id = change.doc.id;
        setToasts((list) => [...list.filter((toast) => toast.id !== id), { id, label: LABELS[event.type] ?? 'Atividade concluída', ...reward }]);
        window.setTimeout(() => dismiss(id), TOAST_MS);
      }
    }, (error) => console.error('[XpContext] histórico de atividades indisponível', error));
  }, [dismiss]);

  const value = useMemo<XpContextType>(() => {
    const result = totalXp(baseline, events);
    return { ready: baselineReady, baseline, total: result?.total ?? 0, fromEvents: result?.events ?? 0, level: result ? levelInfo(result.total) : null };
  }, [baseline, baselineReady, events]);

  const hidden = toasts.some((toast) => toast.revenue || toast.cost) ? readHidden() : false;
  const money = (amount: number) => (hidden ? 'R$ ••••' : formatMoney(amount));

  return (
    <XpContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-2" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <button key={toast.id} type="button" onClick={() => dismiss(toast.id)} aria-label={`${toast.label}. Fechar aviso`}
            className="pointer-events-auto animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-amber-400/30 bg-[#0D1527]/95 p-3.5 text-left shadow-2xl shadow-black/40 backdrop-blur duration-300">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/50">{toast.label}</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
              {toast.xp > 0 && <span className="flex items-center gap-1 text-lg font-black tabular-nums text-amber-300"><Zap className="h-4 w-4" aria-hidden />+{toast.xp.toLocaleString('pt-BR')} XP</span>}
              {toast.revenue > 0 && <span className="text-sm font-bold tabular-nums text-emerald-300">+ {money(toast.revenue)}</span>}
              {toast.cost > 0 && <span className="text-sm font-bold tabular-nums text-red-300">− {money(toast.cost)}</span>}
            </div>
          </button>
        ))}
      </div>
    </XpContext.Provider>
  );
};

export function useXp(): XpContextType {
  const context = useContext(XpContext);
  if (!context) throw new Error('useXp must be used within an XpProvider');
  return context;
}
