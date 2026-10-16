import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Download, Loader2, Lock, MessageCircle, ShieldCheck } from 'lucide-react';
import { Link } from '../lib/router';
import { dateKey } from '../functions/missions-core.js';
import { PACKAGES, formatBrl } from '../services/eventQuote.js';
import { ADDON_PRICES, addonsTotal, validateSiteForm, type SiteFormValues } from '../services/eventSiteForm.js';
import { DEPOSIT_DAYS, PROVIDER, termsSections } from '../services/eventTerms.js';
import { EVENT_FORM_PRIVACY_NOTE, PRIVACY_PATH } from '../services/privacy.js';
import { DEFAULT_PHONE_COUNTRY, ddiOf } from '../services/phoneCountries.js';
import { PhoneField, box, field, heading, hint, label, primary } from './publicSite/videoCallShared';
import { TurnstileWidget } from './publicSite/TurnstileWidget';

type Values = Omit<SiteFormValues, 'pcd' | 'imageAuthorization' | 'ddi'> & { pcd: '' | 'yes' | 'no'; imageAuthorization: '' | 'yes' | 'no' };
type Field = keyof SiteFormValues;
interface Done { number: number; label: string; acceptedAtMs: number; termsVersion: string; total: number; whatsappUrl: string | null }

const EMPTY: Values = {
  packageId: '' as Values['packageId'], childName: '', childAge: '', pcd: '', pcdDetails: '', eventDate: '', eventTime: '', location: '', reference: '',
  responsibleName: '', cpf: '', email: '', whatsapp: '', extraWeb: 0, birthdayVideo: false, birthdayName: '', inviteVideo: false, inviteDetails: '',
  observations: '', imageAuthorization: '', acceptTerms: false, quoteId: '',
};

const STEPS: { title: string; subtitle: string; fields: Field[] }[] = [
  { title: 'Pacote', subtitle: 'Escolha o pacote que enviamos no orçamento.', fields: ['packageId'] },
  { title: 'Aniversariante', subtitle: 'Quem é o futuro membro da liga dos Super Aniversariantes?', fields: ['childName'] },
  { title: 'Evento', subtitle: 'Hora de traçar um plano perfeito!', fields: ['eventDate', 'eventTime', 'location'] },
  { title: 'Responsável', subtitle: 'Por trás de todo herói sempre há um grande líder.', fields: ['responsibleName', 'cpf', 'whatsapp', 'email'] },
  { title: 'Adicionais', subtitle: 'Complemente o pacote com desconto especial (opcional).', fields: ['extraWeb', 'birthdayName'] },
  { title: 'Termos', subtitle: 'Hora de selar nosso acordo!', fields: ['acceptTerms', 'imageAuthorization'] },
  { title: 'Revisão', subtitle: 'Confira tudo antes de concluir.', fields: [] },
];

const ACCENT: Record<string, string> = {
  aniversario: 'from-cyan-400 to-blue-600', visita: 'from-amber-300 to-yellow-500', vip: 'from-red-500 to-red-700',
};

const brDate = (key: string) => key.split('-').reverse().join('/');
const maskCpf = (value: string) => value.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
const radio = (active: boolean) => `flex min-h-12 flex-1 items-center justify-center rounded-xl border px-3 text-sm font-bold transition-colors ${active ? 'border-blue-500 bg-blue-600/20 text-white' : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'}`;

/**
 * Formulário da Missão (/formulario-evento): substitui o Google Forms do evento presencial. Uma seção por tela, com barra de
 * progresso; nada é gravado antes de "Concluir". Com ?orcamento=ID (link do Calendário → Orçamentos) já vem com pacote, data,
 * endereço e valor. No fim: número do formulário, PDF (formulário + termos) e WhatsApp para pedir os dados do sinal.
 */
