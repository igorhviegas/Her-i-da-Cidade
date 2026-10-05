import React, { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ExternalLink, Headset, Loader2, Music, Plus, Trash2, TriangleAlert, Upload } from 'lucide-react';
import {
  AGENT_STEPS_COLLECTION, AGENT_TRACKS_COLLECTION, MAX_AUDIO_MB, deleteAgentStep, deleteAgentTrack, reorderAgentDocs, saveAgentStep,
  saveAgentTrack, seedDefaultAgentSteps, uploadAgentAudio, useAgentStepsAdmin, useAgentTracksAdmin,
  type AgentItem, type AgentStep, type AgentTrack,
} from '../../services/agentService';
import { DEFAULT_AGENT_STEPS, moveItem, newId } from '../../services/agentContent.js';

type Feedback = { type: 'success' | 'error'; message: string } | null;

const input = 'w-full rounded-lg border border-white/10 bg-[#070B14] px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-blue-500/60';
const iconBtn = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent';
const card = 'rounded-2xl border border-white/10 bg-[#0D1527]';

export const AdminAgentPage: React.FC = () => {
  const [tab, setTab] = useState<'steps' | 'tracks'>('steps');
  const [feedback, setFeedback] = useState<Feedback>(null);

  /** Executa uma gravação e mostra o resultado; devolve se deu certo. */
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setFeedback(null);
    try { await fn(); if (ok) setFeedback({ type: 'success', message: ok }); return true; }
    catch (err: any) { setFeedback({ type: 'error', message: err?.message || 'Não foi possível salvar. Verifique suas permissões de administrador.' }); return false; }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-white/10 pb-6">
        <h1 className="flex items-center gap-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl"><Headset className="h-8 w-8 text-blue-400" />Agente</h1>
        <p className="mt-1 text-sm font-light text-white/60">Conteúdo da área <code className="font-mono text-blue-400">/agente-hdc</code>: etapas, checklists e músicas usadas pelos agentes durante o evento.</p>
        <a href="/agente-hdc" target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">Abrir a área do agente <ExternalLink className="h-3 w-3" /></a>
      </div>

      <div className="flex gap-2">
        {([['steps', 'Instruções'], ['tracks', 'Músicas']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === id ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60 hover:text-white'}`}>{label}</button>
        ))}
      </div>

      {feedback && (
        <div className={`rounded-xl border p-3 text-sm font-medium ${feedback.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>{feedback.message}</div>
      )}

      {tab === 'steps' ? <StepsTab run={run} /> : <TracksTab run={run} />}
    </div>
  );
};

type Run = (fn: () => Promise<unknown>, ok?: string) => Promise<boolean>;

// ---------------------------------------------------------------- Instruções

const StepsTab: React.FC<{ run: Run }> = ({ run }) => {
  const steps = useAgentStepsAdmin();
  const [openId, setOpenId] = useState<string | null>(null);

  if (steps === null) return <Loading />;
  if (steps.length === 0) {
    return (
      <div className={`${card} space-y-4 p-6`}>
        <p className="text-sm text-white/70">Nenhuma etapa gravada ainda: os agentes estão vendo o roteiro padrão (somente leitura). Carregue-o para poder editar, reordenar e criar etapas.</p>
        <button onClick={() => run(seedDefaultAgentSteps, 'Roteiro padrão carregado.')} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">Carregar roteiro padrão ({DEFAULT_AGENT_STEPS.length} etapas)</button>
      </div>
    );
  }

  const ids = steps.map((s) => s.id);
  const move = (index: number, delta: -1 | 1) => run(() => reorderAgentDocs(AGENT_STEPS_COLLECTION, moveItem(ids, index, delta)));
  const add = async () => {
    const id = newId();
    if (await run(() => saveAgentStep({ id, order: steps.length, title: 'Nova etapa', kicker: '', description: '', alert: '', highlight: false, startButton: false, active: true, items: [] }))) setOpenId(id);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/50">A ordem abaixo é exatamente a ordem mostrada aos agentes. Etapas desativadas ficam ocultas no app.</p>
      {steps.map((step, index) => (
        <StepEditor key={step.id} step={step} open={openId === step.id} onToggle={() => setOpenId(openId === step.id ? null : step.id)}
          canUp={index > 0} canDown={index < steps.length - 1} onMove={(d) => move(index, d)} run={run} />
      ))}
      <button onClick={add} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 py-3 text-sm font-semibold text-white/70 hover:border-blue-500/50 hover:text-white"><Plus className="h-4 w-4" />Nova etapa</button>
    </div>
  );
};

// Só os campos editáveis, em ordem fixa (o Firestore devolve as chaves em outra ordem e acrescenta updatedAt).
const comparable = (s: AgentStep) => JSON.stringify([
  s.title, s.kicker ?? '', s.description ?? '', s.alert ?? '', !!s.highlight, !!s.startButton, s.active !== false,
  s.items.map((i) => [i.id, i.text, !!i.heading, !!i.note]),
]);

const StepEditor: React.FC<{
  step: AgentStep; open: boolean; onToggle: () => void; canUp: boolean; canDown: boolean; onMove: (d: -1 | 1) => void; run: Run;
}> = ({ step, open, onToggle, canUp, canDown, onMove, run }) => {
  const [draft, setDraft] = useState<AgentStep>(step);
  const [saving, setSaving] = useState(false);
  const dirty = comparable(draft) !== comparable(step);
  const set = (patch: Partial<AgentStep>) => setDraft((d) => ({ ...d, ...patch }));
  const setItem = (i: number, patch: Partial<AgentItem>) => set({ items: draft.items.map((it, n) => (n === i ? { ...it, ...patch } : it)) });

  const save = async () => { setSaving(true); await run(() => saveAgentStep({ ...draft, order: step.order }), `Etapa "${draft.title}" salva.`); setSaving(false); };

  return (
    <div className={`${card} ${draft.active ? '' : 'opacity-60'}`}>
      <div className="flex items-center gap-1 p-2">
        <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white/5">
          <ChevronDown className={`h-4 w-4 shrink-0 text-white/50 transition-transform ${open ? 'rotate-180' : ''}`} />
          <span className="min-w-0">
            <span className="block truncate text-[11px] font-semibold uppercase tracking-wider text-white/40">{step.kicker || 'Etapa'}{!step.active && ' · desativada'}</span>
            <span className="block truncate text-sm font-bold text-white">{step.title}</span>
          </span>
        </button>
        <button className={iconBtn} disabled={!canUp} aria-label="Subir etapa" onClick={() => onMove(-1)}><ArrowUp className="h-4 w-4" /></button>
        <button className={iconBtn} disabled={!canDown} aria-label="Descer etapa" onClick={() => onMove(1)}><ArrowDown className="h-4 w-4" /></button>
      </div>

      {open && (
        <div className="space-y-4 border-t border-white/10 p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
            <label className="text-xs font-semibold text-white/60">Título<input className={`${input} mt-1`} value={draft.title} onChange={(e) => set({ title: e.target.value })} /></label>
            <label className="text-xs font-semibold text-white/60">Rótulo<input className={`${input} mt-1`} value={draft.kicker ?? ''} placeholder="Etapa 1" onChange={(e) => set({ kicker: e.target.value })} /></label>
          </div>
          <label className="block text-xs font-semibold text-white/60">Texto de apoio<textarea className={`${input} mt-1`} rows={2} value={draft.description ?? ''} onChange={(e) => set({ description: e.target.value })} /></label>
          <label className="block text-xs font-semibold text-red-300"><span className="inline-flex items-center gap-1"><TriangleAlert className="h-3.5 w-3.5" />Alerta em destaque no topo da etapa (vazio = sem alerta)</span>
            <textarea className={`${input} mt-1`} rows={2} value={draft.alert ?? ''} onChange={(e) => set({ alert: e.target.value })} />
          </label>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/70">
            <label className="flex items-center gap-2"><input type="checkbox" checked={draft.active} onChange={(e) => set({ active: e.target.checked })} />Ativa</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!draft.highlight} onChange={(e) => set({ highlight: e.target.checked })} />Destacar como momento importante</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!draft.startButton} onChange={(e) => set({ startButton: e.target.checked })} />Mostrar botão "Iniciar evento"</label>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-white/50">Itens do checklist</p>
            {draft.items.map((item, i) => (
              <div key={item.id} className="flex items-center gap-1 rounded-xl bg-white/[0.03] p-1.5">
                <input className={`${input} ${item.heading ? 'font-bold text-blue-300' : ''}`} value={item.text} onChange={(e) => setItem(i, { text: e.target.value })} />
                <label className="flex shrink-0 items-center gap-1 px-1 text-[11px] text-white/50" title="Mostrar como subtítulo (não é marcável)"><input type="checkbox" checked={!!item.heading} onChange={(e) => setItem(i, { heading: e.target.checked })} />Subtítulo</label>
                <label className="flex shrink-0 items-center gap-1 px-1 text-[11px] text-white/50" title="Permitir anotação"><input type="checkbox" checked={!!item.note} onChange={(e) => setItem(i, { note: e.target.checked })} />Nota</label>
                <button className={iconBtn} disabled={i === 0} aria-label="Subir item" onClick={() => set({ items: moveItem(draft.items, i, -1) })}><ArrowUp className="h-4 w-4" /></button>
                <button className={iconBtn} disabled={i === draft.items.length - 1} aria-label="Descer item" onClick={() => set({ items: moveItem(draft.items, i, 1) })}><ArrowDown className="h-4 w-4" /></button>
                <button className={`${iconBtn} hover:!text-red-400`} aria-label="Remover item" onClick={() => set({ items: draft.items.filter((_, n) => n !== i) })}><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <button onClick={() => set({ items: [...draft.items, { id: newId(), text: '' }] })} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-blue-400 hover:bg-white/5"><Plus className="h-3.5 w-3.5" />Adicionar item</button>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
            <button onClick={() => { if (window.confirm(`Excluir a etapa "${step.title}"?`)) run(() => deleteAgentStep(step.id), 'Etapa excluída.'); }} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" />Excluir etapa</button>
            <button onClick={save} disabled={!dirty || saving || !draft.title.trim()} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:bg-white/10 disabled:text-white/40">{saving ? 'Salvando...' : dirty ? 'Salvar etapa' : 'Salvo'}</button>
          </div>
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------------- Músicas

const fileTitle = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Nova música';

const TracksTab: React.FC<{ run: Run }> = ({ run }) => {
  const tracks = useAgentTracksAdmin();
  const [busy, setBusy] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  if (tracks === null) return <Loading />;
  const ids = tracks.map((t) => t.id);
  const move = (index: number, delta: -1 | 1) => run(() => reorderAgentDocs(AGENT_TRACKS_COLLECTION, moveItem(ids, index, delta)));

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    let order = tracks.length;
    for (const file of Array.from(files)) {
      await run(async () => {
        const url = await uploadAgentAudio(file);
        await saveAgentTrack({ id: newId(), order: order++, title: fileTitle(file.name), url, active: true });
      }, `"${fileTitle(file.name)}" enviada.`);
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const addLink = async () => {
    if (!/^https:\/\//i.test(linkUrl.trim()) || !linkTitle.trim()) return;
    if (await run(() => saveAgentTrack({ id: newId(), order: tracks.length, title: linkTitle, url: linkUrl.trim(), active: true }), 'Música adicionada.')) { setLinkTitle(''); setLinkUrl(''); }
  };

  return (
    <div className="space-y-4">
      <div className={`${card} space-y-4 p-4`}>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{busy ? 'Enviando...' : 'Enviar áudio(s)'}
          </button>
          <input ref={fileRef} type="file" multiple accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,.mp3,.m4a,.wav" className="hidden" onChange={(e) => onFiles(e.target.files)} />
          <span className="text-xs text-white/50">MP3, M4A ou WAV, até {MAX_AUDIO_MB} MB cada (formatos que tocam no iPhone).</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <input className={input} placeholder="Nome (para link externo)" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} />
          <input className={input} placeholder="https://… link direto do arquivo de áudio (para arquivos maiores)" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
          <button onClick={addLink} disabled={!linkTitle.trim() || !/^https:\/\//i.test(linkUrl.trim())} className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-40">Adicionar link</button>
        </div>
      </div>

      {tracks.length === 0 && <p className="py-6 text-center text-sm text-white/50">Nenhuma música ainda.</p>}
      {tracks.map((track, index) => (
        <TrackRow key={track.id} track={track} canUp={index > 0} canDown={index < tracks.length - 1} onMove={(d) => move(index, d)} run={run} />
      ))}
    </div>
  );
};

const TrackRow: React.FC<{ track: AgentTrack; canUp: boolean; canDown: boolean; onMove: (d: -1 | 1) => void; run: Run }> = ({ track, canUp, canDown, onMove, run }) => {
  const [title, setTitle] = useState(track.title);
  const [busy, setBusy] = useState(false);
  const replaceRef = useRef<HTMLInputElement>(null);
  const patch = (p: Partial<AgentTrack>) => run(() => saveAgentTrack({ ...track, ...p }));

  const replace = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    await run(async () => saveAgentTrack({ ...track, url: await uploadAgentAudio(file) }), 'Arquivo substituído.');
    setBusy(false);
    if (replaceRef.current) replaceRef.current.value = '';
  };

  return (
    <div className={`${card} space-y-3 p-3 ${track.active ? '' : 'opacity-60'}`}>
      <div className="flex items-center gap-1">
        <Music className="mx-2 h-4 w-4 shrink-0 text-pink-300" />
        <input className={input} value={title} aria-label="Nome da música" onChange={(e) => setTitle(e.target.value)}
          onBlur={() => { if (title.trim() && title !== track.title) patch({ title }); else setTitle(track.title); }} />
        <button className={iconBtn} disabled={!canUp} aria-label="Subir música" onClick={() => onMove(-1)}><ArrowUp className="h-4 w-4" /></button>
        <button className={iconBtn} disabled={!canDown} aria-label="Descer música" onClick={() => onMove(1)}><ArrowDown className="h-4 w-4" /></button>
      </div>
      <audio controls preload="none" src={track.url} className="h-9 w-full" />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <label className="flex items-center gap-2 text-white/70"><input type="checkbox" checked={track.active} onChange={(e) => patch({ active: e.target.checked })} />Ativa (aparece para os agentes)</label>
        <div className="flex items-center gap-1">
          <button onClick={() => replaceRef.current?.click()} disabled={busy} className="flex items-center gap-1.5 rounded-lg px-3 py-2 font-semibold text-blue-400 hover:bg-white/5 disabled:opacity-50">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}Substituir arquivo</button>
          <input ref={replaceRef} type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,.mp3,.m4a,.wav" className="hidden" onChange={(e) => replace(e.target.files?.[0])} />
          <button onClick={() => { if (window.confirm(`Excluir "${track.title}"?`)) run(() => deleteAgentTrack(track.id), 'Música excluída.'); }} className="flex items-center gap-1.5 rounded-lg px-3 py-2 font-semibold text-red-400 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" />Excluir</button>
        </div>
      </div>
    </div>
  );
};

const Loading: React.FC = () => <div className="flex items-center justify-center gap-3 py-12 text-sm text-white/40"><Loader2 className="h-6 w-6 animate-spin text-blue-400" />Carregando...</div>;
