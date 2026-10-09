import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { newId } from '../../../services/agentContent.js';
import { KART_VIDEO_KINDS, youtubeId, type KartVideoKind } from '../../../services/kartVideos.js';
import { deleteKartVideo, saveKartVideo, useKartVideos, type KartVideo } from '../../../services/kartService';
import { card, iconBtn, input, Loading, type Run } from './agentShared';

const KINDS = Object.keys(KART_VIDEO_KINDS) as KartVideoKind[];

export const KartVideosTab: React.FC<{ run: Run }> = ({ run }) => {
  const videos = useKartVideos();
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [kind, setKind] = useState<KartVideoKind>('tip');
  if (videos === null) return <Loading />;

  const id = youtubeId(link);
  const sorted = [...videos].sort((a, b) => a.order - b.order);
  const nextOrder = sorted.length ? sorted[sorted.length - 1].order + 1 : 1;

  const add = async () => {
    if (!id || !title.trim()) return;
    if (await run(() => saveKartVideo({ id: newId(), title, youtubeId: id, kind, order: nextOrder, active: true }), 'Vídeo adicionado.')) { setTitle(''); setLink(''); }
  };
  // Troca a ordem com o vizinho dentro da mesma categoria.
  const move = (video: KartVideo, delta: -1 | 1) => {
    const group = sorted.filter((v) => v.kind === video.kind);
    const other = group[group.indexOf(video) + delta];
    if (other) run(() => Promise.all([saveKartVideo({ ...video, order: other.order }), saveKartVideo({ ...other, order: video.order })]));
  };

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); add(); }} className={`${card} space-y-3 p-4`}>
        <p className="font-bold text-white">Adicionar vídeo do YouTube</p>
        <input aria-label="Título" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (ex.: Como fazer a curva 3)" className={input} />
        <input aria-label="Link do YouTube" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Cole o link do YouTube" className={input} />
        {link.trim() && !id && <p className="text-sm text-red-300">Não reconheci esse link como um vídeo do YouTube.</p>}
        {id && <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" className="h-24 rounded-lg" />}
        <div className="flex flex-wrap items-center gap-2">
          {KINDS.map((k) => <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k} className={`rounded-xl px-4 py-2 text-sm font-semibold ${kind === k ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60'}`}>{KART_VIDEO_KINDS[k]}</button>)}
          <button type="submit" disabled={!id || !title.trim()} className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-40"><Plus className="h-4 w-4" />Adicionar</button>
        </div>
      </form>

      {KINDS.map((k) => {
        const group = sorted.filter((v) => v.kind === k);
        return (
          <section key={k} className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-widest text-white/50">{KART_VIDEO_KINDS[k]} ({group.length})</h2>
            {group.length === 0 && <p className="px-1 text-sm text-white/40">Nenhum vídeo.</p>}
            {group.map((v, i) => (
              <div key={v.id} className={`${card} flex items-center gap-3 p-2.5 ${v.active === false ? 'opacity-50' : ''}`}>
                <img src={`https://i.ytimg.com/vi/${v.youtubeId}/default.jpg`} alt="" className="h-12 w-16 shrink-0 rounded object-cover" />
                <input aria-label="Título do vídeo" defaultValue={v.title} onBlur={(e) => { const t = e.target.value.trim(); if (t && t !== v.title) run(() => saveKartVideo({ ...v, title: t })); }} className={`${input} min-w-0 flex-1`} />
                <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => move(v, -1)} className={iconBtn}><ArrowUp className="h-4 w-4" /></button>
                <button type="button" aria-label="Descer" disabled={i === group.length - 1} onClick={() => move(v, 1)} className={iconBtn}><ArrowDown className="h-4 w-4" /></button>
                <button type="button" aria-label={v.active === false ? 'Mostrar no site' : 'Ocultar do site'} onClick={() => run(() => saveKartVideo({ ...v, active: v.active === false }))} className={iconBtn}>{v.active === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                <button type="button" aria-label="Excluir vídeo" onClick={() => { if (window.confirm(`Excluir "${v.title}"?`)) run(() => deleteKartVideo(v.id), 'Vídeo excluído.'); }} className={`${iconBtn} hover:text-red-300`}><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
};
