import type { HomeSectionInput, HomeSectionType } from '../../../types/homeContent';
import { DEFAULT_HOME_SECTIONS } from '../../../services/homeContentService';

export type SectionDraft = Omit<HomeSectionInput, 'startAt' | 'endAt'> & { startAt: Date | null; endAt: Date | null };
const SYSTEM_SECTION_IDS = new Set(DEFAULT_HOME_SECTIONS.map((section) => section.id));

function isCustomType(type: HomeSectionType): boolean {
  return ['text', 'promotional', 'cta', 'image-text'].includes(type);
}

/** Quais campos o editor mostra para o rascunho atual. */
export function editorFlags(draft: SectionDraft | null, editingId: string | null) {
  const sectionType = draft?.sectionType || 'text';
  const typeEditable = !editingId || !SYSTEM_SECTION_IDS.has(editingId);
  const canEditImage = sectionType === 'image-text' || sectionType === 'promotional' || editingId === 'home-about';
  const canEditButton = isCustomType(sectionType) || editingId === 'home-video-teaser' || editingId === 'home-about';
  const canEditButtonUrl = isCustomType(sectionType);
  return { typeEditable, canEditImage, canEditButton, canEditButtonUrl };
}
