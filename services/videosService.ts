import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, deleteField, onSnapshot, Unsubscribe, serverTimestamp, query, where, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Video } from "../types";
import { extractInstagramId, generateKeywords, buildSearchText } from "../utils/videoHelpers";
import { uploadThumbnailToVercelBlob } from "./blobUploadService";

export const VIDEOS_COLLECTION = "videos";

function normalizeCategoryValue(value?: string): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCategoriesArray(values?: string[]): string[] {
  if (!Array.isArray(values)) return [];
  const unique = new Set<string>();
  values.forEach((value) => {
    const trimmed = normalizeCategoryValue(value);
    if (trimmed) unique.add(trimmed);
  });
  return Array.from(unique);
}

function resolveVideoCategories(input: { category?: string; categories?: string[] }): { category: string; categories: string[] } {
  const normalizedFromArray = normalizeCategoriesArray(input.categories);
  const legacyCategory = normalizeCategoryValue(input.category);
  const categories = normalizedFromArray.length
    ? normalizedFromArray
    : (legacyCategory ? [legacyCategory] : []);
  const category = categories[0] || "";
  return { category, categories };
}

/** Validador de URL HTTP/HTTPS */
export function isValidHttpUrl(urlString: string): boolean {
  if (!urlString || typeof urlString !== 'string') return false;
  try {
    const url = new URL(urlString.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Convert Firestore document to UI Video */
export function mapDocToVideo(docId: string, data: any): Video {
  const { category, categories } = resolveVideoCategories({
    category: data.category,
    categories: data.categories,
  });

  return {
    id: docId,
    title: data.title || "",
    instagramUrl: data.instagramUrl || "",
    instagramId: data.instagramId || "",
    caption: data.caption || "",
    description: data.description || "",
    thumbnail: data.thumbnail || "",
    ...(data.thumbnailUrl ? { thumbnailUrl: data.thumbnailUrl } : {}),
    ...(data.badgeText ? { badgeText: data.badgeText } : {}),
    category,
    categories,
    tags: data.tags || [],
    topics: data.topics || [],
    ageRange: data.ageRange,
    keywords: data.keywords || [],
    searchText: data.searchText,
    publishedAt: data.publishedAt,
    active: data.active !== false,
    featured: data.featured === true,
    order: data.order !== undefined ? Number(data.order) : 1,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/** Fetch all videos (optionally only active) */
export async function getVideos(onlyActive: boolean = true): Promise<Video[]> {
  if (!db) return [];
  const snapshot = await getDocs(collection(db, VIDEOS_COLLECTION));
  let videos = snapshot.docs.map(d => mapDocToVideo(d.id, d.data()));
  if (onlyActive) videos = videos.filter(v => v.active);
  videos.sort((a, b) => {
    const orderA = a.order ?? 0;
    const orderB = b.order ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return dateB - dateA;
  });
  return videos;
}

/** Migração idempotente: adiciona categories:[category] em vídeos legados */
export async function migrateLegacyVideoCategories(): Promise<number> {
  if (!db) return 0;
  const snapshot = await getDocs(collection(db, VIDEOS_COLLECTION));
  let migratedCount = 0;
  let pendingDocs: Array<typeof snapshot.docs[number]> = [];

  for (const videoDoc of snapshot.docs) {
    const data = videoDoc.data();
    const legacyCategory = normalizeCategoryValue(data.category);
    const categories = normalizeCategoriesArray(data.categories);
    if (!legacyCategory || categories.length > 0) continue;

    pendingDocs.push(videoDoc);
    if (pendingDocs.length < 450) continue;

    const batch = writeBatch(db);
    pendingDocs.forEach((pendingDoc) => {
      const pendingCategory = normalizeCategoryValue(pendingDoc.data().category);
      if (!pendingCategory) return;
      batch.update(pendingDoc.ref, {
        categories: [pendingCategory],
        updatedAt: serverTimestamp(),
      });
      migratedCount += 1;
    });
    await batch.commit();
    pendingDocs = [];
  }

  if (pendingDocs.length > 0) {
    const batch = writeBatch(db);
    pendingDocs.forEach((pendingDoc) => {
      const pendingCategory = normalizeCategoryValue(pendingDoc.data().category);
      if (!pendingCategory) return;
      batch.update(pendingDoc.ref, {
        categories: [pendingCategory],
        updatedAt: serverTimestamp(),
      });
      migratedCount += 1;
    });
    await batch.commit();
  }

  return migratedCount;
}

/** Real‑time subscription */
export function subscribeToVideos(
  onUpdate: (videos: Video[]) => void,
  onError?: (error: Error) => void,
  onlyActive: boolean = true
): Unsubscribe {
  if (!db) {
    onUpdate([]);
    return () => {};
  }
  return onSnapshot(
    collection(db, VIDEOS_COLLECTION),
    snapshot => {
      let vids = snapshot.docs.map(d => mapDocToVideo(d.id, d.data()));
      if (onlyActive) vids = vids.filter(v => v.active);
      onUpdate(vids);
    },
    err => {
      if (onError) onError(err);
      onUpdate([]);
    }
  );
}

/** Get single video by id */
export async function getVideoById(id: string): Promise<Video | null> {
  if (!db || !id) return null;
  const docRef = doc(db, VIDEOS_COLLECTION, id);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return mapDocToVideo(snapshot.id, snapshot.data());
}

/** Get video by Instagram ID */
export async function getVideoByInstagramId(instagramId: string): Promise<Video | null> {
  if (!db || !instagramId) return null;
  const q = query(collection(db, VIDEOS_COLLECTION), where('instagramId', '==', instagramId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return mapDocToVideo(docSnap.id, docSnap.data());
}

/** Create new video with optional thumbnail file upload */
export async function createVideo(
  input: Partial<Video>,
  thumbnailFile?: File | null
): Promise<Video> {
  if (!db) throw new Error("Firestore não inicializado");
  // 1. Gerar document ID antecipadamente para upload consistente
  const newDocRef = doc(collection(db, VIDEOS_COLLECTION));
  const videoId = newDocRef.id;

  // 2. Se houver arquivo de thumbnail, fazer upload para Vercel Blob via API
  let finalThumbnailUrl: string | undefined = input.thumbnailUrl?.trim();
  if (thumbnailFile) {
    finalThumbnailUrl = await uploadThumbnailToVercelBlob(thumbnailFile);
  }

  const { category, categories } = resolveVideoCategories(input);
  const tags = input.tags || [];
  const topics = input.topics || [];
  const generatedKeywords = generateKeywords(input.title || "", categories);
  const keywords = Array.from(new Set([...(input.keywords || []), ...generatedKeywords]));
  const searchText = buildSearchText({
    title: input.title || "",
    caption: input.caption || "",
    description: input.description || "",
    categories,
    tags,
    topics,
    keywords,
  });

  const payload: any = {
    title: input.title || "",
    instagramUrl: input.instagramUrl || "",
    instagramId: input.instagramId || extractInstagramId(input.instagramUrl || ""),
    category,
    categories,
    keywords,
    tags,
    topics,
    searchText,
    active: input.active !== false,
    featured: input.featured === true && input.active !== false,
    order: input.order !== undefined ? Number(input.order) : 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // Se o novo vídeo estiver sendo criado como destaque, desmarcar qualquer destaque anterior
  if (payload.featured) {
    const q = query(collection(db, VIDEOS_COLLECTION), where("featured", "==", true));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.forEach(d => {
        batch.update(d.ref, { featured: false, updatedAt: serverTimestamp() });
      });
      await batch.commit();
    }
  }

  if (input.caption) payload.caption = input.caption;
  if (input.description) payload.description = input.description;
  if (input.ageRange) payload.ageRange = input.ageRange;
  if (input.badgeText && input.badgeText.trim()) payload.badgeText = input.badgeText.trim();

  // CRITICAL: Apenas incluir thumbnailUrl se existir URL válida.
  // NÃO enviar: thumbnailUrl: undefined (simplesmente omitir o campo).
  if (finalThumbnailUrl && finalThumbnailUrl.trim()) {
    payload.thumbnailUrl = finalThumbnailUrl.trim();
  }

  // Sanitização contra campos undefined
  Object.keys(payload).forEach(key => {
    if (payload[key] === undefined) delete payload[key];
  });

  await setDoc(newDocRef, payload);
  return mapDocToVideo(videoId, payload);
}

/** Update existing video with optional thumbnail replacement or removal */
export async function updateVideo(
  id: string,
  updates: Partial<Video>,
  options?: {
    thumbnailFile?: File | null;
    removeThumbnail?: boolean;
  }
): Promise<void> {
  if (!db) throw new Error("Firestore não inicializado");
  const docRef = doc(db, VIDEOS_COLLECTION, id);

  let newThumbnailUrl: string | undefined = updates.thumbnailUrl?.trim();
  if (options?.thumbnailFile) {
    newThumbnailUrl = await uploadThumbnailToVercelBlob(options.thumbnailFile);
  }

  const payload: any = {
    ...updates,
    updatedAt: serverTimestamp(),
  };

  // Tratar remoção ou atualização de thumbnail
  if (options?.removeThumbnail) {
    payload.thumbnailUrl = deleteField();
  } else if (newThumbnailUrl && newThumbnailUrl.trim()) {
    payload.thumbnailUrl = newThumbnailUrl.trim();
  } else {
    // Se não está substituindo nem removendo, não tocar no campo
    delete payload.thumbnailUrl;
  }

  // Tratar atualização ou remoção de selo (badgeText)
  if (updates.badgeText !== undefined) {
    if (updates.badgeText && updates.badgeText.trim()) {
      payload.badgeText = updates.badgeText.trim();
    } else {
      payload.badgeText = deleteField();
    }
  }

  // Regenerar searchText se campos relevantes mudarem
  const categoriesWereUpdated = updates.categories !== undefined || updates.category !== undefined;
  if (categoriesWereUpdated) {
    const normalized = resolveVideoCategories({
      category: updates.category,
      categories: updates.categories,
    });
    payload.categories = normalized.categories;
    payload.category = normalized.category;
  }

  const shouldRebuildSearchText = updates.title !== undefined
    || updates.caption !== undefined
    || updates.description !== undefined
    || updates.tags !== undefined
    || updates.topics !== undefined
    || updates.keywords !== undefined
    || categoriesWereUpdated;

  if (shouldRebuildSearchText) {
    const snapshot = await getDoc(docRef);
    const currentVideoData = snapshot.exists() ? mapDocToVideo(snapshot.id, snapshot.data()) : null;
    const mergedForSearch = {
      title: updates.title ?? currentVideoData?.title ?? "",
      caption: updates.caption ?? currentVideoData?.caption ?? "",
      description: updates.description ?? currentVideoData?.description ?? "",
      tags: updates.tags ?? currentVideoData?.tags ?? [],
      topics: updates.topics ?? currentVideoData?.topics ?? [],
      keywords: updates.keywords ?? currentVideoData?.keywords ?? [],
      category: categoriesWereUpdated ? payload.category : (currentVideoData?.category ?? ""),
      categories: categoriesWereUpdated ? payload.categories : (currentVideoData?.categories ?? []),
    };
    const { categories } = resolveVideoCategories({
      category: mergedForSearch.category,
      categories: mergedForSearch.categories,
    });
    const generatedKeywords = generateKeywords(mergedForSearch.title, categories);
    const keywords = Array.from(new Set([...(mergedForSearch.keywords || []), ...generatedKeywords]));
    payload.keywords = keywords;
    payload.searchText = buildSearchText({
      title: mergedForSearch.title,
      caption: mergedForSearch.caption,
      description: mergedForSearch.description,
      categories,
      tags: mergedForSearch.tags,
      topics: mergedForSearch.topics,
      keywords,
    });
  }

  // Tratar exclusividade de destaque e desativação
  if (updates.featured !== undefined) {
    if (updates.featured === true && updates.active !== false) {
      const q = query(collection(db, VIDEOS_COLLECTION), where("featured", "==", true));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.forEach(d => {
        if (d.id !== id) {
          batch.update(d.ref, { featured: false, updatedAt: serverTimestamp() });
        }
      });
      await batch.commit();
      payload.featured = true;
    } else {
      payload.featured = false;
    }
  } else if (updates.active === false) {
    // Se o vídeo for desativado, remove automaticamente o destaque
    payload.featured = false;
  }

  // Sanitizar quaisquer valores undefined para não quebrar o Firestore
  Object.keys(payload).forEach(key => {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  });

  await updateDoc(docRef, payload);
}

/** Delete video */
export async function deleteVideo(id: string): Promise<void> {
  if (!db) throw new Error("Firestore não inicializado");
  const docRef = doc(db, VIDEOS_COLLECTION, id);
  await deleteDoc(docRef);
}

/** Toggle video active status - se desativado, remove automaticamente o destaque */
export async function toggleVideoActive(id: string, isActive: boolean): Promise<void> {
  if (!db) throw new Error("Firestore não inicializado");
  const docRef = doc(db, VIDEOS_COLLECTION, id);
  const updates: any = { active: isActive, updatedAt: serverTimestamp() };
  if (!isActive) {
    updates.featured = false;
  }
  await updateDoc(docRef, updates);
}

/** Define ou desmarca um vídeo como destaque garantindo exclusividade (máximo 1 em destaque) */
export async function setFeaturedVideo(id: string, isFeatured: boolean): Promise<void> {
  if (!db) throw new Error("Firestore não inicializado");
  const batch = writeBatch(db);

  if (isFeatured) {
    // 1. Localizar todos os vídeos atualmente marcados como destaque
    const q = query(collection(db, VIDEOS_COLLECTION), where("featured", "==", true));
    const snap = await getDocs(q);
    // 2. Remover featured dos anteriores
    snap.forEach((d) => {
      if (d.id !== id) {
        batch.update(d.ref, { featured: false, updatedAt: serverTimestamp() });
      }
    });
    // 3. Definir featured: true no novo vídeo e garantir que esteja ativo
    const targetRef = doc(db, VIDEOS_COLLECTION, id);
    batch.update(targetRef, { featured: true, active: true, updatedAt: serverTimestamp() });
  } else {
    // Desmarcar destaque
    const targetRef = doc(db, VIDEOS_COLLECTION, id);
    batch.update(targetRef, { featured: false, updatedAt: serverTimestamp() });
  }

  await batch.commit();
}

/** Update video display order */
export async function updateVideoOrder(id: string, order: number): Promise<void> {
  if (!db) throw new Error("Firestore não inicializado");
  const docRef = doc(db, VIDEOS_COLLECTION, id);
  await updateDoc(docRef, { order, updatedAt: serverTimestamp() });
}

/** Import videos from parsed CSV data */
export async function importVideosFromCSV(videos: Array<any>): Promise<{
  created: number;
  updated: number;
  errors: number;
  errorDetails: Array<{ rowIndex: number; title: string; error: any }>;
}> {
  if (!db) throw new Error('Firestore não inicializado');
  if (!Array.isArray(videos)) {
    console.error('Dados CSV inválidos');
    return { created: 0, updated: 0, errors: 0, errorDetails: [] };
  }
  let created = 0;
  let updated = 0;
  const errorDetails: Array<{ rowIndex: number; title: string; error: any }> = [];

  for (let i = 0; i < videos.length; i++) {
    const row = videos[i];
    try {
      const title = (row.title ?? row.Title ?? row.Tema ?? '').toString().trim();
      const instagramUrl = (row.instagramUrl ?? row.InstagramUrl ?? row['Link do Reel'] ?? row.link ?? '').toString().trim();
      if (!title || !instagramUrl) continue;
      const instagramId = extractInstagramId(instagramUrl);
      if (!instagramId) continue;

      const legacyCategory = normalizeCategoryValue(
        row.Categoria ?? row.category ?? row.Category ?? row.categories ?? ""
      );
      const categories = legacyCategory ? [legacyCategory] : [];
      const tags = row.tags ? String(row.tags).split(/[;,]/).map((t: string) => t.trim()).filter(Boolean) : [];
      const topics = row.topics ? String(row.topics).split(/[;,]/).map((t: string) => t.trim()).filter(Boolean) : [];
      const keywordsCsv = row.keywords
        ? String(row.keywords).split(/[;,]/).map((k: string) => k.trim()).filter(Boolean)
        : (row['Palavras-chave / Pesquisa'] ? String(row['Palavras-chave / Pesquisa']).split(/[;,]/).map((k: string) => k.trim()).filter(Boolean) : []);
      const generatedKeywords = generateKeywords(title, categories);
      const keywords = Array.from(new Set([...generatedKeywords, ...keywordsCsv]));
      const searchText = buildSearchText({
        title,
        caption: row.caption ?? '',
        description: row.description ?? '',
        categories,
        tags,
        topics,
        keywords,
      });

      // Validação de Thumbnail do CSV
      // Se preenchida, validar minimamente HTTP/HTTPS.
      // NÃO passar pelo Storage.
      const rawThumbnail = (
        row.Thumbnail ?? row.thumbnail ?? row.thumbnailUrl ?? row['Thumbnail Url'] ?? row['Thumbnail URL'] ?? ''
      ).toString().trim();

      let validThumbnailUrl: string | null = null;
      if (rawThumbnail) {
        if (isValidHttpUrl(rawThumbnail)) {
          validThumbnailUrl = rawThumbnail;
        } else {
          console.warn(`[CSV] URL de thumbnail inválida na linha ${i + 1}: "${rawThumbnail}". O vídeo será importado normalmente sem thumbnail.`);
        }
      }

      const videoData: any = {
        title,
        instagramUrl,
        caption: row.caption ?? '',
        description: row.description ?? '',
        category: categories[0] || '',
        categories,
        tags,
        topics,
        keywords,
        searchText,
        active: row.active !== undefined ? Boolean(row.active) : true,
        instagramId,
        order: row['Nº'] ? Number(row['Nº']) : (row.order ? Number(row.order) : undefined),
      };

      // CRITICAL: Apenas incluir thumbnailUrl se for válida.
      // Se não existir, NÃO enviar thumbnailUrl: undefined.
      if (validThumbnailUrl) {
        videoData.thumbnailUrl = validThumbnailUrl;
      }

      // Remover undefined
      Object.keys(videoData).forEach(k => {
        if (videoData[k] === undefined) delete videoData[k];
      });

      // Deduplicate por instagramId
      const q = query(collection(db, VIDEOS_COLLECTION), where('instagramId', '==', instagramId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docRef = doc(db, VIDEOS_COLLECTION, snap.docs[0].id);
        await updateDoc(docRef, { ...videoData, updatedAt: serverTimestamp() });
        updated++;
      } else {
        const newRef = doc(collection(db, VIDEOS_COLLECTION));
        await setDoc(newRef, { ...videoData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        created++;
      }
    } catch (e) {
      console.error('Error importing CSV row', row, e);
      errorDetails.push({
        rowIndex: i + 1,
        title: (row.title ?? row.Title ?? row.Tema ?? '').toString(),
        error: e,
      });
    }
  }
  return { created, updated, errors: errorDetails.length, errorDetails };
}
