import type { Dispatch, SetStateAction } from 'react';
import { computeTimer, resetFired } from '../../../services/agentContent.js';
import { EMPTY, type Saved } from './agenteShared';

/** Iniciar, ajustar o timer e limpar tudo para um novo evento. */
export function useEventActions(update: (fn: (s: Saved) => Saved) => void, setNow: Dispatch<SetStateAction<number>>, goHome: () => void) {
  const startEvent = () => {
    if (!window.confirm('Iniciar o evento agora? O timer de 1 hora começa neste momento.')) return;
    setNow(Date.now());
    update((s) => ({ ...s, event: { startedAt: Date.now(), adjustMs: 0, fired: {} } }));
  };
  const adjust = (minutes: number) => update((s) => {
    if (!s.event) return s;
    const adjustMs = s.event.adjustMs + minutes * 60_000;
    const remaining = computeTimer({ ...s.event, adjustMs }, Date.now()).remainingMs;
    return { ...s, event: { ...s.event, adjustMs, fired: resetFired(remaining, s.event.fired) } };
  });
  const resetAll = () => {
    if (window.confirm('Limpar checklist, anotações e timer para um novo evento?')) { update(() => EMPTY); goHome(); }
  };
  return { startEvent, adjust, resetAll };
}
