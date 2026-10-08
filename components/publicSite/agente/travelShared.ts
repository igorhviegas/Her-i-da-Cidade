import { DEFAULT_EVENT_FEE, DEFAULT_KM_RATE, MAX_DAYS, formatDateKey } from '../../../services/travelCost.js';

export interface DayDraft {
  /** 'YYYY-MM-DD'; vai no texto do WhatsApp e define o dia da importação. */
  date: string;
  events: string[];
  /** Parada: padrão do servidor, sem parada ou outro endereço. */
  stopMode: 'default' | 'none' | 'custom';
  stopAddress: string;
  /** null = endereço padrão; string = outro endereço só neste dia. */
  start: string | null;
  end: string | null;
}
export interface Draft { code: string; days: DayDraft[]; kmRate: string; eventFee: string }
export const STORAGE_KEY = 'hdc.agente.deslocamento.v1';

/** Data de hoje no aparelho ('YYYY-MM-DD'). */
export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const emptyDay = (date: string): DayDraft => ({ date, events: [''], stopMode: 'default', stopAddress: '', start: null, end: null });
export const emptyDraft = (): Draft => ({ code: '', days: [emptyDay(todayKey())], kmRate: String(DEFAULT_KM_RATE).replace('.', ','), eventFee: String(DEFAULT_EVENT_FEE) });

/** Lê o rascunho salvo. O formato antigo (um dia só, sem `days`) vira um dia com a data de hoje. */
export function load(): Draft {
  const base = emptyDraft();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    const days = Array.isArray(saved.days) && saved.days.length > 0 ? saved.days : Array.isArray(saved.events) ? [saved] : null;
    return {
      code: typeof saved.code === 'string' ? saved.code : '',
      kmRate: typeof saved.kmRate === 'string' ? saved.kmRate : base.kmRate,
      eventFee: typeof saved.eventFee === 'string' ? saved.eventFee : base.eventFee,
      days: days ? days.slice(0, MAX_DAYS).map((day: Partial<DayDraft>) => ({ ...emptyDay(typeof day.date === 'string' ? day.date : todayKey()), ...day, events: Array.isArray(day.events) && day.events.length > 0 ? day.events : [''] })) : base.days,
    };
  } catch { return base; }
}

/** Todos os endereços preenchidos (os que não usam o padrão do servidor). */
export const isReady = (days: DayDraft[]) => days.every((day) => day.events.every((e) => e.trim()) && (day.stopMode !== 'custom' || day.stopAddress.trim())
  && (day.start === null || day.start.trim()) && (day.end === null || day.end.trim()));

export const dayLabel = (date: string, i: number) => formatDateKey(date) || `dia ${i + 1}`;

export const btn = 'touch-manipulation select-none active:scale-[0.98] transition-transform';
export const field = 'h-14 w-full rounded-2xl border border-white/10 bg-[#0D1527] px-4 text-base text-white placeholder:text-white/35 focus:border-blue-400 focus:outline-none';
export const card = 'rounded-2xl border border-white/10 bg-[#0D1527] px-4 py-4';
export const heading = 'mb-2 block text-[11px] font-bold uppercase tracking-widest text-white/40';
export const smallBtn = `${btn} rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/70`;
