import { logger } from '../lib/logger.js';
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { deleteObject, getBlob, getStorage, ref, uploadBytes } from 'firebase/storage';
import { app, db } from '../lib/firebase';
import { pageHash, toDate, type ClarimPage, type Period, type StatsDay } from './clarim.js';
import { currentPosts, type InstagramPost } from './instagramMetrics.js';

/** Clarim Semanal (regras em firestore.rules › clarimEditions e storage.rules). */
export const CLARIM_COLLECTION = 'clarimEditions';

export interface ClarimEdition {
  id: string;
  number: number;
  periodStart: string;
  periodEnd: string;
  status: 'draft' | 'published';
  publishedAt: Date | null;
  createdAt: Date | null;
}

export type StoredPage = ClarimPage & { id: string; approvedAt: Date | null };

function firestore() {
  if (!db) throw new Error('Firestore não inicializado.');
  return db;
}

function storage() {
  if (!app) throw new Error('Firebase não inicializado.');
  return getStorage(app);
}

function fail(operation: string, error: unknown): never {
  logger.error(`[clarimService] Falha na operação: ${operation}`, { error, stack: error instanceof Error ? error.stack : undefined });
  throw error instanceof Error && error.message && !/permission|PERMISSION|storage\//.test(error.message) ? error : new Error('Não foi possível concluir. Verifique a conexão e tente de novo.');
}

const validId = (id: string) => Boolean(id) && !id.includes('/');

function mapEdition(id: string, d: Record<string, unknown>): ClarimEdition {
  return {
    id,
    number: typeof d.number === 'number' ? d.number : 0,
    periodStart: String(d.periodStart ?? ''),
    periodEnd: String(d.periodEnd ?? ''),
    status: d.status === 'published' ? 'published' : 'draft',
    publishedAt: toDate(d.publishedAt),
    createdAt: toDate(d.createdAt),
  };
}

function mapPage(id: string, d: Record<string, any>): StoredPage {
  const approval = d.approval && typeof d.approval === 'object' ? d.approval : null;
  return {
    id,
    template: d.template,
    order: typeof d.order === 'number' ? d.order : 0,
    fields: d.fields ?? {},
    photos: d.photos ?? {},
    ads: d.ads ?? {},
    sources: Array.isArray(d.sources) ? d.sources : [],
    services: Array.isArray(d.services) ? d.services : [],
    approval: approval ? { by: String(approval.by ?? ''), at: toDate(approval.at), hash: String(approval.hash ?? '') } : null,
    approvedAt: approval ? toDate(approval.at) : null,
  };
}

// ---------------------------------------------------------------- edições

export async function listEditions(): Promise<ClarimEdition[]> {
  try {
    const snap = await getDocs(collection(firestore(), CLARIM_COLLECTION));
    return snap.docs.map((d) => mapEdition(d.id, d.data())).sort((a, b) => b.number - a.number);
  } catch (error) {
    return fail('listar edições', error);
  }
}

