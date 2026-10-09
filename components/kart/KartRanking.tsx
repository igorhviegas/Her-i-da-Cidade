import React, { useMemo, useState } from 'react';
import { Crown, Search, Timer, Trophy } from 'lucide-react';
import { formatLap, norm } from '../../services/kart.js';
import { lapRanking, racesInScope, raceYears, standings, trackRecord, type KartScope } from '../../services/kartRanking.js';
import type { KartPilot, KartRace } from '../../services/kartService';
import { KartScoringInfo } from './KartScoringInfo';
import { KartLink, MEDAL_STYLE, WeatherIcon, card, formatDate, medalOf, plural, type Medal } from './kartUi';

type Mode = 'points' | 'laps';
type ScopeKey = 'recent' | 'all' | `y${number}`;

interface Line { pilotId: string; name: string; rank: number; races: number; wins: number; podiums: number; extras?: number; big: string; sub?: string; rain?: boolean }

/** "12 corridas · 5 vitórias · 8 pódios" (em duas linhas no pódio). */
const stats = (l: Line) => [plural(l.races, 'corrida', 'corridas'), plural(l.wins, 'vitória', 'vitórias'), plural(l.podiums, 'pódio', 'pódios')];

const toScope = (key: ScopeKey): KartScope => (key === 'recent' ? { type: 'recent' } : key === 'all' ? { type: 'all' } : { type: 'year', year: Number(key.slice(1)) });

const Podium: React.FC<{ lines: Line[] }> = ({ lines }) => {
  if (lines.length < 3) return null;
  const order = [lines[1], lines[0], lines[2]]; // prata, ouro, bronze: o líder fica no meio
  const height = { 1: 'h-28', 2: 'h-20', 3: 'h-14' } as const;
  return (
    <div className="mb-4 grid grid-cols-3 items-end gap-2">
      {order.map((line) => {
        const medal = line.rank as Medal; // o pódio só recebe as três primeiras linhas
        const style = MEDAL_STYLE[medal];
        return (
          <KartLink key={line.pilotId} to={`/kart/piloto/${line.pilotId}`} className="group block min-w-0 text-center">
            {medal === 1 && <Crown className="mx-auto mb-1 h-6 w-6 text-amber-300" />}
            <p className="truncate px-1 text-sm font-bold text-white group-hover:underline">{line.name}</p>
            <p className={`flex items-center justify-center gap-1 text-lg font-black italic tabular-nums ${style.text}`}>{line.rain && <WeatherIcon weather="rain" className="h-3.5 w-3.5" />}{line.big}</p>
            <p className="px-1 text-[11px] leading-tight text-white/55">{stats(line)[0]}<br />{stats(line)[1]} · {stats(line)[2]}</p>
            <div className={`mt-1 flex ${height[medal]} items-start justify-center rounded-t-xl bg-gradient-to-b ${style.gradient} pt-2 text-3xl font-black italic text-black/70 ${style.glow}`}>{line.rank}</div>
          </KartLink>
        );
      })}
    </div>
  );
};

const Row: React.FC<{ line: Line }> = ({ line }) => {
  const medal = medalOf(line.rank);
  return (
    <KartLink to={`/kart/piloto/${line.pilotId}`} className={`${card} flex items-center gap-3 overflow-hidden px-3 py-3 transition-colors hover:border-white/30`}>
      <span className={`w-9 shrink-0 text-center text-2xl font-black italic tabular-nums ${medal ? MEDAL_STYLE[medal].text : 'text-white/40'}`}>{line.rank}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{line.name}</span>
        <span className="block text-xs text-white/50">{stats(line).join(' · ')}{line.extras ? ` · +${plural(line.extras, 'avulsa', 'avulsas')}` : ''}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="flex items-center justify-end gap-1.5 text-xl font-black italic tabular-nums">{line.rain && <WeatherIcon weather="rain" />}{line.big}</span>
        {line.sub && <span className="block text-[11px] text-white/45">{line.sub}</span>}
      </span>
    </KartLink>
  );
};

