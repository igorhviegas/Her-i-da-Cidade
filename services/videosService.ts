import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, Unsubscribe, serverTimestamp, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Video, FirestoreVideo } from "../types";
import { extractInstagramId } from "../utils/videoHelpers";
import { generateKeywords, buildSearchText } from "../utils/videoHelpers";
import { extractInstagramId } from "../utils/videoHelpers";

export const VIDEOS_COLLECTION = "videos";

/** Convert Firestore document to UI Video */
export function mapDocToVideo(docId: string, data: any): Video {
  return {
    id: docId,
    title: data.title || "",
    instagramUrl: data.instagramUrl || "",
    caption: data.caption || "",
    description: data.description || "",
    thumbnail: data.thumbnail || "",
    categories: data.categories || [],
    tags: data.tags || [],
    topics: data.topics || [],
    ageRange: data.ageRange,
    keywords: data.keywords || [],
    publishedAt: data.publishedAt,
    active: data.active !== false,
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
    const orderA = (a as any).order ?? 0;
    const orderB = (b as any).order ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return dateB - dateA;
  });
  console.log('[VIDEOS] getVideos returned', videos.length, 'items');
  return videos;
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

/** Create new video */
export async function createVideo(input: Omit<FirestoreVideo, "id" | "createdAt" | "updatedAt">): Promise<Video> {
  if (!db) throw new Error("Firestore not initialized");
  const newDocRef = doc(collection(db, VIDEOS_COLLECTION));
  const payload = {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } as any;
  await setDoc(newDocRef, payload);
  return mapDocToVideo(newDocRef.id, payload);
}

/** Update existing video */
export async function updateVideo(id: string, updates: Partial<Omit<FirestoreVideo, "id" | "createdAt" | "updatedAt">>) {
  if (!db) throw new Error("Firestore not initialized");
  const docRef = doc(db, VIDEOS_COLLECTION, id);
  const payload = { ...updates, updatedAt: serverTimestamp() } as any;
  await updateDoc(docRef, payload);
}

/** Delete video */
export async function deleteVideo(id: string): Promise<void> {
  if (!db) throw new Error("Firestore not initialized");
  const docRef = doc(db, VIDEOS_COLLECTION, id);
  await deleteDoc(docRef);
}

/** Toggle video active status */
export async function toggleVideoActive(id: string, isActive: boolean): Promise<void> {
  if (!db) throw new Error("Firestore not initialized");
  const docRef = doc(db, VIDEOS_COLLECTION, id);
  await updateDoc(docRef, { active: isActive, updatedAt: serverTimestamp() });
}

/** Update video display order */
export async function updateVideoOrder(id: string, order: number): Promise<void> {
  if (!db) throw new Error("Firestore not initialized");
  const docRef = doc(db, VIDEOS_COLLECTION, id);
  await updateDoc(docRef, { order, updatedAt: serverTimestamp() });
}


export async function importVideosFromCSV(videos: Array<any>): Promise<{ created: number; updated: number; errors: number; errorDetails: Array<{ rowIndex: number; title: string; error: any }> }> {
  if (!db) throw new Error('Firestore not initialized');
  if (!Array.isArray(videos)) {
    console.error('Invalid CSV data');
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
      const categories = row.categories ? String(row.categories).split(/[;,]/).map((c: string) => c.trim()).filter(Boolean) : (row.Categoria ? String(row.Categoria).split(/[;,]/).map((c: string) => c.trim()).filter(Boolean) : []);
      const tags = row.tags ? String(row.tags).split(/[;,]/).map((t: string) => t.trim()).filter(Boolean) : [];
      const topics = row.topics ? String(row.topics).split(/[;,]/).map((t: string) => t.trim()).filter(Boolean) : [];
      const keywordsCsv = row.keywords ? String(row.keywords).split(/[;,]/).map((k: string) => k.trim()).filter(Boolean) : (row['Palavras-chave / Pesquisa'] ? String(row['Palavras-chave / Pesquisa']).split(/[;,]/).map((k: string) => k.trim()).filter(Boolean) : []);
      const generatedKeywords = generateKeywords(title, categories);
      const keywords = Array.from(new Set([...generatedKeywords, ...keywordsCsv]));
      const searchText = buildSearchText({ title, caption: row.caption ?? '', description: row.description ?? '', categories, tags, topics, keywords });
      const videoData: Partial<FirestoreVideo> = {
        title,
        instagramUrl,
        caption: row.caption ?? '',
        description: row.description ?? '',
        thumbnail: row.thumbnail ?? '',
        thumbnailUrl: row.thumbnailUrl ?? undefined,
        categories,
        tags,
        topics,
        ageRange: row.ageRange ?? undefined,
        keywords,
        searchText,
        active: row.active !== undefined ? Boolean(row.active) : true,
        instagramId,
        order: row['Nº'] ? Number(row['Nº']) : undefined,
      };
      // Deduplicate by instagramId
      const q = query(collection(db, VIDEOS_COLLECTION), where('instagramId', '==', instagramId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docRef = doc(db, VIDEOS_COLLECTION, snap.docs[0].id);
        await updateDoc(docRef, { ...videoData, updatedAt: serverTimestamp() });
        updated++;
      } else {
        const newRef = doc(collection(db, VIDEOS_COLLECTION));
        await setDoc(newRef, { ...videoData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() } as any);
        created++;
      }
    } catch (e) {
      console.error('Error importing CSV row', row, e);
      errorDetails.push({ rowIndex: i + 1, title: (row.title ?? row.Title ?? row.Tema ?? '').toString(), error: e });
    }
  }
  return { created, updated, errors: errorDetails.length, errorDetails };
}
