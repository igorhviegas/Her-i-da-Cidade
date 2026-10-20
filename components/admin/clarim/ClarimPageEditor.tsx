import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Download, ImagePlus, Loader2, Save, Share2, Trash2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import {
  CLASSIFIEDS_MAX, compactNumber, consentIssues, eventsHeadline, EVENTS_MAX_PHOTOS, pageFileName, pageHash, pageIssues, pageStatus, periodLabel,
  pickAdFormat, REVOKED_ISSUE, revokedSources, serviceFormats, TEXT_LIMITS, templateLabel, type AdFormat, type AdSlot,
} from '../../../services/clarim.js';
import { approvePage, deletePhotos, loadEventOrders, savePage, uploadPhoto, type ClarimEdition, type StoredPage } from '../../../services/clarimService';
import { cardClass, ErrorNote, ghostButton, inputClass, labelClass, primaryButton, WarningNote } from '../missionsUi';
import { renderPage, toPng } from './clarimCanvas';
import { buildRenderData, rememberPhoto, slotFor, weekEvents, weekVideos, type ClarimSources } from './useClarimData';

const errorText = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);
const FORMAT_LABEL: Record<AdFormat, string> = { square: 'Quadrada', story: 'Vertical', wide: 'Horizontal' };

interface Props {
  edition: ClarimEdition;
  page: StoredPage;
  pages: StoredPage[];
  sources: ClarimSources | null;
  onBack: () => void;
  onSaved: (page: StoredPage) => void;
}

const TextField: React.FC<{ id: string; label: string; value: string; max: number; onChange: (v: string) => void; area?: boolean; hint?: string }> = ({ id, label, value, max, onChange, area, hint }) => (
  <label className={labelClass} htmlFor={id}>
    <span className="flex justify-between gap-2"><span>{label}</span><span className="font-normal text-white/40">{value.length}/{max}</span></span>
    {area
      ? <textarea id={id} className={`${inputClass} min-h-24`} maxLength={max} value={value} onChange={(e) => onChange(e.target.value)} />
      : <input id={id} className={inputClass} maxLength={max} value={value} onChange={(e) => onChange(e.target.value)} />}
    {hint && <span className="mt-1 block font-normal text-white/40">{hint}</span>}
  </label>
);

const Choice: React.FC<{ value: string; options: Array<[string, string]>; onChange: (v: string) => void; label: string }> = ({ value, options, onChange, label }) => (
  <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
    {options.map(([id, text]) => (
      <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${value === id ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}>{text}</button>
    ))}
  </div>
);

