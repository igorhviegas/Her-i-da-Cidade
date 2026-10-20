import React, { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, HeartHandshake, Loader2, Lock, Plus, X } from 'lucide-react';
import { Link } from '../lib/router';
import { MAX_CHILDREN, TERMS_SECTIONS, TERMS_VERSION, validateCollabForm, type CollabFormValues } from '../services/collab.js';
import { COLLAB_FORM_PRIVACY_NOTE, PRIVACY_PATH } from '../services/privacy.js';
import { DEFAULT_PHONE_COUNTRY, ddiOf } from '../services/phoneCountries.js';
import { TurnstileWidget } from './publicSite/TurnstileWidget';
import { FormHeader, PhoneInput, StepHeader, alertBox, choice, field, pageBg, ui, useFormTheme } from './publicSite/eventFormParts';

type Field = keyof CollabFormValues;
const EMPTY: CollabFormValues = { name: '', instagram: '', whatsapp: '', ddi: '55', city: '', children: [{ name: '', age: '' }], contentType: '', acceptTerms: false, childImage: '' };

const STEPS: { title: string; subtitle: string; fields: Field[] }[] = [
  { title: 'Sobre você', subtitle: 'Para a equipe te conhecer e falar com você.', fields: ['name', 'instagram', 'whatsapp', 'city'] },
  { title: 'Seus pequenos e o seu conteúdo', subtitle: 'Só o primeiro nome e a idade de cada um.', fields: ['children', 'contentType'] },
  { title: 'Termo de participação', subtitle: 'Como funciona a Collab e o uso das imagens.', fields: ['acceptTerms', 'childImage'] },
  { title: 'Revisão', subtitle: 'Confira tudo antes de enviar.', fields: [] },
];

/**
 * Cadastro das Mamães em Collab (/mamaes-em-collab): link enviado em particular pela equipe, fora do Google (noindex). Mesmo visual do
 * Formulário da Missão; nada é gravado antes de "Enviar". O envio cria (ou atualiza) a ficha da criadora no CRM (functions/collab.js).
 */
