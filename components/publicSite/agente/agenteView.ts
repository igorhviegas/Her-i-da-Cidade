import { useState } from 'react';
import type { AgentFaqCategory, AgentStep } from '../../../services/agentService';

/** Histórico de telas: a seta de voltar retorna à tela de onde o agente veio (ex.: Início → Chegada → Início). */
export function useViewTrail() {
  const [view, rawSetView] = useState('home'); // home | steps | music | travel | support | support:info | support:<categoria> | step:<id>
  const [trail, setTrail] = useState<string[]>([]);
  const setView = (next: string) => { setTrail((t) => [...t, view]); rawSetView(next); };
  const goBack = () => { rawSetView(trail[trail.length - 1] ?? 'home'); setTrail((t) => t.slice(0, -1)); };
  const goHome = () => { setTrail([]); rawSetView('home'); };
  return { view, rawSetView, setView, goBack, goHome };
}

export interface StepProgress {
  stepDone: (step: AgentStep) => number;
  stepTotal: (step: AgentStep) => number;
  nextStep: AgentStep | undefined;
  done: number;
  total: number;
}

/** Itens concluídos por etapa, próxima etapa pendente e totais gerais. */
export function stepProgress(steps: AgentStep[], checks: Record<string, boolean>): StepProgress {
  const stepDone = (step: AgentStep) => step.items.filter((i) => !i.heading && checks[`${step.id}:${i.id}`]).length;
  const stepTotal = (step: AgentStep) => step.items.filter((i) => !i.heading).length;
  const nextStep = steps.find((s) => stepDone(s) < stepTotal(s));
  const done = steps.reduce((n, s) => n + stepDone(s), 0);
  const total = steps.reduce((n, s) => n + stepTotal(s), 0);
  return { stepDone, stepTotal, nextStep, done, total };
}

function viewTitle(view: string, faqCategory: AgentFaqCategory | undefined, activeStep: AgentStep | undefined): string {
  return view === 'home' ? 'Agente HDC' : view === 'steps' ? 'Passo a passo' : view === 'music' ? 'Músicas' : view === 'travel' ? 'Deslocamento' : view === 'support' ? 'Suporte' : view === 'support:info' ? 'Informações importantes' : faqCategory?.title ?? activeStep?.kicker ?? 'Etapa';
}

export interface ViewInfo {
  activeStep: AgentStep | undefined;
  stepIndex: number;
  faqCategory: AgentFaqCategory | undefined;
  title: string;
}

/** Etapa/categoria de FAQ ativa e título da tela atual. */
export function resolveView(view: string, steps: AgentStep[], faq: AgentFaqCategory[]): ViewInfo {
  const activeStep = view.startsWith('step:') ? steps.find((s) => s.id === view.slice(5)) : undefined;
  const stepIndex = activeStep ? steps.indexOf(activeStep) : -1;
  const faqCategory = view.startsWith('support:') && view !== 'support:info' ? faq.find((c) => c.id === view.slice(8)) : undefined;
  return { activeStep, stepIndex, faqCategory, title: viewTitle(view, faqCategory, activeStep) };
}
