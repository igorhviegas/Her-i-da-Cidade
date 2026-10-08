import React, { useEffect, useState } from 'react';
import { ChevronDown, Music, Pause, Play, Repeat1 } from 'lucide-react';
import type { AgentTrack } from '../../../services/agentService';
import { groupTracks, matchesQuery } from '../../../services/agentContent.js';
import { PlayerButtons, RestartButton, SearchBox } from './AgentBits';
import { btn, type Player } from './agenteShared';

interface TrackBadgeProps { active: boolean; playing: boolean; badge: React.ReactNode }

const TrackBadge: React.FC<TrackBadgeProps> = ({ active, playing, badge }) => (
  <>{active && playing ? <Pause className="h-4 w-4" fill="currentColor" /> : active ? <Play className="h-4 w-4" fill="currentColor" /> : badge}</>
);

interface TrackRowProps {
  track: AgentTrack;
  badge: React.ReactNode;
  child?: boolean;
  effects?: number;
  groupId?: string;
  currentId: string | undefined;
  player: Player;
  open: string[];
  setOpen: React.Dispatch<React.SetStateAction<string[]>>;
}

const TrackMainButton: React.FC<TrackRowProps & { active: boolean; onPress: () => void }> = ({ track, badge, child, effects, active, player, onPress }) => (
  <button
    onClick={onPress}
    className={`${btn} flex min-w-0 flex-1 items-center gap-4 rounded-2xl border px-4 ${child ? 'py-3' : 'py-4'} text-left ${active ? 'border-pink-400 bg-pink-500/20' : 'border-white/10 bg-[#0D1527]'}`}
  >
    <span className={`flex shrink-0 items-center justify-center rounded-full text-sm font-bold ${child ? 'h-8 w-8' : 'h-10 w-10'} ${active ? 'bg-pink-500' : 'bg-white/10 text-white/70'}`}>
      <TrackBadge active={active} playing={player.playing} badge={badge} />
    </span>
    <span className="min-w-0 flex-1">
      <span className={`block truncate ${child ? 'text-base' : 'text-[17px]'} ${active ? 'font-extrabold' : 'font-semibold'}`}>{track.title}</span>
      {!!effects && <span className="block text-xs text-white/50">{effects} {effects === 1 ? 'efeito sonoro' : 'efeitos sonoros'}</span>}
    </span>
  </button>
);

const EffectsToggle: React.FC<{ expanded: boolean; onClick: () => void }> = ({ expanded, onClick }) => (
  <button onClick={onClick} aria-expanded={expanded} aria-label={expanded ? 'Recolher efeitos' : 'Mostrar efeitos'} className={`${btn} flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70`}>
    <ChevronDown className={`h-5 w-5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
  </button>
);

const TrackRow: React.FC<TrackRowProps> = (props) => {
  const { track, effects, groupId, currentId, player, open, setOpen } = props;
  const active = currentId === track.id;
  const expanded = !!groupId && open.includes(groupId);
  const onPress = () => { if (groupId) setOpen((o) => (o.includes(groupId) ? o : [...o, groupId])); if (active) player.toggle(); else player.playTrack(track); };
  return (
    <li className="flex items-center gap-2">
      <TrackMainButton {...props} active={active} onPress={onPress} />
      {((active && player.elapsed >= 1) || player.startedIds.includes(track.id)) && <RestartButton onClick={() => player.restart(track)} />}
      {!!effects && <EffectsToggle expanded={expanded} onClick={() => setOpen((o) => (o.includes(groupId) ? o.filter((id) => id !== groupId) : [...o, groupId]))} />}
    </li>
  );
};

interface NowPlayingCardProps { player: Player; firstTitle: string | undefined }

const NowPlayingCard: React.FC<NowPlayingCardProps> = ({ player, firstTitle }) => (
  <div className="space-y-4 rounded-3xl border border-white/10 bg-[#0D1527] px-4 py-5 text-center">
    <p className="text-[11px] font-bold uppercase tracking-widest text-pink-300">{player.current ? (player.playing ? 'Tocando agora' : 'Pausado') : 'Toque em play'}</p>
    <div className="flex min-h-[2.5rem] items-center justify-center gap-2">
      <p className="text-xl font-extrabold leading-tight">{player.current?.title ?? firstTitle}</p>
      {player.current && player.elapsed >= 1 && <RestartButton onClick={() => player.restart(player.current)} />}
    </div>
    <div className="flex justify-center"><PlayerButtons player={player} size="lg" /></div>
    <button onClick={player.toggleLoop} aria-pressed={player.loop} className={`${btn} mx-auto flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-bold ${player.loop ? 'border-pink-400 bg-pink-500/25 text-pink-100' : 'border-white/15 text-white/60'}`}><Repeat1 className="h-5 w-5" />{player.loop ? 'Repetindo esta música' : 'Repetir música'}</button>
    {player.error && <p className="text-sm font-semibold text-red-300">{player.error}</p>}
  </div>
);

interface MusicViewProps { player: Player; tracks: AgentTrack[]; loading: boolean; query: string; onQuery: (v: string) => void }

export const MusicView: React.FC<MusicViewProps> = ({ player, tracks, loading, query, onQuery }) => {
  const groups = groupTracks<AgentTrack>(tracks);
  const currentId = player.current?.id;
  // Grupos de efeitos abertos: tocar uma música com parent abre o grupo; tocar fora dele recolhe (a seta abre/fecha só para ver).
  const [open, setOpen] = useState<string[]>([]);
  useEffect(() => {
    const group = groups.find((g) => g.track.id === currentId || g.children.some((c) => c.id === currentId));
    setOpen(group && group.children.length > 0 ? [group.track.id] : []);
  }, [currentId]); // eslint-disable-line react-hooks/exhaustive-deps
  const searching = !!query.trim();
  const matches = tracks.filter((t) => matchesQuery(query, t.title));
  const rowProps = { currentId, player, open, setOpen };

  return (
    <>
      {tracks.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-[#0D1527] px-5 py-6 text-center text-white/60">{loading ? 'Carregando playlist...' : 'Nenhuma música ativa na playlist.'}</p>
      ) : (
        <>
          <NowPlayingCard player={player} firstTitle={groups[0]?.track.title} />
          <SearchBox value={query} onChange={onQuery} placeholder="Buscar música" />
          {searching && matches.length === 0 && <p className="rounded-2xl border border-white/10 bg-[#0D1527] px-5 py-6 text-center text-white/60">Nenhuma música encontrada.</p>}
          <ol className="space-y-2">
            {searching
              ? matches.map((track) => <TrackRow key={track.id} track={track} badge={<Music className="h-4 w-4" />} {...rowProps} />)
              : groups.map(({ track, children }, i) => (
                <React.Fragment key={track.id}>
                  <TrackRow track={track} badge={i + 1} effects={children.length} groupId={track.id} {...rowProps} />
                  {children.length > 0 && open.includes(track.id) && (
                    <li><ol className="ml-5 space-y-2 border-l-2 border-pink-400/30 pl-3">{children.map((child) => <TrackRow key={child.id} track={child} badge={<Music className="h-4 w-4" />} child {...rowProps} />)}</ol></li>
                  )}
                </React.Fragment>
              ))}
          </ol>
        </>
      )}
    </>
  );
};