export const CollabFormPage: React.FC = () => {
  const { theme, toggle: toggleTheme, rootClass } = useFormTheme();
  const [values, setValues] = useState<CollabFormValues>(EMPTY);
  const [country, setCountry] = useState(DEFAULT_PHONE_COUNTRY);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaReset, setCaptchaReset] = useState(0);
  const [doneName, setDoneName] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const body = { ...values, ddi: ddiOf(country) };
  const set = (patch: Partial<CollabFormValues>) => { setValues((v) => ({ ...v, ...patch })); setError(''); };
  const setChild = (index: number, patch: Partial<{ name: string; age: string }>) => set({ children: values.children.map((c, i) => (i === index ? { ...c, ...patch } : c)) });
  const scrollTop = () => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const stepError = (index: number) => {
    const result = validateCollabForm(body);
    const at = result.fields.findIndex((f) => STEPS[index].fields.includes(f));
    return result.errors && at >= 0 ? result.errors[at] : '';
  };
  const next = () => {
    const message = stepError(step);
    if (message) { setError(message); return; }
    setStep((s) => s + 1); setError(''); scrollTop();
  };
  const back = () => { setStep((s) => s - 1); setError(''); scrollTop(); };

  const submit = async () => {
    const result = validateCollabForm(body);
    if (result.errors) {
      const at = STEPS.findIndex((s) => s.fields.includes(result.fields[0]));
      setStep(at >= 0 ? at : step); setError(result.errors[0]); scrollTop(); return;
    }
    setSubmitting(true); setError('');
    try {
      const response = await fetch('/api/event-form', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'collab', ...body, termsVersion: TERMS_VERSION, turnstileToken: captchaToken }) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        if (data?.error?.code === 'captcha_failed') setCaptchaReset((n) => n + 1);
        throw new Error(data?.error?.message || 'Não foi possível enviar agora. Tente novamente.');
      }
      setDoneName(data.result?.firstName ?? '');
      scrollTop();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível enviar agora.');
    } finally {
      setSubmitting(false);
    }
  };

  const phoneLabel = values.whatsapp ? `+${ddiOf(country)} ${values.whatsapp}` : '';

  return (
    <div className={rootClass}>
      <main className={pageBg}>
        <div ref={top} className="mx-auto max-w-xl scroll-mt-4">
          <FormHeader theme={theme} onToggle={toggleTheme} />

          {step === 0 && doneName === null && (
            <div className="relative -mx-4 mb-[-2.5rem] h-56 overflow-hidden sm:mx-0 sm:h-64 sm:rounded-[2rem]">
              <img src="/images/formulario/topo.jpg" alt="Homem-Aranha com uma criança fantasiada" className="h-full w-full object-cover object-[50%_25%]" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-white dark:via-black/20 dark:to-[#07101d]" />
            </div>
          )}
          <h1 className="relative mb-1 text-center text-3xl font-extrabold uppercase italic leading-tight tracking-tighter sm:text-4xl">Mamães em Collab</h1>
          <p className={`relative mb-5 text-center text-sm ${ui.muted}`}>Você foi selecionada para uma Collab especial com o Herói da Cidade!</p>

          {doneName !== null ? (
            <div className={`${ui.card} text-center`}>
              <HeartHandshake className="mx-auto h-12 w-12 text-emerald-500" aria-hidden />
              <p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">Cadastro enviado</p>
              <p className="mt-1 text-2xl font-extrabold italic tracking-tight">Obrigado{doneName ? `, ${doneName}` : ''}!</p>
              <p className={`mx-auto mt-3 max-w-sm text-sm leading-relaxed ${ui.body}`}>Recebemos tudo. A equipe vai analisar e falar com você pelo WhatsApp com os próximos passos da Collab.</p>
            </div>
          ) : (
            <div className={ui.card}>
              <StepHeader index={step} total={STEPS.length} title={STEPS[step].title} subtitle={STEPS[step].subtitle} />
              <div className="space-y-5">
                {step === 0 && (
                  <>
                    <label className={ui.label}>Seu nome *<input value={values.name} onChange={(e) => set({ name: e.target.value })} className={field} autoComplete="name" maxLength={120} /></label>
                    <label className={ui.label}>Seu @ no Instagram *
                      <input value={values.instagram} onChange={(e) => set({ instagram: e.target.value })} className={field} autoCapitalize="none" autoCorrect="off" maxLength={60} placeholder="@seuperfil" />
                    </label>
                    <PhoneInput title="WhatsApp *" country={country} number={values.whatsapp} onCountry={setCountry} onNumber={(whatsapp) => set({ whatsapp })} note="É por ele que a equipe vai falar com você." />
                    <label className={ui.label}>Cidade *<input value={values.city} onChange={(e) => set({ city: e.target.value })} className={field} autoComplete="address-level2" maxLength={80} placeholder="Ex.: Belo Horizonte" /></label>
                    <p className={`text-xs leading-relaxed ${ui.muted}`}>{COLLAB_FORM_PRIVACY_NOTE} <a href={PRIVACY_PATH} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 underline dark:text-blue-300">Política de Privacidade</a>.</p>
                  </>
                )}

                {step === 1 && (
                  <>
                    <div className="space-y-3">
                      {values.children.map((child, index) => (
                        <div key={index} className={`${ui.panel} flex items-end gap-2 p-3`}>
                          <label className={`${ui.label} min-w-0 flex-1`}>Primeiro nome *<input value={child.name} onChange={(e) => setChild(index, { name: e.target.value })} className={field} maxLength={40} /></label>
                          <label className={`${ui.label} w-24`}>Idade *<input value={child.age} onChange={(e) => setChild(index, { age: e.target.value })} className={field} maxLength={20} placeholder="4 anos" /></label>
                          {values.children.length > 1 && (
                            <button type="button" onClick={() => set({ children: values.children.filter((_, i) => i !== index) })} aria-label="Remover" className="mb-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-200 dark:text-white/60 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
                          )}
                        </div>
                      ))}
                      {values.children.length < MAX_CHILDREN && (
                        <button type="button" onClick={() => set({ children: [...values.children, { name: '', age: '' }] })} className="flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-500 dark:text-blue-300">
                          <Plus className="h-4 w-4" />Adicionar outro filho ou filha
                        </button>
                      )}
                    </div>
                    <label className={ui.label}>Que tipo de conteúdo você produz? *
                      <textarea rows={3} value={values.contentType} onChange={(e) => set({ contentType: e.target.value })} className={field} maxLength={500} placeholder="Ex.: rotina com as crianças, dicas de maternidade, passeios em família" />
                    </label>
                  </>
                )}

                {step === 2 && (
                  <>
                    <div className={`${ui.panel} max-h-80 space-y-3 overflow-y-auto p-4 text-xs leading-relaxed ${ui.body}`} tabIndex={0} aria-label="Termo de participação">
                      {TERMS_SECTIONS.map((section) => (
                        <section key={section.title}>
                          <p className="mb-1 text-sm font-bold text-slate-900 dark:text-white">{section.title}</p>
                          <ol className="list-decimal space-y-1 pl-4">{section.items.map((item) => <li key={item}>{item}</li>)}</ol>
                        </section>
                      ))}
                    </div>
                    <label className={`${ui.panel} flex items-start gap-3 p-3 text-sm`}>
                      <input type="checkbox" checked={values.acceptTerms} onChange={(e) => set({ acceptTerms: e.target.checked })} className="mt-0.5 h-5 w-5 shrink-0 accent-blue-600" />
                      <span><strong>Li e aceito o termo de participação e de uso de imagem, voz e conteúdo.</strong></span>
                    </label>
                    <fieldset>
                      <legend className={ui.label}>Seus filhos podem aparecer no conteúdo? *</legend>
                      <span className={ui.hint}>Não é obrigatório: a Collab funciona do mesmo jeito sem as crianças. Como responsável, você pode mudar de ideia pelo WhatsApp.</span>
                      <div className="mt-2 flex gap-2">
                        <button type="button" aria-pressed={values.childImage === 'yes'} onClick={() => set({ childImage: 'yes' })} className={choice(values.childImage === 'yes')}>Sim, autorizo</button>
                        <button type="button" aria-pressed={values.childImage === 'no'} onClick={() => set({ childImage: 'no' })} className={choice(values.childImage === 'no')}>Prefiro que não</button>
                      </div>
                    </fieldset>
                  </>
                )}

                {step === 3 && (
                  <>
                    <dl className={`${ui.panel} divide-y divide-slate-200 text-sm dark:divide-white/5`}>
                      {[
                        ['Nome', values.name],
                        ['Instagram', values.instagram ? `@${values.instagram.replace(/^@/, '')}` : ''],
                        ['WhatsApp', phoneLabel],
                        ['Cidade', values.city],
                        ['Filhos', values.children.map((c) => `${c.name} (${c.age})`).join(' · ')],
                        ['Conteúdo', values.contentType],
                        ['Crianças no conteúdo', values.childImage === 'yes' ? 'Autorizado' : 'Prefere que não'],
                      ].map(([name, value]) => (
                        <div key={name} className="flex flex-col gap-0.5 px-3 py-2.5 sm:flex-row sm:gap-3"><dt className={`shrink-0 text-xs font-semibold sm:w-36 ${ui.muted}`}>{name}</dt><dd className="min-w-0 break-words">{value}</dd></div>
                      ))}
                    </dl>
                    <TurnstileWidget onToken={setCaptchaToken} resetKey={captchaReset} />
                  </>
                )}
              </div>

              {error && <p role="alert" className={`mt-4 ${alertBox}`}>{error}</p>}

              <div className="mt-6 flex gap-2">
                {step > 0 && <button type="button" onClick={back} disabled={submitting} className={ui.secondary}><ArrowLeft className="h-4 w-4" />Voltar</button>}
                {step < STEPS.length - 1
                  ? <button type="button" onClick={next} className={ui.primary}>Avançar<ArrowRight className="h-4 w-4" /></button>
                  : <button type="button" onClick={submit} disabled={submitting} className={ui.primary}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Enviar</button>}
              </div>
            </div>
          )}

          <p className={`mt-4 px-2 text-center text-[11px] leading-relaxed ${ui.muted}`}>
            <Lock className="mr-1 inline h-3 w-3 align-[-1px]" aria-hidden />
            Cadastro oficial do Herói da Cidade. Conexão segura; seus dados não são compartilhados.
          </p>
          <p className={`mt-3 text-center text-[11px] ${ui.muted}`}>© Herói da Cidade · <Link href="/" className="underline">heroidacidade.com</Link> · <Link href={PRIVACY_PATH} className="underline">Privacidade</Link></p>
        </div>
      </main>
    </div>
  );
};
