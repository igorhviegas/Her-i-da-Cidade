import React, { useMemo, useState } from 'react';
import { ChevronDown, Crown, Flame, Flag, Medal as MedalIcon, Swords, Timer, TriangleAlert } from 'lucide-react';
import { formatLap } from '../../services/kart.js';
import { lapHistory, pilotProfile, recentForm, RECENT_RACES, type ExtraRow, type HistoryRow as HistoryRowData, type LapPoint } from '../../services/kartRanking.js';
import type { KartPilot, KartRace, KartVideo } from '../../services/kartService';
import { KartLapChart } from './KartLapChart';
import { RaceResults } from './KartRaceResults';
import { KartLink, MEDAL_STYLE, WeatherIcon, card, formatDate, plural, type Medal } from './kartUi';

const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-xl bg-black/25 px-3 py-3">
    <p className="text-[10px] font-bold uppercase tracking-widest text-white/45">{label}</p>
    <p className="mt-0.5 text-2xl font-black italic tabular-nums">{value}</p>
    {hint && <p className="text-[11px] text-white/45">{hint}</p>}
  </div>
);

const BAR: Record<number, string> = { 1: 'bg-amber-400', 2: 'bg-slate-300', 3: 'bg-orange-500' };
const POS_TEXT: Record<number, string> = { 1: 'text-amber-300', 2: 'text-slate-200', 3: 'text-orange-300' };
const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Uma coluna por corrida das últimas 10 do campeonato: posição no topo, barra (altura = pontos, cor = posição) e a data embaixo. */
const FormChart: React.FC<{ pilotId: string; races: KartRace[] }> = ({ pilotId, races }) => {
  const form = useMemo(() => recentForm(pilotId, races), [pilotId, races]);
  return (
    <div>
      <ol className="flex items-end gap-1" aria-label="Posição e pontos nas últimas corridas do campeonato">
        {form.map((f) => (
          <li key={f.raceId} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={f.points === null ? `Corrida ${f.number}: não correu` : `Corrida ${f.number}: P${f.pos}, ${f.points} pontos`}>
            <span className={`text-[11px] font-black ${f.pos === null ? 'text-white/25' : POS_TEXT[f.pos] ?? 'text-white/70'}`}>{f.pos === null ? '—' : `P${f.pos}`}</span>
            <div className="flex h-24 w-full items-end">
              {f.points === null || f.pos === null
                ? <div className="h-1 w-full rounded bg-white/10" />
                : <div className={`flex w-full items-start justify-center rounded-t ${BAR[f.pos] ?? 'bg-sky-500'}`} style={{ height: `${Math.max(16, (f.points / 25) * 100)}%` }}><span className="mt-0.5 text-[10px] font-black text-black/70">{f.points}</span></div>}
            </div>
            <span className="text-[9px] tabular-nums text-white/45">{shortDate(f.date)}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[11px] leading-relaxed text-white/45">Cada coluna é uma corrida (mais antiga à esquerda). Número na barra = pontos; a altura vai até 25 (vitória). Cor: ouro P1, prata P2, bronze P3, azul as demais. Traço = não correu.</p>
    </div>
  );
};

/** Linha do histórico que abre o resultado completo da corrida (igual à aba Corridas). */
const LAP_COLOR: Record<number, string> = { 1: '#fbbf24', 2: '#cbd5e1', 3: '#fb923c' };

/** Frase-resumo acima do gráfico: de quanto a volta caiu desde a primeira registrada em pista seca. */
const LapSummary: React.FC<{ laps: LapPoint[] }> = ({ laps }) => {
  const dry = laps.filter((l) => !l.rain);
  if (dry.length === 0) return null;
  const first = dry[0].ms;
  const best = Math.min(...dry.map((l) => l.ms));
  return (
    <p className="mb-3 text-sm text-white/70">
      {dry.length === 1 ? <>Primeira volta registrada: <b className="text-white">{formatLap(first)}</b></> : first === best
        ? <>Recorde pessoal: <b className="text-white">{formatLap(best)}</b>, a primeira volta registrada.</>
        : <>De <b className="text-white">{formatLap(first)}</b> para <b className="text-white">{formatLap(best)}</b>: <b className="text-emerald-300">{((first - best) / 1000).toFixed(1).replace('.', ',')} s mais rápido</b> que a primeira volta registrada.</>}
    </p>
  );
};

const HistoryRow: React.FC<{ h: HistoryRowData; isRecord: boolean; race: KartRace | undefined; pilotId: string; video?: KartVideo }> = ({ h, isRecord, race, pilotId, video }) => {
  const [open, setOpen] = useState(false);
  return (
    <li className={`${card} overflow-hidden`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-3 py-3 text-left">
        <span className={`w-11 shrink-0 text-center text-2xl font-black italic tabular-nums ${h.pos <= 3 ? MEDAL_STYLE[h.pos as Medal].text : 'text-white/45'}`}>P{h.pos}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">Corrida {h.number} <span className="font-normal text-white/50">· {formatDate(h.date)}</span></span>
          <span className="flex items-center gap-1.5 text-xs text-white/50"><WeatherIcon weather={h.weather} className="h-3.5 w-3.5" />{h.heat} · {h.field} inscritos</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-lg font-black italic tabular-nums">{h.points} <span className="text-xs font-semibold not-italic text-white/45">pts</span></span>
          <span className={`flex items-center justify-end gap-1 text-xs tabular-nums ${isRecord ? 'font-bold text-red-300' : 'text-white/50'}`}><Timer className="h-3 w-3" />{formatLap(h.bestLapMs)}</span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && race && <RaceResults race={race} scored highlight={pilotId} video={video} />}
    </li>
  );
};

/** Sessão fora do campeonato do piloto: sem pontos, só a volta. */
const ExtraRowItem: React.FC<{ e: ExtraRow; isRecord: boolean; race: KartRace | undefined; pilotId: string; video?: KartVideo }> = ({ e, isRecord, race, pilotId, video }) => {
  const [open, setOpen] = useState(false);
  return (
    <li className="overflow-hidden rounded-2xl border border-red-500/30 bg-red-500/5">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-3 py-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">{formatDate(e.date)} <span className="font-normal text-white/50">· {e.heat}</span></span>
          <span className="flex items-center gap-1.5 text-xs text-white/50"><WeatherIcon weather={e.weather} className="h-3.5 w-3.5" />{plural(e.field, 'piloto', 'pilotos')}</span>
        </span>
        <span className={`flex shrink-0 items-center gap-1 text-lg font-black italic tabular-nums ${isRecord ? 'text-red-300' : ''}`}><Timer className="h-4 w-4" />{formatLap(e.bestLapMs)}</span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && race && <RaceResults race={race} scored={false} highlight={pilotId} video={video} />}
    </li>
  );
};

export const KartPilotPage: React.FC<{ pilot: KartPilot | undefined; races: KartRace[]; videos: Map<string, KartVideo> }> = ({ pilot, races, videos }) => {
  const profile = useMemo(() => (pilot ? pilotProfile(pilot.id, races) : null), [pilot, races]);
  const laps = useMemo(() => (pilot ? lapHistory(races, pilot.id) : []), [pilot, races]);
  if (!pilot || !profile) return <p className={`${card} px-5 py-8 text-center text-white/60`}>Piloto não encontrado. <KartLink to="/kart" className="font-bold text-white underline">Voltar ao ranking</KartLink></p>;

  const medal = profile.medal ? MEDAL_STYLE[profile.medal] : null;
  const { recent, overall, record, history, extras, titles } = profile;
  const byId = new Map(races.map((r) => [r.id, r]));
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
                {titles.length > 0 && <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1 text-xs font-bold text-amber-200"><Crown className="h-3.5 w-3.5" />{titles.length === 1 ? 'Campeão' : `${titles.length}× campeão`} · {titles.join(', ')}</p>}
              </div>
              {profile.medal === 1 ? <Crown className="h-10 w-10 shrink-0 text-amber-300" /> : medal ? <MedalIcon className={`h-10 w-10 shrink-0 ${medal.text}`} /> : null}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Stat label={`Pontos · últimas ${RECENT_RACES}`} value={profile.recentPoints} hint={plural(profile.recentRaces, 'corrida', 'corridas')} />
              <Stat label="Recorde de volta" value={record?.bestLapMs ? formatLap(record.bestLapMs) : '—'} hint={record ? `${formatDate(record.date)}${record.extra ? ' · fora do campeonato' : ''}` : undefined} />
              <Stat label="Vitórias" value={wins} hint="no total" />
              <Stat label="Pódios" value={overall?.podiums ?? 0} hint={`em ${plural(overall?.races ?? 0, 'corrida', 'corridas')}`} />
            </div>
          </div>
        </div>
      </section>

      <section className={`${card} p-4`}>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-white/60"><Flame className="h-4 w-4" />Forma nas últimas {RECENT_RACES} corridas</h3>
        <FormChart pilotId={pilot.id} races={races} />
      </section>

      <KartLink to={`/kart/confronto?p=${pilot.id}`} className={`${card} flex items-center justify-center gap-2 py-3 text-sm font-bold text-white/80 hover:border-white/30 hover:text-white`}><Swords className="h-4 w-4 text-red-400" />Comparar com outros pilotos</KartLink>

      <section className={`${card} p-4`}>
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-white/60"><Timer className="h-4 w-4" />Evolução da melhor volta</h3>
        <LapSummary laps={laps} />
        <KartLapChart series={[{ id: pilot.id, name: pilot.name, color: LAP_COLOR[profile.medal ?? 0] ?? '#ef4444', points: laps }]} />
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-2 px-1 text-sm font-bold uppercase tracking-widest text-white/60"><Flag className="h-4 w-4" />Histórico de corridas</h3>
        {history.length === 0 ? <p className={`${card} px-5 py-6 text-center text-white/50`}>Ainda sem corridas oficiais.</p> : (
          <ol className="space-y-2">
            {history.map((h) => <HistoryRow key={h.raceId} h={h} race={byId.get(h.raceId)} video={videos.get(h.raceId)} pilotId={pilot.id} isRecord={!!record && h.raceId === record.raceId} />)}
          </ol>
        )}
      </section>

      {extras.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-2 px-1 text-sm font-bold uppercase tracking-widest text-red-300"><TriangleAlert className="h-4 w-4" />Fora do campeonato</h3>
          <p className="mb-2 px-1 text-xs text-red-200/80">Estas sessões não contam pontos, vitórias nem pódios. Valem só para o recorde de melhor volta.</p>
          <ol className="space-y-2">
            {extras.map((e) => <ExtraRowItem key={e.raceId} e={e} race={byId.get(e.raceId)} video={videos.get(e.raceId)} pilotId={pilot.id} isRecord={!!record && e.raceId === record.raceId} />)}
          </ol>
        </section>
      )}

      {recent === null && history.length > 0 && <p className="px-1 text-xs text-white/40">Este piloto não correu nas últimas {RECENT_RACES} corridas, por isso não aparece no ranking padrão.</p>}
    </div>
  );
};
