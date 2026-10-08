import { useCallback, useState } from 'react';
import type { FiredAlerts } from '../../../services/agentContent.js';
import type { useAgentPlayer } from '../../agente/useAgentPlayer';

export type Player = ReturnType<typeof useAgentPlayer>;

export const btn = 'touch-manipulation select-none active:scale-[0.98] transition-transform';
export const bigBtn = `${btn} flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-[#0D1527] px-5 py-5 text-left`;

export interface EventState { startedAt: number; adjustMs: number; fired: FiredAlerts }
export interface Saved { checks: Record<string, boolean>; notes: Record<string, string>; event: EventState | null }
const STORAGE_KEY = 'hdc.agente.v1';
export const EMPTY: Saved = { checks: {}, notes: {}, event: null };

function load(): Saved {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }; } catch { return EMPTY; }
}

/** Estado do evento (checklist, anotações, timer) persistido no aparelho: o Safari pode recarregar a página com o app em segundo plano. */
export function useSaved() {
  const [saved, setSaved] = useState<Saved>(load);
  const update = useCallback((fn: (s: Saved) => Saved) => setSaved((prev) => {
    const next = fn(prev);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* sem armazenamento: vale só nesta sessão */ }
    return next;
  }), []);
  return [saved, update] as const;
}
