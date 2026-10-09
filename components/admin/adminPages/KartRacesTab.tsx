import React from 'react';
import { CloudRain, Sun, Trash2 } from 'lucide-react';
import { formatLap } from '../../../services/kart.js';
import { officialRaces } from '../../../services/kartRanking.js';
import { deleteKartRace, saveKartRace, useKartPilots, useKartRaces } from '../../../services/kartService';
import { card, iconBtn, Loading, type Run } from './agentShared';
import { KartImport } from './KartImport';

const brDate = (iso: string) => iso.split('-').reverse().join('/');

export const KartRacesTab: React.FC<{ run: Run }> = ({ run }) => {
  const races = useKartRaces();
  const pilots = useKartPilots();
  if (races === null || pilots === null) return <Loading />;

  const saved = officialRaces(races).reverse();
  const unofficial = races.filter((r) => !saved.some((s) => s.id === r.id));

  return (
    <div className="space-y-6">
      <KartImport pilots={pilots} races={races} run={run} />

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-white/50">Corridas salvas ({saved.length})</h2>
        {saved.length === 0 && <p className={`${card} px-5 py-6 text-sm text-white/50`}>Nenhuma corrida ainda. Importe o PDF de uma bateria acima.</p>}
        {[...saved, ...unofficial].map((race) => {
          const winner = race.results[0];
          const number = 'number' in race ? `Corrida ${race.number}` : 'Não oficial';
          return (
            <div key={race.id} className={`${card} flex items-center gap-3 p-3`}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white">{number} · {brDate(race.date)} <span className="font-normal text-white/45">· {race.heat}</span></p>
                <p className="truncate text-xs text-white/50">{race.results.length} inscritos · 🏆 {winner?.name ?? '—'} · melhor volta {formatLap(Math.min(...race.results.map((r) => r.bestLapMs ?? Infinity)))}</p>
              </div>
              <button type="button" title={race.weather === 'rain' ? 'Chuva (clique para marcar seco)' : 'Seco (clique para marcar chuva)'} onClick={() => run(() => saveKartRace({ ...race, weather: race.weather === 'rain' ? 'dry' : 'rain' }))} className={iconBtn}>
                {race.weather === 'rain' ? <CloudRain className="h-5 w-5 text-sky-300" /> : <Sun className="h-5 w-5 text-amber-300" />}
              </button>
              <button type="button" aria-label="Excluir corrida" onClick={() => { if (window.confirm(`Excluir a corrida de ${brDate(race.date)}? Os pontos dos pilotos são recalculados.`)) run(() => deleteKartRace(race.id), 'Corrida excluída.'); }} className={`${iconBtn} hover:text-red-300`}><Trash2 className="h-5 w-5" /></button>
            </div>
          );
        })}
      </section>
    </div>
  );
};
