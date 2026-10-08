import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Plus, RefreshCw, Search } from 'lucide-react';
import { useRouter } from '../../lib/router';
import { addDays, dateKey } from '../../functions/missions-core.js';
import { shiftDate, visibleRange, type CalendarView } from '../../services/calendarEvents.js';
import { searchCalendarEvents, useCalendarEvents, type CalendarEvent } from '../../services/calendarService';
import { DayAgenda } from './CalendarAgenda';
import { ErrorNote, WarningNote, cardClass, ghostButton, primaryButton } from './missionsUi';
import { DayList, MonthGrid, WeekList, fmt } from './ordersFlow/CalendarViews';
import { EventDialog } from './ordersFlow/CalendarEventDialog';

const VIEWS: { id: CalendarView; label: string }[] = [{ id: 'month', label: 'Mês' }, { id: 'week', label: 'Semana' }, { id: 'day', label: 'Dia' }];

export const AdminCalendarPage: React.FC = () => {
  const { search } = useRouter();
  const today = dateKey(new Date());
  const [selected, setSelected] = useState(() => {
    const requested = new URLSearchParams(search).get('date');
    return requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : today;
  });
  const [view, setView] = useState<CalendarView>('month');
  const [open, setOpen] = useState<{ event: CalendarEvent | null; mode: 'view' | 'form' } | null>(null);
  const pendingEvent = useRef(new URLSearchParams(search).get('event'));

  const range = useMemo(() => visibleRange(view, selected), [view, selected]);
  const { state, reload } = useCalendarEvents(range.from, range.to);

  // Vindo da Principal: abre o compromisso clicado assim que a agenda carrega.
  useEffect(() => {
    if (state.status !== 'ready' || !pendingEvent.current) return;
    const event = state.events.find((e) => e.id === pendingEvent.current);
    pendingEvent.current = null;
    if (event) setOpen({ event, mode: 'view' });
  }, [state]);

  const title = view === 'day' ? fmt(selected, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : view === 'week' ? `${fmt(range.from, { day: 'numeric', month: 'short' })} – ${fmt(range.to, { day: 'numeric', month: 'short', year: 'numeric' })}`
    : fmt(selected, { month: 'long', year: 'numeric' });
  const events = state.status === 'ready' ? state.events : [];
  const view_ = (event: CalendarEvent) => setOpen({ event, mode: 'view' });

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">Calendário</h2>
          <p className="text-xs text-white/50">Compromissos do Google Agenda. Eventos criados aqui não geram pedidos no CRM.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={reload} className={ghostButton} title="Recarregar da agenda"><RefreshCw className={`h-3.5 w-3.5 ${state.status === 'loading' ? 'animate-spin' : ''}`} />Atualizar</button>
          <button type="button" onClick={() => setOpen({ event: null, mode: 'form' })} className={primaryButton}><Plus className="h-4 w-4" />Novo evento</button>
        </div>
      </div>

      <section className="rounded-2xl border border-orange-400/30 bg-[#0D1527] p-5 shadow-lg" aria-label="Compromissos do dia">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
          <CalendarDays className="h-4 w-4 text-orange-300" aria-hidden />
          {selected === today ? 'Compromissos de hoje' : 'Compromissos de'} <span className="font-semibold capitalize text-white/60">{fmt(selected, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </h3>
        <DayAgenda state={state} dayKey={selected} emptyText={selected === today ? 'Nenhum compromisso para hoje' : 'Nenhum compromisso para este dia'} onOpen={view_} onEdit={(event) => setOpen({ event, mode: 'form' })} onRetry={reload} />
      </section>

      <EventSearch onOpen={view_} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setSelected(shiftDate(view, selected, -1))} className={ghostButton} aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => setSelected(today)} className={ghostButton}>Hoje</button>
          <button type="button" onClick={() => setSelected(shiftDate(view, selected, 1))} className={ghostButton} aria-label="Próximo"><ChevronRight className="h-4 w-4" /></button>
          <h3 className="ml-2 text-base font-bold capitalize text-white">{title}</h3>
        </div>
        <div className="flex gap-1 rounded-xl border border-white/10 bg-[#0B1120] p-1">
          {VIEWS.map(({ id, label }) => (
            <button key={id} type="button" onClick={() => setView(id)} aria-pressed={view === id} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${view === id ? 'bg-blue-600 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>{label}</button>
          ))}
        </div>
      </div>

      <CalendarBody state={state} view={view} selected={selected} range={range} today={today} events={events} onSelect={setSelected} onOpen={view_} />

      {open && (
        <EventDialog
          event={open.event} mode={open.mode} defaultDate={selected}
          onMode={(mode) => setOpen((current) => current && { ...current, mode })}
          onClose={() => setOpen(null)}
          onSaved={(saved) => { setSelected(saved.startKey); setOpen({ event: saved, mode: 'view' }); }}
          onDeleted={() => setOpen(null)}
        />
      )}
    </div>
  );
};

type CalendarState = ReturnType<typeof useCalendarEvents>['state'];

interface CalendarBodyProps {
  state: CalendarState;
  view: CalendarView;
  selected: string;
  range: { from: string; to: string };
  today: string;
  events: CalendarEvent[];
  onSelect: (key: string) => void;
  onOpen: (event: CalendarEvent) => void;
}

const CalendarBody: React.FC<CalendarBodyProps> = ({ state, view, selected, range, today, events, onSelect, onOpen }) => (
  <>
    {state.status === 'error' && <ErrorNote message={state.message} />}
    {state.status === 'ready' && state.truncated && <WarningNote message="Há mais eventos neste período do que o limite de exibição; alguns não aparecem. Use um período menor ou a busca." />}
    {state.status === 'loading' && <div className="flex justify-center py-8 text-white/50"><Loader2 className="h-5 w-5 animate-spin" /></div>}

    {state.status !== 'loading' && (
      view === 'month' ? <MonthGrid range={range} month={selected.slice(0, 7)} events={events} today={today} selected={selected} onSelect={onSelect} onOpen={onOpen} />
      : view === 'week' ? <WeekList range={range} events={events} today={today} selected={selected} onSelect={onSelect} onOpen={onOpen} />
      : <DayList events={events} dayKey={selected} onOpen={onOpen} />
    )}
  </>
);

// ------------------------------------------------------------------------- busca

const SEARCH_SPANS = {
  around: { label: 'Últimos 3 meses e próximos 10', from: -90, to: 300 },
  future: { label: 'Próximos 12 meses', from: 0, to: 365 },
  past: { label: 'Últimos 12 meses', from: -365, to: 0 },
} as const;

/** A busca é feita pelo Google (título, descrição — onde estão cliente e criança — e local), sempre dentro de um período (limite de 400 dias). */
const EventSearch: React.FC<{ onOpen: (event: CalendarEvent) => void }> = ({ onOpen }) => {
  const [term, setTerm] = useState('');
  const [span, setSpan] = useState<keyof typeof SEARCH_SPANS>('around');
  const [result, setResult] = useState<{ status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; events: CalendarEvent[]; truncated: boolean; term: string }>({ status: 'idle' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = term.trim();
    if (q.length < 2) { setResult({ status: 'error', message: 'Digite ao menos 2 letras para buscar.' }); return; }
    setResult({ status: 'loading' });
    const today = dateKey(new Date());
    try {
      const { events, truncated } = await searchCalendarEvents(q, addDays(today, SEARCH_SPANS[span].from), addDays(today, SEARCH_SPANS[span].to));
      setResult({ status: 'ready', events, truncated, term: q });
    } catch (error) {
      setResult({ status: 'error', message: error instanceof Error ? error.message : 'A busca falhou.' });
    }
  };

  return (
    <section className={cardClass} aria-label="Buscar eventos">
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" aria-hidden />
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar por título, cliente, criança ou local" aria-label="Buscar eventos" maxLength={100} className="w-full rounded-xl border border-white/10 bg-[#070B14] py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-blue-500/60" />
        </div>
        <select value={span} onChange={(e) => setSpan(e.target.value as keyof typeof SEARCH_SPANS)} aria-label="Período da busca" className="rounded-xl border border-white/10 bg-[#070B14] px-3 py-2.5 text-xs text-white outline-none">
          {Object.entries(SEARCH_SPANS).map(([id, { label }]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <button type="submit" disabled={result.status === 'loading'} className={primaryButton}>{result.status === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Buscar</button>
        {result.status !== 'idle' && result.status !== 'loading' && <button type="button" onClick={() => { setResult({ status: 'idle' }); setTerm(''); }} className={ghostButton}>Limpar</button>}
      </form>
      {result.status === 'error' && <div className="mt-3"><ErrorNote message={result.message} /></div>}
      {result.status === 'ready' && (
        <div className="mt-3">
          {result.events.length === 0 ? <p className="text-sm text-white/50">Nenhum evento encontrado para “{result.term}”.</p> : (
            <ul className="space-y-1.5">
              {result.events.map((event) => (
                <li key={event.id}>
                  <button type="button" onClick={() => onOpen(event)} className="flex w-full items-center gap-3 rounded-xl border border-white/10 px-3 py-2 text-left hover:bg-white/5">
                    <span className="w-24 shrink-0 text-xs tabular-nums text-white/60">{fmt(event.startKey, { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                    <span className="w-16 shrink-0 text-xs font-semibold tabular-nums text-orange-300">{event.allDay ? 'Dia todo' : event.startTime}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{event.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {result.truncated && <p className="mt-2 text-[11px] text-amber-300">Resultado parcial: refine a busca ou reduza o período.</p>}
        </div>
      )}
    </section>
  );
};

