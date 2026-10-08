import { useState } from 'react';
import type { ContentScript, ScriptProductionStatus, ScriptPublicationStatus } from '../../../types';
import { dateInput } from './scriptEditorHelpers';

/** Título, categoria, roteiro pai, conteúdo e anotações do roteiro. */
export const useScriptTexts = (script: ContentScript | null, initialParentScriptId: string | undefined) => {
  const [title, setTitle] = useState(script?.title || '');
  const [category, setCategory] = useState(script?.category || '');
  const [parentScriptId, setParentScriptId] = useState(script?.parentScriptId || initialParentScriptId || '');
  const [content, setContent] = useState(script?.content || '');
  const [notes, setNotes] = useState(script?.notes || '');
  return { title, setTitle, category, setCategory, parentScriptId, setParentScriptId, content, setContent, notes, setNotes };
};

/** Status de produção e publicação, data de publicação e pedido vinculado. */
export const useScriptStatuses = (script: ContentScript | null) => {
  const [productionStatus, setProductionStatus] = useState<ScriptProductionStatus>(script?.productionStatus || 'draft');
  const [publicationStatus, setPublicationStatus] = useState<ScriptPublicationStatus>(script?.publicationStatus || 'unpublished');
  const [publishedDate, setPublishedDate] = useState(dateInput(script?.publishedAt));
  const [linkedOrderId, setLinkedOrderId] = useState(script?.orderId || '');
  return { productionStatus, setProductionStatus, publicationStatus, setPublicationStatus, publishedDate, setPublishedDate, linkedOrderId, setLinkedOrderId };
};
