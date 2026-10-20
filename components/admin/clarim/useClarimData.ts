import { useCallback, useEffect, useState } from 'react';
import { dateKey } from '../../../functions/missions-core.js';
import {
  AD_SLOTS, eventCandidates, followersSummary, reelCode, templateLabel, videosPublished, videoTitle, viewGains,
  type ClarimPage, type EventCandidate, type Period, type ViewGain,
} from '../../../services/clarim.js';
import { loadEventOrders, loadInstagram, loadPhoto, type InstagramData, type StoredPage } from '../../../services/clarimService';
import { getServices } from '../../../services/servicesService';
import { getVideos } from '../../../services/videosService';
import type { Service, Video } from '../../../types';
import { renderServiceArt } from '../services/serviceArtCanvas';
import { loadImage, type RenderData } from './clarimCanvas';

type Img = NonNullable<Awaited<ReturnType<typeof loadImage>>>;

export interface ClarimSources {
  orders: Array<Record<string, unknown>>;
  instagram: InstagramData;
  services: Service[];
  videos: Video[];
}

/** Dados de que as páginas dependem, carregados uma vez por edição. Falha parcial vira aviso, não tela vazia. */
export function useClarimSources() {
  const [sources, setSources] = useState<ClarimSources | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const load = useCallback(() => {
    const notes: string[] = [];
    const safe = <T,>(p: Promise<T>, fallback: T, what: string) => p.catch(() => { notes.push(`Não foi possível carregar ${what}.`); return fallback; });
    Promise.all([
      safe(loadEventOrders(), [], 'os eventos'),
      safe(loadInstagram(), { followers: null, syncedAt: null, posts: [], stats: [] }, 'os dados do Instagram'),
      safe(getServices({ onlyActive: true, fallbackOnError: false }), [], 'os serviços'),
      safe(getVideos(false), [], 'o catálogo de vídeos'),
    ]).then(([orders, instagram, services, videos]) => { setSources({ orders, instagram, services, videos }); setWarnings(notes); });
  }, []);
  useEffect(() => { load(); }, [load]);
  return { sources, warnings, reload: load };
}

export const todayKey = () => dateKey(new Date());

export function weekEvents(sources: ClarimSources | null, period: Period): EventCandidate[] {
  return sources ? eventCandidates(sources.orders, period) : [];
}

export function weekVideos(sources: ClarimSources | null, period: Period): ViewGain[] {
  return sources ? viewGains(sources.instagram.posts, sources.instagram.stats, period, todayKey()) : [];
}

// ---------------------------------------------------------------- imagens (cache da sessão)

const cache = new Map<string, Promise<Img | null>>();
function cached(key: string, make: () => Promise<Img | null>): Promise<Img | null> {
  const hit = cache.get(key);
  if (hit) return hit;
  const next = make().then((img) => { if (!img) cache.delete(key); return img; }); // falha não fica guardada: tenta de novo no próximo desenho
  cache.set(key, next);
  return next;
}

/** Foto recém-enviada: usa o arquivo local sem baixar de novo. */
export const rememberPhoto = (path: string, file: File) => cache.set(`photo:${path}`, loadImage(file));
const photoImg = (path: string) => cached(`photo:${path}`, () => loadPhoto(path).then(loadImage, () => null));
const urlImg = (url: string) => cached(`url:${url}`, () => loadImage(url));

function adImg(service: Service | undefined, format: string | null | undefined) {
  if (!service || !format) return Promise.resolve(null);
  const art = service.art ?? {};
  return cached(`ad:${service.id}:${format}:${service.price}:${art.title ?? ''}:${art.badge ?? ''}:${art.description ?? ''}`, () =>
    renderServiceArt(format as 'square' | 'story' | 'wide', {
      title: art.title ?? service.title, badge: art.badge ?? '', description: art.description ?? '', price: service.price, backgrounds: art.backgrounds ?? {},
    }).then((blob) => (blob ? loadImage(blob) : null), () => null));
}

