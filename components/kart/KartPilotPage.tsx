import React, { useMemo } from 'react';
import { Crown, Flame, Flag, Medal as MedalIcon, Timer } from 'lucide-react';
import { formatLap } from '../../services/kart.js';
import { pilotProfile, recentForm, RECENT_RACES, type HistoryRow as HistoryRowData } from '../../services/kartRanking.js';
import type { KartPilot, KartRace } from '../../services/kartService';
import { KartLink, MEDAL_STYLE, WeatherIcon, card, formatDate, plural, type Medal } from './kartUi';

const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-xl bg-black/25 px-3 py-3">
    <p className="text-[10px] font-bold uppercase tracking-widest text-white/45">{label}</p>
    <p className="mt-0.5 text-2xl font-black italic tabular-nums">{value}</p>
    {hint && <p className="text-[11px] text-white/45">{hint}</p>}
  </div>
);

/** Pontos de cada uma das últimas 10 corridas do campeonato (corrida em que o piloto não correu aparece vazia). */
const FormChart: React.FC<{ pilotId: string; races: KartRace[]; barClass: string }> = ({ pilotId, races, barClass }) => {
  const form = useMemo(() => recentForm(pilotId, races), [pilotId, races]);
  return (
    <div className="flex h-24 items-end gap-1.5" role="img" aria-label="Pontos nas últimas corridas do campeonato">
      {form.map((f) => (
        <div key={f.raceId} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={f.points === null ? `Corrida ${f.number}: não correu` : `Corrida ${f.number}: P${f.pos}, ${f.points} pts`}>
          {f.points === null
            ? <div className="h-1 w-full rounded bg-white/10" />
            : <div className={`w-full rounded-t ${barClass}`} style={{ height: `${Math.max(8, (f.points / 25) * 100)}%` }} />}
          <span className="text-[9px] text-white/40">{f.number}</span>
        </div>
      ))}
    </div>
  );
};

const HistoryRow: React.FC<{ h: HistoryRowData; isRecord: boolean }> = ({ h, isRecord }) => (
  <li className={`${card} flex items-center gap-3 px-3 py-3`}>
    <span className={`w-11 shrink-0 text-center text-2xl font-black italic tabular-nums ${h.pos <= 3 ? MEDAL_STYLE[h.pos as Medal].text : 'text-white/45'}`}>P{h.pos}</span>
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-bold">Corrida {h.number} <span className="font-normal text-white/50">· {formatDate(h.date)}</span></span>
      <span className="flex items-center gap-1.5 text-xs text-white/50"><WeatherIcon weather={h.weather} className="h-3.5 w-3.5" />{h.heat} · {h.field} inscritos</span>
    </span>
    <span className="shrink-0 text-right">
      <span className="block text-lg font-black italic tabular-nums">{h.points} <span className="text-xs font-semibold not-italic text-white/45">pts</span></span>
      <span className={`flex items-center justify-end gap-1 text-xs tabular-nums ${isRecord ? 'font-bold text-red-300' : 'text-white/50'}`}><Timer className="h-3 w-3" />{formatLap(h.bestLapMs)}</span>
    </span>
  </li>
);

export const KartPilotPage: React.FC<{ pilot: KartPilot | undefined; races: KartRace[] }> = ({ pilot, races }) => {
  const profile = useMemo(() => (pilot ? pilotProfile(pilot.id, races) : null), [pilot, races]);
  if (!pilot || !profile) return <p className={`${card} px-5 py-8 text-center text-white/60`}>Piloto não encontrado. <KartLink to="/kart" className="font-bold text-white underline">Voltar ao ranking</KartLink></p>;

  const medal = profile.medal ? MEDAL_STYLE[profile.medal] : null;
  const { recent, overall, record, history } = profile;
  const wins = overall?.wins ?? 0;

  return (
    <div className="space-y-4">
      <section className={`relative overflow-hidden rounded-3xl p-[2px] ${medal ? `bg-gradient-to-br ${medal.gradient} ${medal.glow}` : 'bg-white/10'}`}>
        <div className="relative rounded-[22px] bg-[#0B1120] p-5">
          {medal && <div aria-hidden className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${medal.gradient} opacity-[0.14]`} />}
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={`text-[11px] font-bold uppercase tracking-[0.2em] ${medal ? medal.text : 'text-white/45'}`}>
                  {profile.medal ? `${profile.medal}º no campeonato · ${medal?.label}` : 'Piloto do campeonato'}
                </p>
                <h2 className="mt-1 break-words text-3xl font-black italic leading-tight">{pilot.name}</h2>
              </div>
              {profile.medal === 1 ? <Crown className="h-10 w-10 shrink-0 text-amber-300" /> : medal ? <MedalIcon className={`h-10 w-10 shrink-0 ${medal.text}`} /> : null}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Stat label={`Pontos · últimas ${RECENT_RACES}`} value={profile.recentPoints} hint={plural(profile.recentRaces, 'corrida', 'corridas')} />
              <Stat label="Recorde de volta" value={record?.bestLapMs ? formatLap(record.bestLapMs) : '—'} hint={record ? formatDate(record.date) : undefined} />
              <Stat label="Vitórias" value={wins} hint="no total" />
              <Stat label="Pódios" value={overall?.podiums ?? 0} hint={`em ${plural(overall?.races ?? 0, 'corrida', 'corridas')}`} />
            </div>
          </div>
        </div>
      </section>

      <section className={`${card} p-4`}>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-white/60"><Flame className="h-4 w-4" />Forma nas últimas {RECENT_RACES} corridas</h3>
        <FormChart pilotId={pilot.id} races={races} barClass={medal ? medal.bar : 'bg-red-500'} />
        <p className="mt-2 text-[11px] text-white/40">Altura = pontos da corrida (25 é a vitória). Traço = não correu.</p>
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-2 px-1 text-sm font-bold uppercase tracking-widest text-white/60"><Flag className="h-4 w-4" />Histórico de corridas</h3>
        {history.length === 0 ? <p className={`${card} px-5 py-6 text-center text-white/50`}>Ainda sem corridas oficiais.</p> : (
          <ol className="space-y-2">
            {history.map((h) => <HistoryRow key={h.raceId} h={h} isRecord={!!record && h.raceId === record.raceId} />)}
          </ol>
        )}
      </section>

      {recent === null && history.length > 0 && <p className="px-1 text-xs text-white/40">Este piloto não correu nas últimas {RECENT_RACES} corridas, por isso não aparece no ranking padrão.</p>}
    </div>
  );
};
