import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, MessageCircleQuestionMark, Plus, Search } from 'lucide-react';
import { useRouter } from '../../../lib/router';
import { filterQuestions, QUESTION_LIMITS, QUESTION_STATUSES } from '../../../services/creativeQuestions.js';
import type { CreativeQuestion, QuestionInput, QuestionStatus } from '../../../services/creativeQuestions.js';
import { createQuestion, deleteQuestion, listQuestions, sendQuestionToScripts, updateQuestion } from '../../../services/creativeQuestionsService';
import { CAIXINHA_PROJECT_ID } from '../../../services/scriptProjects.js';
import { useScriptsData } from '../ordersFlow/useScriptLibrary';
import { useScriptProjects } from '../scriptProjects/useScriptProjects';
import { QuestionBoard } from './QuestionBoard';
import { QuestionModal } from './QuestionModal';

const SCRIPTS_PATH = '/admin/espaco-criativo/roteiros';
type Flash = { kind: 'ok' | 'error'; text: string } | null;
const errorText = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);
const inputOf = (question: CreativeQuestion): QuestionInput => ({ text: question.text, category: question.category, notes: question.notes, status: question.status, scriptId: question.scriptId });

/** Lista de perguntas do Firestore + mensagem de resultado das ações. */
function useQuestions() {
  const [questions, setQuestions] = useState<CreativeQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [flash, setFlashState] = useState<Flash>(null);
  const timer = useRef<number | undefined>(undefined);
  const setFlash = useCallback((next: Flash) => {
    setFlashState(next);
    window.clearTimeout(timer.current);
    if (next?.kind === 'ok') timer.current = window.setTimeout(() => setFlashState(null), 4000);
  }, []);
  const load = useCallback(() => {
    setLoading(true);
    setLoadError('');
    listQuestions().then(setQuestions).catch((error) => setLoadError(errorText(error, 'Não foi possível carregar as perguntas.'))).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); return () => window.clearTimeout(timer.current); }, [load]);
  const replace = (saved: CreativeQuestion) => setQuestions((current) => current.map((item) => (item.id === saved.id ? saved : item)));
  return { questions, setQuestions, replace, loading, loadError, load, flash, setFlash };
}

