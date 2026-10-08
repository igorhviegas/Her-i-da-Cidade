import React from 'react';
import { Loader2, Save, Video, X } from 'lucide-react';
import type { ContentScript } from '../../../types';
import { formatDate } from './scriptEditorHelpers';

interface ScriptEditorHeaderProps {
  script: ContentScript | null;
  saving: boolean;
  onClose: () => void;
}

export const ScriptEditorHeader: React.FC<ScriptEditorHeaderProps> = ({ script, saving, onClose }) => (
  <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
    <div><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-blue-300">Biblioteca permanente</p><h2 id="script-editor-title" className="mt-1 text-lg font-bold text-white">{script ? 'Editar roteiro' : 'Novo roteiro'}</h2>{script && <p className="mt-1 text-[11px] text-white/40">Criado em {formatDate(script.createdAt)} · Atualizado em {formatDate(script.updatedAt)}</p>}</div>
    <button type="button" onClick={onClose} disabled={saving} aria-label="Fechar editor" className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-40"><X className="h-5 w-5" /></button>
  </header>
);

interface ScriptEditorFooterProps {
  saving: boolean;
  sendingToProduction: boolean;
  showSendToRecording: boolean;
  onClose: () => void;
  onSendToRecording: () => void;
}

export const ScriptEditorFooter: React.FC<ScriptEditorFooterProps> = ({ saving, sendingToProduction, showSendToRecording, onClose, onSendToRecording }) => (
  <footer className="flex flex-col-reverse gap-2 border-t border-white/10 bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
    <div className="flex flex-col gap-2 sm:flex-row">
      {showSendToRecording && <button type="button" onClick={onSendToRecording} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-400/25 bg-blue-500/10 px-4 py-2.5 text-sm font-bold text-blue-100 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50">{sendingToProduction ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}{sendingToProduction ? 'Enviando…' : 'Enviar para produção'}</button>}
      <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/65 hover:bg-white/5 disabled:opacity-40">Cancelar</button>
    </div>
    <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Salvando…' : 'Salvar roteiro'}</button>
  </footer>
);
