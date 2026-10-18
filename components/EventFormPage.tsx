import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Download, Loader2, Lock, MessageCircle, Plus, ShieldCheck, X } from 'lucide-react';
import { Link } from '../lib/router';
import { dateKey } from '../functions/missions-core.js';
import { formatBrl } from '../services/eventQuote.js';
import { MAX_EXTRA_CHILDREN, addonsTotal, childrenNames, validateSiteForm, type SiteFormValues } from '../services/eventSiteForm.js';
import { normalizeFormConfig, publicFormConfig, type PublicFormConfig } from '../services/eventFormConfig.js';
import { PROVIDER, termsSections } from '../services/eventTerms.js';
import { EVENT_FORM_PRIVACY_NOTE, PRIVACY_PATH } from '../services/privacy.js';
import { DEFAULT_PHONE_COUNTRY, ddiOf } from '../services/phoneCountries.js';
import { useSiteConfig } from '../services/siteConfigService';
import { TurnstileWidget } from './publicSite/TurnstileWidget';
import { AddonCard, FormHeader, InfoTip, PackageItems, PhoneInput, StepHeader, alertBox, choice, field, pageBg, ui, useFormTheme } from './publicSite/eventFormParts';

type Values = Omit<SiteFormValues, 'pcd' | 'imageAuthorization' | 'ddi'> & { pcd: '' | 'yes' | 'no'; imageAuthorization: '' | 'yes' | 'no' };
type Field = keyof SiteFormValues;
interface Done { number: number; label: string; acceptedAtMs: number; termsVersion: string; total: number; whatsappUrl: string | null }

const EMPTY: Values = {
  packageId: '' as Values['packageId'], childName: '', childAge: '', extraChildren: [], pcd: '', pcdDetails: '', eventDate: '', eventTime: '', location: '', reference: '',
  responsibleName: '', cpf: '', email: '', whatsapp: '', extraWeb: 0, birthdayVideo: false, birthdayName: '', inviteVideo: false, inviteParents: '', inviteGuestTime: '',
  inviteDetails: '', observations: '', imageAuthorization: '', acceptTerms: false, quoteId: '',
};

const STEPS: { title: string; subtitle: string; fields: Field[] }[] = [
  { title: 'Escolha o pacote', subtitle: 'O pacote que enviamos no orçamento.', fields: ['packageId'] },
  { title: 'Aniversariante', subtitle: 'Quem é o futuro membro da liga dos Super Aniversariantes?', fields: ['childName', 'extraChildren'] },
  { title: 'Dados do evento', subtitle: 'Hora de traçar um plano perfeito!', fields: ['eventDate', 'eventTime', 'location'] },
  { title: 'Responsável', subtitle: 'Por trás de todo herói sempre há um grande líder.', fields: ['responsibleName', 'cpf', 'whatsapp', 'email'] },
  { title: 'Adicionais', subtitle: 'Complemente o pacote com desconto especial. Opcional.', fields: ['extraWeb', 'birthdayName', 'inviteParents', 'inviteGuestTime'] },
  { title: 'Termos', subtitle: 'Hora de selar nosso acordo!', fields: ['acceptTerms', 'imageAuthorization'] },
  { title: 'Revisão', subtitle: 'Confira tudo antes de concluir.', fields: [] },
];

const ACCENT: Record<string, string> = { aniversario: 'from-cyan-400 to-blue-600', visita: 'from-amber-300 to-yellow-500', vip: 'from-red-500 to-red-700' };
const QUOTE_REQUEST = 'Olá! Vi o formulário do evento e gostaria de solicitar um orçamento para outra opção.';

const brDate = (key: string) => key.split('-').reverse().join('/');
const maskCpf = (value: string) => value.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
const withText = (url: string, message: string) => {
  try { const u = new URL(url); u.searchParams.delete('text'); return `${u.toString()}${u.search ? '&' : '?'}text=${encodeURIComponent(message)}`; } catch { return url; }
};