export const EventFormPage: React.FC = () => {
  const [values, setValues] = useState<Values>(EMPTY);
  const [country, setCountry] = useState(DEFAULT_PHONE_COUNTRY);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [quoteTotal, setQuoteTotal] = useState<number | null>(null);
  const [quoteNote, setQuoteNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaReset, setCaptchaReset] = useState(0);
  const [done, setDone] = useState<Done | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const today = dateKey(new Date());
  const set = (patch: Partial<Values>) => { setValues((v) => ({ ...v, ...patch })); setError(''); };
  const body = useMemo(() => ({ ...values, ddi: ddiOf(country) }), [values, country]);
  const isVip = values.packageId === 'vip';
  const pack = PACKAGES.find((p) => p.id === values.packageId);

  // Link do orçamento: pré-preenche pacote, data e endereço (o cliente pode corrigir; o valor só vale se pacote e data baterem).
  useEffect(() => {
    const quoteId = new URLSearchParams(window.location.search).get('orcamento');
    if (!quoteId) return;
    fetch(`/api/event-form?orcamento=${encodeURIComponent(quoteId)}`).then((r) => r.json()).then((data) => {
      const prefill = data?.prefill;
      if (!prefill) { setQuoteNote('Este link de orçamento venceu ou já foi usado. Preencha normalmente; conferimos o valor pelo WhatsApp.'); return; }
      setValues((v) => ({ ...v, quoteId: prefill.quoteId, packageId: prefill.packageId, eventDate: prefill.date, location: prefill.location }));
      setQuoteTotal(prefill.total);
    }).catch(() => undefined);
  }, []);

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
  const total = quoteStillValid ? quoteTotal + addonsTotal({ ...values, extraWeb: Number(values.extraWeb) }) : 0;

  const submit = async () => {
    const result = validateSiteForm(body, { today });
    if (result.errors) {
      const at = STEPS.findIndex((s) => s.fields.includes(result.fields[0]));
      setStep(at >= 0 ? at : step); setError(result.errors[0]); scrollTop(); return;
    }
    setSubmitting(true); setError('');
    try {
      const response = await fetch('/api/event-form', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'submit', ...body, turnstileToken: captchaToken }) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        if (data?.error?.code === 'captcha_failed') setCaptchaReset((n) => n + 1);
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
      if (form) await downloadEventFormPdf({ form, label: done.label, acceptedAtMs: done.acceptedAtMs, termsVersion: done.termsVersion, total: done.total, whatsappLabel: `+${ddiOf(country)} ${values.whatsapp}` });
    } catch { setError('Não foi possível gerar o PDF neste aparelho. O formulário já foi enviado; peça a cópia pelo WhatsApp.'); }
    setPdfBusy(false);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-black to-[#0B1929] px-4 pb-10 pt-5 text-white">
      <div ref={top} className="mx-auto max-w-xl scroll-mt-4">
        <header className="mb-5 flex justify-center">
          <Link href="/" aria-label="Herói da Cidade: ir para o site" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#0072d2] shadow-lg shadow-blue-600/30">
              <img src="/images/logo-128.webp" alt="" className="h-full w-full scale-125 object-cover" />
            </span>
            <span className="text-base font-bold tracking-tight text-white">Herói da Cidade</span>
          </Link>
        </header>
        <h1 className="mb-1 text-center text-2xl font-extrabold uppercase italic leading-tight tracking-tighter sm:text-3xl">Formulário da Missão</h1>
        <p className="mb-5 text-center text-sm text-white/60">Agora é só preencher para agendar o seu evento!</p>

        {done ? <DoneView done={done} pdfBusy={pdfBusy} onPdf={downloadPdf} error={error} /> : (
          <div className={box}>
            <div className="mb-5">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className={heading}>{STEPS[step].title}</p>
                <p className="text-xs font-semibold text-white/40">Passo {step + 1} de {STEPS.length}</p>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label="Progresso do formulário">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
              </div>
              <p className="mt-3 text-sm text-white/70">{STEPS[step].subtitle}</p>
            </div>

            {quoteNote && step === 0 && <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">{quoteNote}</p>}

            <div className="space-y-4">
              {step === 0 && (
                <div className="space-y-3" role="radiogroup" aria-label="Pacote">
                  {PACKAGES.map((p) => (
                    <button key={p.id} type="button" role="radio" aria-checked={values.packageId === p.id} onClick={() => set({ packageId: p.id })}
                      className={`w-full overflow-hidden rounded-2xl border text-left transition-colors ${values.packageId === p.id ? 'border-blue-500 bg-blue-600/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                      <div className={`h-1.5 bg-gradient-to-r ${ACCENT[p.id]}`} />
                      <div className="p-4">
                        <p className="text-lg font-extrabold uppercase italic tracking-tight">{p.title}</p>
                        <p className="text-xs font-semibold text-white/55">{p.duration}</p>
                        {values.packageId === p.id && <ul className="mt-2 space-y-0.5 text-xs text-white/70">{p.items.map((item) => <li key={item}>• {item}</li>)}</ul>}
                      </div>
                    </button>
                  ))}
                  {quoteStillValid && <p className="text-xs text-emerald-300">Valor do orçamento: <strong>{formatBrl(quoteTotal)}</strong> (válido para o pacote e a data orçados).</p>}
                </div>
              )}

              {step === 1 && (
                <>
                  <label className={label}>{isVip ? 'Nome do evento ou da empresa *' : 'Nome do aniversariante *'}
                    <input value={values.childName} onChange={(e) => set({ childName: e.target.value })} className={field} autoComplete="off" maxLength={100} />
                  </label>
                  {!isVip && (
                    <label className={label}>Idade que vai completar
                      <input value={values.childAge} onChange={(e) => set({ childAge: e.target.value })} className={field} inputMode="numeric" maxLength={20} placeholder="Ex.: 5 anos" />
                      <span className={hint}>Ajuda a adaptar as brincadeiras.</span>
                    </label>
                  )}
                  <fieldset>
                    <legend className={label}>Algum participante precisa de atenção especial (PCD/PNE)?</legend>
                    <span className={hint}>Podemos deixar a missão ainda mais inclusiva! Opcional.</span>
                    <div className="mt-2 flex gap-2">
                      <button type="button" aria-pressed={values.pcd === 'yes'} onClick={() => set({ pcd: 'yes' })} className={radio(values.pcd === 'yes')}>Sim</button>
                      <button type="button" aria-pressed={values.pcd === 'no'} onClick={() => set({ pcd: 'no', pcdDetails: '' })} className={radio(values.pcd === 'no')}>Não</button>
                    </div>
                  </fieldset>
                  {values.pcd === 'yes' && (
                    <label className={label}>Como podemos adaptar?
                      <textarea rows={2} value={values.pcdDetails} onChange={(e) => set({ pcdDetails: e.target.value })} className={field} maxLength={300} />
                      <span className={hint}>Conte só o que ajuda a adaptar a apresentação.</span>
                    </label>
                  )}
                </>
              )}

              {step === 2 && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={label}>Data do evento *<input type="date" min={today} value={values.eventDate} onChange={(e) => set({ eventDate: e.target.value })} className={field} /></label>
                    <label className={label}>Horário de início *<input type="time" value={values.eventTime} onChange={(e) => set({ eventTime: e.target.value })} className={field} /></label>
                  </div>
                  <label className={label}>Endereço do local do evento *
                    <textarea rows={2} value={values.location} onChange={(e) => set({ location: e.target.value })} className={field} maxLength={300} placeholder="Rua, número, bairro e cidade" />
                    <span className={hint}>Onde exatamente será nosso ponto de encontro?</span>
                  </label>
                  <label className={label}>Ponto de referência ou nome do salão
                    <input value={values.reference} onChange={(e) => set({ reference: e.target.value })} className={field} maxLength={200} />
                  </label>
                  {quoteStillValid && values.eventDate && (
                    <p className="text-xs text-white/50">Mudou a data ou o pacote? Sem problema: conferimos o valor pelo WhatsApp.</p>
                  )}
                </>
              )}

              {step === 3 && (
                <>
                  <label className={label}>Nome completo do responsável *<input value={values.responsibleName} onChange={(e) => set({ responsibleName: e.target.value })} className={field} autoComplete="name" maxLength={120} /></label>
                  <label className={label}>CPF *<input value={values.cpf} onChange={(e) => set({ cpf: maskCpf(e.target.value) })} className={field} inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" />
                    <span className={hint}>Identifica quem contrata no termo de contratação.</span>
                  </label>
                  <PhoneField title="WhatsApp *" country={country} number={values.whatsapp} onCountry={setCountry} onNumber={(whatsapp) => set({ whatsapp })} autoComplete="tel" note="É por ele que enviamos os dados do pagamento." />
                  <label className={label}>E-mail *<input type="email" value={values.email} onChange={(e) => set({ email: e.target.value })} className={field} autoComplete="email" maxLength={254} /></label>
                  <p className="text-xs leading-relaxed text-white/50">{EVENT_FORM_PRIVACY_NOTE} <a href={PRIVACY_PATH} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-300 underline hover:text-blue-200">Política de Privacidade</a>.</p>
                </>
              )}

              {step === 4 && (
                <>
                  <fieldset>
                    <legend className={label}>Lançamento de teia extra</legend>
                    <span className={hint}>Os pacotes já incluem um lançamento. As teias são de papel enrolado, descartáveis, e só o personagem lança.</span>
                    <div className="mt-2 flex gap-2">
                      {[0, 1, 2].map((n) => (
                        <button key={n} type="button" aria-pressed={values.extraWeb === n} onClick={() => set({ extraWeb: n })} className={radio(values.extraWeb === n)}>
                          {n === 0 ? 'Não' : <span className="leading-tight">+{n}<span className="block text-[11px] font-semibold text-white/55">{formatBrl(n * ADDON_PRICES.extraWeb)}</span></span>}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <Addon checked={values.birthdayVideo} onChange={(birthdayVideo) => set({ birthdayVideo, birthdayName: birthdayVideo ? values.birthdayName || values.childName.split(' ')[0] : '' })}
                    title={`Vídeo Especial de Aniversário (+${formatBrl(ADDON_PRICES.birthdayVideo)})`} text="Vídeo de mais de 1 minuto já gravado pelo Homem-Aranha com o primeiro nome da criança. Entregue em instantes após o pagamento, se o nome estiver no nosso banco de vídeos.">
                    <label className={label}>Primeiro nome no vídeo *<input value={values.birthdayName} onChange={(e) => set({ birthdayName: e.target.value })} className={field} maxLength={40} /></label>
                  </Addon>
                  <Addon checked={values.inviteVideo} onChange={(inviteVideo) => set({ inviteVideo })}
                    title={`Vídeo Convite (+${formatBrl(ADDON_PRICES.inviteVideo)})`} text="Cerca de 1 minuto, personalizado: o Homem-Aranha convida para o dia, horário e local da festa. Inclui arte de brinde. Entrega em até 7 dias corridos após o pagamento.">
                    <label className={label}>Detalhes para o vídeo<textarea rows={2} value={values.inviteDetails} onChange={(e) => set({ inviteDetails: e.target.value })} className={field} maxLength={500} placeholder="Ex.: venha fantasiado" /></label>
                  </Addon>
                  <label className={label}>Algo mais que devemos saber?<textarea rows={2} value={values.observations} onChange={(e) => set({ observations: e.target.value })} className={field} maxLength={1000} placeholder="Tema da festa, acesso ao local…" /></label>
                </>
              )}

              {step === 5 && (
                <>
                  <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-[#070B14] p-4 text-xs leading-relaxed text-white/70" tabIndex={0} aria-label="Termos de contratação">
                    {termsSections().map((section) => (
                      <section key={section.title}>
                        <p className="mb-1 font-bold text-white">{section.title}</p>
                        <ol className="list-decimal space-y-1 pl-4">{section.items.map((item) => <li key={item}>{item}</li>)}</ol>
                      </section>
                    ))}
                  </div>
                  <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                    <input type="checkbox" checked={values.acceptTerms} onChange={(e) => set({ acceptTerms: e.target.checked })} className="mt-0.5 h-5 w-5 shrink-0 accent-blue-600" />
                    <span><strong>Li e aceito os termos de contratação.</strong> <span className="text-white/55">Assinatura de teia!</span></span>
                  </label>
                  <fieldset>
                    <legend className={label}>Autorização do uso de imagens *</legend>
                    <span className={hint}>As câmeras vão capturar momentos incríveis! Podemos mostrar fotos e vídeos da festa nas nossas redes sociais e no site? Você pode mudar de ideia a qualquer momento pelo WhatsApp.</span>
                    <div className="mt-2 flex gap-2">
                      <button type="button" aria-pressed={values.imageAuthorization === 'yes'} onClick={() => set({ imageAuthorization: 'yes' })} className={radio(values.imageAuthorization === 'yes')}>Sim, autorizo</button>
                      <button type="button" aria-pressed={values.imageAuthorization === 'no'} onClick={() => set({ imageAuthorization: 'no' })} className={radio(values.imageAuthorization === 'no')}>Não autorizo</button>
                    </div>
                  </fieldset>
                </>
              )}

              {step === 6 && (
                <>
                  <dl className="divide-y divide-white/5 rounded-xl border border-white/10 bg-white/5 text-sm">
                    {[
                      ['Pacote', pack?.title ?? ''],
                      [isVip ? 'Evento' : 'Aniversariante', `${values.childName}${values.childAge ? ` (${values.childAge})` : ''}`],
                      ['Data e horário', values.eventDate ? `${brDate(values.eventDate)} às ${values.eventTime}` : ''],
                      ['Local', `${values.location}${values.reference ? ` (ref.: ${values.reference})` : ''}`],
                      ['Responsável', `${values.responsibleName} · CPF ${values.cpf}`],
                      ['Contato', `+${ddiOf(country)} ${values.whatsapp} · ${values.email}`],
                      ['Adicionais', [values.extraWeb ? `${values.extraWeb} teia(s) extra(s)` : '', values.birthdayVideo ? `Vídeo de Aniversário (${values.birthdayName})` : '', values.inviteVideo ? 'Vídeo Convite' : ''].filter(Boolean).join(' · ') || 'Nenhum'],
                      ['Uso de imagens', values.imageAuthorization === 'yes' ? 'Autorizado' : 'Não autorizado'],
                    ].map(([name, value]) => (
                      <div key={name} className="flex flex-col gap-0.5 px-3 py-2.5 sm:flex-row sm:gap-3"><dt className="shrink-0 text-xs font-semibold text-white/50 sm:w-32">{name}</dt><dd className="min-w-0 break-words text-white/90">{value}</dd></div>
                    ))}
                  </dl>
                  <p className="rounded-xl border border-blue-500/25 bg-blue-500/10 p-3 text-xs leading-relaxed text-blue-100">
                    {total > 0 ? <>Valor total: <strong>{formatBrl(total)}</strong> (orçamento + adicionais). </> : 'O valor é o do orçamento enviado pelo WhatsApp, somado aos adicionais. '}
                    A data fica <strong>reservada</strong> com o sinal de 50%, pago em até {DEPOSIT_DAYS} dias. Depois de concluir, é só nos chamar no WhatsApp para receber os dados do pagamento.
                  </p>
                  <TurnstileWidget onToken={setCaptchaToken} resetKey={captchaReset} />
                </>
              )}
            </div>

            {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-semibold text-red-200">{error}</p>}

            <div className="mt-6 flex gap-2">
              {step > 0 && <button type="button" onClick={back} disabled={submitting} className="flex min-h-12 items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white/80 hover:bg-white/10"><ArrowLeft className="h-4 w-4" />Voltar</button>}
              {step < STEPS.length - 1
                ? <button type="button" onClick={next} className={`${primary} flex items-center justify-center gap-1`}>Avançar<ArrowRight className="h-4 w-4" /></button>
                : <button type="button" onClick={submit} disabled={submitting} className={`${primary} flex items-center justify-center gap-2`}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Concluir</button>}
            </div>
          </div>
        )}

        <p className="mt-4 px-2 text-center text-[11px] leading-relaxed text-white/40">
          <Lock className="mr-1 inline h-3 w-3 align-[-1px]" aria-hidden />
          Formulário oficial do {PROVIDER.tradeName} · CNPJ {PROVIDER.cnpj}. Conexão segura; seus dados não são compartilhados.
        </p>
        <p className="mt-3 text-center text-[11px] text-white/30">© Herói da Cidade · <Link href="/" className="underline hover:text-white/60">heroidacidade.com</Link> · <Link href={PRIVACY_PATH} className="underline hover:text-white/60">Privacidade</Link></p>
      </div>
    </main>
  );
};

const Addon: React.FC<{ checked: boolean; onChange: (value: boolean) => void; title: string; text: string; children: React.ReactNode }> = ({ checked, onChange, title, text, children }) => (
  <div className={`rounded-xl border p-3 ${checked ? 'border-blue-500/60 bg-blue-600/10' : 'border-white/10 bg-white/5'}`}>
    <label className="flex items-start gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-blue-600" />
      <span><span className="block text-sm font-bold">{title}</span><span className="mt-0.5 block text-xs text-white/55">{text} Desconto válido só junto do pacote presencial.</span></span>
    </label>
    {checked && <div className="mt-3">{children}</div>}
  </div>
);

const DoneView: React.FC<{ done: Done; pdfBusy: boolean; onPdf: () => void; error: string }> = ({ done, pdfBusy, onPdf, error }) => (
  <div className={`${box} text-center`}>
    <ShieldCheck className="mx-auto h-12 w-12 text-emerald-400" aria-hidden />
    <p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-blue-400">Formulário enviado</p>
    <p className="mt-1 text-3xl font-extrabold italic tracking-tight">{done.label}</p>
    <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/70">
      Recebemos tudo! Sua data fica <strong className="text-white">pré-agendada</strong> e é <strong className="text-white">garantida com o sinal de 50%</strong>{done.total > 0 ? ` (${formatBrl(done.total / 2)})` : ''}, pago em até {DEPOSIT_DAYS} dias.
      Chame a gente no WhatsApp para receber os dados do pagamento.
    </p>
    <div className="mt-6 space-y-2">
      {done.whatsappUrl && (
        <a href={done.whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-extrabold uppercase tracking-wide text-white hover:bg-emerald-500">
          <MessageCircle className="h-4 w-4" />Avisar no WhatsApp
        </a>
      )}
      <button type="button" onClick={onPdf} disabled={pdfBusy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-60">
        {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Baixar formulário e termos (PDF)
      </button>
    </div>
    {error && <p role="alert" className="mt-4 text-sm font-semibold text-amber-200">{error}</p>}
  </div>
);
