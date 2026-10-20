import React, { FormEvent, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Lock, Plus, Search, Trash2, X } from 'lucide-react';
import { createProject, deleteProject, updateProject } from '../../../services/scriptProjectsService';
import { CAIXINHA_PROJECT_ID, DEFAULT_ICON, PROJECT_NAME_MAX } from '../../../services/scriptProjects.js';
import type { ScriptProject } from '../../../services/scriptProjects.js';
import type { ContentScript } from '../../../types';
import { PROJECT_ICONS, ProjectIcon } from './projectIcons';

const field = 'w-full min-w-0 rounded-xl border border-white/10 bg-[#070B14] px-3 py-2.5 text-base text-white outline-none placeholder:text-white/30 focus:border-blue-500/60 disabled:opacity-50 sm:text-sm';
const iconButton = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-100 hover:bg-fuchsia-500/20 disabled:opacity-50';

/** Grade de ícones para escolher; busca pelo nome (em inglês, como no lucide). */
const IconPicker: React.FC<{ value: string; onPick: (icon: string) => void; onClose: () => void }> = ({ value, onPick, onClose }) => {
  const [term, setTerm] = useState('');
  const names = Object.keys(PROJECT_ICONS).filter((name) => name.toLowerCase().includes(term.trim().toLowerCase()));
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label="Escolher ícone" className="flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/15 bg-[#0D1527] sm:rounded-2xl">
        <header className="flex items-center gap-2 border-b border-white/10 p-3">
          <label className="relative block min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input autoFocus value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Buscar ícone (ex.: mic, video, star)" aria-label="Buscar ícone" className={`${field} pl-9`} />
          </label>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white/60 hover:bg-white/10"><X className="h-5 w-5" /></button>
        </header>
        <div className="grid grid-cols-6 gap-1.5 overflow-y-auto p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:grid-cols-8">
          {names.map((name) => (
            <button key={name} type="button" onClick={() => onPick(name)} aria-label={name} title={name} aria-pressed={name === value}
              className={`flex aspect-square items-center justify-center rounded-xl border transition-colors ${name === value ? 'border-fuchsia-400 bg-fuchsia-500/20 text-white' : 'border-white/10 text-white/70 hover:bg-white/10 hover:text-white'}`}>
              <ProjectIcon icon={name} className="h-5 w-5" />
            </button>
          ))}
          {names.length === 0 && <p className="col-span-full py-6 text-center text-sm text-white/45">Nenhum ícone com esse nome.</p>}
        </div>
      </section>
    </div>
  );
};

interface Props {
  projects: ScriptProject[];
  setProjects: React.Dispatch<React.SetStateAction<ScriptProject[]>>;
  scripts: ContentScript[];
  onShowScripts: (projectId: string) => void;
  /** Depois de excluir um projeto: tirar o vínculo dos roteiros já carregados. */
  onUnlinked: (projectId: string) => void;
}

