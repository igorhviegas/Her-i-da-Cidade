import React from 'react';
import { MapPin } from 'lucide-react';
import { daysBetween, eventsOnDay } from '../../../services/calendarEvents.js';
import type { CalendarEvent } from '../../../services/calendarService';
import { eventTimeLabel } from '../CalendarAgenda';
import { cardClass } from '../missionsUi';

export const fmt = (key: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', { ...options, timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`));
const WEEKDAY_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const chipClass = (event: CalendarEvent) => (event.crm ? 'bg-orange-500/20 text-orange-200 hover:bg-orange-500/30' : 'bg-blue-500/20 text-blue-200 hover:bg-blue-500/30');

export interface ViewProps { events: CalendarEvent[]; today: string; selected: string; onSelect: (key: string) => void; onOpen: (event: CalendarEvent) => void }

export const MonthGrid: React.FC<ViewProps & { range: { from: string; to: string }; month: string }> = ({ range, month, events, today, selected, onSelect, onOpen }) => (
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

export const WeekList: React.FC<ViewProps & { range: { from: string; to: string } }> = ({ range, events, today, selected, onSelect, onOpen }) => (
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

export const DayList: React.FC<{ events: CalendarEvent[]; dayKey: string; onOpen: (event: CalendarEvent) => void }> = ({ events, dayKey, onOpen }) => {
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
