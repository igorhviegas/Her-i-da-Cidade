import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, RotateCcw, Save } from 'lucide-react';
import { buildFormConfigDoc, type FormConfig } from '../../services/eventFormConfig.js';
import { FORM_PATH } from '../../services/eventSiteForm.js';
import { TERMS_FIELDS, TERMS_TEMPLATE, parseTerms, unknownTermsFields } from '../../services/eventTerms.js';
import { getEventFormConfig, getEventFormNextNumber, saveEventFormConfig, saveEventFormNextNumber } from '../../services/siteConfigService';
import { ErrorNote, cardClass, ghostButton, inputClass, labelClass, primaryButton } from './missionsUi';

interface Draft {
  packages: { id: string; title: string; duration: string; items: string }[];
  addonPrices: { extraWeb: string; birthdayVideo: string; inviteVideo: string; extraChild: string };
  addonVideos: { extraWeb: string; birthdayVideo: string; inviteVideo: string };
  depositDays: string;
  termsText: string;
}

const toDraft = (config: FormConfig): Draft => ({
  packages: config.packages.map((p) => ({ id: p.id, title: p.title, duration: p.duration, items: p.items.join('\n') })),
  addonPrices: { extraWeb: String(config.addonPrices.extraWeb), birthdayVideo: String(config.addonPrices.birthdayVideo), inviteVideo: String(config.addonPrices.inviteVideo), extraChild: String(config.addonPrices.extraChild) },
  addonVideos: { ...config.addonVideos },
  depositDays: String(config.depositDays),
  termsText: config.termsText,
});
const num = (value: string) => Number(value.replace(',', '.'));
const lines = (value: string) => value.split('\n').map((line) => line.trim()).filter(Boolean);

/**
 * Calendário → Formulário: o que o cliente vê em /formulario-evento. Pacotes, preços dos adicionais, prazo do sinal e termos.
 * Termos são versionados: salvar um texto diferente cria a próxima versão; quem aceitou uma versão antiga continua com ela
 * no pedido. As perguntas do formulário não mudam por aqui (estão ligadas aos campos do CRM).
 */