export const AdminQuestionsPage: React.FC = () => {
  const { navigate } = useRouter();
  const { questions, setQuestions, replace, loading, loadError, load, flash, setFlash } = useQuestions();
  const { scripts, setScripts, loading: scriptsLoading } = useScriptsData();
  const { projectsById } = useScriptProjects(); // também cria o projeto da Caixinha na primeira vez
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuestionStatus | ''>('');
  const [quickText, setQuickText] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<CreativeQuestion | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const scriptsById = useMemo(() => new Map(scripts.map((script) => [script.id, script])), [scripts]);
  const categories = useMemo(() => Array.from(new Set<string>(questions.map((item) => item.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })), [questions]);
  const visible = useMemo(() => filterQuestions(questions, { search, category: categoryFilter }), [questions, search, categoryFilter]);
  const statuses = statusFilter ? [statusFilter] : QUESTION_STATUSES.map(([status]) => status);
  const openScript = (scriptId: string) => navigate(`${SCRIPTS_PATH}?scriptId=${encodeURIComponent(scriptId)}`);

  const quickAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (adding || !quickText.trim()) return;
    setAdding(true);
    try {
      const created = await createQuestion({ text: quickText, category: categoryFilter, notes: '', status: 'draft' });
      setQuestions((current) => [created, ...current]);
      setQuickText('');
      setFlash({ kind: 'ok', text: 'Pergunta adicionada em Rascunhos.' });
    } catch (error) {
      setFlash({ kind: 'error', text: errorText(error, 'Não foi possível adicionar a pergunta.') });
    } finally {
      setAdding(false);
    }
  };

  const save = async (input: QuestionInput, answeredAt: Date | null) => {
    const current = editing === 'new' ? null : editing;
    const saved = current ? await updateQuestion(current, input, answeredAt) : await createQuestion(input, answeredAt);
    if (current) replace(saved); else setQuestions((list) => [saved, ...list]);
    setEditing(null);
    setFlash({ kind: 'ok', text: current ? 'Pergunta atualizada.' : 'Pergunta criada.' });
  };

  const move = async (question: CreativeQuestion, status: QuestionStatus) => {
    if (busyId || status === question.status) return;
    setBusyId(question.id);
    replace({ ...question, status }); // otimista; volta se a gravação falhar
    try {
      replace(await updateQuestion(question, { ...inputOf(question), status }));
    } catch (error) {
      replace(question);
      setFlash({ kind: 'error', text: errorText(error, 'Não foi possível mover a pergunta.') });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (question: CreativeQuestion) => {
    if (busyId || !window.confirm(`Excluir a pergunta “${question.text.slice(0, 80)}”? ${question.scriptId ? 'O roteiro relacionado não será excluído.' : ''}`)) return;
    setBusyId(question.id);
    try {
      await deleteQuestion(question.id);
      setQuestions((current) => current.filter((item) => item.id !== question.id));
      setEditing(null);
      setFlash({ kind: 'ok', text: 'Pergunta excluída.' });
    } catch (error) {
      setFlash({ kind: 'error', text: errorText(error, 'Não foi possível excluir a pergunta.') });
    } finally {
      setBusyId(null);
    }
  };

  // Roteiro e vínculo são gravados juntos no serviço; o botão some quando a pergunta já tem roteiro.
  const send = async (question: CreativeQuestion) => {
    if (busyId || question.scriptId) return;
    setEditing(null);
    setBusyId(question.id);
    try {
      const result = await sendQuestionToScripts(question);
      replace(result.question);
      setScripts((current) => [result.script, ...current]);
      setFlash({ kind: 'ok', text: `Enviada para Roteiros como rascunho do projeto “${projectsById.get(CAIXINHA_PROJECT_ID)?.name ?? 'Aranha Responde'}”.` });
    } catch (error) {
      setFlash({ kind: 'error', text: errorText(error, 'Não foi possível enviar para Roteiros.') });
    } finally {
      setBusyId(null);
    }
  };

  const actions = { scriptsById, scriptsLoaded: !scriptsLoading, busyId, onOpen: setEditing, onMove: (question: CreativeQuestion, status: QuestionStatus) => void move(question, status), onDelete: (question: CreativeQuestion) => void remove(question), onOpenScript: openScript, onSend: (question: CreativeQuestion) => void send(question) };
  const filterClass = 'rounded-xl border border-white/10 bg-[#070B14] px-3 py-2.5 text-base text-white outline-none focus:border-blue-500/60 sm:text-sm';

  return (
    <section className="space-y-5 animate-in fade-in duration-200">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-400">Espaço Criativo</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Caixinha de Perguntas</h2>
          <p className="mt-1 max-w-2xl text-sm text-white/50">Banco permanente de perguntas para a caixinha dos Stories: registre a ideia e acompanhe até virar roteiro.</p>
        </div>
        <button type="button" onClick={() => setEditing('new')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/15 hover:bg-blue-500"><Plus className="h-4 w-4" />Nova pergunta</button>
      </div>

      <form onSubmit={quickAdd} className="flex gap-2 rounded-2xl border border-white/10 bg-[#0D1527] p-3">
        <input value={quickText} onChange={(event) => setQuickText(event.target.value)} maxLength={QUESTION_LIMITS.text} disabled={adding} aria-label="Nova pergunta rápida" placeholder="Teve uma ideia? Escreva a pergunta e tecle Enter" className={`${filterClass} min-w-0 flex-1`} />
        <button type="submit" disabled={adding || !quickText.trim()} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-blue-600/20 px-3 text-sm font-semibold text-blue-100 hover:bg-blue-600/30 disabled:opacity-40">{adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}<span className="hidden sm:inline">Adicionar</span></button>
      </form>

      {flash && <div role={flash.kind === 'ok' ? 'status' : 'alert'} className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${flash.kind === 'ok' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200' : 'border-red-500/25 bg-red-500/10 text-red-200'}`}>{flash.kind === 'ok' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}<span className="min-w-0 break-words">{flash.text}</span>{flash.kind === 'error' && <button type="button" onClick={() => setFlash(null)} className="ml-auto shrink-0 text-xs font-semibold underline">Fechar</button>}</div>}

      <div className="grid grid-cols-1 gap-2 rounded-2xl border border-white/10 bg-[#0D1527] p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
        <label className="relative block sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nas perguntas" aria-label="Buscar perguntas" className={`${filterClass} w-full pl-9`} />
        </label>
        <select aria-label="Filtrar por categoria" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={`${filterClass} min-w-0`}>
          <option value="">Todas as categorias</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select aria-label="Filtrar por status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as QuestionStatus | '')} className={`${filterClass} min-w-0`}>
          <option value="">Todos os status</option>{QUESTION_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {loading ? <div className="flex min-h-52 items-center justify-center gap-3 text-sm text-white/55"><Loader2 className="h-5 w-5 animate-spin text-blue-400" />Carregando perguntas…</div>
        : loadError ? <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200"><AlertCircle className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1">Não foi possível carregar as perguntas. {loadError}</span><button type="button" onClick={load} className="min-h-10 rounded-lg px-3 font-semibold hover:bg-red-500/10">Tentar de novo</button></div>
          : questions.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 bg-[#0D1527]/60 px-5 py-14 text-center"><MessageCircleQuestionMark className="mx-auto h-8 w-8 text-white/30" /><p className="mt-3 text-base font-semibold text-white">Nenhuma pergunta ainda.</p><p className="mt-1 text-sm text-white/45">Escreva a primeira ideia no campo acima. Ela entra em Rascunhos e você move quando estiver pronta.</p></div>
            : visible.length === 0 ? <p className="rounded-xl border border-white/10 bg-[#0D1527] p-5 text-center text-sm text-white/55">Nenhuma pergunta corresponde à busca ou aos filtros.</p>
              : <QuestionBoard questions={visible} statuses={statuses} {...actions} />}

      {editing && <QuestionModal question={editing === 'new' ? null : editing} scripts={scripts} categories={categories} onClose={() => setEditing(null)} onSave={save} onDelete={(question) => void remove(question)} onOpenScript={openScript} onSend={(question) => void send(question)} />}
    </section>
  );
};
