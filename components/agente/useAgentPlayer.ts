import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentTrack } from '../../services/agentService';

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
  const [error, setError] = useState<string | null>(null);

  const playTrack = useCallback((track: AgentTrack) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (currentIdRef.current !== track.id || audio.src !== track.url) {
      audio.src = track.url;
      setProgress(0);
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

  const step = useCallback((delta: -1 | 1) => {
    const list = tracksRef.current;
    if (list.length === 0) return;
    const index = list.findIndex((t) => t.id === currentIdRef.current);
    playTrack(list[(index + delta + list.length) % list.length]);
  }, [playTrack]);
  const stepRef = useRef(step);
  stepRef.current = step;
  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      const list = tracksRef.current;
      // Avança sozinho; na última música da playlist para.
      if (list.findIndex((t) => t.id === currentIdRef.current) < list.length - 1) stepRef.current(1);
      else setPlaying(false);
    };
    const onTime = () => setProgress(audio.duration > 0 ? audio.currentTime / audio.duration : 0);
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

  return { current, playing, progress, error, playTrack, toggle, next: () => step(1), prev: () => step(-1) };
}
