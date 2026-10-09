import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentTrack } from '../../services/agentService';
import { groupTracks } from '../../services/agentContent.js';
import { loadAudioBlobUrl, pruneAudioCache, shouldPrefetchAudio } from './audioCache';

/**
 * Player único da área do agente. Mora no componente raiz (AgentApp), então trocar de tela não o desmonta
 * e a música continua. Um <audio> só, reutilizado: no iOS o play() precisa nascer de um toque, e depois
 * dessa "ativação" o mesmo elemento pode trocar de faixa sozinho (avanço automático ao fim da música).
 */
export function useAgentPlayer(tracks: AgentTrack[]) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (!audioRef.current && typeof Audio !== 'undefined') {
    audioRef.current = new Audio();
    audioRef.current.preload = 'auto';
  }
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const currentIdRef = useRef<string | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0); // segundos desde o início da música atual
  const [error, setError] = useState<string | null>(null);
  const [loop, setLoop] = useState(false);
  // Onde cada música parou ao trocar para outra: voltar nela continua dali (some ao terminar a música).
  const positions = useRef(new Map<string, number>());
  // Ids com posição guardada (para mostrar o botão de recomeçar nas músicas que não estão no início).
  const [startedIds, setStartedIds] = useState<string[]>([]);
  // URL remota -> URL local (blob:) das músicas já baixadas; `loadedUrlRef` = URL remota da faixa carregada no <audio>.
  const localUrls = useRef(new Map<string, string>());
  const loadedUrlRef = useRef<string | null>(null);

  const playTrack = useCallback((track: AgentTrack) => {
    const audio = audioRef.current;
    if (!audio) return;
    const previousId = currentIdRef.current;
    if (previousId && previousId !== track.id && audio.currentTime > 0) {
      positions.current.set(previousId, audio.currentTime);
      setStartedIds((ids) => (ids.includes(previousId) ? ids : [...ids, previousId]));
    }
    if (previousId !== track.id || loadedUrlRef.current !== track.url) {
      audio.src = localUrls.current.get(track.url) ?? track.url; // baixada = toca na hora; senão, streaming
      loadedUrlRef.current = track.url;
      const resumeAt = positions.current.get(track.id);
      // O iOS ignora currentTime antes dos metadados: só posiciona quando carregarem.
      if (resumeAt) audio.addEventListener('loadedmetadata', () => { audio.currentTime = resumeAt; }, { once: true });
      setProgress(0);
      setElapsed(0);
    }
    currentIdRef.current = track.id;
    setCurrentId(track.id);
    setError(null);
    audio.play().catch(() => { setPlaying(false); setError('Não foi possível tocar esta música. Toque em play para tentar de novo.'); });
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    const list = tracksRef.current;
    if (!audio || list.length === 0) return;
    const current = list.find((t) => t.id === currentIdRef.current);
    if (!current) playTrack(list[0]);
    else if (audio.paused) playTrack(current);
    else audio.pause();
  }, [playTrack]);

  /** Volta a música ao 00:00 sem tocar: a atual é pausada; as outras só perdem a posição guardada. */
  const restart = useCallback((track: AgentTrack) => {
    positions.current.delete(track.id);
    setStartedIds((ids) => ids.filter((id) => id !== track.id));
    const audio = audioRef.current;
    if (audio && currentIdRef.current === track.id) {
      audio.pause();
      audio.currentTime = 0;
      setProgress(0);
      setElapsed(0);
    }
  }, []);

  const step = useCallback((delta: -1 | 1) => {
    // Anterior/próxima andam só pelas músicas principais; os efeitos (parents) são tocados direto pela lista.
    const groups = groupTracks(tracksRef.current);
    if (groups.length === 0) return;
    const index = groups.findIndex((g) => g.track.id === currentIdRef.current || g.children.some((c) => c.id === currentIdRef.current));
    playTrack(groups[(index + delta + groups.length) % groups.length].track);
  }, [playTrack]);
  const stepRef = useRef(step);
  stepRef.current = step;
  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      const endedId = currentIdRef.current;
      if (endedId) { positions.current.delete(endedId); setStartedIds((ids) => ids.filter((id) => id !== endedId)); }
      // Avança sozinho entre as principais; ao fim de um efeito ou da última música, para.
      const groups = groupTracks(tracksRef.current);
      const index = groups.findIndex((g) => g.track.id === currentIdRef.current);
      if (index >= 0 && index < groups.length - 1) stepRef.current(1);
      else setPlaying(false);
    };
    const onTime = () => { setProgress(audio.duration > 0 ? audio.currentTime / audio.duration : 0); setElapsed(audio.currentTime); };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onError = () => { setPlaying(false); setError('Não foi possível carregar esta música.'); };
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
      audio.pause();
    };
  }, []);

  // Repetir a música atual (com loop ligado o 'ended' nem dispara); vale também ao trocar de música.
  useEffect(() => { if (audioRef.current) audioRef.current.loop = loop; }, [loop]);

  // Baixa a playlist em segundo plano (2 por vez, na ordem da lista) para o play não depender da rede.
  const urlsKey = tracks.map((t) => t.url).join('\n');
  useEffect(() => {
    const urls = urlsKey ? urlsKey.split('\n') : [];
    if (urls.length === 0 || !shouldPrefetchAudio()) return;
    const controller = new AbortController();
    const queue = urls.filter((url) => !localUrls.current.has(url));
    const worker = async () => {
      for (let url = queue.shift(); url && !controller.signal.aborted; url = queue.shift()) {
        try { localUrls.current.set(url, await loadAudioBlobUrl(url, controller.signal)); } catch { /* segue em streaming */ }
      }
    };
    void Promise.all([worker(), worker()]).then(() => pruneAudioCache(urls));
    return () => controller.abort();
  }, [urlsKey]);
  useEffect(() => () => { localUrls.current.forEach((url) => URL.revokeObjectURL(url)); }, []);

  // Controles da tela de bloqueio / fones (iOS e Android).
  const current = tracks.find((t) => t.id === currentId) ?? null;
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    session.metadata = current && typeof MediaMetadata !== 'undefined' ? new MediaMetadata({ title: current.title, artist: 'Herói da Cidade' }) : null;
    session.setActionHandler('play', () => toggleRef.current());
    session.setActionHandler('pause', () => toggleRef.current());
    session.setActionHandler('previoustrack', () => stepRef.current(-1));
    session.setActionHandler('nexttrack', () => stepRef.current(1));
  }, [current]);

  return { current, playing, progress, error, loop, elapsed, startedIds, restart, toggleLoop: () => setLoop((l) => !l), playTrack, toggle, next: () => step(1), prev: () => step(-1) };
}
