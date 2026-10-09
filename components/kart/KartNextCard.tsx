import React from 'react';
import { CalendarDays, Clock, MapPin } from 'lucide-react';
import type { UpcomingRace } from '../../services/kartNext.js';
import { formatDateLong } from './kartUi';

/** Aviso no topo do ranking com a data e o horário da próxima corrida. */
export const KartNextCard: React.FC<{ next: UpcomingRace }> = ({ next }) => (
  <section aria-label="Próxima corrida" className="relative overflow-hidden rounded-2xl border border-sky-400/30 bg-gradient-to-br from-[#0B2A55] via-[#0D1B3A] to-[#0D1527] p-5">
    <CalendarDays className="absolute -right-3 -top-3 h-24 w-24 -rotate-12 text-white/5" />
    <div className="relative">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-300">Próxima corrida</p>
        <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${next.days <= 1 ? 'bg-red-600 text-white' : 'bg-white/10 text-white/80'}`}>{next.countdown}</span>
      </div>
      <p className="mt-2 text-2xl font-black italic leading-tight first-letter:uppercase">{formatDateLong(next.date)}</p>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/75">
        {next.time && <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4 text-sky-300" />{next.time}</span>}
        {next.place && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-sky-300" />{next.place}</span>}
      </p>
      {next.note && <p className="mt-2 text-sm text-white/60">{next.note}</p>}
    </div>
  </section>
);