/** Miniatura permanente do catálogo (Vercel Blob) quando o Reel foi importado; senão a da Meta (pode expirar ou não liberar CORS). */
function thumbFor(sources: ClarimSources, postId: string) {
  const post = sources.instagram.posts.find((p) => p.id === postId);
  if (!post) return Promise.resolve(null);
  const code = reelCode(post.permalink);
  const video = code ? sources.videos.find((v) => v.instagramId === code || reelCode(v.instagramUrl) === code) : undefined;
  const url = video?.thumbnailUrl || video?.thumbnail || post.thumbnailUrl;
  return url ? urlImg(url) : Promise.resolve(null);
}

/** Monta tudo o que o desenho de uma página precisa (textos de dados e imagens já carregadas). */
export async function buildRenderData(page: ClarimPage, all: StoredPage[], sources: ClarimSources, edition: { number: number; periodStart: string; periodEnd: string }): Promise<RenderData> {
  const period = { start: edition.periodStart, end: edition.periodEnd };
  const pageNumber = all.findIndex((p) => p.id === (page as StoredPage).id) + 1 || all.length + 1;
  const d: RenderData = { editionNumber: edition.number, periodEnd: edition.periodEnd, pageNumber, photos: {}, thumbs: {}, ads: {}, services: sources.services };
  const jobs: Array<Promise<void>> = [];
  for (const [slot, ref] of Object.entries(page.photos)) jobs.push(photoImg(ref.path).then((img) => { d.photos[slot] = img; }));
  const service = (id: string) => sources.services.find((s) => s.id === id);
  const slotAd = page.ads.slot;
  if (slotAd) jobs.push(adImg(service(slotAd.serviceId), slotAd.format).then((img) => { d.ads.slot = img; }));

  if (page.template === 'cover') {
    const gains = weekVideos(sources, period);
    const top = gains[0];
    const f = followersSummary({ followers: sources.instagram.followers }, sources.instagram.stats, period, todayKey());
    d.cover = {
      followers: f.followers, gain: f.gain, topGain: top?.gain ?? null, topPublished: top?.published ?? null, topPostId: top?.post.id ?? null,
      index: all.map((p, i) => ({ label: templateLabel(p.template), page: i + 1 })).filter((item) => item.page !== pageNumber),
    };
    if (top && page.fields.variant !== 'photo') jobs.push(thumbFor(sources, top.post.id).then((img) => { d.thumbs[top.post.id] = img; }));
  }
  if (page.template === 'events') d.events = weekEvents(sources, period).filter((e) => e.eligible).map((e) => ({ orderId: e.orderId, weekday: e.weekday }));
  if (page.template === 'performance') {
    const gains = weekVideos(sources, period);
    d.performance = {
      rows: gains.slice(0, 3).map((g) => ({ postId: g.post.id, title: videoTitle(g.post.caption), published: g.published, gain: g.gain, partial: g.partial })),
      total: gains.reduce((sum, g) => sum + g.gain, 0),
      count: videosPublished(sources.instagram.posts, period),
    };
    for (const row of d.performance.rows) jobs.push(thumbFor(sources, row.postId).then((img) => { d.thumbs[row.postId] = img; }));
  }
  if (page.template === 'classifieds') {
    for (const id of page.services) {
      const ad = page.ads[id];
      if (ad?.format) jobs.push(adImg(service(id), ad.format).then((img) => { d.ads[id] = img; }));
    }
  }
  await Promise.all(jobs);
  return d;
}

export const slotFor = (page: ClarimPage) => (page.template === 'news' && page.fields.variant === 'notice' ? AD_SLOTS.newsNotice
  : page.template === 'cover' ? AD_SLOTS.cover : page.template === 'events' ? AD_SLOTS.events : page.template === 'news' ? AD_SLOTS.news : null);