/** Nova edição com o próximo número. ponytail: número = maior + 1 lido no cliente; com mais de um editor ao mesmo tempo, usar contador em transação. */
export async function createEdition(period: Period, existing: ClarimEdition[]): Promise<ClarimEdition> {
  const number = existing.reduce((max, e) => Math.max(max, e.number), 0) + 1;
  const reference = doc(collection(firestore(), CLARIM_COLLECTION));
  try {
    await setDoc(reference, { number, periodStart: period.start, periodEnd: period.end, status: 'draft', publishedAt: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  } catch (error) {
    return fail('criar edição', error);
  }
  return { id: reference.id, number, periodStart: period.start, periodEnd: period.end, status: 'draft', publishedAt: null, createdAt: new Date() };
}

export async function updateEdition(edition: ClarimEdition, patch: Partial<Pick<ClarimEdition, 'periodStart' | 'periodEnd'>> & { published?: boolean }): Promise<ClarimEdition> {
  if (!validId(edition.id)) throw new Error('Edição inválida.');
  const next: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.periodStart) next.periodStart = patch.periodStart;
  if (patch.periodEnd) next.periodEnd = patch.periodEnd;
  if (patch.published !== undefined) {
    next.status = patch.published ? 'published' : 'draft';
    next.publishedAt = patch.published ? serverTimestamp() : null;
  }
  try {
    await updateDoc(doc(firestore(), CLARIM_COLLECTION, edition.id), next);
  } catch (error) {
    return fail(`atualizar edição ${edition.id}`, error);
  }
  return {
    ...edition,
    periodStart: patch.periodStart ?? edition.periodStart,
    periodEnd: patch.periodEnd ?? edition.periodEnd,
    ...(patch.published === undefined ? {} : { status: patch.published ? 'published' : 'draft', publishedAt: patch.published ? new Date() : null }),
  };
}

/** Exclui a edição, as páginas e as fotos (nada fica para trás no Storage). */
export async function deleteEdition(edition: ClarimEdition): Promise<void> {
  if (!validId(edition.id)) throw new Error('Edição inválida.');
  const pages = await listPages(edition.id);
  for (const page of pages) await deletePhotos(Object.values(page.photos).map((p) => p.path));
  try {
    const batch = writeBatch(firestore());
    for (const page of pages) batch.delete(doc(firestore(), CLARIM_COLLECTION, edition.id, 'pages', page.id));
    batch.delete(doc(firestore(), CLARIM_COLLECTION, edition.id));
    await batch.commit();
  } catch (error) {
    fail(`excluir edição ${edition.id}`, error);
  }
}

// ---------------------------------------------------------------- páginas

const pagesOf = (editionId: string) => collection(firestore(), CLARIM_COLLECTION, editionId, 'pages');

export async function listPages(editionId: string): Promise<StoredPage[]> {
  if (!validId(editionId)) throw new Error('Edição inválida.');
  try {
    const snap = await getDocs(pagesOf(editionId));
    return snap.docs.map((d) => mapPage(d.id, d.data())).sort((a, b) => a.order - b.order);
  } catch (error) {
    return fail('listar páginas', error);
  }
}

const content = (page: ClarimPage) => ({
  template: page.template, order: page.order, fields: page.fields, photos: page.photos, ads: page.ads, sources: page.sources, services: page.services,
});

export async function createPage(editionId: string, page: ClarimPage): Promise<StoredPage> {
  const reference = doc(pagesOf(editionId));
  try {
    await setDoc(reference, { ...content(page), approval: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  } catch (error) {
    return fail('criar página', error);
  }
  return { ...page, id: reference.id, approval: null, approvedAt: null };
}

/** Grava o conteúdo. A aprovação gravada fica, mas só vale enquanto o conteúdo for o aprovado (pageHash). */
export async function savePage(editionId: string, page: StoredPage): Promise<void> {
  if (!validId(page.id)) throw new Error('Página inválida.');
  try {
    await updateDoc(doc(pagesOf(editionId), page.id), { ...content(page), updatedAt: serverTimestamp() });
  } catch (error) {
    fail(`salvar página ${page.id}`, error);
  }
}

export async function savePageOrder(editionId: string, pages: StoredPage[]): Promise<void> {
  try {
    const batch = writeBatch(firestore());
    pages.forEach((p, order) => batch.update(doc(pagesOf(editionId), p.id), { order, updatedAt: serverTimestamp() }));
    await batch.commit();
  } catch (error) {
    fail('reordenar páginas', error);
  }
}

/** Aprova o conteúdo atual em nome de quem está logado (as regras exigem o próprio uid e a hora do servidor). */
export async function approvePage(editionId: string, page: StoredPage, uid: string): Promise<StoredPage> {
  const hash = pageHash(page);
  try {
    await updateDoc(doc(pagesOf(editionId), page.id), { ...content(page), approval: { by: uid, at: serverTimestamp(), hash }, updatedAt: serverTimestamp() });
  } catch (error) {
    return fail(`aprovar página ${page.id}`, error);
  }
  return { ...page, approval: { by: uid, at: new Date(), hash }, approvedAt: new Date() };
}

export async function deletePage(editionId: string, page: StoredPage): Promise<void> {
  if (!validId(page.id)) throw new Error('Página inválida.');
  await deletePhotos(Object.values(page.photos).map((p) => p.path));
  try {
    await deleteDoc(doc(pagesOf(editionId), page.id));
  } catch (error) {
    fail(`excluir página ${page.id}`, error);
  }
}

// ---------------------------------------------------------------- fotos (Storage privado)

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Envia a foto para clarim/{edição}/{página}/ e devolve o caminho (nunca uma URL pública). */
export async function uploadPhoto(editionId: string, pageId: string, file: File): Promise<string> {
  if (!PHOTO_TYPES.includes(file.type)) throw new Error('Formato não suportado. Use JPG, PNG ou WEBP.');
  if (file.size >= 15 * 1024 * 1024) throw new Error('A foto pode ter até 15 MB.');
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `clarim/${editionId}/${pageId}/${crypto.randomUUID()}.${ext}`;
  try {
    await uploadBytes(ref(storage(), path), file, { contentType: file.type });
  } catch (error) {
    return fail('enviar foto', error);
  }
  return path;
}

/** Baixa a foto autenticado (exige CORS no bucket; ver docs/clarim.md). */
export async function loadPhoto(path: string): Promise<Blob> {
  try {
    return await getBlob(ref(storage(), path));
  } catch (error) {
    return fail('carregar foto', error);
  }
}

export async function deletePhotos(paths: string[]): Promise<void> {
  for (const path of paths) {
    try {
      await deleteObject(ref(storage(), path));
    } catch (error) {
      // arquivo já removido não impede a exclusão do resto
      if (!(error instanceof Error && /object-not-found/.test(error.message))) logger.warn('[clarimService] Foto não removida', { path, error });
    }
  }
}

// ---------------------------------------------------------------- dados das páginas

/** Pedidos de evento presencial (serviço 6), só com o necessário para a elegibilidade. */
export async function loadEventOrders(): Promise<Array<Record<string, unknown>>> {
  try {
    const snap = await getDocs(query(collection(firestore(), 'orders'), where('serviceId', '==', '6')));
    return snap.docs.map((d) => {
      const o = d.data();
      return { id: d.id, serviceId: o.serviceId, eventDate: o.eventDate, eventDraft: o.eventDraft, paymentPending: o.paymentPending, eventForm: o.eventForm ? { imageAuthorization: o.eventForm.imageAuthorization } : undefined };
    });
  } catch (error) {
    return fail('carregar eventos', error);
  }
}

export interface InstagramData { followers: number | null; syncedAt: string | null; posts: InstagramPost[]; stats: StatsDay[] }

export async function loadInstagram(): Promise<InstagramData> {
  try {
    const [profile, posts, stats] = await Promise.all([
      getDoc(doc(firestore(), 'instagramMeta', 'profile')),
      getDocs(collection(firestore(), 'instagramPosts')),
      getDocs(collection(firestore(), 'instagramStats')),
    ]);
    const p = profile.exists() ? profile.data() : null;
    const syncedAt = typeof p?.syncedAt === 'string' ? p.syncedAt : null;
    return {
      followers: typeof p?.followers === 'number' ? p.followers : null,
      syncedAt,
      // só as publicações da última sincronização (as removidas do Instagram ficam no banco sem atualizar)
      posts: currentPosts(posts.docs.map((d) => d.data() as InstagramPost), syncedAt ?? undefined),
      stats: stats.docs.map((d) => ({ day: d.id, ...(d.data() as Omit<StatsDay, 'day'>) })),
    };
  } catch (error) {
    return fail('carregar dados do Instagram', error);
  }
}