const Pill: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button type="button" onClick={onClick} aria-pressed={active} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors ${active ? 'bg-white text-[#070B14]' : 'border border-white/15 text-white/70 hover:text-white'}`}>{children}</button>
);

export const KartRanking: React.FC<{ races: KartRace[]; pilots: KartPilot[] }> = ({ races, pilots }) => {
  const [mode, setMode] = useState<Mode>('points');
  const [scopeKey, setScopeKey] = useState<ScopeKey>('recent');
  const [query, setQuery] = useState('');
  const scope = useMemo(() => toScope(scopeKey), [scopeKey]);
  const years = useMemo(() => raceYears(races), [races]);
  const inScope = racesInScope(races, scope);

  const lines = useMemo<Line[]>(() => mode === 'points'
    ? standings(races, scope).map((r) => ({ pilotId: r.pilotId, name: r.name, rank: r.rank, races: r.races, wins: r.wins, podiums: r.podiums, big: `${r.points}` }))
    : lapRanking(races, scope).map((r) => ({ pilotId: r.pilotId, name: r.name, rank: r.rank, races: r.races, wins: r.wins, podiums: r.podiums, extras: r.extras, big: formatLap(r.bestLapMs), sub: `${formatDate(r.date)}${r.extra ? ' · avulsa' : ''}`, rain: r.rain })),
  [races, mode, scope]);
  const record = useMemo(() => trackRecord(races, scope), [races, scope]);

  const found = query.trim() ? pilots.filter((p) => p.active !== false && norm(p.name).includes(norm(query.trim()))) : null;
  const periodLabel = scopeKey === 'recent' ? `últimas ${inScope.length} corridas` : scopeKey === 'all' ? 'todo o período' : scopeKey.slice(1);

  return (
    <div className="space-y-4">
      {record && (
        <KartLink to={`/kart/piloto/${record.pilotId}`} className="relative block overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-br from-[#2A0A0F] via-[#150B18] to-[#0D1527] p-5">
          <Timer className="absolute -right-3 -top-3 h-24 w-24 rotate-12 text-white/5" />
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-300">Recorde da pista · {periodLabel}</p>
          <p className="mt-1 text-5xl font-black italic tabular-nums text-white">{formatLap(record.bestLapMs)}</p>
          <p className="mt-1 text-sm text-white/70"><span className="font-bold text-white">{record.name}</span> · {formatDate(record.date)}{record.extra && ' · fora do campeonato'}</p>
        </KartLink>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Período">
        <Pill active={scopeKey === 'recent'} onClick={() => setScopeKey('recent')}>Últimas 10</Pill>
        <Pill active={scopeKey === 'all'} onClick={() => setScopeKey('all')}>Todo o período</Pill>
        {years.map((y) => <Pill key={y} active={scopeKey === `y${y}`} onClick={() => setScopeKey(`y${y}`)}>{y}</Pill>)}
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-[#0D1527] p-1" role="group" aria-label="Tipo de ranking">
        {([['points', 'Pontos', Trophy], ['laps', 'Melhor volta', Timer]] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => setMode(id)} aria-pressed={mode === id} className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-black uppercase tracking-wide transition-colors ${mode === id ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' : 'text-white/50 hover:text-white'}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      <label className="relative block">
        <span className="sr-only">Buscar piloto</span>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar piloto pelo nome" className="w-full rounded-2xl border border-white/10 bg-[#0D1527] py-3 pl-10 pr-4 text-[15px] placeholder:text-white/35 focus:border-red-500/60 focus:outline-none" />
      </label>

      {found ? (
        <ul className="space-y-2">
          {found.map((p) => <li key={p.id}><KartLink to={`/kart/piloto/${p.id}`} className={`${card} block px-4 py-3 font-bold hover:border-white/30`}>{p.name}</KartLink></li>)}
          {found.length === 0 && <li className="px-1 text-sm text-white/50">Nenhum piloto inscrito com esse nome.</li>}
        </ul>
      ) : lines.length === 0 ? (
        <p className={`${card} px-5 py-8 text-center text-white/50`}>Ainda não há corridas neste período.</p>
      ) : (
        <>
          <p className="flex items-center gap-1.5 px-1 text-xs text-white/50">
            <span>
              {mode === 'points' ? 'Pontos' : 'Melhor volta'} · {periodLabel} · {plural(inScope.length, 'corrida', 'corridas')}
              {mode === 'laps' && ' · inclui corridas fora do campeonato (avulsas) · nuvem = volta na chuva'}
            </span>
            {mode === 'points' && <KartScoringInfo />}
          </p>
          <Podium lines={lines} />
          <ol className="space-y-2">{lines.slice(lines.length >= 3 ? 3 : 0).map((l) => <li key={l.pilotId}><Row line={l} /></li>)}</ol>
        </>
      )}
    </div>
  );
};
