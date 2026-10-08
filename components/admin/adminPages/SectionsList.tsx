import React from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Trash2 } from 'lucide-react';
import type { HomeSection } from '../../../types/homeContent';

function dateValue(value: HomeSection['startAt']): number | null {
  if (!value) return null;
  return value instanceof Date ? value.getTime() : value.toMillis();
}

function statusLabel(section: HomeSection, now: number): string {
  if (!section.active) return 'Inativa';
  const start = dateValue(section.startAt);
  const end = dateValue(section.endAt);
  if (start !== null && now < start) return 'Agendada';
  if (end !== null && now > end) return 'Encerrada';
  return 'Ativa';
}

interface SectionActions {
  onMove: (index: number, offset: -1 | 1) => void;
  onToggle: (section: HomeSection) => void;
  onEdit: (section: HomeSection) => void;
  onDelete: (section: HomeSection) => void;
}

interface SectionRowProps extends SectionActions {
  section: HomeSection;
  index: number;
  count: number;
  now: number;
  movingId: string | null;
}

const SectionRow: React.FC<SectionRowProps> = ({ section, index, count, now, movingId, onMove, onToggle, onEdit, onDelete }) => {
  const status = statusLabel(section, now);
  const locked = section.sectionType === 'testimonials';
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#080F1D] p-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2 sm:flex-col">
        <button type="button" aria-label="Mover seção para cima" disabled={index === 0 || movingId !== null} onClick={() => onMove(index, -1)} className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
        <button type="button" aria-label="Mover seção para baixo" disabled={index === count - 1 || movingId !== null} onClick={() => onMove(index, 1)} className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-white">{section.internalName}</h3>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status === 'Ativa' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : status === 'Agendada' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-white/10 bg-white/5 text-white/50'}`}>{status}</span>
        </div>
        <p className="mt-1 truncate text-xs text-white/45">{section.title.replace(/\s+/g, ' ')} · {section.sectionType} · ordem {section.order + 1}</p>
        {locked && <p className="mt-1 text-xs text-white/40">Conteúdo automático; apenas ordem e visibilidade são administráveis.</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onToggle(section)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-semibold text-white/70 hover:bg-white/5">
          {section.active ? <><EyeOff className="h-4 w-4" /> Desativar</> : <><Eye className="h-4 w-4" /> Ativar</>}
        </button>
        {!locked && <button type="button" onClick={() => onEdit(section)} className="min-h-10 rounded-lg bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/15">Editar</button>}
        <button type="button" onClick={() => onDelete(section)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-500/20 px-3 text-xs font-semibold text-red-300 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /> Excluir</button>
      </div>
    </article>
  );
};

interface SectionsListProps extends SectionActions {
  sections: HomeSection[];
  loading: boolean;
  now: number;
  movingId: string | null;
}

export const SectionsList: React.FC<SectionsListProps> = ({ sections, loading, now, movingId, onMove, onToggle, onEdit, onDelete }) => (
  <section className="rounded-2xl border border-white/10 bg-[#0D1527] p-4 shadow-xl sm:p-6">
    <div className="mb-5 flex items-center justify-between gap-3">
      <div><h2 className="text-lg font-bold text-white">Seções da página inicial</h2><p className="mt-1 text-xs text-white/50">Use os controles para ordenar. Datas e status determinam a publicação.</p></div>
      {loading && <Loader2 className="h-5 w-5 animate-spin text-blue-400" />}
    </div>
    <div className="space-y-3">
      {sections.map((section, index) => (
        <SectionRow key={section.id} section={section} index={index} count={sections.length} now={now} movingId={movingId} onMove={onMove} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
      ))}
      {!loading && sections.length === 0 && <p className="rounded-xl border border-white/10 p-6 text-sm text-white/50">Nenhuma seção cadastrada. Crie uma nova seção para publicar conteúdo na home.</p>}
    </div>
  </section>
);
