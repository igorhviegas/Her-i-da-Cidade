import { collection, doc, getDocs, serverTimestamp, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { buildSearchText, generateKeywords } from '../utils/videoHelpers';
import { VIDEOS_COLLECTION } from './videosService';

export const CATEGORIES_COLLECTION = 'categories';

export interface Category {
  id: string;
  name: string;
  normalizedName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

function validateName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (!trimmed) throw new Error('Informe o nome da categoria.');
  return trimmed;
}

export async function getCategories(): Promise<Category[]> {
  if (!db) return [];
  const snapshot = await getDocs(collection(db, CATEGORIES_COLLECTION));
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() } as Category))
    .filter((item) => Boolean(item.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
}

export async function createCategory(name: string): Promise<Category> {
  if (!db) throw new Error('Firestore não inicializado');
  const cleanName = validateName(name);
  const normalizedName = normalizeCategoryName(cleanName);
  const categories = await getCategories();
  if (categories.some((category) => category.normalizedName === normalizedName)) {
    throw new Error('Já existe uma categoria com este nome.');
  }

  const reference = doc(collection(db, CATEGORIES_COLLECTION));
  await setDoc(reference, {
    name: cleanName,
    normalizedName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: reference.id, name: cleanName, normalizedName };
}

async function commitInBatches(updates: Array<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }>) {
  if (!db) return;
  for (let start = 0; start < updates.length; start += 450) {
    const batch = writeBatch(db);
    updates.slice(start, start + 450).forEach(({ ref, data }) => batch.update(ref, data));
    await batch.commit();
  }
}

function categoriesForVideo(data: Record<string, any>): string[] {
  if (Array.isArray(data.categories)) return data.categories.map(String).map((name) => name.trim()).filter(Boolean);
  return typeof data.category === 'string' && data.category.trim() ? [data.category.trim()] : [];
}

function videoCategoryUpdate(data: Record<string, any>, categories: string[]) {
  const keywords = Array.from(new Set([...(data.keywords || []), ...generateKeywords(data.title || '', categories)]));
  return {
    categories,
    category: categories[0] || '',
    keywords,
    searchText: buildSearchText({
      title: data.title || '', caption: data.caption || '', description: data.description || '',
      categories, tags: data.tags || [], topics: data.topics || [], keywords,
    }),
    updatedAt: serverTimestamp(),
  };
}

/** Registra no catálogo central os nomes que já existem em vídeos legados. */
export async function syncCategoriesFromVideos(): Promise<number> {
  if (!db) return 0;
  const [categories, videos] = await Promise.all([getCategories(), getDocs(collection(db, VIDEOS_COLLECTION))]);
  const known = new Set(categories.map((item) => item.normalizedName));
  const missing = new Map<string, string>();
  videos.forEach((video) => categoriesForVideo(video.data()).forEach((name) => {
    const normalized = normalizeCategoryName(name);
    if (!known.has(normalized)) missing.set(normalized, name.trim());
  }));
  if (!missing.size) return 0;

  for (const [normalizedName, name] of missing) {
    const reference = doc(collection(db, CATEGORIES_COLLECTION));
    await setDoc(reference, { name, normalizedName, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
  return missing.size;
}

/** Renomeia a categoria e propaga o novo rótulo para todos os vídeos associados. */
export async function updateCategory(category: Category, name: string): Promise<void> {
  if (!db) throw new Error('Firestore não inicializado');
  const cleanName = validateName(name);
  const normalizedName = normalizeCategoryName(cleanName);
  const allCategories = await getCategories();
  if (allCategories.some((item) => item.id !== category.id && item.normalizedName === normalizedName)) {
    throw new Error('Já existe uma categoria com este nome.');
  }

  const videos = await getDocs(collection(db, VIDEOS_COLLECTION));
  const oldNormalizedName = category.normalizedName || normalizeCategoryName(category.name);
  const updates = videos.docs.flatMap((video) => {
    const current = categoriesForVideo(video.data());
    if (!current.some((item) => normalizeCategoryName(item) === oldNormalizedName)) return [];
    const next = current.map((item) => normalizeCategoryName(item) === oldNormalizedName ? cleanName : item);
    return [{ ref: video.ref, data: videoCategoryUpdate(video.data(), Array.from(new Set(next)) ) }];
  });

  await commitInBatches(updates);
  await updateDoc(doc(db, CATEGORIES_COLLECTION, category.id), { name: cleanName, normalizedName, updatedAt: serverTimestamp() });
}

/** Remove a categoria dos vídeos associados antes de excluir seu cadastro. */
export async function deleteCategory(category: Category): Promise<number> {
  if (!db) throw new Error('Firestore não inicializado');
  const videos = await getDocs(collection(db, VIDEOS_COLLECTION));
  const normalizedName = category.normalizedName || normalizeCategoryName(category.name);
  const updates = videos.docs.flatMap((video) => {
    const current = categoriesForVideo(video.data());
    const next = current.filter((item) => normalizeCategoryName(item) !== normalizedName);
    if (next.length === current.length) return [];
    return [{ ref: video.ref, data: videoCategoryUpdate(video.data(), next) }];
  });
  await commitInBatches(updates);
  await deleteDoc(doc(db, CATEGORIES_COLLECTION, category.id));
  return updates.length;
}

export async function countCategoryVideos(category: Category): Promise<number> {
  if (!db) return 0;
  const normalizedName = category.normalizedName || normalizeCategoryName(category.name);
  const videos = await getDocs(collection(db, VIDEOS_COLLECTION));
  return videos.docs.filter((video) => categoriesForVideo(video.data()).some((item) => normalizeCategoryName(item) === normalizedName)).length;
}