// Rascunho no próprio aparelho (sem login): atualizar a página ou voltar depois continua de onde parou. Some ao concluir,
// ao tocar em "Recomeçar" ou depois de DRAFT_DAYS. O aceite dos termos não é guardado (precisa ser marcado de novo).
const DRAFT_KEY = 'hdc.formulario.rascunho.v1';
const DRAFT_DAYS = 14;
interface Draft { values: Values; country: string; step: number; savedAt: number }
const readDraft = (): Draft | null => {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | null;
    if (!draft?.values || Date.now() - draft.savedAt > DRAFT_DAYS * 86_400_000) { localStorage.removeItem(DRAFT_KEY); return null; }
    return { ...draft, values: { ...EMPTY, ...draft.values, acceptTerms: false }, step: Math.min(Math.max(0, Number(draft.step) || 0), STEPS.length - 1) };
  } catch { return null; }
};
const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* sem armazenamento */ } };

/**
 * Formulário da Missão (/formulario-evento): substitui o Google Forms do evento presencial. Uma seção por tela, com barra de
 * progresso; nada é gravado antes de "Concluir". Com ?orcamento=ID (link do Calendário → Orçamentos) já vem com pacote, data,
 * endereço e valor. No fim: número do formulário, PDF (formulário + termos) e WhatsApp para receber os dados do sinal.
 * Tema claro por padrão; o escuro fica lembrado no aparelho.
 */
