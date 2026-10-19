import React, { FormEvent, useState } from 'react';
import { AlertCircle, ArrowUpRight, Loader2, PenLine, Trash2, X } from 'lucide-react';
import { answeredAtFor, QUESTION_LIMITS, QUESTION_STATUSES } from '../../../services/creativeQuestions.js';
import type { CreativeQuestion, QuestionInput, QuestionStatus } from '../../../services/creativeQuestions.js';
import type { ContentScript } from '../../../types';
import { dateFromInput, dateInput, todayInput } from '../ordersFlow/scriptEditorHelpers';
import { formatDate } from '../ordersFlow/scriptsHelpers';

// text-base no celular: campo com fonte menor que 16px faz o iPhone dar zoom ao focar.
const fieldClass = 'mt-1.5 w-full rounded-xl border border-white/10 bg-[#070B14] px-3 py-2.5 text-base text-white outline-none placeholder:text-white/30 focus:border-blue-500/60 disabled:opacity-50 sm:text-sm';
const labelClass = 'block text-xs font-semibold text-white/70';

interface Props {
  /** null = nova pergunta. */
  question: CreativeQuestion | null;
  scripts: ContentScript[];
  categories: string[];
  onClose: () => void;
  onSave: (input: QuestionInput, answeredAt: Date | null) => Promise<void>;
  onDelete: (question: CreativeQuestion) => void;
  onOpenScript: (scriptId: string) => void;
  onCreateScript: (question: CreativeQuestion) => void;
}

/** Ver a pergunta completa, editar, mudar status, vincular/criar roteiro e excluir. */
export const QuestionModal: React.FC<Props> = ({ question, scripts, categories, onClose, onSave, onDelete, onOpenScript, onCreateScript }) => {
  const [text, setText] = useState(question?.text ?? '');
  const [category, setCategory] = useState(question?.category ?? '');
  const [notes, setNotes] = useState(question?.notes ?? '');
  const [status, setStatus] = useState<QuestionStatus>(question?.status ?? 'draft');
  const [answeredDate, setAnsweredDate] = useState(dateInput(question?.answeredAt));
  const [scriptId, setScriptId] = useState(question?.scriptId ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const answered = status === 'answered' || status === 'scripted';
  const linkedMissing = !!scriptId && !scripts.some((script) => script.id === scriptId);
  const sortedScripts = [...scripts].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' }));

  const changeStatus = (next: QuestionStatus) => {
    setStatus(next);
    // Data da resposta preenchida sozinha ao marcar como respondida; o usuário pode ajustar.
    const date = answeredAtFor(next, dateFromInput(answeredDate), new Date());
    setAnsweredDate(date ? dateInput(date) : '');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await onSave({ text, category, notes, status, scriptId: scriptId || null }, answered ? dateFromInput(answeredDate || todayInput()) : null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar a pergunta.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="question-modal-title" className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-white/15 bg-[#0D1527] shadow-2xl sm:rounded-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <h2 id="question-modal-title" className="text-base font-bold text-white">{question ? 'Pergunta' : 'Nova pergunta'}</h2>
            {question && <p className="text-[11px] text-white/45">Criada em {formatDate(question.createdAt)}</p>}
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Fechar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/60 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
        </header>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-200"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
            <label className={labelClass}>Pergunta *
              <textarea required autoFocus={!question} maxLength={QUESTION_LIMITS.text} rows={3} value={text} onChange={(event) => setText(event.target.value)} disabled={saving} className={`${fieldClass} resize-y`} placeholder="Ex.: Qual foi o pedido mais inusitado que você já recebeu?" />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className={labelClass}>Categoria ou tema
                <input list="question-categories" maxLength={QUESTION_LIMITS.category} value={category} onChange={(event) => setCategory(event.target.value)} disabled={saving} className={fieldClass} placeholder="Escolha ou digite" />
                <datalist id="question-categories">{categories.map((item) => <option key={item} value={item} />)}</datalist>
              </label>
              <label className={labelClass}>Status
                <select value={status} onChange={(event) => changeStatus(event.target.value as QuestionStatus)} disabled={saving} className={fieldClass}>
                  {QUESTION_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>
            {answered && (
              <label className={labelClass}>Data da resposta
                <input type="date" value={answeredDate} onChange={(event) => setAnsweredDate(event.target.value)} disabled={saving} className={fieldClass} />
              </label>
            )}
            <label className={labelClass}>Observações
              <textarea maxLength={QUESTION_LIMITS.notes} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} disabled={saving} className={`${fieldClass} resize-y`} placeholder="Contexto, ideias de abordagem, referências…" />
            </label>
            <div className="space-y-2 rounded-xl border border-blue-400/15 bg-blue-500/[0.05] p-3">
              <label className={labelClass}>Roteiro relacionado
                <select value={scriptId} onChange={(event) => setScriptId(event.target.value)} disabled={saving} className={fieldClass}>
                  <option value="">Nenhum</option>
                  {linkedMissing && <option value={scriptId}>Roteiro não encontrado (removido?)</option>}
                  {sortedScripts.map((script) => <option key={script.id} value={script.id}>{script.title}</option>)}
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                {scriptId && !linkedMissing && <button type="button" onClick={() => onOpenScript(scriptId)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-blue-200 hover:bg-blue-500/10"><ArrowUpRight className="h-4 w-4" />Abrir roteiro</button>}
                {question && !question.scriptId && !scriptId && <button type="button" onClick={() => onCreateScript(question)} disabled={saving} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-blue-600/15 px-3 text-xs font-bold text-blue-100 hover:bg-blue-600/25 disabled:opacity-50"><PenLine className="h-4 w-4" />Criar roteiro a partir desta pergunta</button>}
              </div>
              {scriptId && status !== 'scripted' && <p className="text-[11px] text-white/45">Dica: com roteiro vinculado, a pergunta costuma ir para “Roteiro criado”.</p>}
            </div>
          </div>
          <footer className="flex items-center justify-between gap-2 border-t border-white/10 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {question ? <button type="button" onClick={() => onDelete(question)} disabled={saving} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-red-200/80 hover:bg-red-500/10 disabled:opacity-50"><Trash2 className="h-4 w-4" />Excluir</button> : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-white/60 hover:bg-white/5">Cancelar</button>
              <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Salvar</button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
};
