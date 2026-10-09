import React, { useState } from 'react';
import { ArrowDown, ArrowUp, CloudRain, Sun, Trash2, X } from 'lucide-react';
import { newId } from '../../../services/agentContent.js';
import { MIN_OFFICIAL_PILOTS, formatLap, parseLapInput, pointsFor } from '../../../services/kart.js';
import { deleteKartRace, raceDocId, saveKartRace, type KartPilot, type KartRace } from '../../../services/kartService';
import { card, iconBtn, input, type Run } from './agentShared';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

interface Entry { pilotId: string; name: string; lap: string }

const toEntries = (race: KartRace | null): Entry[] => (race?.results ?? []).map((r) => ({ pilotId: r.pilotId, name: r.name, lap: r.bestLapMs ? formatLap(r.bestLapMs) : '' }));

/** Lançar (ou corrigir) uma corrida à mão: data, clima e os inscritos na ordem de chegada, cada um com a melhor volta (opcional). */
export const KartRaceForm: React.FC<{ pilots: KartPilot[]; race: KartRace | null; run: Run; onClose: () => void }> = ({ pilots, race, run, onClose }) => {
  const [date, setDate] = useState(race?.date ?? '');
  const [time, setTime] = useState(race ? (/\d{1,2}:\d{2}/.exec(race.heat)?.[0] ?? '') : '');
  const [weather, setWeather] = useState<'dry' | 'rain'>(race?.weather ?? 'dry');
  const [extra, setExtra] = useState(!!race?.extra);
  const [entries, setEntries] = useState<Entry[]>(() => toEntries(race));

  const free = pilots.filter((p) => !entries.some((e) => e.pilotId === p.id)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const badLap = (e: Entry) => (e.lap.trim() !== '' || extra) && parseLapInput(e.lap) === null;
  const minPilots = extra ? 1 : MIN_OFFICIAL_PILOTS;
  const problem = !date ? 'Informe a data da corrida.'
    : entries.length < minPilots ? `Adicione ao menos ${plural(minPilots, 'piloto inscrito', 'pilotos inscritos')}.`
    : entries.some(badLap) ? (extra ? 'Informe a melhor volta de cada piloto (ex.: 1:13.169).' : 'Há uma melhor volta inválida (use 1:13.169).') : '';

  const update = (i: number, patch: Partial<Entry>) => setEntries((prev) => prev.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const move = (i: number, delta: -1 | 1) => setEntries((prev) => { const next = [...prev]; [next[i], next[i + delta]] = [next[i + delta], next[i]]; return next; });

  const save = async () => {
    const id = extra ? (race?.extra ? race.id : `extra-${date}-${newId()}`) : raceDocId(date, time);
    const ordered = extra ? [...entries].sort((a, b) => (parseLapInput(a.lap) ?? Infinity) - (parseLapInput(b.lap) ?? Infinity)) : entries; // avulsa: ordem pela volta
    const results = ordered.map((e, i) => ({ pilotId: e.pilotId, name: e.name, pos: i + 1, racePos: null, bestLapMs: parseLapInput(e.lap), laps: 0 }));
    const ok = await run(async () => {
      await saveKartRace({ id, date, heat: `${extra ? 'Avulsa' : 'Bateria'}${time ? ` ${time}` : ''}`, weather, extra, results });
      if (race && race.id !== id) await deleteKartRace(race.id); // data/horário mudou: não deixa a corrida antiga duplicada
    }, race ? 'Corrida atualizada.' : 'Corrida lançada.');
    if (ok) onClose();
  };

  return (
    <div className={`${card} space-y-4 p-4`}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-bold text-white">{race ? 'Editar corrida' : 'Lançar corrida manualmente'}</p>
        <button type="button" onClick={onClose} aria-label="Fechar" className={iconBtn}><X className="h-4 w-4" /></button>
      </div>

      <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${extra ? 'border-red-500/60 bg-red-500/10' : 'border-white/10 bg-white/5'}`}>
        <input type="checkbox" checked={extra} onChange={(e) => setExtra(e.target.checked)} className="mt-0.5 h-4 w-4 accent-red-600" />
        <span><b className="text-white">Corrida fora do campeonato</b><span className="block text-white/60">Não dá pontos, vitórias nem pódios; vale só para o recorde de melhor volta da pista (ex.: ir sozinho tentar bater a volta). Aceita 1 piloto ou mais.</span></span>
      </label>

      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs text-white/50">Data<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${input} mt-1`} /></label>
        <label className="text-xs text-white/50">Horário da bateria (opcional)<input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${input} mt-1`} /></label>
        <fieldset className="text-xs text-white/50">Pista
          <div className="mt-1 grid grid-cols-2 gap-1">
            {([['dry', 'Seco', Sun], ['rain', 'Chuva', CloudRain]] as const).map(([id, label, Icon]) => (
              <button key={id} type="button" onClick={() => setWeather(id)} aria-pressed={weather === id} className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold ${weather === id ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60'}`}><Icon className="h-4 w-4" />{label}</button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs text-white/50">{extra ? 'Pilotos da sessão e a melhor volta de cada um (a ordem é pela volta)' : 'Ordem de chegada entre os inscritos (1º no topo) e melhor volta de cada um'}</p>
        {entries.map((e, i) => (
          <div key={e.pilotId} className="flex items-center gap-2 rounded-xl bg-white/5 px-2 py-1.5">
            {!extra && <span className="w-7 text-center text-lg font-black tabular-nums text-white/60">{i + 1}</span>}
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{e.name}{!extra && <span className="ml-2 text-xs font-normal text-white/40">{pointsFor(i + 1)} pts</span>}</span>
            <input aria-label={`Melhor volta de ${e.name}`} value={e.lap} onChange={(ev) => update(i, { lap: ev.target.value })} placeholder="1:13.169" inputMode="decimal" className={`${input} w-28 shrink-0 ${badLap(e) ? 'border-red-500/70' : ''}`} />
            {!extra && <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)} className={iconBtn}><ArrowUp className="h-4 w-4" /></button>}
            {!extra && <button type="button" aria-label="Descer" disabled={i === entries.length - 1} onClick={() => move(i, 1)} className={iconBtn}><ArrowDown className="h-4 w-4" /></button>}
            <button type="button" aria-label={`Remover ${e.name}`} onClick={() => setEntries((prev) => prev.filter((_, j) => j !== i))} className={`${iconBtn} hover:text-red-300`}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <select aria-label="Adicionar piloto" value="" disabled={free.length === 0} onChange={(ev) => { const p = pilots.find((x) => x.id === ev.target.value); if (p) setEntries((prev) => [...prev, { pilotId: p.id, name: p.name, lap: '' }]); }} className={input}>
          <option value="">{free.length ? (extra ? '+ Adicionar piloto…' : `+ Adicionar piloto na posição ${entries.length + 1}…`) : 'Todos os pilotos já foram adicionados'}</option>
          {free.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {problem && <p className="text-sm text-amber-200">{problem}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-xl bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/70 hover:text-white">Cancelar</button>
        <button type="button" disabled={!!problem} onClick={save} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-40">Salvar corrida</button>
      </div>
    </div>
  );
};
