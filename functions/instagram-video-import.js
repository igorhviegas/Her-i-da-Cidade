// Cria vídeos INATIVOS (rascunhos para revisão) a partir dos Reels sincronizados. Nunca altera vídeos existentes.
import { randomUUID } from 'node:crypto';

export const VIDEOS_COLLECTION = 'videos';
export const IMPORTED_PATH = 'instagramPrivate/importedReels'; // códigos já importados: vídeo excluído não volta
const MAX_PER_RUN = 30; // ponytail: limita download+upload por execução (maxDuration 60 s); o restante entra na próxima sincronização.
const BATCH = 5;
const MAX_THUMB_BYTES = 4 * 1024 * 1024;

/** Código do post (…/reel/CODE/, /p/CODE/…), igual ao instagramId dos vídeos cadastrados à mão. */
export const reelCode = (url) => String(url ?? '').match(/\/(?:reels?|p|tv)\/([\w-]+)/)?.[1] ?? '';

export function provisionalTitle(caption) {
  const line = String(caption ?? '').split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  return (line.length > 80 ? `${line.slice(0, 77)}...` : line) || 'Reel do Instagram (sem título)';
}

/** Copia a miniatura (a URL da CDN do Instagram expira) para o Vercel Blob e devolve a URL permanente. */
export async function storeThumbnail(url, fetchImpl = fetch, env = process.env) {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`thumbnail ${res.status}`);
  const type = (res.headers.get('content-type') ?? '').split(';')[0];
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) throw new Error('thumbnail com formato não suportado');
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_THUMB_BYTES) throw new Error('thumbnail grande demais');
  const [{ put }, { getVercelOidcToken }] = await Promise.all([import('@vercel/blob'), import('@vercel/oidc')]);
  let oidcToken;
  try { oidcToken = await getVercelOidcToken(); } catch { /* local: o SDK usa BLOB_READ_WRITE_TOKEN */ }
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  const blob = await put(`videos/thumbnails/${randomUUID()}.${ext}`, buffer, {
    access: 'public', contentType: type, storeId: env.BLOB_STORE_ID || 'store_ZlySBsEZT51qmJ7I', ...(oidcToken ? { oidcToken } : {}),
  });
  return blob.url;
}

/** Retorna { imported, failed }. Reel sem miniatura copiada não é criado agora (nova tentativa na próxima sincronização). */
export async function importReelsAsVideos({ db, posts, now = Date.now(), fetchImpl = fetch, store = storeThumbnail }) {
  const reels = posts.filter((p) => p.kind === 'reel' && reelCode(p.permalink));
  if (!reels.length) return { imported: 0, failed: 0 };

  const known = new Set();
  const existing = await db.collection(VIDEOS_COLLECTION).get();
  existing.docs.forEach((d) => {
    const v = d.data();
    for (const code of [v.instagramId, reelCode(v.instagramUrl)]) if (code) known.add(code);
  });
  const importedRef = db.doc(IMPORTED_PATH);
  const importedSnap = await importedRef.get();
  const importedCodes = new Set(importedSnap.exists ? importedSnap.data().codes ?? [] : []);
  importedCodes.forEach((c) => known.add(c));

  const fresh = reels.filter((p) => !known.has(reelCode(p.permalink))).slice(0, MAX_PER_RUN);
  const iso = new Date(now).toISOString();
  let failed = 0;
  const created = [];
  for (let i = 0; i < fresh.length; i += BATCH) {
    await Promise.all(fresh.slice(i, i + BATCH).map(async (post) => {
      const code = reelCode(post.permalink);
      let thumbnailUrl;
      if (post.thumbnailUrl) {
        try { thumbnailUrl = await store(post.thumbnailUrl, fetchImpl); } catch { failed += 1; return; }
      }
      const title = provisionalTitle(post.caption);
      await db.doc(`${VIDEOS_COLLECTION}/ig_${code}`).set({
        title, instagramUrl: post.permalink, instagramId: code, caption: post.caption ?? '',
        ...(thumbnailUrl ? { thumbnailUrl } : {}), ...(post.publishedAt ? { publishedAt: post.publishedAt } : {}),
        category: '', categories: [], tags: [], topics: [], keywords: [], searchText: title.toLowerCase(),
        active: false, featured: false, order: 1, source: 'instagram-sync', needsReview: true,
        createdAt: iso, updatedAt: iso,
      });
      created.push(code);
    }));
  }
  if (created.length) await importedRef.set({ codes: [...importedCodes, ...created] });
  return { imported: created.length, failed };
}
