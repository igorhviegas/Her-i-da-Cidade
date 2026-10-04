import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Loader2, MapPin, Plus, RefreshCw, Search, Trash2, X, Pencil, AlertTriangle } from 'lucide-react';
import { useRouter } from '../../lib/router';
import { addDays, dateKey } from '../../functions/missions-core.js';
import { daysBetween, eventsOnDay, shiftDate, visibleRange, type CalendarView } from '../../services/calendarEvents.js';
import { deleteCalendarEvent, saveCalendarEvent, searchCalendarEvents, useCalendarEvents, type CalendarEvent } from '../../services/calendarService';
import { DayAgenda, eventTimeLabel } from './CalendarAgenda';
import { ErrorNote, WarningNote, cardClass, ghostButton, inputClass, labelClass, primaryButton } from './missionsUi';

const fmt = (key: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', { ...options, timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`));
const WEEKDAY_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const VIEWS: { id: CalendarView; label: string }[] = [{ id: 'month', label: 'Mês' }, { id: 'week', label: 'Semana' }, { id: 'day', label: 'Dia' }];
const chipClass = (event: CalendarEvent) => (event.crm ? 'bg-orange-500/20 text-orange-200 hover:bg-orange-500/30' : 'bg-blue-500/20 text-blue-200 hover:bg-blue-500/30');

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

      {state.status === 'error' && <ErrorNote message={state.message} />}
      {state.status === 'ready' && state.truncated && <WarningNote message="Há mais eventos neste período do que o limite de exibição; alguns não aparecem. Use um período menor ou a busca." />}
      {state.status === 'loading' && <div className="flex justify-center py-8 text-white/50"><Loader2 className="h-5 w-5 animate-spin" /></div>}

      {state.status !== 'loading' && (
        view === 'month' ? <MonthGrid range={range} month={selected.slice(0, 7)} events={events} today={today} selected={selected} onSelect={setSelected} onOpen={view_} />
        : view === 'week' ? <WeekList range={range} events={events} today={today} selected={selected} onSelect={setSelected} onOpen={view_} />
        : <DayList events={events} dayKey={selected} onOpen={view_} />
      )}

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

// ------------------------------------------------------------------- visualizações

interface ViewProps { events: CalendarEvent[]; today: string; selected: string; onSelect: (key: string) => void; onOpen: (event: CalendarEvent) => void }

const MonthGrid: React.FC<ViewProps & { range: { from: string; to: string }; month: string }> = ({ range, month, events, today, selected, onSelect, onOpen }) => (
  <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D1527]">
    <div className="grid grid-cols-7 border-b border-white/10 text-center text-[11px] font-semibold uppercase tracking-wider text-white/45">
      {WEEKDAY_SHORT.map((d) => <div key={d} className="py-2">{d}</div>)}
    </div>
    <div className="grid grid-cols-7">
      {daysBetween(range.from, range.to).map((key) => {
        const dayEvents = eventsOnDay(events, key);
        const isToday = key === today;
        return (
          <div key={key} role="button" tabIndex={0} aria-label={`${fmt(key, { day: 'numeric', month: 'long' })}, ${dayEvents.length} compromissos`} aria-current={isToday ? 'date' : undefined}
            onClick={() => onSelect(key)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(key); } }}
            className={`min-h-[4.5rem] cursor-pointer border-b border-r border-white/5 p-1 text-left outline-none transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-blue-500 sm:min-h-[6.5rem] ${key === selected ? 'bg-blue-500/10 ring-1 ring-inset ring-blue-400/60' : ''} ${key.startsWith(month) ? '' : 'opacity-40'}`}>
            <span className={`mb-1 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1 text-xs font-semibold ${isToday ? 'bg-blue-600 text-white' : 'text-white/70'}`}>{Number(key.slice(8))}</span>
            <ul className="space-y-0.5">
              {dayEvents.slice(0, 3).map((event) => (
                <li key={event.id}>
                  <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(event); }} title={event.title}
                    className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium sm:text-[11px] ${chipClass(event)}`}>
                    {event.startTime && <span className="hidden tabular-nums sm:inline">{event.startTime} </span>}{event.title}
                  </button>
                </li>
              ))}
              {dayEvents.length > 3 && <li className="px-1 text-[10px] text-white/45">+{dayEvents.length - 3}</li>}
            </ul>
          </div>
        );
      })}
    </div>
  </div>
);

const WeekList: React.FC<ViewProps & { range: { from: string; to: string } }> = ({ range, events, today, selected, onSelect, onOpen }) => (
  <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
    {daysBetween(range.from, range.to).map((key) => {
      const dayEvents = eventsOnDay(events, key);
      return (
        <div key={key} className={`rounded-xl border p-2 ${key === selected ? 'border-blue-400/60 bg-blue-500/10' : 'border-white/10 bg-[#0D1527]'}`}>
          <button type="button" onClick={() => onSelect(key)} className={`mb-2 flex w-full items-center gap-2 text-xs font-semibold ${key === today ? 'text-blue-300' : 'text-white/60'}`}>
            <span className={`inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1 ${key === today ? 'bg-blue-600 text-white' : ''}`}>{Number(key.slice(8))}</span>
            <span className="uppercase">{fmt(key, { weekday: 'short' })}</span>
          </button>
          {dayEvents.length === 0 ? <p className="text-[11px] text-white/30">—</p> : (
            <ul className="space-y-1">
              {dayEvents.map((event) => (
                <li key={event.id}>
                  <button type="button" onClick={() => onOpen(event)} className={`w-full rounded-lg px-2 py-1.5 text-left text-xs ${chipClass(event)}`}>
                    <span className="block text-[10px] font-semibold tabular-nums opacity-80">{eventTimeLabel(event)}</span>
                    <span className="block truncate font-medium">{event.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    })}
  </div>
);

const DayList: React.FC<{ events: CalendarEvent[]; dayKey: string; onOpen: (event: CalendarEvent) => void }> = ({ events, dayKey, onOpen }) => {
  const list = eventsOnDay(events, dayKey);
  if (!list.length) return <p className={`${cardClass} text-center text-sm text-white/50`}>Nenhum compromisso neste dia.</p>;
  return (
    <ul className="space-y-2">
      {list.map((event) => (
        <li key={event.id}>
          <button type="button" onClick={() => onOpen(event)} className={`${cardClass} flex w-full items-start gap-4 text-left transition-colors hover:bg-white/5`}>
            <span className="w-24 shrink-0 text-sm font-semibold tabular-nums text-orange-300">{eventTimeLabel(event)}{event.endTime && !event.allDay && <span className="block text-xs font-normal text-white/40">até {event.endTime}</span>}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-white">{event.title}</span>
              {event.location && <span className="mt-0.5 flex items-center gap-1 text-xs text-white/50"><MapPin className="h-3 w-3" aria-hidden />{event.location}</span>}
              {event.description && <span className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-white/45">{event.description}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
};

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

// ------------------------------------------------------------- detalhes / formulário

const EventDialog: React.FC<{
  event: CalendarEvent | null; mode: 'view' | 'form'; defaultDate: string;
  onMode: (mode: 'view' | 'form') => void; onClose: () => void; onSaved: (event: CalendarEvent) => void; onDeleted: () => void;
}> = ({ event, mode, defaultDate, onMode, onClose, onSaved, onDeleted }) => {
  const multiDay = !!event && event.startKey !== event.endKey;
  const [form, setForm] = useState({
    title: event?.title ?? '', date: event?.startKey ?? defaultDate, allDay: event?.allDay ?? false,
    startTime: event?.startTime ?? '09:00', endTime: event?.endTime ?? '10:00', location: event?.location ?? '', description: event?.description ?? '',
  });
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('save'); setError(null);
    try { onSaved(await saveCalendarEvent(form, event?.id)); } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar.'); setBusy(null); }
  };
  const remove = async () => {
    if (!event || !confirm(`Excluir o evento "${event.title}" do Google Agenda?${event.crm ? '\n\nO pedido no Kanban será mantido.' : ''}`)) return;
    setBusy('delete'); setError(null);
    try { await deleteCalendarEvent(event.id); onDeleted(); } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível excluir.'); setBusy(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={mode === 'form' ? (event ? 'Editar evento' : 'Novo evento') : 'Detalhes do evento'} onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-white/10 bg-[#0D1527] p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-white">{mode === 'form' ? (event ? 'Editar evento' : 'Novo evento') : event?.title}</h3>
          <button type="button" onClick={onClose} disabled={!!busy} aria-label="Fechar" className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        {mode === 'view' && event ? (
          <div className="space-y-3 text-sm">
            <p className="text-white/80"><span className="capitalize">{fmt(event.startKey, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>{event.endKey !== event.startKey && ` → ${fmt(event.endKey, { day: 'numeric', month: 'long' })}`}</p>
            <p className="font-semibold tabular-nums text-orange-300">{event.allDay ? 'Dia inteiro' : `${event.startTime} – ${event.endTime}`}</p>
            {event.location && <p className="flex items-start gap-2 text-white/70"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{event.location}</p>}
            {event.description && <p className="whitespace-pre-line break-words rounded-xl bg-black/20 p-3 text-xs text-white/70">{event.description}</p>}
            {event.crm && (
              <p className="flex items-start gap-2 rounded-xl border border-orange-400/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                Evento de um pedido do Kanban. As alterações feitas aqui não voltam para o pedido, e reenviar o pedido ao Google Agenda sobrescreve este evento. Excluir mantém o pedido.
              </p>
            )}
            {multiDay && <p className="text-xs text-white/40">Evento de vários dias: para editar, use o Google Agenda.</p>}
            <ErrorNote message={error} />
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              {event.htmlLink ? <a href={event.htmlLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300"><ExternalLink className="h-3.5 w-3.5" aria-hidden />Abrir no Google Agenda</a> : <span />}
              <div className="flex gap-2">
                <button type="button" onClick={remove} disabled={!!busy} className={`${ghostButton} hover:!bg-red-500/20 hover:!text-red-300`}>{busy === 'delete' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}Excluir</button>
                <button type="button" onClick={() => onMode('form')} disabled={!!busy || multiDay} className={primaryButton}><Pencil className="h-4 w-4" />Editar</button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={save} className="space-y-3">
            <label className={labelClass}>Título<input value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={250} required className={inputClass} /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>Data<input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required className={inputClass} /></label>
              <label className="mt-6 flex items-center gap-2 text-xs font-semibold text-white/70"><input type="checkbox" checked={form.allDay} onChange={(e) => set('allDay', e.target.checked)} />Dia inteiro</label>
            </div>
            {!form.allDay && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>Início<input type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} required className={inputClass} /></label>
                <label className={labelClass}>Término<input type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} required className={inputClass} /></label>
              </div>
            )}
            <label className={labelClass}>Local (opcional)<input value={form.location} onChange={(e) => set('location', e.target.value)} maxLength={1024} className={inputClass} /></label>
            <label className={labelClass}>Descrição (opcional)<textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={4} maxLength={8000} className={inputClass} /></label>
            {event?.crm && <WarningNote message="Evento de pedido do Kanban: a edição vale só na agenda e não atualiza o pedido." />}
            <ErrorNote message={error} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => (event ? onMode('view') : onClose())} disabled={!!busy} className={ghostButton}>Cancelar</button>
              <button type="submit" disabled={!!busy} className={primaryButton}>{busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />}{event ? 'Salvar' : 'Criar evento'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