export const EventFormPage: React.FC = () => {
  const { whatsappUrl } = useSiteConfig();
  const { theme, toggle: toggleTheme, rootClass } = useFormTheme();
  const [draft] = useState(readDraft);
  const [restored, setRestored] = useState(Boolean(draft));
  const draftQuoteId = useRef(draft?.values.quoteId ?? '');
  const [values, setValues] = useState<Values>(draft?.values ?? EMPTY);
  const [country, setCountry] = useState(draft?.country ?? DEFAULT_PHONE_COUNTRY);
  const [step, setStep] = useState(draft?.step ?? 0);
  const [error, setError] = useState('');
  const [quoteTotal, setQuoteTotal] = useState<number | null>(null);
  const [quoteNote, setQuoteNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaReset, setCaptchaReset] = useState(0);
  const [done, setDone] = useState<Done | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  // Textos, preços e termos do CRM; até o servidor responder, vale o padrão (o envio confere a versão dos termos).
  const [config, setConfig] = useState<PublicFormConfig>(() => publicFormConfig(normalizeFormConfig(null)));
  const top = useRef<HTMLDivElement>(null);
  const today = dateKey(new Date());
  const set = (patch: Partial<Values>) => { setValues((v) => ({ ...v, ...patch })); setError(''); };
  const body = useMemo(() => ({ ...values, ddi: ddiOf(country) }), [values, country]);
  const isVip = values.packageId === 'vip';
  const pack = config.packages.find((p) => p.id === values.packageId);
  const prices = config.addonPrices;
  const phoneLabel = values.whatsapp ? `+${ddiOf(country)} ${values.whatsapp}` : '';
  const terms = termsSections(
    { packageTitle: pack?.title, duration: pack?.duration, date: values.eventDate ? brDate(values.eventDate) : '', time: values.eventTime, location: values.location, name: values.responsibleName, cpf: values.cpf, whatsapp: phoneLabel, email: values.email },
    { text: config.termsText, depositDays: config.depositDays },
  );

  const loadConfig = () => {
    const quoteId = new URLSearchParams(window.location.search).get('orcamento');
    return fetch(`/api/event-form${quoteId ? `?orcamento=${encodeURIComponent(quoteId)}` : ''}`).then((r) => r.json());
  };
  // Configuração do CRM + link do orçamento: pré-preenche pacote, data e endereço (o cliente pode corrigir; o valor só vale se pacote e data baterem).
  useEffect(() => {
    const quoteId = new URLSearchParams(window.location.search).get('orcamento');
    loadConfig().then((data) => {
      if (data?.config) setConfig(data.config);
      if (!quoteId) return;
      const prefill = data?.prefill;
      if (!prefill) { setQuoteNote('Este link de orçamento venceu ou já foi usado. Preencha normalmente; conferimos o valor pelo WhatsApp.'); return; }
      // Rascunho do mesmo orçamento: mantém o que o cliente já corrigiu.
      if (draftQuoteId.current !== prefill.quoteId) setValues((v) => ({ ...v, quoteId: prefill.quoteId, packageId: prefill.packageId, eventDate: prefill.date, location: prefill.location }));
      setQuoteTotal(prefill.total);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    // Nada preenchido ainda (ou já concluído): sem rascunho, para não avisar "continuamos de onde parou" à toa.
    const untouched = step === 0 && JSON.stringify({ ...values, acceptTerms: false }) === JSON.stringify(EMPTY);
    if (done || untouched) { clearDraft(); return; }
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ values: { ...values, acceptTerms: false }, country, step, savedAt: Date.now() })); } catch { /* sem armazenamento: só não salva */ }
  }, [values, country, step, done]);

  // Recarrega para reaplicar o link do orçamento (se houver) sobre um formulário limpo.
  const restart = () => { clearDraft(); setRestored(false); window.location.reload(); };

  const scrollTop = () => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const stepError = (index: number) => {
    const result = validateSiteForm(body, { today });
    if (!result.errors) return '';
    const at = result.fields.findIndex((f) => STEPS[index].fields.includes(f));
    return at >= 0 ? result.errors[at] : '';
  };
  const next = () => {
    const message = stepError(step);
    if (message) { setError(message); return; }
    setStep((s) => s + 1); setError(''); scrollTop();
  };
  const back = () => { setStep((s) => s - 1); setError(''); scrollTop(); };

  const quoteStillValid = quoteTotal !== null && values.quoteId !== '';
  const total = quoteStillValid ? quoteTotal + addonsTotal({ ...values, extraWeb: Number(values.extraWeb) }, prices) : 0;
  const setChild = (index: number, patch: Partial<{ name: string; age: string }>) => set({ extraChildren: values.extraChildren.map((c, i) => (i === index ? { ...c, ...patch } : c)) });

  const submit = async () => {
    const result = validateSiteForm(body, { today });
    if (result.errors) {
      const at = STEPS.findIndex((s) => s.fields.includes(result.fields[0]));
      setStep(at >= 0 ? at : step); setError(result.errors[0]); scrollTop(); return;
    }
    setSubmitting(true); setError('');
    try {
      const response = await fetch('/api/event-form', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'submit', ...body, termsVersion: config.termsVersion, turnstileToken: captchaToken }) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        if (data?.error?.code === 'captcha_failed') setCaptchaReset((n) => n + 1);
        // Termos mudaram durante o preenchimento: carrega a versão nova e volta para o aceite.
        if (data?.error?.code === 'terms_changed') {
          const fresh = await loadConfig().catch(() => null);
          if (fresh?.config) setConfig(fresh.config);
          set({ acceptTerms: false }); setStep(5); scrollTop();
        }
        throw new Error(data?.error?.message || 'Não foi possível enviar agora. Tente novamente.');
      }
      setDone(data.result); scrollTop();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível enviar agora.');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadPdf = async () => {
    if (!done) return;
    setPdfBusy(true);
    try {
      const { downloadEventFormPdf } = await import('../services/eventFormPdf');
      const form = validateSiteForm(body, { today: '' }).form;
      if (form) await downloadEventFormPdf({ form, config, label: done.label, acceptedAtMs: done.acceptedAtMs, termsVersion: done.termsVersion, total: done.total, whatsappLabel: phoneLabel });
    } catch { setError('Não foi possível gerar o PDF neste aparelho. O formulário já foi enviado; peça a cópia pelo WhatsApp.'); }
    setPdfBusy(false);
  };

  return (
    <div className={rootClass}>
      <main className={pageBg}>
        <div ref={top} className="mx-auto max-w-xl scroll-mt-4">
          <FormHeader theme={theme} onToggle={toggleTheme} />

          {step === 0 && !done && (
            <div className="relative -mx-4 mb-[-2.5rem] h-56 overflow-hidden sm:mx-0 sm:h-64 sm:rounded-[2rem]">
              <img src="/images/formulario/topo.jpg" alt="Homem-Aranha com um aniversariante fantasiado" className="h-full w-full object-cover object-[50%_25%]" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-white dark:via-black/20 dark:to-[#07101d]" />
            </div>
          )}
          <h1 className="relative mb-1 text-center text-3xl font-extrabold uppercase italic leading-tight tracking-tighter sm:text-4xl">Formulário da Missão</h1>
          <p className={`relative mb-5 text-center text-sm ${ui.muted}`}>Agora é só preencher para agendar o seu evento!</p>

          {done ? <DoneView done={done} depositDays={config.depositDays} pdfBusy={pdfBusy} onPdf={downloadPdf} error={error} /> : (
            <div className={ui.card}>
              <StepHeader index={step} total={STEPS.length} title={STEPS[step].title} subtitle={STEPS[step].subtitle} />

              {restored && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
                  <span>Continuamos de onde você parou: o que você preencheu ficou salvo neste aparelho.</span>
                  <button type="button" onClick={restart} className="font-bold underline">Recomeçar</button>
                </div>
              )}
              {quoteNote && step === 0 && <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">{quoteNote}</p>}

              <div className="space-y-5">
                {step === 0 && (
                  <div className="space-y-3" role="radiogroup" aria-label="Pacote">
                    {config.packages.map((p) => (
                      <button key={p.id} type="button" role="radio" aria-checked={values.packageId === p.id} onClick={() => set({ packageId: p.id })}
                        className={`w-full overflow-hidden rounded-2xl border text-left transition-colors ${values.packageId === p.id ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500/40 dark:bg-blue-600/15' : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'}`}>
                        <div className={`h-1.5 bg-gradient-to-r ${ACCENT[p.id]}`} />
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            {/* Bolinha de seleção (como um botão de rádio). */}
                            <span aria-hidden className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${values.packageId === p.id ? 'border-blue-600 dark:border-blue-400' : 'border-slate-300 dark:border-white/30'}`}>
                              {values.packageId === p.id && <span className="h-2.5 w-2.5 rounded-full bg-blue-600 dark:bg-blue-400" />}
                            </span>
                            <div>
                              <p className="text-lg font-extrabold uppercase italic tracking-tight">{p.title}</p>
                              <p className={`text-xs font-semibold ${ui.muted}`}>{p.duration}</p>
                            </div>
                          </div>
                          {values.packageId === p.id && <PackageItems items={p.items} />}
                        </div>
                      </button>
                    ))}
                    {quoteStillValid && <p className="text-xs text-emerald-700 dark:text-emerald-300">Valor do orçamento: <strong>{formatBrl(quoteTotal)}</strong> (válido para o pacote e a data orçados).</p>}
                    <p className={`pt-1 text-center text-sm ${ui.body}`}>
                      Gostou de outra opção? <a href={withText(whatsappUrl, QUOTE_REQUEST)} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 underline hover:text-blue-500 dark:text-blue-300">Solicite orçamento</a>.
                    </p>
                  </div>
                )}

                {step === 1 && (
                  <>
                    <label className={ui.label}>{isVip ? 'Nome do evento ou da empresa *' : 'Nome do aniversariante *'}
                      <input value={values.childName} onChange={(e) => set({ childName: e.target.value })} className={field} autoComplete="off" maxLength={100} />
                    </label>
                    {!isVip && (
                      <label className={ui.label}>Idade que vai completar
                        <input value={values.childAge} onChange={(e) => set({ childAge: e.target.value })} className={field} inputMode="numeric" maxLength={20} placeholder="Ex.: 5 anos" />
                        <span className={ui.hint}>Ajuda a adaptar as brincadeiras.</span>
                      </label>
                    )}
                    {!isVip && (
                      <div className="space-y-3">
                        {values.extraChildren.map((child, index) => (
                          <div key={index} className={`${ui.panel} flex items-end gap-2 p-3`}>
                            <label className={`${ui.label} min-w-0 flex-1`}>Nome da outra criança *<input value={child.name} onChange={(e) => setChild(index, { name: e.target.value })} className={field} maxLength={100} /></label>
                            <label className={`${ui.label} w-24`}>Idade<input value={child.age} onChange={(e) => setChild(index, { age: e.target.value })} className={field} maxLength={20} /></label>
                            <button type="button" onClick={() => set({ extraChildren: values.extraChildren.filter((_, i) => i !== index) })} aria-label="Remover criança" className="mb-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-200 dark:text-white/60 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
                          </div>
                        ))}
                        {values.extraChildren.length < MAX_EXTRA_CHILDREN && (
                          <button type="button" onClick={() => set({ extraChildren: [...values.extraChildren, { name: '', age: '' }] })} className="flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-500 dark:text-blue-300">
                            <Plus className="h-4 w-4" />Adicionar outra criança (irmãos)
                          </button>
                        )}
                        {values.extraChildren.length > 0 && (
                          <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                            Cada criança a mais recebe o seu certificado individual: acréscimo de <strong>{formatBrl(prices.extraChild)}</strong> por criança no orçamento.
                          </p>
                        )}
                      </div>
                    )}
                    <fieldset>
                      <legend className={ui.label}>Algum participante precisa de atenção especial (PCD/PNE)?</legend>
                      <span className={ui.hint}>Podemos deixar a missão ainda mais inclusiva! Opcional.</span>
                      <div className="mt-2 flex gap-2">
                        <button type="button" aria-pressed={values.pcd === 'yes'} onClick={() => set({ pcd: 'yes' })} className={choice(values.pcd === 'yes')}>Sim</button>
                        <button type="button" aria-pressed={values.pcd === 'no'} onClick={() => set({ pcd: 'no', pcdDetails: '' })} className={choice(values.pcd === 'no')}>Não</button>
                      </div>
                    </fieldset>
                    {values.pcd === 'yes' && (
                      <label className={ui.label}>Como podemos adaptar?
                        <textarea rows={2} value={values.pcdDetails} onChange={(e) => set({ pcdDetails: e.target.value })} className={field} maxLength={300} />
                        <span className={ui.hint}>Conte só o que ajuda a adaptar a apresentação.</span>
                      </label>
                    )}
                  </>
                )}

                {step === 2 && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className={ui.label}>Data do evento *<input type="date" min={today} value={values.eventDate} onChange={(e) => set({ eventDate: e.target.value })} className={field} /></label>
                      <div>
                        <label htmlFor="event-time" className={ui.label}>Início da participação *</label>
                        <InfoTip label="Início da participação">Coloque o horário combinado pelo WhatsApp. Se precisar alterar, verifique a disponibilidade antes de preencher.</InfoTip>
                        <input id="event-time" type="time" value={values.eventTime} onChange={(e) => set({ eventTime: e.target.value })} className={field} />
                      </div>
                    </div>
                    <label className={ui.label}>Endereço do local do evento ou nome do salão *
                      <textarea rows={2} value={values.location} onChange={(e) => set({ location: e.target.value })} className={field} maxLength={300} placeholder="Rua, número, bairro e cidade" />
                      <span className={ui.hint}>Onde exatamente será nosso ponto de encontro?</span>
                    </label>
                    <label className={ui.label}>Ponto de referência
                      <input value={values.reference} onChange={(e) => set({ reference: e.target.value })} className={field} maxLength={200} />
                    </label>
                    {quoteStillValid && values.eventDate && <p className={`text-xs ${ui.muted}`}>Mudou a data ou o pacote? Sem problema: conferimos o valor pelo WhatsApp.</p>}
                  </>
                )}

                {step === 3 && (
                  <>
                    <label className={ui.label}>Nome completo do responsável *<input value={values.responsibleName} onChange={(e) => set({ responsibleName: e.target.value })} className={field} autoComplete="name" maxLength={120} /></label>
                    <label className={ui.label}>CPF *<input value={values.cpf} onChange={(e) => set({ cpf: maskCpf(e.target.value) })} className={field} inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" />
                      <span className={ui.hint}>Identifica quem contrata no termo de contratação.</span>
                    </label>
                    <PhoneInput title="WhatsApp *" country={country} number={values.whatsapp} onCountry={setCountry} onNumber={(whatsapp) => set({ whatsapp })} note="É por ele que enviamos os dados do pagamento." />
                    <label className={ui.label}>E-mail *<input type="email" value={values.email} onChange={(e) => set({ email: e.target.value })} className={field} autoComplete="email" maxLength={254} /></label>
                    <p className={`text-xs leading-relaxed ${ui.muted}`}>{EVENT_FORM_PRIVACY_NOTE} <a href={PRIVACY_PATH} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 underline dark:text-blue-300">Política de Privacidade</a>.</p>
                  </>
                )}

                {step === 4 && (
                  <div className="space-y-4">
                    <AddonCard image="/images/formulario/teia-extra.jpg" title="Lançamento de teia extra" video={config.addonVideos.extraWeb} price={`${formatBrl(prices.extraWeb)} cada`} checked={values.extraWeb > 0}
                      text="Os pacotes já incluem um lançamento. As teias são de papel enrolado, descartáveis, e só o personagem lança."
                      control={(
                        <div className="flex gap-2" role="group" aria-label="Teias extras">
                          {[0, 1, 2].map((n) => (
                            <button key={n} type="button" aria-pressed={values.extraWeb === n} onClick={() => set({ extraWeb: n })} className={choice(values.extraWeb === n)}>
                              {n === 0 ? 'Não' : <span className="leading-tight">+{n}<span className="block text-[11px] font-semibold opacity-70">{formatBrl(n * prices.extraWeb)}</span></span>}
                            </button>
                          ))}
                        </div>
                      )} />
                    <AddonCard image="/images/formulario/video-aniversario.jpg" title="Vídeo Especial de Aniversário" video={config.addonVideos.birthdayVideo} price={`+${formatBrl(prices.birthdayVideo)}`} checked={values.birthdayVideo}
                      onChange={(birthdayVideo) => set({ birthdayVideo, birthdayName: birthdayVideo ? values.birthdayName || values.childName.split(' ')[0] : '' })}
                      text="Mais de 1 minuto, já gravado pelo Homem-Aranha com o primeiro nome da criança. Entregue em instantes após o pagamento, se o nome estiver no nosso banco de vídeos.">
                      <label className={ui.label}>Primeiro nome no vídeo *<input value={values.birthdayName} onChange={(e) => set({ birthdayName: e.target.value })} className={field} maxLength={40} /></label>
                    </AddonCard>
                    <AddonCard image="/images/formulario/video-convite.jpg" title="Vídeo Convite" video={config.addonVideos.inviteVideo} price={`+${formatBrl(prices.inviteVideo)}`} checked={values.inviteVideo}
                      onChange={(inviteVideo) => set({ inviteVideo })}
                      text="Cerca de 1 minuto, personalizado: o Homem-Aranha convida para a festa e inclui uma arte de brinde. Entrega em até 7 dias corridos após o pagamento.">
                      <dl className={`${ui.panel} grid grid-cols-2 gap-x-3 gap-y-2 p-3 text-sm`}>
                        {[['Nome da criança', childrenNames(values)], ['Idade', values.childAge], ['Data', values.eventDate ? brDate(values.eventDate) : ''], ['Endereço', values.location]].map(([name, value]) => (
                          <div key={name} className={name === 'Endereço' ? 'col-span-2' : ''}><dt className={`text-xs ${ui.muted}`}>{name}</dt><dd className="break-words font-semibold">{value || '—'}</dd></div>
                        ))}
                      </dl>
                      <p className={`text-xs ${ui.muted}`}>Esses dados vêm do que você já preencheu.</p>
                      <label className={ui.label}>Nome dos pais *<input value={values.inviteParents} onChange={(e) => set({ inviteParents: e.target.value })} className={field} maxLength={120} placeholder="Ex.: Ana e Pedro" /></label>
                      <label className={ui.label}>Horário para os convidados *<input type="time" value={values.inviteGuestTime} onChange={(e) => set({ inviteGuestTime: e.target.value })} className={field} />
                        <span className={ui.hint}>O horário da festa que aparece no convite (pode ser diferente do início da participação).</span>
                      </label>
                      <label className={ui.label}>Detalhes<textarea rows={2} value={values.inviteDetails} onChange={(e) => set({ inviteDetails: e.target.value })} className={field} maxLength={500} placeholder="Ex.: venha fantasiado, confirme sua presença" /></label>
                    </AddonCard>
                    <label className={ui.label}>Algo mais que devemos saber?<textarea rows={2} value={values.observations} onChange={(e) => set({ observations: e.target.value })} className={field} maxLength={1000} placeholder="Ex.: não cantamos É big, é big…" /></label>
                  </div>
                )}

                {step === 5 && (
                  <>
                    <div className={`${ui.panel} max-h-80 space-y-3 overflow-y-auto p-4 text-xs leading-relaxed ${ui.body}`} tabIndex={0} aria-label="Termos de contratação">
                      {terms.map((section) => (
                        <section key={section.title}>
                          <p className="mb-1 text-sm font-bold text-slate-900 dark:text-white">{section.title}</p>
                          <ol className="list-decimal space-y-1 pl-4">{section.items.map((item) => <li key={item}>{item}</li>)}</ol>
                        </section>
                      ))}
                    </div>
                    <label className={`${ui.panel} flex items-start gap-3 p-3 text-sm`}>
                      <input type="checkbox" checked={values.acceptTerms} onChange={(e) => set({ acceptTerms: e.target.checked })} className="mt-0.5 h-5 w-5 shrink-0 accent-blue-600" />
                      <span><strong>Li e aceito os termos de contratação.</strong> <span className={ui.muted}>Assinatura de teia!</span></span>
                    </label>
                    <fieldset>
                      <legend className={ui.label}>Autorização do uso de imagens *</legend>
                      <span className={ui.hint}>As câmeras vão capturar momentos incríveis! Podemos mostrar fotos e vídeos da festa nas nossas redes sociais e no site? Você pode mudar de ideia a qualquer momento pelo WhatsApp.</span>
                      <div className="mt-2 flex gap-2">
                        <button type="button" aria-pressed={values.imageAuthorization === 'yes'} onClick={() => set({ imageAuthorization: 'yes' })} className={choice(values.imageAuthorization === 'yes')}>Sim, autorizo</button>
                        <button type="button" aria-pressed={values.imageAuthorization === 'no'} onClick={() => set({ imageAuthorization: 'no' })} className={choice(values.imageAuthorization === 'no')}>Não autorizo</button>
                      </div>
                    </fieldset>
                  </>
                )}

                {step === 6 && (
                  <>
                    <dl className={`${ui.panel} divide-y divide-slate-200 text-sm dark:divide-white/5`}>
                      {[
                        ['Pacote', pack?.title ?? ''],
                        [isVip ? 'Evento' : 'Aniversariante', `${childrenNames(values)}${values.childAge ? ` (${values.childAge})` : ''}`],
                        ['Data e início', values.eventDate ? `${brDate(values.eventDate)} às ${values.eventTime}` : ''],
                        ['Local', `${values.location}${values.reference ? ` (ref.: ${values.reference})` : ''}`],
                        ['Responsável', `${values.responsibleName} · CPF ${values.cpf}`],
                        ['Contato', `${phoneLabel} · ${values.email}`],
                        ['Adicionais', [values.extraWeb ? `${values.extraWeb} teia(s) extra(s)` : '', values.extraChildren.length ? `${values.extraChildren.length} certificado(s) a mais` : '', values.birthdayVideo ? `Vídeo de Aniversário (${values.birthdayName})` : '', values.inviteVideo ? 'Vídeo Convite' : ''].filter(Boolean).join(' · ') || 'Nenhum'],
                        ['Uso de imagens', values.imageAuthorization === 'yes' ? 'Autorizado' : 'Não autorizado'],
                      ].map(([name, value]) => (
                        <div key={name} className="flex flex-col gap-0.5 px-3 py-2.5 sm:flex-row sm:gap-3"><dt className={`shrink-0 text-xs font-semibold sm:w-32 ${ui.muted}`}>{name}</dt><dd className="min-w-0 break-words">{value}</dd></div>
                      ))}
                    </dl>
                    <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-100">
                      {total > 0 ? <>Valor total: <strong>{formatBrl(total)}</strong> (orçamento + adicionais). </> : 'O valor é o do orçamento enviado pelo WhatsApp, somado aos adicionais. '}
                      A data fica <strong>reservada</strong> com o sinal de 50%, pago em até {config.depositDays} dias. Depois de concluir, é só nos chamar no WhatsApp para receber os dados do pagamento.
                    </p>
                    <TurnstileWidget onToken={setCaptchaToken} resetKey={captchaReset} />
                  </>
                )}
              </div>

              {error && <p role="alert" className={`mt-4 ${alertBox}`}>{error}</p>}

              <div className="mt-6 flex gap-2">
                {step > 0 && <button type="button" onClick={back} disabled={submitting} className={ui.secondary}><ArrowLeft className="h-4 w-4" />Voltar</button>}
                {step < STEPS.length - 1
                  ? <button type="button" onClick={next} className={ui.primary}>Avançar<ArrowRight className="h-4 w-4" /></button>
                  : <button type="button" onClick={submit} disabled={submitting} className={ui.primary}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Concluir</button>}
              </div>
            </div>
          )}

          <p className={`mt-4 px-2 text-center text-[11px] leading-relaxed ${ui.muted}`}>
            <Lock className="mr-1 inline h-3 w-3 align-[-1px]" aria-hidden />
            Formulário oficial do {PROVIDER.tradeName} · CNPJ {PROVIDER.cnpj}. Conexão segura; seus dados não são compartilhados. Até concluir, o preenchimento fica salvo só neste aparelho.
          </p>
          <p className={`mt-3 text-center text-[11px] ${ui.muted}`}>© Herói da Cidade · <Link href="/" className="underline">heroidacidade.com</Link> · <Link href={PRIVACY_PATH} className="underline">Privacidade</Link></p>
        </div>
      </main>
    </div>
  );
};

const DoneView: React.FC<{ done: Done; depositDays: number; pdfBusy: boolean; onPdf: () => void; error: string }> = ({ done, depositDays, pdfBusy, onPdf, error }) => (
  <div className={`${ui.card} text-center`}>
    <ShieldCheck className="mx-auto h-12 w-12 text-emerald-500" aria-hidden />
    <p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">Formulário enviado</p>
    <p className="mt-1 text-3xl font-extrabold italic tracking-tight">{done.label}</p>
    <p className={`mx-auto mt-3 max-w-sm text-sm leading-relaxed ${ui.body}`}>
      Recebemos tudo! Sua data fica <strong>pré-agendada</strong> e é <strong>garantida com o sinal de 50%</strong>{done.total > 0 ? ` (${formatBrl(done.total / 2)})` : ''}, pago em até {depositDays} dias.
    </p>
    <div className="mt-6 space-y-2">
      {done.whatsappUrl && (
        <a href={done.whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-extrabold uppercase tracking-wide text-white hover:bg-emerald-500">
          <MessageCircle className="h-4 w-4" />Receber dados para o pagamento
        </a>
      )}
      <button type="button" onClick={onPdf} disabled={pdfBusy} className={`${ui.secondary} w-full`}>
        {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Baixar formulário e termos (PDF)
      </button>
    </div>
    {error && <p role="alert" className="mt-4 text-sm font-semibold text-amber-700 dark:text-amber-200">{error}</p>}
  </div>
);