export const EventFormSettings: React.FC = () => {
  const [config, setConfig] = useState<FormConfig | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [viewVersion, setViewVersion] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    getEventFormConfig().then((loaded) => { setConfig(loaded); setDraft(toDraft(loaded)); }, (e) => setError(e instanceof Error ? e.message : 'Não foi possível carregar.'));
  }, []);

  const termsChanged = Boolean(config && draft && draft.termsText.trim() !== config.termsText.trim());
  const unknown = useMemo(() => (draft ? unknownTermsFields(draft.termsText) : []), [draft]);
  const sectionCount = useMemo(() => (draft ? parseTerms(draft.termsText).length : 0), [draft]);
  const nextVersion = config ? Math.max(...Object.keys(config.terms).map(Number)) + 1 : 0;

  if (!config || !draft) return error ? <ErrorNote message={error} /> : <p className="flex items-center gap-2 text-sm text-white/60"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</p>;
  const set = (patch: Partial<Draft>) => { setDraft({ ...draft, ...patch }); setNotice(''); };

  const save = async () => {
    setError(''); setNotice('');
    const prices = { extraWeb: num(draft.addonPrices.extraWeb), birthdayVideo: num(draft.addonPrices.birthdayVideo), inviteVideo: num(draft.addonPrices.inviteVideo), extraChild: num(draft.addonPrices.extraChild) };
    const depositDays = Number(draft.depositDays);
    if (Object.values(prices).some((value) => !(value >= 0))) { setError('Informe preços válidos para os adicionais.'); return; }
    if (!Number.isInteger(depositDays) || depositDays < 1 || depositDays > 30) { setError('O prazo do sinal deve ser de 1 a 30 dias.'); return; }
    if (draft.packages.some((p) => !p.title.trim() || !lines(p.items).length)) { setError('Cada pacote precisa de nome e ao menos um item.'); return; }
    if (unknown.length) { setError(`Campo desconhecido nos termos: {${unknown.join('}, {')}}. Use só os campos da lista.`); return; }
    const built = buildFormConfigDoc(config, {
      packages: draft.packages.map((p) => ({ id: p.id as FormConfig['packages'][number]['id'], title: p.title.trim(), duration: p.duration.trim(), items: lines(p.items) })),
      addonPrices: prices, addonVideos: draft.addonVideos, depositDays, termsText: draft.termsText,
    });
    if (built.error) { setError(built.error); return; }
    if (built.newVersion && !window.confirm(`Salvar cria a versão ${built.newVersion} dos termos. Formulários já enviados continuam com a versão que o cliente aceitou. Confirmar?`)) return;
    setSaving(true);
    try {
      await saveEventFormConfig(built.doc);
      const fresh = await getEventFormConfig();
      setConfig(fresh); setDraft(toDraft(fresh));
      setNotice(built.newVersion ? `Salvo. Termos agora na versão ${built.newVersion}.` : 'Salvo.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-white/55">O que o cliente vê no formulário do site. As perguntas são fixas; os textos, preços, prazo e termos abaixo são seus.</p>
        <a href={FORM_PATH} target="_blank" rel="noopener noreferrer" className={ghostButton}><ExternalLink className="h-3.5 w-3.5" />Abrir formulário</a>
      </div>

      <NumberSettings />

      <section className={`${cardClass} space-y-3`} aria-label="Pacotes">
        <h3 className="text-sm font-bold text-white">Pacotes</h3>
        <div className="grid gap-3 lg:grid-cols-3">
          {draft.packages.map((p, index) => {
            const update = (patch: Partial<Draft['packages'][number]>) => set({ packages: draft.packages.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
            return (
              <div key={p.id} className="space-y-2 rounded-xl border border-white/10 p-3">
                <label className={labelClass}>Nome<input value={p.title} onChange={(e) => update({ title: e.target.value })} className={inputClass} maxLength={60} /></label>
                <label className={labelClass}>Duração<input value={p.duration} onChange={(e) => update({ duration: e.target.value })} className={inputClass} maxLength={120} /></label>
                <label className={labelClass}>Itens (um por linha)<textarea rows={7} value={p.items} onChange={(e) => update({ items: e.target.value })} className={inputClass} /></label>
              </div>
            );
          })}
        </div>
      </section>

      <section className={`${cardClass} space-y-3`} aria-label="Adicionais e prazo">
        <h3 className="text-sm font-bold text-white">Adicionais e prazo do sinal</h3>
        <div className="grid gap-3 sm:grid-cols-5">
          <label className={labelClass}>Teia extra (R$ cada)<input inputMode="decimal" value={draft.addonPrices.extraWeb} onChange={(e) => set({ addonPrices: { ...draft.addonPrices, extraWeb: e.target.value } })} className={inputClass} /></label>
          <label className={labelClass}>Vídeo de Aniversário (R$)<input inputMode="decimal" value={draft.addonPrices.birthdayVideo} onChange={(e) => set({ addonPrices: { ...draft.addonPrices, birthdayVideo: e.target.value } })} className={inputClass} /></label>
          <label className={labelClass}>Vídeo Convite (R$)<input inputMode="decimal" value={draft.addonPrices.inviteVideo} onChange={(e) => set({ addonPrices: { ...draft.addonPrices, inviteVideo: e.target.value } })} className={inputClass} /></label>
          <label className={labelClass}>Criança a mais (certificado, R$)<input inputMode="decimal" value={draft.addonPrices.extraChild} onChange={(e) => set({ addonPrices: { ...draft.addonPrices, extraChild: e.target.value } })} className={inputClass} /></label>
          <label className={labelClass}>Prazo do sinal (dias)<input inputMode="numeric" value={draft.depositDays} onChange={(e) => set({ depositDays: e.target.value })} className={inputClass} /></label>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {([['extraWeb', 'Vídeo de exemplo · Teia extra'], ['birthdayVideo', 'Vídeo de exemplo · Vídeo de Aniversário'], ['inviteVideo', 'Vídeo de exemplo · Vídeo Convite']] as const).map(([key, title]) => (
            <label key={key} className={labelClass}>{title}
              <input type="url" value={draft.addonVideos[key]} onChange={(e) => set({ addonVideos: { ...draft.addonVideos, [key]: e.target.value } })} className={inputClass} placeholder="https://youtube.com/shorts/…" />
            </label>
          ))}
        </div>
        <p className="text-[11px] text-white/45">Link do YouTube (Shorts não listado serve) ou de um arquivo .mp4. Com link, o adicional ganha o botão “Ver exemplar”, que toca o vídeo sem sair do formulário. Link inválido é ignorado ao salvar.</p>
        <p className="text-[11px] text-white/45">O prazo do sinal vale para o aviso ao cliente, para a missão de recontato e para a exclusão automática (mesmo prazo depois da missão concluída).</p>
      </section>

      <section className={`${cardClass} space-y-3`} aria-label="Termos de contratação">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white">Termos de contratação · versão {config.termsVersion}{termsChanged ? ` → ${nextVersion} ao salvar` : ''}</h3>
          <button type="button" onClick={() => set({ termsText: TERMS_TEMPLATE })} className={ghostButton}><RotateCcw className="h-3.5 w-3.5" />Texto padrão (versão 3)</button>
        </div>
        <p className="text-[11px] leading-relaxed text-white/50">
          Cada seção começa com <code className="text-white/80">## Título</code>; cada linha abaixo é um item numerado. Campos preenchidos com os dados do cliente:{' '}
          {Object.entries(TERMS_FIELDS).map(([key, desc], i) => <span key={key}>{i ? ', ' : ''}<code className="text-white/80">{`{${key}}`}</code> ({desc})</span>)}.
        </p>
        <textarea rows={18} value={draft.termsText} onChange={(e) => set({ termsText: e.target.value })} className={`${inputClass} font-mono text-xs leading-relaxed`} spellCheck />
        <p className={`text-[11px] ${unknown.length || !sectionCount ? 'text-amber-200' : 'text-white/45'}`}>
          {sectionCount} seções{unknown.length ? ` · campo desconhecido: {${unknown.join('}, {')}}` : ''}{termsChanged ? ` · salvar cria a versão ${nextVersion}; formulários já enviados continuam com a versão aceita.` : ''}
        </p>
        {Object.keys(config.terms).length > 1 && (
          <details className="rounded-xl border border-white/10 p-3 text-xs text-white/70" onToggle={(e) => { if ((e.target as HTMLDetailsElement).open && !viewVersion) setViewVersion(config.termsVersion); }}>
            <summary className="cursor-pointer font-semibold text-white/80">Versões anteriores ({Object.keys(config.terms).length})</summary>
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.keys(config.terms).sort((a, b) => Number(b) - Number(a)).map((version) => (
                <button key={version} type="button" onClick={() => setViewVersion(version)} aria-pressed={viewVersion === version} className={`${ghostButton} ${viewVersion === version ? 'bg-blue-600/30 text-white' : ''}`}>v{version}{version === config.termsVersion ? ' (atual)' : ''}</button>
              ))}
            </div>
            {viewVersion && <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-[#070B14] p-3 font-mono text-[11px]">{config.terms[viewVersion]}</pre>}
          </details>
        )}
      </section>

      {error && <ErrorNote message={error} />}
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={saving} className={primaryButton}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Salvar formulário</button>
        {notice && <span className="text-xs font-semibold text-emerald-300">{notice}</span>}
      </div>
    </div>
  );
};

/** Próximo número do formulário. Apagar um pedido não devolve o número; aqui o dono corrige a sequência (ex.: depois de testes). */
const NumberSettings: React.FC = () => {
  const [saved, setSaved] = useState<number | null | undefined>(undefined);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { getEventFormNextNumber().then((next) => { setSaved(next); setValue(next ? String(next) : ''); }, () => setSaved(null)); }, []);
  const save = async () => {
    const next = Number(value);
    if (!Number.isInteger(next) || next < 1) { setMessage('Informe um número inteiro.'); return; }
    if (saved && next < saved && !window.confirm(`Voltar a numeração de A${saved} para A${next}? Só faça isso se os números entre eles foram apagados (testes): um número já usado em pedido real ficaria repetido.`)) return;
    setBusy(true); setMessage('');
    try { await saveEventFormNextNumber(next); setSaved(next); setMessage(`Salvo. O próximo formulário será A${next}.`); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    setBusy(false);
  };
  return (
    <section className={`${cardClass} space-y-3`} aria-label="Numeração">
      <h3 className="text-sm font-bold text-white">Numeração</h3>
      <div className="flex flex-wrap items-end gap-2">
        <label className={`${labelClass} w-48`}>Próximo formulário (A…)
          <input inputMode="numeric" value={value} onChange={(e) => { setValue(e.target.value.replace(/\D/g, '')); setMessage(''); }} className={inputClass} placeholder={saved === null ? 'sequência automática' : ''} disabled={saved === undefined} />
        </label>
        <button type="button" onClick={save} disabled={busy || saved === undefined} className={ghostButton}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Salvar número</button>
      </div>
      <p className="text-[11px] text-white/45">Cada envio usa este número e avança 1. Apagar um pedido não devolve o número: depois de apagar formulários de teste, volte aqui para o número certo.{saved === null ? ' Ainda não há número salvo aqui; ao salvar, ele passa a valer.' : ''}</p>
      {message && <p className="text-xs font-semibold text-emerald-300">{message}</p>}
    </section>
  );
};
