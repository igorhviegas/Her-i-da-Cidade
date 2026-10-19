import { useState } from 'react';
import type { ContentScript, ScriptProductionStatus, ScriptPublicationStatus } from '../../../types';
import { dateInput } from './scriptEditorHelpers';

/** Valores iniciais de um roteiro novo criado a partir de outro registro (ex.: pergunta da Caixinha). */
export type ScriptDraft = { title: string; category: string; content: string; notes: string };

/** Título, categoria, roteiro pai, conteúdo e anotações do roteiro. */
export const useScriptTexts = (script: ContentScript | null, initialParentScriptId: string | undefined, initialDraft?: ScriptDraft) => {
  const [title, setTitle] = useState(script?.title || initialDraft?.title || '');
  const [category, setCategory] = useState(script?.category || initialDraft?.category || '');
  const [parentScriptId, setParentScriptId] = useState(script?.parentScriptId || initialParentScriptId || '');
  const [content, setContent] = useState(script?.content || initialDraft?.content || '');
  const [notes, setNotes] = useState(script?.notes || initialDraft?.notes || '');
  return { title, setTitle, category, setCategory, parentScriptId, setParentScriptId, content, setContent, notes, setNotes };
};

/** Status de produção e publicação, datas de publicação (real e prevista) e pedido vinculado. */
export const useScriptStatuses = (script: ContentScript | null) => {
  const [productionStatus, setProductionStatus] = useState<ScriptProductionStatus>(script?.productionStatus || 'draft');
  const [publicationStatus, setPublicationStatus] = useState<ScriptPublicationStatus>(script?.publicationStatus || 'unpublished');
  const [publishedDate, setPublishedDate] = useState(dateInput(script?.publishedAt));
  const [plannedDate, setPlannedDate] = useState(dateInput(script?.plannedPublishAt));
  const [linkedOrderId, setLinkedOrderId] = useState(script?.orderId || '');
  return { productionStatus, setProductionStatus, publicationStatus, setPublicationStatus, publishedDate, setPublishedDate, plannedDate, setPlannedDate, linkedOrderId, setLinkedOrderId };
};
