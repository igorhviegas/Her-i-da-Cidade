import React from 'react';
import { AlertCircle, Clock, Loader2, MapPin, Pencil, RefreshCw } from 'lucide-react';
import { eventsOnDay } from '../../services/calendarEvents.js';
import type { CalendarEvent, CalendarLoad } from '../../services/calendarService';

export const eventTimeLabel = (e: CalendarEvent) => (e.allDay ? 'Dia inteiro' : e.startTime ?? '');

/**
 * Lista dos compromissos de um dia; compartilhada pelo widget da Principal e pelo destaque do topo do Calendário
 * (mesma consulta, mesma ordenação, mesmos estados de carregamento, erro e vazio).
 */
export const DayAgenda: React.FC<{
  state: CalendarLoad; dayKey: string; emptyText: string; limit?: number;
  onOpen: (event: CalendarEvent) => void; onEdit?: (event: CalendarEvent) => void; onRetry: () => void;
}> = ({ state, dayKey, emptyText, limit, onOpen, onEdit, onRetry }) => {
  if (state.status === 'loading') return <div className="flex items-center gap-2 py-6 text-xs text-white/50"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Carregando agenda…</div>;
  if (state.status === 'error') {
    return (
      <div className="flex flex-col items-start gap-2 py-4 text-xs text-red-300" role="alert">
        <span className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{state.message}</span>
        <button type="button" onClick={onRetry} className="flex items-center gap-1 font-semibold text-red-200 hover:text-white"><RefreshCw className="h-3 w-3" aria-hidden />Tentar de novo</button>
      </div>
    );
  }
  const events = eventsOnDay(state.events, dayKey);
  if (events.length === 0) return <p className="py-6 text-sm text-white/45">{emptyText}</p>;
  const shown = limit ? events.slice(0, limit) : events;
  return (
    <>
      <ul className="space-y-1.5">
        {shown.map((event) => (
          <li key={event.id} className="flex items-stretch gap-1">
            <button type="button" onClick={() => onOpen(event)} className="flex min-w-0 flex-1 items-start gap-3 rounded-xl border border-white/10 px-3 py-2 text-left transition-colors hover:bg-white/5">
              <span className="mt-0.5 flex w-[4.5rem] shrink-0 items-center gap-1 text-xs font-semibold tabular-nums text-orange-300"><Clock className="h-3 w-3 shrink-0" aria-hidden />{eventTimeLabel(event)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">{event.title}</span>
                {event.location && <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-white/50"><MapPin className="h-3 w-3 shrink-0" aria-hidden /><span className="truncate">{event.location}</span></span>}
              </span>
            </button>
            {onEdit && (
              <button type="button" onClick={() => onEdit(event)} title="Editar compromisso" aria-label={`Editar ${event.title}`} className="flex w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/60 hover:bg-white/10 hover:text-white">
                <Pencil className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>
      {limit && events.length > limit && <p className="mt-2 text-[11px] text-white/40">+ {events.length - limit} no Calendário</p>}
    </>
  );
};