/** Editor de uma página: campos à esquerda, a arte final à direita (a prévia é o próprio PNG). */
export const ClarimPageEditor: React.FC<Props> = ({ edition, page, pages, sources, onBack, onSaved }) => {
  const { user } = useAuth();
  const period = useMemo(() => ({ start: edition.periodStart, end: edition.periodEnd }), [edition.periodStart, edition.periodEnd]);
  const [draft, setDraft] = useState<StoredPage>(page);
  const [saved, setSaved] = useState<StoredPage>(page);
  const [renderIssues, setRenderIssues] = useState<string[]>([]);
  const [rendering, setRendering] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const preview = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const latest = useRef({ draft, saved });
  latest.current = { draft, saved };

  const dirty = pageHash(draft) !== pageHash(saved);
  const issues = [...pageIssues(draft), ...(sources ? consentIssues(draft, sources.orders, period) : []), ...renderIssues];
  const status = pageStatus(draft, issues);
  const pageNumber = pages.findIndex((p) => p.id === page.id) + 1;
  const f = draft.fields;
  const setField = (key: string, value: string) => setDraft((d) => ({ ...d, fields: { ...d.fields, [key]: value } }));

  // desenho (com atraso curto para não redesenhar a cada tecla)
  useEffect(() => {
    if (!sources) return;
    let cancelled = false;
    setRendering(true);
    const timer = window.setTimeout(async () => {
      try {
        const data = await buildRenderData(draft, pages, sources, edition);
        const out = await renderPage(draft, data, periodLabel(period));
        if (cancelled) return;
        canvas.current = out.canvas;
        out.canvas.className = 'h-auto w-full';
        out.canvas.setAttribute('role', 'img');
        out.canvas.setAttribute('aria-label', `Prévia da página ${pageNumber}: ${templateLabel(draft.template)}`);
        preview.current?.replaceChildren(out.canvas);
        setRenderIssues(out.issues);
        setError('');
      } catch (e) {
        if (!cancelled) setError(errorText(e, 'Não foi possível desenhar a página.'));
      } finally {
        if (!cancelled) setRendering(false);
      }
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [draft, sources, pages, edition, period, pageNumber]);

  const persist = async (next: StoredPage) => {
    await savePage(edition.id, next);
    setSaved(next);
    onSaved(next);
  };

  const run = async (key: string, action: () => Promise<void>, fallback: string) => {
    setBusy(key);
    setError('');
    try { await action(); } catch (e) { setError(errorText(e, fallback)); } finally { setBusy(null); }
  };

  // festa desmarcada: a foto dela sai da página e do Storage ao salvar (nada de foto de criança sem uso guardada)
  const save = () => run('save', async () => {
    const orphans = draft.template === 'events' ? Object.keys(draft.photos).filter((key) => !draft.sources.includes(key)) : [];
    const photos = Object.fromEntries(Object.entries(draft.photos).filter(([key]) => !orphans.includes(key)));
    const next = { ...draft, photos };
    await persist(next);
    setDraft(next);
    if (orphans.length) await deletePhotos(orphans.map((key) => draft.photos[key].path));
  }, 'Não foi possível salvar.');

  // fotos: gravadas na hora (sem arquivo órfão no Storage); a anterior é apagada depois de salvar
  const setPhoto = (slot: string, file: File | null) => run(`photo-${slot}`, async () => {
    const old = latest.current.saved.photos[slot]?.path;
    const path = file ? await uploadPhoto(edition.id, page.id, file) : null;
    if (path && file) rememberPhoto(path, file);
    // estado mais recente (depois do envio), para um envio não apagar a foto de outro
    const withPhoto = <T extends StoredPage>(p: T): T => {
      const { [slot]: _removed, ...photos } = p.photos;
      return { ...p, photos: path ? { ...photos, [slot]: { path, x: 50, y: 50, zoom: 1 } } : photos };
    };
    setDraft((d) => withPhoto(d));
    await persist(withPhoto(latest.current.saved));
    if (old && old !== path) await deletePhotos([old]);
  }, 'Não foi possível enviar a foto.');

  const setCrop = (slot: string, key: 'x' | 'y' | 'zoom', value: number) =>
    setDraft((d) => ({ ...d, photos: { ...d.photos, [slot]: { ...d.photos[slot], [key]: value } } }));

  const approve = () => run('approve', async () => {
    if (!user) throw new Error('Faça login de novo para aprovar.');
    if (draft.template === 'events') {
      // confere de novo no banco na hora de aprovar (a lista da tela pode estar desatualizada)
      if (revokedSources(draft.sources, await loadEventOrders(), period).length) throw new Error(REVOKED_ISSUE);
    }
    const next = await approvePage(edition.id, draft, user.uid);
    setDraft(next);
    setSaved(next);
    onSaved(next);
  }, 'Não foi possível aprovar.');

  const download = () => run('download', async () => {
    if (!canvas.current) return;
    const blob = await toPng(canvas.current);
    const file = new File([blob], pageFileName(edition.number, pageNumber, draft.template), { type: 'image/png' });
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ files: [file], title: file.name }); } catch { /* o usuário fechou a janela de compartilhar */ }
      return;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'Não foi possível baixar a página.');

  // ------------------------------------------------------------ blocos do formulário

  // funções de renderização (não componentes): assim os campos não são recriados a cada alteração
  const photoSlot = (slot: string, label: string) => {
    const ref = draft.photos[slot];
    const inputId = `clarim-photo-${slot}`;
    return (
      <div key={slot} className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-white/70">{label}</span>
          <span className="flex gap-1.5">
            <label htmlFor={inputId} className={`${ghostButton} cursor-pointer`}>{busy === `photo-${slot}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}{ref ? 'Trocar' : 'Enviar foto'}</label>
            <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={!!busy}
              onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) setPhoto(slot, file); }} />
            {ref && <button type="button" className={ghostButton} aria-label={`Remover ${label}`} disabled={!!busy} onClick={() => setPhoto(slot, null)}><Trash2 className="h-4 w-4" /></button>}
          </span>
        </div>
        {ref && (
          <div className="grid gap-2 sm:grid-cols-3">
            {([['x', 'Horizontal', 0, 100, 1], ['y', 'Vertical', 0, 100, 1], ['zoom', 'Zoom', 1, 3, 0.05]] as const).map(([key, text, min, max, step]) => (
              <label key={key} className="text-[11px] font-semibold text-white/55" htmlFor={`${inputId}-${key}`}>{text}
                <input id={`${inputId}-${key}`} type="range" min={min} max={max} step={step} value={ref[key]} onChange={(e) => setCrop(slot, key, Number(e.target.value))} className="mt-1 w-full accent-blue-500" />
              </label>
            ))}
          </div>
        )}
      </div>
    );
  };

  const adSlotField = (slot: AdSlot) => {
    const current = draft.ads.slot ?? null;
    const options = (sources?.services ?? []).filter((s) => pickAdFormat(slot, serviceFormats(s)));
    const service = options.find((s) => s.id === current?.serviceId);
    const formats = service ? slot.accepts.filter((fm) => serviceFormats(service).includes(fm)) : [];
    const setAd = (serviceId: string, preferred?: AdFormat | null) => {
      const s = options.find((o) => o.id === serviceId);
      setDraft((d) => ({ ...d, ads: { ...d.ads, slot: s ? { serviceId, format: pickAdFormat(slot, serviceFormats(s), preferred) } : null } }));
    };
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <label className={labelClass} htmlFor="clarim-ad">Anúncio
          <select id="clarim-ad" className={inputClass} value={current?.serviceId ?? ''} onChange={(e) => setAd(e.target.value)}>
            <option value="">Sem anúncio</option>
            {options.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </label>
        {formats.length > 1 && (
          <label className={labelClass} htmlFor="clarim-ad-format">Arte
            <select id="clarim-ad-format" className={inputClass} value={current?.format ?? ''} onChange={(e) => setAd(current?.serviceId ?? '', e.target.value as AdFormat)}>
              {formats.map((fm) => <option key={fm} value={fm}>{FORMAT_LABEL[fm]}</option>)}
            </select>
          </label>
        )}
        {!options.length && <p className="text-[11px] text-white/40 sm:col-span-2">Nenhum serviço tem arte neste formato. Cadastre os fundos em Serviços → Artes do serviço.</p>}
      </div>
    );
  };

  const slot = slotFor(draft);
  const kicker = draft.template !== 'cover' && <TextField id="clarim-kicker" label="Seção" value={f.kicker ?? ''} max={TEXT_LIMITS.kicker} onChange={(v) => setField('kicker', v)} />;
  const headline = (hint?: string) => <TextField id="clarim-headline" label="Manchete" value={f.headline ?? ''} max={TEXT_LIMITS.headline} onChange={(v) => setField('headline', v)} hint={hint} />;

  let form: React.ReactNode = null;
  if (draft.template === 'cover') {
    const top = sources ? weekVideos(sources, period)[0] : undefined;
    const others = pages.map((p, i) => ({ p, n: i + 1 })).filter(({ p }) => p.id !== page.id && p.fields.headline);
    form = (
      <>
        <Choice label="Foto da capa" value={f.variant} options={[['video', 'Vídeo da semana'], ['photo', 'Foto escolhida']]} onChange={(v) => setField('variant', v)} />
        {f.variant === 'video' && <p className="text-xs text-white/50">{top ? `Vídeo mais visto: ${compactNumber(top.gain)} visualizações ganhas na semana.` : 'Sem vídeos com visualizações registradas na semana.'}</p>}
        {f.variant === 'photo' && photoSlot('main', 'Foto da capa (com autorização de imagem)')}
        {headline()}
        {top && f.variant === 'video' && !f.headline && <button type="button" className={ghostButton} onClick={() => setField('headline', `${compactNumber(top.gain)} olhos na teia`)}>Usar sugestão: “{compactNumber(top.gain)} olhos na teia”</button>}
        <TextField id="clarim-caption" label={f.variant === 'photo' ? 'Crédito ou legenda da foto' : 'Legenda (vazia = data do vídeo)'} value={f.caption ?? ''} max={TEXT_LIMITS.caption} onChange={(v) => setField('caption', v)} />
        <div className="grid gap-3 sm:grid-cols-[1fr_90px]">
          <TextField id="clarim-t1" label="Chamada 1" value={f.teaser1 ?? ''} max={TEXT_LIMITS.teaser} onChange={(v) => setField('teaser1', v)} />
          <TextField id="clarim-t1p" label="Página" value={f.teaser1Page ?? ''} max={2} onChange={(v) => setField('teaser1Page', v.replace(/\D/g, ''))} />
          <TextField id="clarim-t2" label="Chamada 2" value={f.teaser2 ?? ''} max={TEXT_LIMITS.teaser} onChange={(v) => setField('teaser2', v)} />
          <TextField id="clarim-t2p" label="Página" value={f.teaser2Page ?? ''} max={2} onChange={(v) => setField('teaser2Page', v.replace(/\D/g, ''))} />
        </div>
        {others.length > 0 && (
          <button type="button" className={ghostButton} onClick={() => setDraft((d) => ({ ...d, fields: { ...d.fields,
            teaser1: others[0]?.p.fields.headline.slice(0, TEXT_LIMITS.teaser) ?? '', teaser1Page: String(others[0]?.n ?? ''),
            teaser2: others[1]?.p.fields.headline.slice(0, TEXT_LIMITS.teaser) ?? '', teaser2Page: String(others[1]?.n ?? '') } }))}>
            Preencher chamadas com as manchetes das outras páginas
          </button>
        )}
      </>
    );
  }
  if (draft.template === 'events') {
    const candidates = weekEvents(sources, period);
    const toggle = (id: string) => setDraft((d) => ({ ...d, sources: d.sources.includes(id) ? d.sources.filter((s) => s !== id) : [...d.sources, id].slice(0, EVENTS_MAX_PHOTOS) }));
    form = (
      <>
        {kicker}
        <fieldset className="space-y-2">
          <legend className={labelClass}>Festas da semana (até {EVENTS_MAX_PHOTOS})</legend>
          {!candidates.length && <p className="text-xs text-white/50">Nenhuma festa presencial no período.</p>}
          {candidates.map((c) => (
            <label key={c.orderId} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${c.eligible ? 'text-white' : 'text-white/40'}`}>
              <input type="checkbox" disabled={!draft.sources.includes(c.orderId) && (!c.eligible || draft.sources.length >= EVENTS_MAX_PHOTOS)} checked={draft.sources.includes(c.orderId)} onChange={() => toggle(c.orderId)} className="accent-blue-500" />
              {c.weekday}, {c.day.split('-').reverse().slice(0, 2).join('/')}
              {!c.eligible && <span className="text-[11px] text-amber-300">· {c.reason}</span>}
            </label>
          ))}
          <p className="text-[11px] text-white/40">Só festas com autorização de imagem no pedido. O nome da criança não aparece na arte.</p>
        </fieldset>
        {draft.sources.map((id) => photoSlot(id, `Foto de ${candidates.find((c) => c.orderId === id)?.weekday.toLowerCase() ?? 'festa'}`))}
        {headline()}
        {draft.sources.length > 0 && f.headline !== eventsHeadline(draft.sources.length) && <button type="button" className={ghostButton} onClick={() => setField('headline', eventsHeadline(draft.sources.length))}>Usar: “{eventsHeadline(draft.sources.length)}”</button>}
        <TextField id="clarim-body" label="Texto" area value={f.body ?? ''} max={TEXT_LIMITS.body} onChange={(v) => setField('body', v)} hint="Conte só o que aconteceu de fato." />
        <TextField id="clarim-credit" label="Crédito das fotos" value={f.credit ?? ''} max={TEXT_LIMITS.caption} onChange={(v) => setField('credit', v)} />
      </>
    );
  }
  if (draft.template === 'performance') {
    const rows = sources ? weekVideos(sources, period).slice(0, 3) : [];
    form = (
      <>
        {kicker}
        {headline()}
        <p className="text-xs text-white/50">Os números vêm do Instagram (visualizações ganhas de segunda a domingo) e não podem ser editados.</p>
        <ol className="list-decimal space-y-1 pl-5 text-xs text-white/70">{rows.map((r) => <li key={r.post.id}>{compactNumber(r.gain)} · {(r.post.caption || '').split('\n')[0].slice(0, 60)}{r.partial ? ' (parcial)' : ''}</li>)}</ol>
      </>
    );
  }
  if (draft.template === 'news') {
    form = (
      <>
        <Choice label="Tipo" value={f.variant} options={[['photo', 'Com foto'], ['notice', 'Aviso (sem foto)']]} onChange={(v) => setField('variant', v)} />
        {kicker}
        {headline()}
        {f.variant === 'photo' && <TextField id="clarim-deck" label="Linha fina" value={f.deck ?? ''} max={TEXT_LIMITS.deck} onChange={(v) => setField('deck', v)} />}
        {f.variant === 'photo' && photoSlot('main', 'Foto da notícia')}
        <TextField id="clarim-body" label="Texto" area value={f.body ?? ''} max={TEXT_LIMITS.body} onChange={(v) => setField('body', v)} />
        {f.variant === 'photo' && <TextField id="clarim-credit" label="Crédito da foto" value={f.credit ?? ''} max={TEXT_LIMITS.caption} onChange={(v) => setField('credit', v)} />}
      </>
    );
  }
  if (draft.template === 'classifieds') {
    const services = sources?.services ?? [];
    const toggle = (id: string) => setDraft((d) => {
      if (d.services.includes(id)) { const { [id]: _removed, ...ads } = d.ads; return { ...d, services: d.services.filter((s) => s !== id), ads }; }
      if (d.services.length >= CLASSIFIEDS_MAX) return d;
      const fmts = serviceFormats(services.find((s) => s.id === id));
      const hasWide = d.services.some((sid) => d.ads[sid]?.format === 'wide');
      const format: AdFormat | null = fmts.includes('wide') && !hasWide ? 'wide' : fmts.includes('square') ? 'square' : null;
      return { ...d, services: [...d.services, id], ads: { ...d.ads, [id]: format ? { serviceId: id, format } : null } };
    });
    form = (
      <>
        {kicker}
        <fieldset className="space-y-2">
          <legend className={labelClass}>Serviços (4 a 6)</legend>
          {services.map((s) => {
            const on = draft.services.includes(s.id);
            const fmts = serviceFormats(s).filter((fm) => fm !== 'story');
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-2 text-sm text-white">
                <label className="flex items-center gap-2"><input type="checkbox" className="accent-blue-500" checked={on} disabled={!on && draft.services.length >= CLASSIFIEDS_MAX} onChange={() => toggle(s.id)} />{s.title}</label>
                {on && (
                  <select aria-label={`Formato de ${s.title}`} className="rounded-lg border border-white/10 bg-[#070B14] px-2 py-1 text-xs text-white" value={draft.ads[s.id]?.format ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, ads: { ...d.ads, [s.id]: e.target.value ? { serviceId: s.id, format: e.target.value as AdFormat } : null } }))}>
                    <option value="">Só texto</option>
                    {fmts.map((fm) => <option key={fm} value={fm}>Arte {FORMAT_LABEL[fm].toLowerCase()}</option>)}
                  </select>
                )}
              </div>
            );
          })}
          <p className="text-[11px] text-white/40">Ordem na página = ordem em que você marca. Nome, preço e descrição vêm do cadastro do serviço.</p>
        </fieldset>
      </>
    );
  }

  const statusChip = { approved: 'bg-emerald-500/15 text-emerald-200', pending: 'bg-amber-500/15 text-amber-200', review: 'bg-blue-500/15 text-blue-200' }[status];
  const canApprove = !dirty && status === 'review' && !rendering && !busy && !!sources;
  const canDownload = status === 'approved' && !dirty && !rendering && !busy;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={ghostButton} onClick={() => (dirty && !leaving ? setLeaving(true) : onBack())}><ArrowLeft className="h-4 w-4" />{leaving ? 'Sair sem salvar' : 'Páginas da edição'}</button>
        {leaving && <span className="text-xs text-amber-200">Há alterações não salvas. Clique de novo para descartar ou em Salvar.</span>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold tracking-tight text-white">Página {pageNumber} · {templateLabel(draft.template)}</h2>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusChip}`}>
          {status === 'approved' ? 'Aprovada' : dirty ? 'Alterações não salvas' : status === 'pending' ? 'Faltam itens' : 'Pronta para revisar'}
        </span>
      </div>
      <ErrorNote message={error || null} />
      {!sources && <p className="flex items-center gap-2 text-sm text-white/50"><Loader2 className="h-4 w-4 animate-spin" />Carregando dados da semana…</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <section className={`${cardClass} min-w-0 space-y-4`} aria-label="Conteúdo da página">
          {form}
          {slot && draft.template !== 'classifieds' && adSlotField(slot)}
          <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
            <button type="button" className={primaryButton} disabled={!dirty || !!busy} onClick={save}>{busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Salvar</button>
            <button type="button" className={primaryButton} disabled={!canApprove} onClick={approve}>{busy === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Aprovar arte</button>
            <button type="button" className={primaryButton} disabled={!canDownload} onClick={download}>
              {busy === 'download' ? <Loader2 className="h-4 w-4 animate-spin" /> : matchMedia('(pointer: coarse)').matches ? <Share2 className="h-4 w-4" /> : <Download className="h-4 w-4" />}Baixar PNG
            </button>
          </div>
          {dirty && <p className="text-[11px] text-white/40">Salve para aprovar. Mudar uma página aprovada pede uma nova aprovação.</p>}
          {status === 'approved' && draft.approval?.at && <p className="text-[11px] text-emerald-300">Aprovada em {draft.approval.at.toLocaleString('pt-BR')}.</p>}
          {issues.length > 0 && <WarningNote message={issues.join(' ')} />}
        </section>

        <section className="min-w-0 space-y-2" aria-label="Prévia">
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40 shadow-xl" style={{ aspectRatio: '9 / 16' }}>
            <div ref={preview} className="h-full w-full" />
            {rendering && <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[11px] text-white/80"><Loader2 className="inline h-3 w-3 animate-spin" /> desenhando</span>}
          </div>
          <p className="text-[11px] text-white/40">A prévia é o próprio arquivo de 1080 × 1920 que será baixado.</p>
        </section>
      </div>
    </div>
  );
};
