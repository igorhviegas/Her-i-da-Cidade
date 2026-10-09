// Vídeos do campeonato: o admin cola o link do YouTube; aqui só extraímos o id para o player embutido.
export const KART_VIDEO_KINDS = { tip: 'Dicas', race: 'Corridas completas' };

/** Id do vídeo (11 caracteres) de um link do YouTube (watch, youtu.be, shorts, embed, live) ou do próprio id; '' se não for. */
export function youtubeId(input) {
  const text = String(input ?? '').trim();
  if (/^[\w-]{11}$/.test(text)) return text;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    const host = url.hostname.replace(/^(www|m)\./, '');
    const id = host === 'youtu.be' ? url.pathname.split('/')[1]
      : host === 'youtube.com' || host === 'youtube-nocookie.com' ? (url.searchParams.get('v') ?? /^\/(?:embed|shorts|live)\/([\w-]{11})/.exec(url.pathname)?.[1])
      : '';
    return /^[\w-]{11}$/.test(id ?? '') ? id : '';
  } catch { return ''; }
}

/** Vídeo ativo de cada corrida: Map raceId → vídeo (o primeiro, na ordem da lista). */
export function videosByRace(videos) {
  const map = new Map();
  for (const v of [...(videos ?? [])].sort((a, b) => a.order - b.order)) if (v.raceId && v.active !== false && v.youtubeId && !map.has(v.raceId)) map.set(v.raceId, v);
  return map;
}
