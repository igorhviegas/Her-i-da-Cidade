// Pré-carregamento das músicas do agente: baixa cada arquivo uma vez (Cache API do navegador) e entrega uma URL local
// (blob:) para o <audio>. Assim o play não espera rede: toca na hora, e em reaberturas/sinal fraco a playlist já está no aparelho.

const CACHE_NAME = 'hdc-agent-audio-v1';

async function openCache(): Promise<Cache | null> {
  try { return 'caches' in globalThis ? await caches.open(CACHE_NAME) : null; } catch { return null; }
}

/** Baixa (ou lê do cache) o áudio e devolve uma URL blob: local. Lança se a rede falhar e não houver cópia salva. */
export async function loadAudioBlobUrl(url: string, signal: AbortSignal): Promise<string> {
  const cache = await openCache();
  let response = (await cache?.match(url)) ?? null;
  if (!response) {
    response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    // A cópia é só um bônus: se o cache falhar (espaço, modo privado), toca igual a partir do download.
    await cache?.put(url, response.clone()).catch(() => {});
  }
  return URL.createObjectURL(await response.blob());
}

/** Apaga do cache os áudios que saíram da playlist (excluídos/substituídos no admin). */
export async function pruneAudioCache(keep: string[]): Promise<void> {
  const cache = await openCache();
  if (!cache) return;
  const wanted = new Set(keep);
  for (const request of await cache.keys()) if (!wanted.has(request.url)) await cache.delete(request);
}

/** Não baixa tudo antecipadamente se o aparelho pediu economia de dados. */
export const shouldPrefetchAudio = (): boolean => !(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
