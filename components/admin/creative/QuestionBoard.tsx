import React, { useState } from 'react';
import { DndContext, MouseSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ArrowUpRight, Link2, Trash2 } from 'lucide-react';
import { QUESTION_STATUSES } from '../../../services/creativeQuestions.js';
import type { CreativeQuestion, QuestionStatus } from '../../../services/creativeQuestions.js';
import type { ContentScript } from '../../../types';
import { formatDate } from '../ordersFlow/scriptsHelpers';

export const statusStyles: Record<QuestionStatus, string> = {
  draft: 'border-slate-400/20 bg-slate-400/10 text-slate-200',
  ready: 'border-blue-400/20 bg-blue-400/10 text-blue-200',
  answered: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  scripted: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
};
const PAGE = 40;

interface CardActions {
  scriptsById: Map<string, ContentScript>;
  scriptsLoaded: boolean;
  busyId: string | null;
  onOpen: (question: CreativeQuestion) => void;
  onMove: (question: CreativeQuestion, status: QuestionStatus) => void;
  onDelete: (question: CreativeQuestion) => void;
  onOpenScript: (scriptId: string) => void;
}

const ScriptLink: React.FC<{ question: CreativeQuestion } & CardActions> = ({ question, scriptsById, scriptsLoaded, onOpen, onOpenScript }) => {
  if (question.scriptId) {
    const script = scriptsById.get(question.scriptId);
    if (script) return <button type="button" onClick={() => onOpenScript(script.id)} className="flex min-h-9 w-full min-w-0 items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2 text-left text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/20"><ArrowUpRight className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Roteiro: {script.title}</span></button>;
    return scriptsLoaded ? <p className="text-[11px] text-rose-200/80">Roteiro vinculado não encontrado.</p> : null;
  }
  if (question.status !== 'scripted') return null;
  return <button type="button" onClick={() => onOpen(question)} className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold text-blue-200 hover:bg-blue-500/10"><Link2 className="h-3.5 w-3.5" />Vincular roteiro</button>;
};

const QuestionCard: React.FC<{ question: CreativeQuestion } & CardActions> = (props) => {
  const { question, busyId, onOpen, onMove, onDelete } = props;
  // Arrastar só com mouse (desktop); no toque, o select "Mover para" faz a mesma coisa sem brigar com a rolagem.
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: question.id, data: { question } });
  return (
    <article ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }} {...attributes} {...listeners} role="group" tabIndex={-1} aria-roledescription="pergunta"
      className={`space-y-2 rounded-xl border border-white/10 bg-[#0D1527] p-3 ${isDragging ? 'relative z-10 shadow-2xl shadow-black/60' : ''} ${busyId === question.id ? 'opacity-60' : ''}`}>
      <button type="button" onClick={() => onOpen(question)} className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
        <span className="line-clamp-4 whitespace-pre-line break-words text-sm font-semibold text-white [overflow-wrap:anywhere]">{question.text}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-white/45">
          {question.category && <span className="max-w-full truncate rounded-full border border-blue-400/15 bg-blue-400/5 px-2 py-0.5 font-semibold text-blue-200/80">{question.category}</span>}
          <span>Criada {formatDate(question.createdAt)}</span>
          {question.answeredAt && <span>Respondida {formatDate(question.answeredAt)}</span>}
          {question.notes && <span className="text-white/35">· com observações</span>}
        </span>
      </button>
      <ScriptLink {...props} />
      <div className="flex items-center gap-1 border-t border-white/[0.07] pt-2">
        <select aria-label="Mover pergunta para outra coluna" value={question.status} disabled={busyId === question.id} onChange={(event) => onMove(question, event.target.value as QuestionStatus)}
          className="min-h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#070B14] px-2 text-base text-white/80 outline-none focus:border-blue-500/60 sm:text-xs">
          {QUESTION_STATUSES.map(([value, label]) => <option key={value} value={value}>{value === question.status ? label : `Mover para: ${label}`}</option>)}
        </select>
        <button type="button" onClick={() => onDelete(question)} disabled={busyId === question.id} aria-label="Excluir pergunta" title="Excluir pergunta" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-red-200/60 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
      </div>
    </article>
  );
};

