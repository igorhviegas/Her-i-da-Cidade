import React, { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from 'lucide-react';
import {
  AGENT_FAQ_COLLECTION, deleteAgentFaq, saveAgentFaq, seedDefaultAgentFaq, useAgentFaqAdmin, reorderAgentDocs,
  type AgentFaqCategory,
} from '../../../services/agentService';
import { moveItem, newId } from '../../../services/agentContent.js';
import { card, iconBtn, input, Loading, type Run } from './agentShared';

// ------------------------------------------------------------- Suporte (FAQ)

export const FaqTab: React.FC<{ run: Run }> = ({ run }) => {
  const categories = useAgentFaqAdmin();
  const [openId, setOpenId] = useState<string | null>(null);

  if (categories === null) return <Loading />;
  if (categories.length === 0) {
    return (
      <div className={`${card} space-y-4 p-6`}>
        <p className="text-sm text-white/70">Nenhuma categoria gravada ainda: os agentes veem a categoria padrão "Caixa de som" (somente leitura). Carregue-a para poder editar e criar novas categorias e perguntas.</p>
        <button onClick={() => run(seedDefaultAgentFaq, 'FAQ padrão carregado.')} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">Carregar FAQ padrão</button>
      </div>
    );
  }

  const ids = categories.map((c) => c.id);
  const add = async () => {
    const id = newId();
    if (await run(() => saveAgentFaq({ id, order: categories.length, title: 'Nova categoria', active: true, items: [] }))) setOpenId(id);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/50">Categorias do menu Suporte do app, com perguntas e respostas. A ordem abaixo é a ordem mostrada aos agentes.</p>
      {categories.map((category, index) => (
        <FaqEditor key={category.id} category={category} open={openId === category.id} onToggle={() => setOpenId(openId === category.id ? null : category.id)}
          canUp={index > 0} canDown={index < categories.length - 1} onMove={(d) => run(() => reorderAgentDocs(AGENT_FAQ_COLLECTION, moveItem(ids, index, d)))} run={run} />
      ))}
      <button onClick={add} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 py-3 text-sm font-semibold text-white/70 hover:border-blue-500/50 hover:text-white"><Plus className="h-4 w-4" />Nova categoria</button>
    </div>
  );
};

const comparableFaq = (c: AgentFaqCategory) => JSON.stringify([c.title, c.active !== false, c.items.map((i) => [i.id, i.question, i.answer])]);

const FaqEditor: React.FC<{
  category: AgentFaqCategory; open: boolean; onToggle: () => void; canUp: boolean; canDown: boolean; onMove: (d: -1 | 1) => void; run: Run;
}> = ({ category, open, onToggle, canUp, canDown, onMove, run }) => {
  const [draft, setDraft] = useState<AgentFaqCategory>(category);
  const [saving, setSaving] = useState(false);
  const dirty = comparableFaq(draft) !== comparableFaq(category);
  const set = (patch: Partial<AgentFaqCategory>) => setDraft((d) => ({ ...d, ...patch }));
  const setItem = (i: number, patch: Partial<AgentFaqCategory['items'][number]>) => set({ items: draft.items.map((it, n) => (n === i ? { ...it, ...patch } : it)) });
  const save = async () => { setSaving(true); await run(() => saveAgentFaq({ ...draft, order: category.order }), `Categoria "${draft.title}" salva.`); setSaving(false); };

  return (
    <div className={`${card} ${draft.active ? '' : 'opacity-60'}`}>
      <div className="flex items-center gap-1 p-2">
        <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white/5">
          <ChevronDown className={`h-4 w-4 shrink-0 text-white/50 transition-transform ${open ? 'rotate-180' : ''}`} />
          <span className="min-w-0">
            <span className="block truncate text-[11px] font-semibold uppercase tracking-wider text-white/40">{category.items.length} pergunta(s){!category.active && ' · desativada'}</span>
            <span className="block truncate text-sm font-bold text-white">{category.title}</span>
          </span>
        </button>
        <button className={iconBtn} disabled={!canUp} aria-label="Subir categoria" onClick={() => onMove(-1)}><ArrowUp className="h-4 w-4" /></button>
        <button className={iconBtn} disabled={!canDown} aria-label="Descer categoria" onClick={() => onMove(1)}><ArrowDown className="h-4 w-4" /></button>
      </div>

      {open && (
        <div className="space-y-4 border-t border-white/10 p-4">
          <label className="block text-xs font-semibold text-white/60">Nome da categoria<input className={`${input} mt-1`} value={draft.title} onChange={(e) => set({ title: e.target.value })} /></label>
          <label className="flex items-center gap-2 text-xs text-white/70"><input type="checkbox" checked={draft.active} onChange={(e) => set({ active: e.target.checked })} />Ativa (aparece para os agentes)</label>

          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-white/50">Perguntas e respostas</p>
            {draft.items.map((item, i) => (
              <div key={item.id} className="space-y-2 rounded-xl bg-white/[0.03] p-2">
                <div className="flex items-center gap-1">
                  <input className={`${input} font-semibold`} placeholder="Pergunta" value={item.question} onChange={(e) => setItem(i, { question: e.target.value })} />
                  <button className={iconBtn} disabled={i === 0} aria-label="Subir pergunta" onClick={() => set({ items: moveItem(draft.items, i, -1) })}><ArrowUp className="h-4 w-4" /></button>
                  <button className={iconBtn} disabled={i === draft.items.length - 1} aria-label="Descer pergunta" onClick={() => set({ items: moveItem(draft.items, i, 1) })}><ArrowDown className="h-4 w-4" /></button>
                  <button className={`${iconBtn} hover:!text-red-400`} aria-label="Remover pergunta" onClick={() => set({ items: draft.items.filter((_, n) => n !== i) })}><Trash2 className="h-4 w-4" /></button>
                </div>
                <textarea className={input} rows={3} placeholder="Resposta" value={item.answer} onChange={(e) => setItem(i, { answer: e.target.value })} />
              </div>
            ))}
            <button onClick={() => set({ items: [...draft.items, { id: newId(), question: '', answer: '' }] })} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-blue-400 hover:bg-white/5"><Plus className="h-3.5 w-3.5" />Adicionar pergunta</button>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
            <button onClick={() => { if (window.confirm(`Excluir a categoria "${category.title}" e suas perguntas?`)) run(() => deleteAgentFaq(category.id), 'Categoria excluída.'); }} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" />Excluir categoria</button>
            <button onClick={save} disabled={!dirty || saving || !draft.title.trim() || draft.items.some((i) => !i.question.trim())} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:bg-white/10 disabled:text-white/40">{saving ? 'Salvando...' : dirty ? 'Salvar categoria' : 'Salvo'}</button>
          </div>
        </div>
      )}
    </div>
  );
};
