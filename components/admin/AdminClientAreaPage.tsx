import { logger } from '../../lib/logger.js';
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, Loader2, Plus, QrCode, Save, Trash2 } from 'lucide-react';
import { getVideos } from '../../services/videosService';
import { updatePublicSiteConfig, useSiteConfig } from '../../services/siteConfigService';
import { shiftNavItem } from '../../services/adminNav.js';
import {
  CLIENTS_FEATURED_MAX,
  DEFAULT_THANK_YOU_VIDEO_URL,
  parsePoster,
  parseThankYouVideo,
  resolveClientsConfig,
} from '../../services/clientsPage.js';
import { normalizeVideoSearchText } from '../../utils/videoSearch';
import type { Video } from '../../types';
import { ThankYouVideo } from '../publicSite/ThankYouVideo';
import { SettingsFeedback } from './adminPages/SettingsParts';

type Feedback = { type: 'success' | 'error'; message: string };

const card = 'bg-[#0D1527] border border-white/10 rounded-2xl p-5 sm:p-7 shadow-xl';
const field = 'w-full bg-[#070B14] border border-white/10 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/25 outline-none transition';
const label = 'mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/70';
const saveButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40';
const iconButton = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent';

/** Admin → Streaming → Página dos clientes: vídeo de agradecimento e vídeos em destaque de /clientes (siteConfig/public). */
export const AdminClientAreaPage: React.FC = () => {
  const { config, loading } = useSiteConfig();
  const saved = useMemo(() => resolveClientsConfig(config), [config]);

  const [videoUrl, setVideoUrl] = useState(DEFAULT_THANK_YOU_VIDEO_URL);
  const [poster, setPoster] = useState('');
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [featuredIds, setFeaturedIds] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<Video[]>([]);
  const [query, setQuery] = useState('');
  const [savingKey, setSavingKey] = useState<'video' | 'featured' | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Preenche os campos uma vez, com o que está salvo; depois disso só o admin os altera.
  useEffect(() => {
    if (loading || hydrated) return;
    setVideoUrl(saved.videoUrl);
    setPoster(saved.poster);
    setOrientation(saved.orientation);
    setFeaturedIds(saved.featuredIds);
    setHydrated(true);
  }, [loading, hydrated, saved]);

  useEffect(() => {
    getVideos().then(setCatalog).catch((error) => {
      logger.error('[AdminClientAreaPage] Erro ao carregar vídeos:', error);
      setFeedback({ type: 'error', message: 'Não foi possível carregar os vídeos do catálogo.' });
    });
  }, []);

  const byId = useMemo(() => new Map(catalog.map((video) => [video.id, video])), [catalog]);

  // Vídeo salvo que saiu do catálogo (excluído/inativo) deixa a lista, para o admin não ficar com item invisível.
  useEffect(() => {
    if (!hydrated || catalog.length === 0) return;
    setFeaturedIds((current) => (current.every((id) => byId.has(id)) ? current : current.filter((id) => byId.has(id))));
  }, [hydrated, catalog, byId]);
  const selected = featuredIds.map((id) => byId.get(id)).filter((video): video is Video => Boolean(video));
  const candidates = useMemo(() => {
    const term = normalizeVideoSearchText(query);
    return catalog.filter((video) => !featuredIds.includes(video.id) && (!term || normalizeVideoSearchText(video.title).includes(term)));
  }, [catalog, featuredIds, query]);

  const videoValid = parseThankYouVideo(videoUrl) !== null;
  const posterValid = !poster.trim() || parsePoster(poster) !== null;
  const featuredDirty = featuredIds.join() !== saved.featuredIds.join();
  const videoDirty = videoUrl.trim() !== saved.videoUrl || poster.trim() !== saved.poster || orientation !== saved.orientation;

  const save = async (key: 'video' | 'featured', updates: Record<string, unknown>, success: string) => {
    setSavingKey(key);
    setFeedback(null);
    try {
      await updatePublicSiteConfig(updates);
      setFeedback({ type: 'success', message: success });
    } catch (error) {
      logger.error('[AdminClientAreaPage] Erro ao salvar:', error);
      setFeedback({ type: 'error', message: `Falha ao salvar: ${error instanceof Error ? error.message : 'verifique suas permissões de administrador.'}` });
    } finally {
      setSavingKey(null);
    }
  };

  const saveVideo = (event: React.FormEvent) => {
    event.preventDefault();
    if (!videoValid || !posterValid) return;
    void save('video', { clientsVideoUrl: videoUrl.trim(), clientsVideoPoster: poster.trim(), clientsVideoOrientation: orientation }, 'Vídeo de agradecimento salvo. A página /clientes já usa o novo vídeo.');
  };

  const saveFeatured = () => {
    void save('featured', { clientsFeaturedVideoIds: featuredIds }, featuredIds.length
      ? 'Vídeos em destaque salvos.'
      : 'Seleção limpa: a página volta a usar o destaque e a ordem do catálogo.');
  };

  const move = (id: string, delta: -1 | 1) => setFeaturedIds((current) => shiftNavItem(current, id, delta) as string[]);

  return (
    <div className="space-y-8">
      <div className="border-b border-white/10 pb-6">
        <h1 className="flex items-center gap-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
          <QrCode className="h-8 w-8 text-blue-400" aria-hidden />
          Página dos clientes
        </h1>
        <p className="mt-1 text-sm font-light text-white/60">
          Conteúdo da página aberta pelo QR Code do certificado.{' '}
          <a href="/clientes" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300">
            Abrir /clientes <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </p>
      </div>

      {feedback && <SettingsFeedback feedback={feedback} />}

      {loading || !hydrated ? (
        <div className="flex items-center justify-center gap-3 py-12 text-sm text-white/40"><Loader2 className="h-6 w-6 animate-spin text-blue-400" aria-hidden />Carregando...</div>
      ) : (
        <>
          <form onSubmit={saveVideo} className={`${card} space-y-5`}>
            <div>
              <h2 className="text-lg font-bold">Vídeo de agradecimento</h2>
              <p className="mt-0.5 text-sm font-light text-white/60">Aparece no topo da página. Link do YouTube (público ou não listado) ou arquivo .mp4. Link do Instagram não funciona em reel privado.</p>
            </div>

            <div>
              <label htmlFor="clients-video-url" className={label}>Link do vídeo</label>
              <input id="clients-video-url" type="url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="https://youtu.be/..." aria-invalid={!videoValid} className={`${field} font-mono`} />
              {!videoValid && <p role="alert" className="mt-1.5 text-xs font-medium text-rose-300">Link não reconhecido. Use um link do YouTube ou um arquivo https://….mp4</p>}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="clients-video-orientation" className={label}>Formato do vídeo</label>
                <select id="clients-video-orientation" value={orientation} onChange={(event) => setOrientation(event.target.value === 'vertical' ? 'vertical' : 'horizontal')} className={field}>
                  <option value="horizontal">Horizontal (deitado)</option>
                  <option value="vertical">Vertical (Reel / Short)</option>
                </select>
              </div>
              <div>
                <label htmlFor="clients-video-poster" className={label}>Capa (opcional)</label>
                <input id="clients-video-poster" type="url" value={poster} onChange={(event) => setPoster(event.target.value)} placeholder="https://… (imagem)" aria-invalid={!posterValid} className={`${field} font-mono`} />
                {!posterValid && <p role="alert" className="mt-1.5 text-xs font-medium text-rose-300">Use um link https de imagem.</p>}
              </div>
            </div>

            {videoValid && (
              <div>
                <span className={label}>Prévia</span>
                <ThankYouVideo url={videoUrl} poster={poster} orientation={orientation} />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
              <button type="submit" disabled={!videoValid || !posterValid || !videoDirty || savingKey !== null} className={saveButton}>
                {savingKey === 'video' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                Salvar vídeo
              </button>
              <button type="button" onClick={() => { setVideoUrl(DEFAULT_THANK_YOU_VIDEO_URL); setPoster(''); setOrientation('horizontal'); }} className="text-sm text-white/50 underline hover:text-white">
                Voltar ao vídeo padrão
              </button>
            </div>
          </form>

          <section className={`${card} space-y-5`} aria-labelledby="featured-title">
            <div>
              <h2 id="featured-title" className="text-lg font-bold">Vídeos em destaque</h2>
              <p className="mt-0.5 text-sm font-light text-white/60">
                Carrossel da página, na ordem abaixo (até {CLIENTS_FEATURED_MAX}). Sem nenhum selecionado, a página usa o vídeo em destaque do catálogo e os primeiros pela ordem do catálogo.
              </p>
            </div>

            {selected.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-white/50">Nenhum vídeo selecionado (seleção automática).</p>
            ) : (
              <ol className="space-y-2">
                {selected.map((video, index) => (
                  <li key={video.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-2 pr-1">
                    <span className="w-6 shrink-0 text-center text-xs font-bold text-white/40">{index + 1}</span>
                    {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" loading="lazy" className="h-12 w-8 shrink-0 rounded object-cover" /> : <span className="h-12 w-8 shrink-0 rounded bg-white/10" />}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{video.title}</span>
                    <button type="button" onClick={() => move(video.id, -1)} disabled={index === 0} aria-label={`Subir ${video.title}`} className={iconButton}><ArrowUp className="h-4 w-4" aria-hidden /></button>
                    <button type="button" onClick={() => move(video.id, 1)} disabled={index === selected.length - 1} aria-label={`Descer ${video.title}`} className={iconButton}><ArrowDown className="h-4 w-4" aria-hidden /></button>
                    <button type="button" onClick={() => setFeaturedIds((current) => current.filter((id) => id !== video.id))} aria-label={`Remover ${video.title}`} className={`${iconButton} hover:text-rose-300`}><Trash2 className="h-4 w-4" aria-hidden /></button>
                  </li>
                ))}
              </ol>
            )}

            <div>
              <label htmlFor="clients-featured-search" className={label}>Adicionar vídeo</label>
              <input id="clients-featured-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pelo título..." className={field} />
              <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto pr-1">
                {candidates.map((video) => (
                  <li key={video.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5">
                    <span className="min-w-0 flex-1 truncate text-sm text-white/85">{video.title}</span>
                    <button type="button" onClick={() => setFeaturedIds((current) => [...current, video.id])} disabled={featuredIds.length >= CLIENTS_FEATURED_MAX} aria-label={`Adicionar ${video.title}`} className={`${iconButton} hover:text-emerald-300`}><Plus className="h-4 w-4" aria-hidden /></button>
                  </li>
                ))}
                {candidates.length === 0 && <li className="px-2 py-3 text-sm text-white/40">Nenhum vídeo encontrado.</li>}
              </ul>
              {featuredIds.length >= CLIENTS_FEATURED_MAX && <p className="mt-2 text-xs text-amber-300">Limite de {CLIENTS_FEATURED_MAX} vídeos atingido.</p>}
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
              <button type="button" onClick={saveFeatured} disabled={!featuredDirty || savingKey !== null} className={saveButton}>
                {savingKey === 'featured' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                Salvar destaques
              </button>
              {featuredIds.length > 0 && <button type="button" onClick={() => setFeaturedIds([])} className="text-sm text-white/50 underline hover:text-white">Limpar seleção</button>}
            </div>
          </section>
        </>
      )}
    </div>
  );
};