const Column: React.FC<{ status: QuestionStatus; label: string; items: CreativeQuestion[]; hiddenOnMobile: boolean } & CardActions> = ({ status, label, items, hiddenOnMobile, ...actions }) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const [limit, setLimit] = useState(PAGE);
  return (
    <section ref={setNodeRef} aria-label={label} className={`min-w-0 rounded-2xl p-1 transition-colors ${isOver ? 'bg-blue-500/[0.08] outline-dashed outline-2 outline-blue-400/50' : ''} ${hiddenOnMobile ? 'hidden xl:block' : ''}`}>
      <header className={`mb-3 hidden items-center justify-between gap-2 rounded-xl border px-3 py-2.5 xl:flex ${statusStyles[status]}`}>
        <h3 className="text-xs font-extrabold uppercase tracking-[0.12em]">{label}</h3>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold">{items.length}</span>
      </header>
      <div className="space-y-2.5">
        {items.slice(0, limit).map((question) => <QuestionCard key={question.id} question={question} {...actions} />)}
        {items.length === 0 && <p className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-xs text-white/30">Nenhuma pergunta aqui</p>}
        {items.length > limit && <button type="button" onClick={() => setLimit((value) => value + PAGE)} className="min-h-10 w-full rounded-xl border border-white/10 text-xs font-semibold text-white/60 hover:bg-white/5">Mostrar mais ({items.length - limit})</button>}
      </div>
    </section>
  );
};

/** Kanban: colunas lado a lado no desktop (arrastar com o mouse); no celular, uma coluna por vez escolhida nas abas. */
export const QuestionBoard: React.FC<{ questions: CreativeQuestion[]; statuses: QuestionStatus[] } & CardActions> = ({ questions, statuses, ...actions }) => {
  const [mobileStatus, setMobileStatus] = useState<QuestionStatus>('draft');
  const active = statuses.includes(mobileStatus) ? mobileStatus : statuses[0];
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }));
  const columns = QUESTION_STATUSES.filter(([status]) => statuses.includes(status));
  const handleEnd = ({ active: dragged, over }: DragEndEvent) => {
    const question = dragged.data.current?.question as CreativeQuestion | undefined;
    const target = over?.id as QuestionStatus | undefined;
    if (question && target && target !== question.status) actions.onMove(question, target);
  };
  return (
    <DndContext sensors={sensors} onDragEnd={handleEnd}>
      {columns.length > 1 && (
        <div role="tablist" aria-label="Colunas" className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-[#0D1527] p-1 sm:grid-cols-4 xl:hidden">
          {columns.map(([status, label]) => (
            <button key={status} type="button" role="tab" aria-selected={active === status} onClick={() => setMobileStatus(status)}
              className={`flex min-h-11 items-center justify-between gap-1 rounded-lg px-2.5 text-left text-xs font-semibold transition-colors ${active === status ? 'bg-blue-600 text-white' : 'text-white/60 hover:bg-white/5'}`}>
              <span className="min-w-0 leading-tight">{label}</span>
              <span className="shrink-0 rounded-full bg-white/10 px-1.5 text-[11px] tabular-nums">{questions.filter((question) => question.status === status).length}</span>
            </button>
          ))}
        </div>
      )}
      <div className={`grid grid-cols-1 gap-3 ${columns.length > 1 ? 'xl:grid-cols-4' : ''}`}>
        {columns.map(([status, label]) => <Column key={status} status={status} label={label} items={questions.filter((question) => question.status === status)} hiddenOnMobile={status !== active} {...actions} />)}
      </div>
    </DndContext>
  );
};