/** Aba Projetos da biblioteca de roteiros: adicionar, renomear, trocar ícone e excluir. */
export const ProjectsPanel: React.FC<Props> = ({ projects, setProjects, scripts, onShowScripts, onUnlinked }) => {
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState(DEFAULT_ICON);
  const [names, setNames] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState<{ id: string | null; icon: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const counts = useMemo(() => scripts.reduce((map, script) => (script.projectId ? map.set(script.projectId, (map.get(script.projectId) ?? 0) + 1) : map), new Map<string, number>()), [scripts]);

  const run = async (key: string, action: () => Promise<string>) => {
    if (busy) return;
    setBusy(key);
    setMessage(null);
    try {
      setMessage({ ok: true, text: await action() });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Não foi possível salvar.' });
    } finally {
      setBusy(null);
    }
  };
  const replace = (saved: ScriptProject) => setProjects((current) => current.map((item) => (item.id === saved.id ? saved : item)));
  const add = (event: FormEvent) => {
    event.preventDefault();
    void run('new', async () => {
      const created = await createProject({ name: newName, icon: newIcon });
      setProjects((current) => [...current, created]);
      setNewName('');
      setNewIcon(DEFAULT_ICON);
      return `Projeto “${created.name}” criado.`;
    });
  };
  const rename = (project: ScriptProject) => {
    const name = (names[project.id] ?? project.name).trim();
    if (name === project.name) return;
    void run(project.id, async () => { replace(await updateProject(project.id, { name, icon: project.icon })); return 'Projeto renomeado.'; });
  };
  const pickIcon = (icon: string) => {
    const target = picker;
    setPicker(null);
    if (!target?.id) { setNewIcon(icon); return; }
    const project = projects.find((item) => item.id === target.id);
    if (project && icon !== project.icon) void run(project.id, async () => { replace(await updateProject(project.id, { name: project.name, icon })); return 'Ícone atualizado.'; });
  };
  const remove = (project: ScriptProject) => {
    const count = counts.get(project.id) ?? 0;
    if (!window.confirm(`Excluir o projeto “${project.name}”?${count ? ` ${count} roteiro(s) ficarão sem projeto (nenhum roteiro é apagado).` : ''}`)) return;
    void run(project.id, async () => {
      await deleteProject(project.id);
      setProjects((current) => current.filter((item) => item.id !== project.id));
      onUnlinked(project.id);
      return 'Projeto excluído.';
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/50">Projetos identificam o tipo de conteúdo de cada roteiro (Aranha Responde, vídeos temáticos, séries, respostas de áudio…). Escolha o projeto no editor do roteiro.</p>
      <form onSubmit={add} className="flex gap-2 rounded-2xl border border-white/10 bg-[#0D1527] p-3">
        <button type="button" onClick={() => setPicker({ id: null, icon: newIcon })} aria-label="Escolher ícone do novo projeto" title="Escolher ícone" className={iconButton}><ProjectIcon icon={newIcon} className="h-5 w-5" /></button>
        <input value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={PROJECT_NAME_MAX} placeholder="Novo projeto (ex.: Série Bastidores)" aria-label="Nome do novo projeto" className={field} />
        <button type="submit" disabled={!newName.trim() || busy !== null} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40">{busy === 'new' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}<span className="hidden sm:inline">Adicionar</span></button>
      </form>
      {message && <p role={message.ok ? 'status' : 'alert'} className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${message.ok ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200' : 'border-red-500/25 bg-red-500/10 text-red-200'}`}>{message.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}{message.text}</p>}
      <ul className="space-y-2">
        {projects.map((project) => {
          const count = counts.get(project.id) ?? 0;
          const fixed = project.id === CAIXINHA_PROJECT_ID;
          return (
            <li key={project.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-[#0D1527] p-3 sm:flex-nowrap">
              <button type="button" onClick={() => setPicker({ id: project.id, icon: project.icon })} disabled={busy !== null} aria-label={`Trocar ícone de ${project.name}`} title="Trocar ícone" className={iconButton}><ProjectIcon icon={project.icon} className="h-5 w-5" /></button>
              <input value={names[project.id] ?? project.name} onChange={(event) => setNames((current) => ({ ...current, [project.id]: event.target.value }))}
                onBlur={() => rename(project)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }}
                maxLength={PROJECT_NAME_MAX} disabled={busy !== null} aria-label={`Nome do projeto ${project.name}`} className={`${field} min-w-0 flex-1 basis-40 font-semibold`} />
              <div className="flex w-full items-center justify-between gap-1 sm:w-auto">
                <button type="button" onClick={() => onShowScripts(project.id)} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-blue-200 hover:bg-blue-500/10">{count} {count === 1 ? 'roteiro' : 'roteiros'}<ArrowRight className="h-3.5 w-3.5" /></button>
                {fixed
                  ? <span title="Usado pela Caixinha de Perguntas: pode renomear e trocar o ícone, mas não excluir" className="inline-flex min-h-11 items-center gap-1 px-2 text-[11px] text-white/40"><Lock className="h-3.5 w-3.5" />Caixinha</span>
                  : <button type="button" onClick={() => remove(project)} disabled={busy !== null} aria-label={`Excluir projeto ${project.name}`} title="Excluir projeto" className="flex h-11 w-11 items-center justify-center rounded-lg text-red-200/60 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-40">{busy === project.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button>}
              </div>
            </li>
          );
        })}
      </ul>
      {picker && <IconPicker value={picker.icon} onPick={pickIcon} onClose={() => setPicker(null)} />}
    </div>
  );
};
