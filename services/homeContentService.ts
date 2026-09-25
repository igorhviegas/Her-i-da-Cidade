import {
  Timestamp,
  collection,
  doc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import type { HomeContent, HomeSection, HomeSectionInput, HomeSectionType } from '../types/homeContent';

export const HOME_CONTENT_COLLECTION = 'siteContent';
export const HOME_CONTENT_DOCUMENT = 'home';
export const HOME_SECTIONS_SUBCOLLECTION = 'sections';
export const HOME_SEO_TITLE = 'Homem-Aranha Personagem Vivo em BH | Herói da Cidade';
export const HOME_SEO_DESCRIPTION = 'Contrate o Homem-Aranha para festas infantis, aniversários e eventos em Belo Horizonte, Betim, Contagem, Nova Lima e região.';

export const DEFAULT_HOME_SECTIONS: HomeSection[] = [
  {
    id: 'home-hero', internalName: 'Hero', sectionType: 'hero',
    title: 'O Herói\nDa Cidade', subtitle: '', description: 'Criando memórias\nQue nunca serão esquecidas', active: true, order: 0,
  },
  {
    id: 'home-services', internalName: 'Serviços', sectionType: 'services',
    title: 'Escolha Sua\nPróxima Missão', subtitle: 'Nossos serviços',
    description: 'Cada vídeo é feito com qualidade e o carinho de uma equipe que ama o que faz, para que a magia seja transformada em boas memórias.', active: true, order: 1,
  },
  {
    id: 'home-video-teaser', internalName: 'Vídeos', sectionType: 'video-teaser',
    title: 'Encontre o vídeo certo para cada momento.', subtitle: 'Plataforma de vídeos',
    description: 'O Herói da Cidade disponibiliza uma plataforma exclusiva onde pais e educadores encontram vídeos por temas específicos para orientar, divertir e inspirar as crianças.',
    buttonText: 'Acessar catálogo completo', active: true, order: 2,
  },
  {
    id: 'home-about', internalName: 'Sobre nós', sectionType: 'about',
    title: 'Criando Memórias\nQue Nunca Serão Esquecidas', subtitle: 'Sobre nós',
    description: 'O Herói da Cidade nasceu do sonho de um menino apaixonado pelo "Amigão da Vizinhança", de se tornar um super heroi desde pequeno. Como a principal função de um herói é ajudar as pesssoas, Igor Viegas (nosso Homem-Aranha) descobriu uma maneira divertida de fazer isso. Com os vídeos educativos, conquistou milhares de seguidores e ajudou diversas famílias com as tarefas mais difíceis do desenvolvimento infanti. Somos especializados em entretenimento lúdico e educacional de alta qualidade exclusivamente com o Homem-Aranha.\n\nFora das telinhas, o heroi da Cidade atua em festas infantis com o personagem Homem-Aranha em toda região metropolitana de Belo Horizonte em minas Gerais, incluindo Betim, Contagem, Nova Lima, Lagoa Santa, Igarapé, Ribeirão das neves e muito mais. Fazemos com que até os mais velhos se questionem se o Homem-Aranha realmente existe; Incorporamos os valores, a voz e a presença do herói mais querido. Nosso compromisso é com a emoção genuína e a criação de memórias que duram a vida toda.',
    imageUrl: 'https://disciplinary-peach-obfj8i7gqu.edgeone.app/profissional%201.jpeg', buttonText: 'Fale com nossa equipe', active: true, order: 3,
  },
  {
    id: 'home-booking', internalName: 'Agendamento', sectionType: 'booking',
    title: 'Agende Sua\nChamada de Vídeo', subtitle: 'Base de Operações Online',
    description: 'Escolha um horário abaixo para uma experiência imersiva com o Herói da Cidade.\nNossa base secreta está pronta para a conexão!', active: true, order: 4,
  },
  {
    id: 'home-testimonials', internalName: 'Depoimentos', sectionType: 'testimonials',
    title: 'Depoimentos', subtitle: '', description: '', active: true, order: 5,
  },
];

export function sortHomeSections(sections: HomeSection[]): HomeSection[] {
  return [...sections].sort((a, b) => a.order - b.order || a.internalName.localeCompare(b.internalName, 'pt-BR'));
}

function asMillis(value: HomeSection['startAt']): number | null {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') return value.toMillis();
  return null;
}

export function isHomeSectionPublished(section: HomeSection, now = Date.now()): boolean {
  if (!section.active) return false;
  const start = asMillis(section.startAt);
  const end = asMillis(section.endAt);
  return (start === null || now >= start) && (end === null || now <= end);
}

export function mapFirestoreHomeSection(id: string, data: Record<string, unknown>): HomeSection {
  const allowedTypes: HomeSectionType[] = ['hero', 'services', 'video-teaser', 'about', 'booking', 'testimonials', 'text', 'promotional', 'cta', 'image-text'];
  const type = allowedTypes.includes(data.sectionType as HomeSectionType) ? data.sectionType as HomeSectionType : 'text';
  return {
    id,
    internalName: typeof data.internalName === 'string' ? data.internalName : id,
    sectionType: type,
    title: typeof data.title === 'string' ? data.title : '',
    subtitle: typeof data.subtitle === 'string' ? data.subtitle : '',
    description: typeof data.description === 'string' ? data.description : '',
    ...(typeof data.imageUrl === 'string' ? { imageUrl: data.imageUrl } : {}),
    ...(typeof data.buttonText === 'string' ? { buttonText: data.buttonText } : {}),
    ...(typeof data.buttonUrl === 'string' ? { buttonUrl: data.buttonUrl } : {}),
    active: data.active !== false,
    order: typeof data.order === 'number' ? data.order : 0,
    startAt: data.startAt instanceof Timestamp ? data.startAt : null,
    endAt: data.endAt instanceof Timestamp ? data.endAt : null,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt : undefined,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : undefined,
  };
}

function homeDocumentRef() {
  if (!db) throw new Error('Firebase Firestore não inicializado.');
  return doc(db, HOME_CONTENT_COLLECTION, HOME_CONTENT_DOCUMENT);
}

function homeSectionsCollection() {
  if (!db) throw new Error('Firebase Firestore não inicializado.');
  return collection(db, HOME_CONTENT_COLLECTION, HOME_CONTENT_DOCUMENT, HOME_SECTIONS_SUBCOLLECTION);
}

export function subscribeToHomeContent(onUpdate: (content: HomeContent) => void, onError?: (error: Error) => void): Unsubscribe {
  if (!db) {
    onUpdate({ seoTitle: HOME_SEO_TITLE, seoDescription: HOME_SEO_DESCRIPTION, sections: DEFAULT_HOME_SECTIONS });
    return () => {};
  }

  let seoTitle = HOME_SEO_TITLE;
  let seoDescription = HOME_SEO_DESCRIPTION;
  let parentLoaded = false;
  let sectionsLoaded = false;
  let firestoreSections: HomeSection[] = [];
  let contentInitialized = false;

  const publish = () => {
    if (!parentLoaded || !sectionsLoaded) return;
    onUpdate({
      seoTitle,
      seoDescription,
      sections: contentInitialized ? sortHomeSections(firestoreSections) : DEFAULT_HOME_SECTIONS,
    });
  };

  const unsubscribeHome = onSnapshot(homeDocumentRef(), (snapshot) => {
    const data = snapshot.data();
    seoTitle = typeof data?.seoTitle === 'string' && data.seoTitle.trim() ? data.seoTitle : HOME_SEO_TITLE;
    seoDescription = typeof data?.seoDescription === 'string' && data.seoDescription.trim() ? data.seoDescription : HOME_SEO_DESCRIPTION;
    contentInitialized = data?.contentInitialized === true;
    parentLoaded = true;
    publish();
  }, (error) => onError?.(error));

  const unsubscribeSections = onSnapshot(homeSectionsCollection(), (snapshot) => {
    firestoreSections = snapshot.docs.map((item) => mapFirestoreHomeSection(item.id, item.data()));
    sectionsLoaded = true;
    publish();
  }, (error) => onError?.(error));

  return () => {
    unsubscribeHome();
    unsubscribeSections();
  };
}

export async function ensureHomeContentDefaults(): Promise<void> {
  if (!db) throw new Error('Firebase Firestore não inicializado.');
  const homeRef = homeDocumentRef();

  let shouldCreateDefaults = false;
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(homeRef);
    const data = snapshot.data() || {};
    shouldCreateDefaults = !snapshot.exists() || data.contentInitialized !== true;
    if (shouldCreateDefaults || typeof data.seoTitle !== 'string' || typeof data.seoDescription !== 'string') {
      transaction.set(homeRef, {
        ...(typeof data.seoTitle === 'string' ? {} : { seoTitle: HOME_SEO_TITLE }),
        ...(typeof data.seoDescription === 'string' ? {} : { seoDescription: HOME_SEO_DESCRIPTION }),
        ...(snapshot.exists() ? {} : { createdAt: serverTimestamp() }),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
  });
  if (!shouldCreateDefaults) return;

  const existing = await getDocs(homeSectionsCollection());
  const existingIds = new Set(existing.docs.map((item) => item.id));
  const missing = DEFAULT_HOME_SECTIONS.filter((section) => !existingIds.has(section.id));
  if (missing.length === 0) return;

  const batch = writeBatch(db);
  missing.forEach((section) => {
    const { id, ...data } = section;
    batch.set(doc(homeSectionsCollection(), id), {
      ...data,
      startAt: null,
      endAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
  await setDoc(homeRef, { contentInitialized: true, updatedAt: serverTimestamp() }, { merge: true });
}

function sectionWritePayload(input: HomeSectionInput) {
  if (!input.internalName.trim()) throw new Error('Informe o nome interno da seção.');
  if (!input.title.trim()) throw new Error('Informe o título da seção.');
  if (input.internalName.length > 100) throw new Error('O nome interno deve ter até 100 caracteres.');
  if (input.title.length > 180) throw new Error('O título deve ter até 180 caracteres.');
  if (input.description.length > 12000) throw new Error('O texto deve ter até 12.000 caracteres.');
  const startMillis = asMillis(input.startAt);
  const endMillis = asMillis(input.endAt);
  if (startMillis !== null && endMillis !== null && endMillis <= startMillis) {
    throw new Error('O fim da publicação deve ser posterior ao início.');
  }
  if (input.imageUrl && !/^https:\/\//i.test(input.imageUrl)) throw new Error('A imagem deve usar uma URL HTTPS.');
  if (input.buttonUrl && !isSafeContentUrl(input.buttonUrl)) throw new Error('O link do botão deve ser HTTPS ou uma rota interna iniciada por /.');
  const { startAt, endAt, ...fields } = input;
  return {
    ...fields,
    startAt: startAt ? Timestamp.fromDate(startAt instanceof Date ? startAt : new Date(startAt.toMillis())) : null,
    endAt: endAt ? Timestamp.fromDate(endAt instanceof Date ? endAt : new Date(endAt.toMillis())) : null,
    updatedAt: serverTimestamp(),
  };
}

export function isSafeContentUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
  try {
    return new URL(trimmed).protocol === 'https:';
  } catch {
    return false;
  }
}

export async function createHomeSection(input: HomeSectionInput): Promise<string> {
  const ref = doc(homeSectionsCollection());
  await setDoc(ref, { ...sectionWritePayload(input), createdAt: serverTimestamp() });
  await setDoc(homeDocumentRef(), { contentInitialized: true, updatedAt: serverTimestamp() }, { merge: true });
  return ref.id;
}

export async function updateHomeSection(id: string, input: HomeSectionInput): Promise<void> {
  if (!id) throw new Error('ID da seção não informado.');
  await updateDoc(doc(homeSectionsCollection(), id), sectionWritePayload(input));
}

export async function deleteHomeSection(id: string): Promise<void> {
  if (!id) throw new Error('ID da seção não informado.');
  await deleteDoc(doc(homeSectionsCollection(), id));
}

export async function setHomeSectionActive(id: string, active: boolean): Promise<void> {
  await updateDoc(doc(homeSectionsCollection(), id), { active, updatedAt: serverTimestamp() });
}

export async function updateHomeSectionOrder(sectionIds: string[]): Promise<void> {
  if (!db) throw new Error('Firebase Firestore não inicializado.');
  const batch = writeBatch(db);
  sectionIds.forEach((id, order) => {
    batch.update(doc(homeSectionsCollection(), id), { order, updatedAt: serverTimestamp() });
  });
  await batch.commit();
}

export async function updateHomeSeo(seoTitle: string, seoDescription: string): Promise<void> {
  const title = seoTitle.trim();
  const description = seoDescription.trim();
  if (!title) throw new Error('O SEO Title não pode ficar vazio.');
  if (title.length > 70) throw new Error('O SEO Title deve ter até 70 caracteres.');
  if (!description) throw new Error('A Meta Description não pode ficar vazia.');
  if (description.length > 200) throw new Error('A Meta Description deve ter até 200 caracteres.');
  await setDoc(homeDocumentRef(), { seoTitle: title, seoDescription: description, updatedAt: serverTimestamp() }, { merge: true });
}

export function useHomeContent(enabled = true) {
  const [content, setContent] = useState<HomeContent>({
    seoTitle: HOME_SEO_TITLE,
    seoDescription: HOME_SEO_DESCRIPTION,
    sections: DEFAULT_HOME_SECTIONS,
  });
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    return subscribeToHomeContent((next) => {
      setContent(next);
      setLoading(false);
      setError(null);
    }, (reason) => {
      console.warn('[siteContentService] Falha ao carregar conteúdo da home. Exibindo valores padrão.', reason);
      setError(reason.message);
      setContent({ seoTitle: HOME_SEO_TITLE, seoDescription: HOME_SEO_DESCRIPTION, sections: DEFAULT_HOME_SECTIONS });
      setLoading(false);
    });
  }, [enabled]);

  return { ...content, loading, error };
}
