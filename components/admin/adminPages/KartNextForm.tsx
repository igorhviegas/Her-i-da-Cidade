import React, { useState } from 'react';
import { CalendarDays, Save, Trash2 } from 'lucide-react';
import { todayInBrazil, upcomingRace } from '../../../services/kartNext.js';
import { clearKartNext, saveKartNext, useKartNext } from '../../../services/kartService';
import { card, input, type Run } from './agentShared';

/** Cadastro do aviso "Próxima corrida" do topo do ranking (data e horário; some sozinho depois da data). */
export const KartNextForm: React.FC<{ run: Run }> = ({ run }) => {
  const saved = useKartNext();
  if (saved === undefined) return null;
  return <Form key={saved ? `${saved.date}${saved.time}${saved.place}${saved.note}` : 'empty'} saved={saved} run={run} />;
};

const Form: React.FC<{ saved: ReturnType<typeof useKartNext>; run: Run }> = ({ saved, run }) => {
  const [date, setDate] = useState(saved?.date ?? '');
  const [time, setTime] = useState(saved?.time ?? '');
  const [place, setPlace] = useState(saved?.place ?? '');
  const [note, setNote] = useState(saved?.note ?? '');
  const showing = upcomingRace(saved);
  const past = !!saved && !showing;

  return (
    <section className={`${card} space-y-3 p-4`}>
      <div className="flex items-center gap-2 font-bold text-white"><CalendarDays className="h-5 w-5 text-sky-300" />Próxima corrida</div>
      <p className="text-sm text-white/55">Aparece num card no topo do ranking e some sozinho depois da data.</p>
      {past && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-200">A data cadastrada já passou, então o card não aparece. Informe a próxima.</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-white/50">Data<input type="date" min={todayInBrazil()} value={date} onChange={(e) => setDate(e.target.value)} className={`${input} mt-1`} /></label>
        <label className="text-xs text-white/50">Horário<input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${input} mt-1`} /></label>
        <label className="text-xs text-white/50">Local (opcional)<input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Kartódromo de Betim" className={`${input} mt-1`} /></label>
        <label className="text-xs text-white/50">Recado (opcional)<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: chegar 30 min antes" className={`${input} mt-1`} /></label>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {saved && <button type="button" onClick={() => run(clearKartNext, 'Aviso removido.')} className="inline-flex items-center gap-1.5 rounded-xl bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/70 hover:text-red-300"><Trash2 className="h-4 w-4" />Remover aviso</button>}
        <button type="button" disabled={!date} onClick={() => run(() => saveKartNext({ date, time, place, note }), 'Próxima corrida salva.')} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-40"><Save className="h-4 w-4" />Salvar</button>
      </div>
    </section>
  );
};
