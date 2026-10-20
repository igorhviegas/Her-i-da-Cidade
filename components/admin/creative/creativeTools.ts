import type React from 'react';
import { BookOpen, Lightbulb, MessageCircleQuestionMark, Newspaper, type LucideIcon } from 'lucide-react';
import { AdminScriptsPage } from '../AdminScriptsPage';
import { AdminClarimPage } from '../clarim/AdminClarimPage';
import { AdminQuestionsPage } from './AdminQuestionsPage';
import type { AdminTab } from '../videoAdmin/dashboardTypes';

/**
 * Ferramentas do Espaço Criativo: menu lateral, rotas, cards da visão geral e a página renderizada saem daqui.
 * Nova ferramenta = uma entrada nesta lista + o id dela em AdminTab (videoAdmin/dashboardTypes.ts).
 */
export interface CreativeTool {
  id: AdminTab;
  path: string;
  /** Endereços antigos que redirecionam para `path` (links salvos continuam funcionando). */
  legacyPaths?: string[];
  label: string;
  description: string;
  icon: LucideIcon;
  Page: React.FC;
}

export const CREATIVE_HOME = { id: 'creative' as const, path: '/admin/espaco-criativo', label: 'Espaço Criativo', icon: Lightbulb };

export const CREATIVE_TOOLS: CreativeTool[] = [
  {
    id: 'scripts',
    path: '/admin/espaco-criativo/roteiros',
    legacyPaths: ['/admin/roteiros'],
    label: 'Roteiros',
    description: 'Biblioteca permanente de roteiros: Kanban de produção, publicação e envio para gravação.',
    icon: BookOpen,
    Page: AdminScriptsPage,
  },
  {
    id: 'questions',
    path: '/admin/espaco-criativo/caixinha-de-perguntas',
    label: 'Caixinha de Perguntas',
    description: 'Banco de perguntas para a caixinha dos Stories, do rascunho ao roteiro de resposta.',
    icon: MessageCircleQuestionMark,
    Page: AdminQuestionsPage,
  },
  {
    id: 'clarim',
    path: '/admin/espaco-criativo/clarim-semanal',
    label: 'Clarim Semanal',
    description: 'O jornal da semana nos Stories: páginas a partir de templates, aprovadas e baixadas uma a uma.',
    icon: Newspaper,
    Page: AdminClarimPage,
  },
];

/** Aba do Espaço Criativo para um endereço; `redirect` quando o endereço é antigo. null = fora do módulo. */
export function creativeRoute(path: string): { tab: AdminTab; redirect?: string } | null {
  if (path === CREATIVE_HOME.path) return { tab: CREATIVE_HOME.id };
  for (const tool of CREATIVE_TOOLS) {
    if (path === tool.path) return { tab: tool.id };
    if (tool.legacyPaths?.includes(path)) return { tab: tool.id, redirect: tool.path };
  }
  return null;
}

export const creativePathOf = (tab: AdminTab): string | null =>
  tab === CREATIVE_HOME.id ? CREATIVE_HOME.path : CREATIVE_TOOLS.find((tool) => tool.id === tab)?.path ?? null;
